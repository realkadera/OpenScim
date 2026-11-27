// The replay's undo and markers in the application, on the first wave of the Fortis
// Colosseum with the application's own tick loop: its keys undo, mark a tick
// and go back to it, the tick comes back as it was, and a marker outlives a
// restart, a death and an undo past it. The wave and its reinforcements are
// marked by themselves; the replay's timeline shows the markers; a rollback
// waits for the player where the options say so. First what decides it,
// without a page.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

import { findUndoFrameIndex, addMarker, isOnTimeline, pickMarker, pickAutoMarker, nameNewAutoMarkers, replayMarkerStore } from "../client/replay/markers.js";

// Where Undo goes: "." a tick of the fight, "i" the intro, "x" one after a death.
const undoIn = (ticks, undo) => findUndoFrameIndex([...ticks].map((state) => ({ state })), undo, (state) => state === ".");
assert.equal(undoIn(".......", 3), 3);
assert.equal(undoIn("...", 3), 1);
assert.equal(undoIn("ii....", 9), 2);
assert.equal(undoIn("....xxx", 2), 1);
assert.equal(undoIn("..x", 1), 1);
// The first frame is never gone back to.
assert.equal(undoIn("..", 3), null);
assert.equal(undoIn(".x", 1), null);
assert.equal(undoIn(".", 3), null);
assert.equal(undoIn("ii", 3), null);
assert.equal(undoIn("", 3), null);

// Markers: a recording is a list of frames, which a run that branches off shares up to where it does.
const frame = (currentTick) => ({ state: { currentTick } });
const timeline = Array.from({ length: 10 }, (unused, tick) => frame(tick));
const branch = [...timeline.slice(0, 5), ...Array.from({ length: 5 }, (unused, tick) => frame(tick + 5))];
const mark = (frames, index, label = null) => ({ run: { frames: frames.slice(0, index + 1) }, restoreFrameIndex: index, startTick: frames[index].state.currentTick, label });
assert.ok(isOnTimeline(mark(timeline, 4), branch));
assert.ok(!isOnTimeline(mark(timeline, 7), branch));
// A frame that is replaced for its timing is still the same tick.
assert.ok(isOnTimeline(mark(timeline, 9), [...timeline.slice(0, 9), { ...timeline[9], timing: { lateByMs: 60 } }]));
// Several are kept; one on the same tick of the same recording is replaced, on another recording's it is not.
let markers = [mark(timeline, 2), mark(timeline, 7)].reduce(addMarker, []);
assert.deepEqual(addMarker(markers, mark(timeline, 7)).map(({ startTick }) => startTick), [2, 7]);
assert.deepEqual(addMarker(markers, mark(branch, 7)).map(({ startTick }) => startTick), [2, 7, 7]);
// An encounter's marker replaces the one of its name on a recording that was left, not an earlier one of the same.
markers = [mark(timeline, 3, "shield"), mark(timeline, 8, "shield"), mark(timeline, 8)].reduce(addMarker, []);
assert.equal(markers.length, 3);
markers = addMarker(markers, mark(branch, 6, "shield"));
assert.deepEqual(markers.map(({ startTick, label }) => [startTick, label]), [[3, "shield"], [8, null], [6, "shield"]]);
// Load auto marker: the last of this recording, or else the newest.
assert.equal(pickAutoMarker(markers, branch).startTick, 6);
assert.equal(pickAutoMarker(markers, timeline.slice(0, 5)).startTick, 3);
assert.equal(pickAutoMarker(markers, []).startTick, 6);
assert.equal(pickAutoMarker([mark(timeline, 2)], timeline), null);
// The oldest of the player's go when there are more than 20.
const many = Array.from({ length: 25 }, (unused, tick) => frame(tick));
assert.deepEqual(many.map((unused, index) => mark(many, index)).reduce(addMarker, [mark(many, 0, "wave 1")]).map(({ startTick }) => startTick), [0, ...Array.from({ length: 20 }, (unused, index) => index + 5)]);
// Previous and next, from the tick of the fight, and from a marker just gone to while the fight goes on.
const steps = [mark(timeline, 2), mark(timeline, 4), mark(timeline, 9)];
assert.equal(pickMarker(steps, -1, 5).startTick, 4);
assert.equal(pickMarker(steps, -1, 5, steps[1]).startTick, 2);
assert.equal(pickMarker(steps, -1, 8, steps[1]).startTick, 4);
assert.equal(pickMarker(steps, 1, 5).startTick, 9);
assert.equal(pickMarker(steps, 1, 5, steps[0]).startTick, 4);
assert.equal(pickMarker(steps, 1, 9), null);
assert.equal(pickMarker(steps, -1, 2), null);
// What an encounter reached: what it did not list the tick before; nothing with the option off.
const reached = [{ id: "wave 4", label: "wave 4" }, { id: "healers 90", label: "Jad's healers" }];
assert.equal(nameNewAutoMarkers(new Set(["wave 4"]), reached), "Jad's healers");
assert.equal(nameNewAutoMarkers(new Set(), reached), "wave 4, Jad's healers");
assert.equal(nameNewAutoMarkers(new Set(["wave 4", "healers 90"]), reached), null);
replayMarkerStore.setSettings({ ...replayMarkerStore.getState().settings, autoMarkers: false });
assert.equal(nameNewAutoMarkers(new Set(), reached), null);

const origin = process.env.TEST_ORIGIN;
const browser = await chromium.launch(browserOptions);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // The newest engine of the fight: one that is rebuilt replaces the one before. `loads` counts them.
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const marker = "this.encounter = options.encounter;";
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "if (options.encounter.kind === 'colosseum') { window.engine = this; window.loads = (window.loads ?? 0) + 1; }") });
  });
  // The wave must not kill the player in the middle of the test: the setting "infinite health" is on by default.
  await page.route("**/encounters/colosseum/controls.js*", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    assert.ok(body.includes("      infiniteHealth: false,"));
    await route.fulfill({ response, body: body.replace("      infiniteHealth: false,", "      infiniteHealth: true,") });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("osrs-yama-settings")) localStorage.setItem("osrs-yama-settings", JSON.stringify({ speedMultiplier: 2, fightStartCountdown: true, fightStartCountdownTicks: 5 }));
  });
  await page.goto(origin + "/colosseum/");
  await page.waitForFunction(() => window.engine, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });

  const tick = () => page.evaluate(() => engine.currentTick);
  const waitForTick = (target) => page.waitForFunction((target) => engine.currentTick >= target, target, { timeout: 60000 });
  // Every tick of the fight as it was last seen: a key is pressed on a tick the test only knows by its message.
  await page.evaluate(() => {
    window.seen = {};
    const see = () => {
      seen[engine.currentTick] = { tick: engine.currentTick, hp: engine.getState().playerHP, position: engine.getState().playerPosition, npcs: engine.worldState.getNpcs().map((npc) => [npc.id, npc.position, npc.vitals?.hp]) };
      requestAnimationFrame(see);
    };
    see();
  });
  // Presses Add marker and returns the fight on the tick it marked.
  const addMark = async () => {
    await page.keyboard.press("F8");
    const text = await message();
    assert.match(text, /^Marked tick \d+$/);
    return page.evaluate((tick) => seen[tick], Number(text.slice("Marked tick ".length)));
  };
  const setOption = (key, value) => page.evaluate(async ([key, value]) => {
    const { replayMarkerStore } = await import("/replay/markers.js");
    replayMarkerStore.setSettings({ ...replayMarkerStore.getState().settings, [key]: value });
  }, [key, value]);
  const message = () => page.evaluate(() => document.querySelector(".replay-marker-message")?.textContent ?? "");
  // Presses a key and returns the fight on the tick it was restored to: read as the new engine is taken over, before
  // the application's loop has ticked it.
  const restore = async (key) => {
    await page.evaluate(() => {
      window.restored = null;
      const before = window.engine;
      const read = () => {
        const text = document.querySelector(".replay-marker-message")?.textContent ?? "";
        if (window.engine !== before && /^(Back|Undone) to/.test(text)) {
          window.restored = { text, tick: engine.currentTick, hp: engine.getState().playerHP, position: engine.getState().playerPosition, npcs: engine.worldState.getNpcs().map((npc) => [npc.id, npc.position, npc.vitals?.hp]) };
        } else requestAnimationFrame(read);
      };
      document.querySelector(".replay-marker-message")?.replaceChildren();
      requestAnimationFrame(read);
    });
    await page.keyboard.press(key);
    await page.waitForFunction(() => window.restored, null, { timeout: 20000 });
    const { text, ...fight } = await page.evaluate(() => window.restored);
    return { text, fight };
  };

  // No marker yet: the keys say so and the fight goes on.
  await waitForTick(2);
  await page.keyboard.press("F9");
  assert.equal(await message(), "No marker yet");
  await page.keyboard.press("Shift+F9");
  assert.equal(await message(), "No auto marker yet");

  // Minimus' offer, taken as his dialog takes it.
  const command = (type, choice) => page.evaluate(([type, choice]) => window.dispatchEvent(new CustomEvent("colosseum-command", { detail: { encounter: "colosseum", type, ...(choice === undefined ? {} : { choice }) } })), [type, choice]);
  await page.waitForFunction(() => engine.worldState.getNpcs().some((npc) => npc.id === "colosseum_minimus"), null, { timeout: 60000 });
  await command("talk-to-minimus");
  await page.waitForFunction(() => engine.getEncounterSnapshot().state.offer, null, { timeout: 20000 });
  await command("choose-modifier", 0);
  await page.waitForFunction(() => engine.getEncounterSnapshot().state.phase === "active", null, { timeout: 20000 });

  // A marker: the fight as it was, however often it is loaded.
  await waitForTick((await tick()) + 4);
  const saved = await addMark();
  for (let attempt = 0; attempt < 2; attempt++) {
    await waitForTick(saved.tick + 3);
    const loaded = await restore("F9");
    assert.equal(loaded.text, `Back to tick ${saved.tick}`);
    assert.deepEqual(loaded.fight, saved);
  }
  // It goes on from there by itself, without the start-of-fight countdown (5 ticks here, 1.5 seconds): the next tick
  // comes one tick (300 ms) after.
  const loadedAt = Date.now();
  await waitForTick(saved.tick + 1);
  assert.ok(Date.now() - loadedAt < 1200, `the next tick came after ${Date.now() - loadedAt} ms`);

  // Undo: three ticks back by default, and further when pressed again.
  await waitForTick(saved.tick + 5);
  const before = await tick();
  const undone = await restore("Control+z");
  assert.ok(undone.fight.tick >= before - 3 && undone.fight.tick <= before - 2, `from ${before} to ${undone.fight.tick}`);
  assert.equal(undone.text, `Undone to tick ${undone.fight.tick}`);
  const undoneAgain = await restore("Control+z");
  assert.ok(undoneAgain.fight.tick < undone.fight.tick);
  // Pressed fast, while an earlier press is still being restored, every press counts.
  await waitForTick(saved.tick + 10);
  const fast = await tick();
  for (let press = 0; press < 3; press++) await page.keyboard.press("Control+z");
  await page.waitForFunction((latest) => engine.currentTick <= latest, fast - 7, { timeout: 5000 });
  // Past the marker, which is kept.
  while ((await restore("Control+z")).fight.tick >= saved.tick);
  assert.deepEqual((await restore("F9")).fight, saved);

  // The wave's own marker.
  const wave = await restore("Shift+F9");
  assert.match(wave.text, /^Back to wave 1 \(tick \d+\)$/);
  assert.ok(wave.fight.tick < saved.tick && wave.fight.npcs.length > 0);

  // A second marker, further on in the recording of the first (the wave's start is before where that went on);
  // previous and next go to each in turn, the wave's own before them.
  assert.deepEqual((await restore("F9")).fight, saved);
  await waitForTick(saved.tick + 6);
  const second = await addMark();
  assert.ok(second.tick > saved.tick);
  await waitForTick(second.tick + 5);
  assert.deepEqual((await restore("F7")).fight, second);
  assert.deepEqual((await restore("F7")).fight, saved);
  assert.equal((await restore("F7")).text, wave.text);
  assert.deepEqual((await restore("Shift+F7")).fight, saved);
  assert.deepEqual((await restore("Shift+F7")).fight, second);
  // Load marker goes to the one gone to last.
  assert.deepEqual((await restore("F7")).fight, saved);
  assert.deepEqual((await restore("F9")).fight, saved);

  // The options to wait: the tick stands until the player acts, here by walking, or presses Space.
  await setOption("pauseAfterLoad", true);
  const held = await restore("F9");
  assert.match(held.text, /Paused: act or press Space to go on$/);
  await page.waitForTimeout(1200);
  assert.equal(await tick(), saved.tick);
  await page.keyboard.press("Space");
  await waitForTick(saved.tick + 1);
  await restore("F9");
  await page.waitForTimeout(700);
  assert.equal(await tick(), saved.tick);
  await page.mouse.click(640, 600);
  await waitForTick(saved.tick + 2);
  assert.notDeepEqual(await page.evaluate(() => engine.getState().playerPosition), saved.position, "the click was not lost");
  // Undo has an option of its own, off.
  const rolled = await restore("Control+z");
  await waitForTick(rolled.fight.tick + 1);
  // Held, undo goes further back, and a restart does not stay held.
  await setOption("pauseAfterUndo", true);
  await waitForTick(saved.tick + 4);
  const heldUndo = await restore("Control+z");
  assert.equal((await restore("Control+z")).fight.tick, heldUndo.fight.tick - 3);
  await setOption("pauseAfterUndo", false);
  await setOption("pauseAfterLoad", false);
  await page.keyboard.press("Control+r");
  await page.waitForFunction(() => engine.currentTick <= 1, null, { timeout: 20000 });
  await waitForTick(3);

  // The replay of this run shows no marker of the one before.
  await page.locator('[data-launcher="replay"]:visible').first().click();
  await page.locator(".replay-seek").waitFor({ timeout: 20000 });
  assert.equal(await page.locator(".replay-marker").count(), 0);
  await page.keyboard.press("Escape");
  await page.locator(".replay-seek").waitFor({ state: "detached", timeout: 20000 });

  // The replay's timeline: both markers and the wave's, in the recording of the second; a click and the keys move the playhead.
  assert.deepEqual((await restore("F9")).fight, saved);
  await restore("Shift+F7");
  await page.locator('[data-launcher="replay"]:visible').first().click();
  const marks = page.locator(".replay-marker");
  await marks.first().waitFor({ timeout: 20000 });
  assert.deepEqual((await marks.evaluateAll((all) => all.map((each) => each.title))).sort(), [`Marker: tick ${saved.tick}`, `Marker: tick ${second.tick}`, `Marker: wave 1 (tick ${wave.fight.tick})`].sort());
  const playhead = () => page.locator(".replay-seek").inputValue();
  const end = await playhead();
  await page.locator(`.replay-marker[title="Marker: tick ${saved.tick}"]`).click();
  // The playhead moves a frame after the click: read at once, it can still be at the end.
  await page.waitForFunction((value) => document.querySelector(".replay-seek").value !== value, end, { timeout: 5000 });
  const savedFrame = Number(await playhead());
  await page.keyboard.press("Shift+F7");
  await page.waitForFunction(([value, at]) => Number(document.querySelector(".replay-seek").value) === value + at, [savedFrame, second.tick - saved.tick], { timeout: 5000 });
  await page.keyboard.press("F7");
  await page.waitForFunction((value) => Number(document.querySelector(".replay-seek").value) === value, savedFrame, { timeout: 5000 });
  // Add marker on a marker of one's own takes it away, and on another tick adds one.
  await page.keyboard.press("F8");
  await page.waitForFunction(() => document.querySelectorAll(".replay-marker").length === 2, null, { timeout: 5000 });
  await page.keyboard.press("F8");
  await page.waitForFunction(() => document.querySelectorAll(".replay-marker").length === 3, null, { timeout: 5000 });
  // Loaded from the replay, the fight goes on from the marker.
  assert.deepEqual((await restore("F9")).fight, saved);
  await waitForTick(saved.tick + 1);

  await restore("Shift+F9");
  // Its reinforcements, 66 ticks on.
  await page.waitForFunction(() => engine.encounter.getAutoMarkers().some(({ label }) => label === "wave 1 reinforcements"), null, { timeout: 90000 });
  const reinforcementsTick = await tick();
  await waitForTick(reinforcementsTick + 2);
  const reinforcements = await restore("Shift+F9");
  assert.equal(reinforcements.text, `Back to wave 1 reinforcements (tick ${reinforcementsTick})`);
  assert.ok(reinforcements.fight.npcs.some(([id]) => id.startsWith("colosseum_jaguar_")));

  // A restart begins another run; the marker is of the one before and still loads.
  await page.keyboard.press("Control+r");
  await page.waitForFunction(() => engine.currentTick <= 1, null, { timeout: 20000 });
  assert.deepEqual((await restore("F9")).fight, saved);

  // A death: undone to before it.
  await waitForTick(saved.tick + 4);
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: false });
    engine.player().vitals.hp = 0;
  });
  await page.waitForFunction(() => !engine.getState().isAlive, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const revived = await restore("Control+z");
  assert.ok(revived.fight.hp > 0);
  assert.ok(revived.fight.tick >= saved.tick);

  // An option just ticked has the focus, and the keys still work.
  await page.evaluate(() => {
    const box = Object.assign(document.createElement("input"), { type: "checkbox", id: "ticked" });
    document.body.append(box);
    box.focus();
  });
  await waitForTick((await tick()) + 5);
  await restore("Control+z");
  await page.evaluate(() => document.querySelector("#ticked").remove());

  // A state the recorded inputs do not lead to is not restored: the fight on screen goes on.
  await page.evaluate(() => {
    engine.player().vitals.hp -= 1;
  });
  await waitForTick((await tick()) + 2);
  await page.keyboard.press("F8");
  const kept = await page.evaluate(() => {
    window.kept = window.loads;
    return engine.currentTick;
  });
  await waitForTick(kept + 1);
  await page.evaluate(() => (window.live = window.engine));
  await page.keyboard.press("F9");
  await page.waitForFunction(() => document.querySelector(".replay-marker-message").textContent === "That tick could not be restored exactly", null, { timeout: 20000 });
  const liveTick = await page.evaluate(() => live.currentTick);
  await page.waitForFunction((from) => live.currentTick > from, liveTick, { timeout: 20000 });

  // A key that is unbound does nothing; there is no other switch.
  await page.evaluate(() => {
    const keybinds = JSON.parse(localStorage.getItem("osrs-unified-keybinds"));
    localStorage.setItem("osrs-unified-keybinds", JSON.stringify({ ...keybinds, plugins: { ...keybinds.plugins, replayUndo: "" } }));
  });
  const loads = await page.evaluate(() => window.loads);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.loads), loads);

  assert.deepEqual(errors, []);
  console.log("The replay's keys undo, mark and load ticks of the Colosseum; markers outlive an undo, a restart and a death, stand on the timeline, and a rollback waits where asked");
} finally {
  await browser.close();
}
