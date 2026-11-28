// Scurrius (client/encounters/scurrius/). The floor is x 26 to 42, y 4 to
// 19; the player comes in on its west edge (26,12) and he starts at 37,11. The
// snapshot tells what a player watches for: his phase (`phase`), the pile he
// eats at, and the rubble on its way (`incoming`: tiles and the tick it lands).
// Each script decides from it and the tick alone.
import { attack, protect, rangedGear, meleeGear, setBossHp } from "./common.mjs";
import { scurriusLoadouts } from "../../../client/encounters/scurrius/loadouts.js";

const KIND = "scurrius";
const BOSS = "scurrius";
const floor = { minX: 26, maxX: 42, minY: 4, maxY: 19 };

const state = (api) => api.engine.getEncounterSnapshot().state;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const onFloor = ([x, y]) => x >= floor.minX && x <= floor.maxX && y >= floor.minY && y <= floor.maxY;
const rats = (api) => api.npcs().filter((npc) => npc.npcTypeId === 7223);

// Protect from Melee while he swipes (phase one, between rounds), else from Magic (his bolts outhit his fur balls).
function pray(api) {
  const { phase } = state(api);
  const wanted = phase === "one" || phase === "between" || phase === "stepping" ? "ProtectMelee" : "ProtectMagic";
  if ((api.player().activePrayer ?? null) !== wanted) protect(api, wanted);
}

// Off a tile rubble will land on, onto the nearest clear floor tile. True when it steps.
function dodge(api) {
  const danger = state(api).incoming.flatMap((entry) => entry.tiles);
  const position = api.player().position;
  if (!danger.some((tile) => same(tile, position))) return false;
  for (let reach = 1; reach <= 3; reach++) {
    for (const [dx, dy] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach], [reach, reach], [-reach, -reach]]) {
      const tile = [position[0] + dx, position[1] + dy];
      if (!onFloor(tile) || danger.some((other) => same(other, tile))) continue;
      api.moveTo(...tile);
      return true;
    }
  }
  return false;
}

export const scenarios = [
  {
    // A twisted bow from the floor, praying the right way and stepping off the
    // rubble, killing his rats first when he calls them. Infinite health: the
    // whole fight, both rounds of eating and the middle included.
    name: "scurrius/twisted-bow-kill",
    kind: KIND,
    seed: 4,
    ticks: 500,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...rangedGear,
    script(tick, api) {
      pray(api);
      if (dodge(api)) return;
      const target = rats(api)[0]?.id ?? BOSS;
      if (api.player().attackTarget !== target) attack(api, target);
    },
  },
  {
    // Straight to 79%: he runs to a pile and eats, a heal each turn. The player
    // stands and prays against magic, so the rounds, the step off, the swipes
    // between and the calls of rats all come; it never attacks.
    name: "scurrius/eating-rounds",
    kind: KIND,
    seed: 8,
    ticks: 260,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    script(tick, api) {
      if (tick === 1) setBossHp(api, 395);
      pray(api);
      dodge(api);
    },
  },
  {
    // At 29% he runs to the middle and stays: magic, ranged, stomps and rats
    // every 4 ticks. The player hits him with the fang from beside his body.
    name: "scurrius/enraged-middle",
    kind: KIND,
    seed: 15,
    ticks: 120,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) setBossHp(api, 145);
      pray(api);
      if (dodge(api)) return;
      if (state(api).phase !== "enraged") return;
      const target = rats(api)[0]?.id ?? BOSS;
      if (api.player().attackTarget !== target) attack(api, target);
    },
  },
  {
    // His own mid level ranged setup, the rat bone shortbow: +10 to the max hit
    // against him and his rats, and no attack cooldown on the rats, so a wave
    // goes down a rat a tick. Rats first, praying and dodging as above.
    name: "scurrius/bone-shortbow-kill",
    kind: KIND,
    seed: 4,
    ticks: 500,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    equipment: scurriusLoadouts.mid_ranged.equipment,
    supplies: scurriusLoadouts.mid_ranged.supplies,
    script(tick, api) {
      pray(api);
      if (dodge(api)) return;
      const target = rats(api)[0]?.id ?? BOSS;
      if (api.player().attackTarget !== target) attack(api, target);
    },
  },
  {
    // His own mid level melee setup, the rat bone mace, in the middle at 29%: his rats, then him, from beside his body.
    name: "scurrius/bone-mace-middle",
    kind: KIND,
    seed: 15,
    ticks: 160,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    equipment: scurriusLoadouts.mid_melee.equipment,
    supplies: scurriusLoadouts.mid_melee.supplies,
    script(tick, api) {
      if (tick === 1) setBossHp(api, 145);
      pray(api);
      if (dodge(api)) return;
      if (state(api).phase !== "enraged") return;
      const target = rats(api)[0]?.id ?? BOSS;
      if (api.player().attackTarget !== target) attack(api, target);
    },
  },
  // The snapshot of a fresh encounter: no fight, only its start.
  {
    name: "scurrius/start",
    kind: KIND,
    seed: 1,
    ticks: 6,
    script() {},
  },
];
