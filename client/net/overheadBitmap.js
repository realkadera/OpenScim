// The lobby's chat above the heads, drawn as the game's client draws it: the
// bold 12 font as 1-bit glyphs on a canvas of the overlay's own pixels, each
// glyph black at (+1, +1) and then in its colour; texts that overlap pushed
// up; at most 50 a frame.
//
//   drawOverheadBitmapTexts(container, entries, zIndex)
//     Draws the entries with `bitmap: true` on a canvas inside `container`
//     (made on first use, cleared every call). An entry is what
//     chatEffects.js overheadChatText gives, with screenX and screenY (the
//     bottom of a 16 px line, 4 px under the baseline, as the overlay's text
//     spans hang). True when it drew them; false while the font is not
//     loaded (the caller then shows its own text). The points are in game
//     pixels: the canvas is one of the overlay's layers and is scaled with
//     them (Stretched Mode, the interface scale), as the game scales its
//     whole picture, text included.
//   stackOverheadTexts(texts)   the baselines after stacking; no DOM
//
// The glyphs are those of the page's "RuneScape Bold 12" font at 16 px, where
// one unit of the font is one pixel, cut to on or off: not read from the
// game's cache (ponytail: the font file the page already has; read the
// cache's font archive instead if a glyph is ever found to differ).

// OBS (the game's client, the overhead text routine): the bold 12 font's
// ascent, by which an overlapping text is pushed up, and the texts a frame.
export const BOLD12_ASCENT = 12;
export const OVERHEAD_TEXT_LIMIT = 50;

const FONT = "16px 'RuneScape Bold 12'";
// Rows of a glyph's box above and below the baseline, and the columns left
// of its origin (inferred: wide enough for every glyph of the font).
const ABOVE = 16;
const BELOW = 8;
const LEFT = 2;

// OBS (the game's client): a text is moved up to the top of an earlier one
// (its baseline less the ascent) while the two overlap, in the order drawn,
// until it overlaps none. texts: [{ x, y, half }], the anchor, the baseline
// and half the width. Returns the baselines.
export function stackOverheadTexts(texts, ascent = BOLD12_ASCENT) {
  const ys = [];
  for (let i = 0; i < texts.length; i++) {
    const { x, half } = texts[i];
    let y = texts[i].y;
    for (let moved = true; moved; ) {
      moved = false;
      for (let j = 0; j < i; j++) {
        const top = ys[j] - ascent;
        if (y + 2 > top && y - ascent < ys[j] + 2 && x - half < texts[j].x + texts[j].half && x + half > texts[j].x - texts[j].half && top < y) {
          y = top;
          moved = true;
        }
      }
    }
    ys.push(y);
  }
  return ys;
}

let scratch = null;
const glyphs = new Map(); // text -> { advance, width, mask }
const tinted = new Map(); // text + colour -> canvas

function glyphOf(text) {
  let glyph = glyphs.get(text);
  if (glyph) return glyph;
  scratch ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  scratch.font = FONT;
  const advance = Math.round(scratch.measureText(text).width);
  const width = advance + LEFT + 2;
  const height = ABOVE + BELOW;
  if (scratch.canvas.width < width) scratch.canvas.width = width;
  if (scratch.canvas.height < height) scratch.canvas.height = height;
  scratch.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
  scratch.font = FONT; // a resized canvas forgets its font
  scratch.textBaseline = "alphabetic";
  scratch.fillStyle = "#fff";
  scratch.fillText(text, LEFT, ABOVE);
  const alpha = scratch.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0;
  glyph = { advance, width, height, mask };
  glyphs.set(text, glyph);
  return glyph;
}

// The glyph in one colour ("#rrggbb"), every pixel on or off.
function tintedGlyph(text, colour) {
  const key = colour + text;
  let canvas = tinted.get(key);
  if (canvas) return canvas;
  // ponytail: emptied when large (glow makes a colour a cycle); an LRU if that ever shows.
  if (tinted.size > 4000) tinted.clear();
  const glyph = glyphOf(text);
  canvas = document.createElement("canvas");
  canvas.width = glyph.width;
  canvas.height = glyph.height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(glyph.width, glyph.height);
  const rgb = parseInt(colour.slice(1), 16);
  for (let i = 0; i < glyph.mask.length; i++) {
    if (!glyph.mask[i]) continue;
    image.data[i * 4] = rgb >> 16;
    image.data[i * 4 + 1] = (rgb >> 8) & 255;
    image.data[i * 4 + 2] = rgb & 255;
    image.data[i * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  tinted.set(key, canvas);
  return canvas;
}

const isColour = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function drawOverheadBitmapTexts(container, entries, zIndex) {
  const texts = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.bitmap === true).slice(0, OVERHEAD_TEXT_LIMIT);
  let canvas = container.querySelector("canvas[data-overhead-bitmap]");
  if (texts.length === 0) {
    canvas?.remove();
    return true;
  }
  if (!document.fonts?.check(FONT)) {
    document.fonts?.load(FONT).catch(() => {});
    canvas?.remove();
    return false;
  }
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("data-overhead-bitmap", "true");
    canvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;image-rendering:pixelated";
    if (zIndex !== undefined) canvas.style.zIndex = `${zIndex}`;
    container.appendChild(canvas);
  }
  // The overlay's layers are drawn in game pixels and scaled up together (rendering.js scaleOverlayLayers sets
  // the scale on this canvas too): the canvas is the container in game pixels, so that scaled it covers it.
  const scale = Number(/scale\(([\d.]+)\)/.exec(canvas.style.transform)?.[1]) || 1;
  const width = Math.ceil(container.clientWidth / scale);
  const height = Math.ceil(container.clientHeight / scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  const laid = texts.map((entry) => {
    const parts = (entry.segments?.length ? entry.segments : [...String(entry.text ?? "")].map((text) => ({ text }))).filter((part) => typeof part.text === "string" && part.text !== "");
    const widthOf = parts.reduce((sum, part) => sum + glyphOf(part.text).advance, 0);
    // The overlay's point is the bottom of a 16 px line: the baseline is 4 px above it.
    return { entry, parts, width: widthOf, x: Math.round(entry.screenX), y: Math.round(entry.screenY) - 4, half: Math.trunc(widthOf / 2) };
  });
  const ys = stackOverheadTexts(laid);
  const drawn = [];
  laid.forEach(({ entry, parts, width: textWidth, x, half }, index) => {
    const y = ys[index];
    const base = isColour(entry.textColor) ? entry.textColor : "#ffff00";
    let left = x - half;
    let dy = 0;
    context.save();
    context.beginPath();
    if (Number.isFinite(entry.scrollCycles)) {
      // OBS: from the right edge of a window of 100 px on the anchor to past its left edge in 150 cycles.
      left = x + 50 - Math.trunc((entry.scrollCycles * (textWidth + 100)) / 150);
      context.rect(x - 50, 0, 100, height);
      context.clip();
    } else if (Number.isFinite(entry.slideDy)) {
      // OBS: cut from 1 px above the text to 5 px under its baseline.
      dy = entry.slideDy;
      context.rect(0, y - BOLD12_ASCENT - 1, width, BOLD12_ASCENT + 6);
      context.clip();
    }
    let pen = left;
    for (const part of parts) {
      const gx = pen + (part.dx ?? 0) - LEFT;
      const gy = y + dy + (part.dy ?? 0) - ABOVE;
      // OBS: each glyph black one pixel right and down, then in its colour.
      context.drawImage(tintedGlyph(part.text, "#000000"), gx + 1, gy + 1);
      context.drawImage(tintedGlyph(part.text, isColour(part.color) ? part.color : base), gx, gy);
      pen += glyphOf(part.text).advance;
    }
    context.restore();
    drawn.push({ key: entry.key, text: parts.map((part) => part.text).join(""), left, baseline: y, width: textWidth });
  });
  // What was drawn, for tests and diagnostics.
  canvas.drawnTexts = drawn;
  return true;
}
