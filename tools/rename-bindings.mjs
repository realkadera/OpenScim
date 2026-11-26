// Renames top-level bindings of one client chunk, following scope, and keeps
// the other chunks' imports in step. Edits text in place (no reformatting).
//
//   node tools/rename-bindings.mjs client/assets/player.js names.json [--dry] [--skip-refused]
//   node tools/rename-bindings.mjs client/assets/player.js --adopt-imports
//   node tools/rename-bindings.mjs client/assets/player.js --module-reads
//   node tools/rename-bindings.mjs --self-test
//
// --adopt-imports needs no names file: every `import { longName as x }` makes
// the local `x` take the exported name, where that name is free in the file.
//
// names.json: { "oldName": "newName" } or { "oldName": { "name": "newName" } }.
// A renamed binding that is exported gets the new name as its export name too,
// and `import { old as x }` from this file is rewritten in every module under
// client/. An import binding can be renamed as well: `import { name as x }`
// loses its alias when x is renamed to name.
//
// Code also reads an export through the module object, which no import
// specifier shows: `import * as ns`, `(await import("./x.js")).name`,
// `import("./x.js").then((module) => module.name)`, `const { name } = await
// import(...)`. Every module under client/, test/ and tools/ is searched for
// those. Where the module object is in plain sight the read is renamed with
// the export (and `export { name } from` keeps the name it gives out). Where
// it is not, the rename is refused, because `x.name` does not say what x is:
// in a file that passes the module object on, that imports a path it
// computes (the harness loads chunks by name), that names the chunk in a
// string (a test patching the served source) or that does `export * from`
// it. --skip-refused renames the rest and lists the refusals.
//
// Parameters and locals (every binding below the top level):
//
//   node tools/rename-bindings.mjs client/assets/x.js --list [--lines 100-900] [--all]
//   node tools/rename-bindings.mjs client/assets/x.js names.json --locals [--dry]
//
// names.json: { "owner": { "key": ["newName", "evidence, or the word inferred"] } }.
// An owner is a top-level name, followed by the class member the binding is
// in: "computeStep", "WorldState.reset", "Engine.get tick". A key is the
// binding's name, or `name#2` for the second binding of that name inside the
// owner, in source order. --list prints every owner with its keys (those of
// one or two characters, or all of them) and what each is made from and used
// for. After renaming, every identifier in the file must resolve to the same
// declaration as before, or nothing is written.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, posix, relative, resolve, sep } from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default ?? traverseModule;

/**
 * Returns { code, exportRenames: {oldExported: newExported}, renamed, kept }.
 * Throws on any conflict. keepExports: export names that must stay as they
 * are; a binding exported under one keeps its name (listed in `kept`) and
 * its export specifier is left alone.
 */
export function renameBindings(code, names, { adoptImports = false, keepExports = new Set() } = {}) {
  const ast = parse(code, { sourceType: "module" });
  const taken = new Set();
  let program;
  traverse(ast, {
    Program(path) {
      program = path;
      for (const name of Object.keys(path.scope.globals)) taken.add(name);
    },
    Scope(path) {
      for (const name of Object.keys(path.scope.bindings)) taken.add(name);
    },
  });

  if (adoptImports) {
    // Derive the map from the import specifiers; skip names that are not free.
    names = {};
    const claimed = new Set();
    for (const statement of ast.program.body) {
      if (statement.type !== "ImportDeclaration") continue;
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        const imported = specifier.imported.name, local = specifier.local.name;
        if (imported === local || imported.length < 4 || taken.has(imported) || claimed.has(imported)) continue;
        claimed.add(imported);
        names[local] = imported;
      }
    }
  }

  // The names each top-level binding is exported under.
  const exportedAs = new Map();
  const exportAs = (local, exported) => exportedAs.set(local, [...(exportedAs.get(local) ?? []), exported]);
  for (const statement of ast.program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source) continue;
    for (const specifier of statement.specifiers) exportAs(specifier.local.name, specifier.exported.name ?? specifier.exported.value);
    if (statement.declaration?.id) exportAs(statement.declaration.id.name, statement.declaration.id.name);
    for (const declarator of statement.declaration?.declarations ?? []) if (declarator.id.type === "Identifier") exportAs(declarator.id.name, declarator.id.name);
  }

  const problems = [], kept = [];
  const targets = new Map(); // Binding -> new name
  const wanted = new Set();
  for (const [oldName, newName] of Object.entries(names)) {
    const binding = program.scope.getOwnBinding(oldName);
    if ((exportedAs.get(oldName) ?? []).some((exported) => keepExports.has(exported))) {
      kept.push(oldName);
      continue;
    }
    if (!binding) problems.push(`${oldName}: not a top-level binding`);
    else if (!/^[A-Za-z_$][\w$]*$/.test(newName)) problems.push(`${oldName}: "${newName}" is not an identifier`);
    else if (taken.has(newName)) problems.push(`${oldName}: "${newName}" already exists in the file`);
    else if (wanted.has(newName)) problems.push(`${oldName}: "${newName}" is assigned twice`);
    else targets.set(binding, newName);
    wanted.add(newName);
  }
  if (problems.length) throw new Error("Cannot rename:\n  " + problems.join("\n  "));
  return { ...rewrite(code, ast, program, targets, keepExports), renamed: targets.size, kept };
}

/** Applies `targets` (Binding -> new name) to the text. Returns { code, exportRenames }. */
function rewrite(code, ast, program, targets, keepExports = new Set()) {
  const edits = []; // [start, end, text]
  const exportRenames = {};
  traverse(ast, {
    Identifier(path) {
      const { node, parent } = path;
      const newName = targets.get(path.scope.getBinding(node.name));
      if (!newName) return;
      // Positions where an identifier is a name, not a reference to the binding.
      if ((parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && parent.property === node && !parent.computed) return;
      if (/^(Object|Class)(Property|Method)$|^ClassPrivate/.test(parent.type) && parent.key === node && !parent.computed) {
        if (!parent.shorthand) return;
        return; // shorthand: handled when visiting the value below
      }
      if (parent.type === "ExportSpecifier" && parent.exported === node && parent.local !== node) return;
      if (parent.type === "ImportSpecifier" && parent.imported === node && parent.local !== node) return;
      if (/^(Labeled|Break|Continue)Statement$/.test(parent.type)) return;
      if (parent.type === "MetaProperty") return;

      const shorthandOwner = parent.type === "AssignmentPattern" && parent.left === node ? path.parentPath.parent : parent;
      if (shorthandOwner.type === "ObjectProperty" && shorthandOwner.shorthand) {
        edits.push([node.start, node.end, `${node.name}: ${newName}`]);
      } else if (parent.type === "ImportSpecifier" && parent.imported.name === newName) {
        edits.push([parent.start, parent.end, newName]); // `import { name as x }` -> `import { name }`
      } else if (parent.type === "ExportSpecifier") {
        // `export { old as x }` or `export { old }`: the export takes the new name.
        if (parent.exported.name !== newName) exportRenames[parent.exported.name] = newName;
        edits.push([parent.start, parent.end, newName]);
      } else {
        edits.push([node.start, node.end, newName]);
      }
    },
    // Exports of bindings that keep their name still lose their one-letter alias.
    ExportSpecifier(path) {
      const { local, exported } = path.node;
      if (path.parent.source || exported.name === local.name) return;
      if (targets.has(path.scope.getBinding(local.name)) || keepExports.has(exported.name)) return;
      exportRenames[exported.name] = local.name;
      edits.push([path.node.start, path.node.end, local.name]);
    },
  });
  // `export function old() {}`, `export const old = ...`: the declaration is the export.
  for (const [binding, newName] of targets) {
    if (binding.scope !== program.scope) continue;
    const statement = binding.path.find((at) => at.parentPath?.isProgram());
    if (statement?.isExportNamedDeclaration() && statement.node.declaration) exportRenames[binding.identifier.name] = newName;
  }

  const seen = new Set();
  let out = code;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    if (seen.has(start)) continue; // shorthand key and value share a position
    seen.add(start);
    out = out.slice(0, start) + text + out.slice(end);
  }
  // The result must parse and must refer to exactly the same free names as
  // before; a difference means a reference was left behind or captured.
  let freeAfter;
  traverse(parse(out, { sourceType: "module" }), {
    Program(path) {
      freeAfter = Object.keys(path.scope.globals).sort().join();
      path.stop();
    },
  });
  if (freeAfter !== Object.keys(program.scope.globals).sort().join()) throw new Error("Rename changed the file's free identifiers");
  return { code: out, exportRenames };
}

/** "topLevelName" or "ClassName.member": where a binding below the top level lives. */
function ownerOf(path) {
  const parts = [];
  let child = path;
  for (let at = path; !at.isProgram(); child = at, at = at.parentPath) {
    const node = at.node;
    if (/^Class(Private)?(Method|Property)$|^ClassAccessorProperty$/.test(node.type)) {
      const key = node.key.type === "PrivateName" ? "#" + node.key.id.name : node.key.name ?? String(node.key.value);
      parts.unshift((node.static ? "static " : "") + (node.kind === "get" || node.kind === "set" ? node.kind + " " : "") + key);
    } else if (at.parentPath.isProgram()) {
      const declaration = node.declaration ?? node; // `export function f() {}`
      const named = declaration.type !== "VariableDeclaration" ? declaration : child.node.type === "VariableDeclarator" ? child.node : child.parent;
      const ordinal = () => at.parent.body.filter((statement) => !/Declaration$/.test(statement.type)).indexOf(node) + 1;
      parts.unshift(named.id?.name ?? `(statement ${ordinal()})`);
    }
  }
  return parts.join(".");
}

/** Every binding below the top level: Map of owner -> Map of key -> Binding. */
function collectLocals(ast) {
  const seen = new Set();
  let program;
  traverse(ast, {
    Program(path) {
      program = path;
    },
    Scope(path) {
      if (path.scope !== program.scope) for (const binding of Object.values(path.scope.bindings)) seen.add(binding);
    },
  });
  // A class's name is bound a second time inside the class: one identifier,
  // two bindings. `twins` keeps the inner one next to the outer one.
  const owners = new Map(), twins = new Map(), byIdentifier = new Map();
  for (const binding of [...seen].sort((a, b) => a.identifier.start - b.identifier.start)) {
    if (program.scope.getOwnBinding(binding.identifier.name)?.identifier === binding.identifier) continue;
    const first = byIdentifier.get(binding.identifier);
    if (first) {
      twins.set(first, binding);
      continue;
    }
    byIdentifier.set(binding.identifier, binding);
    const owner = ownerOf(binding.path);
    if (!owners.has(owner)) owners.set(owner, []);
    owners.get(owner).push(binding);
  }
  for (const [owner, bindings] of owners) {
    const count = new Map(), ordinal = new Map(), keyed = new Map();
    for (const { identifier } of bindings) count.set(identifier.name, (count.get(identifier.name) ?? 0) + 1);
    for (const binding of bindings) {
      const name = binding.identifier.name;
      ordinal.set(name, (ordinal.get(name) ?? 0) + 1);
      keyed.set(count.get(name) === 1 ? name : `${name}#${ordinal.get(name)}`, binding);
    }
    owners.set(owner, keyed);
  }
  return { program, owners, twins };
}

/**
 * For every identifier in source order: the ordinal of the identifier that
 * declares what it refers to, or its own name where it is a property name, a
 * label or a free name. Equal lists before and after a rename mean that no
 * reference was left behind, captured or merged with another binding.
 */
function resolution(code) {
  const ordinals = new Map(), sites = [];
  traverse(parse(code, { sourceType: "module" }), {
    Identifier(path) {
      ordinals.set(path.node, sites.length);
      sites.push(path);
    },
  });
  return sites.map((path) => {
    const binding = path.isReferencedIdentifier() || path.isBindingIdentifier() ? path.scope.getBinding(path.node.name) : undefined;
    return { line: path.node.loc.start.line, name: path.node.name, target: binding ? ordinals.get(binding.identifier) : path.node.name };
  });
}

/** names: { owner: { key: newName | [newName, evidence] } }. Returns { code, renamed, left }. */
export function renameLocals(code, names) {
  const ast = parse(code, { sourceType: "module" });
  const { program, owners, twins } = collectLocals(ast);
  const problems = [], targets = new Map();
  for (const [owner, entries] of Object.entries(names)) {
    for (const [key, value] of Object.entries(entries)) {
      const newName = Array.isArray(value) ? value[0] : value;
      const binding = owners.get(owner)?.get(key);
      if (!binding) problems.push(`${owner}: no binding "${key}"`);
      else if (!/^[A-Za-z_$][\w$]*$/.test(newName)) problems.push(`${owner}: ${key}: "${newName}" is not an identifier`);
      else if (newName !== binding.identifier.name) targets.set(binding, newName);
    }
  }
  if (problems.length) throw new Error("Cannot rename:\n  " + problems.join("\n  "));
  for (const [binding, newName] of [...targets]) if (twins.has(binding)) targets.set(twins.get(binding), newName);
  const out = rewrite(code, ast, program, targets).code;
  const before = resolution(code), after = resolution(out);
  if (before.length !== after.length) problems.push("the number of identifiers changed");
  for (let index = 0; index < before.length && problems.length < 25; index++) {
    if (before[index].target === after[index]?.target) continue;
    const declaredOn = typeof before[index].target === "number" ? ` (declared on line ${before[before[index].target].line})` : "";
    problems.push(`line ${before[index].line}: "${before[index].name}"${declaredOn} as "${after[index]?.name}" would refer to something else`);
  }
  if (problems.length) throw new Error("Rename changes what identifiers refer to:\n  " + problems.join("\n  "));
  let left = 0;
  for (const keyed of owners.values()) for (const binding of keyed.values()) if ((targets.get(binding) ?? binding.identifier.name).length <= 2) left++;
  return { code: out, renamed: targets.size - [...twins.keys()].filter((binding) => targets.has(binding)).length, left };
}

/** Text for --list: one line per binding, with where it comes from and what it is used for. */
export function listLocals(code, { all = false, from = 1, to = Infinity } = {}) {
  const ast = parse(code, { sourceType: "module" });
  const text = (node, max = 72) => {
    const flat = code.slice(node.start, node.end).replace(/\s+/g, " ");
    return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
  };
  const top = (items, max) => [...items].sort((a, b) => b[1] - a[1]).slice(0, max).map(([item]) => item);
  const count = (map, item) => map.set(item, (map.get(item) ?? 0) + 1);
  const calleeName = (callee) => (/MemberExpression$/.test(callee.type) ? "." + text(callee.property, 30) : text(callee, 30));
  const lines = [];
  for (const [owner, keyed] of collectLocals(ast).owners) {
    const shown = [...keyed].filter(([, { identifier }]) => (all || identifier.name.length <= 2) && identifier.loc.start.line >= from && identifier.loc.start.line <= to);
    if (!shown.length) continue;
    const statement = shown[0][1].path.findParent((parent) => parent.parentPath?.isProgram()).node;
    lines.push(`## ${owner} (statement on lines ${statement.loc.start.line}-${statement.loc.end.line})`);
    for (const [key, binding] of shown) {
      // Where it comes from: its place inside a destructuring pattern, then the source.
      let at;
      binding.path.traverse({ Identifier(path) { if (path.node === binding.identifier) at = path; } });
      at ??= binding.path;
      let inside = "";
      for (; /^(ObjectProperty|ObjectPattern|ArrayPattern|RestElement)$/.test(at.parent.type) || (at.parent.type === "AssignmentPattern" && at.parent.left === at.node); at = at.parentPath) {
        if (at.parent.type === "ObjectProperty") inside = "." + text(at.parent.key, 30) + inside;
        else if (at.parent.type === "ArrayPattern") inside = `[${at.parent.elements.indexOf(at.node)}]` + inside;
        else if (at.parent.type === "RestElement") inside = "..." + inside;
      }
      const holder = at.parentPath;
      let origin = binding.kind;
      if (holder.isFunction() && holder.node.params.includes(at.node)) {
        const outer = holder.parent;
        const role =
          /CallExpression$|^NewExpression$/.test(outer.type)
            ? outer.callee === holder.node ? " of a function called at once" : ` of callback #${outer.arguments.indexOf(holder.node)} to ${text(outer.callee, 48)}`
            : outer.type === "VariableDeclarator" ? ` of ${text(outer.id, 30)}`
            : outer.type === "ObjectProperty" || outer.type === "ClassProperty" ? ` of .${text(outer.key, 30)}`
            : holder.node.id ? ` of ${holder.node.id.name}`
            : holder.node.key ? "" : " of a function";
        origin = `param ${holder.node.params.indexOf(at.node)}${role}`;
      } else if (holder.isVariableDeclarator()) {
        const loop = holder.parentPath.parent;
        origin = `${binding.kind} ` + (holder.node.init ? "= " + text(holder.node.init)
          : /^For(In|Of)Statement$/.test(loop.type) ? (loop.type === "ForOfStatement" ? "of " : "in ") + text(loop.right)
          : "(no initial value)");
      } else if (holder.isCatchClause()) origin = "catch";
      else if (binding.path.isFunctionDeclaration()) origin = "function";
      // What it is used for.
      const members = new Map(), sinks = new Map();
      let called = 0;
      for (const { node: reference, parent, parentPath } of binding.referencePaths) {
        if (/MemberExpression$/.test(parent.type) && parent.object === reference) {
          if (parent.computed) count(sinks, "[" + text(parent.property, 24) + "]");
          else count(members, parent.property.name ?? text(parent.property, 30));
        } else if (/MemberExpression$/.test(parent.type)) count(sinks, text(parent.object, 30) + "[·]");
        else if (/CallExpression$|^NewExpression$/.test(parent.type)) {
          if (parent.callee === reference) called++;
          else count(sinks, `${calleeName(parent.callee)}(#${parent.arguments.indexOf(reference)})`);
        } else if (parent.type === "ObjectProperty" && parent.value === reference && parentPath.parent.type === "ObjectExpression") count(sinks, `{${text(parent.key, 30)}:}`);
        else if (parent.type === "AssignmentExpression" && parent.right === reference) count(sinks, text(parent.left, 40) + " =");
        else if (parent.type === "BinaryExpression" && /^[!=]==?$/.test(parent.operator)) {
          const other = parent.left === reference ? parent.right : parent.left;
          if (/Literal$|MemberExpression$/.test(other.type)) count(sinks, parent.operator + " " + text(other, 30));
        } else if (parent.type === "ReturnStatement") count(sinks, "returned");
        else if (parent.type === "SwitchStatement") count(sinks, "switch");
        else if (parent.type === "ForOfStatement" && parent.right === reference) count(sinks, "iterated");
        else if (parent.type === "SpreadElement") count(sinks, "spread");
      }
      const uses = [
        members.size ? "." + top(members, 9).join(" .") : "",
        called ? "called" : "",
        top(sinks, 5).join("  "),
        binding.constantViolations.length && binding.kind !== "const" ? "reassigned" : "",
        binding.referencePaths.length ? "" : "unused",
      ].filter(Boolean).join(" | ");
      lines.push(`  ${key}  L${binding.identifier.loc.start.line}  ${inside ? "{" + inside + "} " : ""}${origin}${uses ? "  ::  " + uses : ""}`);
    }
  }
  return lines.join("\n");
}

/**
 * Rewrites `import { old as x } from "<chunk>"` specifiers, and those of
 * `export { old } from "<chunk>"`, which goes on giving out the name it gave
 * out before (`export { renamed as old } from`). `chunk` is the
 * chunk's file name (then "./name" and "/assets/name" match), or a function
 * that says whether an import source is the chunk. Returns the new code.
 */
export function renameImports(code, chunk, exportRenames) {
  const isChunk = typeof chunk === "function" ? chunk : (source) => source === "./" + chunk || source === "/assets/" + chunk;
  return code.replace(/((?:import|export)\s*\{)([^}]*)(\}\s*from\s*["']([^"']+)["'])/g, (all, head, body, tail, source) =>
    !isChunk(source) ? all :
    head +
    body.replace(/([A-Za-z_$][\w$]*)(\s+as\s+[A-Za-z_$][\w$]*)?(?=\s*,|\s*$)/g, (spec, imported, alias) =>
      !(imported in exportRenames) ? spec
        : (alias ?? ` as ${imported}`).endsWith(` ${exportRenames[imported]}`) ? exportRenames[imported]
        : exportRenames[imported] + (alias ?? ` as ${imported}`),
    ) +
    tail,
  );
}

/** The repository path an import source names, read in `file`: relative, or from the web root (client/). */
function importTarget(file, source) {
  const path = source.replace(/[?#].*$/, "");
  if (path.startsWith("/")) return "client" + posix.normalize(path);
  return path.startsWith(".") ? posix.normalize(posix.join(posix.dirname(file), path)) : undefined;
}

/**
 * Where the modules in `sources` ({ path: code }, paths from the repository
 * root) read one of `names`, exports of `chunk`, through the module object.
 * Returns { sites: Map of file -> [{ name, start, end, shorthand, quoted }] }
 * for the reads that can be renamed with the export, and { refusals: Map of
 * name -> [reason] } for the names that cannot be renamed safely ("*": none).
 */
export function moduleReads(sources, chunk, names) {
  names = new Set(names);
  const sites = new Map(), refusals = new Map();
  const refuse = (name, reason) => refusals.set(name, [...(refusals.get(name) ?? []), reason]);
  const tail = chunk.split("/").slice(-2).join("/"), base = chunk.split("/").pop();
  const inString = (name) => new RegExp(`(?<=\\.)${name.replace(/[$]/g, "\\$&")}(?![\\w$])`);
  for (const [file, code] of Object.entries(sources)) {
    if (file === chunk || !names.size || !(code.includes(base) || /\bimport\s*\(/.test(code))) continue;
    let ast;
    try {
      ast = parse(code, { sourceType: "module" });
    } catch {
      for (const name of names) if (inString(name).test(code)) refuse(name, `${file} does not parse and contains .${name}`);
      continue;
    }
    const found = [], mentions = [];
    let unclear; // why an access x.name in this file may be to the module object
    const escapes = (node, how) => void (unclear ??= `${how} on line ${node.loc.start.line}`);
    const key = (node) => (node.type === "Identifier" ? node.name : node.type === "StringLiteral" ? node.value : undefined);
    const readPattern = (pattern) => {
      for (const property of pattern.properties) {
        if (property.type !== "ObjectProperty" || property.computed) escapes(property, "takes the rest of the module object");
        else if (names.has(key(property.key))) {
          const local = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
          found.push({ name: key(property.key), start: property.key.start, end: property.key.end, shorthand: property.shorthand, quoted: property.key.type === "StringLiteral", local: local.name, localStart: local.start });
        }
      }
    };
    const bind = (scope, id) => {
      const binding = scope.getBinding(id.name);
      if (!binding || binding.constantViolations.length) return escapes(id, "reassigns the module object");
      for (const reference of binding.referencePaths) use(reference);
    };
    // `path` is an expression whose value is the module object.
    const use = (path) => {
      const { node, parent } = path;
      if (/MemberExpression$/.test(parent.type) && parent.object === node) {
        if (parent.computed) escapes(node, "reads the module object by a computed key");
        else if (names.has(parent.property.name)) found.push({ name: parent.property.name, start: parent.property.start, end: parent.property.end });
      } else if (parent.type === "VariableDeclarator" && parent.init === node) {
        if (parent.id.type === "Identifier") bind(path.scope, parent.id);
        else if (parent.id.type === "ObjectPattern") readPattern(parent.id);
        else escapes(node, "passes the module object on");
      } else escapes(node, "passes the module object on");
    };
    // 1 when the import() argument is the chunk, 0 when it cannot be, undefined when it may be.
    // The string an expression always is, where that can be read off: a
    // literal, a constant holding one, ["a", "b"].join("/") (how a bundle
    // hides a package path from its bundler).
    const constant = (path) => {
      const { node } = path;
      if (node.type === "StringLiteral") return node.value;
      if (node.type === "Identifier") {
        const binding = path.scope.getBinding(node.name);
        return binding?.constant && binding.path.isVariableDeclarator() && binding.path.node.init ? constant(binding.path.get("init")) : undefined;
      }
      const list = node.type === "CallExpression" && node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.name === "join" ? node.callee.object : undefined;
      if (list?.type === "ArrayExpression" && node.arguments[0]?.type === "StringLiteral" && list.elements.every((element) => element?.type === "StringLiteral")) return list.elements.map((element) => element.value).join(node.arguments[0].value);
    };
    const isChunk = (argumentPath) => {
      const argument = argumentPath?.node, known = argumentPath && constant(argumentPath);
      if (known !== undefined) return importTarget(file, known) === chunk ? 1 : 0;
      if (argument?.type !== "TemplateLiteral") return undefined;
      const [first, ...rest] = argument.quasis.map((quasi) => quasi.value.cooked ?? "");
      if (!rest.length || first.includes("?")) return importTarget(file, first) === chunk ? 1 : 0; // only a query varies
      const start = importTarget(file, first);
      return start !== undefined && !chunk.startsWith(start) ? 0 : chunk.endsWith(rest.at(-1).replace(/[?#].*$/, "")) ? undefined : 0;
    };
    const ofImport = new Set();
    traverse(ast, {
      ImportDeclaration(path) {
        if (importTarget(file, path.node.source.value) !== chunk) return;
        for (const specifier of path.node.specifiers) if (specifier.type === "ImportNamespaceSpecifier") bind(path.scope, specifier.local);
      },
      "ExportAllDeclaration|ExportNamedDeclaration"(path) {
        if (!path.node.source || importTarget(file, path.node.source.value) !== chunk) return;
        if (path.node.type === "ExportAllDeclaration" || path.node.specifiers.some((specifier) => specifier.type !== "ExportSpecifier"))
          refuse("*", `${file}:${path.node.loc.start.line} re-exports everything from this file`);
      },
      // import(): a call of `Import` or a node of its own, by the parser's version.
      "CallExpression|ImportExpression"(path) {
        if (path.node.type === "CallExpression" && path.node.callee.type !== "Import") return;
        const argumentPath = path.node.type === "CallExpression" ? path.get("arguments.0") : path.get("source");
        const argument = argumentPath?.node, is = isChunk(argument ? argumentPath : undefined);
        if (argument) ofImport.add(argument);
        for (const quasi of argument?.quasis ?? []) ofImport.add(quasi);
        if (is === undefined) return escapes(path.node, "imports a path it computes");
        if (!is) return;
        const { parentPath } = path;
        if (parentPath.isAwaitExpression()) return use(parentPath);
        const then = parentPath.isMemberExpression() && parentPath.node.object === path.node && !parentPath.node.computed && parentPath.node.property.name === "then" ? parentPath.parentPath : undefined;
        if (!then?.isCallExpression() || then.node.callee !== parentPath.node) return escapes(path.node, "passes the module's promise on");
        const handler = then.get("arguments.0");
        if (!handler?.isFunction()) return escapes(path.node, "passes the module object on");
        const parameter = handler.node.params[0];
        if (parameter?.type === "Identifier") bind(handler.scope, parameter);
        else if (parameter?.type === "ObjectPattern") readPattern(parameter);
        else if (parameter) escapes(path.node, "passes the module object on");
      },
      "StringLiteral|TemplateElement"(path) {
        const { node, parent } = path;
        if (/^(Import|Export\w+)Declaration$/.test(parent.type) || ofImport.has(node)) return;
        const text = node.type === "StringLiteral" ? node.value : node.value.raw;
        mentions.push({ text, line: node.loc.start.line });
        if (text.includes(tail) || (text.endsWith(base) && importTarget(file, text) === chunk)) escapes(node, "names this file in a string");
      },
    });
    if (found.length) sites.set(file, found);
    if (!unclear) continue;
    // Any other x.name here may be the module object's.
    const known = new Set(found.map((site) => site.start));
    traverse(ast, {
      "MemberExpression|OptionalMemberExpression"(path) {
        const { property, computed } = path.node;
        if (!computed && names.has(property.name) && !known.has(property.start)) refuse(property.name, `${file}:${property.loc.start.line} reads .${property.name}, and ${file} ${unclear}`);
      },
    });
    for (const name of names) for (const { text, line } of mentions) if (inString(name).test(text)) refuse(name, `${file}:${line} has .${name} inside a string, and ${file} ${unclear}`);
  }
  return { sites, refusals };
}

/** Applies the reads `moduleReads` found in one file. */
export function renameModuleReads(code, found, exportRenames) {
  for (const { name, start, end, shorthand, quoted, local, localStart } of [...found].sort((a, b) => b.start - a.start)) {
    if (!(name in exportRenames)) continue;
    const renamed = quoted ? JSON.stringify(exportRenames[name]) : exportRenames[name];
    // `{ old: renamed }` becomes `{ renamed }`, `{ old }` becomes `{ renamed: old }`.
    if (!shorthand && local === exportRenames[name]) code = code.slice(0, start) + code.slice(localStart);
    else code = code.slice(0, start) + (shorthand ? `${renamed}: ${name}` : renamed) + code.slice(end);
  }
  return code;
}

/**
 * Renames in `sources` ({ path: code }, all the modules that may use the
 * chunk). Returns { sources (changed files only), renamed, exportRenames,
 * refused: [reason] }; throws on a refusal unless skipRefused.
 */
export function renameInSources(sources, chunk, names, { adoptImports = false, skipRefused = false } = {}) {
  let result = renameBindings(sources[chunk], names, { adoptImports });
  const reads = moduleReads(sources, chunk, Object.keys(result.exportRenames));
  const refused = [];
  if (reads.refusals.size) {
    const keep = new Set(reads.refusals.has("*") ? Object.keys(result.exportRenames) : reads.refusals.keys());
    for (const name of keep) for (const reason of reads.refusals.get(name) ?? reads.refusals.get("*")) refused.push(`export ${name}: ${reason}`);
    if (!skipRefused) throw new Error("Cannot rename, an export is read through a module object that cannot be followed:\n  " + refused.join("\n  "));
    result = renameBindings(sources[chunk], names, { adoptImports, keepExports: keep });
  }
  const { exportRenames } = result, out = {};
  if (result.code !== sources[chunk]) out[chunk] = result.code;
  for (const [file, before] of Object.entries(sources)) {
    if (file === chunk || !Object.keys(exportRenames).length) continue;
    const after = renameImports(renameModuleReads(before, reads.sites.get(file) ?? [], exportRenames), (source) => importTarget(file, source) === chunk, exportRenames);
    if (after === before) continue;
    parse(after, { sourceType: "module" }); // must still parse
    out[file] = after;
  }
  return { sources: out, renamed: result.renamed, exportRenames, refused };
}

function selfTest() {
  const source = [
    "var a = 1, keep = 2;",
    "function b(a) { return a + keep; }", // parameter shadows: untouched
    "const o = { a, b: a, c: { a: 3 }.a };",
    "const { a: d = a } = o;",
    "for (const x of [a]) b(x);",
    "export { a as Z, b };",
  ].join("\n");
  const { code, exportRenames } = renameBindings(source, { a: "count", b: "addKeep" });
  const expected = [
    "var count = 1, keep = 2;",
    "function addKeep(a) { return a + keep; }",
    "const o = { a: count, b: count, c: { a: 3 }.a };",
    "const { a: d = count } = o;",
    "for (const x of [count]) addKeep(x);",
    "export { count, addKeep };",
  ].join("\n");
  if (code !== expected) throw new Error("self-test failed:\n" + code);
  if (JSON.stringify(exportRenames) !== '{"Z":"count","b":"addKeep"}') throw new Error("export renames: " + JSON.stringify(exportRenames));
  const importer = 'import { Z as q, b, other as r } from "./chunk.js";';
  const rewritten = renameImports(importer, "chunk.js", exportRenames);
  if (rewritten !== 'import { count as q, addKeep as b, other as r } from "./chunk.js";') throw new Error("import rewrite: " + rewritten);
  const adopted = renameBindings('import { longName as q, ab as r, keep as s } from "./m.js";\nvar keep = q + r + s;', null, { adoptImports: true }).code;
  if (adopted !== 'import { longName, ab as r, keep as s } from "./m.js";\nvar keep = longName + r + s;') throw new Error("adopt imports: " + adopted);
  const aliasOnly = renameBindings("var value = 1;\nexport { value as v };", {});
  if (aliasOnly.code !== "var value = 1;\nexport { value };" || aliasOnly.exportRenames.v !== "value") throw new Error("export alias: " + aliasOnly.code);
  for (const bad of [{ a: "keep" }, { nope: "x" }, { a: "same", b: "same" }]) {
    let threw = false;
    try { renameBindings(source, bad); } catch { threw = true; }
    if (!threw) throw new Error("expected a conflict for " + JSON.stringify(bad));
  }
  // An export that is its own declaration is an export rename too.
  const declared = renameBindings("export function a() {}\nexport const b = 1, keep = 2;\nfunction c() { let a; }", { a: "run", b: "count" });
  if (declared.code !== "export function run() {}\nexport const count = 1, keep = 2;\nfunction c() { let a; }" || JSON.stringify(declared.exportRenames) !== '{"a":"run","b":"count"}') throw new Error("declared exports: " + JSON.stringify(declared));
  // Exports read through the module object. Renamed where the object is in
  // plain sight: a namespace import, an awaited import() (also inside a
  // function a test hands to the page, by web path), .then, destructuring.
  const chunkSource = "var a = 1, b = 2, c = 3, value = 4;\nexport { a as Z, b, c, value as v };";
  const readers = {
    "client/assets/chunk.js": chunkSource,
    "client/assets/user.js": 'import * as chunk from "./chunk.js";\nimport { Z as q } from "/assets/chunk.js";\nexport { b, c as third } from "./chunk.js";\nconsole.log(chunk.Z, chunk?.b, other.Z, q);\nimport("./chunk.js").then((module) => module.b.Z);\nimport("./chunk.js").then(({ Z, b: second = 1, "c": third }) => Z + second + third);\nimport("./other.js").then((module) => module.Z);',
    "test/t.mjs": 'import { b } from "../client/assets/chunk.js";\nconst { Z, b: second, v = 0 } = await import("../client/assets/chunk.js");\nconst all = await import(`../client/assets/chunk.js?visit=${Z}`);\nawait page.evaluate(async () => (await import("/assets/chunk.js")).Z + all.b + thing.Z);\nconst { Z: unrelated } = await import("../client/assets/other.js");',
  };
  const followed = renameInSources(readers, "client/assets/chunk.js", { a: "count", b: "second" });
  const followedExpected = {
    "client/assets/chunk.js": "var count = 1, second = 2, c = 3, value = 4;\nexport { count, second, c, value };",
    "client/assets/user.js": 'import * as chunk from "./chunk.js";\nimport { count as q } from "/assets/chunk.js";\nexport { second as b, c as third } from "./chunk.js";\nconsole.log(chunk.count, chunk?.second, other.Z, q);\nimport("./chunk.js").then((module) => module.second.Z);\nimport("./chunk.js").then(({ count: Z, second = 1, "c": third }) => Z + second + third);\nimport("./other.js").then((module) => module.Z);',
    "test/t.mjs": 'import { second as b } from "../client/assets/chunk.js";\nconst { count: Z, second, value: v = 0 } = await import("../client/assets/chunk.js");\nconst all = await import(`../client/assets/chunk.js?visit=${Z}`);\nawait page.evaluate(async () => (await import("/assets/chunk.js")).count + all.second + thing.Z);\nconst { Z: unrelated } = await import("../client/assets/other.js");',
  };
  if (JSON.stringify(followed.sources) !== JSON.stringify(followedExpected) || followed.refused.length || JSON.stringify(followed.exportRenames) !== '{"Z":"count","b":"second","v":"value"}') throw new Error("module reads:\n" + JSON.stringify(followed, null, 1));
  // Refused where the module object goes out of sight: handed to a function,
  // imported by a computed path (the harness loads chunks by name), a file
  // that names the chunk in a string (a test patching the served source),
  // `export *`. Each refusal names the export and the line.
  const hidden = {
    passed: ["test/p.mjs", 'import * as chunk from "../client/assets/chunk.js";\ncheck(chunk);\nresult.Z;', /export Z: test\/p\.mjs:3 reads \.Z, and test\/p\.mjs passes the module object on on line 2/],
    computed: ["tools/h.mjs", "const load = (name) => import(root + name);\nconst chunk = await load('chunk');\nchunk.Z();", /export Z: tools\/h\.mjs:3 reads \.Z, and tools\/h\.mjs imports a path it computes on line 1/],
    string: ["test/s.mjs", 'await page.route("**/assets/chunk.js", patch);\nawait page.evaluate("window.chunk.Z()");', /export Z: test\/s\.mjs:2 has \.Z inside a string, and test\/s\.mjs names this file in a string on line 1/],
    star: ["client/assets/all.js", 'export * from "./chunk.js";', /export Z: client\/assets\/all\.js:1 re-exports everything/],
  };
  for (const [kind, [file, text, message]] of Object.entries(hidden)) {
    const sources = { "client/assets/chunk.js": chunkSource, [file]: text };
    let said = "";
    try { renameInSources(sources, "client/assets/chunk.js", { a: "count" }); } catch (error) { said = error.message; }
    if (!message.test(said)) throw new Error(`expected a refusal (${kind}), got: ${said}`);
    // --skip-refused: the refused export keeps its letters and its binding, the rest is renamed.
    const partial = renameInSources(sources, "client/assets/chunk.js", { a: "count", c: "third" }, { skipRefused: true });
    const all = kind === "star";
    const expectedChunk = all ? undefined : "var a = 1, b = 2, third = 3, value = 4;\nexport { a as Z, b, third, value };";
    if (partial.sources["client/assets/chunk.js"] !== expectedChunk || partial.renamed !== (all ? 0 : 1) || !partial.refused.some((reason) => message.test(reason)) || file in partial.sources) throw new Error(`skip refused (${kind}):\n` + JSON.stringify(partial, null, 1));
  }
  // Not refused: the same letters on other objects in a file that has
  // nothing to do with the chunk, or whose computed import cannot be it.
  const apart = renameInSources({ "client/assets/chunk.js": chunkSource, "client/x.js": "thing.Z(); const o = { Z: 1 }; 'a.Z';", "client/w.js": 'const path = ["@scope", "package", "chunk.js"].join("/");\nconst loaded = await load(() => import(path));\nloaded.Z;',"tools/y.mjs": "const list = await import(`./scenarios/${name}.mjs`); list.Z;" }, "client/assets/chunk.js", { a: "count" });
  if (apart.refused.length || Object.keys(apart.sources).join() !== "client/assets/chunk.js") throw new Error("unrelated accesses:\n" + JSON.stringify(apart, null, 1));
  const nested = [
    "var keep = 1;",
    "function f(a, { b, c: d = a }) { const e = [a, b].map((a) => a + d); return { e, b: e.b }; }",
    "class K { m(a) { for (const a of [1]) keep += a; return a; } get g() { let a = keep; return a; } }",
  ].join("\n");
  const locals = renameLocals(nested, {
    f: { "a#1": ["first", "inferred"], b: ["second", "inferred"], d: "third", e: "sums", "a#2": "item" },
    "K.m": { "a#1": "start", "a#2": "step" },
    "K.get g": { a: "kept" },
  });
  const expectedLocals = [
    "var keep = 1;",
    "function f(first, { b: second, c: third = first }) { const sums = [first, second].map((item) => item + third); return { e: sums, b: sums.b }; }",
    "class K { m(start) { for (const step of [1]) keep += step; return start; } get g() { let kept = keep; return kept; } }",
  ].join("\n");
  if (locals.code !== expectedLocals || locals.renamed !== 8 || locals.left !== 0) throw new Error(`locals (${locals.renamed} renamed, ${locals.left} left):\n` + locals.code);
  // Refused: a callback parameter taking the name of an outer local it uses,
  // two parameters sharing a name, a local taking a top-level name it uses,
  // unknown owners and keys, a name that is not an identifier.
  for (const bad of [{ f: { "a#2": "d" } }, { f: { "a#1": "b" } }, { "K.m": { "a#2": "keep" } }, { "K.get g": { a: "keep" } }, { f: { zz: "x" } }, { nope: { a: "x" } }, { f: { e: "not valid" } }]) {
    let threw = false;
    try { renameLocals(nested, bad); } catch { threw = true; }
    if (!threw) throw new Error("expected a refusal for " + JSON.stringify(bad));
  }
  const listed = listLocals(nested);
  for (const part of [
    "## f (statement on lines 2-2)", "  a#1  L2  param 0 of f\n", "  b  L2  {.b} param 1 of f\n", "  d  L2  {.c} param 1 of f\n",
    "  e  L2  const = [a, b].map((a) => a + d)  ::  .b | {e:}", "  a#2  L2  param 0 of callback #0 to [a, b].map",
    "## K.m (statement on lines 3-3)", "  a#2  L3  const of [1]", "## K.get g (statement",
  ]) if (!listed.includes(part)) throw new Error("list lacks " + JSON.stringify(part) + ":\n" + listed);
  console.log("rename-bindings self-test passed");
}

const [target, mapFile] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const adoptImports = process.argv.includes("--adopt-imports");
const dry = process.argv.includes("--dry");
const skipRefused = process.argv.includes("--skip-refused");
const fromRoot = (path) => relative(process.cwd(), resolve(path)).split(sep).join("/");
// Every module that may use a chunk: tracked or new, not ignored; not the
// rename tools, whose self-tests are made of other files' names.
const modules = () => execFileSync("git", ["ls-files", "-co", "--exclude-standard", "client", "test", "tools"], { encoding: "utf8", maxBuffer: 1 << 26 }).split(/\r?\n/).filter((file) => /\.m?js$/.test(file) && !/^tools\/rename-(bindings|members)\.mjs$/.test(file) && existsSync(file));
// A directory as target: the names file is keyed by module path relative to
// it ({ "boss.js": {...}, "../../assets/rendering.js": {...} }), applied in
// that order, and --adopt-imports takes every module in the directory.
const isDirectory = Boolean(target) && existsSync(target) && statSync(target).isDirectory();
const perFile = (names) => (isDirectory ? Object.entries(names).map(([file, entries]) => [join(target, file), entries]) : [[target, names]]);
const evidenceCount = (values) => {
  const notes = values.map((value) => (Array.isArray(value) ? value[1] ?? "inferred" : value?.evidence ?? "inferred"));
  const inferred = notes.filter((note) => note.startsWith("inferred")).length;
  return `${notes.length - inferred} with evidence, ${inferred} inferred`;
};
if (process.argv.includes("--self-test")) {
  selfTest();
} else if (target && process.argv.includes("--module-reads")) {
  // What a rename of each export would meet: reads that follow it, and refusals.
  const chunk = fromRoot(target);
  const sources = Object.fromEntries(modules().map((file) => [file, readFileSync(file, "utf8")]));
  const exported = parse(readFileSync(target, "utf8"), { sourceType: "module" }).program.body
    .filter((statement) => statement.type === "ExportNamedDeclaration" && !statement.source)
    .flatMap((statement) => [...statement.specifiers.map((specifier) => specifier.exported.name ?? specifier.exported.value), ...(statement.declaration?.id ? [statement.declaration.id.name] : []), ...(statement.declaration?.declarations ?? []).map((declarator) => declarator.id.name).filter(Boolean)]);
  const { sites, refusals } = moduleReads(sources, chunk, exported);
  for (const [file, found] of sites) console.log(`followed in ${file}: ${[...new Set(found.map((site) => site.name))].join(" ")}`);
  for (const [name, reasons] of refusals) for (const reason of reasons) console.log(`refused: export ${name}: ${reason}`);
  console.log(`${basename(target)}: ${exported.length} exports, ${new Set([...sites.values()].flat().map((site) => site.name)).size} read through a module object that is followed, ${refusals.has("*") ? exported.length : refusals.size} refused`);
} else if (target && process.argv.includes("--list")) {
  const [from, to] = process.argv.includes("--lines") ? process.argv[process.argv.indexOf("--lines") + 1].split("-").map(Number) : [];
  console.log(listLocals(readFileSync(target, "utf8"), { all: process.argv.includes("--all"), from, to }));
} else if (target && mapFile && process.argv.includes("--locals")) {
  for (const [path, names] of perFile(JSON.parse(readFileSync(mapFile, "utf8")))) {
    const { code, renamed, left } = renameLocals(readFileSync(path, "utf8"), names);
    if (!dry) writeFileSync(path, code);
    console.log(`${basename(path)}: ${renamed} parameters and locals renamed (${evidenceCount(Object.values(names).flatMap((entries) => Object.values(entries)))}), ${left} of one or two characters left`);
  }
} else if (target && (mapFile || adoptImports)) {
  const jobs = !adoptImports ? perFile(JSON.parse(readFileSync(mapFile, "utf8")))
    : isDirectory ? readdirSync(target).filter((name) => name.endsWith(".js")).map((name) => [join(target, name), {}])
    : [[target, {}]];
  for (const [path, raw] of jobs) {
    const names = Object.fromEntries(Object.entries(raw).map(([old, value]) => [old, typeof value === "string" ? value : Array.isArray(value) ? value[0] : value.name]));
    // Every module of the client, the tests and the tools may use this file:
    // by a relative path, or by a path from the web root ("/toa/zebak/native.js").
    // Read again for each job: an earlier one may have changed them.
    const chunk = fromRoot(path);
    const sources = Object.fromEntries(modules().map((file) => [file, readFileSync(file, "utf8")]));
    sources[chunk] ??= readFileSync(path, "utf8");
    let result;
    try {
      result = renameInSources(sources, chunk, names, { adoptImports, skipRefused });
    } catch (error) {
      console.error(error.message); // a refusal, not a fault of the tool: no stack
      process.exit(1);
    }
    const { sources: out, renamed, exportRenames, refused } = result;
    if (!dry) for (const [file, text] of Object.entries(out)) writeFileSync(file, text);
    for (const reason of refused) console.log("refused: " + reason);
    console.log(`${basename(path)}: ${renamed} bindings renamed${adoptImports ? "" : ` (${evidenceCount(Object.values(raw))})`}, ${Object.keys(exportRenames).length} export names changed`);
    for (const file of Object.keys(out)) if (file !== chunk) console.log(`  updated ${file}`);
  }
} else {
  console.error("usage: node tools/rename-bindings.mjs <chunk.js | directory> (<names.json> [--locals] [--skip-refused] | --adopt-imports | --module-reads | --list [--lines a-b] [--all]) [--dry] | --self-test");
  process.exit(1);
}
