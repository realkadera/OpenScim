// client/net/remotePlayersStore.js: the other players of the lobby, from the
// room events of the session. Messages are the fixtures', parsed as the
// session parses them.
import assert from "node:assert/strict";

import { parseServerMessage } from "../client/net/protocol.js";
import { createRemotePlayersStore } from "../client/net/remotePlayersStore.js";
import { fixtureBody } from "./net-fakes.mjs";

const message = (body) => {
  const parsed = parseServerMessage(JSON.stringify(body));
  assert.ok(parsed.ok, parsed.reason);
  return { type: "message", msg: parsed.msg };
};
const welcome = (id = 7) => message({ ...fixtureBody("valid", "welcome"), you: { id, name: "Me" } });
const member = (id, tile = [10, 10], name = `Player-${id}`) => ({ id, name, appearance: null, equipment: null, tile, facing: tile ? 0 : null });
const joined = (members) => message({ t: "joined", rid: 1, room: { id: "lobby-1", kind: "lobby", instance: 1 }, members });
const tick = (tickNumber, ...d) => message({ t: "presence_tick", tick: tickNumber, d });
const delta = (id, tile, steps, extra = {}) => ({ id, tile, steps, run: false, facing: 1024, ...extra });

const store = createRemotePlayersStore();
let notified = 0;
const unsubscribe = store.subscribe(() => notified++);
const empty = store.getSnapshot();
assert.equal(empty.size, 0);
assert.deepEqual(store.list(), []);

// The welcome names our id; the joined snapshot from the fixture fills the store.
store.handle(welcome(1));
assert.equal(store.ownId, 1);
assert.equal(notified, 0, "nothing changed");
assert.equal(store.getSnapshot(), empty, "the same snapshot while nothing changes");
store.handle(message(fixtureBody("valid", "joined")));
assert.equal(notified, 1);
const first = store.getSnapshot();
assert.notEqual(first, empty);
assert.equal(store.getSnapshot(), first);
assert.equal(store.list(), store.list(), "list() is kept too");
assert.deepEqual(store.list().map((player) => player.id), [7, 8]);
const p7 = store.getById(7);
assert.equal(p7.name, "Player-0420");
assert.deepEqual(p7.tile, [31, 25]);
assert.equal(p7.facing, 1024);
assert.deepEqual(p7.equipment, { weapon: 4151 });
assert.equal(p7.appearance.torso_kit, 18);
assert.equal(p7.snapped, true, "placed, not walked");
assert.deepEqual(p7.steps, []);
assert.equal(p7.lastTick, null);
assert.ok(Object.isFrozen(p7));
const p8 = store.getById(8);
assert.equal(p8.tile, null);
assert.equal(p8.appearance, null);
assert.equal(store.getById(99), undefined);

// A walk north that chains: from [31, 25] through [31, 26] to [31, 27].
store.handle(message(fixtureBody("valid", "presence-tick.walk-north")));
let walked = store.getById(7);
assert.deepEqual(walked.fromTile, [31, 25]);
assert.deepEqual(walked.steps, [[31, 26], [31, 27]]);
assert.deepEqual(walked.tile, [31, 27]);
assert.equal(walked.snapped, false);
assert.equal(walked.lastTick, 1236);
assert.ok(walked.tile[1] > walked.fromTile[1], "north is +y");
assert.equal(store.getById(8), p8, "an untouched player keeps its object");

// Steps that do not reach the tile: a snap, with nothing to walk.
store.handle(tick(1237, delta(7, [40, 40], [[31, 28], [31, 29]])));
walked = store.getById(7);
assert.equal(walked.snapped, true);
assert.deepEqual(walked.steps, []);
assert.deepEqual(walked.fromTile, [40, 40]);
assert.deepEqual(walked.tile, [40, 40]);
// Steps that do not start next to where the player was: a snap too.
store.handle(tick(1238, delta(7, [45, 45], [[44, 44], [45, 45]])));
assert.equal(store.getById(7).snapped, true);
// No steps and another tile: a teleport, a snap. The same tile: a turn.
store.handle(tick(1239, delta(7, [1, 1], [])));
assert.equal(store.getById(7).snapped, true);
store.handle(tick(1240, delta(7, [1, 1], [], { facing: 0 })));
assert.equal(store.getById(7).snapped, false);
assert.equal(store.getById(7).facing, 0);
// Four merged steps of a run that chain, diagonals included.
store.handle(tick(1241, delta(7, [3, 5], [[2, 2], [2, 3], [3, 4], [3, 5]], { run: true })));
walked = store.getById(7);
assert.equal(walked.snapped, false);
assert.equal(walked.run, true);
assert.equal(walked.steps.length, 4);
// A player without a tile yet is placed by the first move.
store.handle(tick(1242, delta(8, [30, 25], [[30, 25]])));
assert.equal(store.getById(8).snapped, true);
assert.deepEqual(store.getById(8).tile, [30, 25]);

// Our own echo and players we never heard of are left alone.
const before = store.getSnapshot();
const count = notified;
store.handle(tick(1243, delta(1, [5, 5], []), delta(42, [5, 5], [])));
assert.equal(store.getSnapshot(), before);
assert.equal(notified, count);
assert.equal(store.getById(1), undefined);
assert.equal(store.getById(42), undefined);
store.handle(message({ t: "member_join", member: member(1) }));
assert.equal(store.getById(1), undefined, "never ourselves");
// One tick with several deltas is one change.
store.handle(tick(1244, delta(7, [3, 6], [[3, 6]]), delta(8, [30, 26], [[30, 26]])));
assert.equal(notified, count + 1);

// Join, leave, appearance.
store.handle(message({ t: "member_join", member: member(3, null, "<b>Bold</b>") }));
assert.deepEqual(store.list().map((player) => player.id), [3, 7, 8]);
assert.equal(store.getById(3).name, "<b>Bold</b>", "a name is plain text");
store.handle(message(fixtureBody("valid", "appearance-set")));
assert.deepEqual(store.getById(7).equipment, { weapon: 4151 });
assert.deepEqual(store.getById(7).tile, [3, 6], "the look changes, the place stays");
store.handle(message({ ...fixtureBody("valid", "appearance-set"), id: 77 }));
assert.equal(store.getById(77), undefined, "no player from an appearance alone");
store.handle(message(fixtureBody("valid", "member-leave")));
assert.equal(store.getById(7), undefined);
assert.deepEqual(store.list().map((player) => player.id), [3, 8]);
const left = store.getSnapshot();
store.handle(message(fixtureBody("valid", "member-leave")));
assert.equal(store.getSnapshot(), left, "leaving twice changes nothing");
// Other messages change nothing.
for (const name of ["pong", "notice.shutdown", "error.lobby-full"]) store.handle(message(fixtureBody("valid", name)));
store.handle({ type: "something else" });
store.handle(undefined);
assert.equal(store.getSnapshot(), left);

// A joined snapshot replaces the store: someone missing from it is gone.
store.handle(joined([member(8, [30, 26]), member(9)]));
assert.deepEqual(store.list().map((player) => player.id), [8, 9]);
// A reconnect that gets the same id back keeps the players until its joined;
// another id means the server let us go: the room we saw is gone.
store.handle(welcome(1));
assert.equal(store.size, 2);
store.handle(welcome(2));
assert.equal(store.size, 0);
store.handle(joined([member(8), member(9)]));
// A joined listing ourselves leaves us out.
store.handle(joined([member(2), member(8)]));
assert.deepEqual(store.list().map((player) => player.id), [8]);

// Lost: a stop, a close that is not retried, or a grace that ran out.
store.handle({ type: "room_lost", reason: "stopped" });
assert.equal(store.size, 0);
const lost = store.getSnapshot();
store.handle({ type: "room_lost", reason: "stopped" });
assert.equal(store.getSnapshot(), lost);

// At most 49 others.
const crowd = Array.from({ length: 49 }, (unused, i) => member(100 + i));
store.handle(joined(crowd));
assert.equal(store.size, 49);
store.handle(message({ t: "member_join", member: member(500) }));
assert.equal(store.size, 49);
assert.equal(store.getById(500), undefined);
// A known player joining again (a rejoin) is replaced, not refused.
store.handle(message({ t: "member_join", member: member(100, [1, 2]) }));
assert.deepEqual(store.getById(100).tile, [1, 2]);
store.handle(message({ t: "member_leave", id: 101 }));
store.handle(message({ t: "member_join", member: member(500) }));
assert.ok(store.getById(500));
const small = createRemotePlayersStore({ maxPlayers: 2 });
small.handle(joined([member(10), member(11), member(12)]));
assert.deepEqual(small.list().map((player) => player.id), [10, 11]);

// combat: kept on the record, null when not sent; an appearance_set without it keeps the level.
{
  const levels = createRemotePlayersStore();
  levels.handle(welcome(1));
  levels.handle(joined([{ ...member(5), combat: 99 }, member(6)]));
  assert.equal(levels.getById(5).combat, 99);
  assert.equal(levels.getById(6).combat, null);
  const look = fixtureBody("valid", "appearance").appearance;
  levels.handle(message({ t: "appearance_set", id: 6, appearance: look, equipment: {}, combat: 87 }));
  assert.equal(levels.getById(6).combat, 87);
  levels.handle(message({ t: "appearance_set", id: 6, appearance: look, equipment: { weapon: 4151 } }));
  assert.equal(levels.getById(6).combat, 87);
  levels.handle(message({ t: "appearance_set", id: 5, appearance: look, equipment: {}, combat: null }));
  assert.equal(levels.getById(5).combat, null);
}

// clear() and unsubscribe.
const seen = notified;
unsubscribe();
store.clear();
assert.equal(store.size, 0);
assert.equal(notified, seen);
console.log("ok");
