// What the application's bundles call for the lobby's network: one presence
// while the player is signed in and in the lobby, the local player sent after
// every lobby tick, and Follow. Each call is a no-op outside that.
//
//   setLobbyPresenceActive(active)   application.js: signed in, the lobby
//                                    shown, no replay. Creates and starts the
//                                    presence once; stops it when false.
//   lobbyBeforeTick(kind, state)     Grid.js live loop, before advanceTick:
//                                    { tile, ctrlClickOverride } while following
//   lobbyAfterTick(kind, before, after, appearance)
//                                    Grid.js live loop, after advanceTick
//   followRemotePlayer(id)           the menu's "Follow <name>"
//   stopLobbyFollow(reason)          a click to walk
//
// Nothing is created, fetched or connected before setLobbyPresenceActive(true).
import { createLobbyPresence } from "./index.js";
import { STEPS_PER_PRESENCE_MAX, isAdjacent, tilesEqual } from "./protocol.js";
import { createFollow } from "./follow.js";
import { appearanceToWire, equipmentToWire, getRemotePlayersSource, setRemotePlayersSource } from "./remotePlayers.js";

// hello.build of this client, the one place it is set.
export const LOBBY_BUILD = "web";

const isTile = (tile) => Array.isArray(tile) && tile.length === 2 && Number.isSafeInteger(tile[0]) && Number.isSafeInteger(tile[1]);

// The tiles stepped onto this tick, as protocol.js buildPresence takes them:
// none when the tile did not change, else the move's path when it is a walk
// to the tile (at most two steps, each next to the one before), else none.
export function presenceSteps(before, after) {
  const tile = after?.playerPosition;
  if (!isTile(tile)) return [];
  if (isTile(before?.playerPosition) && tilesEqual(before.playerPosition, tile)) return [];
  const path = Array.isArray(after.playerMovementPath) ? after.playerMovementPath : [];
  if (path.length === 0 || path.length > STEPS_PER_PRESENCE_MAX || !path.every(isTile)) return [];
  for (let i = 1; i < path.length; i++) if (!isAdjacent(path[i - 1], path[i])) return [];
  if (!tilesEqual(path[path.length - 1], tile)) return [];
  return path.map(([x, y]) => [x, y]);
}

export function createLobbyLink({ createPresence = createLobbyPresence, build = LOBBY_BUILD, setSource = setRemotePlayersSource, getSource = getRemotePlayersSource } = {}) {
  let presence = null;
  let active = false;
  let sentLook = null;
  let override = null; // the ctrl-click override follow last set
  const follow = createFollow({
    lookup: (id) => {
      const players = getSource();
      return players?.getById?.(id) ?? players?.list().find((player) => player.id === id);
    },
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
        presence ??= createPresence({ build });
        sentLook = null;
        setSource(presence.players);
        presence.start();
      } else {
        follow.cancel("left the lobby");
        if (presence) {
          presence.stop();
          if (getSource() === presence.players) setSource(null);
        }
      }
    },
    get active() {
      return active;
    },
    get presence() {
      return presence;
    },
    follow,
    // Before the tick: the leader's tile, by the click-to-walk path. The
    // ctrl-click override walks where Run is on and the leader walks.
    beforeTick(kind, state) {
      if (follow.leaderId === null) return null;
      const step = follow.tick({
        inLobby: kind === "lobby",
        self: state?.playerPosition,
        runEnabled: state?.isRunEnabled === true,
        equipment: equipmentToWire(state?.playerEquipment),
      });
      if (!step) {
        override = null;
        return null;
      }
      const ctrlClickOverride = state?.isRunEnabled === true && !step.run;
      const changed = override !== ctrlClickOverride;
      override = ctrlClickOverride;
      return { tile: step.tile, ctrlClickOverride, changed };
    },
    // After the tick: the look when it changed, and the tile, steps, run and facing.
    afterTick(kind, before, after, appearance) {
      if (kind !== "lobby") return;
      const equipment = equipmentToWire(after?.playerEquipment);
      if (follow.leaderId !== null) follow.tick({ inLobby: true, self: after?.playerPosition, runEnabled: after?.isRunEnabled === true, equipment });
      if (!presence || !active || !isTile(after?.playerPosition)) return;
      const look = appearanceToWire(appearance);
      const key = JSON.stringify([look, equipment]);
      if (key !== sentLook) {
        sentLook = key;
        quiet(() => presence.session.setAppearance(look, equipment));
      }
      const steps = presenceSteps(before, after);
      quiet(() =>
        presence.session.sendPresence({
          tile: [after.playerPosition[0], after.playerPosition[1]],
          steps,
          run: steps.length > 0 && after.playerIsRunning === true,
          facing: (Number.isSafeInteger(after.playerFacingAngle) ? after.playerFacingAngle : 0) & 2047,
        }),
      );
    },
  };
  return api;
}

export const lobbyLink = createLobbyLink();
export const setLobbyPresenceActive = (active) => lobbyLink.setActive(active);
export const lobbyBeforeTick = (kind, state) => lobbyLink.beforeTick(kind, state);
export const lobbyAfterTick = (kind, before, after, appearance) => lobbyLink.afterTick(kind, before, after, appearance);
export const followRemotePlayer = (id) => lobbyLink.follow.start(id);
export const stopLobbyFollow = (reason = "walk") => lobbyLink.follow.cancel(reason);
