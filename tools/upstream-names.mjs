// Proposes names for a chunk's minified methods and classes from Scim.GG's
// released TypeScript source (github.com/scimgg/scimgg), and writes names
// files for tools/rename-members.mjs and tools/rename-bindings.mjs.
//
//   node tools/upstream-names.mjs <chunk.js> <upstream checkout> <methods.tsv> <classes.tsv> <out dir>
//   node tools/upstream-names.mjs --self-test
//
// methods.tsv / classes.tsv are the positional maps in docs/upstream/
// (renderer-cache-*.tsv): methods aligned between methods of the same name,
// by arity. A positional pair is a candidate, not a fact. A method pair is
// kept when the two bodies touch the same things: property names, strings and
// numbers other than the small ones (ours with minified member names
// translated through the candidates first). Overrides along an inheritance
// chain are proposed as one family (alsoIn), base included, because
// rename-members refuses them apart. A class takes its upstream name when its
// own methods confirm the pair (three, or a third for small classes, either
// kept above or already named the same) and no other class of ours claims it.
//
// Writes <out>/members.json, <out>/classes.json and <out>/report.tsv. Apply
// with rename-members.mjs (--skip-refused lists what it still refuses: export
// names, library members, strings) and rename-bindings.mjs, then run the
// checks of AGENTS.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default ?? traverseModule;
const isMinified = (name) => /^[A-Za-z_$][\w$]{0,2}$/.test(name) && name !== "constructor";
const DULL_NUMBERS = new Set([0, 1, 2, 3, 4, -1, 0.5]);
const keyName = (key) => (key.type === "Identifier" ? key.name : key.type === "StringLiteral" ? key.value : key.type === "PrivateName" ? key.id.name : undefined);
const tsvRows = (text) => text.split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => line.split("\t"));

/** className -> { superName, methods: Map(name -> [method nodes]) } */
function classesOf(code, typescript) {
  const plugins = typescript ? ["typescript", "jsx", "decorators-legacy"] : [];
  const classes = new Map();
  traverse(parse(code, { sourceType: "module", plugins, errorRecovery: true }), {
    Class(path) {
      const name = path.parent.type === "VariableDeclarator" ? path.parent.id.name : path.node.id?.name;
      if (!name) return;
      const methods = new Map();
      for (const member of path.node.body.body) {
        if (!/^(ClassMethod|ClassPrivateMethod)$/.test(member.type) || !member.body) continue;
        const methodName = keyName(member.key);
        if (methodName !== undefined) methods.set(methodName, [...(methods.get(methodName) ?? []), member]);
      }
      classes.set(name, { superName: path.node.superClass?.type === "Identifier" ? path.node.superClass.name : null, methods });
    },
  });
  return classes;
}

/** What a body touches: property names, strings, numbers. */
function fingerprint(method, translate) {
  const found = new Set();
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    if ((node.type === "MemberExpression" || node.type === "OptionalMemberExpression") && !node.computed) {
      if (node.property.type === "Identifier") found.add("p:" + translate(node.property.name));
      else if (node.property.type === "PrivateName") found.add("p:" + node.property.id.name);
    } else if (node.type === "StringLiteral" && node.value.length >= 2) found.add("s:" + node.value);
    else if (node.type === "TemplateElement" && node.value.raw.trim().length >= 2) found.add("s:" + node.value.raw.trim());
    else if (node.type === "NumericLiteral" && !DULL_NUMBERS.has(node.value)) found.add("n:" + node.value);
    for (const key of Object.keys(node)) {
      if (/^(loc|start|end|typeAnnotation|returnType|typeParameters)$/.test(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value.type === "string") visit(value);
    }
  };
  visit(method.body);
  return found;
}

/** A pair's verdict from the two fingerprints and whether the arities agree. */
export function judge(ours, theirs, { arityAgrees, positional }) {
  const shared = [...ours].filter((item) => theirs.has(item)).length;
  const smaller = Math.min(ours.size, theirs.size);
  const overlap = smaller ? shared / smaller : 0;
  const jaccard = shared ? shared / new Set([...ours, ...theirs]).size : 0;
  if (smaller >= 3 && overlap >= 0.6 && jaccard >= 0.35) return { keep: true, shared };
  // A short body: everything it touches must agree, and the pair must sit in the same slot with the same arity.
  if (smaller >= 1 && smaller <= 2 && shared === smaller && jaccard >= 0.5 && arityAgrees && positional) return { keep: true, shared };
  return { keep: false, shared };
}

export function proposeNames({ chunkCode, upstreamRead, methodRows, classRows, upstreamRef = "scimgg" }) {
  const ours = classesOf(chunkCode, false);
  const upstreamClasses = new Map();
  const upstreamClass = (fileAndClass) => {
    const [file, name] = fileAndClass.split("#");
    if (!upstreamClasses.has(file)) upstreamClasses.set(file, classesOf(upstreamRead(file), true));
    return upstreamClasses.get(file).get(name);
  };
  const candidates = methodRows
    .filter((row) => row[2] && row[3] && row[4] && row[4] !== "-")
    .map(([, ourClass, ourSig, upSig, upFileClass, how]) => ({ ourClass, ourName: ourSig.split("/")[0], ourArity: ourSig.split("/")[1]?.split("@")[0], upName: upSig.split("/")[0], upArity: upSig.split("/")[1]?.split("@")[0], upFileClass, how: how.split(" ")[0] }))
    .filter((c) => isMinified(c.ourName) && c.ourName !== c.upName);
  // Our minified names inside a body are translated through the candidates; a name two candidates disagree on is not.
  const translation = new Map();
  for (const c of candidates) translation.set(c.ourName, translation.has(c.ourName) && translation.get(c.ourName) !== c.upName ? null : c.upName);
  const translate = (name) => (isMinified(name) && translation.get(name)) || name;

  const report = [], kept = [];
  for (const c of candidates) {
    const mine = ours.get(c.ourClass)?.methods.get(c.ourName);
    const theirs = upstreamClass(c.upFileClass)?.methods.get(c.upName);
    if (!mine || !theirs) { report.push([c.ourClass, c.ourName, c.upName, c.upFileClass, c.how, "missing"]); continue; }
    if (mine.length !== 1 || theirs.length !== 1) { report.push([c.ourClass, c.ourName, c.upName, c.upFileClass, c.how, "overloaded"]); continue; }
    const verdict = judge(fingerprint(mine[0], translate), fingerprint(theirs[0], (name) => name), { arityAgrees: c.ourArity === c.upArity, positional: c.how === "pos+arity" });
    report.push([c.ourClass, c.ourName, c.upName, c.upFileClass, c.how, verdict.keep ? "kept" : "weak", verdict.shared]);
    if (verdict.keep) kept.push({ ...c, shared: verdict.shared });
  }

  // Families: every class of ours up or down the chain that defines the name.
  const ancestorsOf = (name) => { const chain = []; for (let up = ours.get(name)?.superName; up && ours.has(up) && !chain.includes(up); up = ours.get(up).superName) chain.push(up); return chain; };
  const related = (a, b) => a === b || ancestorsOf(a).includes(b) || ancestorsOf(b).includes(a);
  const members = {};
  const placed = new Set();
  for (const c of kept) {
    if (placed.has(`${c.ourClass}.${c.ourName}`)) continue;
    const group = new Set([c.ourClass]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const [name, info] of ours) if (!group.has(name) && info.methods.has(c.ourName) && [...group].some((member) => related(member, name))) { group.add(name); grew = true; }
    }
    const votes = kept.filter((other) => other.ourName === c.ourName && group.has(other.ourClass));
    for (const other of votes) placed.add(`${other.ourClass}.${other.ourName}`);
    if (new Set(votes.map((other) => other.upName)).size !== 1) { report.push([c.ourClass, c.ourName, c.upName, "", "", `family disagrees: ${[...group].join(",")}`]); continue; }
    const root = [...group].find((name) => !ancestorsOf(name).some((up) => group.has(up)));
    const evidence = `upstream ${upstreamRef} ${c.upFileClass}.${c.upName} (${c.how}; bodies share ${c.shared})`;
    const alsoIn = [...group].filter((name) => name !== root);
    (members[root] ??= {})[c.ourName] = alsoIn.length ? [c.upName, `${evidence}; one family with ${alsoIn.join(", ")}`, { alsoIn }] : [c.upName, evidence];
  }

  // Classes confirmed by their own methods.
  const confirmed = new Map();
  for (const c of kept) confirmed.set(c.ourClass, (confirmed.get(c.ourClass) ?? 0) + 1);
  for (const row of methodRows) if (row[5]?.startsWith("same-name") && !row[2].startsWith("constructor")) confirmed.set(row[1], (confirmed.get(row[1]) ?? 0) + 1);
  const classes = {}, claimed = new Map();
  for (const [ourClass, , , methodCount, upFileClass] of classRows) {
    if (!upFileClass || upFileClass === "-" || !isMinified(ourClass)) continue;
    const upName = upFileClass.split("#")[1];
    const count = +(methodCount ?? "m=0").slice(2);
    const enough = (confirmed.get(ourClass) ?? 0) >= Math.min(3, Math.max(1, Math.ceil(count / 3)));
    if (!enough || upName === ourClass) continue;
    if (claimed.has(upName)) { delete classes[claimed.get(upName)]; report.push([ourClass, "", upName, upFileClass, "", `class claimed twice (${claimed.get(upName)})`]); continue; }
    claimed.set(upName, ourClass);
    classes[ourClass] = { name: upName, evidence: `upstream ${upstreamRef} ${upFileClass}; ${confirmed.get(ourClass)} of ${count} methods confirm it` };
  }
  return { members, classes, report };
}

function selfTest() {
  const chunkCode = [
    "var Bk = class { aa() { return this.width * 640 + this.zz(); } zz() { return this.height; } hk() {} run() { this.hk(); } };",
    "var Sb = class extends Bk { hk() { return this.width + 'flare'; } };",
    "var Lo = class { qq(x) { return x.cycle + 917; } };",
  ].join("\n");
  const upstream = {
    "src/Base.ts": "export class Base { area(): number { return this.width * 640 + this.innerHeight(); } innerHeight() { return this.height; } renderEffects(): void {} run() { this.renderEffects(); } }\nexport class Sub extends Base { renderEffects() { return this.width + 'flare'; } }",
    "src/Loop.ts": "export class Loop { advance(x) { return x.cycle + 917; } other() { return 'nothing alike'; } }",
  };
  const methodRows = [
    ["chunk", "Bk", "aa/0@1", "area/0@1", "src/Base.ts#Base", "pos+arity"],
    ["chunk", "Bk", "zz/0@1", "innerHeight/0@1", "src/Base.ts#Base", "pos+arity"],
    ["chunk", "Sb", "hk/0@2", "renderEffects/0@2", "src/Base.ts#Sub", "pos+arity"],
    ["chunk", "Lo", "qq/1@3", "other/0@3", "src/Loop.ts#Loop", "pos"],
  ];
  const classRows = [["Bk", "1-1", "", "m=4", "src/Base.ts#Base"], ["Sb", "2-2", "Bk", "m=1", "src/Base.ts#Sub"], ["Lo", "3-3", "", "m=1", "src/Loop.ts#Loop"]];
  const { members, classes } = proposeNames({ chunkCode, upstreamRead: (file) => upstream[file], methodRows, classRows, upstreamRef: "test" });
  const expectNames = (actual, expected, what) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what}:\n${JSON.stringify(actual, null, 1)}`); };
  // aa and zz agree by body; Sb's hk is proposed for the whole chain from Bk; qq's partner touches nothing alike.
  expectNames(Object.keys(members).sort(), ["Bk"], "member owners");
  expectNames(Object.fromEntries(Object.entries(members.Bk).map(([old, [nu, , scope]]) => [old, [nu, scope?.alsoIn ?? []]])), { aa: ["area", []], zz: ["innerHeight", []], hk: ["renderEffects", ["Sb"]] }, "members");
  // Bk has 4 methods and 2 confirmed (a third, rounded up), Sb 1 of 1; Lo's only pair is weak.
  expectNames(Object.fromEntries(Object.entries(classes).map(([old, { name }]) => [old, name])), { Bk: "Base", Sb: "Sub" }, "classes");
  console.log("upstream-names self-test passed");
}

const args = process.argv.slice(2);
if (args[0] === "--self-test") selfTest();
else if (args.length === 5) {
  const [chunk, upstreamRoot, methodsTsv, classesTsv, outDir] = args;
  const { members, classes, report } = proposeNames({
    chunkCode: readFileSync(chunk, "utf8"),
    upstreamRead: (file) => readFileSync(join(upstreamRoot, file), "utf8"),
    methodRows: tsvRows(readFileSync(methodsTsv, "utf8")).filter((row) => chunk.replace(/\\/g, "/").endsWith(row[0])),
    classRows: tsvRows(readFileSync(classesTsv, "utf8")),
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "members.json"), JSON.stringify(members, null, 2) + "\n");
  writeFileSync(join(outDir, "classes.json"), JSON.stringify(classes, null, 2) + "\n");
  writeFileSync(join(outDir, "report.tsv"), report.map((row) => row.join("\t")).join("\n") + "\n");
  const count = Object.values(members).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
  console.log(`${count} methods (${Object.values(members).flatMap(Object.values).filter((entry) => entry[2]).length} as families) and ${Object.keys(classes).length} classes proposed; report.tsv lists the rest`);
} else {
  console.error("usage: node tools/upstream-names.mjs <chunk.js> <upstream checkout> <methods.tsv> <classes.tsv> <out dir> | --self-test");
  process.exit(1);
}
