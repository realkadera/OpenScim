// Follow, the option on another player in the lobby: the local player walks
// after the leader every tick until it is cancelled. Presentation of the
// network only: the leader is a record of the remote players' store, and the
// follower moves by the click-to-walk path (a target tile each tick).
//
// What Follow does is the game's (OSRS): the follower goes wherever the
// leader goes; clicking to walk anywhere, and putting on or taking off an
// item, cancels it; with Run on the follower walks behind a walking leader
// and runs when the leader runs, with Run off it never runs, and Run can be
// toggled while following. Source: inferred. The wiki page the task names,
// https://oldschool.runescape.wiki/w/Follow, redirects to "Pet" and states
// none of it; this is the game's behaviour as described for the task.
// Cancelled too, as this client needs: when the leader leaves the lobby
// instance (member_leave, or not in the store any more), on leaving the lobby
// and on signing out.

const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const isTile = (tile) => Array.isArray(tile) && tile.length === 2 && Number.isSafeInteger(tile[0]) && Number.isSafeInteger(tile[1]);

// The tile the follower walks to this tick (inferred: the wiki gives no tile
// rule; in the game a follower paths to the tile the leader stood on, one
// tile behind it). The tile the leader stepped from on its last step: the
// step before the last one of its move, or where the move began. When the
// leader has not moved since it was placed, the tile next to the leader on
// the follower's side; where the follower is on that tile or next to the
// leader already, it stays.
export function followDestination(leader, self) {
  const at = leader?.tile;
  if (!isTile(at) || !isTile(self)) return null;
  const steps = Array.isArray(leader.steps) ? leader.steps.filter(isTile) : [];
  const behind = steps.length >= 2 ? steps[steps.length - 2] : steps.length === 1 && isTile(leader.fromTile) ? leader.fromTile : null;
  if (behind && !sameTile(behind, at)) return [behind[0], behind[1]];
  const dx = self[0] - at[0];
  const dy = self[1] - at[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1 && (dx !== 0 || dy !== 0)) return [self[0], self[1]];
  return [at[0] + Math.sign(dx), at[1] + Math.sign(dy)];
}

// Does the follower run this tick? Only with Run on: when the leader runs
// (see the top of the file), and, to catch up, when the tile it walks to is
// more than one step away (`gap`, in tiles) though the leader walks
// (inferred: so a follower that starts far behind closes the gap). Never with
// Run off.
export const followRuns = (runEnabled, leaderRuns, gap = 0) => runEnabled === true && (leaderRuns === true || gap > 1);

// The state of one follower: whom it follows, and why it stopped.
//   const follow = createFollow({ lookup });   lookup(id): the leader's record or undefined
//   follow.start(id); follow.cancel(reason);
//   follow.tick({ inLobby, self, runEnabled, equipment })
//     -> { tile, run } to walk this tick, or null (not following, or just cancelled)
//   follow.leaderId, follow.lastCancel
export function createFollow({ lookup } = {}) {
  let leaderId = null;
  let worn = null; // the equipment, as JSON, at the last tick
  let lastCancel = null;
  const api = {
    start(id) {
      if (!Number.isSafeInteger(id)) return false;
      leaderId = id;
      worn = null;
      lastCancel = null;
      return true;
    },
    cancel(reason = "cancelled") {
      if (leaderId === null) return false;
      leaderId = null;
      worn = null;
      lastCancel = reason;
      return true;
    },
    tick({ inLobby = true, self, runEnabled = false, equipment = null } = {}) {
      if (leaderId === null) return null;
      if (!inLobby) return api.cancel("left the lobby"), null;
      const key = JSON.stringify(equipment ?? {});
      if (worn !== null && key !== worn) return api.cancel("equipment"), null;
      worn = key;
      let leader;
      try {
        leader = lookup?.(leaderId);
      } catch {
        leader = undefined;
      }
      if (!leader || !isTile(leader.tile)) return api.cancel("leader left"), null;
      const tile = followDestination(leader, self);
      if (!tile) return api.cancel("no tile"), null;
      const gap = Math.max(Math.abs(tile[0] - self[0]), Math.abs(tile[1] - self[1]));
      return { tile, run: followRuns(runEnabled, leader.run, gap) };
    },
    get leaderId() {
      return leaderId;
    },
    get lastCancel() {
      return lastCancel;
    },
  };
  return api;
}
