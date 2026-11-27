// The other players in the lobby instance, as the session's room events tell
// them: a snapshot the renderer reads every frame and a React component can
// read through useSyncExternalStore.
//
//   const players = createRemotePlayersStore();
//   session.onRoomEvent(players.handle);
//   players.getSnapshot()   ReadonlyMap id -> RemotePlayer; the same object
//                           until something changes, then a new one
//   players.list()          the same players, sorted by id (also kept until
//                           something changes)
//   players.getById(id)     RemotePlayer or undefined
//   players.subscribe(fn)   fn() after every change; returns unsubscribe
//
// A RemotePlayer (frozen; a change makes a new one):
//   id, name      name is untrusted plain text, 1 to 24 characters
//   appearance    { gender, hair_kit, ..., skin_color } or null, not sent yet
//   equipment     { head?, cape?, ..., ammo? } item ids, or null
//   combat        the combat level, 3 to 126, or null (not sent)
//   tile          [x, y] or null (not placed yet); facing 0..2047 or null
//   face          the id of the player it keeps facing (the leader it
//                 follows; may be our own id), or null
//   run           whether the last move was running
//   fromTile      where the last move started ([x, y] or null)
//   steps         the tiles of the last move, oldest first, ending at tile:
//                 walk fromTile -> steps[0] -> ... -> tile over one tick
//   snapped       true when the last move cannot be walked (its steps do not
//                 lead from fromTile to tile: a gap or a teleport): draw the
//                 player at tile at once. steps is then empty, and fromTile
//                 is tile.
//   lastTick      the server tick of the last move, or null
//
// The own player is never in it, and it holds at most 49 others (an instance
// holds 50). A joined snapshot replaces everything; a room_lost event (a
// stop, a close that is not retried, or a reconnect that took longer than the
// server keeps a dropped player) empties it, and so does a welcome with
// another own id than before.
import { OTHERS_MAX, isAdjacent, tilesEqual } from "./protocol.js";

const EMPTY = Object.freeze([]);

export function createRemotePlayersStore({ maxPlayers = OTHERS_MAX } = {}) {
  let players = new Map();
  let sorted = null;
  let ownId = null;
  const listeners = new Set();

  const placed = (member) =>
    Object.freeze({
      id: member.id,
      name: member.name,
      appearance: member.appearance,
      equipment: member.equipment,
      combat: member.combat ?? null,
      tile: member.tile,
      facing: member.facing,
      face: member.face ?? null,
      run: false,
      fromTile: member.tile,
      steps: EMPTY,
      snapped: true,
      lastTick: null,
    });

  // Does the merged path lead from where the player was to where they are?
  const walkable = (from, steps, tile) => {
    if (!from) return false;
    if (steps.length === 0) return tilesEqual(from, tile);
    if (!isAdjacent(from, steps[0])) return false;
    for (let i = 1; i < steps.length; i++) if (!isAdjacent(steps[i - 1], steps[i])) return false;
    return tilesEqual(steps[steps.length - 1], tile);
  };

  const moved = (player, delta, tick) => {
    const chained = walkable(player.tile, delta.steps, delta.tile);
    return Object.freeze({
      ...player,
      tile: delta.tile,
      facing: delta.facing,
      face: delta.face ?? null,
      run: delta.run,
      fromTile: chained ? player.tile : delta.tile,
      steps: chained ? Object.freeze(delta.steps) : EMPTY,
      snapped: !chained,
      lastTick: tick,
    });
  };

  // Each handler returns the new map, or null when nothing changed.
  const apply = {
    welcome(msg) {
      const before = ownId;
      ownId = msg.you.id;
      // Another id: the server let our old player go, and with it the room we saw.
      if (before !== ownId && players.size) return new Map();
      if (players.has(ownId)) return new Map([...players].filter(([id]) => id !== ownId));
      return null;
    },
    joined(msg) {
      const next = new Map();
      for (const member of msg.members) if (member.id !== ownId && next.size < maxPlayers) next.set(member.id, placed(member));
      return next;
    },
    member_join({ member }) {
      if (member.id === ownId || (!players.has(member.id) && players.size >= maxPlayers)) return null;
      return new Map(players).set(member.id, placed(member));
    },
    member_leave({ id }) {
      if (!players.has(id)) return null;
      const next = new Map(players);
      next.delete(id);
      return next;
    },
    appearance_set({ id, appearance, equipment, combat }) {
      const player = players.get(id);
      if (!player) return null;
      // A server that sends no combat leaves the level as it was.
      return new Map(players).set(id, Object.freeze({ ...player, appearance, equipment, combat: combat === undefined ? player.combat : combat }));
    },
    presence_tick({ tick, d }) {
      let next = null;
      for (const delta of d) {
        const player = (next ?? players).get(delta.id);
        // Our own echo, or someone whose member_join we never had: nothing to move.
        if (delta.id === ownId || !player) continue;
        next ??= new Map(players);
        next.set(delta.id, moved(player, delta, tick));
      }
      return next;
    },
  };

  const publish = (next) => {
    players = next;
    sorted = null;
    for (const listener of [...listeners]) listener();
  };

  // A room event of the session: { type: "message", msg } or { type: "room_lost" }.
  const handle = (event) => {
    if (event?.type === "room_lost") {
      if (players.size) publish(new Map());
      return;
    }
    if (event?.type !== "message") return;
    const next = apply[event.msg.t]?.(event.msg) ?? null;
    if (next) publish(next);
  };

  return {
    handle,
    getSnapshot: () => players,
    list: () => (sorted ??= Object.freeze([...players.values()].sort((a, b) => a.id - b.id))),
    getById: (id) => players.get(id),
    get ownId() {
      return ownId;
    },
    get size() {
      return players.size;
    },
    clear: () => {
      if (players.size) publish(new Map());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
