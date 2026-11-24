// The Doom of Mokhaiotl (client/encounters/doom-of-mokhaiotl/). He stands
// at 29,35 (5 x 5) in the middle of his room; the player starts at 31,28.
import { attack, meleeGear, protect, rangedGear } from "./common.mjs";

const KIND = "doom_of_mokhaiotl";
const DEEP = "doom_of_mokhaiotl_deep"; // delves 2 to 8, on map square 53,100
const BOSS = "doom";
// Clicks the boss again whenever the player has lost him (a rock pushing them aside does).
const keepAttacking = (api) => api.player().attackTarget !== BOSS && attack(api, BOSS);

export const scenarios = [
  {
    // Delve 1 (525 hitpoints) from range with no prayer: orbs, rocks and a
    // charge whose beam fires, since nothing punishes it.
    name: "doom/delve-1-ranged",
    kind: KIND,
    seed: 3,
    ticks: 400,
    mechanics: { doomDelve: "1", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      keepAttacking(api);
    },
  },
  {
    // Delve 2 in melee: the tongue lash, and every charge punished.
    name: "doom/delve-2-melee",
    kind: DEEP,
    seed: 5,
    ticks: 400,
    mechanics: { doomDelve: "2", infiniteHealth: true },
    ...meleeGear,
    script(tick, api) {
      keepAttacking(api);
    },
  },
  {
    // Delve 3 with Protect from Magic, prayed again on the tick after each
    // rock bursts and switches it off: the splits that land then are blocked.
    name: "doom/delve-3-reprays",
    kind: DEEP,
    seed: 9,
    ticks: 300,
    mechanics: { doomDelve: "3", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      keepAttacking(api);
      if (api.player().activePrayer === null) protect(api, "ProtectMagic");
    },
  },
  {
    // Delve 1: at the shockwave the player shoots two volatile earths, then
    // stands in the earthen shield as it walks, and takes no shockwave.
    name: "doom/delve-1-earthen-shield",
    kind: KIND,
    seed: 8,
    ticks: 130,
    mechanics: { doomDelve: "1", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      const npcs = api.npcs().filter((npc) => npc.alive && npc.death === undefined);
      const shield = npcs.find((npc) => npc.id === "doom-earthen-shield");
      const earth = npcs.filter((npc) => npc.id.startsWith("doom-earth-"));
      if (shield) return api.moveTo(shield.position[0] + 1, shield.position[1] + 1);
      if (earth.length > 0) return api.player().attackTarget?.startsWith("doom-earth-") || attack(api, earth[0].id);
      keepAttacking(api);
    },
  },
  {
    // Delve 2 with a crystal halberd, two tiles off: no tongue, so orbs and
    // rocks, and every melee charge punished (no beam).
    name: "doom/delve-2-halberd",
    kind: DEEP,
    seed: 4,
    ticks: 60,
    mechanics: { doomDelve: "2", infiniteHealth: true },
    equipment: { ...meleeGear.equipment, weapon: 23987, shield: undefined },
    // Holds the row two tiles south of him (y 33), on a tile no rock stands on.
    script(tick, api) {
      if (api.player().position[1] === 33) return keepAttacking(api);
      const rocks = api.engine.getEncounterSnapshot().state.rocks.map(String);
      api.moveTo([31, 30, 32, 29, 33].find((x) => !rocks.includes(String([x, 33]))), 33);
    },
  },
  {
    // Delve 3 with Emberlight (demonbane) beside him: the tongue, and the
    // demonic shield broken by demonbane before its beam fires.
    name: "doom/delve-3-emberlight",
    kind: DEEP,
    seed: 21,
    ticks: 300,
    mechanics: { doomDelve: "3", infiniteHealth: true },
    equipment: { ...meleeGear.equipment, weapon: 29589, shield: undefined },
    script(tick, api) {
      keepAttacking(api);
    },
  },
  {
    // Delve 4 from range: coloured larvae. The player shoots every green
    // (ranged) larva, which dies to two 1-damage arrows, and, when none is up,
    // a blue (magic) one, which takes nothing; then the boss. A red (melee)
    // one comes during the shield.
    name: "doom/delve-4-coloured-larvae",
    kind: DEEP,
    seed: 6,
    ticks: 300,
    mechanics: { doomDelve: "4", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      const larvae = api.npcs().filter((npc) => npc.alive && npc.death === undefined && npc.id.startsWith("doom-larva-"));
      const green = larvae.find((npc) => npc.npcTypeId === 14711);
      const blue = larvae.find((npc) => npc.npcTypeId === 14712);
      const target = green ?? blue;
      if (target) return api.player().attackTarget === target.id || attack(api, target.id);
      keepAttacking(api);
    },
  },
  {
    // Delve 5: the shield broken, he burrows. Falling rocks, two eyes and
    // zooms that crumble what they cross, larvae in pairs, then he surfaces
    // and the floor shakes.
    name: "doom/delve-5-burrow",
    kind: DEEP,
    seed: 9,
    ticks: 300,
    mechanics: { doomDelve: "5", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      keepAttacking(api);
    },
  },
  {
    // Delve 8: two rocks a throw, three splits each, 4-tick attacks; giant
    // larvae, and a burrow whose zooms slam the floor.
    name: "doom/delve-8-ranged",
    kind: DEEP,
    seed: 11,
    ticks: 300,
    mechanics: { doomDelve: "8", infiniteHealth: true },
    ...rangedGear,
    script(tick, api) {
      keepAttacking(api);
    },
  },
];
