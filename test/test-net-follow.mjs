// client/net/follow.js and client/net/lobbyLink.js with a fake presence: the
// tile Follow walks to each tick, when it runs, every way it is cancelled,
// and what the lobby sends after a tick (and that nothing exists before it
// is made active).
import assert from "node:assert/strict";

import { createFollow, followDestination, followRuns } from "../client/net/follow.js";
import { LOBBY_BUILD, createLobbyLink, presenceSteps } from "../client/net/lobbyLink.js";

const leader = (tile, more = {}) => ({ id: 9, name: "Leader", tile, fromTile: tile, steps: [], run: false, snapped: true, ...more });

// --- the tile: the one the leader stepped from, or next to it ---------------------------
{
  // Walked north one tile: the tile it left.
  assert.deepEqual(followDestination(leader([10, 11], { fromTile: [10, 10], steps: [[10, 11]] }), [10, 5]), [10, 10]);
  // Ran two tiles: the tile of its last step, one behind it, not where the run began.
  assert.deepEqual(followDestination(leader([10, 12], { fromTile: [10, 10], steps: [[10, 11], [10, 12]], run: true }), [10, 5]), [10, 11]);
  // Standing since it came (snapped, no steps): next to it on the follower's side...
  assert.deepEqual(followDestination(leader([10, 10]), [10, 5]), [10, 9]);
  assert.deepEqual(followDestination(leader([10, 10]), [14, 14]), [11, 10], "west, east, south or north of it, never a corner");
  // ...and where the follower is next to it already, it stays.
  assert.deepEqual(followDestination(leader([10, 10]), [11, 9]), [11, 9]);
  // On the leader's tile: it steps off, west first.
  assert.deepEqual(followDestination(leader([10, 10]), [10, 10]), [9, 10]);
  // Next to a leader that walks on, it takes the tile the leader left; a trail remembered while the leader stands
  // is still the tile (it ends right behind, not beside).
  assert.deepEqual(followDestination(leader([10, 12], { fromTile: [10, 11], steps: [[10, 12]] }), [11, 11]), [10, 11]);
  assert.deepEqual(followDestination(leader([10, 12]), [10, 8], [10, 11], false), [10, 11]);
  // After the leader stopped, the tile it left stays the tile (it trails).
  assert.deepEqual(followDestination(leader([10, 11], { fromTile: [10, 10], steps: [[10, 11]] }), [10, 10]), [10, 10]);
  for (const junk of [null, {}, leader(null), leader("x")]) assert.equal(followDestination(junk, [1, 1]), null);
  assert.equal(followDestination(leader([1, 1]), null), null);
}

// --- run: only with Run on, and only when the leader runs ------------------------------
{
  assert.equal(followRuns(true, true), true);
  assert.equal(followRuns(true, false), false, "walks behind a walking leader");
  assert.equal(followRuns(false, true), false, "never runs with Run off");
  assert.equal(followRuns(false, false), false);
  // More than one step from its tile behind a walking leader: runs to catch up, with Run on only.
  assert.equal(followRuns(true, false, 1), false, "one step behind: walks");
  assert.equal(followRuns(true, false, 2), true, "further: runs to catch up");
  assert.equal(followRuns(false, false, 5), false, "never with Run off");
  assert.equal(followRuns(false, true, 5), false);
}

// --- one follower: a tile each tick, and every cancel ----------------------------------
{
  const players = new Map([[9, leader([10, 10])]]);
  const follow = createFollow({ lookup: (id) => players.get(id) });
  const tick = (self, more = {}) => follow.tick({ self, runEnabled: true, equipment: {}, ...more });
  assert.equal(tick([10, 5]), null, "not following");
  assert.equal(follow.start("9"), false);
  assert.equal(follow.start(9), true);
  // Four tiles behind a standing leader, Run on: it runs to catch up; Run off, it walks.
  assert.deepEqual(tick([10, 5]), { tile: [10, 9], run: true });
  assert.deepEqual(tick([10, 5], { runEnabled: false }), { tile: [10, 9], run: false });
  // Each tick the tile follows the leader; one step behind a walking leader it walks.
  players.set(9, leader([10, 11], { fromTile: [10, 10], steps: [[10, 11]] }));
  assert.deepEqual(tick([10, 9]), { tile: [10, 10], run: false });
  assert.deepEqual(tick([10, 6]), { tile: [10, 10], run: true }, "far behind: catches up");
  players.set(9, leader([10, 13], { fromTile: [10, 11], steps: [[10, 12], [10, 13]], run: true }));
  assert.deepEqual(tick([10, 11]), { tile: [10, 12], run: true }, "the leader runs");
  // Run toggled off while following: still following, walking.
  assert.deepEqual(tick([10, 8], { runEnabled: false }), { tile: [10, 12], run: false });
  assert.equal(follow.leaderId, 9);
  // A walk cancels it.
  assert.equal(follow.cancel("walk"), true);
  assert.equal(tick([10, 8]), null);
  assert.equal(follow.lastCancel, "walk");
  assert.equal(follow.cancel("walk"), false, "nothing to cancel");
  // Putting on or taking off an item cancels it.
  follow.start(9);
  assert.ok(tick([10, 8], { equipment: { weapon: 1 } }));
  assert.ok(tick([10, 8], { equipment: { weapon: 1 } }));
  assert.equal(tick([10, 8], { equipment: { weapon: 1, head: 2 } }), null);
  assert.equal(follow.lastCancel, "equipment");
  follow.start(9);
  assert.ok(tick([10, 8], { equipment: { weapon: 1 } }));
  assert.equal(tick([10, 8], { equipment: {} }), null);
  assert.equal(follow.lastCancel, "equipment");
  // The leader leaves the instance (member_leave, or the store emptied).
  follow.start(9);
  assert.ok(tick([10, 8]));
  players.delete(9);
  assert.equal(tick([10, 8]), null);
  assert.equal(follow.lastCancel, "leader left");
  // Leaving the lobby.
  players.set(9, leader([10, 10]));
  follow.start(9);
  assert.equal(tick([10, 8], { inLobby: false }), null);
  assert.equal(follow.lastCancel, "left the lobby");
  // A lookup that throws is a leader gone.
  const broken = createFollow({
    lookup: () => {
      throw new Error("x");
    },
  });
  broken.start(1);
  assert.equal(broken.tick({ self: [1, 1] }), null);
  assert.equal(broken.lastCancel, "leader left");
}

// --- the steps sent after a tick ---------------------------------------------------
{
  const state = (tile, path = []) => ({ playerPosition: tile, playerMovementPath: path });
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 26], [[31, 26]])), [[31, 26]]);
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 27], [[31, 26], [31, 27]])), [[31, 26], [31, 27]]);
  assert.deepEqual(presenceSteps(state([31, 27]), state([31, 27], [[31, 26], [31, 27]])), [], "a path left from an earlier tick");
  assert.deepEqual(presenceSteps(state([31, 25]), state([40, 40], [[40, 40]])), [], "a teleport: no steps, the others snap");
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 28], [[31, 27], [31, 28]])), [], "the first step not next to the tile before");
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 28], [[31, 26], [31, 27], [31, 28]])), [], "more than two");
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 27], [[31, 26], [35, 27]])), [], "not adjacent");
  assert.deepEqual(presenceSteps(state([31, 25]), state([31, 27], [[31, 26]])), [], "does not end on the tile");
  assert.deepEqual(presenceSteps(null, state([31, 26], [[31, 26]])), [[31, 26]]);
  assert.deepEqual(presenceSteps(state([31, 25]), {}), []);
}

// --- the link: inert until active; presence and look after each lobby tick --------------
function fakePresence() {
  const sent = [];
  const players = new Map();
  const presence = {
    started: 0,
    stopped: 0,
    players: { list: () => [...players.values()], getById: (id) => players.get(id) },
    start() {
      presence.started++;
    },
    stop() {
      presence.stopped++;
    },
    session: {
      setAppearance: (appearance, equipment) => sent.push(["appearance", appearance, equipment]),
      sendPresence: (p) => sent.push(["presence", p]),
    },
  };
  return { presence, sent, players };
}
{
  let source = null;
  const made = [];
  const fake = fakePresence();
  const link = createLobbyLink({
    createPresence: (options) => {
      made.push(options);
      return fake.presence;
    },
    setSource: (s) => (source = s),
    getSource: () => source,
  });
  const before = { playerPosition: [31, 25], playerMovementPath: [], playerFacingAngle: 1024, isRunEnabled: true, playerEquipment: { weapon: 4151 } };
  const after = { ...before, playerPosition: [31, 26], playerMovementPath: [[31, 26]], playerIsRunning: false };
  // Inactive (signed out, or not in the lobby): nothing made, nothing sent.
  link.afterTick("lobby", before, after, null);
  link.setActive(false);
  assert.deepEqual(made, []);
  assert.equal(link.presence, null);
  assert.equal(source, null);
  // Active: made once with the build, started, the store is the scene's source.
  link.setActive(true);
  link.setActive(true);
  assert.deepEqual(made, [{ build: LOBBY_BUILD }]);
  assert.equal(LOBBY_BUILD, "web");
  assert.equal(fake.presence.started, 0, "not yet: the look and the tile are not known");
  assert.equal(source, fake.presence.players);
  // After a lobby tick: the look first (snake_case, equipment), then the presence, then the start,
  // so both are set when the session says hello.
  link.afterTick("lobby", before, after, { gender: 0, hairKit: 3, jawKit: 10, torsoKit: 18, armsKit: 26, handsKit: 33, legsKit: 36, feetKit: 42, hairColor: 0, torsoColor: 0, legsColor: 0, feetColor: 0, skinColor: 0 });
  assert.equal(fake.presence.started, 1);
  assert.deepEqual(fake.sent, [
    ["appearance", { gender: 0, hair_kit: 3, jaw_kit: 10, torso_kit: 18, arms_kit: 26, hands_kit: 33, legs_kit: 36, feet_kit: 42, hair_color: 0, torso_color: 0, legs_color: 0, feet_color: 0, skin_color: 0 }, { weapon: 4151 }],
    ["presence", { tile: [31, 26], steps: [[31, 26]], run: false, facing: 1024 }],
  ]);
  // The same look is not sent again; a new item is.
  fake.sent.length = 0;
  link.afterTick("lobby", after, { ...after, playerMovementPath: [[31, 26]] }, null);
  assert.deepEqual(fake.sent.map(([t]) => t), ["appearance", "presence"], "a null appearance is the default look, a change from hair 3");
  fake.sent.length = 0;
  link.afterTick("lobby", after, after, null);
  assert.deepEqual(fake.sent, [["presence", { tile: [31, 26], steps: [], run: false, facing: 1024 }]]);
  assert.equal(fake.presence.started, 1, "started once");
  fake.sent.length = 0;
  link.afterTick("lobby", after, { ...after, playerEquipment: {}, playerFacingAngle: 5000 }, null);
  assert.deepEqual(fake.sent, [["appearance", fake.sent[0][1], {}], ["presence", { tile: [31, 26], steps: [], run: false, facing: 5000 & 2047 }]]);
  // A running step.
  fake.sent.length = 0;
  link.afterTick("lobby", after, { ...after, playerPosition: [31, 28], playerMovementPath: [[31, 27], [31, 28]], playerIsRunning: true, playerEquipment: {} }, null);
  assert.deepEqual(fake.sent.at(-1)[1], { tile: [31, 28], steps: [[31, 27], [31, 28]], run: true, facing: 1024 });
  // Another scene's tick sends nothing.
  fake.sent.length = 0;
  link.afterTick("inferno", after, after, null);
  assert.deepEqual(fake.sent, []);
  // A session that throws (a value the protocol refuses) does not reach the loop.
  fake.presence.session.sendPresence = () => {
    throw new TypeError("refused");
  };
  assert.doesNotThrow(() => link.afterTick("lobby", after, { ...after, playerPosition: [99, 99] }, null));
  assert.doesNotThrow(() => link.afterTick("lobby", after, after, null));

  // Follow through the link: the leader is read from the scene's source.
  fake.players.set(9, leader([31, 30], { fromTile: [31, 29], steps: [[31, 30]], run: false }));
  link.follow.start(9);
  const state = { playerPosition: [31, 28], isRunEnabled: true, playerEquipment: {} };
  // The engine's ctrl-click flag, as Grid.js reads it and sets it when `changed`.
  let flag = false;
  const tick = (s, kind = "lobby") => {
    const result = link.beforeTick(kind, s, flag);
    if (result?.changed) flag = result.ctrlClickOverride;
    return result;
  };
  assert.deepEqual(tick(state), { tile: [31, 29], ctrlClickOverride: true, changed: true }, "Run on, a walking leader one step ahead: walk");
  assert.deepEqual(tick(state), { tile: [31, 29], ctrlClickOverride: true, changed: false });
  // The engine resets its flag (a Run toggle): it is set again.
  flag = false;
  assert.deepEqual(tick(state), { tile: [31, 29], ctrlClickOverride: true, changed: true });
  assert.deepEqual(tick({ ...state, playerPosition: [31, 25] }), { tile: [31, 29], ctrlClickOverride: false, changed: true }, "far behind: runs to catch up");
  assert.deepEqual(tick(state), { tile: [31, 29], ctrlClickOverride: true, changed: true });
  fake.players.set(9, leader([31, 32], { fromTile: [31, 30], steps: [[31, 31], [31, 32]], run: true }));
  assert.deepEqual(tick(state), { tile: [31, 31], ctrlClickOverride: false, changed: true }, "runs when the leader runs");
  assert.deepEqual(tick({ ...state, isRunEnabled: false }), { tile: [31, 31], ctrlClickOverride: false, changed: false }, "Run off: no override, it walks");
  // An item put on between ticks cancels it (the link sees it after the tick): once, a stop with the
  // override off and no tile, so the player does not walk on to the last tile; then nothing.
  fake.players.set(9, leader([31, 30], { fromTile: [31, 29], steps: [[31, 30]], run: false }));
  assert.equal(tick(state).ctrlClickOverride, true);
  link.afterTick("lobby", state, { ...state, playerEquipment: { head: 1 } }, null);
  assert.deepEqual(tick({ ...state, playerEquipment: { head: 1 } }), { tile: null, ctrlClickOverride: false, changed: true });
  assert.equal(flag, false);
  assert.equal(tick({ ...state, playerEquipment: { head: 1 } }), null);
  assert.equal(link.follow.lastCancel, "equipment");
  // The leader gone: the same stop.
  link.follow.start(9);
  assert.ok(tick(state));
  fake.players.delete(9);
  assert.equal(flag, true);
  assert.deepEqual(tick(state), { tile: null, ctrlClickOverride: false, changed: true });
  assert.equal(link.follow.lastCancel, "leader left");
  fake.players.set(9, leader([31, 30], { fromTile: [31, 29], steps: [[31, 30]], run: false }));
  // A click: no stop from the link (the click sets its own tile and override).
  link.follow.start(9);
  assert.ok(tick(state));
  link.follow.cancel("walk");
  assert.equal(tick(state), null);
  // Another scene cancels it, and gives no stop there (a fight's input is its own).
  link.follow.start(9);
  assert.ok(tick(state));
  assert.equal(tick(state, "yama"), null);
  assert.equal(link.follow.lastCancel, "left the lobby");
  // Leaving the lobby or signing out: stopped, the source cleared, Follow cancelled.
  link.follow.start(9);
  link.setActive(false);
  assert.equal(fake.presence.stopped, 1);
  assert.equal(source, null);
  assert.equal(link.follow.leaderId, null);
  // Back in the lobby: the same presence starts again, and the look goes again.
  fake.sent.length = 0;
  fake.presence.session.sendPresence = (p) => fake.sent.push(["presence", p]);
  link.setActive(true);
  assert.equal(made.length, 1);
  link.afterTick("lobby", after, after, null);
  assert.deepEqual(fake.sent.map(([t]) => t), ["appearance", "presence"]);
  assert.equal(fake.presence.started, 2);
  // A source someone else set is left alone on stop.
  const other = { list: () => [] };
  source = other;
  link.setActive(false);
  assert.equal(source, other);
}

// --- the combat level goes with the look, once per change -----------------------------
{
  const fake = fakePresence();
  const calls = [];
  fake.presence.session.setAppearance = (...args) => calls.push(args);
  const link = createLobbyLink({ createPresence: () => fake.presence, setSource: () => {}, getSource: () => null });
  link.setActive(true);
  const at = { playerPosition: [31, 25], playerMovementPath: [], playerFacingAngle: 0, playerEquipment: {} };
  link.afterTick("lobby", at, at, null, 90);
  link.afterTick("lobby", at, at, null, 90);
  link.afterTick("lobby", at, at, null, 91);
  link.afterTick("lobby", at, at, null, 500); // not a level: sent without one
  assert.deepEqual(calls.map((args) => args[2]), [90, 91, undefined]);
}

// --- a final stop (replaced, signed out, banned, version) is not undone by entering the lobby again;
// the leader's member_leave ends Follow even when the same id joins again at once --------------
{
  const fake = fakePresence();
  let snapshot = { stopReason: null };
  const sessionListeners = [];
  const roomListeners = [];
  Object.assign(fake.presence.session, {
    getSnapshot: () => snapshot,
    subscribe: (fn) => sessionListeners.push(fn),
    onRoomEvent: (fn) => roomListeners.push(fn),
  });
  let source = null;
  const link = createLobbyLink({ createPresence: () => fake.presence, setSource: (s) => (source = s), getSource: () => source });
  const here = { playerPosition: [31, 25], playerMovementPath: [], playerFacingAngle: 0, playerEquipment: {} };
  link.setActive(true);
  link.afterTick("lobby", here, here, null);
  assert.equal(fake.presence.started, 1);
  // member_leave of the leader, then member_join of the same id in the same tick.
  fake.players.set(9, leader([31, 30]));
  link.follow.start(9);
  for (const fn of roomListeners) fn({ type: "message", msg: { t: "member_leave", id: 9 } });
  assert.equal(link.follow.leaderId, null);
  assert.equal(link.follow.lastCancel, "leader left");
  // Another member's leave changes nothing; room_lost ends it.
  link.follow.start(9);
  for (const fn of roomListeners) fn({ type: "message", msg: { t: "member_leave", id: 8 } });
  assert.equal(link.follow.leaderId, 9);
  for (const fn of roomListeners) fn({ type: "room_lost", reason: "grace over" });
  assert.equal(link.follow.leaderId, null);
  // A newer tab took over (4009): stopped for good.
  for (const reason of ["stopped", "signed_out"]) {
    snapshot = { stopReason: reason };
    for (const fn of sessionListeners) fn();
  }
  assert.equal(link.finalStop, null, "an ordinary stop is not final");
  snapshot = { stopReason: "replaced" };
  for (const fn of sessionListeners) fn();
  snapshot = { stopReason: "stopped" }; // our own stop() afterwards
  link.setActive(false);
  for (const fn of sessionListeners) fn();
  link.setActive(true);
  link.afterTick("lobby", here, here, null);
  assert.equal(link.finalStop, "replaced");
  assert.equal(fake.presence.started, 1, "not started again until a reload");
}

console.log("Follow and the lobby link passed");
