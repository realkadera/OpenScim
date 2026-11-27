// client/net/netSession.js on a scripted WebSocket, a fake fetch and fake
// timers: no real time passes and no server is involved.
import assert from "node:assert/strict";

import { createLobbyPresence } from "../client/net/index.js";
import {
  BACKOFF_CAP_MS,
  PING_INTERVAL_MS,
  PONG_TIMEOUT_MS,
  ROOM_GRACE_MS,
  SLOW_RETRY_MAX_MS,
  SLOW_RETRY_MIN_MS,
  STABLE_ROOM_MS,
  WELCOME_TIMEOUT_MS,
  createNetSession,
} from "../client/net/netSession.js";
import { createClock, createFakeFetch, createFakeWebSocket, fixtureBody } from "./net-fakes.mjs";

const WELCOME = fixtureBody("valid", "welcome");
const LOOK = fixtureBody("valid", "appearance");
const URL = "wss://openscim.test/api/ws";

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, String(value)), items };
}

function setup({ server = {}, random = () => 0.5, limits, features, storage = memoryStorage() } = {}) {
  const clock = createClock();
  const ws = createFakeWebSocket();
  const http = createFakeFetch(server);
  const presence = createLobbyPresence({
    url: URL,
    WebSocketImpl: ws.FakeWebSocket,
    fetchImpl: http.fetch,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    build: "a4e56ed",
    random,
    storage,
  });
  const { session } = presence;
  const welcome = (id = 7) => ({ ...WELCOME, you: { id, name: "Player-0420" }, limits: { ...WELCOME.limits, ...limits }, features: { ...WELCOME.features, ...features } });
  const joinedFor = (socket, members = []) => {
    const join = socket.messages.find((msg) => msg.t === "join");
    return { t: "joined", rid: join.rid, room: { id: "lobby-1", kind: "lobby", instance: 1 }, members };
  };
  // Through to joined: preflight, socket, hello, welcome, join, joined.
  const connect = async ({ id = 7, members = [] } = {}) => {
    if (session.getSnapshot().state === "idle" || session.getSnapshot().state === "stopped") session.start();
    await clock.settle();
    const socket = ws.last();
    socket.open();
    socket.receive(welcome(id));
    socket.receive(joinedFor(socket, members));
    assert.equal(session.getSnapshot().state, "joined");
    return socket;
  };
  return { clock, ws, http, presence, session, welcome, joinedFor, connect };
}

const other = (id, tile = [20, 20]) => ({ id, name: `Player-${id}`, appearance: null, equipment: null, tile, facing: 0 });
const presenceAt = (x, y, steps = []) => ({ tile: [x, y], steps, run: false, facing: 1024 });

// --- handshake order, join -------------------------------------------------------
{
  const { clock, ws, http, session, welcome, joinedFor } = setup();
  const states = [];
  session.subscribe(() => states.at(-1) !== session.getSnapshot().state && states.push(session.getSnapshot().state));
  assert.equal(session.getSnapshot().state, "idle");
  session.start();
  assert.equal(session.getSnapshot().state, "connecting");
  assert.equal(ws.sockets.length, 0, "the meta and the account are asked first");
  await clock.settle();
  assert.deepEqual(http.calls, ["/api/meta", "/api/auth/me"]);
  assert.equal(ws.sockets.length, 1);
  const socket = ws.last();
  assert.equal(socket.url, URL);
  socket.open();
  assert.deepEqual(socket.messages, [{ t: "hello", proto: 1, build: "a4e56ed", enc: "json" }]);
  // Nothing else goes out before the welcome, whatever is set.
  session.setAppearance(LOOK.appearance, LOOK.equipment);
  assert.equal(session.sendPresence(presenceAt(31, 25)), false);
  assert.deepEqual(socket.types(), ["hello"]);
  socket.receive(welcome());
  assert.equal(session.getSnapshot().state, "open");
  assert.deepEqual(session.getSnapshot().you, { id: 7, name: "Player-0420" });
  assert.equal(session.getSnapshot().limits.max_message_bytes, WELCOME.limits.max_message_bytes, "the welcome's limit, not a constant");
  // The look and the tile go before join, so the others see us whole.
  assert.deepEqual(socket.types(), ["hello", "appearance", "presence", "join"]);
  assert.deepEqual(socket.messages[1], { t: "appearance", ...LOOK, t: "appearance" });
  assert.deepEqual(socket.messages[2], { t: "presence", tile: [31, 25], steps: [], run: false, facing: 1024 });
  assert.deepEqual(socket.messages[3].room, { kind: "lobby" });
  assert.ok(Number.isInteger(socket.messages[3].rid));
  socket.receive(joinedFor(socket, [other(8)]));
  assert.equal(session.getSnapshot().state, "joined");
  assert.deepEqual(session.getSnapshot().room, { id: "lobby-1", kind: "lobby", instance: 1 });
  assert.deepEqual(states, ["connecting", "open", "joined"]);
  // A second welcome on the same socket is ignored.
  socket.receive(welcome(99));
  assert.equal(session.getSnapshot().you.id, 7);
  session.stop();
}

// --- replay after a reconnect, the players kept through it ---------------------------
{
  const { clock, ws, presence, session, welcome, joinedFor, connect } = setup();
  session.setAppearance(LOOK.appearance, LOOK.equipment);
  const first = await connect({ members: [other(8)] });
  await clock.advance(1000);
  session.sendPresence(presenceAt(31, 26, [[31, 26]]));
  assert.deepEqual(first.messages.at(-1).tile, [31, 26]);
  assert.equal(presence.players.size, 1);
  first.serverClose(1006);
  assert.equal(session.getSnapshot().state, "waiting");
  assert.ok(session.getSnapshot().retryInMs >= 500 && session.getSnapshot().retryInMs <= 1000);
  assert.equal(presence.players.size, 1, "kept while the server keeps us too");
  await clock.advance(1000);
  assert.equal(ws.sockets.length, 2);
  const second = ws.last();
  second.open();
  second.receive(welcome(7));
  assert.deepEqual(second.types(), ["hello", "appearance", "presence", "join"], "the look and the last presence again");
  assert.deepEqual(second.messages[2].tile, [31, 26]);
  assert.equal(presence.players.size, 1, "the same id: still the same room");
  second.receive(joinedFor(second, [other(9)]));
  assert.deepEqual(presence.players.list().map((player) => player.id), [9], "the joined snapshot replaces the store");
  assert.equal(session.getSnapshot().connectAttempts, 2);

  // Dropped and not back in time: the room is gone after the grace.
  second.serverClose(1006);
  await clock.advance(ROOM_GRACE_MS - 1);
  assert.equal(presence.players.size, 1);
  // (the retries meanwhile do not get through)
  for (const socket of ws.sockets.slice(2)) socket.serverClose(1006);
  await clock.advance(1);
  assert.equal(presence.players.size, 0);
  session.stop();
}

// --- presence: de-duplicated, at most one a tick, latest wins ------------------------------------
{
  const { clock, session, connect } = setup();
  const socket = await connect();
  const presences = () => socket.messages.filter((msg) => msg.t === "presence");
  assert.equal(presences().length, 0, "none set, none sent");
  assert.equal(session.sendPresence(presenceAt(10, 10)), true);
  assert.equal(presences().length, 1);
  session.sendPresence(presenceAt(10, 10));
  await clock.advance(5000);
  assert.equal(presences().length, 1, "the same presence is not sent again");
  session.sendPresence(presenceAt(10, 11, [[10, 11]]));
  assert.equal(presences().length, 2);
  // Three ticks' worth within one server tick: only the last goes, a tick after the one before.
  await clock.advance(100);
  session.sendPresence(presenceAt(10, 12, [[10, 12]]));
  session.sendPresence(presenceAt(10, 13, [[10, 13]]));
  session.sendPresence(presenceAt(10, 14, [[10, 14]]));
  assert.equal(presences().length, 2);
  await clock.advance(499);
  assert.equal(presences().length, 2);
  await clock.advance(1);
  assert.equal(presences().length, 3);
  assert.deepEqual(presences()[2].tile, [10, 14]);
  // Back to the last sent before the timer: nothing to send.
  session.sendPresence(presenceAt(10, 15, [[10, 15]]));
  session.sendPresence(presenceAt(10, 14));
  session.sendPresence(presenceAt(10, 14, [[10, 14]]));
  await clock.advance(5000);
  assert.equal(presences().length, 3);
  // Bad values are refused before anything is kept.
  assert.throws(() => session.sendPresence(presenceAt(64, 0)), TypeError);
  assert.throws(() => session.sendPresence({ ...presenceAt(1, 1), color: "#f00" }), TypeError);
  // Appearance: de-duplicated as well.
  session.setAppearance(LOOK.appearance, LOOK.equipment);
  session.setAppearance({ ...LOOK.appearance }, { ...LOOK.equipment });
  await clock.advance(5000);
  assert.equal(socket.messages.filter((msg) => msg.t === "appearance").length, 1);
  session.setAppearance(LOOK.appearance, {});
  await clock.advance(1000);
  assert.deepEqual(socket.messages.filter((msg) => msg.t === "appearance").at(-1).equipment, {});
  assert.throws(() => session.setAppearance({ ...LOOK.appearance, gender: 2 }, {}), TypeError);
  session.stop();
}

// --- the server's rate is never exceeded ---------------------------------------------
{
  const limits = { msg_per_sec: 4, msg_burst: 4 };
  const { clock, session, connect } = setup({ limits });
  const socket = await connect();
  const sentAt = [];
  const send = socket.send.bind(socket);
  socket.send = (text) => {
    sentAt.push(clock.now());
    send(text);
    const msg = JSON.parse(text);
    if (msg.t === "ping") socket.receive({ t: "pong", ts: msg.ts, server_tick: 1 });
  };
  // A presence every 100 ms and a new look every 50 ms, for a minute.
  for (let i = 0; i < 1200; i++) {
    if (i % 2 === 0) session.sendPresence(presenceAt(i % 2 === 0 ? (i / 2) % 60 : 0, 5));
    session.setAppearance({ ...LOOK.appearance, hair_color: i % 200 }, {});
    await clock.advance(50);
  }
  for (const at of sentAt) {
    const inSecond = sentAt.filter((other) => other >= at && other < at + 1000).length;
    assert.ok(inSecond <= limits.msg_per_sec, `${inSecond} messages in a second`);
  }
  assert.ok(sentAt.length > 60, `${sentAt.length} sent: the latest still goes out`);
  assert.equal(session.getSnapshot().state, "joined");
  session.stop();
}

// --- frames never exceed the server's limit ------------------------------------------
{
  const { clock, session, connect } = setup({ limits: { max_message_bytes: 200 } });
  const socket = await connect();
  session.setAppearance(LOOK.appearance, LOOK.equipment); // about 400 bytes
  session.sendPresence(presenceAt(1, 1));
  await clock.advance(5000);
  assert.equal(socket.messages.filter((msg) => msg.t === "appearance").length, 0);
  assert.equal(socket.messages.filter((msg) => msg.t === "presence").length, 1);
  for (const text of socket.sent) assert.ok(new TextEncoder().encode(text).length <= 200, text);
  session.stop();
}

// --- the ping and its watchdog --------------------------------------------------------
{
  const { clock, session, connect } = setup();
  const socket = await connect();
  const pings = () => socket.messages.filter((msg) => msg.t === "ping");
  await clock.advance(PING_INTERVAL_MS);
  assert.equal(pings().length, 1);
  assert.equal(pings()[0].ts, clock.now());
  socket.receive({ t: "pong", ts: pings()[0].ts, server_tick: 2000 });
  await clock.advance(PING_INTERVAL_MS);
  assert.equal(pings().length, 2);
  // No pong from here on: dropped 25 s after the first unanswered ping.
  await clock.advance(PONG_TIMEOUT_MS - 1);
  assert.equal(session.getSnapshot().state, "joined");
  assert.equal(pings().length, 4);
  await clock.advance(1);
  assert.equal(session.getSnapshot().state, "waiting");
  assert.ok(socket.closedWith, "we closed it");
  assert.equal(session.getSnapshot().lastClose.reason, "no pong");
  assert.equal(session.getSnapshot().lastClose.retry, "soon");
  session.stop();
}

// --- no welcome in time: dropped and retried --------------------------------------
{
  const { clock, ws, session } = setup();
  session.start();
  await clock.settle();
  ws.last().open();
  await clock.advance(WELCOME_TIMEOUT_MS);
  assert.equal(session.getSnapshot().state, "waiting");
  assert.equal(session.getSnapshot().lastClose.reason, "no welcome");
  session.stop();
}

// --- every close code, and what follows it --------------------------------------------
const policies = { 1000: "soon", 1001: "soon", 1003: "slow", 1006: "soon", 1009: "slow", 4000: "soon", 4001: "never", 4002: "soon", 4003: "never", 4008: "soon", 4009: "never", 4010: "never", 4011: "slow", 4029: "slow", 1011: "soon" };
const stopReasons = { 4001: "session_ended", 4003: "banned", 4009: "replaced", 4010: "version_mismatch" };
for (const [code, retry] of Object.entries(policies).map(([code, retry]) => [Number(code), retry])) {
  const { clock, ws, presence, session, connect } = setup({ random: () => 1 });
  await connect({ members: [other(8)] });
  ws.last().serverClose(code, "x");
  const snap = session.getSnapshot();
  assert.equal(snap.lastClose.code, code);
  assert.equal(snap.lastClose.retry, retry, `${code}`);
  if (retry === "never") {
    assert.equal(snap.state, "stopped", `${code}`);
    assert.equal(snap.stopReason, stopReasons[code]);
    assert.equal(presence.players.size, 0, "the room is gone");
    assert.equal(clock.pending(), 0, `${code}: no timer left`);
    await clock.advance(60 * 60_000);
    assert.equal(ws.sockets.length, 1, `${code}: never again`);
  } else if (retry === "soon") {
    assert.equal(snap.state, "waiting");
    assert.equal(snap.retryInMs, 1000, `${code}: the first retry within a second`);
    await clock.advance(999);
    assert.equal(ws.sockets.length, 1);
    await clock.advance(1);
    assert.equal(ws.sockets.length, 2, `${code}: one more attempt`);
  } else {
    assert.equal(snap.state, "waiting");
    assert.ok(snap.retryInMs >= SLOW_RETRY_MIN_MS && snap.retryInMs <= SLOW_RETRY_MAX_MS, `${code}: ${snap.retryInMs}`);
    assert.equal(presence.players.size, 0, "not back within the grace: the room is gone at once");
    await clock.advance(SLOW_RETRY_MIN_MS - 1);
    assert.equal(ws.sockets.length, 1);
    await clock.advance(snap.retryInMs - SLOW_RETRY_MIN_MS + 1);
    assert.equal(ws.sockets.length, 2, `${code}: one more attempt, minutes later`);
  }
  session.stop();
  assert.equal(clock.pending(), 0);
}

// --- the backoff: doubling from 1 s to 30 s, with jitter, reset by a join -------------------
{
  for (const [random, pick] of [[() => 0, (base) => base / 2], [() => 0.999999, (base) => base]]) {
    const { clock, ws, session, connect } = setup({ random });
    session.start();
    const delays = [];
    for (let i = 0; i < 8; i++) {
      await clock.settle();
      ws.last().serverClose(1006); // the connection fails
      delays.push(session.getSnapshot().retryInMs);
      await clock.advance(session.getSnapshot().retryInMs);
    }
    const bases = [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000];
    assert.deepEqual(delays, bases.map((base) => Math.round(pick(base))));
    assert.ok(Math.max(...delays) <= BACKOFF_CAP_MS);
    assert.equal(ws.sockets.length, 9);
    // A join resets it.
    const socket = await connect();
    socket.serverClose(1006);
    assert.equal(session.getSnapshot().retryInMs, Math.round(pick(1000)));
    session.stop();
  }
}

// --- signed out, realtime off, offline --------------------------------------------------
{
  const { clock, ws, session } = setup({ server: { user: null } });
  session.start();
  await clock.settle();
  assert.equal(session.getSnapshot().state, "stopped");
  assert.equal(session.getSnapshot().stopReason, "signed_out");
  assert.equal(ws.sockets.length, 0);
  assert.equal(clock.pending(), 0);
}
{
  const { clock, ws, session } = setup({ server: { realtime: false } });
  session.start();
  await clock.settle();
  assert.equal(session.getSnapshot().stopReason, "realtime_off");
  assert.equal(ws.sockets.length, 0);
}
{
  // A static host answers /api/meta with its page: no realtime there.
  const { clock, ws, session } = setup({ server: { html: true } });
  session.start();
  await clock.settle();
  assert.equal(session.getSnapshot().stopReason, "realtime_off");
  assert.equal(ws.sockets.length, 0);
}
{
  // Signed out while connected: the failed reconnects check, and stop.
  const { clock, ws, http, session, connect } = setup();
  await connect();
  http.user = null;
  ws.last().serverClose(1006);
  await clock.advance(1000);
  assert.equal(session.getSnapshot().state, "stopped");
  assert.equal(session.getSnapshot().stopReason, "signed_out");
  assert.equal(ws.sockets.length, 1);
  await clock.advance(60 * 60_000);
  assert.equal(ws.sockets.length, 1);
}
{
  // Switched off: 4011 waits minutes, then sees it is off and stops.
  const { clock, ws, http, session, connect } = setup();
  await connect();
  http.realtime = false;
  ws.last().serverClose(4011);
  assert.equal(session.getSnapshot().state, "waiting");
  await clock.advance(SLOW_RETRY_MAX_MS);
  assert.equal(session.getSnapshot().stopReason, "realtime_off");
  assert.equal(ws.sockets.length, 1);
  assert.equal(clock.pending(), 0);
}
{
  // Offline: the checks fail, and are tried again with the backoff.
  const { clock, ws, http, session } = setup({ server: { fail: true } });
  session.start();
  await clock.settle();
  assert.equal(session.getSnapshot().state, "waiting");
  await clock.advance(1000);
  assert.equal(http.calls.length, 2);
  http.fail = false;
  await clock.advance(2000);
  assert.equal(ws.sockets.length, 1);
  // A check that never answers counts as failed.
  http.hang = true;
  ws.last().serverClose(1006);
  await clock.advance(60_000);
  assert.ok(["connecting", "waiting"].includes(session.getSnapshot().state));
  assert.ok(http.calls.length >= 4 + 2, "checked again, after each timeout");
  assert.equal(ws.sockets.length, 1);
  session.stop();
  assert.equal(clock.pending(), 0);
}

// --- a malformed or unknown message does not break the session -----------------------
{
  const { presence, session, connect, ws } = setup();
  const socket = await connect();
  const before = session.getSnapshot();
  for (const frame of ["not json", "[1]", "null", '{"t":5}', JSON.stringify({ t: "chat", id: 7, from: 7, name: "x", text: "hi" }), JSON.stringify({ t: "presence_tick", tick: 1, d: [] }), JSON.stringify({ t: "member_join", member: { id: 0, name: "x" } }), "x".repeat(300_000), new ArrayBuffer(8)])
    socket.receive(frame);
  assert.equal(session.getSnapshot(), before, "nothing changed");
  assert.equal(socket.closedWith, null, "the socket stays");
  socket.receive({ t: "member_join", member: other(8) });
  assert.deepEqual(presence.players.list().map((player) => player.id), [8]);
  // An error frame is kept, the socket stays.
  socket.receive(fixtureBody("valid", "error.out-of-bounds"));
  assert.equal(session.getSnapshot().lastError.code, "out_of_bounds");
  assert.equal(session.getSnapshot().state, "joined");
  // A listener that throws does not stop the others.
  const errors = [];
  process.on("uncaughtException", (error) => errors.push(error.message));
  const unsubscribe = session.onRoomEvent(() => {
    throw new Error("listener");
  });
  socket.receive({ t: "member_join", member: other(9) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(presence.players.size, 2);
  assert.deepEqual(errors, ["listener"]);
  unsubscribe();
  process.removeAllListeners("uncaughtException");
  assert.equal(ws.sockets.length, 1);
  session.stop();
}

// --- a refused join is asked again ------------------------------------------------
{
  const { clock, ws, session, welcome } = setup();
  session.start();
  await clock.settle();
  const socket = ws.last();
  socket.open();
  socket.receive(welcome());
  const rid = socket.messages.find((msg) => msg.t === "join").rid;
  socket.receive({ t: "error", code: "lobby_full", rid, msg: "The lobby is full." });
  assert.equal(session.getSnapshot().state, "open");
  await clock.advance(1000);
  assert.equal(socket.messages.filter((msg) => msg.t === "join").length, 2);
  session.stop();
}

// --- the combat level goes with the look, and again only when it changes -----------------
{
  const { clock, session, connect } = setup();
  const socket = await connect();
  const looks = () => socket.messages.filter((msg) => msg.t === "appearance");
  session.setAppearance(LOOK.appearance, LOOK.equipment, 90);
  await clock.advance(1000);
  assert.equal(looks().length, 1);
  assert.equal(looks()[0].combat, 90);
  session.setAppearance(LOOK.appearance, LOOK.equipment, 90);
  await clock.advance(1000);
  assert.equal(looks().length, 1, "the same level is not sent again");
  session.setAppearance(LOOK.appearance, LOOK.equipment, 91);
  await clock.advance(1000);
  assert.equal(looks().length, 2);
  assert.equal(looks()[1].combat, 91);
  session.setAppearance(LOOK.appearance, LOOK.equipment);
  await clock.advance(1000);
  assert.equal("combat" in looks()[2], false, "no level, no field");
  assert.throws(() => session.setAppearance(LOOK.appearance, LOOK.equipment, 200), TypeError);
  session.stop();
}

// --- error room_closed: the others are gone, and join goes out again --------------------
{
  const { clock, ws, presence, session, connect, joinedFor } = setup();
  const socket = await connect({ members: [other(8), other(9)] });
  session.setAppearance(LOOK.appearance, LOOK.equipment);
  session.sendPresence(presenceAt(31, 25));
  await clock.advance(1000);
  assert.equal(presence.players.size, 2);
  const joinsBefore = socket.messages.filter((msg) => msg.t === "join").length;
  const sentBefore = socket.messages.length;
  socket.receive(fixtureBody("valid", "error.room-closed"));
  assert.equal(session.getSnapshot().state, "open");
  assert.equal(session.getSnapshot().room, null);
  assert.equal(presence.players.size, 0, "the store is emptied");
  assert.equal(session.getSnapshot().lastError.code, "room_closed");
  assert.equal(socket.messages.length, sentBefore, "nothing at once");
  await clock.advance(1000);
  const after = socket.messages.slice(sentBefore).map((msg) => msg.t);
  assert.equal(after.filter((t) => t === "join").length, 1, "join again");
  assert.ok(after.indexOf("appearance") >= 0 && after.indexOf("appearance") < after.indexOf("join"), "the look goes first");
  assert.ok(after.indexOf("presence") >= 0 && after.indexOf("presence") < after.indexOf("join"), "and the tile");
  socket.receive(joinedFor({ messages: socket.messages.slice(sentBefore) }, [other(10)]));
  assert.equal(session.getSnapshot().state, "joined");
  assert.equal(presence.players.size, 1);
  assert.equal(ws.sockets.length, 1, "the same socket");
  assert.equal(socket.messages.filter((msg) => msg.t === "join").length, joinsBefore + 1);
  // Not in a room (before joined): room_closed changes nothing.
  // (The second room_closed waits longer: 1.5 s.)
  socket.receive(fixtureBody("valid", "error.room-closed"));
  socket.receive(fixtureBody("valid", "error.room-closed"));
  await clock.advance(1500);
  assert.equal(socket.messages.filter((msg) => msg.t === "join").length, joinsBefore + 2);
  session.stop();
  assert.equal(clock.pending(), 0);
}

// --- room_closed again and again: the re-join backs off, and is fast again after 30 s joined ---
{
  const { clock, ws, session, connect, joinedFor } = setup();
  const socket = await connect();
  const joins = () => socket.messages.filter((msg) => msg.t === "join").length;
  // random() is 0.5: each wait is 3/4 of 1 s, 2 s, 4 s, ...
  // How long after room_closed the join goes out (the send may also wait for the rate bucket).
  const closeAndRejoin = async (wait) => {
    const before = joins();
    socket.receive(fixtureBody("valid", "error.room-closed"));
    await clock.advance(wait - 1);
    assert.equal(joins(), before, `not before ${wait} ms`);
    let waited = wait - 1;
    while (joins() === before && waited < 60_000) {
      await clock.advance(50);
      waited += 50;
    }
    assert.equal(joins(), before + 1, `a join after about ${wait} ms`);
    socket.receive(joinedFor({ messages: socket.messages.filter((msg) => msg.t === "join").slice(-1) }));
    assert.equal(session.getSnapshot().state, "joined");
    return waited;
  };
  assert.ok((await closeAndRejoin(750)) < 1500);
  await closeAndRejoin(1500);
  await closeAndRejoin(3000);
  // Joined for STABLE_ROOM_MS (the pings answered): back to the first wait.
  for (let ms = 0; ms < STABLE_ROOM_MS; ms += PING_INTERVAL_MS) {
    await clock.advance(PING_INTERVAL_MS);
    socket.receive({ t: "pong", ts: 1, server_tick: 1 });
  }
  assert.equal(ws.sockets.length, 1);
  assert.ok((await closeAndRejoin(750)) < 1500, "fast again");
  session.stop();
  assert.equal(clock.pending(), 0);
}

// --- the shutdown notice: the close is expected, then a reconnect ---------------------
{
  const { clock, ws, session, connect } = setup();
  await connect();
  ws.last().receive(fixtureBody("valid", "notice.shutdown"));
  assert.equal(session.getSnapshot().state, "joined");
  await clock.advance(5000);
  ws.last().serverClose(1001);
  assert.equal(session.getSnapshot().state, "waiting");
  await clock.advance(1000);
  assert.equal(ws.sockets.length, 2);
  // A notice whose close never comes: the socket is dropped a little after.
  const socket = await connect();
  socket.receive(fixtureBody("valid", "notice.shutdown"));
  await clock.advance(10_000);
  assert.ok(socket.closedWith);
  assert.equal(session.getSnapshot().state, "waiting");
  session.stop();
}

// --- stop() leaves nothing behind --------------------------------------------------
{
  const { clock, ws, presence, session, connect } = setup();
  const socket = await connect({ members: [other(8)] });
  session.sendPresence(presenceAt(1, 1));
  session.sendPresence(presenceAt(1, 2, [[1, 2]])); // waits for the flush timer
  await clock.advance(PING_INTERVAL_MS); // a ping out, its watchdog set
  assert.ok(clock.pending() > 0);
  session.stop();
  assert.equal(clock.pending(), 0, "every timer cancelled");
  assert.deepEqual(session.pendingTimers(), []);
  assert.deepEqual(socket.closedWith, { code: 1000, reason: "bye" });
  assert.equal(session.getSnapshot().state, "stopped");
  assert.equal(session.getSnapshot().stopReason, "stopped");
  assert.equal(presence.players.size, 0);
  // The socket's late events change nothing.
  socket.serverClose(1006);
  socket.receive({ t: "member_join", member: other(9) });
  assert.equal(presence.players.size, 0);
  await clock.advance(60 * 60_000);
  assert.equal(ws.sockets.length, 1);
  // stop() while waiting, while checking, while connecting.
  session.start();
  await clock.settle();
  ws.last().serverClose(1006);
  session.stop();
  assert.equal(clock.pending(), 0);
  session.start();
  session.stop();
  await clock.settle();
  assert.equal(ws.sockets.length, 2, "a check that answers after stop() opens nothing");
  session.start();
  await clock.settle();
  session.stop();
  assert.equal(ws.last().closedWith.code, 1000);
  assert.equal(clock.pending(), 0);
  // And it can start again.
  await connect();
  session.stop();
  assert.equal(clock.pending(), 0);
}

// --- chat --------------------------------------------------------------------------
{
  const { clock, session, presence, connect } = setup();
  const { chat } = presence;
  assert.equal(session.getSnapshot().chatEnabled, false);
  // Not joined: nothing goes out.
  assert.deepEqual(session.sendChat("hi"), { ok: false, reason: "not_joined" });
  const socket = await connect();
  assert.equal(session.getSnapshot().chatEnabled, true, "the welcome's features.chat");
  assert.equal(session.getSnapshot().limits.chat_max_chars, 80);
  const chats = () => socket.messages.filter((msg) => msg.t === "chat");
  // Refused before sending: empty, too long.
  assert.deepEqual(session.sendChat(" ​ "), { ok: false, reason: "empty" });
  assert.deepEqual(session.sendChat("x".repeat(81)), { ok: false, reason: "too_long" });
  assert.equal(chats().length, 0);
  // Sent cleaned and capitalised; the prefix as typed.
  const sent = session.sendChat("  red:wave:buying   gf ");
  assert.equal(sent.ok, true);
  assert.equal(sent.text, "red:wave:Buying gf");
  assert.deepEqual(chats(), [{ t: "chat", rid: sent.rid, text: "red:wave:Buying gf" }]);
  // Too soon: one line every chat_interval_ms, nothing sent.
  await clock.advance(1000);
  assert.deepEqual(session.sendChat("again"), { ok: false, reason: "rate_limited", retryInMs: 3000 });
  assert.equal(chats().length, 1);
  // The echo of our own line is ours; names and texts stay literal text.
  socket.receive({ t: "chat", id: 7, name: "Player-0420", text: sent.text, tick: 1241 });
  socket.receive({ t: "chat", id: 8, name: "<col=ff0000>Bob", text: "<img=1> & <br>", tick: 1241 });
  const lines = chat.getSnapshot().lines;
  assert.equal(lines.length, 2);
  assert.equal(lines[0].mine, true);
  assert.deepEqual(lines[0].display, { colour: "red", effect: "wave", text: "Buying gf" });
  assert.equal(lines[1].mine, false);
  assert.equal(lines[1].name, "<col=ff0000>Bob");
  assert.equal(lines[1].text, "<img=1> & <br>");
  assert.equal(chat.overheadFor(8)?.text, "<img=1> & <br>");
  // A line over the welcome's limit is dropped.
  socket.receive({ t: "chat", id: 8, name: "Bob", text: "x".repeat(81), tick: 1242 });
  assert.equal(chat.getSnapshot().lines.length, 2);
  // After the interval, the next line goes.
  await clock.advance(3000);
  assert.equal(session.sendChat("again").ok, true);
  // The server's refusal: a line of ours, and its retry_in_ms is kept.
  socket.receive({ t: "chat_rejected", rid: 99, reason: "rate_limited", retry_in_ms: 10_000 });
  assert.match(chat.getSnapshot().lines.at(-1).text, /too quickly/);
  assert.equal(chat.getSnapshot().lines.at(-1).kind, "system");
  await clock.advance(5000);
  assert.deepEqual(session.sendChat("later"), { ok: false, reason: "rate_limited", retryInMs: 5000 });
  socket.receive({ t: "chat_rejected", reason: "muted" });
  assert.equal(chat.getSnapshot().lines.at(-1).text, "You are muted and cannot talk.");
  // A line the server refuses spends no interval: its refusal gives the time back.
  await clock.advance(5000);
  const refused = session.sendChat("muted line");
  assert.equal(refused.ok, true);
  assert.equal(session.sendChat("too soon").reason, "rate_limited");
  socket.receive({ t: "chat_rejected", rid: refused.rid, reason: "muted" });
  assert.equal(session.sendChat("not too soon").ok, true);
  // The per-address limit comes as rate_limited too.
  socket.receive({ ...fixtureBody("valid", "chat-rejected.rate-limited-address"), rid: 12345 });
  assert.deepEqual(session.sendChat("x"), { ok: false, reason: "rate_limited", retryInMs: 4000 });
  await clock.advance(4000);
  socket.receive({ t: "chat_rejected", rid: 999, reason: "rate_limited", retry_in_ms: 1000 });
  assert.deepEqual(session.sendChat("x"), { ok: false, reason: "rate_limited", retryInMs: 1000 });
  // Notices switch chat off and on.
  socket.receive({ t: "notice", kind: "chat_off" });
  assert.equal(session.getSnapshot().chatEnabled, false);
  assert.match(chat.getSnapshot().lines.at(-1).text, /switched off/);
  await clock.advance(10_000);
  assert.deepEqual(session.sendChat("hi"), { ok: false, reason: "chat_off" });
  socket.receive({ t: "notice", kind: "chat_on" });
  assert.equal(session.getSnapshot().chatEnabled, true);
  assert.equal(session.sendChat("hi").ok, true);
  socket.receive({ t: "chat_rejected", reason: "chat_off" });
  assert.equal(session.getSnapshot().chatEnabled, false);
  session.stop();
  assert.equal(chat.getSnapshot().lines.length, 0, "leaving the room clears the log");
}
{
  // A welcome with chat off.
  const { session, connect } = setup({ features: { chat: false } });
  await connect();
  assert.equal(session.getSnapshot().chatEnabled, false);
  assert.deepEqual(session.sendChat("hi"), { ok: false, reason: "chat_off" });
  session.stop();
}
{
  // The interval is the welcome's, and holds across a reconnect.
  const { clock, ws, session, connect } = setup({ limits: { chat_interval_ms: 6000 } });
  await connect();
  assert.equal(session.sendChat("one").ok, true);
  ws.last().serverClose(1006);
  await clock.advance(2000);
  await connect();
  const early = session.sendChat("two");
  assert.equal(early.reason, "rate_limited");
  assert.ok(early.retryInMs > 0 && early.retryInMs <= 4000, String(early.retryInMs));
  await clock.advance(early.retryInMs);
  assert.equal(session.sendChat("two").ok, true);
  session.stop();
}

console.log("ok");
