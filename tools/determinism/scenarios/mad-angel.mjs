// The Mad Angel (client/encounters/mad-angel/). She wakes with her south-west
// tile at 36,39 (3 x 3) in the middle of the nave; the player comes in at
// 41,39, east of her. The snapshot tells her phase ("waking", "fighting"),
// whether she is enraged, the special running and the next. Each script
// decides from it and the tick alone.
import { attack, protect } from "./common.mjs";

const KIND = "mad_angel";
const BOSS = "mad-angel";

const state = (api) => api.engine.getEncounterSnapshot().state;
const boss = (api) => api.npcs().find((npc) => npc.id === BOSS);
// The four ways she faces, and her left of each (encounter.js).
const directions = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const leftOf = ([fx, fy]) => [-fy, fx];

// Protect from Magic switched on on each tick a smite strikes (its perfect prayer), Protect from Melee the rest of the
// time.
function prayFor(api, tick) {
  const strikes = state(api).special?.strikes ?? [];
  const want = strikes.includes(tick) ? "ProtectMagic" : "ProtectMelee";
  if (api.player().activePrayer !== want) protect(api, want);
}

// On the ball's tile to bounce it; out of the half a cleave will sweep, to her side opposite her sword. Returns true
// when the player is busy with one of them.
function counter(api) {
  const special = state(api).special;
  const position = api.player().position;
  const go = (tile) => {
    if (tile[0] === position[0] && tile[1] === position[1]) return true;
    if (api.player().attackTarget !== null) attack(api, null); // with a target he walks to it, not to the tile
    api.moveTo(...tile);
    return true;
  };
  if (special?.name === "blast" && special.ball) return go(special.ball.tile);
  if (special?.name === "sweep") {
    const at = boss(api).position;
    const front = directions[special.facing];
    const left = leftOf(front);
    const toSide = special.side === "left" ? left : [-left[0], -left[1]];
    // Beside her, on the side opposite the sword, a tile out from her edge: out of the cleave, and to her side.
    return go([at[0] + 1 - 2 * toSide[0], at[1] + 1 - 2 * toSide[1]]);
  }
  return false;
}

// The wiki's two melee setups (loadouts.js), worn.
const obligator = {
  equipment: { head: 24419, cape: 21295, amulet: 29801, weapon: 34715, body: 24420, legs: 24421, hands: 22981, boots: 31097, ring: 28307 },
  supplies: { equippedAmmo: { id: 22947 } },
};
const graniteHammer = {
  equipment: { head: 29028, cape: 6570, amulet: 6585, weapon: 21742, body: 29022, shield: 12954, legs: 29025, hands: 7462, boots: 11840, ring: 11773 },
  supplies: { equippedAmmo: { id: 22947 } },
};

export const scenarios = [
  {
    // Her mechanics countered: every ball bounced back to her, every cleave stepped out of, every smite met with Protect
    // from Magic on its tick; Protect from Melee otherwise, the Obligator. Infinite health: to her death.
    name: "mad-angel/countered",
    kind: KIND,
    seed: 5,
    ticks: 600,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...obligator,
    script(tick, api) {
      prayFor(api, tick);
      if (counter(api)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The whole fight with the Obligator, Protect from Melee on from the start: her three specials in turn, her
    // enrage at 350 and her death. Infinite health: to the end.
    name: "mad-angel/obligator-kill",
    kind: KIND,
    seed: 3,
    ticks: 600,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...obligator,
    script(tick, api) {
      if (tick === 1) protect(api, "ProtectMelee");
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The granite hammer, unprayed: her standard attacks in full, and her golembane weakness.
    name: "mad-angel/granite-hammer",
    kind: KIND,
    seed: 8,
    ticks: 200,
    mechanics: { infiniteHealth: true },
    ...graniteHammer,
    script(tick, api) {
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // Protect from Magic held from the start: her smite is cut by ~75%, never negated, and earns nothing.
    name: "mad-angel/magic-prayer",
    kind: KIND,
    seed: 8,
    ticks: 130,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...graniteHammer,
    script(tick, api) {
      if (tick === 1) protect(api, "ProtectMagic");
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The setup's switches: the sweep alone, for practising it. Protect from Melee, standing still: caught by each cleave.
    name: "mad-angel/sweep-only",
    kind: KIND,
    seed: 4,
    ticks: 130,
    mechanics: { infiniteHealth: true, infinitePrayer: true, madAngelBlast: false, madAngelSmite: false },
    ...graniteHammer,
    script(tick, api) {
      if (tick === 1) protect(api, "ProtectMelee");
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  // The snapshot of a fresh fight: she wakes.
  {
    name: "mad-angel/start",
    kind: KIND,
    seed: 1,
    ticks: 10,
    script() {},
  },
];
