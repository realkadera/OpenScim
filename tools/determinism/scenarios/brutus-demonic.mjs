// Demonic Brutus (client/encounters/brutus/demonic.js), Brutus's hard version, in his field. The snapshot tells the
// special running: its kind, the tile it is round (`at`, a tick after he fades), when its first bull lands, and in
// phase 2 the styles of its orbs. Each script decides from it and the tick alone.
import { attack, protect, toggleRun } from "./common.mjs";

const KIND = "brutus_demonic";
const BOSS = "brutus";

const state = (api) => api.engine.getEncounterSnapshot().state;
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const prayers = { magic: "ProtectMagic", melee: "ProtectMelee", ranged: "ProtectRange" };

// Out of a special's way. A slam: two tiles straight from the tile it is round, of the four such tiles the one nearest
// the middle of the open field (58, 14), as a fence runs along its west side (the push the game gives a player too
// near one isn't in the encounter). A charge: its four lanes are offset round the player, so before each bull lands
// the player steps (at most two tiles, a tick's run) to a tile clear of that bull's lane and, if he can, the next
// one's: the two "dodge tiles", toward the middle of the field. Returns true while a special is on.
const middle = [58, 14];
const dashes = { W: [1, 0], E: [-1, 0], S: [0, 1], N: [0, -1] };
function inLane(bull, [x, y]) {
  const [dx, dy] = dashes[bull.from];
  for (let step = 0; step <= 7; step++) {
    const cx = bull.corner[0] + dx * step;
    const cy = bull.corner[1] + dy * step;
    if (x >= cx && x < cx + 3 && y >= cy && y < cy + 3) return true;
  }
  return false;
}
function go(api, tile) {
  if (sameTile(tile, api.player().position)) return;
  if (api.player().attackTarget !== null) attack(api, null);
  api.moveTo(...tile);
}
function dodge(api, tick) {
  const special = state(api).special;
  if (!special) return false;
  if (!special.at) return true; // faded, not yet back
  const [x, y] = special.at;
  if (special.name === "slam") {
    const offsets = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    const distance = ([dx, dy]) => Math.abs(x + dx - middle[0]) + Math.abs(y + dy - middle[1]);
    const [dx, dy] = offsets.reduce((best, offset) => (distance(offset) < distance(best) ? offset : best));
    go(api, [x + dx, y + dy]);
    return true;
  }
  // The bull that lands as the next tick starts, and the one after it.
  const n = tick + 1 - special.firstBullAt;
  const next = special.bulls.slice(Math.max(0, n), Math.max(0, n) + 2);
  if (!next.length) return true;
  const here = api.player().position;
  const tiles = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) tiles.push([here[0] + dx, here[1] + dy]);
  // Clear of the next bull above all, then of the one after, then toward the middle of the field (away from its fences).
  const score = (tile) =>
    (inLane(next[0], tile) ? 100 : 0) + (next[1] && inLane(next[1], tile) ? 10 : 0) + 0.5 * (Math.abs(tile[0] - middle[0]) + Math.abs(tile[1] - middle[1]));
  go(api, tiles.reduce((best, tile) => (score(tile) < score(best) ? tile : best)));
  return true;
}
// In phase 2, the prayer for the orb that lands this tick (a prayer turned on in a tick counts against its hits);
// Protect from Melee otherwise.
function pray(api, tick) {
  const special = state(api).special;
  const n = special ? tick - special.firstBullAt : -1;
  const wanted = special?.orbs?.length && n >= 0 && n < 4 ? prayers[special.orbs[n]] : "ProtectMelee";
  if (api.player().activePrayer !== wanted) protect(api, wanted);
}
const run = (api, tick) => tick === 1 && !api.player().isRunEnabled && toggleRun(api);

// The guide's high-level melee setup (loadouts.js, "max"), worn.
const max = {
  equipment: { head: 26382, cape: 21295, amulet: 29801, weapon: 22325, body: 26384, legs: 26386, hands: 22981, boots: 31097, ring: 28307 },
};
const bare = { equipment: {} };

export const scenarios = [
  {
    // A player who stands still and doesn't fight back: two or three butts, a special, two or three butts, the next
    // special, each special's four bulls landing on him. Infinite health: to the end.
    name: "brutus_demonic/standing",
    kind: KIND,
    seed: 3,
    start: [58, 14],
    ticks: 140,
    mechanics: { infiniteHealth: true },
    ...bare,
    script() {},
  },
  {
    // The same, each special stepped out of: no bull lands.
    name: "brutus_demonic/dodged",
    kind: KIND,
    seed: 3,
    start: [58, 14],
    ticks: 140,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...bare,
    script(tick, api) {
      run(api, tick);
      dodge(api, tick);
    },
  },
  {
    // A player who stands on the field's start tile (57, 24): a slam leaves him at a corner of the player, from where he
    // steps beside him to butt (he can't from a corner).
    name: "brutus_demonic/start-tile",
    kind: KIND,
    seed: 1,
    ticks: 120,
    mechanics: { infiniteHealth: true },
    ...bare,
    script() {},
  },
  {
    // A player beside the east fence (64, 20) as the first special starts: pushed into open space, round which the
    // special is placed, and walking, not running, as he dodges it.
    name: "brutus_demonic/pushed",
    kind: KIND,
    seed: 3,
    start: [64, 20],
    ticks: 60,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...bare,
    script(tick, api) {
      run(api, tick);
      dodge(api, tick);
    },
  },
  {
    // Slams only (the setup's switch for the charge off).
    name: "brutus_demonic/slams-only",
    kind: KIND,
    seed: 7,
    start: [58, 14],
    ticks: 100,
    mechanics: { infiniteHealth: true, demonicBrutusCharge: false },
    ...bare,
    script() {},
  },
  {
    // The guide's melee setup, attacking him from the start, dodging every special and praying against each orb:
    // faster specials from 500, counterclockwise ghosts from 250, "moo moo!" and his heal to 487 at 0, phase 2's orbs,
    // his death and the victory.
    name: "brutus_demonic/kill",
    kind: KIND,
    seed: 11,
    start: [58, 14],
    ticks: 620,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...max,
    script(tick, api) {
      run(api, tick);
      pray(api, tick);
      if (dodge(api, tick)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
];
