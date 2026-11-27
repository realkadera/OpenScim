// The lobby's public chat as the bundles show it: the chatbox's input line
// and lines (Grid.js Chatbox) and the text above the speakers' heads (the
// lobby scene, rendering.js). One source, the presence of lobbyLink.js while
// it is active; nothing without one, and the chatbox is then as before.
//
//   setLobbyChatSource(presence | null)    lobbyLink.js: { session, chat } (index.js)
//   getLobbyChatSource()
//   subscribeLobbyChat(fn), getLobbyChatSnapshot()
//                                          the chatbox, through useSyncExternalStore:
//     available  signed in, in the lobby, the server's chat on: the input line is ours
//     name       our own name (the welcome's), the input line's "<name>: "
//     maxChars   the welcome's chat_max_chars
//     draft      what is typed and not sent yet; kept while the line is away
//     lines      the chatbox entries, oldest first, in the shape of the
//                chatbox's own (Grid.js ChatLogProjection): { key, kind,
//                speaker?, segments: [{ text }] }; the keys start with "net:"
//   setLobbyChatDraft(text)                at most maxChars characters are kept
//   sendLobbyChat()                        Enter: the draft through session.sendChat;
//                                          a refusal of ours becomes a game line
//   chatKeyStartsTyping(event, keybinds)   whether a key pressed outside the
//                                          input line goes to it (a character no
//                                          keybind uses)
//   lobbyChatOverheadText(id, now?)        the text above player id (null: our own)
//                                          as the overlay draws it, or null
//   createChatboxMerge(now?)               the chatbox's lines and ours, in time order
//
// Names and texts are the server's, untrusted plain text: they go into
// segments as text, which the chatbox renders as React text and the
// overlay as textContent, never as markup.
import { chatLength } from "./chatText.js";
import { overheadChatText } from "./chatEffects.js";

let source = null;
let unsubscribe = [];
let draft = "";
let snapshot = null;
const listeners = new Set();
// Entries by line object: the same line gives the same entry, so the
// chatbox's memoised lines are not drawn again.
let entries = new WeakMap();

const notify = () => {
  snapshot = null;
  for (const listener of [...listeners]) listener();
};

export function setLobbyChatSource(next) {
  next = next ?? null;
  if (next === source) return;
  for (const off of unsubscribe) off();
  unsubscribe = [];
  source = next;
  entries = new WeakMap();
  if (source) {
    const on = (target) => target?.subscribe?.(notify);
    unsubscribe = [on(source.session), on(source.chat)].filter((off) => typeof off === "function");
  }
  notify();
}
export const getLobbyChatSource = () => source;

export function subscribeLobbyChat(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY = Object.freeze({ available: false, name: null, maxChars: 0, draft: "", lines: Object.freeze([]), filter: "on", tab: "all" });

// The stone whose lines the chatbox shows, left to right as the game has them.
// OBS (the game's client): one list of messages in the order they came; a tab
// shows those of its types. Here: "game" every line that is not a player's,
// "public" the public lines, "all" both; the others have no lines yet.
export const CHAT_VIEW_TABS = Object.freeze(["all", "game", "public", "private", "channel", "clan", "trade"]);
let tab = "all";
export function setLobbyChatTab(next) {
  if (!CHAT_VIEW_TABS.includes(next)) return false;
  if (next !== tab) {
    tab = next;
    notify();
  }
  return true;
}
// The merged lines of the chatbox (the fight's and ours) that a tab shows.
export function chatboxTabLines(lines, view) {
  if (view === "all" || !CHAT_VIEW_TABS.includes(view)) return lines;
  if (view === "game") return lines.filter((entry) => entry.kind !== "public");
  if (view === "public") return lines.filter((entry) => entry.kind === "public");
  return [];
}
// "Clear history" on the Public stone.
export const clearLobbyChatHistory = (kind = "public") => source?.chat?.clearHistory?.(kind) === true;

function entryOf(line) {
  let entry = entries.get(line);
  if (!entry) {
    entry =
      line.kind === "public"
        ? Object.freeze({ key: `net:${line.seq}`, kind: "public", speaker: line.name, segments: Object.freeze([Object.freeze({ text: line.display.text })]), at: line.at })
        : Object.freeze({ key: `net:${line.seq}`, kind: "game", segments: Object.freeze([Object.freeze({ text: line.text })]), at: line.at });
    entries.set(line, entry);
  }
  return entry;
}

export function getLobbyChatSnapshot() {
  if (snapshot) return snapshot;
  if (!source) return (snapshot = tab === "all" ? EMPTY : Object.freeze({ ...EMPTY, tab }));
  const session = source.session?.getSnapshot?.() ?? null;
  const lines = source.chat?.getSnapshot?.().lines ?? [];
  const available = !!session && session.chatEnabled === true && !!session.you && session.state !== "stopped";
  snapshot = Object.freeze({
    available,
    name: session?.you?.name ?? null,
    maxChars: session?.limits?.chat_max_chars ?? 0,
    draft,
    lines: Object.freeze(lines.map(entryOf)),
    // The Public stone's mode: "on" | "friends" | "off" | "hide".
    filter: source.chat?.getSnapshot?.().filter ?? "on",
    tab,
  });
  return snapshot;
}

// The Public stone: its modes in the order of the game's menu, each with the
// menu's entry, the stone's label and the label's colour. WIKI (Chat
// Interface, Public): the entries. inferred: the labels' colours, but "On",
// which is the chatbox's own green.
export const PUBLIC_CHAT_MODES = Object.freeze([
  Object.freeze({ mode: "on", entry: "Show standard", label: "On", colour: "#0dc10d" }),
  Object.freeze({ mode: "friends", entry: "Show friends", label: "Friends", colour: "#ffff00" }),
  Object.freeze({ mode: "off", entry: "Show none", label: "Off", colour: "#ff0000" }),
  Object.freeze({ mode: "hide", entry: "Hide", label: "Hide", colour: "#00ffff" }),
]);
export const setLobbyChatFilter = (mode) => source?.chat?.setFilter?.(mode) === true;

// The first maxChars characters (Unicode scalar values, as the server
// counts); the game takes no more than that on the input line.
export function clampDraft(text, maxChars) {
  if (typeof text !== "string") return "";
  if (!(maxChars > 0) || chatLength(text) <= maxChars) return text;
  return [...text].slice(0, maxChars).join("");
}

export function setLobbyChatDraft(text) {
  const next = clampDraft(text, getLobbyChatSnapshot().maxChars);
  if (next === draft) return;
  draft = next;
  notify();
}

// { ok, reason?, text? } as session.sendChat answers. An empty line is not
// sent and says nothing (the game ignores Enter on an empty input line);
// any other refusal shows as a game line of the chatbox. The draft is
// cleared once sent and kept when refused, to be sent again.
export function sendLobbyChat() {
  if (!source || !getLobbyChatSnapshot().available) return { ok: false, reason: "chat_off" };
  if (draft.trim() === "") return { ok: false, reason: "empty" };
  let result;
  try {
    result = source.session.sendChat(draft);
  } catch {
    result = { ok: false, reason: "not_sent" };
  }
  if (result?.ok) setLobbyChatDraft("");
  else if (result?.reason !== "empty") source.chat?.addSystemLine?.(result?.reason ?? "not_sent");
  return result;
}

// Whether a key pressed with focus outside any field types into the input
// line: one printable character, no Ctrl, Alt or Meta. Space never starts a
// line. As in the game, where every letter typed goes to the chat: a letter a
// keybind also uses (W, A, S, D of the camera, a plugin's X) types too while
// the lobby's chat is there (the maintainer's, 2026-11-27; it kept its
// binding before, and the first letter of a line was lost).
export function chatKeyStartsTyping(event) {
  if (!event || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return false;
  const key = event.key;
  return typeof key === "string" && [...key].length === 1 && !/\s/u.test(key) && !/\p{C}/u.test(key);
}

// The text above player id (null: our own) now, as the overlay's
// overheadTexts take it ({ text, textColor, segments?, transform?,
// clipPath? }), or null: none, past its time, or filtered out.
export function lobbyChatOverheadText(id, now = Date.now()) {
  if (!source?.chat) return null;
  const own = id === null;
  if (own) id = source.session?.getSnapshot?.().you?.id ?? null;
  if (id === null || id === undefined) return null;
  const line = source.chat.overheadFor(id, now);
  if (!line) return null;
  return overheadChatText(line.display, now - line.at, now);
}

// The chatbox shows two kinds of lines: the fight's game messages, which
// follow its replay (Grid.js ChatLogProjection), and ours, which follow the
// clock. A game line is placed by when it was first shown, ours by when it
// came; a game line and one of ours at the same moment, the game line first.
// The merge returns the game lines themselves when there are none of ours.
export function createChatboxMerge(now = Date.now) {
  const seen = new Map();
  let lastGame = null, lastNet = null, last = null;
  return (game, net) => {
    if (!net || net.length === 0) return game;
    if (game === lastGame && net === lastNet) return last;
    const t = now();
    const keys = new Set();
    for (const entry of game) {
      keys.add(entry.key);
      if (!seen.has(entry.key)) seen.set(entry.key, t);
    }
    for (const key of seen.keys()) if (!keys.has(key)) seen.delete(key);
    const out = [];
    let i = 0, j = 0;
    while (i < game.length || j < net.length) {
      if (j >= net.length || (i < game.length && seen.get(game[i].key) <= net[j].at)) out.push(game[i++]);
      else out.push(net[j++]);
    }
    [lastGame, lastNet, last] = [game, net, out];
    return out;
  };
}
