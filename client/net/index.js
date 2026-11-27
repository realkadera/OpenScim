// Lobby presence over GET /api/ws: the one entry point the application calls.
//
//   const presence = createLobbyPresence({ build });
//   presence.start();
//   presence.players.list()          the other players, each frame
//   presence.session.sendPresence({ tile, steps, run, facing })
//   presence.session.setAppearance(appearance, equipment)
//   presence.chat                    the lobby's public chat (chatStore.js)
//   presence.session.sendChat(text)
//   presence.stop();
//
// Every dependency may be handed in (the tests do); in a browser the
// defaults are the page's own: WebSocket, fetch, Date.now, the timers, and
// the WebSocket address of the page's origin.
import { createNetSession } from "./netSession.js";
import { createRemotePlayersStore } from "./remotePlayersStore.js";
import { createChatStore } from "./chatStore.js";

export * from "./protocol.js";
export * from "./netSession.js";
export * from "./remotePlayersStore.js";
export * from "./chatText.js";
export * from "./chatStore.js";

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
  storage,
  isFriend,
} = {}) {
  const session = createNetSession({ url, WebSocketImpl, fetchImpl, now, setTimeout, clearTimeout, build, random, metaUrl, meUrl });
  const players = createRemotePlayersStore({ maxPlayers });
  const chat = createChatStore({ now, storage, isFriend });
  session.onRoomEvent(players.handle);
  session.onRoomEvent(chat.handle);
  return {
    session,
    players,
    chat,
    start: () => session.start(),
    stop: () => session.stop(),
  };
}
