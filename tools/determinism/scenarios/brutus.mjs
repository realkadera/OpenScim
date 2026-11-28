// Brutus (client/encounters/brutus/). He stands with his south-west tile at 61,23 (3 x 3) in the north-east corner of
// the cow field; the player comes in at 57,24, west of him. Most scenarios start the player south of him, at 62,16.
// The snapshot tells the special running (its name, a stomp's tiles, a charge's direction) and the next. Each script
// decides from it and the tick alone.
import { attack, protect, toggleRun } from "./common.mjs";

const KIND = "brutus";
const BOSS = "brutus";

const state = (api) => api.engine.getEncounterSnapshot().state;
const brutus = (api) => api.npcs().find((npc) => npc.id === BOSS);
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

// Out of a stomp's tiles, a tile back from him; out of a charge's lane, two tiles to its side. Returns true while a
// special is on: the player keeps out of the way till it's over (back at him, he'd be on a stomp's tiles again).
function dodge(api) {
  const special = state(api).special;
  const position = api.player().position;
  const at = brutus(api)?.position;
  if (!special || !at) return false;
  const go = (tile) => {
    if (sameTile(tile, position)) return true;
    if (api.player().attackTarget !== null) attack(api, null); // with a target he walks to it, not to the tile
    api.moveTo(...tile);
    return true;
  };
  if (special.name === "stomp" && special.tiles?.some((tile) => sameTile(tile, position))) {
    // A tile further from his middle, on the axis the player is beside him on.
    const middle = [at[0] + 1, at[1] + 1];
    const dx = Math.sign(position[0] - middle[0]);
    const dy = Math.sign(position[1] - middle[1]);
    return go([position[0] + 2 * dx, position[1] + 2 * dy]);
  }
  if (special.name === "charge") {
    const across = special.direction === "W" || special.direction === "E";
    // To the nearer side of his 3-tile lane, a tile clear of it.
    if (across && position[1] >= at[1] && position[1] <= at[1] + 2) return go([position[0], position[1] - at[1] <= 1 ? at[1] - 2 : at[1] + 4]);
    if (!across && position[0] >= at[0] && position[0] <= at[0] + 2) return go([position[0] - at[0] <= 1 ? at[0] - 2 : at[0] + 4, position[1]]);
  }
  return true;
}
// Running, as a player dodging would (a charge leaves 3 ticks to cross his 3-tile lane).
const run = (api, tick) => tick === 1 && !api.player().isRunning && toggleRun(api);

// The guide's free-to-play melee setup (loadouts.js), worn.
const f2pMelee = {
  equipment: { head: 1163, cape: 1007, amulet: 1725, weapon: 1333, body: 1113, shield: 33101, legs: 1093, hands: 23261, boots: 1061 },
};
// Bare-handed, for a fight long enough to see his specials (58 hitpoints go fast otherwise).
const bare = { equipment: {} };

export const scenarios = [
  {
    // He walks up to a player who stands still and doesn't fight back: his butts every 5 ticks, then his two specials
    // in turn (the first at random), each landing on him. Infinite health: to the end.
    name: "brutus/standing",
    kind: KIND,
    seed: 3,
    start: [62, 16],
    ticks: 160,
    mechanics: { infiniteHealth: true },
    ...bare,
    script() {},
  },
  {
    // The same, with each stomp stepped back from and each charge stepped aside from, and Protect from Melee for his
    // butts: nothing lands.
    name: "brutus/dodged",
    kind: KIND,
    seed: 3,
    start: [62, 16],
    ticks: 160,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...bare,
    script(tick, api) {
      run(api, tick);
      if (api.player().activePrayer !== "ProtectMelee") protect(api, "ProtectMelee");
      dodge(api);
    },
  },
  {
    // Stomps only (the setup's switch for the charge off): every special a stomp.
    name: "brutus/stomps-only",
    kind: KIND,
    seed: 7,
    ticks: 120,
    mechanics: { infiniteHealth: true, brutusCharge: false },
    ...bare,
    script() {},
  },
  {
    // Charges only, the player standing south of him: he dashes south through him.
    name: "brutus/charges-only",
    kind: KIND,
    seed: 7,
    start: [62, 16],
    ticks: 120,
    mechanics: { infiniteHealth: true, brutusStomp: false },
    ...bare,
    script() {},
  },
  {
    // The guide's free-to-play melee setup, attacking him from the start, dodging his specials: his death and the
    // victory.
    name: "brutus/f2p-kill",
    kind: KIND,
    seed: 11,
    ticks: 200,
    mechanics: { infiniteHealth: true },
    ...f2pMelee,
    script(tick, api) {
      run(api, tick);
      if (dodge(api)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
];
