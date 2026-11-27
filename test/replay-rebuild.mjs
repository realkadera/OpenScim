// Going back to a tick, in every scripted fight of the determinism harness
// and without a page: what Take Over, Practice, undo and the markers rest on.
//
//   - Rebuilt from the recorded inputs at ticks all through it, the fight is
//     what it was on that tick.
//   - Played on from there with the inputs that followed, it ends as it ended.
//   - A rebuild that is thrown away (one that is refused) leaves a fight that
//     is running as it would have been: the same digest on every tick.
//
// The harness itself rebuilds each fight once, in the middle.
//
// Not a test: all the fights in one process took longer than the rest of
// `npm test` together, so test-replay-rebuild-1.mjs to -8.mjs each take every
// eighth fight, and run side by side.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, canonicalText, loadScenarios, runScenario } from "../tools/determinism/harness.mjs";

const rebuildsPerFight = 6;
// Fights that use what the application does not record: the tutorial's pause and commands, settings changed before the
// first tick, and a boss taken out of the world by hand.
const notRecorded = new Set(["engine/tutorial-controls", "inferno/setup-changed-before-start", "sol-heredit/boss-despawned"]);
// What the application leaves out as it compares (Grid.js, rIe, UAe): logs and the histories the scene draws from.
const leftOut = new Set(["eventLog", "playerHistory", "primaryNpcHistory", "history", "crawlMovement", "damageHistory"]);
const compared = (value) =>
  value instanceof Map ? null : Array.isArray(value) ? value.map(compared) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key, each]) => !leftOut.has(key) && each !== undefined).map(([key, each]) => [key, compared(each)])) : value;
const stateText = (engine, skip) => canonicalText(compared(engine.getState()), skip);
const firstDifference = (was, is) => {
  const a = was.split("\n"), b = is.split("\n");
  const line = a.findIndex((text, index) => text !== b[index]);
  return `${a[line]?.trim()} is ${b[line]?.trim()}`;
};

const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;

/** The tests, over the fights whose place in the list is `shard` modulo `shards`. */
export function rebuildTests(shard, shards) {
const mine = async () => (await loadScenarios()).filter((scenario, index) => index % shards === shard);

test("every fight can be gone back to, all through it, and ends the same from there", { skip }, async () => {
  const problems = [];
  let fights = 0, rebuilds = 0;
  for (const scenario of await mine()) {
    if (scenario.pure || notRecorded.has(scenario.name)) continue;
    fights++;
    const seen = new Map(); // the state on each tick of the run, the last one where it restarts
    await runScenario(scenario, {
      onTick(tick, engine) {
        if (engine.currentTick === 0) seen.clear();
        seen.set(engine.currentTick, stateText(engine, new Set()));
      },
      onRecorded({ frames, engine, rebuild }) {
        const final = stateText(engine, new Set());
        const last = frames.length - 1;
        const indexes = new Set(Array.from({ length: rebuildsPerFight }, (unused, each) => Math.max(1, Math.round((last * (each + 1)) / (rebuildsPerFight + 1)))));
        for (const index of indexes) {
          if (index > last) continue;
          const tick = frames[index].state.currentTick;
          const rebuilt = rebuild(index);
          rebuilds++;
          if (!rebuilt) {
            problems.push(`${scenario.name}: tick ${tick} was not rebuilt`);
            continue;
          }
          const now = stateText(rebuilt, new Set());
          if (now !== seen.get(tick)) {
            problems.push(`${scenario.name}: tick ${tick} rebuilt differs: ${firstDifference(seen.get(tick) ?? "", now)}`);
            continue;
          }
          rebuilt.clearReplayTakeoverWork();
          rebuilt.reapplyArenaConfig();
          for (const frame of frames.slice(index + 1)) {
            if (frame.state.mechanicsConfig) rebuilt.setMechanicsConfig(frame.state.mechanicsConfig);
            for (const action of frame.actions) rebuilt.injectAction(action);
            rebuilt.advanceTick(frame.input);
          }
          const end = stateText(rebuilt, new Set());
          if (end !== final) problems.push(`${scenario.name}: played on from tick ${tick}, it ends differently: ${firstDifference(final, end)}`);
        }
      },
    });
  }
  assert.deepEqual(problems, []);
  assert.ok(fights > 100 / shards && rebuilds > 500 / shards, `${fights} fights, ${rebuilds} rebuilds`);
});

test("a rebuild that is thrown away leaves a running fight alone", { skip }, async () => {
  const problems = [];
  const kinds = new Set();
  for (const scenario of await mine()) {
    if (scenario.pure) continue;
    kinds.add(scenario.kind);
    let rebuild, length;
    const alone = await runScenario(scenario, { onRecorded: (run) => ((rebuild = run.rebuild), (length = run.frames.length)) });
    // The same fight again; every fifth tick the first one is rebuilt somewhere else in it, and dropped.
    const disturbed = await runScenario(scenario, {
      onTick(tick) {
        if (tick === 0 || tick % 5 !== 0 || length <= 2) return;
        // Seeds are drawn from Math.random, and a restart of this fight draws its own after this.
        const drawn = Math.random;
        Math.random = () => 0.5;
        rebuild(Math.max(1, (tick * 7) % length));
        Math.random = drawn;
      },
    });
    const at = alone.digests.findIndex((digest, tick) => digest !== disturbed.digests[tick]);
    if (at >= 0) problems.push(`${scenario.name}: tick ${at} differs`);
    if (alone.final !== disturbed.final && at < 0) problems.push(`${scenario.name}: ends differently`);
  }
  assert.deepEqual(problems, []);
  assert.ok(kinds.size > 5, `${kinds.size} kinds of fight`);
});
}
