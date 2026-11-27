// client/net/protocol.js against contract/fixtures/ws/: every valid server
// message parses to itself, every valid client message is built again
// exactly from its own field values, and every invalid one is refused, by
// the parser or by the builders. Then the edges the fixtures do not pin.
import assert from "node:assert/strict";

import {
  APPEARANCE_RANGES,
  DEFAULT_LIMITS,
  ITEM_ID_MAX,
  SERVER_MESSAGE_MAX_CHARS,
  CHAT_REJECT_REASONS,
  buildAppearance,
  buildChat,
  buildHello,
  buildJoin,
  buildLeave,
  buildPing,
  buildPresence,
  checkClientMessage,
  closeCodes,
  parseServerMessage,
  retryPolicy,
} from "../client/net/protocol.js";
import { fixtureBody, readFixtures } from "./net-fakes.mjs";

const valid = readFixtures("valid");
const invalid = readFixtures("invalid");
assert.ok(valid.length >= 30 && invalid.length >= 60, `${valid.length} valid, ${invalid.length} invalid fixtures`);

// The builder of each client message, called with the fixture's field values.
const rebuild = {
  hello: (body) => buildHello({ build: body.build, proto: body.proto, enc: body.enc }),
  join: (body) => buildJoin({ rid: body.rid, instance: body.room?.instance }),
  leave: () => buildLeave(),
  appearance: (body) => buildAppearance(body.appearance, body.equipment, body.combat),
  presence: ({ t, ...fields }) => buildPresence(fields),
  ping: (body) => buildPing(body.ts),
  chat: (body) => buildChat(body.text, body.rid),
};

for (const fixture of valid) {
  const text = JSON.stringify(fixture.body);
  if (fixture.direction === "server") {
    const parsed = parseServerMessage(text);
    assert.ok(parsed.ok, `${fixture.name}: ${parsed.reason}`);
    assert.deepEqual(parsed.msg, fixture.body, fixture.name);
  } else {
    assert.equal(fixture.direction, "client", fixture.name);
    assert.deepEqual(checkClientMessage(fixture.body), { ok: true }, fixture.name);
    // Byte for byte, field order included.
    assert.equal(JSON.stringify(rebuild[fixture.body.t](fixture.body)), text, fixture.name);
  }
}

// Invalid server messages the client takes anyway, and why. The parser is
// lenient by decision: a field it does not know is dropped, never passed on,
// so a newer server can add one. These two are invalid only because the
// server refuses unknown fields of its own.
const acceptedByDesign = {
  "welcome.extra-field": "motd",
  "member-join.segments": "segments",
  "chat.segments": "segments",
};
// Invalid client messages that no builder can make at all.
const noBuilder = {
  "report.reserved": "report is reserved; protocol 1 has no client builder for it",
  "ls-cmd.reserved": "lockstep is reserved; no builder",
  "emote.unknown-type": "not a protocol 1 type; no builder",
  "no-t": "every builder sets t",
  "not-an-object": "every builder returns one object",
  "t-number": "every builder sets t to its type name",
};

const cannotMake = [];
const findKey =(value, key) => value !== null && typeof value === "object" && (Object.hasOwn(value, key) || Object.values(value).some((inner) => findKey(inner, key)));

for (const fixture of invalid) {
  if (fixture.direction === "server") {
    const parsed = parseServerMessage(JSON.stringify(fixture.body));
    if (acceptedByDesign[fixture.name]) {
      assert.ok(parsed.ok, `${fixture.name}: ${parsed.reason}`);
      assert.ok(!findKey(parsed.msg, acceptedByDesign[fixture.name]), `${fixture.name}: the unknown field is dropped`);
    } else assert.equal(parsed.ok, false, `${fixture.name} (${fixture.why}) was accepted`);
    continue;
  }
  assert.equal(fixture.direction, "client", fixture.name);
  const checked = checkClientMessage(fixture.body);
  assert.equal(checked.ok, false, `${fixture.name} (${fixture.why}) was accepted`);
  const build = fixture.body && !Array.isArray(fixture.body) ? rebuild[fixture.body.t] : undefined;
  if (noBuilder[fixture.name]) {
    assert.equal(build, undefined, fixture.name);
    continue;
  }
  // The builder refuses the values, or cannot make this body from them (a
  // field it has no parameter for, a room kind it does not write).
  let made;
  try {
    made = build(fixture.body);
  } catch (error) {
    assert.ok(error instanceof TypeError, `${fixture.name}: ${error}`);
    continue;
  }
  assert.notEqual(JSON.stringify(made), JSON.stringify(fixture.body), `${fixture.name}: the builder made it`);
  cannotMake.push(fixture.name);
}
// Which ones those are: each has a field or kind the builders never write.
assert.deepEqual(cannotMake.sort(), ["chat.color-field", "hello.extra-field", "hello.missing-enc", "join.party", "join.room-missing", "join.room-unknown-kind", "leave.extra-field"]);
assert.ok(Object.keys(acceptedByDesign).every((name) => invalid.some((fixture) => fixture.name === name)));
assert.ok(Object.keys(noBuilder).every((name) => invalid.some((fixture) => fixture.name === name)));

// The ranges of the appearance come from the fixtures: each invalid
// appearance fixture moves one field just past the end of its range.
const look = fixtureBody("valid", "appearance");
let rangesSeen = 0;
for (const fixture of invalid.filter((fixture) => fixture.body?.t === "appearance")) {
  const changed = Object.keys(APPEARANCE_RANGES).filter((field) => field in fixture.body.appearance && fixture.body.appearance[field] !== look.appearance[field]);
  if (changed.length !== 1) continue;
  const [field] = changed, value = fixture.body.appearance[field], [min, max] = APPEARANCE_RANGES[field];
  assert.ok(value === max + 1 || value === min - 1, `${fixture.name}: ${field} ${value} is not just outside [${min}, ${max}]`);
  const inside = value === max + 1 ? max : min;
  assert.doesNotThrow(() => buildAppearance({ ...look.appearance, [field]: inside }, {}), `${field} ${inside}`);
  rangesSeen++;
}
assert.ok(rangesSeen >= 4, `${rangesSeen} appearance ranges read from the fixtures`);
const tooBigItem = fixtureBody("invalid", "appearance.item-too-big").equipment.weapon;
assert.equal(tooBigItem, ITEM_ID_MAX + 1);
assert.doesNotThrow(() => buildAppearance(look.appearance, { weapon: ITEM_ID_MAX }));

// Presence: the edges the builder holds that the fixtures do not.
const presence = { tile: [31, 26], steps: [[31, 26]], run: false, facing: 1024 };
assert.deepEqual(buildPresence(presence), { t: "presence", ...presence });
assert.throws(() => buildPresence({ ...presence, steps: [[31, 25]] }), TypeError, "the last step is the tile");
assert.throws(() => buildPresence({ ...presence, facing: -1 }), TypeError);
assert.throws(() => buildPresence({ ...presence, facing: 1.5 }), TypeError);
assert.throws(() => buildPresence({ ...presence, run: 0 }), TypeError);
assert.throws(() => buildPresence({ ...presence, tile: ["31", 26] }), TypeError);
assert.throws(() => buildPresence({ ...presence, tile: [31, 64], steps: [] }), TypeError);
assert.throws(() => buildPresence({ ...presence, steps: "x" }), TypeError);
assert.deepEqual(buildPresence({ tile: [0, 0], run: false, facing: 0 }).steps, [], "steps default to none");
// Diagonal and same-tile steps chain.
assert.ok(buildPresence({ tile: [2, 2], steps: [[1, 1], [2, 2]], run: true, facing: 1280 }));
assert.ok(buildPresence({ tile: [2, 2], steps: [[2, 2], [2, 2]], run: true, facing: 1280 }));
// The values are copied: changing the caller's array later changes nothing sent.
const tile = [5, 5];
const built = buildPresence({ tile, steps: [], run: false, facing: 0 });
tile[0] = 6;
assert.deepEqual(built.tile, [5, 5]);

// Hello, join, ping.
assert.throws(() => buildHello({}), TypeError);
assert.throws(() => buildHello({ build: "<b>" }), TypeError);
assert.throws(() => buildHello({ build: "a".repeat(65) }), TypeError);
assert.ok(buildHello({ build: "a".repeat(64) }));
assert.throws(() => buildJoin({ rid: 2 ** 32 }), TypeError);
assert.throws(() => buildJoin({ instance: "2" }), TypeError);
assert.throws(() => buildPing(Number.MAX_SAFE_INTEGER + 1), TypeError);
assert.throws(() => buildAppearance({ ...look.appearance }, null), TypeError);
assert.throws(() => buildAppearance(null, {}), TypeError);
// A null slot is an empty slot.
assert.deepEqual(buildAppearance(look.appearance, { weapon: 4151, shield: null }).equipment, { weapon: 4151 });

// combat: optional, 3 to 126, last in the message; absent when not given.
assert.equal("combat" in buildAppearance(look.appearance, {}), false);
assert.equal("combat" in buildAppearance(look.appearance, {}, null), false);
assert.deepEqual(Object.keys(buildAppearance(look.appearance, {}, 126)), ["t", "appearance", "equipment", "combat"]);
assert.equal(buildAppearance(look.appearance, {}, 3).combat, 3);
for (const bad of [2, 127, 50.5, "90", -1]) assert.throws(() => buildAppearance(look.appearance, {}, bad), TypeError, String(bad));
assert.deepEqual(checkClientMessage({ t: "appearance", appearance: look.appearance, equipment: {}, combat: 90 }), { ok: true });
assert.equal(checkClientMessage({ t: "appearance", appearance: look.appearance, equipment: {}, combat: null }).ok, false);
assert.equal(checkClientMessage({ t: "appearance", appearance: look.appearance, equipment: {}, combat: 200 }).ok, false);
// From the server: combat on a member and on appearance_set, a level or null;
// a message without it parses as before, without the field.
{
  const withCombat = (combat) => parseServerMessage(JSON.stringify({ t: "member_join", member: { id: 3, name: "A", appearance: null, equipment: null, tile: null, facing: null, combat } }));
  assert.equal(withCombat(126).msg.member.combat, 126);
  assert.equal(withCombat(null).msg.member.combat, null);
  assert.equal("combat" in withCombat(undefined).msg.member, false);
  for (const bad of [2, 127, "3", 3.5]) assert.equal(withCombat(bad).ok, false, String(bad));
  const set = (combat) => parseServerMessage(JSON.stringify({ t: "appearance_set", id: 3, appearance: look.appearance, equipment: {}, combat }));
  assert.equal(set(70).msg.combat, 70);
  assert.equal(set(null).msg.combat, null);
  assert.equal("combat" in set(undefined).msg, false);
  assert.equal(set(0).ok, false);
}

// The parser never throws, whatever it is given.
for (const text of ["", "null", "1", '"x"', "[]", "{", '{"t":null}', '{"t":{}}', "\u0000", undefined, null, 42, {}, '{"t":"welcome"}', '{"t":"joined","room":null}', '{"t":"presence_tick","tick":1,"d":[null]}', '{"t":"member_join","member":{"id":1,"name":{"length":3}}}', '{"t":"toString"}', '{"t":"__proto__"}', '{"t":"constructor"}']) {
  const parsed = parseServerMessage(text);
  assert.equal(parsed.ok, false, JSON.stringify(text));
  assert.equal(typeof parsed.reason, "string");
}
assert.equal(parseServerMessage('{"t":"pong","ts":1,"server_tick":2,' + `"pad":"${"x".repeat(SERVER_MESSAGE_MAX_CHARS)}"}`).ok, false, "oversized text");
// Unknown types are dropped and said to be unknown.
assert.equal(parseServerMessage('{"t":"emote","id":1}').unknownType, true);
// Names: 1 to 24 characters, counted as characters, not UTF-16 units; markup stays text.
const member = (name) => parseServerMessage(JSON.stringify({ t: "member_join", member: { id: 3, name, appearance: null, equipment: null, tile: null, facing: null } }));
assert.equal(member("😀".repeat(24)).ok, true);
assert.equal(member("😀".repeat(25)).ok, false);
assert.equal(member("<img src=x onerror=alert(1)>").ok, false, "over 24 characters");
assert.equal(member("<b>x</b>").msg.member.name, "<b>x</b>");
assert.equal(member(7).ok, false);
// Ids are positive safe integers.
assert.equal(parseServerMessage('{"t":"member_leave","id":9007199254740992}').ok, false);
assert.equal(parseServerMessage('{"t":"member_leave","id":1.5}').ok, false);
// An unknown equipment slot from the server is dropped, not passed on.
const set = parseServerMessage(JSON.stringify({ ...fixtureBody("valid", "appearance-set"), equipment: { weapon: 4151, pet: 1 } }));
assert.deepEqual(set.msg.equipment, { weapon: 4151 });
// A delta's merged steps need not chain, but stay on the grid.
const tick = fixtureBody("valid", "presence-tick");
assert.equal(parseServerMessage(JSON.stringify({ ...tick, d: [{ ...tick.d[0], steps: [[1, 1], [40, 40]] }] })).ok, true);
assert.equal(parseServerMessage(JSON.stringify({ ...tick, d: [{ ...tick.d[0], steps: [[1, 64]] }] })).ok, false);
// The welcome's limits are passed on as the server set them (not this client's defaults).
const welcome = fixtureBody("valid", "welcome");
const smaller = parseServerMessage(JSON.stringify({ ...welcome, limits: { ...welcome.limits, max_message_bytes: 4096 } }));
assert.equal(smaller.msg.limits.max_message_bytes, 4096);
assert.equal(parseServerMessage(JSON.stringify({ ...welcome, limits: { ...welcome.limits, tick_ms: 0 } })).ok, false);
assert.ok(DEFAULT_LIMITS.max_message_bytes <= welcome.limits.max_message_bytes);

// Close codes and what is retried.
const expected = { 1000: "soon", 1001: "soon", 1003: "slow", 1006: "soon", 1009: "slow", 4000: "soon", 4001: "never", 4002: "soon", 4003: "never", 4008: "soon", 4009: "never", 4010: "never", 4011: "slow", 4029: "slow" };
for (const [code, retry] of Object.entries(expected)) assert.equal(retryPolicy(Number(code)), retry, code);
assert.equal(retryPolicy(1011), "soon", "a code nobody listed is a dropped connection");
assert.deepEqual(Object.keys(closeCodes).map(Number), Object.keys(expected).map(Number));
assert.match(closeCodes[4010].meaning, /refresh/);
// Chat: the welcome's limits and features, the line, its refusals, the notices.
const chatWelcome = parseServerMessage(JSON.stringify(welcome)).msg;
assert.equal(chatWelcome.limits.chat_max_chars, 80);
assert.equal(chatWelcome.limits.chat_interval_ms, 4000);
assert.equal(chatWelcome.features.chat, true);
assert.equal(parseServerMessage(JSON.stringify(fixtureBody("valid", "welcome.chat-off"))).msg.features.chat, false);
const { chat_max_chars, chat_interval_ms, ...oldLimits } = welcome.limits;
assert.deepEqual(parseServerMessage(JSON.stringify({ ...welcome, limits: oldLimits })).msg.limits, oldLimits, "a welcome without chat limits leaves them out");
assert.equal(parseServerMessage(JSON.stringify({ ...welcome, limits: { ...welcome.limits, chat_max_chars: 0 } })).ok, false);
assert.equal(parseServerMessage(JSON.stringify({ ...welcome, limits: { ...welcome.limits, chat_interval_ms: -1 } })).ok, false);
assert.equal(DEFAULT_LIMITS.chat_max_chars, 80);
assert.equal(DEFAULT_LIMITS.chat_interval_ms, 4000);

const line = fixtureBody("valid", "chat");
const chatLine = (fields, options) => parseServerMessage(JSON.stringify({ ...line, ...fields }), options);
assert.equal(chatLine({ text: "x".repeat(80) }).ok, true);
assert.equal(chatLine({ text: "x".repeat(81) }).ok, false, "over the default 80");
assert.equal(chatLine({ text: "😀".repeat(80) }).ok, true, "counted as characters, not UTF-16 units");
assert.equal(chatLine({ text: "x".repeat(81) }, { limits: { chat_max_chars: 100 } }).ok, true, "the welcome's limit");
assert.equal(chatLine({ text: "xx" }, { limits: { chat_max_chars: 1 } }).ok, false);
assert.equal(chatLine({ name: "" }).ok, false);
assert.equal(chatLine({ name: "x".repeat(24) }).ok, true);
assert.equal(chatLine({ id: 0 }).ok, false);
assert.equal(chatLine({ tick: -1 }).ok, false);
assert.equal(chatLine({ text: null }).ok, false);
// Markup and game tags are text, kept exactly.
for (const text of ["<col=ff0000>red</col>", "<img=1>", "a<br>b", "&amp; <b>x</b> > <"]) assert.equal(chatLine({ text }).msg.text, text);
assert.equal(chatLine({ name: "<col=ff0000>" }).msg.name, "<col=ff0000>");
assert.deepEqual(Object.keys(chatLine({ color: "#f00" }).msg), ["t", "id", "name", "text", "tick"], "no styling from the network");

const rejected = (fields) => parseServerMessage(JSON.stringify({ t: "chat_rejected", ...fields }));
for (const reason of CHAT_REJECT_REASONS) assert.equal(rejected(reason === "rate_limited" ? { reason, retry_in_ms: 0 } : { reason }).ok, true, reason);
assert.equal(rejected({ reason: "muted" }).ok, true, "muted is taken already");
assert.equal(rejected({ reason: "rate_limited", retry_in_ms: 1.5 }).ok, false);
assert.equal(rejected({ reason: "rate_limited", retry_in_ms: -1 }).ok, false);
assert.equal(rejected({ reason: "empty", rid: -1 }).ok, false);
assert.equal(rejected({}).ok, false);
assert.deepEqual(parseServerMessage(JSON.stringify(fixtureBody("valid", "notice.chat-off"))).msg, { t: "notice", kind: "chat_off" });

assert.deepEqual(buildChat("gz"), { t: "chat", text: "gz" });
assert.equal(JSON.stringify(buildChat("gz", 9)), JSON.stringify(fixtureBody("valid", "chat.with-rid")));
assert.throws(() => buildChat(7), TypeError);
assert.throws(() => buildChat("x", -1), TypeError);
assert.throws(() => buildChat("x", 2 ** 32), TypeError);
assert.equal(checkClientMessage({ t: "chat", text: "hi", segments: [] }).ok, false);

console.log(`ok: ${valid.length} valid and ${invalid.length} invalid fixtures`);
