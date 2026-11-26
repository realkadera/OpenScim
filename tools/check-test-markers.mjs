// Tests patch served source in the browser by matching an exact line
// (body.replace(marker, marker + probe)). A transform that changes such a line
// breaks the test. This fails when a string in test/*.mjs occurred in a client
// file at <ref> and no longer occurs in the working tree copy, unless it moved
// to another client file and every test that uses it names that file.
//
// Usage: node tools/check-test-markers.mjs [ref]
//        node tools/check-test-markers.mjs --self-test
//
// ref defaults to where the branch left origin/main (git merge-base), so the
// check covers the branch's commits and the working tree. With HEAD as the
// default, a run after committing compared HEAD with itself and checked nothing.
//
// ponytail: only finds markers that were lost. A marker a commit rewrites on
// purpose is checked by its own test (assert.ok(body.includes(marker))).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse } from "@babel/parser";

const MIN_LENGTH = 10;

function literals(source) {
  const found = new Set();
  (function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "StringLiteral") found.add(node.value);
    if (node.type === "TemplateElement") found.add(node.value.cooked ?? "");
    for (const key in node) if (key !== "loc") walk(node[key]);
  })(parse(source, { sourceType: "module" }).program);
  return [...found].filter((text) => text.length >= MIN_LENGTH);
}

if (process.argv[2] === "--self-test") {
  assert.deepEqual(
    literals('const a = "this.encounter = x;", b = `first part ${a} second part`, c = "short";'),
    ["this.encounter = x;", "first part ", " second part"],
  );
  console.log("self-test ok");
  process.exit(0);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
const forkPoint = () => {
  try {
    return git("merge-base", "HEAD", "origin/main").trim();
  } catch {
    return "HEAD"; // no origin/main (a fresh clone of a fork): the working tree only
  }
};
const ref = process.argv[2] ?? forkPoint();
const changed = git("diff", "--name-only", ref, "--", "client").split("\n").filter((path) => path.endsWith(".js"));
const tests = readdirSync("test").filter((name) => name.endsWith(".mjs"));
const markers = new Map();
for (const name of tests)
  for (const text of literals(readFileSync("test/" + name, "utf8")))
    markers.set(text, [...(markers.get(text) ?? []), name]);

// A line that left its file may have moved to another one (a split): fine,
// as long as every test that matches it names the file it is in now.
const current = git("ls-files", "-co", "--exclude-standard", "client").split("\n").filter((path) => path.endsWith(".js") && existsSync(path));
const now = new Map(current.map((path) => [path, readFileSync(path, "utf8")]));
let lost = 0, moved = 0;
const unnamed = [];
for (const path of changed) {
  let before;
  try {
    before = git("show", ref + ":" + path);
  } catch {
    continue; // the file did not exist at <ref>: it can have lost nothing
  }
  const after = now.get(path) ?? "";
  for (const [text, names] of markers) {
    if (!before.includes(text) || after.includes(text)) continue;
    const home = current.find((other) => now.get(other).includes(text));
    if (!home) {
      lost++;
      console.log(`LOST in ${path}: ${JSON.stringify(text)}\n  used by ${names.join(", ")}`);
    } else if (names.every((name) => readFileSync("test/" + name, "utf8").includes(home.split("/").pop()))) {
      moved++;
      console.log(`moved from ${path} to ${home}: ${JSON.stringify(text)} (${names.length} tests name the new file)`);
    } else unnamed.push(`${JSON.stringify(text)} in ${home.split("/").pop()}`);
  }
}
// Most of these are words a test happens to share with the code, not lines it matches.
if (unnamed.length) console.log(`in another file now, which the tests using them do not name: ${unnamed.join(", ")}`);
console.log(`${markers.size} strings from ${tests.length} tests, ${changed.length} client files changed since ${ref}, ${moved} moved, ${lost} lost`);
process.exit(lost ? 1 : 0);
