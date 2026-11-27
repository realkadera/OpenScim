// client/net/chatText.js: the cleaning the server applies to a chat line
// (contract/fixtures/ws/README.md, "Chat"), the length it measures, and the
// OSRS capitals and effect prefixes on top of it.
import assert from "node:assert/strict";

import {
  CHAT_COLOURS,
  CHAT_EFFECTS,
  capitalise,
  chatLength,
  cleanChatText,
  hasVisibleText,
  parseChatEffects,
  prepareOutgoing,
} from "../client/net/chatText.js";
import { fixtureBody, readFixtures } from "./net-fakes.mjs";

// The fixtures: the raw client line is relayed in its cleaned form, and every
// text the server relays is already clean (cleaning it again changes nothing).
const raw = { "chat.raw": "twospaces", "chat.blanks": "buying gf free items" };
for (const [name, cleaned] of Object.entries(raw)) assert.equal(cleanChatText(fixtureBody("valid", name).text), cleaned, name);
assert.equal(prepareOutgoing(fixtureBody("valid", "chat.blanks").text).text, "Buying gf free items");
for (const fixture of readFixtures("valid").filter((f) => f.body.t === "chat")) {
  const text = fixture.body.text;
  if (raw[fixture.name]) continue;
  assert.equal(cleanChatText(text), text, fixture.name);
  if (fixture.direction === "server") assert.equal(prepareOutgoing(text).ok, true, fixture.name);
}

// The tricky characters, step by step.
const cases = [
  // 1. White_Space and the invisible blanks become spaces.
  ["a\tb", "a b"],
  ["a\nb\r\nc", "a b c"],
  ["a b", "a b"],
  ["a b c", "a b c"],
  ["a　b", "a b"],
  ["a⠀b", "a b"],
  ["aㅤb", "a b"],
  ["aﾠb", "a b"],
  ["a\u{16FE4}b", "a b"],
  ["ㅤ", ""],
  ["⠀⠀⠀", ""],
  // 2. Controls, format characters, private use, unassigned, default-ignorables, U+FFFC.
  ["a​b", "ab"],
  ["a‌b‍b", "abb"],
  ["‮evil‬", "evil"],
  ["⁦x⁩", "x"],
  ["a­b", "ab"],
  ["﻿hi", "hi"],
  ["a\u0000b\u001fc\u007f", "abc"],
  ["a\u0085b", "a b"], // NEL is White_Space before it is a control
  ["ab", "ab"],
  ["a\u{F0000}b", "ab"],
  ["a￾b￿c", "abc"],
  ["a\u{10FFFF}", "a"],
  ["a￼b", "ab"],
  ["a͏b", "ab"], // COMBINING GRAPHEME JOINER: a mark, and default-ignorable
  ["a️b", "ab"], // a variation selector
  ["a\ud800b", "ab"], // a lone surrogate
  // Emoji: the ZWJ is default-ignorable and goes, the family falls apart.
  ["👨‍👩‍👧", "👨👩👧"],
  ["😀", "😀"],
  // 3. NFC.
  ["é", "é"],
  ["Å", "Å"],
  // 4. Marks: at most 2 after a base; none without one.
  ["à́̂̃", "à́̂"], // NFC takes the first into à
  ["q̀́̂̃", "q̀́"],
  ["é́́", "é́́"],
  ["́́a", "a"],
  ["a ́̂b", "a b"],
  ["Z" + "̶".repeat(30), "Z̶̶"],
  // 5. Spaces collapsed, ends trimmed.
  ["  a   b  ", "a b"],
  [" \t\n ", ""],
  // Markup and game tags are text.
  ["<col=ff0000>hi</col>", "<col=ff0000>hi</col>"],
  ["<img=2> &amp; <br>", "<img=2> &amp; <br>"],
];
for (const [raw, cleaned] of cases) assert.equal(cleanChatText(raw), cleaned, JSON.stringify(raw));
for (const [raw] of cases) assert.equal(cleanChatText(cleanChatText(raw)), cleanChatText(raw), `idempotent: ${JSON.stringify(raw)}`);
assert.equal(cleanChatText(undefined), "");
assert.equal(cleanChatText(7), "");

// Length: scalar values, not UTF-16 units.
assert.equal(chatLength("😀"), 1);
assert.equal(chatLength("😀".repeat(80)), 80);
assert.equal(chatLength(cleanChatText("é")), 1);

// 6. A line needs a letter, number, punctuation or symbol.
assert.equal(hasVisibleText("a"), true);
assert.equal(hasVisibleText("."), true);
assert.equal(hasVisibleText("😀"), true);
assert.equal(hasVisibleText(" "), false);
assert.deepEqual(prepareOutgoing("́"), { ok: false, reason: "empty" });
assert.deepEqual(prepareOutgoing("​ ㅤ"), { ok: false, reason: "empty" });
assert.deepEqual(prepareOutgoing(""), { ok: false, reason: "empty" });
assert.deepEqual(prepareOutgoing(null), { ok: false, reason: "empty" });

// 7. Too long after cleaning, never cut; the prefix counts.
assert.deepEqual(prepareOutgoing("x".repeat(80)), { ok: true, text: "X" + "x".repeat(79) });
assert.deepEqual(prepareOutgoing("x".repeat(81)), { ok: false, reason: "too_long" });
assert.equal(prepareOutgoing("😀".repeat(80)).ok, true);
assert.equal(prepareOutgoing(" ".repeat(50) + "x".repeat(80) + "​".repeat(20)).ok, true, "measured after cleaning");
assert.deepEqual(prepareOutgoing("red:wave:" + "x".repeat(72)), { ok: false, reason: "too_long" });
assert.equal(prepareOutgoing("red:wave:" + "x".repeat(71)).ok, true);
assert.deepEqual(prepareOutgoing("x".repeat(81), { chat_max_chars: 100 }).ok, true);
// A raw text over 16 bytes a character is refused before cleaning, as the server does.
assert.deepEqual(prepareOutgoing("x" + "​".repeat(500)), { ok: false, reason: "too_long" });

// Capitals (OBS, the game's client): the first letter and the first after ".", "?", "!"; lower case inside a word.
assert.equal(capitalise("hello there. how are you? fine! ok"), "Hello there. How are you? Fine! Ok");
assert.equal(capitalise("i AM Here"), "I Am Here");
assert.equal(capitalise("HELLO WORLD"), "Hello World");
assert.equal(capitalise("1 apple.no space"), "1 apple.No space");
assert.equal(capitalise("étoile"), "Étoile");
assert.equal(capitalise("ßtraße"), "ßtraße", "a capital of two letters is left alone");
assert.equal(capitalise(""), "");
assert.equal(prepareOutgoing("  selling lobsters. cheap  ").text, "Selling lobsters. Cheap");
// The prefix is sent as typed; the message after it is capitalised.
assert.equal(prepareOutgoing("red:wave:buying gf").text, "red:wave:Buying gf");
assert.equal(prepareOutgoing("RED:hi").text, "RED:Hi");

// Effects: WIKI colour:effect:Message, the colour first, each once, any case.
assert.deepEqual(parseChatEffects("red:wave:Buying gf"), { colour: "red", effect: "wave", text: "Buying gf" });
assert.deepEqual(parseChatEffects(fixtureBody("valid", "chat.effects").text), { colour: "red", effect: "wave", text: "Buying gf" });
assert.deepEqual(parseChatEffects("Selling lobsters"), { colour: "yellow", effect: null, text: "Selling lobsters" });
assert.deepEqual(parseChatEffects("GLOW1:Scroll:hi"), { colour: "glow1", effect: "scroll", text: "hi" });
assert.deepEqual(parseChatEffects("wave2:hi"), { colour: "yellow", effect: "wave2", text: "hi" });
assert.deepEqual(parseChatEffects("wave:red:hi"), { colour: "yellow", effect: "wave", text: "red:hi" }, "the colour must come first");
assert.deepEqual(parseChatEffects("red:green:hi"), { colour: "red", effect: null, text: "green:hi" }, "one colour");
assert.deepEqual(parseChatEffects("shake:wave:hi"), { colour: "yellow", effect: "shake", text: "wave:hi" }, "one effect");
assert.deepEqual(parseChatEffects("patternq3q3q3q3:I am a bumblebee!!!"), { colour: "pattern", effect: null, pattern: "q3q3q3q3", text: "I am a bumblebee!!!" });
assert.deepEqual(parseChatEffects("Patternab:slide:x"), { colour: "pattern", effect: "slide", pattern: "ab", text: "x" });
assert.deepEqual(parseChatEffects("pattern:x"), { colour: "yellow", effect: null, text: "pattern:x" }, "a pattern needs its codes");
assert.deepEqual(parseChatEffects("red: hi"), { colour: "red", effect: null, text: "hi" });
for (const text of ["red:", "red:wave:", "red: ", "blue:hi", "redwave:hi", " red:hi", "re d:hi", "http://x", ":hi", "<col=ff0000>:hi"])
  assert.deepEqual(parseChatEffects(text), { colour: "yellow", effect: null, text }, JSON.stringify(text));
for (const colour of CHAT_COLOURS.filter((c) => c !== "pattern")) assert.equal(parseChatEffects(`${colour}:x`).colour, colour);
for (const effect of CHAT_EFFECTS) assert.equal(parseChatEffects(`${effect}:x`).effect, effect);
// Never throws.
for (const value of [undefined, null, 7, {}, [], "\ud800:x"]) assert.equal(typeof parseChatEffects(value).text, "string");

console.log(`ok: ${cases.length} characters and the chat rules`);
