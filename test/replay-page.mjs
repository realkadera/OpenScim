// Not a test: the application with a fight of the Fortis Colosseum running,
// for the tests of the replay (test-replay.mjs, test-replay-after-rewind.mjs).
// The page is given what those ask about: `engine`, the newest engine of the
// fight; `recorder`, the replay's recorder (Grid.js, ReplayRecorder) of the run on screen;
// `replayHook`, what the hook of the replay returns (useReplay); and `replayCode`,
// the functions that compare a rebuilt state (dIe), and pack, unpack and read
// a shared replay (application.js).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const origin = process.env.TEST_ORIGIN;

const probes = [
  ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", (marker) => marker + "if (options.encounter.kind === 'colosseum') window.engine = this;"],
  // The wave must not kill the player in the middle of a test: the setting "infinite health" is on by default.
  ["**/encounters/colosseum/controls.js*", "      infiniteHealth: false,", () => "      infiniteHealth: true,"],
  ["**/assets/Grid.js*", "  startRun(ez, eA) {", (marker) => marker + "window.recorder = this;"],
  ["**/assets/application.js*", "r4.current = replay;", (marker) => marker + "window.replayHook = replay;"],
];
// What the chunks do not export, put on the window at their end.
const exposed = {
  "**/assets/Grid.js*": "\nObject.assign((window.replayCode ??= {}), { Recorder: ReplayRecorder, compare: dIe });",
  "**/assets/application.js*": "\nObject.assign((window.replayCode ??= {}), { pack: Bye, unpack: g4, toData: fB });",
};

/** Opens the Colosseum. `settings` are the application's (Grid.js, "osrs-yama-settings"). */
export async function openColosseum(settings = {}) {
  const browser = await chromium.launch(browserOptions);
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  page.on("console", (message) => /\[Replay\]|diverged/i.test(message.text()) && errors.push(message.text()));
  for (const [path, marker, replace] of probes) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker), `${path} has "${marker}"`);
      await route.fulfill({ response, body: body.replace(marker, replace(marker)) + (exposed[path] ?? "") });
    });
  }
  await page.addInitScript((stored) => {
    if (!localStorage.getItem("osrs-yama-settings")) localStorage.setItem("osrs-yama-settings", stored);
  }, JSON.stringify({ speedMultiplier: 2, fightStartCountdown: true, fightStartCountdownTicks: 5, ...settings }));
  await page.goto(origin + "/colosseum/");
  await page.waitForFunction(() => window.engine && window.recorder && window.replayHook, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });

  const tick = () => page.evaluate(() => engine.currentTick);
  const waitForTick = (target) => page.waitForFunction((target) => engine.currentTick >= target, target, { timeout: 60000 });
  const command = (type, choice) =>
    page.evaluate(([type, choice]) => window.dispatchEvent(new CustomEvent("colosseum-command", { detail: { encounter: "colosseum", type, ...(choice === undefined ? {} : { choice }) } })), [type, choice]);
  const launcher = page.locator('[data-launcher="replay"]:visible').first();
  const seek = page.locator(".replay-seek");
  return {
    browser,
    page,
    errors,
    tick,
    waitForTick,
    seek,
    // Minimus' offer, taken as his dialog takes it, and the wave placed.
    async startWave() {
      await page.waitForFunction(() => engine.worldState.getNpcs().some((npc) => npc.id === "colosseum_minimus"), null, { timeout: 60000 });
      await command("talk-to-minimus");
      await page.waitForFunction(() => engine.getEncounterSnapshot().state.offer, null, { timeout: 20000 });
      await command("choose-modifier", 0);
      await page.waitForFunction(() => engine.getEncounterSnapshot().state.phase === "active", null, { timeout: 20000 });
    },
    // A player's inputs, as clicks: a step, a piece of gear put on, a step back.
    async play() {
      await page.mouse.click(640, 600);
      await waitForTick((await tick()) + 1);
      await page.mouse.click(1114, 567);
      await waitForTick((await tick()) + 1);
      await page.mouse.click(700, 330);
      await waitForTick((await tick()) + 2);
    },
    async openReplay() {
      await launcher.click();
      await seek.waitFor({ timeout: 20000 });
    },
    async closeReplay() {
      await page.keyboard.press("Escape");
      await seek.waitFor({ state: "detached", timeout: 20000 });
    },
    playhead: async () => Number(await seek.inputValue()),
    waitForPlayhead: (value) => page.waitForFunction((value) => Number(document.querySelector(".replay-seek")?.value) === value, value, { timeout: 20000 }),
    // What is wrong with the recording, or nothing: each of its frames is a tick after the one before, its events and
    // its clock go forward, and the recorded inputs rebuild every one of them exactly, as Take Over compares it.
    checkRecording: () =>
      page.evaluate(async () => {
        const { rebuildEngineAtReplayFrame } = await import("/engine/replay.js");
        const { recorder } = window;
        const live = window.engine;
        const frames = recorder.L$();
        const problems = [];
        let eventId = -1;
        frames.forEach((frame, index) => {
          if (index > 0 && frame.state.currentTick !== frames[index - 1].state.currentTick + 1) problems.push(`frame ${index}: tick ${frame.state.currentTick} after ${frames[index - 1].state.currentTick}`);
          if (index > 0 && !(frame.startMs > frames[index - 1].startMs)) problems.push(`frame ${index}: its clock does not go forward`);
          for (const event of frame.events) {
            if (event.eventId <= eventId) problems.push(`frame ${index}: event ${event.eventId} after ${eventId}`);
            eventId = event.eventId;
          }
          // The first frame, from before any tick, is recorded without the gear's bonuses.
          if (index === 0 || !frame.state.isAlive || frame.state.introActive) return;
          const rebuilt = rebuildEngineAtReplayFrame(recorder.ME(), frames, index, live.objTypeLoader);
          const differences = rebuilt ? replayCode.compare(recorder.I$(index).state, rebuilt.getState()) : ["not rebuilt"];
          if (differences.length) problems.push(`frame ${index}: ${differences[0]}`);
        });
        window.engine = live;
        for (const [name, samples] of Object.entries({ cursor: recorder.cursorSamples, clicks: recorder.cursorClicks, viewport: recorder.viewportSamples })) {
          samples.forEach((sample, index) => index > 0 && sample.tMs < samples[index - 1].tMs && problems.push(`${name} ${index}: goes back in time`));
        }
        return problems;
      }),
    // The recording shared and opened again: what the application would send, read as it reads what it fetches.
    shareAndRead: () =>
      page.evaluate(() => {
        const data = replayHook.exportReplayData();
        const { bytes } = replayCode.pack(data, { startFrame: 0, endFrame: data.frames.length - 1 }, { share: {} });
        const read = replayCode.toData(replayCode.unpack(bytes));
        const plain = (frames) => JSON.stringify(frames.map(({ tick, input, actions, events }) => ({ tick, input, actions, events: events.length })));
        return { eligible: replayHook.getShareEligibility().eligible, frames: data.frames.length, read: read.frames.length, same: plain(read.frames) === plain(data.frames), hp: [data, read].map(({ frames }) => frames.map(({ state }) => state.playerHP).join()) };
      }),
  };
}
