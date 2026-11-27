// What the application's bundles call for the lobby's network: one presence
// while the player is signed in and in the lobby, the local player sent after
// every lobby tick, and Follow. Each call is a no-op outside that.
//
//   setLobbyPresenceActive(active)   application.js: signed in, the lobby
//                                    shown, no replay. Creates the presence
//                                    once and starts it after the next lobby
//                                    tick (look and tile known); stops it
//                                    when false. Its players and its chat
//                                    are the sources of remotePlayers.js and
//                                    lobbyChat.js while it is active.
//   lobbyBeforeTick(kind, state)     Grid.js live loop, before advanceTick:
//                                    { tile } while following; { tile: null }
//                                    once after Follow ends otherwise than by
//                                    a click
//   lobbyAfterTick(kind, before, after, appearance, combat)
//                                    Grid.js live loop, after advanceTick
//   followRemotePlayer(id)           the menu's "Follow <name>"
//   stopLobbyFollow(reason)          a click to walk
//
// Nothing is created, fetched or connected before setLobbyPresenceActive(true).
import { createLobbyPresence } from "./index.js";
import { COMBAT_MAX, COMBAT_MIN, STEPS_PER_PRESENCE_MAX, isAdjacent, tilesEqual } from "./protocol.js";
import { createFollow } from "./follow.js";
import { getArenaCollisionMap, isArenaTileWalkable } from "../engine/arena.js";
import { CollisionFlag } from "../engine/collision.js";
import { appearanceToWire, equipmentToWire, faceAngle, getRemotePlayersSource, setLocalFaceTarget, setRemotePlayersSource } from "./remotePlayers.js";
import { getLobbyChatSource, setLobbyChatSource } from "./lobbyChat.js";

// hello.build of this client, the one place it is set.
export const LOBBY_BUILD = "web";

const isTile = (tile) => Array.isArray(tile) && tile.length === 2 && Number.isSafeInteger(tile[0]) && Number.isSafeInteger(tile[1]);

// The tiles stepped onto this tick, as protocol.js buildPresence takes them:
// none when the tile did not change, else the move's path when it is a walk
// to the tile from the tile before (at most two steps, the first next to the
// tile before, each next to the one before), else none: the others then put
// the player on its tile at once.
export function presenceSteps(before, after) {
  const tile = after?.playerPosition;
  if (!isTile(tile)) return [];
  if (isTile(before?.playerPosition) && tilesEqual(before.playerPosition, tile)) return [];
  const path = Array.isArray(after.playerMovementPath) ? after.playerMovementPath : [];
  if (path.length === 0 || path.length > STEPS_PER_PRESENCE_MAX || !path.every(isTile)) return [];
  if (isTile(before?.playerPosition) && !isAdjacent(before.playerPosition, path[0])) return [];
  for (let i = 1; i < path.length; i++) if (!isAdjacent(path[i - 1], path[i])) return [];
  if (!tilesEqual(path[path.length - 1], tile)) return [];
  return path.map(([x, y]) => [x, y]);
}

// The session's stop reasons that are never retried (netSession.js): after
// one, the presence stays stopped until the page is loaded again.
const FINAL_STOPS = new Set(["replaced", "session_ended", "banned", "version_mismatch"]);

export function createLobbyLink({
  createPresence = createLobbyPresence,
  build = LOBBY_BUILD,
  setSource = setRemotePlayersSource,
  getSource = getRemotePlayersSource,
  setChatSource = setLobbyChatSource,
  getChatSource = getLobbyChatSource,
} = {}) {
  let presence = null;
  let active = false;
  let sentLook = null;
  let following = false; // a step was given since Follow started
  let finalStop = null; // a stop reason of FINAL_STOPS, once seen
  let startPending = false; // active, to be started after the next lobby tick
  const follow = createFollow({
    lookup: (id) => {
      const players = getSource();
      return players?.getById?.(id) ?? players?.list().find((player) => player.id === id);
    },
    // A tile of the scene nobody can stand on: outside its floor, or under an object.
    isBlocked: ([x, y]) => !isArenaTileWalkable(x, y) || getArenaCollisionMap()?.hasFlag(x, y, CollisionFlag.OBJECT | CollisionFlag.FLOOR_BLOCKED) === true,
  });

  const quiet = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  const api = {
    setActive(next) {
      next = next === true;
      if (next === active) return;
      active = next;
      if (active) {
        if (!presence) {
          presence = createPresence({ build });
          // Remember a final stop when it happens (a later stop() says "stopped").
          quiet(() =>
            presence.session.subscribe?.(() => {
              const reason = presence.session.getSnapshot?.().stopReason;
              if (FINAL_STOPS.has(reason)) finalStop = reason;
            }),
          );
          // The leader's member_leave ends Follow, even when the same id joins again at once.
          quiet(() =>
            presence.session.onRoomEvent?.((event) => {
              if (event?.type === "room_lost" || (event?.type === "message" && event.msg?.t === "member_leave" && event.msg.id === follow.leaderId)) follow.cancel("leader left");
            }),
          );
        }
        if (finalStop) return;
        sentLook = null;
        setSource(presence.players);
        setChatSource(presence);
        // Started after the next lobby tick has set the look and the tile, so
        // both go out before join and the others never see us half made.
        startPending = true;
      } else {
        startPending = false;
        follow.cancel("left the lobby");
        if (presence) {
          presence.stop();
          if (getSource() === presence.players) setSource(null);
          if (getChatSource() === presence) setChatSource(null);
        }
      }
    },
    get active() {
      return active;
    },
    get presence() {
      return presence;
    },
    get finalStop() {
      return finalStop;
    },
    follow,
    // Before the tick: the tile to walk to, by the click-to-walk path; the
    // player's own Run setting decides the pace (follow.js). Once, after
    // Follow ends otherwise than by a click: { tile: null } so the player
    // stops where it is; a click sets its own tile.
    beforeTick(kind, state) {
      const step =
        follow.leaderId === null
          ? null
          : follow.tick({
              inLobby: kind === "lobby",
              self: state?.playerPosition,
              equipment: equipmentToWire(state?.playerEquipment),
            });
      if (!step) {
        const stopped = following && kind === "lobby" && follow.lastCancel !== "walk";
        following = false;
        return stopped ? { tile: null } : null;
      }
      following = true;
      return { tile: step.tile };
    },
    // After the tick: the look (and the combat level, from the player's base
    // levels) when it changed, and the tile, steps, run and facing.
    afterTick(kind, before, after, appearance, combat) {
      if (kind !== "lobby") return;
      const equipment = equipmentToWire(after?.playerEquipment);
      if (follow.leaderId !== null) follow.tick({ inLobby: true, self: after?.playerPosition, equipment, observe: false });
      if (!presence || !active || !isTile(after?.playerPosition)) return;
      const look = appearanceToWire(appearance);
      const level = Number.isSafeInteger(combat) && combat >= COMBAT_MIN && combat <= COMBAT_MAX ? combat : undefined;
      const key = JSON.stringify([look, equipment, level ?? null]);
      if (key !== sentLook) {
        sentLook = key;
        quiet(() => presence.session.setAppearance(look, equipment, level));
      }
      const steps = presenceSteps(before, after);
      quiet(() =>
        presence.session.sendPresence({
          tile: [after.playerPosition[0], after.playerPosition[1]],
          steps,
          run: steps.length > 0 && after.playerIsRunning === true,
          facing: (Number.isSafeInteger(after.playerFacingAngle) ? after.playerFacingAngle : 0) & 2047,
          // While following: the leader, for the others to draw us facing it.
          ...(follow.leaderId === null ? null : { face: follow.leaderId }),
        }),
      );
      if (startPending) {
        startPending = false;
        presence.start();
      }
    },
  };
  return api;
}

export const lobbyLink = createLobbyLink();
export const setLobbyPresenceActive = (active) => lobbyLink.setActive(active);
export const lobbyBeforeTick = (kind, state) => lobbyLink.beforeTick(kind, state);
export const lobbyAfterTick = (kind, before, after, appearance, combat) => lobbyLink.afterTick(kind, before, after, appearance, combat);
export const followRemotePlayer = (id) => lobbyLink.follow.start(id);
// The renderer turns the follower to its leader every frame (remotePlayers.js localFaceAngle).
setLocalFaceTarget(() => lobbyLink.follow.leaderId);
// While following: the angle from our tile (`after`) to the leader's, for the engine's facing after each
// tick, so the facing we send, and the one we keep when Follow ends, is the one drawn (the servers that
// copy the game set a follower's target every tick); null when not following or on the leader's tile.
export function lobbyFollowFacing(after) {
  const leader = lobbyLink.follow.leaderTile();
  return leader && isTile(after) ? faceAngle(after, leader) : null;
}
export const stopLobbyFollow = (reason = "walk") => lobbyLink.follow.cancel(reason);
