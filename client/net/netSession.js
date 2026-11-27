// One tab's connection to the lobby's WebSocket (GET /api/ws, protocol 1):
// it connects, says hello, joins the lobby, keeps the connection alive and
// reconnects when it drops, as the close code allows. Everything it touches
// outside itself is handed in, so the tests run it on a scripted socket and
// fake timers.
//
//   const session = createNetSession({
//     url,                       "wss://<host>/api/ws"
//     WebSocketImpl,             the WebSocket class
//     fetchImpl,                 fetch, for /api/meta and /api/auth/me
//     now,                       () => milliseconds (Date.now)
//     setTimeout, clearTimeout,
//     build,                     hello.build: a git SHA or "dev"
//     random,                    optional, () => [0, 1), for the jitter
//     metaUrl, meUrl,            optional, "/api/meta" and "/api/auth/me"
//   });
//   session.start(); session.stop();
//   session.getSnapshot()        frozen, the same object until it changes:
//     state            "idle" | "connecting" | "open" | "joined" | "waiting" | "stopped"
//     you              { id, name } from the last welcome, or null
//     room             { id, kind, instance } while joined, or null
//     limits           the welcome's limits (DEFAULT_LIMITS before one)
//     lastClose        { code, reason, retry } of the last close, or null
//     stopReason       why it is stopped: "stopped", "signed_out", "realtime_off",
//                      or the name of a close code that is never retried
//                      ("session_ended", "banned", "replaced", "version_mismatch")
//     lastError        the last error message of the server, or null
//     retryInMs        while waiting, the delay before the next attempt
//     connectAttempts  sockets opened since start()
//     chatEnabled      the welcome's features.chat, as notice{chat_off|chat_on}
//                      and chat_rejected{chat_off} change it since
//   session.subscribe(fn)        fn() after every snapshot change; returns unsubscribe
//   session.onRoomEvent(fn)      fn({ type: "message", msg }) for every valid
//                                message of the server (protocol.js shapes), and
//                                fn({ type: "room_lost", reason }) when the room
//                                we saw is gone; returns unsubscribe
//   session.setAppearance(appearance, equipment, combat?)
//                                the look to show, and the combat level; kept,
//                                sent on every connect and whenever it changes
//   session.sendPresence({ tile, steps, run, facing })
//                                the local player after a tick; kept, sent while
//                                joined, at most once a server tick, only when
//                                it changed. Both throw a TypeError on values
//                                the protocol refuses (protocol.js builders).
//   session.sendChat(raw)        one public chat line, as typed: prepared by
//                                chatText.prepareOutgoing and sent while joined
//                                with chat on, at most one a chat_interval_ms.
//                                { ok: true, text, rid } when sent, else
//                                { ok: false, reason }: "not_joined", "chat_off",
//                                "empty", "too_long", "rate_limited" (with
//                                retryInMs) or "not_sent" (the socket or the
//                                rate of messages would not take it). The
//                                server is the authority: what it refuses
//                                comes back as chat_rejected.
//
// The states: connecting (checking /api/meta and /api/auth/me, then the
// socket, hello and the wait for welcome), open (welcome came; the stored
// look and presence go out, then join), joined (joined came), waiting (closed;
// a retry is set), stopped (stop(), or nothing to retry for).
import {
  DEFAULT_LIMITS,
  buildHello,
  buildJoin,
  buildPing,
  buildPresence,
  buildAppearance,
  buildChat,
  NOTICE_CHAT_OFF,
  NOTICE_CHAT_ON,
  closeCodes,
  describeClose,
  parseServerMessage,
  retryPolicy,
} from "./protocol.js";
import { prepareOutgoing } from "./chatText.js";

// The timers of the connection. The server closes a socket that sent nothing
// for 45 s (4000) and one that sent no hello in 10 s (4002); a ping every 10 s
// keeps it open, and 25 s without a pong means the link is dead.
export const PING_INTERVAL_MS = 10_000;
export const PONG_TIMEOUT_MS = 25_000;
export const CONNECT_TIMEOUT_MS = 15_000;
export const WELCOME_TIMEOUT_MS = 10_000;
export const PREFLIGHT_TIMEOUT_MS = 15_000;
// Retries: "soon" doubles from 1 s to 30 s, each delay drawn from its upper
// half; "slow" is 2 to 5 minutes.
export const BACKOFF_START_MS = 1_000;
export const BACKOFF_CAP_MS = 30_000;
export const SLOW_RETRY_MIN_MS = 120_000;
export const SLOW_RETRY_MAX_MS = 300_000;
// The server keeps a player whose socket dropped for 20 s: back within that,
// the same id comes back and nobody saw us leave. Past it, the room is gone.
export const ROOM_GRACE_MS = 20_000;
// Joined this long, a room is taken as stable again: room_closed backs off from 1 s.
export const STABLE_ROOM_MS = 30_000;
// After notice{shutdown}, the close comes in in_sec (5 s if not said).
export const SHUTDOWN_NOTICE_MS = 5_000;
export const SHUTDOWN_SLACK_MS = 5_000;

const OPEN = 1;
const utf8 = new TextEncoder();

// Math.random only draws the seed (AGENTS.md); the jitter comes from this.
export function seededRandom(seed = Math.floor(Math.random() * 2 ** 32)) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function createNetSession({
  url,
  WebSocketImpl,
  fetchImpl,
  now,
  setTimeout: setTimer,
  clearTimeout: clearTimer,
  build = "dev",
  random = seededRandom(),
  metaUrl = "/api/meta",
  meUrl = "/api/auth/me",
} = {}) {
  for (const [name, value] of Object.entries({ WebSocketImpl, fetchImpl, now, setTimeout: setTimer, clearTimeout: clearTimer, random }))
    if (typeof value !== "function") throw new TypeError(`createNetSession: ${name} is not a function`);
  if (typeof url !== "string" || !url) throw new TypeError("createNetSession: url is missing");
  const hello = buildHello({ build });

  // --- timers, by name: arming one again replaces it; stop() clears them all.
  const timers = new Map();
  const arm = (name, ms, fn) => {
    disarm(name);
    const handle = setTimer(() => {
      if (timers.get(name) !== handle) return;
      timers.delete(name);
      fn();
    }, Math.max(0, ms));
    timers.set(name, handle);
  };
  const disarm = (name) => {
    if (!timers.has(name)) return;
    clearTimer(timers.get(name));
    timers.delete(name);
  };
  const disarmAll = (except = []) => {
    for (const name of [...timers.keys()]) if (!except.includes(name)) disarm(name);
  };

  // --- snapshot and listeners.
  let snapshot = Object.freeze({
    state: "idle",
    you: null,
    room: null,
    limits: DEFAULT_LIMITS,
    lastClose: null,
    stopReason: null,
    lastError: null,
    retryInMs: null,
    connectAttempts: 0,
    chatEnabled: false,
  });
  const listeners = new Set();
  const roomListeners = new Set();
  // A listener that throws is reported, and the session goes on.
  const call = (fn, arg) => {
    try {
      fn(arg);
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  };
  const update = (patch) => {
    if (Object.entries(patch).every(([key, value]) => snapshot[key] === value)) return;
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const listener of [...listeners]) call(listener);
  };
  const emit = (event) => {
    for (const listener of [...roomListeners]) call(listener, event);
  };
  const roomLost = (reason) => {
    disarm("grace");
    emit({ type: "room_lost", reason });
  };

  // --- what the session holds between connections.
  let generation = 0; // a new attempt or stop() makes every older callback a no-op
  let socket = null;
  let failures = 0; // attempts since the last joined, for the backoff
  let roomClosures = 0; // room_closed errors since a welcome or STABLE_ROOM_MS joined
  let ridCounter = 0;
  let joinRid = null;
  let wantedAppearance = null, wantedPresence = null; // built messages, latest wins
  // Per connection:
  let sentAppearance = null, sentPresence = null; // the JSON last sent
  let appearanceAt = -Infinity, presenceAt = -Infinity;
  let tokens = 0, tokensAt = 0;
  let shuttingDown = false;
  let welcomed = false;
  // The earliest time the next chat line may go. Kept across connections:
  // the server's interval is per user, across reconnects.
  let chatAllowedAt = -Infinity;
  // The rid of the last line sent, and chatAllowedAt before it: a line the
  // server refuses spends no interval, so its refusal gives that time back.
  let chatRid = null, chatAllowedBefore = -Infinity;

  // --- sending. Half the server's rate, so a burst of ours never meets its limit.
  const bucketSize = () => Math.max(1, Math.floor(snapshot.limits.msg_burst / 2));
  const refillPerMs = () => snapshot.limits.msg_per_sec / 2 / 1000;
  const refill = () => {
    const t = now();
    tokens = Math.min(bucketSize(), tokens + Math.max(0, t - tokensAt) * refillPerMs());
    tokensAt = t;
  };
  const tokenIn = () => (tokens >= 1 ? 0 : Math.ceil((1 - tokens) / refillPerMs()));
  const take = () => {
    refill();
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
  // Never a frame over the server's limit, and never on a socket that is not open.
  const sendFrame = (msg) => {
    if (!socket || socket.readyState !== OPEN) return false;
    const text = JSON.stringify(msg);
    if (utf8.encode(text).length > snapshot.limits.max_message_bytes) return false;
    socket.send(text);
    return true;
  };
  const send = (msg) => take() && sendFrame(msg);

  // Sends what changed of the look and the presence, as the rates allow;
  // what has to wait is sent by the flush timer, the latest only.
  const flush = ({ beforeJoin = false } = {}) => {
    if (!socket || !welcomed) return;
    const tickMs = snapshot.limits.tick_ms;
    let wait = Infinity;
    const offer = (wanted, sentKey, sentAt, allowed) => {
      if (!wanted || !allowed) return null;
      const key = JSON.stringify(wanted);
      if (key === sentKey) return null;
      const due = sentAt + tickMs - now();
      if (due > 0) {
        wait = Math.min(wait, due);
        return null;
      }
      if (!send(wanted)) {
        wait = Math.min(wait, Math.max(1, tokenIn()));
        return null;
      }
      return key;
    };
    const appearanceKey = offer(wantedAppearance, sentAppearance, appearanceAt, true);
    if (appearanceKey) [sentAppearance, appearanceAt] = [appearanceKey, now()];
    const presenceKey = offer(wantedPresence, sentPresence, presenceAt, beforeJoin || snapshot.state === "joined");
    if (presenceKey) [sentPresence, presenceAt] = [presenceKey, now()];
    if (wait < Infinity) arm("flush", wait, () => flush());
    else disarm("flush");
  };

  const sendJoin = () => {
    ridCounter = (ridCounter % 0xffffffff) + 1;
    joinRid = ridCounter;
    if (!send(buildJoin({ rid: joinRid }))) arm("rejoin", Math.max(1, tokenIn()), sendJoin);
  };

  const sendPing = () => {
    arm("ping", PING_INTERVAL_MS, sendPing);
    if (!timers.has("pong")) arm("pong", PONG_TIMEOUT_MS, () => drop("no pong"));
    // The ping is never held back by the look and the presence: it takes its
    // token even when there is none, and they wait the longer for it. Our
    // bucket is half the server's, so this never reaches the server's limit.
    refill();
    tokens -= 1;
    sendFrame(buildPing(Math.max(0, Math.floor(now()))));
  };

  // --- the connection.
  const backoff = (count = failures) => {
    const base = Math.min(BACKOFF_CAP_MS, BACKOFF_START_MS * 2 ** Math.min(count, 30));
    return Math.round(base / 2 + (random() * base) / 2);
  };

  const halt = (stopReason) => {
    generation++;
    disarmAll();
    closeSocket(1000, "bye");
    update({ state: "stopped", stopReason, room: null, retryInMs: null });
    roomLost(stopReason);
  };

  const scheduleRetry = (retry) => {
    const delay = retry === "slow" ? Math.round(SLOW_RETRY_MIN_MS + random() * (SLOW_RETRY_MAX_MS - SLOW_RETRY_MIN_MS)) : backoff();
    failures++;
    arm("retry", delay, attempt);
    update({ state: "waiting", room: null, retryInMs: delay });
  };

  // Before each socket: is realtime on, and is the player signed in? A failed
  // upgrade shows the browser no status, so this is how a refusal is told apart.
  const preflight = async () => {
    const get = (path) => fetchImpl(path, { credentials: "same-origin", headers: { accept: "application/json" } });
    const json = async (response) => {
      try {
        return await response.json();
      } catch {
        return null;
      }
    };
    try {
      const meta = await get(metaUrl);
      if (!meta.ok) return meta.status >= 500 || meta.status === 429 ? "unknown" : "realtime_off";
      if ((await json(meta))?.features?.realtime !== true) return "realtime_off";
      const me = await get(meUrl);
      if (me.status === 401 || me.status === 403) return "signed_out";
      if (!me.ok) return "unknown";
      const user = (await json(me))?.user;
      return user !== null && typeof user === "object" ? "ok" : "signed_out";
    } catch {
      return "unknown"; // offline, or the server is restarting
    }
  };

  const attempt = () => {
    const mine = ++generation;
    update({ state: "connecting", retryInMs: null });
    let settled = false;
    const settle = (result) => {
      if (settled || mine !== generation) return;
      settled = true;
      disarm("preflight");
      if (result === "ok") openSocket();
      else if (result === "unknown") scheduleRetry("soon");
      else halt(result);
    };
    arm("preflight", PREFLIGHT_TIMEOUT_MS, () => settle("unknown"));
    preflight().then(settle, () => settle("unknown"));
  };

  const openSocket = () => {
    let ws;
    try {
      ws = new WebSocketImpl(url);
    } catch {
      update({ connectAttempts: snapshot.connectAttempts + 1 });
      onClosed(1006, "could not connect");
      return;
    }
    socket = ws;
    sentAppearance = sentPresence = null;
    appearanceAt = presenceAt = -Infinity;
    shuttingDown = welcomed = false;
    joinRid = null;
    update({ connectAttempts: snapshot.connectAttempts + 1, limits: DEFAULT_LIMITS });
    tokens = bucketSize();
    tokensAt = now();
    ws.onopen = () => {
      if (socket !== ws) return;
      disarm("connect");
      sendFrame(hello);
      arm("welcome", WELCOME_TIMEOUT_MS, () => drop("no welcome"));
    };
    ws.onmessage = (event) => {
      if (socket === ws) onFrame(event?.data);
    };
    ws.onclose = (event) => {
      if (socket === ws) onClosed(event?.code ?? 1006, event?.reason ?? "");
    };
    ws.onerror = () => {}; // a close follows
    arm("connect", CONNECT_TIMEOUT_MS, () => drop("connect timed out"));
  };

  const closeSocket = (code, reason) => {
    const ws = socket;
    socket = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close(code, reason);
    } catch {
      // closing a socket that never opened may throw in some implementations
    }
  };

  // We give up on this socket ourselves: it is treated as a dropped connection.
  const drop = (reason) => {
    closeSocket(1000, reason);
    onClosed(1006, reason);
  };

  const onClosed = (code, reason) => {
    socket = null;
    disarmAll(["grace", "retry"]);
    const wasInRoom = snapshot.room !== null || welcomed;
    // The 1001 after a shutdown notice, and any close after one, is a restart.
    const retry = shuttingDown ? "soon" : retryPolicy(code);
    welcomed = false;
    update({ lastClose: Object.freeze({ code, reason: reason || describeClose(code), retry }), room: null });
    if (retry === "never") return halt(closeCodes[code]?.name ?? "closed");
    if (retry === "slow") roomLost("closed");
    else if (wasInRoom && !timers.has("grace")) arm("grace", ROOM_GRACE_MS, () => roomLost("grace over"));
    scheduleRetry(retry);
  };

  const onFrame = (data) => {
    if (typeof data !== "string") return; // protocol 1 is text only
    const parsed = parseServerMessage(data, { limits: snapshot.limits });
    if (!parsed.ok) return; // dropped; the socket stays
    const msg = parsed.msg;
    if (!welcomed && msg.t !== "welcome" && msg.t !== "error" && msg.t !== "notice") return;
    switch (msg.t) {
      case "welcome": {
        if (welcomed) return;
        welcomed = true;
        roomClosures = 0;
        disarm("welcome");
        const before = snapshot.you;
        update({ state: "open", you: Object.freeze({ ...msg.you }), limits: Object.freeze({ ...DEFAULT_LIMITS, ...msg.limits }), chatEnabled: msg.features.chat === true });
        tokens = bucketSize();
        tokensAt = now();
        if (before && before.id !== msg.you.id) roomLost("new id");
        emit({ type: "message", msg });
        arm("ping", PING_INTERVAL_MS, sendPing);
        // The look and the tile go before join, so the others see us whole.
        flush({ beforeJoin: true });
        sendJoin();
        return;
      }
      case "joined":
        failures = 0;
        disarm("grace");
        disarm("rejoin");
        arm("stable", STABLE_ROOM_MS, () => (roomClosures = 0));
        update({ state: "joined", room: Object.freeze({ ...msg.room }) });
        emit({ type: "message", msg });
        flush();
        return;
      case "pong":
        disarm("pong");
        break;
      case "error":
        update({ lastError: Object.freeze({ ...msg }) });
        // A join that was refused (lobby_full, rate_limited): ask again later.
        if (joinRid !== null && msg.rid === joinRid && snapshot.state === "open") arm("rejoin", backoff(), sendJoin);
        // The room closed under us (fixture error.room-closed): we are in no
        // room, the others are gone, and join is sent again after a short wait,
        // the look and the tile first, as after a welcome.
        // A room that keeps closing is joined again ever more slowly: the count
        // goes back to 0 after STABLE_ROOM_MS joined, or with a new welcome.
        else if (msg.code === "room_closed" && snapshot.state === "joined") {
          disarm("stable");
          update({ state: "open", room: null });
          roomLost("room_closed");
          emit({ type: "message", msg });
          arm("rejoin", backoff(roomClosures++), () => {
            sentAppearance = sentPresence = null;
            flush({ beforeJoin: true });
            sendJoin();
          });
          return;
        }
        break;
      case "chat_rejected":
        if (msg.reason === "chat_off") update({ chatEnabled: false });
        if (chatRid !== null && msg.rid === chatRid) {
          chatAllowedAt = chatAllowedBefore;
          chatRid = null;
        }
        // Per user or per address: either way, nothing before retry_in_ms.
        if (msg.reason === "rate_limited") chatAllowedAt = Math.max(chatAllowedAt, now() + msg.retry_in_ms);
        break;
      case "notice":
        if (msg.kind === NOTICE_CHAT_OFF) update({ chatEnabled: false });
        if (msg.kind === NOTICE_CHAT_ON) update({ chatEnabled: true });
        if (msg.kind === "shutdown") {
          shuttingDown = true;
          // The close should come; if it does not, the socket is dropped.
          arm("shutdown", (msg.in_sec === undefined ? SHUTDOWN_NOTICE_MS : msg.in_sec * 1000) + SHUTDOWN_SLACK_MS, () => drop("server shut down"));
        }
        break;
    }
    emit({ type: "message", msg });
  };

  return {
    start() {
      if (snapshot.state !== "idle" && snapshot.state !== "stopped") return;
      failures = 0;
      update({ stopReason: null, lastClose: null, lastError: null, connectAttempts: 0 });
      attempt();
    },
    stop() {
      if (snapshot.state === "stopped" && !socket && !timers.size) return;
      halt("stopped");
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onRoomEvent(listener) {
      roomListeners.add(listener);
      return () => roomListeners.delete(listener);
    },
    setAppearance(appearance, equipment, combat) {
      wantedAppearance = buildAppearance(appearance, equipment, combat);
      flush();
    },
    sendPresence(presence) {
      wantedPresence = buildPresence(presence);
      if (snapshot.state !== "joined") return false;
      flush();
      return true;
    },
    sendChat(raw) {
      if (snapshot.state !== "joined") return { ok: false, reason: "not_joined" };
      if (!snapshot.chatEnabled) return { ok: false, reason: "chat_off" };
      const prepared = prepareOutgoing(raw, snapshot.limits);
      if (!prepared.ok) return prepared;
      const wait = Math.ceil(chatAllowedAt - now());
      if (wait > 0) return { ok: false, reason: "rate_limited", retryInMs: wait };
      ridCounter = (ridCounter % 0xffffffff) + 1;
      const rid = ridCounter;
      if (!send(buildChat(prepared.text, rid))) return { ok: false, reason: "not_sent" };
      [chatRid, chatAllowedBefore] = [rid, chatAllowedAt];
      chatAllowedAt = now() + snapshot.limits.chat_interval_ms;
      return { ok: true, text: prepared.text, rid };
    },
    // For tests and diagnostics: the names of the timers that are set.
    pendingTimers: () => [...timers.keys()],
  };
}
