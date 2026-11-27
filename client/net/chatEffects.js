// The text above a speaker's head as the game draws it at one moment: the
// colour and the effect a chat line's prefix chose (chatText.js
// parseChatEffects), as plain values the overlay draws. A pure function of
// the line's display, the time since it was said and the page's clock.
//
//   overheadChatText(display, elapsedMs, clockMs)
//     { text, textColor, segments?, transform?, clipPath?, scrollCycles?, slideDy? }:
//     segments  one per character, { text, dx, dy } in pixels, for the
//               effects that move each character (wave, wave2, shake)
//     transform the CSS transform of the whole text, from its anchor (the
//               point under the middle of the text); scroll and slide
//     clipPath  the CSS clip-path of the whole text; scroll and slide
//     scrollCycles, slideDy   the same two effects as numbers: the cycles
//               the scroll has run (0..150), the slide's pixels down
//
// The text is the line's own (display.text), never markup: the overlay sets
// it as textContent.
//
// inferred: every number below is the game client's overhead text as the
// community's decompiled clients draw it (the colours 0..11 and the effects
// 1..5 of the text above a player); the wiki names the colours and effects
// (WIKI, Chat Interface, "Chat effects") but gives no timings. The client
// counts cycles of 20 ms; the text stays 150 of them, chatStore.js
// OVERHEAD_MS.
import { OVERHEAD_MS } from "./chatStore.js";

export const CYCLE_MS = 20;
export const OVERHEAD_CYCLES = Math.round(OVERHEAD_MS / CYCLE_MS);

// The six fixed colours, by the names chatText.js reads.
export const OVERHEAD_COLOURS = Object.freeze({
  yellow: "#ffff00",
  red: "#ff0000",
  green: "#00ff00",
  cyan: "#00ffff",
  purple: "#ff00ff",
  white: "#ffffff",
});

const hex = (rgb) => "#" + (rgb & 0xffffff).toString(16).padStart(6, "0");

// The colour at a moment. flash1-3 alternate every 10 cycles of the page's
// clock; glow1-3 run once through three colours over the 150 cycles of the
// line. rainbow and pattern colour each character (overheadGlyphColours);
// their base colour is yellow.
export function overheadColour(colour, elapsedCycles, clockCycles) {
  const fixed = OVERHEAD_COLOURS[colour];
  if (fixed) return fixed;
  const second = clockCycles % 20 >= 10;
  const j = Math.min(Math.max(elapsedCycles, 0), OVERHEAD_CYCLES - 1);
  switch (colour) {
    case "flash1":
      return second ? "#ffff00" : "#ff0000";
    case "flash2":
      return second ? "#00ffff" : "#0000ff";
    case "flash3":
      return second ? "#80ff80" : "#00b000";
    case "glow1":
      return hex(j < 50 ? 0xff0000 + 0x500 * j : j < 100 ? 0xffff00 - 0x50000 * (j - 50) : 0x00ff00 + 5 * (j - 100));
    case "glow2":
      return hex(j < 50 ? 0xff0000 + 5 * j : j < 100 ? 0xff00ff - 0x50000 * (j - 50) : 0x0000ff + 0x50000 * (j - 100) - 5 * (j - 100));
    case "glow3":
      return hex(j < 50 ? 0xffffff - 0x50005 * j : j < 100 ? 0x00ff00 + 0x50005 * (j - 50) : 0xffffff - 0x50000 * (j - 100));
    default:
      return OVERHEAD_COLOURS.yellow;
  }
}

// The characters as the player sees them: a letter with its marks is one.
function glyphs(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);
  return [...text];
}
const perGlyph = (text, offset) => glyphs(text).map((glyph, i) => ({ text: glyph, ...offset(i) }));

// OBS (the game's client): the 36 colours a pattern's codes name, "0" to "9"
// then "a" to "z".
export const PATTERN_COLOURS = Object.freeze([
  0xffffff, 0xe40303, 0xff8c00, 0xffed00, 0x008026, 0x24408e, 0x732982, 0xff218c, 0xb55690, 0x5049cc, 0xa3a3a3, 0xd52d00,
  0xef7627, 0xfcf434, 0x078d70, 0x21b1ff, 0x9b4f96, 0xffafc7, 0xd162a4, 0x7bade3, 0xff9a56, 0x26ceaa, 0x73d7ee, 0x9c59d1,
  0x98e8c1, 0xb57edc, 0x2c2c2c, 0x940202, 0x613915, 0xd0c100, 0x4a8123, 0x0038a8, 0x800080, 0xd60270, 0xa30262, 0x3d1a78,
]);

// OBS (the game's client): the rainbow takes the client's palette at hue
// 0..63, saturation 7 of 0..7 and lightness 64 of 0..127: hue/64 + 1/128,
// saturation 7/8 + 1/16, lightness 1/2, to red, green and blue, each raised
// to the power 0.95 and cut to 0..255.
export function rainbowColour(hue) {
  const h = 0.0078125 + (hue & 63) / 64;
  const q = 0.96875; // lightness + saturation - lightness * saturation
  const p = 0.03125; // 2 * lightness - q
  const channel = (t) => {
    if (t > 1) t -= 1;
    if (t < 0) t += 1;
    const v = t * 6 < 1 ? p + (q - p) * 6 * t : t * 2 < 1 ? q : t * 3 < 2 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.trunc(256 * Math.pow(v, 0.95));
  };
  return (channel(h + 1 / 3) << 16) | (channel(h) << 8) | channel(h - 1 / 3);
}

// The colour of each of `count` characters, or null when the line has one
// colour. OBS (the game's client; its arithmetic is in 32-bit floats):
// rainbow gives character i the hue floor(i / count * 64); a pattern of n
// codes gives it the colour of code floor(i * (n / count)).
export function overheadGlyphColours(display, count) {
  const f = Math.fround;
  if (display?.colour === "rainbow") return Array.from({ length: count }, (_, i) => hex(rainbowColour(Math.trunc(f(f(i / count) * 64)))));
  if (display?.colour !== "pattern" || typeof display.pattern !== "string" || !display.pattern) return null;
  const codes = [...display.pattern].map((code) => PATTERN_COLOURS[parseInt(code, 36)]);
  if (codes.some((colour) => colour === undefined)) return null;
  const step = f(codes.length / count);
  return Array.from({ length: count }, (_, i) => hex(codes[Math.trunc(f(i * step))]));
}

export function overheadChatText(display, elapsedMs, clockMs) {
  const text = typeof display?.text === "string" ? display.text : "";
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / CYCLE_MS)) : 0;
  const clock = Number.isFinite(clockMs) ? Math.floor(clockMs / CYCLE_MS) : 0;
  const out = { text, textColor: overheadColour(display?.colour, elapsed, clock) };
  switch (display?.effect) {
    case "wave":
      out.segments = perGlyph(text, (i) => ({ dx: 0, dy: Math.trunc(Math.sin(i / 2 + clock / 5) * 5) }));
      break;
    case "wave2":
      out.segments = perGlyph(text, (i) => ({ dx: Math.trunc(Math.sin(i / 5 + clock / 5) * 5), dy: Math.trunc(Math.sin(i / 3 + clock / 5) * 5) }));
      break;
    case "shake": {
      // Shakes hard at first and settles after 56 cycles.
      const amplitude = Math.max(0, 7 - elapsed / 8);
      out.segments = perGlyph(text, (i) => ({ dx: 0, dy: Math.trunc(Math.sin(i / 1.5 + clock) * amplitude) }));
      break;
    }
    case "scroll": {
      // From the right edge of a window 100 px wide over the head to past
      // its left edge in the 150 cycles: the text's left edge at
      // 50 - (elapsed / 150) * (width + 100) from the anchor, the rest of
      // the text cut off outside the window. 100% is the text's own width.
      out.scrollCycles = Math.min(elapsed, OVERHEAD_CYCLES); // for a drawer that works in pixels (overheadBitmap.js)
      const f = Math.min(elapsed, OVERHEAD_CYCLES) / OVERHEAD_CYCLES;
      const offset = `${f} * (100% + 100px)`;
      out.transform = `translate(calc(50px - ${offset}), -100%)`;
      out.clipPath = `inset(0 max(0px, calc(100% - ${offset})) 0 max(0px, calc(${offset} - 100px)))`;
      break;
    }
    case "slide": {
      // Drops in from above in the first 25 cycles and out below in the
      // last 25, cut off 1 px above the text's place and 5 px below its
      // baseline (the line's bottom is 4 px under the baseline).
      const y = elapsed < 25 ? elapsed - 25 : elapsed > 125 ? elapsed - 125 : 0;
      out.slideDy = y; // for a drawer that works in pixels (overheadBitmap.js)
      out.transform = `translate(-50%, calc(-100% + ${y}px))`;
      out.clipPath = `inset(${Math.max(0, -1 - y)}px 0 ${Math.max(0, y - 1)}px 0)`;
      break;
    }
  }
  // rainbow and pattern: every character in its own colour, moved or not.
  const segments = out.segments ?? (display?.colour === "rainbow" || display?.colour === "pattern" ? perGlyph(text, () => null) : null);
  const colours = segments && overheadGlyphColours(display, segments.length);
  if (colours) out.segments = segments.map((segment, i) => ({ ...segment, color: colours[i] }));
  return out;
}
