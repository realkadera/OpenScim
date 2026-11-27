// client/net/chatEffects.js: the colour and the effect of the text above a
// speaker's head at one moment.
import assert from "node:assert/strict";

import { CYCLE_MS, OVERHEAD_CYCLES, OVERHEAD_COLOURS, overheadChatText, overheadColour } from "../client/net/chatEffects.js";
import { parseChatEffects } from "../client/net/chatText.js";

assert.equal(CYCLE_MS, 20);
assert.equal(OVERHEAD_CYCLES, 150);

// Plain: yellow, the text as said, nothing moved.
assert.deepEqual(overheadChatText(parseChatEffects("Hello"), 0, 0), { text: "Hello", textColor: "#ffff00" });

// The fixed colours; the prefix is not shown.
for (const [name, hex] of Object.entries(OVERHEAD_COLOURS)) {
  assert.deepEqual(overheadChatText(parseChatEffects(`${name}:Hi`), 500, 12345), { text: "Hi", textColor: hex });
}

// flash1-3 alternate every 10 cycles of the clock, whatever the line's age.
assert.equal(overheadColour("flash1", 0, 0), "#ff0000");
assert.equal(overheadColour("flash1", 0, 10), "#ffff00");
assert.equal(overheadColour("flash2", 99, 5), "#0000ff");
assert.equal(overheadColour("flash2", 99, 15), "#00ffff");
assert.equal(overheadColour("flash3", 0, 0), "#00b000");
assert.equal(overheadColour("flash3", 0, 19), "#80ff80");

// glow1-3 run once through their colours over the line's 150 cycles.
assert.equal(overheadColour("glow1", 0, 0), "#ff0000");
assert.equal(overheadColour("glow1", 50, 0), "#ffff00");
assert.equal(overheadColour("glow1", 100, 0), "#00ff00");
assert.equal(overheadColour("glow1", 149, 0), "#00fff5");
assert.equal(overheadColour("glow2", 50, 0), "#ff00ff");
assert.equal(overheadColour("glow2", 100, 0), "#0000ff");
assert.equal(overheadColour("glow3", 0, 0), "#ffffff");
assert.equal(overheadColour("glow3", 50, 0), "#00ff00");
assert.equal(overheadColour("glow3", 100, 0), "#ffffff");
assert.equal(overheadColour("glow3", 1000, 0), overheadColour("glow3", 149, 0), "held at its last colour");

// rainbow and pattern: yellow (their timing is not known here); unknown: yellow.
assert.equal(overheadColour("rainbow", 10, 10), "#ffff00");
assert.equal(overheadColour("pattern", 10, 10), "#ffff00");
assert.equal(overheadColour(undefined, 0, 0), "#ffff00");

// wave: each character up and down by up to 5 px, by its place and the clock.
{
  const out = overheadChatText(parseChatEffects("wave:Abc"), 0, 0);
  assert.equal(out.text, "Abc");
  assert.deepEqual(
    out.segments,
    [0, 1, 2].map((i) => ({ text: "Abc"[i], dx: 0, dy: Math.trunc(Math.sin(i / 2) * 5) })),
  );
  const later = overheadChatText(parseChatEffects("wave:Abc"), 0, 5 * CYCLE_MS);
  assert.deepEqual(later.segments.map((s) => s.dy), [0, 1, 2].map((i) => Math.trunc(Math.sin(i / 2 + 1) * 5)));
  assert.ok(out.segments.every((s) => Math.abs(s.dy) <= 5));
}
// wave2 moves both ways.
{
  const out = overheadChatText(parseChatEffects("red:wave2:Hey"), 0, 7 * CYCLE_MS);
  assert.equal(out.textColor, "#ff0000");
  assert.deepEqual(out.segments[1], { text: "e", dx: Math.trunc(Math.sin(1 / 5 + 7 / 5) * 5), dy: Math.trunc(Math.sin(1 / 3 + 7 / 5) * 5) });
}
// A letter with its mark is one character.
assert.deepEqual(overheadChatText(parseChatEffects("wave:éx"), 0, 0).segments.map((s) => s.text), ["é", "x"]);
// shake settles: after 56 cycles nothing moves.
{
  const early = overheadChatText(parseChatEffects("shake:Shaking"), 0, 3 * CYCLE_MS);
  assert.ok(early.segments.some((s) => s.dy !== 0));
  const settled = overheadChatText(parseChatEffects("shake:Shaking"), 56 * CYCLE_MS, 3 * CYCLE_MS);
  assert.ok(settled.segments.every((s) => s.dy === 0));
}
// scroll: from the right of a 100 px window to past its left, cut to the window.
{
  const start = overheadChatText(parseChatEffects("scroll:Hi"), 0, 0);
  assert.equal(start.transform, "translate(calc(50px - 0 * (100% + 100px)), -100%)");
  assert.equal(start.clipPath, "inset(0 max(0px, calc(100% - 0 * (100% + 100px))) 0 max(0px, calc(0 * (100% + 100px) - 100px)))");
  const half = overheadChatText(parseChatEffects("scroll:Hi"), 75 * CYCLE_MS, 0);
  assert.ok(half.transform.includes("0.5 * (100% + 100px)"));
  assert.equal(start.segments, undefined);
}
// slide: in from above in 25 cycles, still, then out below.
{
  const at = (cycles) => overheadChatText(parseChatEffects("slide:Hi"), cycles * CYCLE_MS, 0);
  assert.equal(at(0).transform, "translate(-50%, calc(-100% + -25px))");
  assert.equal(at(0).clipPath, "inset(24px 0 0px 0)");
  assert.equal(at(60).transform, "translate(-50%, calc(-100% + 0px))");
  assert.equal(at(60).clipPath, "inset(0px 0 0px 0)");
  assert.equal(at(140).transform, "translate(-50%, calc(-100% + 15px))");
  assert.equal(at(140).clipPath, "inset(0px 0 10px 0)");
}

// Nothing throws on what is not a display.
assert.deepEqual(overheadChatText(null, NaN, NaN), { text: "", textColor: "#ffff00" });

console.log("chatEffects passed");
