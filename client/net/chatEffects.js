// The text above a speaker's head as the game draws it at one moment: the
// colour and the effect a chat line's prefix chose (chatText.js
// parseChatEffects), as plain values the overlay draws. A pure function of
// the line's display, the time since it was said and the page's clock.
//
//   overheadChatText(display, elapsedMs, clockMs)
//     { text, textColor, segments?, transform?, clipPath? }:
//     segments  one per character, { text, dx, dy } in pixels, for the
//               effects that move each character (wave, wave2, shake)
//     transform the CSS transform of the whole text, from its anchor (the
//               point under the middle of the text); scroll and slide
//     clipPath  the CSS clip-path of the whole text; scroll and slide
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
// line. rainbow and pattern are drawn yellow: their timing is not known here.
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
      out.transform = `translate(-50%, calc(-100% + ${y}px))`;
      out.clipPath = `inset(${Math.max(0, -1 - y)}px 0 ${Math.max(0, y - 1)}px 0)`;
      break;
    }
  }
  return out;
}
