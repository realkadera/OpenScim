// Protocol 1 of the lobby's WebSocket, GET /api/ws: its numbers, its close
// codes, a builder for every message the client sends and the parser of
// every message it receives. contract/fixtures/ws/ is the source of truth
// for all of it; test/test-net-protocol.mjs holds this module to them.
//
// Frames are JSON text, one object each, {"t": "<type>", ...}, snake_case.
// Tiles are [x, y] of the lobby's 64×64 grid, origin south-west, +x east,
// +y north: exactly the simulation's playerPosition. Facing is the OSRS
// angle, 0..2047 (0 south, 512 west, 1024 north, 1536 east).
//
//   build*(...)               each client message, built from checked values
//                             only; throws a TypeError on anything else
//   checkClientMessage(body)  { ok, reason }: would the server take this body
//   parseServerMessage(text, { limits }?)
//                             { ok: true, msg } | { ok: false, reason }; never
//                             throws. Lenient: unknown fields are ignored and
//                             left out of msg, but every field msg carries is
//                             checked. An unknown type is { ok: false }, and
//                             the session drops it like any refused message.
//   retryPolicy(code)         "never" | "soon" | "slow" for a close code
//
// Names and chat text are untrusted, kept as plain strings (names 1 to 24
// characters). Nothing here reads them as markup or game tags (<col=...>,
// <img=...>, <br>), and whoever shows one must not either.

export const PROTOCOL_VERSION = 1;
export const ENCODING = "json";
// What the client assumes until the welcome says what the server enforces;
// the session always takes the welcome's limits. max_message_bytes is the
// least a server may set, so the hello fits whatever it is.
export const DEFAULT_LIMITS = Object.freeze({
  max_message_bytes: 4096,
  msg_per_sec: 20,
  msg_burst: 40,
  tick_ms: 600,
  tile_min: 0,
  tile_max: 63,
  steps_max: 2,
  chat_max_chars: 80,
  chat_interval_ms: 4000,
});
export const TILE_MIN = 0;
export const TILE_MAX = 63;
export const FACING_MAX = 2047;
// Steps in one client presence (one tick's run is two tiles), and in one
// presence_tick entry (the steps since the last tick, the last four kept).
export const STEPS_PER_PRESENCE_MAX = 2;
export const MERGED_STEPS_MAX = 4;
export const BUILD_MAX_CHARS = 64;
export const NAME_MAX_CHARS = 24;
// A player's combat level, lowest to highest (WIKI: Combat_level, 3 for a new
// account and 126 at the most).
export const COMBAT_MIN = 3;
export const COMBAT_MAX = 126;
export const ERROR_MSG_MAX_CHARS = 200;
// Chat. The welcome sets the limit and the interval (80 characters, one line
// every 4 s, WIKI-like and confirmed by the maintainer); a welcome without
// them leaves DEFAULT_LIMITS. A chat line from the server is 1 to
// chat_max_chars characters, counted as Unicode scalar values.
// CHAT_MAX_CHARS_CAP bounds what a welcome may set at all.
export const CHAT_MAX_CHARS_CAP = 1000;
export const CHAT_RETRY_MAX_MS = 86_400_000;
// Why the server refused a chat line. "muted" is announced by the server
// and taken already; only rate_limited carries retry_in_ms.
export const CHAT_REJECT_REASONS = Object.freeze(["too_long", "empty", "rate_limited", "chat_off", "not_joined", "muted"]);
// The notices that switch chat off and on for the whole server.
export const NOTICE_CHAT_OFF = "chat_off";
export const NOTICE_CHAT_ON = "chat_on";
export const ITEM_ID_MAX = 65535;
export const INSTANCE_MAX = 999;
export const RID_MAX = 4294967295;
// A lobby instance holds 50 players, so a joined snapshot lists at most 49 others.
export const MEMBERS_MAX = 50;
export const OTHERS_MAX = MEMBERS_MAX - 1;
// The server's messages are not bounded by max_message_bytes (that is what it
// takes in): a joined snapshot of 49 players is larger. This bounds what the
// parser reads at all.
export const SERVER_MESSAGE_MAX_CHARS = 256 * 1024;

// Every field of an appearance, in the protocol's order, with its range
// [min, max] (fixtures appearance.*). The one place to change a range: a kit
// is -1 ("none") or a kit id, a colour an index into its palette.
const KIT = Object.freeze([-1, 4095]);
const COLOR = Object.freeze([0, 255]);
export const APPEARANCE_RANGES = Object.freeze({
  gender: Object.freeze([0, 1]),
  hair_kit: KIT,
  jaw_kit: KIT,
  torso_kit: KIT,
  arms_kit: KIT,
  hands_kit: KIT,
  legs_kit: KIT,
  feet_kit: KIT,
  hair_color: COLOR,
  torso_color: COLOR,
  legs_color: COLOR,
  feet_color: COLOR,
  skin_color: COLOR,
});
export const APPEARANCE_FIELDS = Object.freeze(Object.keys(APPEARANCE_RANGES));
export const EQUIPMENT_SLOTS = Object.freeze(["head", "cape", "amulet", "weapon", "body", "shield", "legs", "hands", "boots", "ring", "ammo"]);

// Close codes: what each means, and whether this tab tries again.
//   never  stop; only a reload (or signing in again) starts over
//   soon   reconnect with backoff: 1 s doubling to 30 s, with jitter
//   slow   reconnect in 2 to 5 minutes
export const CloseCode = Object.freeze({
  NORMAL: 1000,
  GOING_AWAY: 1001,
  UNSUPPORTED_DATA: 1003,
  ABNORMAL: 1006,
  MESSAGE_TOO_BIG: 1009,
  IDLE: 4000,
  SESSION_ENDED: 4001,
  NO_HELLO: 4002,
  BANNED: 4003,
  SLOW_CONSUMER: 4008,
  REPLACED: 4009,
  VERSION_MISMATCH: 4010,
  DISABLED: 4011,
  RATE_LIMITED: 4029,
});

export const closeCodes = Object.freeze({
  1000: { name: "normal", meaning: "closed normally", retry: "soon" },
  1001: { name: "going_away", meaning: "the server is shutting down", retry: "soon" },
  1003: { name: "unsupported_data", meaning: "a binary frame: protocol 1 is text only", retry: "slow" },
  1006: { name: "abnormal", meaning: "the connection dropped or could not be made", retry: "soon" },
  1009: { name: "message_too_big", meaning: "a message over max_message_bytes", retry: "slow" },
  4000: { name: "idle", meaning: "nothing was received for too long", retry: "soon" },
  4001: { name: "session_ended", meaning: "signed out, or the session expired", retry: "never" },
  4002: { name: "no_hello", meaning: "no valid hello in time", retry: "soon" },
  4003: { name: "banned", meaning: "the account is banned", retry: "never" },
  4008: { name: "slow_consumer", meaning: "this tab fell behind the server", retry: "soon" },
  4009: { name: "replaced", meaning: "a newer tab of the same account took over", retry: "never" },
  4010: { name: "version_mismatch", meaning: "refresh to update", retry: "never" },
  4011: { name: "disabled", meaning: "realtime was switched off", retry: "slow" },
  4029: { name: "rate_limited", meaning: "too many messages", retry: "slow" },
});

// A code nobody listed (a proxy's 1011 or 1012, say) is a dropped connection.
export const retryPolicy = (code) => closeCodes[code]?.retry ?? "soon";
export const describeClose = (code) => closeCodes[code]?.meaning ?? "the connection closed";

// --- checks ------------------------------------------------------------------

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const isId = (value) => isInt(value, 1, Number.MAX_SAFE_INTEGER);
const charCount = (text) => [...text].length;
const isName = (value) => typeof value === "string" && charCount(value) >= 1 && charCount(value) <= NAME_MAX_CHARS;
const isTile = (value) => Array.isArray(value) && value.length === 2 && isInt(value[0], TILE_MIN, TILE_MAX) && isInt(value[1], TILE_MIN, TILE_MAX);
const isFacing = (value) => isInt(value, 0, FACING_MAX);
const isCombat = (value) => isInt(value, COMBAT_MIN, COMBAT_MAX);
// Within one tile of each other, the 8-neighbourhood or the same tile.
export const isAdjacent = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
export const tilesEqual = (a, b) => a[0] === b[0] && a[1] === b[1];

const appearanceRange = (field) => APPEARANCE_RANGES[field];

// The checked copy, in the protocol's field order, or null.
function readAppearance(value) {
  if (!isObject(value)) return null;
  const out = {};
  for (const field of APPEARANCE_FIELDS) {
    const [min, max] = appearanceRange(field);
    if (!isInt(value[field], min, max)) return null;
    out[field] = value[field];
  }
  return out;
}

// Lenient: a slot this client does not know is left out.
function readEquipment(value) {
  if (!isObject(value)) return null;
  const out = {};
  for (const slot of EQUIPMENT_SLOTS) {
    if (value[slot] === undefined) continue;
    if (!isInt(value[slot], 0, ITEM_ID_MAX)) return null;
    out[slot] = value[slot];
  }
  return out;
}

// --- client to server ------------------------------------------------------------

const fail = (message) => {
  throw new TypeError(message);
};
const onlyKeys = (object, keys, what) => {
  for (const key of Object.keys(object)) if (!keys.includes(key)) fail(`${what}: unknown field ${JSON.stringify(key)}`);
};
const tileCopy = (tile, what) => (isTile(tile) ? [tile[0], tile[1]] : fail(`${what} is not [x, y] of integers ${TILE_MIN}..${TILE_MAX}`));

export function buildHello({ build, proto = PROTOCOL_VERSION, enc = ENCODING } = {}) {
  if (proto !== PROTOCOL_VERSION) fail(`hello: proto must be ${PROTOCOL_VERSION}`);
  if (enc !== ENCODING) fail(`hello: enc must be "${ENCODING}"`);
  if (typeof build !== "string" || !/^[A-Za-z0-9._+-]{1,64}$/.test(build)) fail("hello: build must be 1 to 64 of A-Z a-z 0-9 . _ + -");
  return { t: "hello", proto, build, enc };
}

// rid echoes in the answer; instance asks for one lobby instance (the server
// picks another when it is full or gone).
export function buildJoin({ rid, instance } = {}) {
  if (rid !== undefined && !isInt(rid, 0, RID_MAX)) fail("join: rid must be an integer 0..2^32-1");
  if (instance !== undefined && !isInt(instance, 1, INSTANCE_MAX)) fail(`join: instance must be an integer 1..${INSTANCE_MAX}`);
  const room = instance === undefined ? { kind: "lobby" } : { kind: "lobby", instance };
  return rid === undefined ? { t: "join", room } : { t: "join", rid, room };
}

export const buildLeave = () => ({ t: "leave" });

// One public chat line, only while joined. The server cleans and measures
// the text itself (chatText.js mirrors it); this takes any string, as the
// server does, and the session sends what prepareOutgoing made of it.
// Effect prefixes ("red:wave:") are plain text here.
export function buildChat(text, rid) {
  if (typeof text !== "string") fail("chat: text must be a string");
  if (rid !== undefined && !isInt(rid, 0, RID_MAX)) fail("chat: rid must be an integer 0..2^32-1");
  return rid === undefined ? { t: "chat", text } : { t: "chat", rid, text };
}

// appearance: every field of APPEARANCE_FIELDS, nothing else. equipment:
// slot -> item id; a slot that is absent, null or undefined is empty.
// combat: optional, the player's combat level (COMBAT_MIN..COMBAT_MAX); left
// out of the message when undefined or null.
export function buildAppearance(appearance, equipment, combat) {
  if (!isObject(appearance)) fail("appearance: not an object");
  onlyKeys(appearance, APPEARANCE_FIELDS, "appearance");
  const look = {};
  for (const field of APPEARANCE_FIELDS) {
    const [min, max] = appearanceRange(field);
    if (!isInt(appearance[field], min, max)) fail(`appearance: ${field} must be an integer ${min}..${max}`);
    look[field] = appearance[field];
  }
  if (!isObject(equipment)) fail("appearance: equipment is not an object");
  onlyKeys(equipment, EQUIPMENT_SLOTS, "equipment");
  const worn = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const item = equipment[slot];
    if (item === undefined || item === null) continue;
    if (!isInt(item, 0, ITEM_ID_MAX)) fail(`equipment: ${slot} must be an item id 0..${ITEM_ID_MAX}`);
    worn[slot] = item;
  }
  if (combat === undefined || combat === null) return { t: "appearance", appearance: look, equipment: worn };
  if (!isCombat(combat)) fail(`appearance: combat must be an integer ${COMBAT_MIN}..${COMBAT_MAX}`);
  return { t: "appearance", appearance: look, equipment: worn, combat };
}

// One local tick: the tile now, the tiles stepped onto this tick in order
// (0 to 2, each next to the one before, the last one the tile), running or
// not, and the facing angle. face: optional, the id of the player this one
// keeps facing (the leader it follows); left out of the message when undefined
// or null.
export function buildPresence({ tile, steps = [], run, facing, face, ...rest } = {}) {
  onlyKeys(rest, [], "presence");
  const now = tileCopy(tile, "presence: tile");
  if (!Array.isArray(steps) || steps.length > STEPS_PER_PRESENCE_MAX) fail(`presence: steps must be an array of at most ${STEPS_PER_PRESENCE_MAX} tiles`);
  const path = steps.map((step, i) => tileCopy(step, `presence: step ${i}`));
  for (let i = 1; i < path.length; i++) if (!isAdjacent(path[i - 1], path[i])) fail("presence: steps are not adjacent");
  if (path.length && !tilesEqual(path[path.length - 1], now)) fail("presence: the last step is not the tile");
  if (typeof run !== "boolean") fail("presence: run must be a boolean");
  if (!isFacing(facing)) fail(`presence: facing must be an integer 0..${FACING_MAX}`);
  if (face === undefined || face === null) return { t: "presence", tile: now, steps: path, run, facing };
  if (!isId(face)) fail("presence: face must be a player id");
  return { t: "presence", tile: now, steps: path, run, facing, face };
}

// ts: the client's clock, whole milliseconds.
export function buildPing(ts) {
  if (!isInt(ts, 0, Number.MAX_SAFE_INTEGER)) fail("ping: ts must be a whole number of milliseconds");
  return { t: "ping", ts };
}

// Would the server take this body as it is? Builds it again from its own
// fields: a field the builder does not take, or a value it refuses, fails.
export function checkClientMessage(body) {
  try {
    if (!isObject(body)) fail("not an object");
    const { t, ...fields } = body;
    if (typeof t !== "string") fail("t is not a string");
    switch (t) {
      case "hello":
        onlyKeys(fields, ["proto", "build", "enc"], "hello");
        if (!("enc" in fields)) fail("hello: enc is missing");
        buildHello(fields);
        break;
      case "join": {
        onlyKeys(fields, ["rid", "room"], "join");
        if (!isObject(fields.room)) fail("join: room is missing");
        const { kind, ...room } = fields.room;
        if (kind !== "lobby") fail(`join: room kind ${JSON.stringify(kind)} is not served`);
        onlyKeys(room, ["instance"], "join room");
        buildJoin({ rid: fields.rid, instance: room.instance });
        break;
      }
      case "leave":
        onlyKeys(fields, [], "leave");
        break;
      case "appearance":
        onlyKeys(fields, ["appearance", "equipment", "combat"], "appearance");
        if (fields.combat === null) fail("appearance: combat is left out, not null");
        buildAppearance(fields.appearance, fields.equipment, fields.combat);
        break;
      case "presence":
        if (!("run" in fields)) fail("presence: run is missing");
        buildPresence(fields);
        break;
      case "chat":
        onlyKeys(fields, ["rid", "text"], "chat");
        buildChat(fields.text, fields.rid);
        break;
      case "ping":
        onlyKeys(fields, ["ts"], "ping");
        buildPing(fields.ts);
        break;
      default:
        fail(`no message of type ${JSON.stringify(t)} in protocol 1 that the client sends`);
    }
    return { ok: true };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, reason: error.message };
  }
}

// --- server to client ------------------------------------------------------------

// A member of a room; appearance, equipment, tile and facing are null until
// that player has sent them.
function readMember(value) {
  if (!isObject(value) || !isId(value.id) || !isName(value.name)) return null;
  const member = { id: value.id, name: value.name };
  const optional = {
    appearance: readAppearance,
    equipment: readEquipment,
    tile: (tile) => (isTile(tile) ? [tile[0], tile[1]] : null),
    facing: (facing) => (isFacing(facing) ? facing : null),
  };
  for (const [field, read] of Object.entries(optional)) {
    if (value[field] === undefined || value[field] === null) member[field] = null;
    else if ((member[field] = read(value[field])) === null) return null;
  }
  // combat: newer than the other fields, so an older message without it stays as it was.
  if (value.combat !== undefined) {
    if (value.combat !== null && !isCombat(value.combat)) return null;
    member.combat = value.combat;
  }
  // face: the player this one keeps facing; only there while it does.
  if (value.face !== undefined) {
    if (!isId(value.face)) return null;
    member.face = value.face;
  }
  return member;
}

function readDelta(value) {
  if (!isObject(value) || !isId(value.id) || !isTile(value.tile) || typeof value.run !== "boolean" || !isFacing(value.facing)) return null;
  // Merged steps need not chain: a dropped or teleporting presence leaves a gap.
  if (!Array.isArray(value.steps) || value.steps.length > MERGED_STEPS_MAX || !value.steps.every(isTile)) return null;
  if (value.face !== undefined && !isId(value.face)) return null;
  const delta = { id: value.id, tile: [value.tile[0], value.tile[1]], steps: value.steps.map((step) => [step[0], step[1]]), run: value.run, facing: value.facing };
  if (value.face !== undefined) delta.face = value.face;
  return delta;
}

// The limits every welcome carries; the chat limits are optional.
const REQUIRED_LIMITS = Object.keys(DEFAULT_LIMITS).filter((field) => !field.startsWith("chat_"));

const optionalRid = (value) => value === undefined || isInt(value, 0, RID_MAX);
const withRid = (msg, rid) => (rid === undefined ? msg : { ...msg, rid });

const readers = {
  welcome(body) {
    if (body.proto !== PROTOCOL_VERSION) return "proto is not 1";
    if (!isObject(body.you) || !isId(body.you.id) || !isName(body.you.name)) return "you is not {id, name}";
    const limits = body.limits;
    if (!isObject(limits)) return "limits is missing";
    const positive = ["max_message_bytes", "msg_per_sec", "msg_burst", "tick_ms"];
    if (!positive.every((field) => isInt(limits[field], 1, Number.MAX_SAFE_INTEGER))) return "a limit is not a positive integer";
    if (!isInt(limits.tile_min, TILE_MIN, TILE_MAX) || !isInt(limits.tile_max, limits.tile_min, TILE_MAX)) return "the tile limits are off the grid";
    // The builders never send more than STEPS_PER_PRESENCE_MAX, whatever this says.
    if (!isInt(limits.steps_max, 0, 64)) return "steps_max is out of range";
    if (!isInt(body.server_tick, 0, Number.MAX_SAFE_INTEGER)) return "server_tick is not a tick";
    const chatLimits = {};
    for (const [field, min, max] of [["chat_max_chars", 1, CHAT_MAX_CHARS_CAP], ["chat_interval_ms", 0, CHAT_RETRY_MAX_MS]]) {
      if (limits[field] === undefined) continue;
      if (!isInt(limits[field], min, max)) return `${field} is out of range`;
      chatLimits[field] = limits[field];
    }
    const features = {};
    if (isObject(body.features)) for (const [name, on] of Object.entries(body.features)) if (typeof on === "boolean") features[name] = on;
    return {
      t: "welcome",
      proto: body.proto,
      you: { id: body.you.id, name: body.you.name },
      limits: { ...Object.fromEntries(REQUIRED_LIMITS.map((field) => [field, limits[field]])), ...chatLimits },
      features,
      server_tick: body.server_tick,
    };
  },
  error(body) {
    if (typeof body.code !== "string" || !/^[a-z_]{1,64}$/.test(body.code)) return "code is not an error code";
    if (typeof body.msg !== "string" || body.msg.length === 0 || charCount(body.msg) > ERROR_MSG_MAX_CHARS) return "msg is not 1 to 200 characters";
    if (!optionalRid(body.rid)) return "rid is not a request id";
    return withRid({ t: "error", code: body.code, msg: body.msg }, body.rid);
  },
  joined(body) {
    const room = body.room;
    if (!isObject(room) || room.kind !== "lobby" || !isInt(room.instance, 1, INSTANCE_MAX) || room.id !== `lobby-${room.instance}`) return "room is not a lobby instance";
    if (!optionalRid(body.rid)) return "rid is not a request id";
    if (!Array.isArray(body.members) || body.members.length > OTHERS_MAX) return `members is not a list of at most ${OTHERS_MAX}`;
    const members = body.members.map(readMember);
    if (members.includes(null)) return "a member is not valid";
    return withRid({ t: "joined", room: { id: room.id, kind: room.kind, instance: room.instance }, members }, body.rid);
  },
  member_join(body) {
    const member = readMember(body.member);
    return member ? { t: "member_join", member } : "member is not valid";
  },
  member_leave(body) {
    return isId(body.id) ? { t: "member_leave", id: body.id } : "id is not an id";
  },
  appearance_set(body) {
    const appearance = readAppearance(body.appearance), equipment = readEquipment(body.equipment);
    if (!isId(body.id) || !appearance || !equipment) return "id, appearance or equipment is not valid";
    if (body.combat === undefined) return { t: "appearance_set", id: body.id, appearance, equipment };
    if (body.combat !== null && !isCombat(body.combat)) return `combat is not null or an integer ${COMBAT_MIN}..${COMBAT_MAX}`;
    return { t: "appearance_set", id: body.id, appearance, equipment, combat: body.combat };
  },
  presence_tick(body) {
    if (!isInt(body.tick, 0, Number.MAX_SAFE_INTEGER)) return "tick is not a tick";
    // Never empty: a tick nobody moved in is not sent.
    if (!Array.isArray(body.d) || body.d.length === 0 || body.d.length > MEMBERS_MAX) return `d is not a list of 1 to ${MEMBERS_MAX}`;
    const d = body.d.map(readDelta);
    if (d.includes(null)) return "an entry of d is not valid";
    return { t: "presence_tick", tick: body.tick, d };
  },
  pong(body) {
    if (!isInt(body.ts, 0, Number.MAX_SAFE_INTEGER) || !isInt(body.server_tick, 0, Number.MAX_SAFE_INTEGER)) return "ts or server_tick is not valid";
    return { t: "pong", ts: body.ts, server_tick: body.server_tick };
  },
  // Plain text, shown as received: never markup, never game tags.
  chat(body, { limits }) {
    const max = isInt(limits?.chat_max_chars, 1, CHAT_MAX_CHARS_CAP) ? limits.chat_max_chars : DEFAULT_LIMITS.chat_max_chars;
    if (!isId(body.id) || !isName(body.name)) return "id or name is not valid";
    if (typeof body.text !== "string" || body.text.length === 0 || charCount(body.text) > max) return `text is not 1 to ${max} characters`;
    if (!isInt(body.tick, 0, Number.MAX_SAFE_INTEGER)) return "tick is not a tick";
    return { t: "chat", id: body.id, name: body.name, text: body.text, tick: body.tick };
  },
  chat_rejected(body) {
    if (!CHAT_REJECT_REASONS.includes(body.reason)) return "reason is not a chat refusal";
    if (!optionalRid(body.rid)) return "rid is not a request id";
    const rateLimited = body.reason === "rate_limited";
    if (rateLimited !== (body.retry_in_ms !== undefined)) return "retry_in_ms comes with rate_limited, and only with it";
    if (rateLimited && !isInt(body.retry_in_ms, 0, CHAT_RETRY_MAX_MS)) return "retry_in_ms is not a delay";
    const msg = withRid({ t: "chat_rejected" }, body.rid);
    msg.reason = body.reason;
    if (rateLimited) msg.retry_in_ms = body.retry_in_ms;
    return msg;
  },
  notice(body) {
    if (typeof body.kind !== "string" || body.kind.length === 0) return "kind is not a string";
    if (body.in_sec !== undefined && !isInt(body.in_sec, 0, 86400)) return "in_sec is not a number of seconds";
    return body.in_sec === undefined ? { t: "notice", kind: body.kind } : { t: "notice", kind: body.kind, in_sec: body.in_sec };
  },
};

// options.limits: the welcome's limits, for the length of a chat line
// (DEFAULT_LIMITS when not given).
export function parseServerMessage(text, { limits = DEFAULT_LIMITS } = {}) {
  if (typeof text !== "string") return { ok: false, reason: "not a text frame" };
  if (text.length > SERVER_MESSAGE_MAX_CHARS) return { ok: false, reason: "too long" };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: "not JSON" };
  }
  if (!isObject(body)) return { ok: false, reason: "not an object" };
  if (typeof body.t !== "string") return { ok: false, reason: "t is not a string" };
  if (!Object.hasOwn(readers, body.t)) return { ok: false, reason: `unknown type ${JSON.stringify(body.t.slice(0, 32))}`, unknownType: true };
  const msg = readers[body.t](body, { limits });
  return typeof msg === "string" ? { ok: false, reason: `${body.t}: ${msg}` } : { ok: true, msg };
}
