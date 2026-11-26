// Proposes names for a chunk's minified top-level bindings (components,
// hooks, constants, classes) from Scim.GG's released TypeScript source
// (github.com/scimgg/scimgg), and writes a names file for
// tools/rename-bindings.mjs.
//
//   node tools/upstream-bindings.mjs <chunk.js> <upstream checkout> <out dir> [--ref scimgg@f1cab1f]
//   node tools/upstream-bindings.mjs --self-test
//
// A bundle keeps what a declaration is made of: its strings (class names,
// log tags, storage keys, labels), the property names it reads and writes,
// its numbers. Each top-level declaration of the chunk and of upstream's
// src/ is reduced to that set, and a pair is proposed only when all hold:
//
// - they are each other's best match, weighing a thing by how few upstream
//   declarations have it (a string found in one declaration says more than
//   `length`);
// - the best match is well ahead of the second best, both ways;
// - most of what upstream's declaration is made of is in ours, and most of
//   ours that upstream knows at all is in theirs (ours may have grown: our
//   own features stay);
// - both are a function, both a class, or both a value;
// - the name is free in the chunk and no second declaration is given it
//   (upstream's modules each have their own STORAGE_KEY; a chunk has one
//   scope, so those wait for the split into modules).
//
// Writes <out>/bindings.json ({ old: { name, evidence } }) and
// <out>/report.tsv (every minified binding with its best match and why it
// was or was not proposed). Apply with rename-bindings.mjs, then run the
// checks of AGENTS.md.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default ?? traverseModule;
const isMinified = (name) => /^[A-Za-z_$][\w$]{0,2}$/.test(name);
const DULL_NUMBERS = new Set([0, 1, 2, 3, 4, -1, 0.5, 10, 100]);
const COMMON = 12; // a thing more upstream declarations than this have says nothing
const tidy = (text) => text.replace(/\s+/g, " ").trim();

/** What a declaration is made of: Set of "s:string", "p:property", "n:number". */
function fingerprint(root) {
  const found = new Set();
  const string = (text) => {
    const value = tidy(text ?? "");
    if (value.length >= 3) found.add("s:" + value);
  };
  const property = (name) => {
    if (name.length >= 4) found.add("p:" + name);
  };
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    // Types are not in a bundle; a cast is the expression it wraps.
    if (/^TS(As|NonNull|Satisfies|TypeAssertion|Instantiation)/.test(node.type)) return visit(node.expression);
    if (/^TS|^Type|Interface/.test(node.type)) return;
    if (/MemberExpression$/.test(node.type) && !node.computed && node.property.type === "Identifier") property(node.property.name);
    else if (/^(Object|Class)(Property|Method)$/.test(node.type) && !node.computed) {
      if (node.key.type === "Identifier") property(node.key.name);
      else if (node.key.type === "StringLiteral") property(node.key.value);
    } else if (node.type === "StringLiteral") string(node.value);
    else if (node.type === "TemplateElement") string(node.value.cooked);
    else if (node.type === "NumericLiteral" && !DULL_NUMBERS.has(node.value)) found.add("n:" + node.value);
    // JSX, which a bundle holds as calls: jsx("div", { className: "x", children: "text" }).
    else if (node.type === "JSXText") string(node.value);
    else if (node.type === "JSXAttribute" && node.name.type === "JSXIdentifier") property(node.name.name);
    else if (node.type === "JSXOpeningElement" && node.name.type === "JSXIdentifier" && /^[a-z]/.test(node.name.name)) string(node.name.name);
    for (const key in node) {
      if (key === "loc" || key === "typeAnnotation" || key === "returnType" || key === "typeParameters" || key === "leadingComments" || key === "trailingComments" || key === "innerComments") continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  visit(root);
  return found;
}

/** function, class or value; a call around a function (memo, forwardRef) is that function. */
function kindOf(node) {
  if (!node) return "value";
  if (/Function/.test(node.type)) return "function";
  if (/^Class/.test(node.type)) return "class";
  if (/^TS(As|NonNull|Satisfies)/.test(node.type)) return kindOf(node.expression);
  if (node.type === "CallExpression" && node.arguments.some((argument) => /Function/.test(argument.type) || (argument.type === "CallExpression" && kindOf(argument) === "function"))) return "function";
  return "value";
}

/** Top-level declarations of one module: [{ name, kind, things, line }]. */
export function declarationsOf(code, { typescript = false } = {}) {
  const ast = parse(code, { sourceType: "module", plugins: typescript ? ["typescript", "jsx", "decorators-legacy"] : [], errorRecovery: true });
  const out = [];
  for (const statement of ast.program.body) {
    const declaration = /^Export(Named|Default)Declaration$/.test(statement.type) ? statement.declaration : statement;
    if (!declaration) continue;
    if (/^(Function|Class)Declaration$/.test(declaration.type) && declaration.id) out.push({ name: declaration.id.name, kind: kindOf(declaration), things: fingerprint(declaration), line: declaration.loc.start.line });
    else if (declaration.type === "TSEnumDeclaration") out.push({ name: declaration.id.name, kind: "value", things: fingerprint({ type: "ObjectExpression", properties: (declaration.members ?? declaration.body.members).map((member) => ({ type: "ObjectProperty", key: member.id, value: member.initializer })) }), line: declaration.loc.start.line });
    else if (declaration.type === "VariableDeclaration")
      for (const declarator of declaration.declarations) if (declarator.id.type === "Identifier" && declarator.init) out.push({ name: declarator.id.name, kind: kindOf(declarator.init), things: fingerprint(declarator.init), line: declarator.loc.start.line });
  }
  return out;
}

/**
 * ours: declarations of the chunk. theirs: [{ file, name, kind, things }].
 * taken: names that exist in the chunk. Returns { names, rows }.
 */
export function proposeBindings(ours, theirs, { taken = new Set(), ref = "scimgg" } = {}) {
  const frequency = new Map(), holders = new Map();
  theirs.forEach((declaration, index) => {
    for (const thing of declaration.things) {
      frequency.set(thing, (frequency.get(thing) ?? 0) + 1);
      (holders.get(thing) ?? holders.set(thing, []).get(thing)).push(index);
    }
  });
  const weight = (thing) => {
    const count = frequency.get(thing) ?? 0;
    return count === 0 || count > COMMON ? 0 : 1 / count;
  };
  const total = (things) => [...things].reduce((sum, thing) => sum + weight(thing), 0);
  // Score of every pair that shares something telling.
  const scores = ours.map((declaration) => {
    const row = new Map();
    for (const thing of declaration.things) {
      const each = weight(thing);
      if (each) for (const index of holders.get(thing)) row.set(index, (row.get(index) ?? 0) + each);
    }
    return [...row].sort((a, b) => b[1] - a[1]);
  });
  const bestOfTheirs = new Map(); // their index -> [[our index, score], best two]
  scores.forEach((row, index) => {
    for (const [their, score] of row) {
      const list = bestOfTheirs.get(their) ?? bestOfTheirs.set(their, []).get(their);
      list.push([index, score]);
      list.sort((a, b) => b[1] - a[1]).splice(2);
    }
  });
  const rows = [], proposed = [];
  ours.forEach((declaration, index) => {
    if (!isMinified(declaration.name)) return;
    const [[their, score] = [], [, second = 0] = []] = scores[index];
    const row = { ours: declaration.name, line: declaration.line, kind: declaration.kind, name: "", file: "", score: 0, verdict: "" };
    rows.push(row);
    if (their === undefined) return void (row.verdict = "nothing upstream shares anything telling with it");
    const match = theirs[their];
    const known = total(declaration.things), whole = total(match.things);
    const [rivalOurs, rivalScore] = (bestOfTheirs.get(their) ?? []).find(([other]) => other !== index) ?? [undefined, 0];
    Object.assign(row, { name: match.name, file: match.file, score: +score.toFixed(2), ofTheirs: +(score / whole).toFixed(2), ofOurs: +(score / known).toFixed(2) });
    const small = score < 2;
    row.verdict =
      match.kind !== declaration.kind ? `a ${declaration.kind} here, a ${match.kind} upstream`
      : bestOfTheirs.get(their)[0][0] !== index ? `upstream's ${match.name} is closer to ${ours[bestOfTheirs.get(their)[0][0]].name}`
      : score < 1 ? "shares nothing that only one upstream declaration has"
      : score < second * 1.5 ? `not well ahead of the next upstream match (${theirs[scores[index][1][0]].name})`
      : score < rivalScore * 1.5 ? `not well ahead of ${ours[rivalOurs].name} for the same upstream declaration`
      : score / whole < (small ? 0.9 : 0.6) ? "too little of upstream's declaration is here"
      : score / known < (small ? 0.9 : 0.5) ? "too little of this declaration is upstream's"
      : "";
    if (!row.verdict) proposed.push(row);
  });
  const uses = new Map();
  for (const row of proposed) uses.set(row.name, (uses.get(row.name) ?? 0) + 1);
  const names = {};
  for (const row of proposed) {
    if (taken.has(row.name)) row.verdict = "the name already exists in the chunk";
    else if (uses.get(row.name) > 1) row.verdict = `${uses.get(row.name)} declarations here would take this name (one scope; wait for the split)`;
    else {
      row.verdict = "proposed";
      names[row.ours] = { name: row.name, evidence: `upstream ${ref} ${row.file}#${row.name}; shared strings, properties and numbers weigh ${row.score}: ${Math.round(row.ofTheirs * 100)}% of upstream's, ${Math.round(row.ofOurs * 100)}% of ours` };
    }
  }
  return { names, rows };
}

function selfTest() {
  const chunk = [
    'const ab = "osrs-tile-markers";',
    'function cd(e) { const t = useThing(e.columns); return jsx("div", { className: "tile-grid", onClick: t.select, children: "Pick a tile" }); }',
    'var ef = memo(function (e) { return jsx("span", { className: "tile-chip", title: e.label }); });',
    'function gh(e) { return e.length + 12345; }',
    'function ij(e) { return e.padding + 777; }',
    'function kl(e) { return e.padding + 777; }',
    'class mn { reset() { this.history = []; console.warn("[TileStore] reset"); } }',
    'const op = "osrs-other-key";',
    'const tileGridColumns = 31;',
  ].join("\n");
  const upstream = {
    "src/hooks/tileMarkerState.ts": 'export const STORAGE_KEY: string = "osrs-tile-markers";\nexport class TileStore { private history: number[] = []; reset(): void { this.history = []; console.warn("[TileStore] reset"); } }',
    "src/hooks/other.ts": 'const STORAGE_KEY = "osrs-other-key";',
    "src/components/TileGrid.tsx": 'export function TileGrid(props: Props) { const state = useThing(props.columns); return <div className="tile-grid" onClick={state.select}>Pick a tile</div>; }\nexport const TileChip = memo(function TileChip(props: { label: string }) { return <span className="tile-chip" title={props.label} />; });\nconst pad = (box: Box) => box.padding + 777;\nexport const TileGridView = "tile-grid";',
    "src/util/size.ts": "export function sizeOf(list: unknown[]): number { return (list as unknown[]).length + 99999; }",
  };
  const theirs = Object.entries(upstream).flatMap(([file, code]) => declarationsOf(code, { typescript: true }).map((declaration) => ({ ...declaration, file })));
  const { names, rows } = proposeBindings(declarationsOf(chunk), theirs, { taken: new Set(["tileGridColumns"]), ref: "scimgg@test" });
  const got = Object.fromEntries(Object.entries(names).map(([old, { name }]) => [old, name]));
  // Proposed: the component, the memo'd component, the class. Not: the two
  // constants that would both be STORAGE_KEY, a function that only shares
  // `length` with one, two functions that are the same upstream helper.
  if (JSON.stringify(got) !== '{"cd":"TileGrid","ef":"TileChip","mn":"TileStore"}') throw new Error("self-test: " + JSON.stringify(got) + "\n" + rows.map((row) => `${row.ours} ${row.name} ${row.verdict}`).join("\n"));
  const verdict = (name) => rows.find((row) => row.ours === name).verdict;
  for (const [name, part] of [["ab", "would take this name"], ["op", "would take this name"], ["gh", "too little of upstream's"], ["ij", "not well ahead of kl"], ["kl", "closer to ij"]]) if (!verdict(name).includes(part)) throw new Error(`self-test: ${name}: ${verdict(name)}`);
  if (!names.cd.evidence.startsWith("upstream scimgg@test src/components/TileGrid.tsx#TileGrid; ")) throw new Error("self-test evidence: " + names.cd.evidence);
  if (rows.some((row) => row.ours === "tileGridColumns")) throw new Error("self-test: a named binding was considered");
  console.log("upstream-bindings self-test passed");
}

const args = process.argv.slice(2);
const [chunk, upstream, outDir] = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--ref");
if (args.includes("--self-test")) selfTest();
else if (chunk && upstream && outDir) {
  const ref = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : "scimgg";
  const theirs = [];
  for (const file of readdirSync(join(upstream, "src"), { recursive: true })) {
    const path = file.split("\\").join("/");
    if (!/\.tsx?$/.test(path) || /\.d\.ts$|\.test\.|__tests__|(^|\/)harness\//.test(path)) continue;
    for (const declaration of declarationsOf(readFileSync(join(upstream, "src", file), "utf8"), { typescript: true })) theirs.push({ ...declaration, file: "src/" + path });
  }
  const code = readFileSync(chunk, "utf8");
  const taken = new Set();
  traverse(parse(code, { sourceType: "module" }), {
    Program(path) {
      for (const name of Object.keys(path.scope.globals)) taken.add(name);
    },
    Scope(path) {
      for (const name of Object.keys(path.scope.bindings)) taken.add(name);
    },
  });
  const { names, rows } = proposeBindings(declarationsOf(code), theirs, { taken, ref });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "bindings.json"), JSON.stringify(names, null, 2) + "\n");
  writeFileSync(join(outDir, "report.tsv"), ["ours\tline\tkind\tupstream\tfile\tscore\tof theirs\tof ours\tverdict", ...rows.map((row) => [row.ours, row.line, row.kind, row.name, row.file, row.score, row.ofTheirs ?? "", row.ofOurs ?? "", row.verdict].join("\t"))].join("\n") + "\n");
  console.log(`${chunk.split(/[\\/]/).pop()}: ${rows.length} minified top-level bindings, ${Object.keys(names).length} proposed from ${theirs.length} upstream declarations`);
} else {
  console.error("usage: node tools/upstream-bindings.mjs <chunk.js> <upstream checkout> <out dir> [--ref scimgg@f1cab1f] | --self-test");
  process.exit(1);
}
