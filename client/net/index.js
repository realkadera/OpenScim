// Lobby presence over GET /api/ws: the one entry point the application calls.
//
//   const presence = createLobbyPresence({ build });
//   presence.start();
//   presence.players.list()          the other players, each frame
//   presence.session.sendPresence({ tile, steps, run, facing })
//   presence.session.setAppearance(appearance, equipment)
//   presence.stop();
//
// Every dependency may be handed in (the tests do); in a browser the
// defaults are the page's own: WebSocket, fetch, Date.now, the timers, and
// the WebSocket address of the page's origin.
import { createNetSession } from "./netSession.js";
import { createRemotePlayersStore } from "./remotePlayersStore.js";

export * from "./protocol.js";
export * from "./netSession.js";
export * from "./remotePlayersStore.js";

// wss://host/api/ws for an https page, ws://host/api/ws for an http one.
export const lobbySocketUrl = (location) => `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/ws`;

export function createLobbyPresence({
  location = globalThis.location,
  url = location ? lobbySocketUrl(location) : undefined,
  WebSocketImpl = globalThis.WebSocket,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  now = Date.now,
  setTimeout = globalThis.setTimeout.bind(globalThis),
  clearTimeout = globalThis.clearTimeout.bind(globalThis),
  build = "dev",
  random,
  metaUrl,
  meUrl,
  maxPlayers,
} = {}) {
  const session = createNetSession({ url, WebSocketImpl, fetchImpl, now, setTimeout, clearTimeout, build, random, metaUrl, meUrl });
  const players = createRemotePlayersStore({ maxPlayers });
  session.onRoomEvent(players.handle);
  return {
    session,
    players,
    start: () => session.start(),
    stop: () => session.stop(),
  };
}
