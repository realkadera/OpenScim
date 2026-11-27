// Serves the client, runs the tests several at a time, stops the servers.
// Usage: npm test                                  (everything)
//        npm test -- test/test-zebak-tide.mjs      (the files named)
//        npm test -- "test/test-zebak*.mjs"        (or matched)
//        npm test -- --changed                     (what the branch's changes can break: see below)
//        npm test -- --jobs 4                     (at most 4 at a time; default: half the processors)
//
// A test is a file test/test-*.mjs, run as `node <file>`: it passes when it
// exits with 0. It finds the server at process.env.TEST_ORIGIN.
//
// Any number of runs may go at once, one per worktree: each has its own server
// on its own port. The browser tests draw in software, a processor each or
// more, so all the runs on this machine share one pool of slots (a directory
// of lock files in the temp directory) and together run no more tests at a
// time than it has. Too many at once and the tests that wait on the app's own
// clock time out.
import { execFileSync, fork, spawn } from "node:child_process";
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const jobsAt = args.indexOf("--jobs");
const SLOTS = Math.max(1, Number(process.env.OPENSCIM_TEST_SLOTS) || Math.floor(availableParallelism() / 2));
const jobs = Math.min(SLOTS, jobsAt < 0 ? SLOTS : Math.max(1, Number(args.splice(jobsAt, 2)[1]) || 1));
const changedAt = args.indexOf("--changed");
if (changedAt >= 0) args.splice(changedAt, 1);
let files = [...new Set((args.length ? args : ["test/test-*.mjs"]).flatMap((pattern) => globSync(pattern)))].map((file) => file.replaceAll("\\", "/"));

// --changed: while a branch has changed nothing but fights' own files (what a fight's pull request may edit,
// AGENTS.md), the browser tests of the other fights have nothing new to see, and they are most of the run. Left are
// every test without a browser (the determinism harness among them, which plays every fight), the browser tests named
// after the fights changed, and the tests changed themselves. Anything else changed, and everything runs.
// ponytail: a fight is matched to its browser tests by name (test-<fight>*.mjs); one that another fight imports is
// covered by that fight's digests only. The whole run before a pull request is what catches the rest.
if (changedAt >= 0) {
  const git = (...words) => execFileSync("git", words, { encoding: "utf8" }).split("\n").filter(Boolean);
  const notFights = new Set(["shared", "lobby", "sandbox", "common", "engine", "fixture"]);
  const fights = new Set();
  const tests = new Set();
  let other;
  try {
    const [base] = git("merge-base", "HEAD", "origin/main");
    for (const changed of [...git("diff", "--name-only", base), ...git("ls-files", "--others", "--exclude-standard")]) {
      const fight = changed.match(/^(?:client\/(?:encounters|toa|dt2)|test\/determinism-digests)\/([^/]+)\/|^tools\/(?:determinism\/scenarios|assets\/cache-groups)\/([^/]+)\.(?:mjs|json)$/);
      const name = fight?.[1] ?? fight?.[2];
      if (name && !notFights.has(name)) fights.add(name);
      else if (/^test\/test-[^/]*\.mjs$/.test(changed)) tests.add(changed);
      else if (!/\.md$|^docs\//.test(changed)) other ??= changed;
    }
  } catch {
    other = "no origin/main to compare with";
  }
  if (other) console.log(`--changed: everything, for ${other}`);
  else {
    const all = files.length;
    const usesBrowser = (file) => /playwright-core|replay-page\.mjs/.test(readFileSync(file, "utf8"));
    files = files.filter((file) => tests.has(file) || !usesBrowser(file) || [...fights].some((fight) => file.startsWith(`test/test-${fight}`)));
    console.log(`--changed: ${files.length} of ${all} files, the browser tests of ${[...fights].join(", ") || "no fight"} only`);
  }
}
// A test written before the port was the run's own would open whichever worktree's server holds 8791.
const fixedPort = files.filter((file) => /127\.0\.0\.1:\d|localhost:\d/.test(readFileSync(file, "utf8")));
if (fixedPort.length) {
  console.error(`these name a port; a test opens process.env.TEST_ORIGIN:\n  ${fixedPort.join("\n  ")}`);
  process.exit(1);
}
if (!files.length) {
  console.error("no test files match " + args.join(" "));
  process.exit(1);
}

// How long each file took the last time, so that the longest start first and the run does not end waiting on one of them.
const timesFile = "node_modules/.cache/openscim-test-times.json";
let times = {};
try {
  times = JSON.parse(readFileSync(timesFile, "utf8"));
} catch {}
files.sort((a, b) => (times[b] ?? Infinity) - (times[a] ?? Infinity));

// A slot is a file that names the process holding it. One left by a run that was killed is taken over.
const slotDir = path.join(tmpdir(), "openscim-test-slots");
mkdirSync(slotDir, { recursive: true });
const held = new Set();
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};
function tryTakeSlot() {
  for (let index = 0; index < SLOTS; index++) {
    const slot = path.join(slotDir, index + ".lock");
    try {
      writeFileSync(slot, String(process.pid), { flag: "wx" });
      held.add(slot);
      return slot;
    } catch {
      let owner;
      try {
        owner = Number(readFileSync(slot, "utf8"));
      } catch {
        continue; // freed, or being written, just now
      }
      if (owner && !alive(owner)) rmSync(slot, { force: true });
    }
  }
}
async function takeSlot() {
  for (;;) {
    const slot = tryTakeSlot();
    if (slot) return slot;
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
  }
}
const freeSlot = (slot) => {
  held.delete(slot);
  rmSync(slot, { force: true });
};
process.on("exit", () => held.forEach((slot) => rmSync(slot, { force: true })));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => process.exit(130));

// The servers (tools/test-server.mjs): one for every four tests that run at once, four at most, each on a port of
// its own. A test is given one of them, in turn.
const servers = Array.from({ length: Math.min(4, Math.ceil(Math.min(jobs, files.length) / 4)) }, (unused, index) => fork("tools/test-server.mjs", [String(index)]));
process.on("exit", () => servers.forEach((server) => server.kill()));
const origins = await Promise.all(
  servers.map(
    (server) =>
      new Promise((resolve, reject) => {
        server.once("message", (port) => resolve("http://127.0.0.1:" + port));
        server.once("exit", (code) => reject(new Error("a server of the tests stopped, exit " + code)));
      }),
  ),
);
let given = 0;
const started = Date.now();
const seconds = (ms) => (ms / 1000).toFixed(1).padStart(6) + "s";
/** Runs the files, `atOnce` at a time, and returns those that failed. */
async function runAll(queue, atOnce) {
  const failed = [];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const file = queue[next++];
      const slot = await takeSlot();
      const begun = Date.now();
      const output = [];
      const code = await new Promise((resolve) => {
        const env = { ...process.env, TEST_ORIGIN: origins[given++ % origins.length] };
        const run = spawn(process.execPath, [file], { env, stdio: ["ignore", "pipe", "pipe"] });
        run.stdout.on("data", (chunk) => output.push(chunk));
        run.stderr.on("data", (chunk) => output.push(chunk));
        run.on("error", (error) => resolve(String(error)));
        run.on("close", (code, signal) => resolve(code ?? signal));
      });
      freeSlot(slot);
      const took = Date.now() - begun;
      if (code === 0) {
        times[file] = took;
        console.log(`ok   ${seconds(took)}  ${file}`);
      } else {
        failed.push(file);
        console.log(`FAIL ${seconds(took)}  ${file} (exit ${code})\n${Buffer.concat(output).toString().trimEnd().replace(/^/gm, "    ")}`);
      }
    }
  }
  await Promise.all(Array.from({ length: atOnce }, worker));
  return failed;
}

// A test that counts frames or waits on the app's clock can fail on a busy machine and on nothing else. What failed is
// run once more, one file at a time; what fails twice has failed.
let failed = await runAll(files, jobs);
const again = failed;
if (failed.length && files.length > 1) {
  console.log(`\nonce more, one at a time: ${failed.join(" ")}`);
  failed = await runAll(failed, 1);
}

mkdirSync(path.dirname(timesFile), { recursive: true });
writeFileSync(timesFile, JSON.stringify(times, null, 1));
console.log(`\n${files.length - failed.length} of ${files.length} files passed in${seconds(Date.now() - started)}, ${jobs} at a time`);
const flaky = again.filter((file) => !failed.includes(file));
if (flaky.length) console.log("passed the second time only:\n" + flaky.map((file) => "  " + file).join("\n"));
if (failed.length) console.log("failed:\n" + failed.map((file) => "  " + file).join("\n"));
process.exit(failed.length ? 1 : 0);
