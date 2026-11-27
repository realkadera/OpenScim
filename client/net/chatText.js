// The text of one public chat line: the cleaning the server applies, the
// length it measures, and the OSRS rules this client applies on top of it
// (capitals, effect prefixes). Plain functions of strings; nothing here
// reads a line as markup or game tags, and nothing throws on any input.
//
//   cleanChatText(raw)          the text the server will relay, or ""
//   chatLength(text)            Unicode scalar values, what "80 characters" counts
//   hasVisibleText(text)        a letter, number, punctuation or symbol in it
//   capitalise(text)            the OSRS capitals (inferred, see below)
//   parseChatEffects(text)      { colour, effect, pattern?, text }: the effect
//                               prefix read off, text is what is shown
//   prepareOutgoing(raw, limits)
//                               { ok: true, text } | { ok: false, reason:
//                               "empty" | "too_long" }: what to send
//
// The cleaning mirrors contract/fixtures/ws/README.md, "Chat", step by step.
// The server is the authority: this is a pre-check before sending, so a line
// the server would refuse is refused here first. A chat line from the server
// is shown as received, never cleaned again. JavaScript's \p{...} follows the
// engine's Unicode version, which may not be the server's; a character
// assigned in one and not the other (General_Category Cn) can be kept by one
// and removed by the other.
import { DEFAULT_LIMITS } from "./protocol.js";

// Step 1: White_Space, and the blanks that look like nothing, become a space:
// U+2800 BRAILLE PATTERN BLANK, U+3164 HANGUL FILLER, U+FFA0 HALFWIDTH HANGUL
// FILLER, U+16FE4 KHITAN SMALL SCRIPT FILLER. Before step 2, which would
// otherwise remove the fillers (they are Default_Ignorable_Code_Point).
const TO_SPACE = /[\p{White_Space}\u{2800}\u{3164}\u{FFA0}\u{16FE4}]/gu;
// Step 2: controls, format characters, line and paragraph separators, private
// use, unassigned (noncharacters included), default-ignorables, U+FFFC. Also
// lone surrogates (Cs): a JavaScript string can hold one, the server's text
// cannot, and JSON would carry it as an invalid escape.
const REMOVED = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}\p{Cs}\p{Default_Ignorable_Code_Point}\u{FFFC}]/gu;
const MARK = /^\p{M}$/u;
// Step 4: the combining marks kept after one base character.
export const MAX_MARKS_PER_BASE = 2;
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}]/u;

// Step 4: a mark with no base (first, or after a space) is removed; after a
// base, MAX_MARKS_PER_BASE are kept.
function capMarks(text) {
  let out = "", marks = 0, base = false;
  for (const char of text) {
    if (MARK.test(char)) {
      if (base && marks < MAX_MARKS_PER_BASE) {
        out += char;
        marks++;
      }
      continue;
    }
    out += char;
    base = char !== " ";
    marks = 0;
  }
  return out;
}

export function cleanChatText(raw) {
  if (typeof raw !== "string") return "";
  const text = raw.replace(TO_SPACE, " ").replace(REMOVED, "").normalize("NFC");
  return capMarks(text).replace(/ {2,}/g, " ").replace(/^ | $/g, "");
}

export const chatLength = (text) => [...text].length;
export const hasVisibleText = (text) => VISIBLE.test(text);

// The server refuses a raw text over this many UTF-8 bytes per allowed
// character before cleaning it at all.
export const RAW_BYTES_PER_CHAR = 16;
const utf8 = new TextEncoder();

// OBS (the game's client, the case of a public message as it is shown): the
// first letter, and the first after ".", "?" or "!" (spaces between or not),
// is a capital; a letter inside a word is lower case; the first letter of any
// other word is as typed. "HELLO WORLD" is "Hello World", "hi.there" is
// "Hi.There". Only a letter whose other case is one character is changed, so
// the length never changes.
const LETTER = /^\p{L}$/u;
const SPACE = /^\p{Zs}$/u;
const oneChar = (changed, char) => ([...changed].length === 1 ? changed : char);
export function capitalise(text) {
  if (typeof text !== "string") return "";
  let state = 2; // 2: a sentence starts, 1: a word starts, 0: inside a word
  let out = "";
  for (let char of text) {
    if (state === 0) char = oneChar(char.toLowerCase(), char);
    else if (state === 2) char = oneChar(char.toUpperCase(), char);
    if (LETTER.test(char)) state = 0;
    else if (char === "." || char === "?" || char === "!") state = 2;
    else if (!SPACE.test(char) || state !== 2) state = 1;
    out += char;
  }
  return out;
}

// WIKI (Chat Interface, "Chat effects"): the colours and text effects of a
// public message, typed as "colour:effect:Message", the colour before the
// effect. Yellow is the default.
export const CHAT_COLOURS = Object.freeze(["yellow", "red", "green", "cyan", "purple", "white", "flash1", "flash2", "flash3", "glow1", "glow2", "glow3", "rainbow", "pattern"]);
export const CHAT_EFFECTS = Object.freeze(["wave", "wave2", "shake", "slide", "scroll"]);
export const DEFAULT_COLOUR = "yellow";
// inferred: the prefix grammar. The wiki gives "colour:effect:Message" and
// the example "patternq3q3q3q3:I am a bumblebee!!!"; the rest is how the game
// is commonly known to read it: matched at the very start, case-insensitive,
// each part followed by a colon, a colour at most once and first, an effect
// at most once; "pattern" takes 1 to 8 codes of 0-9 and a-z (inferred, the
// codes of the wiki example). A prefix with nothing after it is not one: the
// line is shown as typed.
export const PATTERN_CODES_MAX = 8;
const PREFIX = new RegExp(`^(?:(${CHAT_COLOURS.filter((c) => c !== "pattern").join("|")}|pattern([0-9a-z]{1,${PATTERN_CODES_MAX}})):)?(?:(${CHAT_EFFECTS.join("|")}):)?`, "i");

// The prefix and what follows it; prefixLength 0 when there is none.
function splitEffects(text) {
  const plain = { colour: DEFAULT_COLOUR, effect: null, text, prefixLength: 0 };
  if (typeof text !== "string") return { ...plain, text: "" };
  const match = PREFIX.exec(text);
  if (!match || match[0].length === 0) return plain;
  const rest = text.slice(match[0].length).replace(/^ +/, "");
  if (rest.length === 0) return plain;
  const colour = match[1] ? (match[2] !== undefined ? "pattern" : match[1].toLowerCase()) : DEFAULT_COLOUR;
  const split = { colour, effect: match[3] ? match[3].toLowerCase() : null, text: rest, prefixLength: text.length - rest.length };
  if (colour === "pattern") split.pattern = match[2].toLowerCase();
  return split;
}

// { colour, effect, pattern?, text }: effect is null when there is none,
// pattern only with colour "pattern". Unknown prefixes stay in the text.
export function parseChatEffects(text) {
  const { prefixLength, ...display } = splitEffects(text);
  return display;
}

// What the client sends for what was typed: cleaned as the server will,
// capitals on the message (the prefix is sent as typed, and counts), then the
// server's two refusals. limits: the welcome's (chat_max_chars).
export function prepareOutgoing(raw, limits = DEFAULT_LIMITS) {
  const max = Number.isSafeInteger(limits?.chat_max_chars) && limits.chat_max_chars > 0 ? limits.chat_max_chars : DEFAULT_LIMITS.chat_max_chars;
  if (typeof raw !== "string") return { ok: false, reason: "empty" };
  if (utf8.encode(raw).length > RAW_BYTES_PER_CHAR * max) return { ok: false, reason: "too_long" };
  const cleaned = cleanChatText(raw);
  const { prefixLength } = splitEffects(cleaned);
  const text = cleanChatText(cleaned.slice(0, prefixLength) + capitalise(cleaned.slice(prefixLength)));
  if (!hasVisibleText(text)) return { ok: false, reason: "empty" };
  if (chatLength(text) > max) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}
