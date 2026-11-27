// Follow, the option on another player in the lobby: the local player walks
// after the leader every tick until it is cancelled. Presentation of the
// network only: the leader is a record of the remote players' store, and the
// follower moves by the click-to-walk path (a target tile each tick).
//
// What Follow does is the game's (OSRS): the follower goes wherever the
// leader goes; clicking to walk anywhere, and putting on or taking off an
// item, cancels it. Its own Run setting alone decides its pace, as for any
// walk (the servers that copy the game read nothing of the leader's pace): two
// tiles a tick when Run is on and the way is two tiles or longer, so right
// behind a walking leader it walks and behind a running one it runs; Run can
// be toggled while following. The wiki page the task names,
// https://oldschool.runescape.wiki/w/Follow, redirects to "Pet" and states
// none of it.
// Cancelled too, as this client needs: when the leader leaves the lobby
// instance (member_leave, or not in the store any more), on leaving the lobby
// and on signing out.

const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const isTile = (tile) => Array.isArray(tile) && tile.length === 2 && Number.isSafeInteger(tile[0]) && Number.isSafeInteger(tile[1]);

const distance = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

// The tile the leader stepped from on the last step of its latest move: the
// step before the last one, or where the move began. Null when it did not walk.
export function trailTile(leader) {
  const at = leader?.tile;
  if (!isTile(at)) return null;
  const steps = Array.isArray(leader.steps) ? leader.steps.filter(isTile) : [];
  const behind = steps.length >= 2 ? steps[steps.length - 2] : steps.length === 1 && isTile(leader.fromTile) ? leader.fromTile : null;
  return behind && !sameTile(behind, at) ? [behind[0], behind[1]] : null;
}

// The tile south, north, west or east of the leader that is nearest to the
// follower, in tiles with a diagonal counted as one; among equals the first
// in that order; a blocked tile is never taken (the order, the distance and
// the skipping are those of the Elvarg line's follow routine).
function nearestCardinal(at, self, isBlocked) {
  let best = null;
  let bestGap = Infinity;
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const tile = [at[0] + dx, at[1] + dy];
    if (isBlocked?.(tile)) continue;
    const gap = distance(tile, self);
    if (gap < bestGap) [best, bestGap] = [tile, gap];
  }
  return best;
}

// The tile the follower walks to this tick, or its own tile to stay. The
// rules are those of the open-source servers that copy the game (the Elvarg
// line's follow routine and Lost City's followX/followZ; the wiki gives no
// tile rule):
//   - next to a leader that is standing, it stays;
//   - it walks onto the tile the leader last stepped from (`trail`, kept
//     while the leader stands), so it ends right behind the leader, and stays
//     once it is on it;
//   - with no such tile, or on it already though not behind, or further than
//     a step away with a trail that is not next to the leader: the tile
//     south, north, west or east of the leader nearest to it that is not
//     blocked (so a follower on the leader's own tile steps off it, south).
// `trail` and `moving` default to what the leader's record says alone.
// `isBlocked(tile)`: can nobody stand on the tile? The way to the tile is
// found by the click-to-walk path it is given to.
export function followDestination(leader, self, trail = trailTile(leader), moving = Array.isArray(leader?.steps) && leader.steps.length > 0, isBlocked = null) {
  const at = leader?.tile;
  if (!isTile(at) || !isTile(self)) return null;
  const gap = distance(self, at);
  if (gap === 1 && !moving) return [self[0], self[1]];
  let tile = isTile(trail) && !sameTile(trail, at) ? [trail[0], trail[1]] : null;
  const trails = tile !== null && distance(tile, at) === 1;
  if (trails && sameTile(tile, self)) return tile;
  if (tile === null || sameTile(tile, self) || (gap > 1 && !trails)) tile = nearestCardinal(at, self, isBlocked) ?? tile;
  return tile;
}

// The state of one follower: whom it follows, and why it stopped.
//   const follow = createFollow({ lookup, isBlocked });   lookup(id): the leader's record or undefined;
//                                                        isBlocked(tile): see followDestination
//   follow.start(id); follow.cancel(reason);
//   follow.tick({ inLobby, self, equipment })
//     -> { tile } to walk to this tick, or null (not following, or just cancelled)
//   follow.leaderId, follow.lastCancel
export function createFollow({ lookup, isBlocked = null } = {}) {
  let leaderId = null;
  let worn = null; // the equipment, as JSON, at the last tick
  let lastCancel = null;
  let trail = null; // the tile the leader last stepped from, kept while it stands
  let seen = null; // the leader's record at our last tick (the store makes a new one for every change)
  const api = {
    start(id) {
      if (!Number.isSafeInteger(id)) return false;
      leaderId = id;
      worn = null;
      lastCancel = null;
      trail = null;
      seen = null;
      return true;
    },
    cancel(reason = "cancelled") {
      if (leaderId === null) return false;
      leaderId = null;
      worn = null;
      lastCancel = reason;
      return true;
    },
    // `observe: false` (the check after a tick) leaves the leader's latest move for the next tick to see.
    tick({ inLobby = true, self, equipment = null, observe = true } = {}) {
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
      // A new move of the leader: its trail; placed somewhere without walking: none any more.
      const changed = leader !== seen;
      const moving = changed && seen !== null && Array.isArray(leader.steps) && leader.steps.length > 0;
      if (observe && changed) {
        const behind = trailTile(leader);
        if (behind) trail = behind;
        else if (leader.snapped === true && seen !== null) trail = null;
        seen = leader;
      }
      const tile = followDestination(leader, self, trail ?? (seen === leader ? null : trailTile(leader)), moving, isBlocked);
      if (!tile) return api.cancel("no tile"), null;
      return { tile };
    },
    get leaderId() {
      return leaderId;
    },
    // The leader's tile now, or null (for the follower to face it).
    leaderTile() {
      if (leaderId === null) return null;
      let leader;
      try {
        leader = lookup?.(leaderId);
      } catch {
        leader = undefined;
      }
      return isTile(leader?.tile) ? [leader.tile[0], leader.tile[1]] : null;
    },
    get lastCancel() {
      return lastCancel;
    },
  };
  return api;
}
