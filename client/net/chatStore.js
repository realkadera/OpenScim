// The lobby's public chat as this tab shows it: the chatbox lines, the text
// above each speaker's head, the Public filter and the block list. Fed by
// the session's room events, like the remote players store; read by the
// chatbox through getSnapshot/subscribe (useSyncExternalStore) and by the
// renderer through overheadFor, every frame.
//
//   const chat = createChatStore({ now, storage });
//   session.onRoomEvent(chat.handle);
//   chat.getSnapshot()      frozen, the same object until something changes:
//     lines     the chatbox lines to show, oldest first (filter and block
//               list applied): ChatLine | SystemLine
//     filter    "on" | "friends" | "off" | "hide"
//     blocked   the blocked names, as typed, oldest first
//   chat.subscribe(fn)      fn() after every change; returns unsubscribe
//   chat.overheadFor(id, now?)
//                           the ChatLine to draw above player id, or null
//   chat.setFilter(mode)    false for a mode that is not one of the four
//   chat.block(name), chat.unblock(name), chat.isBlocked(name)
//   chat.addSystemLine(reason)
//                           a line of ours for a refusal (the session's own
//                           sendChat refusals, or the server's)
//   chat.clear()            the log and the overhead text; not the block list
//
// ChatLine (frozen): { seq, kind: "public", id, name, text, display, tick,
//   at, mine }. name and text are the server's, untrusted plain text, shown
//   as received: never through a markup or game tag parser. display is
//   parseChatEffects(text): { colour, effect, pattern?, text }.
// SystemLine (frozen): { seq, kind: "system", reason, text, at }.
//
// Player ids belong to one connection, so the block list is by name,
// compared case-insensitively, kept in storage under BLOCKED_STORAGE_KEY.
// Leaving the room (room_lost, or a join of another instance) clears the
// log and the overhead text.
import { NOTICE_CHAT_OFF, NOTICE_CHAT_ON, NAME_MAX_CHARS } from "./protocol.js";
import { parseChatEffects } from "./chatText.js";

// The chatbox keeps the last 100 lines (inferred: OSRS's chatbox scrolls
// back about this far; none of it is stored anywhere).
export const CHAT_LOG_MAX = 100;
// inferred: overhead chat lasts 150 client ticks of 20 ms, 3 seconds (the
// commonly known OSRS overhead text duration; the wiki does not say).
export const OVERHEAD_MS = 3000;
export const BLOCKED_STORAGE_KEY = "openscim.chat.blocked";
export const BLOCKED_MAX = 200;
// WIKI (Chat Interface, Public tab): "Show standard", "Show friends",
// "Show none", "Hide". "Hide ... will filter all public messages from the
// chat panel but will allow public messages above players' heads"; "Show
// none ... will cease the display of all public messages on the screen".
// Without a friends list, "friends" shows what "off" does.
export const CHAT_FILTERS = Object.freeze(["on", "friends", "off", "hide"]);

// Ours, not the game's: the lines shown for a refusal or a notice. Plain text.
export const CHAT_SYSTEM_TEXTS = Object.freeze({
  too_long: "That message is too long.",
  empty: "You can't send an empty message.",
  rate_limited: "You're sending messages too quickly.",
  chat_off: "Public chat is switched off.",
  not_joined: "You are not in a lobby.",
  muted: "You are muted and cannot talk.",
  not_sent: "Your message could not be sent.",
  [`notice:${NOTICE_CHAT_OFF}`]: "Public chat has been switched off.",
  [`notice:${NOTICE_CHAT_ON}`]: "Public chat has been switched back on.",
});

const nameKey = (name) => name.toLowerCase();
const isName = (name) => typeof name === "string" && name.length > 0 && [...name].length <= NAME_MAX_CHARS;

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createChatStore({ now = Date.now, storage = defaultStorage(), isFriend = () => false } = {}) {
  let entries = [];
  let seq = 0;
  let filter = "on";
  let ownId = null, ownName = null;
  let roomId = null;
  let overhead = new Map(); // speaker id -> ChatLine
  let blocked = loadBlocked();
  let snapshot = null;
  const listeners = new Set();

  function loadBlocked() {
    try {
      const list = JSON.parse(storage?.getItem(BLOCKED_STORAGE_KEY) ?? "[]");
      if (!Array.isArray(list)) return [];
      const seen = new Set(), out = [];
      for (const name of list) if (isName(name) && !seen.has(nameKey(name)) && out.length < BLOCKED_MAX) seen.add(nameKey(name)), out.push(name);
      return out;
    } catch {
      return [];
    }
  }
  const saveBlocked = () => {
    try {
      storage?.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(blocked));
    } catch {
      // full or refused storage: the list holds for this page only
    }
  };
  const blockedSet = () => new Set(blocked.map(nameKey));

  // Whether a public line shows, in the chatbox or above the head. Our own
  // lines always show above our head and in the chatbox unless hidden
  // (inferred: the game never filters your own public message out).
  const shows = (line, where, blockedNames = blockedSet()) => {
    if (line.mine) return where === "overhead" || filter !== "hide";
    if (blockedNames.has(nameKey(line.name))) return false;
    if (filter === "on") return true;
    if (filter === "hide") return where === "overhead";
    if (filter === "friends") return isFriend(line.name) === true;
    return false;
  };

  const publish = () => {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  };
  const push = (entry) => {
    entries.push(entry);
    if (entries.length > CHAT_LOG_MAX) entries = entries.slice(entries.length - CHAT_LOG_MAX);
    publish();
  };
  const system = (key, reason) => {
    const text = CHAT_SYSTEM_TEXTS[key];
    if (!text) return false;
    push(Object.freeze({ seq: ++seq, kind: "system", reason, text, at: now() }));
    return true;
  };
  const clear = () => {
    if (!entries.length && !overhead.size) return;
    entries = [];
    overhead = new Map();
    publish();
  };

  const apply = {
    welcome(msg) {
      if (ownId !== null && ownId !== msg.you.id) clear();
      ownId = msg.you.id;
      ownName = msg.you.name;
    },
    joined(msg) {
      if (roomId !== null && roomId !== msg.room.id) clear();
      roomId = msg.room.id;
    },
    member_leave(msg) {
      if (overhead.delete(msg.id)) publish();
    },
    chat(msg) {
      const line = Object.freeze({
        seq: ++seq,
        kind: "public",
        id: msg.id,
        name: msg.name,
        text: msg.text,
        display: Object.freeze(parseChatEffects(msg.text)),
        tick: msg.tick,
        at: now(),
        mine: msg.id === ownId,
      });
      overhead.set(msg.id, line);
      push(line);
    },
    chat_rejected(msg) {
      system(msg.reason, msg.reason);
    },
    notice(msg) {
      system(`notice:${msg.kind}`, msg.kind);
    },
  };

  const handle = (event) => {
    if (event?.type === "room_lost") {
      roomId = null;
      clear();
      return;
    }
    if (event?.type === "message") apply[event.msg?.t]?.(event.msg);
  };

  return {
    handle,
    getSnapshot() {
      if (snapshot) return snapshot;
      const names = blockedSet();
      snapshot = Object.freeze({
        lines: Object.freeze(entries.filter((entry) => entry.kind === "system" || shows(entry, "chatbox", names))),
        filter,
        blocked: Object.freeze([...blocked]),
      });
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    overheadFor(id, at = now()) {
      const line = overhead.get(id);
      if (!line || at - line.at >= OVERHEAD_MS || at < line.at) return null;
      return shows(line, "overhead") ? line : null;
    },
    setFilter(mode) {
      if (!CHAT_FILTERS.includes(mode)) return false;
      if (mode !== filter) {
        filter = mode;
        publish();
      }
      return true;
    },
    // False for a name that is not a name, our own, one already blocked, or
    // a full list.
    block(name) {
      if (!isName(name) || (ownName !== null && nameKey(name) === nameKey(ownName))) return false;
      if (blockedSet().has(nameKey(name)) || blocked.length >= BLOCKED_MAX) return false;
      blocked = [...blocked, name];
      saveBlocked();
      publish();
      return true;
    },
    unblock(name) {
      if (!isName(name)) return false;
      const next = blocked.filter((entry) => nameKey(entry) !== nameKey(name));
      if (next.length === blocked.length) return false;
      blocked = next;
      saveBlocked();
      publish();
      return true;
    },
    isBlocked: (name) => isName(name) && blockedSet().has(nameKey(name)),
    addSystemLine: (reason) => system(reason, reason),
    clear,
  };
}
