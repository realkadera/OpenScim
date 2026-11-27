// client/net/remotePlayers.js with a fake rig builder and a fake tracker: the
// diff against the store's list, what the trackers are fed, the looks a
// member cannot break the room with, the cap of the drawn, and the hook.
import assert from "node:assert/strict";

import {
  BROKEN_RETRY_MS,
  COMBINING_MARKS_MAX,
  DEFAULT_APPEARANCE,
  DRAW_HYSTERESIS_TILES,
  REBUILD_INTERVAL_MS,
  REMOTE_DRAW_MAX,
  RIG_BUILDS_PER_FRAME,
  appearanceFromWire,
  appearanceToWire,
  createRemotePlayers,
  equipmentToWire,
  faceAngle,
  getRemotePlayersSource,
  localFaceAngle,
  presentedRemotePlayers,
  safeName,
  setLocalFaceTarget,
  setRemotePlayersSource,
} from "../client/net/remotePlayers.js";

const LOOK = { gender: 0, hair_kit: 0, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 1, torso_color: 2, legs_color: 3, feet_color: 4, skin_color: 5 };

// A tracker that records what it is told and stands where it was put last.
function fakeTracker(x, y) {
  const calls = [];
  let at = [x, y];
  let angle = 0;
  let path = [];
  let running = false;
  return {
    calls,
    set facingAngle(value) {
      calls.push(["facing", value]);
      angle = value;
    },
    enqueueTickMovement(tick, steps, run) {
      calls.push(["walk", tick, steps, run]);
      path = steps.map((s) => [...s]);
      running = run;
    },
    snapToUnwalkedPlacement(tile, facing) {
      const end = path.length ? path[path.length - 1] : at;
      if (end[0] === tile[0] && end[1] === tile[1]) return false;
      calls.push(["snap", tile, facing]);
      at = [...tile];
      path = [];
      angle = facing;
      return true;
    },
    setTargetAngle(value) {
      if (!path.length) angle = value;
    },
    setInteracting(value) {
      calls.push(["interacting", value]);
    },
    setForcedFacingAngle(value) {
      calls.push(["force", value]);
    },
    currentTurnTarget: () => angle,
    advance(ms) {
      // One tile per 600 ms is enough for these checks: the whole path at once.
      const moving = path.length > 0;
      if (ms > 0 && moving) {
        at = path[path.length - 1];
        path = [];
      }
      return { position: [...at], isVisuallyMoving: moving, simIsMoving: moving, isRunning: moving && running, facingAngle: angle, targetAngle: angle, isTurning: false, locomotionState: moving ? "walk" : null };
    },
  };
}

function setup(options = {}) {
  const built = [];
  const released = [];
  const trackers = new Map();
  const clock = { ms: 0 };
  const remotes = createRemotePlayers({
    now: () => clock.ms,
    releaseRig: (rig) => released.push(rig),
    buildRig: (appearance, equipment, id) => {
      built.push({ id, appearance, equipment });
      return options.buildRig ? options.buildRig(appearance, equipment, id) : { meshCommands: [{ meshId: `remote-player-${id}` }], hitModel: { verticesCount: 1 } };
    },
    makeTracker: (x, y) => {
      const tracker = fakeTracker(x, y);
      trackers.set(`${x},${y}`, tracker);
      return tracker;
    },
    ...options.extra,
  });
  return { remotes, built, trackers, released, clock };
}

const player = (id, tile, more = {}) =>
  Object.freeze({ id, name: `Player ${id}`, appearance: LOOK, equipment: {}, tile, facing: 0, run: false, fromTile: tile, steps: [], snapped: true, lastTick: null, ...more });
const moved = (p, steps, { run = false, tick, facing = p.facing, snapped = false } = {}) =>
  Object.freeze({ ...p, fromTile: p.tile, tile: steps[steps.length - 1], steps: snapped ? [] : steps, run, snapped, lastTick: tick, facing });

// --- the wire's look and the client's ------------------------------------------------
{
  assert.deepEqual(appearanceToWire(DEFAULT_APPEARANCE), { gender: 0, hair_kit: 0, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 0, torso_color: 0, legs_color: 0, feet_color: 0, skin_color: 0 });
  assert.deepEqual(appearanceFromWire(appearanceToWire(DEFAULT_APPEARANCE)), DEFAULT_APPEARANCE);
  assert.deepEqual(appearanceFromWire(LOOK), { ...DEFAULT_APPEARANCE, hairColor: 1, torsoColor: 2, legsColor: 3, feetColor: 4, skinColor: 5 });
  assert.deepEqual(equipmentToWire({ head: 11865, weapon: 22325, shield: undefined, ring: null, junk: 5, body: -1, legs: 70000 }), { head: 11865, weapon: 22325 });
}

// --- a look the client cannot draw takes the default's, field by field ----------------
{
  const hostile = { gender: 7, hair_kit: -1, jaw_kit: -1, torso_kit: -1, arms_kit: 99999, hands_kit: "33", legs_kit: 1.5, feet_kit: 300, hair_color: 999, torso_color: -3, legs_color: null, feet_color: 4, skin_color: 5 };
  const valid = (kit, bodyPart) => kit !== 300 && [0, 10, 18, 26, 33, 36, 42][bodyPart] !== undefined;
  const look = appearanceFromWire(hostile, valid);
  assert.equal(look.gender, 0);
  assert.equal(look.hairKit, -1, "no hair is a look");
  assert.equal(look.jawKit, -1, "no jaw is a look");
  assert.equal(look.torsoKit, 18, "a torso is always there");
  assert.equal(look.armsKit, 26);
  assert.equal(look.handsKit, 33);
  assert.equal(look.legsKit, 36);
  assert.equal(look.feetKit, 42, "a kit the cache does not have");
  assert.equal(look.hairColor, 0);
  assert.equal(look.torsoColor, 0);
  assert.equal(look.legsColor, 0);
  assert.equal(look.feetColor, 4);
  // A kit of another body part, and a validator that throws.
  assert.equal(appearanceFromWire({ ...LOOK, torso_kit: 0 }, (kit, part) => (kit === 0 ? part === 0 : true)).torsoKit, 18);
  assert.deepEqual(appearanceFromWire({ ...LOOK }, () => {
    throw new Error("no cache");
  }), { ...DEFAULT_APPEARANCE, hairColor: 1, torsoColor: 2, legsColor: 3, feetColor: 4, skinColor: 5 });
  for (const junk of [null, undefined, 3, "x", []]) assert.deepEqual(appearanceFromWire(junk), DEFAULT_APPEARANCE);
}

// --- names are text --------------------------------------------------------------
{
  assert.equal(safeName("Zezima"), "Zezima");
  assert.equal(safeName("<col=ff0000>Red</col>"), "col=ff0000Red/col");
  assert.equal(safeName("a‮b\u0000c\nd"), "abcd");
  assert.equal([...safeName("x".repeat(40))].length, 24);
  assert.equal([...safeName("😀".repeat(30))].length, 24);
  for (const junk of [null, 5, "", "   ", "<>"]) assert.equal(safeName(junk), "Player");
  // Format characters: the Arabic letter mark, the BOM, the line and paragraph separators, the soft hyphen.
  assert.equal(safeName("a؜b﻿c d e­f"), "abcdef");
  assert.equal(safeName("⁦x⁩"), "x");
  // At most COMBINING_MARKS_MAX combining marks on one character ("Zalgo").
  assert.equal(COMBINING_MARKS_MAX, 2);
  assert.equal(safeName("o̶̷̸̹b"), "o̶̷b");
  assert.equal(safeName("á̂̃̄b"), "á̂̃b", "composed first, then two marks");
  assert.equal(safeName("é"), "é", "NFC first");
  assert.ok([...safeName("Z" + "̶".repeat(200))].length <= 3);
}

// --- created on first sight, dropped on leave --------------------------------------------
{
  const { remotes, built, trackers } = setup();
  assert.deepEqual(remotes.update([player(5, [10, 10]), player(6, null), player(7, [20, 20], { appearance: null })], { localPosition: [10, 12] }).map((e) => e.id), [5]);
  assert.equal(remotes.size, 2, "6 is not placed yet; 7 is placed, its look not known");
  assert.deepEqual(built.map((b) => b.id), [5]);
  assert.ok(trackers.get("10,10") && trackers.get("20,20"));
  // 7's look comes: its rig is built.
  assert.deepEqual(remotes.update([player(5, [10, 10]), player(7, [20, 20])], { localPosition: [10, 12] }).map((e) => e.id), [5, 7], "nearest first");
  assert.deepEqual(built.map((b) => b.id), [5, 7]);
  // The same records again: nothing is built again.
  remotes.update([player(5, [10, 10]), player(7, [20, 20])]);
  assert.equal(built.length, 2);
  // 5 leaves (member_leave): gone, and its rig is not drawn.
  assert.deepEqual(remotes.update([player(7, [20, 20])]).map((e) => e.id), [7]);
  assert.equal(remotes.get(5), undefined);
  assert.equal(remotes.size, 1);
  assert.deepEqual(remotes.hitTestData().map((h) => h.actorId), [7]);
  assert.equal(remotes.hitTestData()[0].hitTestData.useBoundingBox, true);
  assert.equal(remotes.hitTestData()[0].hitTestData.modelMatrix, remotes.get(7).modelMatrix);
  // Everyone gone.
  assert.deepEqual(remotes.update([]), []);
  assert.equal(remotes.size, 0);
  assert.deepEqual(remotes.hitTestData(), []);
}

// --- the combat level: kept when it is one, else null ----------------------------------
{
  const { remotes } = setup();
  remotes.update([player(1, [1, 1], { combat: 99 }), player(2, [2, 2], { combat: null }), player(3, [3, 3], { combat: 127 }), player(4, [4, 4])]);
  assert.deepEqual(remotes.entries().map((e) => [e.id, e.combat]), [[1, 99], [2, null], [3, null], [4, null]]);
  remotes.update([player(1, [1, 1], { combat: 100 })]);
  assert.equal(remotes.get(1).combat, 100);
  for (let frame = 0; frame < 3; frame++) remotes.update([player(1, [1, 1], { combat: 100 })]);
  assert.deepEqual(remotes.hitTestData().map((h) => [h.actorId, h.combat]), [[1, 100]]);
}

// --- a new look builds a new rig; equipment too --------------------------------------
{
  const { remotes, built, released, clock } = setup();
  const p = player(5, [10, 10]);
  remotes.update([p]);
  const first = remotes.get(5).rig;
  // A new look within REBUILD_INTERVAL_MS waits; looks sent meanwhile are coalesced into the latest.
  clock.ms = 1000;
  remotes.update([{ ...p, equipment: { weapon: 1 } }]);
  clock.ms = 2000;
  remotes.update([{ ...p, equipment: { weapon: 22325 } }]);
  assert.equal(built.length, 1, "no rebuild within the interval");
  assert.equal(remotes.get(5).rig, first, "the old rig is drawn meanwhile");
  clock.ms = REBUILD_INTERVAL_MS;
  remotes.update([{ ...p, equipment: { weapon: 22325 } }]);
  assert.equal(built.length, 2);
  assert.deepEqual(built.at(-1).equipment, { weapon: 22325 }, "the latest look, once");
  assert.deepEqual(released, [first], "the old rig is released");
  // A look sent every tick for a minute: one rebuild per interval, not one per tick.
  for (let tick = 0; tick < 100; tick++) {
    clock.ms += 600;
    remotes.update([{ ...p, appearance: { ...LOOK, hair_kit: tick % 2 } }]);
  }
  assert.ok(built.length - 2 <= Math.ceil((100 * 600) / REBUILD_INTERVAL_MS), `${built.length - 2} rebuilds in a minute`);
  // Leaving releases the rig.
  const last = remotes.get(5).rig;
  remotes.update([]);
  assert.equal(released.at(-1), last);
}

// --- a rig the scene could not draw: dropped, warned once, retried on a new look or after 30 s
{
  const errors = [];
  const { remotes, built, released, clock } = setup({ extra: { onError: (error, id) => errors.push([error.message, id]) } });
  const p = player(5, [10, 10]);
  remotes.update([p]);
  const rig = remotes.get(5).rig;
  remotes.markBroken(5, new Error("draw"));
  remotes.markBroken(5, new Error("draw"));
  assert.deepEqual(errors, [["draw", 5]], "one warning per id");
  assert.deepEqual(released, [rig]);
  assert.deepEqual(remotes.drawn(), []);
  clock.ms = 10_000;
  remotes.update([p]);
  assert.equal(built.length, 1, "not retried every frame");
  assert.deepEqual(remotes.drawn(), []);
  clock.ms = 10_000 + BROKEN_RETRY_MS;
  remotes.update([p]);
  assert.equal(built.length, 2, "retried after 30 s");
  remotes.markBroken(5, new Error("again"));
  clock.ms += 1000;
  remotes.update([{ ...p, equipment: { weapon: 4151 } }]);
  assert.equal(built.length, 3, "a new look is tried at once");
  assert.equal(errors.length, 1);
  remotes.markBroken(99, new Error("unknown id")); // nothing happens
}

// --- a rig that fails: without the equipment, then the default look; never thrown -------
{
  const { remotes, built, clock } = setup({
    buildRig: (appearance, equipment) => {
      if (equipment.weapon === 1) throw new Error("no such item");
      if (appearance.torsoKit === 19) return null;
      return { meshCommands: [] };
    },
    extra: { onError: () => {} },
  });
  remotes.update([player(1, [5, 5], { equipment: { weapon: 1, head: 2 } })]);
  assert.deepEqual(built.map((b) => b.equipment), [{ weapon: 1, head: 2 }, {}]);
  assert.equal(remotes.drawn().length, 1);
  clock.ms = REBUILD_INTERVAL_MS;
  remotes.update([player(1, [5, 5], { appearance: { ...LOOK, torso_kit: 19 }, equipment: { weapon: 1 } })]);
  assert.deepEqual(built.slice(2).map((b) => [b.appearance.torsoKit, b.equipment]), [[19, { weapon: 1 }], [19, {}], [18, {}]]);
  assert.equal(remotes.drawn().length, 1);
  // A rig that never builds is not drawn, and is not tried again every frame.
  const never = setup({ buildRig: () => null });
  never.remotes.update([player(2, [5, 5])]);
  never.remotes.update([player(2, [5, 5])]);
  assert.equal(never.built.length, 2, "with the look, then with the default look, once");
  assert.deepEqual(never.remotes.drawn(), []);
}

// --- junk in the list is skipped, never thrown -----------------------------------------
{
  const errors = [];
  const { remotes } = setup({ extra: { onError: (e) => errors.push(e) } });
  const junk = [null, 3, "x", {}, { id: -1, tile: [1, 1] }, { id: 1.5, tile: [1, 1] }, { id: 2, tile: [64, 1] }, { id: 3, tile: [1] }, { id: 4, tile: "1,1" }, Object.defineProperty({ id: 9 }, "tile", { get() { throw new Error("boom"); } }), player(8, [3, 3], { steps: "nope", lastTick: 4, snapped: false, name: { toString: () => "x" }, facing: 99999 })];
  assert.doesNotThrow(() => remotes.update(junk));
  assert.doesNotThrow(() => remotes.update("not a list"));
  assert.doesNotThrow(() => remotes.update(junk, { localPosition: "here", deltaMs: NaN }));
  assert.deepEqual(remotes.entries().map((e) => e.id), [8]);
  assert.equal(remotes.get(8).name, "Player");
  assert.equal(remotes.get(8).facing, 0);
  // Two records of one id: the first counts.
  remotes.update([player(8, [3, 3]), player(8, [9, 9])]);
  assert.deepEqual(remotes.get(8).tile, [3, 3]);
  assert.equal(errors.length, 1, "the throwing record is reported once");
}

// --- the tracker is fed each move once: steps, run, snaps, facing -------------------------
{
  const { remotes, trackers } = setup();
  let p = player(5, [10, 10], { facing: 1024 });
  remotes.update([p]);
  const tracker = trackers.get("10,10");
  assert.deepEqual(tracker.calls, [["facing", 1024]]);
  // A walk of one tile.
  p = moved(p, [[10, 11]], { tick: 100, facing: 1024 });
  remotes.update([p], { deltaMs: 16 });
  remotes.update([p], { deltaMs: 16 }); // the same record again feeds nothing
  assert.deepEqual(tracker.calls.slice(1), [["walk", 1, [[10, 11]], false]]);
  // A run of two tiles: run is passed on, and the state says it runs.
  p = moved(p, [[10, 12], [10, 13]], { tick: 101, run: true });
  const [entry] = remotes.update([p], { deltaMs: 0 });
  assert.deepEqual(tracker.calls.at(-1), ["walk", 2, [[10, 12], [10, 13]], true]);
  assert.equal(entry.state.isRunning, true);
  remotes.update([p], { deltaMs: 600 });
  assert.deepEqual(remotes.get(5).position, [10, 13]);
  // A gap (snapped): put on the tile at once, with its facing.
  p = moved(p, [[30, 30]], { tick: 105, snapped: true, facing: 512 });
  remotes.update([p], { deltaMs: 16 });
  assert.deepEqual(tracker.calls.at(-1), ["snap", [30, 30], 512]);
  assert.deepEqual(remotes.get(5).position, [30, 30]);
  assert.equal(remotes.get(5).facingAngle, 512);
  // Steps that do not end on the tile are a snap too.
  p = Object.freeze({ ...p, fromTile: [30, 30], steps: [[31, 31]], tile: [40, 40], snapped: false, lastTick: 106 });
  remotes.update([p]);
  assert.deepEqual(tracker.calls.at(-1), ["snap", [40, 40], 512]);
  // Standing, the record's facing turns it.
  p = Object.freeze({ ...p, facing: 1536, lastTick: 107, steps: [], fromTile: [40, 40], snapped: true });
  remotes.update([p], { deltaMs: 16 });
  assert.equal(remotes.get(5).facingAngle, 1536);
}

// --- a player that keeps facing another: the game client's angle, every frame --------------
{
  // OBS (the game's client): atan2(x - target.x, y - target.y) * 1024 / pi, cut to an integer.
  assert.equal(faceAngle([10, 10], [10, 11]), 1024, "north");
  assert.equal(faceAngle([10, 10], [11, 10]), 1536, "east");
  assert.equal(faceAngle([10, 10], [10, 9]), 0, "south");
  assert.equal(faceAngle([10, 10], [9, 10]), 512, "west");
  assert.equal(faceAngle([10, 10], [11, 11]), 1280, "north-east");
  assert.equal(faceAngle([10, 10], [12, 11]), Math.trunc((Math.atan2(-256, -128) * 1024) / Math.PI) & 2047, "not one of eight");
  assert.equal(faceAngle([10, 10], [10.5, 10]), 1536, "between tiles");
  assert.equal(faceAngle([10, 10], [10, 10], 77), 77, "on the same point it keeps its angle");
  assert.equal(faceAngle([10, 10], [10, 10]), null);

  const { remotes, trackers } = setup();
  const leader = player(1, [10, 12]);
  let p = player(2, [10, 10], { face: 1 });
  remotes.update([leader, p], { deltaMs: 16 });
  const tracker = trackers.get("10,10");
  assert.deepEqual(tracker.calls.slice(1), [["interacting", true], ["force", 1024]]);
  // Walking too, every frame.
  p = moved(p, [[11, 10]], { tick: 1 });
  tracker.calls.length = 0;
  remotes.update([leader, p], { deltaMs: 0 });
  assert.deepEqual(tracker.calls, [["walk", 1, [[11, 10]], false], ["interacting", true], ["force", 1024]]);
  // It faces us: our id and where we are drawn.
  p = Object.freeze({ ...p, face: 99 });
  tracker.calls.length = 0;
  remotes.update([leader, p], { deltaMs: 0, ownId: 99, localVisual: [9.5, 10] });
  assert.deepEqual(tracker.calls, [["interacting", true], ["force", 512]]);
  // The faced player gone, or no face any more: once, back to its own facing.
  tracker.calls.length = 0;
  remotes.update([leader, p], { deltaMs: 0 });
  remotes.update([leader, Object.freeze({ ...p, face: null })], { deltaMs: 0 });
  assert.deepEqual(tracker.calls, [["interacting", false], ["force", null]]);

  // The local player's angle to the player it follows, by the entries drawn last.
  assert.equal(localFaceAngle([10, 10], 5), null, "nobody to face");
  setLocalFaceTarget(() => 1);
  assert.equal(localFaceAngle([10, 10], 5), 1024);
  assert.equal(localFaceAngle([10, 12], 5), 5, "on the same point");
  setLocalFaceTarget(() => 42);
  assert.equal(localFaceAngle([10, 10], 5), null, "not in the lobby");
  setLocalFaceTarget(null);
  assert.equal(localFaceAngle([10, 10], 5), null);
}

// --- at most REMOTE_DRAW_MAX drawn, the nearest; rigs built a few a frame -----------------
{
  assert.equal(REMOTE_DRAW_MAX, 30);
  const { remotes, built } = setup();
  const crowd = Array.from({ length: 49 }, (_, i) => player(i + 1, [i % 7, Math.floor(i / 7)]));
  let drawn = remotes.update(crowd, { localPosition: [0, 0] });
  assert.equal(drawn.length, RIG_BUILDS_PER_FRAME, "a crowd arrives over a few frames");
  for (let frame = 0; frame < 20; frame++) drawn = remotes.update(crowd, { localPosition: [0, 0] });
  assert.equal(drawn.length, 30);
  assert.equal(built.length, 30, "only the drawn get rigs");
  const dist = (e) => Math.hypot(e.position[0], e.position[1]);
  const farthestDrawn = Math.max(...drawn.map(dist));
  const nearestHidden = Math.min(...remotes.entries().filter((e) => !drawn.includes(e)).map(dist));
  assert.ok(farthestDrawn <= nearestHidden, "the nearest are drawn");
  assert.equal(remotes.size, 49, "the others are still tracked");
  // The local player walks to the other corner: the set follows.
  for (let frame = 0; frame < 20; frame++) drawn = remotes.update(crowd, { localPosition: [6, 6] });
  assert.ok(drawn.some((e) => e.id === 49));
  assert.ok(!drawn.some((e) => e.id === 1));
  assert.equal(remotes.hitTestData().length, 30);
}

// --- hysteresis at the edge of the cap: a drawn player stays unless another is 2 tiles nearer ---
{
  assert.equal(DRAW_HYSTERESIS_TILES, 2);
  const { remotes } = setup({ extra: { maxDrawn: 1 } });
  const a = player(1, [10, 10]);
  const b = player(2, [10, 12]);
  remotes.update([a, b], { localPosition: [10, 9] });
  assert.deepEqual(remotes.drawn().map((e) => e.id), [1]);
  // b is now 1 tile nearer than a: a stays.
  remotes.update([player(1, [10, 12], { lastTick: 1 }), player(2, [10, 11], { lastTick: 1 })], { localPosition: [10, 9] });
  assert.deepEqual(remotes.drawn().map((e) => e.id), [1]);
  // b is 2 tiles nearer: b replaces a.
  for (let frame = 0; frame < 2; frame++) remotes.update([player(1, [10, 13], { lastTick: 2 }), player(2, [10, 11], { lastTick: 1 })], { localPosition: [10, 9] });
  assert.deepEqual(remotes.drawn().map((e) => e.id), [2]);
}

// --- the hook ----------------------------------------------------------------------
{
  assert.equal(getRemotePlayersSource(), null);
  const store = { list: () => [] };
  setRemotePlayersSource(store);
  assert.equal(getRemotePlayersSource(), store);
  setRemotePlayersSource({ nope: true });
  assert.equal(getRemotePlayersSource(), null, "a source without list() is none");
  setRemotePlayersSource(store);
  setRemotePlayersSource(null);
  assert.equal(getRemotePlayersSource(), null);
  const { remotes } = setup();
  remotes.update([player(1, [1, 1])]);
  assert.deepEqual(presentedRemotePlayers().map((e) => e.id), [1]);
  remotes.clear();
  assert.deepEqual(presentedRemotePlayers(), []);
  assert.throws(() => createRemotePlayers({}), TypeError);
}

console.log("Lobby remote players passed");
