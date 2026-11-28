// The tiles a stomp lands on: Brutus's (encounter.js), and Demonic Brutus's slam's (demonic.js).
import { bossSize } from "./ids.js";

// The side of him the player is on, by his edge rows and columns: -1 at or past his west column (south row), 1 at or
// past his east column (north row), 0 between.
const side = (value, low, high) => (value <= low ? -1 : value >= high ? 1 : 0);

// Brutus's stomp, toward the player as he snorts (OBS: the graphic's tiles of all 16 stomps of the recordings that show
// them, 2026-11-27; WIKI: "a 3x1 area if adjacent, or an L shape if diagonal"):
// - beside the middle of one of his edges: the three tiles along it, outside;
// - at an end of an edge, or diagonal to his corner: an L round that corner, the corner tile and two along each edge;
// - under him, the same by the row and column he's in (OBS: at his east column, the line east); in his middle tile
//   the line south (inferred).
// It also hits his own tiles beside those (WIKI: "adjacent tiles beneath Brutus"; OBS: two players under him hit, each
// on such a tile, on no tile of the graphic): the edge row beside a line, the three of his corner beside an L.
// `outside` is where the graphic is drawn; `all`, where it hits.
export function stompTiles(corner, player) {
  const [bx, by] = corner;
  const far = bx + bossSize - 1;
  const top = by + bossSize - 1;
  const sx = side(player[0], bx, far);
  const sy = side(player[1], by, top);
  const outside = [];
  if (sx !== 0 && sy !== 0) {
    const cx = sx < 0 ? bx - 1 : far + 1;
    const cy = sy < 0 ? by - 1 : top + 1;
    const ex = sx < 0 ? bx : far;
    const ey = sy < 0 ? by : top;
    outside.push([cx, cy], [cx, ey], [cx, ey - sy], [ex, cy], [ex - sx, cy]);
  } else if (sx !== 0) {
    const x = sx < 0 ? bx - 1 : far + 1;
    for (let y = by; y <= top; y++) outside.push([x, y]);
  } else {
    const y = sy > 0 ? top + 1 : by - 1;
    for (let x = bx; x <= far; x++) outside.push([x, y]);
  }
  const under = ([x, y]) => x >= bx && x <= far && y >= by && y <= top;
  const beneath = [];
  for (let x = bx; x <= far; x++) {
    for (let y = by; y <= top; y++) {
      const beside = outside.some(([ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) === 1);
      if (beside && under([x, y])) beneath.push([x, y]);
    }
  }
  return { outside, all: [...outside, ...beneath] };
}

// Demonic Brutus's slam from a corner of the player (inferred, as Brutus's stomp was guessed before his recordings
// showed it: no recording of Demonic Brutus shows his tiles): the corner tile, the two beside it, and his own corner
// tile.
export function demonicSlamTiles(corner, player) {
  const [bx, by] = corner;
  const far = bx + bossSize - 1;
  const top = by + bossSize - 1;
  const sx = player[0] < bx ? -1 : player[0] > far ? 1 : 0;
  const sy = player[1] < by ? -1 : player[1] > top ? 1 : 0;
  const cx = sx < 0 ? bx - 1 : far + 1;
  const cy = sy < 0 ? by - 1 : top + 1;
  const ex = sx < 0 ? bx : far;
  const ey = sy < 0 ? by : top;
  const outside = [[cx, cy], [cx, ey], [ex, cy]];
  return { outside, all: [...outside, [ex, ey]] };
}
