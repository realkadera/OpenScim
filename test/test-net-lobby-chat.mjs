// client/net/lobbyChat.js: the lobby's chat as the chatbox and the overlay
// read it, with a real session and chat store over a scripted socket.
import assert from "node:assert/strict";

import { createLobbyPresence } from "../client/net/index.js";
import { createLobbyLink } from "../client/net/lobbyLink.js";
import { appearanceToWire } from "../client/net/remotePlayers.js";
import {
  CHAT_VIEW_TABS,
  PUBLIC_CHAT_MODES,
  chatKeyStartsTyping,
  chatboxTabLines,
  setLobbyChatTab,
  clampDraft,
  createChatboxMerge,
  getLobbyChatSnapshot,
  getLobbyChatSource,
  lobbyChatOverheadText,
  sendLobbyChat,
  setLobbyChatDraft,
  setLobbyChatSource,
  subscribeLobbyChat,
} from "../client/net/lobbyChat.js";
import { createClock, fixtureBody } from "./net-fakes.mjs";

// A socket that answers as the server would: welcome, joined, and every chat
// line back to its sender.
function scriptedSocket(welcome) {
  const sent = [];
  class Socket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      Socket.last = this;
      queueMicrotask(() => {
        this.readyState = 1;
        this.onopen?.({});
      });
    }
    reply(msg) {
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(msg) }));
    }
    send(text) {
      const msg = JSON.parse(text);
      sent.push(msg);
      if (msg.t === "hello") this.reply(welcome);
      if (msg.t === "join") this.reply({ t: "joined", rid: msg.rid, room: { id: "lobby-1", kind: "lobby", instance: 1 }, members: [] });
      if (msg.t === "chat") this.reply({ t: "chat", id: welcome.you.id, name: welcome.you.name, text: msg.text, tick: 1 });
    }
    close() {
      this.readyState = 3;
    }
  }
  return { Socket, sent };
}

const fetchImpl = async (url) => ({
  ok: true,
  status: 200,
  json: async () => (String(url).includes("/api/auth/me") ? { user: { id: 1, name: "Tester" } } : { features: { realtime: true } }),
});

async function joinedPresence(welcome = fixtureBody("valid", "welcome")) {
  const clock = createClock();
  const { Socket, sent } = scriptedSocket(welcome);
  const presence = createLobbyPresence({ url: "ws://test/api/ws", WebSocketImpl: Socket, fetchImpl, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, storage: null });
  presence.session.setAppearance(appearanceToWire(), {});
  presence.session.sendPresence({ tile: [30, 22], steps: [], run: false, facing: 0 });
  presence.start();
  for (let i = 0; i < 50 && presence.session.getSnapshot().state !== "joined"; i++) await clock.advance(10);
  assert.equal(presence.session.getSnapshot().state, "joined");
  return { presence, clock, sent, Socket };
}

// Without a source: nothing, and the chatbox stays as it was.
assert.equal(getLobbyChatSource(), null);
assert.deepEqual(getLobbyChatSnapshot(), { available: false, name: null, maxChars: 0, draft: "", lines: [], filter: "on", tab: "all" });
assert.equal(lobbyChatOverheadText(null), null);
assert.deepEqual(sendLobbyChat(), { ok: false, reason: "chat_off" });

{
  const { presence, clock, sent } = await joinedPresence();
  let changes = 0;
  const off = subscribeLobbyChat(() => changes++);
  setLobbyChatSource(presence);
  assert.ok(changes > 0);
  const first = getLobbyChatSnapshot();
  assert.equal(first, getLobbyChatSnapshot(), "the same snapshot until something changes");
  // Signed in: our own name from the welcome, not "Player".
  assert.equal(first.available, true);
  assert.equal(first.name, "Player-0420");
  assert.equal(first.maxChars, 80);

  // The draft is cut at chat_max_chars characters.
  setLobbyChatDraft("x".repeat(90));
  assert.equal(getLobbyChatSnapshot().draft.length, 80);
  setLobbyChatDraft("  ");
  assert.deepEqual(sendLobbyChat(), { ok: false, reason: "empty" });
  assert.equal(getLobbyChatSnapshot().lines.length, 0, "an empty line says nothing");

  // Sent: prepared (capitals), cleared, and back from the server as our line.
  setLobbyChatDraft("hello there");
  const result = sendLobbyChat();
  assert.equal(result.ok, true);
  assert.equal(getLobbyChatSnapshot().draft, "");
  assert.equal(sent.filter((msg) => msg.t === "chat").at(-1).text, "Hello there");
  await clock.advance(1);
  const lines = getLobbyChatSnapshot().lines;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, "public");
  assert.equal(lines[0].speaker, "Player-0420", "our own line under our own name");
  assert.deepEqual(lines[0].segments, [{ text: "Hello there" }]);
  assert.ok(lines[0].key.startsWith("net:"));
  // The same line gives the same entry object.
  setLobbyChatDraft("a");
  assert.equal(getLobbyChatSnapshot().lines[0], lines[0]);

  // Our own text above our head, yellow, then gone after 3 s.
  assert.deepEqual(lobbyChatOverheadText(null, clock.now()), { text: "Hello there", textColor: "#ffff00" });
  assert.equal(lobbyChatOverheadText(null, clock.now() + 3000), null);

  // Too soon again: refused here, a game line, the draft kept.
  setLobbyChatDraft("again");
  const again = sendLobbyChat();
  assert.equal(again.reason, "rate_limited");
  assert.equal(getLobbyChatSnapshot().draft, "again");
  const system = getLobbyChatSnapshot().lines.at(-1);
  assert.equal(system.kind, "game");
  assert.deepEqual(system.segments, [{ text: "You're sending messages too quickly." }]);

  // Another speaker, with an effect: the chatbox shows the text without the
  // prefix, the overlay its colour.
  presence.chat.handle({ type: "message", msg: { t: "chat", id: 9, name: "Other", text: "red:Hi all", tick: 2 } });
  const other = getLobbyChatSnapshot().lines.at(-1);
  assert.equal(other.speaker, "Other");
  assert.deepEqual(other.segments, [{ text: "Hi all" }]);
  assert.deepEqual(lobbyChatOverheadText(9, clock.now()), { text: "Hi all", textColor: "#ff0000" });
  assert.equal(lobbyChatOverheadText(10, clock.now()), null);

  // Left the lobby: nothing again.
  off();
  setLobbyChatSource(null);
  assert.equal(getLobbyChatSnapshot().available, false);
  assert.equal(getLobbyChatSnapshot().lines.length, 0);
  presence.stop();
}

// The welcome with chat off: our name, no input line.
{
  const { presence } = await joinedPresence(fixtureBody("valid", "welcome.chat-off"));
  setLobbyChatSource(presence);
  assert.equal(getLobbyChatSnapshot().available, false);
  assert.equal(getLobbyChatSnapshot().name, "Player-0420");
  setLobbyChatSource(null);
  presence.stop();
}

// lobbyLink sets the source while active and takes it away after.
{
  const fake = { session: { subscribe: () => () => {}, onRoomEvent: () => () => {}, getSnapshot: () => ({}), start() {}, stop() {} }, players: { list: () => [] }, chat: { subscribe: () => () => {} }, stop() {}, start() {} };
  const link = createLobbyLink({ createPresence: () => fake, setSource: () => {}, getSource: () => null });
  link.setActive(true);
  assert.equal(getLobbyChatSource(), fake);
  link.setActive(false);
  assert.equal(getLobbyChatSource(), null);
}

// Keys pressed outside the input line: any printable character, a keybind's too.
{
  const keybinds = { gamePanel: { inventory: "F3" }, camera: { orbitTiltUp: "w", freeformUp: " " }, ui: { closeOverlay: "Escape" }, plugins: { zukSetTimerReset: "Shift+Z", replayUndo: "Ctrl+Y" } };
  const key = (k, extra = {}) => chatKeyStartsTyping({ key: k, ...extra }, keybinds);
  assert.equal(key("h"), true);
  assert.equal(key("H", { shiftKey: true }), true);
  assert.equal(key("7"), true);
  assert.equal(key("?"), true);
  assert.equal(key("w"), true, "a camera key types too");
  assert.equal(key("W"), true);
  assert.equal(key("z"), true);
  assert.equal(key("y"), true, "Ctrl+Y does not bind a plain Y");
  assert.equal(key(" "), false);
  assert.equal(key("Enter"), false);
  assert.equal(key("F3"), false);
  assert.equal(key("h", { ctrlKey: true }), false);
  assert.equal(key("h", { isComposing: true }), false);
  assert.equal(chatKeyStartsTyping({ key: "h" }, undefined), true);
}

assert.equal(clampDraft("a😀b", 2), "a😀");
assert.equal(clampDraft(5, 2), "");

// The chatbox's lines and ours, by time.
{
  let t = 100;
  const merge = createChatboxMerge(() => t);
  const game = [{ key: "1" }];
  assert.equal(merge(game, []), game, "none of ours: the game lines themselves");
  const net = [{ key: "net:1", at: 50 }, { key: "net:2", at: 150 }];
  assert.deepEqual(merge(game, net).map((e) => e.key), ["net:1", "1", "net:2"]);
  assert.equal(merge(game, net), merge(game, net), "the same lists, the same array");
  t = 200;
  const game2 = [...game, { key: "2" }];
  assert.deepEqual(merge(game2, net).map((e) => e.key), ["net:1", "1", "net:2", "2"]);
}

// --- the stones: the tab shown, and the lines it shows ---------------------------------
{
  assert.deepEqual([...CHAT_VIEW_TABS], ["all", "game", "public", "private", "channel", "clan", "trade"]);
  // WIKI (Chat Interface, Public): the menu's entries, in its order.
  assert.deepEqual(PUBLIC_CHAT_MODES.map((entry) => [entry.mode, entry.entry, entry.label]), [["on", "Show standard", "On"], ["friends", "Show friends", "Friends"], ["off", "Show none", "Off"], ["hide", "Hide", "Hide"]]);
  const lines = [{ key: "1", kind: "game" }, { key: "net:1", kind: "public" }, { key: "2" }, { key: "net:2", kind: "game" }];
  const keys = (view) => chatboxTabLines(lines, view).map((entry) => entry.key);
  assert.equal(chatboxTabLines(lines, "all"), lines, "all: the lines themselves");
  assert.deepEqual(keys("game"), ["1", "2", "net:2"], "game: every line that is not a player's, in the order they came");
  assert.deepEqual(keys("public"), ["net:1"]);
  for (const view of ["private", "channel", "clan", "trade"]) assert.deepEqual(keys(view), []);
  assert.equal(chatboxTabLines(lines, "nope"), lines);
  let told = 0;
  const off = subscribeLobbyChat(() => told++);
  assert.equal(setLobbyChatTab("public"), true);
  assert.equal(getLobbyChatSnapshot().tab, "public");
  assert.equal(told, 1);
  assert.equal(setLobbyChatTab("public"), true);
  assert.equal(told, 1, "the same tab tells nobody");
  assert.equal(setLobbyChatTab("loud"), false);
  assert.equal(setLobbyChatTab("all"), true);
  off();
}

console.log("lobbyChat passed");
