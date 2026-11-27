// client/net/chatStore.js: the chatbox lines, the overhead text, the Public
// filter and the block list, fed with the session's room events.
import assert from "node:assert/strict";

import { parseServerMessage } from "../client/net/protocol.js";
import { BLOCKED_MAX, BLOCKED_STORAGE_KEY, CHAT_LOG_MAX, FILTER_STORAGE_KEY, CHAT_SYSTEM_TEXTS, OVERHEAD_MS, createChatStore } from "../client/net/chatStore.js";
import { fixtureBody } from "./net-fakes.mjs";

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, String(value)), items };
}
const message = (body) => {
  const parsed = parseServerMessage(JSON.stringify(body));
  assert.ok(parsed.ok, parsed.reason);
  return { type: "message", msg: parsed.msg };
};
const chatFrom = (id, name, text, tick = 1) => message({ t: "chat", id, name, text, tick });

function setup({ storage = memoryStorage(), isFriend } = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => void (t += ms) };
  const chat = createChatStore({ now: clock.now, storage, isFriend });
  chat.handle(message(fixtureBody("valid", "welcome")));
  chat.handle(message({ t: "joined", room: { id: "lobby-1", kind: "lobby", instance: 1 }, members: [] }));
  return { chat, clock, storage };
}

assert.equal(OVERHEAD_MS, 3000);
assert.equal(CHAT_LOG_MAX, 100);

// --- lines, stable snapshots -------------------------------------------------------
{
  const { chat, clock } = setup();
  let changes = 0;
  chat.subscribe(() => changes++);
  const empty = chat.getSnapshot();
  assert.equal(chat.getSnapshot(), empty, "the same object until something changes");
  assert.deepEqual(empty.lines, []);
  assert.equal(empty.filter, "on");
  chat.handle(message(fixtureBody("valid", "chat")));
  assert.equal(changes, 1);
  const after = chat.getSnapshot();
  assert.notEqual(after, empty);
  assert.equal(chat.getSnapshot(), after);
  const [line] = after.lines;
  assert.deepEqual(line, {
    seq: line.seq,
    kind: "public",
    id: 7,
    name: "Player-0420",
    text: "Selling lobsters",
    display: { colour: "yellow", effect: null, text: "Selling lobsters" },
    tick: 1240,
    at: clock.now(),
    mine: true,
  });
  assert.ok(Object.isFrozen(line) && Object.isFrozen(line.display) && Object.isFrozen(after.lines));
  chat.handle(message(fixtureBody("valid", "chat.effects")));
  assert.deepEqual(chat.getSnapshot().lines[1].display, { colour: "red", effect: "wave", text: "Buying gf" });
  assert.equal(chat.getSnapshot().lines[1].mine, false);
  assert.ok(chat.getSnapshot().lines[1].seq > line.seq);
  // Untrusted text and names are kept as plain strings, exactly.
  for (const text of ["<col=ff0000>red", "<img=1>", "a<br>b", "&lt; & > <"]) {
    chat.handle(chatFrom(9, "<b>&amp;</b>", text));
    assert.equal(chat.getSnapshot().lines.at(-1).text, text);
    assert.equal(chat.getSnapshot().lines.at(-1).name, "<b>&amp;</b>");
    assert.equal(chat.getSnapshot().lines.at(-1).display.text, text);
  }
  // A bounded log: the last CHAT_LOG_MAX lines.
  for (let i = 0; i < 150; i++) chat.handle(chatFrom(8, "Bob", `line ${i}`));
  const lines = chat.getSnapshot().lines;
  assert.equal(lines.length, CHAT_LOG_MAX);
  assert.equal(lines.at(-1).text, "line 149");
  assert.equal(lines[0].text, "line 50");
  // Events that are not chat change nothing.
  const before = chat.getSnapshot();
  chat.handle(message(fixtureBody("valid", "presence-tick")));
  chat.handle({ type: "other" });
  chat.handle(null);
  assert.equal(chat.getSnapshot(), before);
}

// --- system lines --------------------------------------------------------------------
{
  const { chat } = setup();
  for (const name of ["chat-rejected.too-long", "chat-rejected.empty", "chat-rejected.rate-limited", "chat-rejected.chat-off", "chat-rejected.not-joined", "chat-rejected.muted", "chat-rejected.rate-limited-address"]) {
    const body = fixtureBody("valid", name);
    chat.handle(message(body));
    const line = chat.getSnapshot().lines.at(-1);
    assert.equal(line.kind, "system");
    assert.equal(line.reason, body.reason);
    assert.equal(line.text, CHAT_SYSTEM_TEXTS[body.reason]);
  }
  chat.handle(message({ t: "chat_rejected", reason: "muted" }));
  assert.equal(chat.getSnapshot().lines.at(-1).text, "You are muted and cannot talk.");
  chat.handle(message(fixtureBody("valid", "notice.chat-off")));
  assert.equal(chat.getSnapshot().lines.at(-1).text, CHAT_SYSTEM_TEXTS["notice:chat_off"]);
  chat.handle(message(fixtureBody("valid", "notice.chat-on")));
  assert.equal(chat.getSnapshot().lines.at(-1).text, CHAT_SYSTEM_TEXTS["notice:chat_on"]);
  const count = chat.getSnapshot().lines.length;
  chat.handle(message(fixtureBody("valid", "notice.shutdown")));
  assert.equal(chat.getSnapshot().lines.length, count, "other notices are not chat lines");
  assert.equal(chat.addSystemLine("too_long"), true);
  assert.equal(chat.addSystemLine("nonsense"), false);
  assert.equal(chat.getSnapshot().lines.length, count + 1);
}

// --- overhead text -----------------------------------------------------------------
{
  const { chat, clock } = setup();
  assert.equal(chat.overheadFor(8), null);
  chat.handle(chatFrom(8, "Bob", "first"));
  clock.advance(1000);
  chat.handle(chatFrom(8, "Bob", "second"));
  assert.equal(chat.overheadFor(8).text, "second", "the latest line");
  clock.advance(OVERHEAD_MS - 1);
  assert.equal(chat.overheadFor(8).text, "second");
  clock.advance(1);
  assert.equal(chat.overheadFor(8), null, "gone after OVERHEAD_MS");
  chat.handle(chatFrom(8, "Bob", "third"));
  assert.equal(chat.overheadFor(8, clock.now() + OVERHEAD_MS), null, "an explicit time");
  assert.equal(chat.overheadFor(8, clock.now() + 10).text, "third");
  chat.handle(message({ t: "member_leave", id: 8 }));
  assert.equal(chat.overheadFor(8), null, "a player who left");
  chat.handle(chatFrom(7, "Player-0420", "mine"));
  assert.equal(chat.overheadFor(7).text, "mine");
  // Leaving the room clears the log and the overhead text.
  chat.handle({ type: "room_lost", reason: "grace over" });
  assert.deepEqual(chat.getSnapshot().lines, []);
  assert.equal(chat.overheadFor(7), null);
}
{
  // A join of another instance clears it too; the same instance does not.
  const { chat } = setup();
  chat.handle(chatFrom(8, "Bob", "hi"));
  chat.handle(message({ t: "joined", room: { id: "lobby-1", kind: "lobby", instance: 1 }, members: [] }));
  assert.equal(chat.getSnapshot().lines.length, 1);
  chat.handle(message({ t: "joined", room: { id: "lobby-2", kind: "lobby", instance: 2 }, members: [] }));
  assert.equal(chat.getSnapshot().lines.length, 0);
}

// --- the Public filter ---------------------------------------------------------------
{
  const { chat } = setup({ isFriend: (name) => name === "Friend" });
  chat.handle(chatFrom(8, "Bob", "from bob"));
  chat.handle(chatFrom(9, "Friend", "from a friend"));
  chat.handle(chatFrom(7, "Player-0420", "from me"));
  chat.handle(message({ t: "chat_rejected", reason: "empty" }));
  const texts = () => chat.getSnapshot().lines.map((line) => line.text);
  const overheads = () => [8, 9, 7].map((id) => chat.overheadFor(id)?.text ?? null);
  assert.deepEqual(texts(), ["from bob", "from a friend", "from me", CHAT_SYSTEM_TEXTS.empty]);
  assert.deepEqual(overheads(), ["from bob", "from a friend", "from me"]);
  assert.equal(chat.setFilter("friends"), true);
  assert.equal(chat.getSnapshot().filter, "friends");
  assert.deepEqual(texts(), ["from a friend", "from me", CHAT_SYSTEM_TEXTS.empty]);
  assert.deepEqual(overheads(), [null, "from a friend", "from me"]);
  // OBS (the game's client): in friends our own text is still above our head (we count as our own friend).
  chat.setFilter("off");
  assert.deepEqual(texts(), ["from me", CHAT_SYSTEM_TEXTS.empty]);
  // OBS (the game's client): off hides every text above a head, our own too.
  assert.deepEqual(overheads(), [null, null, null]);
  // Hide: nothing public in the chatbox, everything above the heads.
  chat.setFilter("hide");
  assert.deepEqual(texts(), [CHAT_SYSTEM_TEXTS.empty]);
  assert.deepEqual(overheads(), ["from bob", "from a friend", "from me"]);
  const snapshot = chat.getSnapshot();
  assert.equal(chat.setFilter("hide"), true);
  assert.equal(chat.getSnapshot(), snapshot, "the same mode changes nothing");
  assert.equal(chat.setFilter("autochat"), false);
  assert.equal(chat.getSnapshot().filter, "hide");
}
{
  // Without a friends list, friends shows what off does.
  const { chat } = setup();
  chat.handle(chatFrom(8, "Bob", "from bob"));
  chat.setFilter("friends");
  assert.deepEqual(chat.getSnapshot().lines, []);
  assert.equal(chat.overheadFor(8), null);
}

// --- 100 lines of each kind; the mode kept for the next visit ---------------------------
{
  const { chat, storage } = setup();
  chat.handle(message({ t: "chat_rejected", reason: "empty" }));
  for (let i = 0; i < 150; i++) chat.handle(chatFrom(8, "Bob", `line ${i}`));
  const lines = chat.getSnapshot().lines;
  // OBS (the game's client): 100 messages of each type; the game line is not pushed out by public ones.
  assert.equal(lines.length, CHAT_LOG_MAX + 1);
  assert.equal(lines[0].kind, "system");
  assert.equal(lines[1].text, "line 50");
  assert.equal(storage.getItem(FILTER_STORAGE_KEY), null);
  chat.setFilter("hide");
  assert.equal(storage.getItem(FILTER_STORAGE_KEY), "hide");
  assert.equal(createChatStore({ storage }).getSnapshot().filter, "hide", "kept for the next visit");
  storage.setItem(FILTER_STORAGE_KEY, "loud");
  assert.equal(createChatStore({ storage }).getSnapshot().filter, "on", "a stored mode that is none");
  // "Clear history" of the Public stone: the public lines go, the game line stays.
  assert.equal(chat.clearHistory("public"), true);
  assert.deepEqual(chat.getSnapshot().lines.map((line) => line.kind), ["system"]);
  assert.equal(chat.clearHistory("public"), false, "nothing left to clear");
}

// --- the block list ------------------------------------------------------------------
{
  const storage = memoryStorage();
  const { chat } = setup({ storage });
  chat.handle(chatFrom(8, "Bob", "hi"));
  chat.handle(chatFrom(9, "Ann", "hello"));
  assert.equal(chat.block("BOB"), true);
  assert.equal(chat.isBlocked("bob"), true);
  assert.deepEqual(chat.getSnapshot().blocked, ["BOB"]);
  assert.deepEqual(chat.getSnapshot().lines.map((line) => line.name), ["Ann"]);
  assert.equal(chat.overheadFor(8), null);
  assert.equal(chat.overheadFor(9).text, "hello");
  // By name: the same name on another id is blocked too.
  chat.handle(chatFrom(12, "bOb", "new id"));
  assert.deepEqual(chat.getSnapshot().lines.map((line) => line.name), ["Ann"]);
  assert.equal(chat.overheadFor(12), null);
  assert.deepEqual(JSON.parse(storage.getItem(BLOCKED_STORAGE_KEY)), ["BOB"]);
  assert.equal(chat.block("bob"), false, "already blocked");
  assert.equal(chat.block("Player-0420"), false, "not ourselves");
  assert.equal(chat.block(""), false);
  assert.equal(chat.block("x".repeat(25)), false);
  assert.equal(chat.block(7), false);
  // Persisted: a new store reads it back.
  const again = createChatStore({ storage });
  assert.equal(again.isBlocked("Bob"), true);
  assert.equal(chat.unblock("Bob"), true);
  assert.equal(chat.unblock("Bob"), false);
  assert.deepEqual(JSON.parse(storage.getItem(BLOCKED_STORAGE_KEY)), []);
  assert.deepEqual(chat.getSnapshot().lines.map((line) => line.name), ["Bob", "Ann", "bOb"]);
  // The cap.
  for (let i = 0; i < BLOCKED_MAX; i++) assert.equal(chat.block(`name${i}`), true);
  assert.equal(chat.block("one more"), false);
  assert.equal(chat.getSnapshot().blocked.length, BLOCKED_MAX);
  // Leaving the room keeps the block list.
  chat.handle({ type: "room_lost", reason: "stopped" });
  assert.equal(chat.getSnapshot().blocked.length, BLOCKED_MAX);
}
{
  // Broken or hostile storage: an empty list, no throw; a list over the cap is cut.
  assert.deepEqual(createChatStore({ storage: memoryStorage({ [BLOCKED_STORAGE_KEY]: "{not json" }) }).getSnapshot().blocked, []);
  assert.deepEqual(createChatStore({ storage: memoryStorage({ [BLOCKED_STORAGE_KEY]: '{"a":1}' }) }).getSnapshot().blocked, []);
  const mixed = JSON.stringify(["Ann", 7, "", "ann", "x".repeat(25), "<b>"]);
  assert.deepEqual(createChatStore({ storage: memoryStorage({ [BLOCKED_STORAGE_KEY]: mixed }) }).getSnapshot().blocked, ["Ann", "<b>"]);
  const many = JSON.stringify(Array.from({ length: 300 }, (_, i) => `n${i}`));
  assert.equal(createChatStore({ storage: memoryStorage({ [BLOCKED_STORAGE_KEY]: many }) }).getSnapshot().blocked.length, BLOCKED_MAX);
  const throwing = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } };
  const chat = createChatStore({ storage: throwing });
  assert.equal(chat.block("Bob"), true, "kept for the page when storage refuses");
  assert.equal(chat.isBlocked("Bob"), true);
  assert.equal(createChatStore({ storage: null }).block("Bob"), true);
}

console.log("ok: chat store");
