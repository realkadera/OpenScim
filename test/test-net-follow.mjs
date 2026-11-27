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
  assert.deepEqual(followDestination(leader([10, 10]), [14, 14]), [11, 11]);
  // ...and where the follower is next to it already, it stays.
  assert.deepEqual(followDestination(leader([10, 10]), [11, 9]), [11, 9]);
  // On the leader's tile: it stays (players do not block each other).
  assert.deepEqual(followDestination(leader([10, 10]), [10, 10]), [10, 10]);
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
}

// --- one follower: a tile each tick, and every cancel ----------------------------------
{
  const players = new Map([[9, leader([10, 10])]]);
  const follow = createFollow({ lookup: (id) => players.get(id) });
  const tick = (self, more = {}) => follow.tick({ self, runEnabled: true, equipment: {}, ...more });
  assert.equal(tick([10, 5]), null, "not following");
  assert.equal(follow.start("9"), false);
  assert.equal(follow.start(9), true);
  assert.deepEqual(tick([10, 5]), { tile: [10, 9], run: false });
  // Each tick the tile follows the leader.
  players.set(9, leader([10, 11], { fromTile: [10, 10], steps: [[10, 11]] }));
  assert.deepEqual(tick([10, 6]), { tile: [10, 10], run: false });
  players.set(9, leader([10, 13], { fromTile: [10, 11], steps: [[10, 12], [10, 13]], run: true }));
  assert.deepEqual(tick([10, 7]), { tile: [10, 12], run: true });
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
  assert.deepEqual(presenceSteps(state([31, 25]), state([40, 40], [[40, 40]])), [[40, 40]], "a teleport is one step; the receiving store snaps it");
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
  assert.equal(fake.presence.started, 1);
  assert.equal(source, fake.presence.players);
  // After a lobby tick: the look first (snake_case, equipment), then the presence.
  link.afterTick("lobby", before, after, { gender: 0, hairKit: 3, jawKit: 10, torsoKit: 18, armsKit: 26, handsKit: 33, legsKit: 36, feetKit: 42, hairColor: 0, torsoColor: 0, legsColor: 0, feetColor: 0, skinColor: 0 });
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
  const state = { playerPosition: [31, 26], isRunEnabled: true, playerEquipment: {} };
  assert.deepEqual(link.beforeTick("lobby", state), { tile: [31, 29], ctrlClickOverride: true, changed: true }, "Run on, a walking leader: walk");
  assert.deepEqual(link.beforeTick("lobby", state), { tile: [31, 29], ctrlClickOverride: true, changed: false });
  fake.players.set(9, leader([31, 32], { fromTile: [31, 30], steps: [[31, 31], [31, 32]], run: true }));
  assert.deepEqual(link.beforeTick("lobby", state), { tile: [31, 31], ctrlClickOverride: false, changed: true }, "runs when the leader runs");
  assert.deepEqual(link.beforeTick("lobby", { ...state, isRunEnabled: false }), { tile: [31, 31], ctrlClickOverride: false, changed: false }, "Run off: no override, it walks");
  // An item put on between ticks cancels it (the link sees it after the tick).
  link.afterTick("lobby", state, { ...state, playerEquipment: { head: 1 } }, null);
  assert.equal(link.beforeTick("lobby", { ...state, playerEquipment: { head: 1 } }), null);
  assert.equal(link.follow.lastCancel, "equipment");
  // Another scene cancels it.
  link.follow.start(9);
  assert.equal(link.beforeTick("yama", state), null);
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
  assert.equal(fake.presence.started, 2);
  link.afterTick("lobby", after, after, null);
  assert.deepEqual(fake.sent.map(([t]) => t), ["appearance", "presence"]);
  // A source someone else set is left alone on stop.
  const other = { list: () => [] };
  source = other;
  link.setActive(false);
  assert.equal(source, other);
}

console.log("Follow and the lobby link passed");
