// Araxxor (client/encounters/araxxor/). He comes up at 47,22 (7 x 7) with
// nine eggs around him; the player stands on 53,29, beside his north-east
// corner, where BigSneezi fought him in the recorded kills.
import { attack, boss, magicGear, meleeGear, protect, rangedGear, setBossHp, special } from "./common.mjs";

const KIND = "araxxor";
const BOSS = "araxxor";
const besideHim = [53, 29];

// Fights him with melee from beside him, praying against it: his legs, a
// special every seventh attack and an egg every 42 ticks.
const meleeFight = (name, eggs, ticks) => ({
  name,
  kind: KIND,
  seed: 3,
  ticks,
  // He would kill a player who stands still in his acid.
  mechanics: { araxxorEggs: eggs, infiniteHealth: true },
  start: besideHim,
  ...meleeGear,
  script(tick, api) {
    if (tick === 1) {
      protect(api, "ProtectMelee");
      attack(api, BOSS);
    }
  },
});

export const scenarios = [
  // Red eggs first: the acid drip, and a Ruptura first out.
  meleeFight("araxxor/red-eggs", "red", 130),
  // Green eggs first: the rolling acid ball, and an Acidic first out.
  meleeFight("araxxor/green-eggs", "green", 130),
  // White eggs first: the acid spray, and a Mirrorback first out.
  meleeFight("araxxor/white-eggs", "white", 130),
  {
    // From the tunnel with a bow, praying against missiles: he walks up and
    // shoots or casts, and drains Defence or Prayer when it hurts.
    name: "araxxor/from-range",
    kind: KIND,
    seed: 5,
    ticks: 60,
    mechanics: { araxxorEggs: "green" },
    ...rangedGear,
    script(tick, api) {
      if (tick === 1) {
        protect(api, "ProtectRange");
        attack(api, BOSS);
      }
    },
  },
  {
    // Brought to 300 hitpoints and fought down past 255: the enrage and the
    // cleaves every 4 ticks. Every 8 ticks the player steps under him, so
    // that a cleave cuts him; then his death with the eggs and araxytes.
    name: "araxxor/enrage-and-kill",
    kind: KIND,
    seed: 11,
    ticks: 140,
    mechanics: { araxxorEggs: "red", infiniteHealth: true },
    start: besideHim,
    ...meleeGear,
    script(tick, api) {
      if (tick === 1) {
        protect(api, "ProtectMelee");
        attack(api, BOSS);
      }
      if (tick === 25) setBossHp(api, 300);
      const araxxor = boss(api);
      if (tick <= 25 || !araxxor) return;
      const { enraged } = api.engine.getEncounterSnapshot().state;
      if (enraged && tick % 8 === 0) {
        api.act({ type: "attackTarget", targetId: null }); // a click on the ground
        api.moveTo(araxxor.position[0] + 3, araxxor.position[1] + 5);
      } else if (tick % 8 > 1 && api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // A tile back the tick before he attacks: magic from 2 tiles away, and a
    // step straight up to the player in the same tick (BigSneezi's red eggs,
    // t 218).
    name: "araxxor/magic-and-step",
    kind: KIND,
    seed: 3,
    ticks: 64,
    mechanics: { araxxorEggs: "red", infiniteHealth: true },
    start: besideHim,
    ...meleeGear,
    script(tick, api) {
      if (tick === 54) api.moveTo(53, 30);
    },
  },
  {
    // The acid ball at a player north of him: it rolls straight north from
    // his edge (BigSneezi's green eggs, t 119).
    name: "araxxor/ball-north",
    kind: KIND,
    seed: 3,
    ticks: 56,
    mechanics: { araxxorEggs: "green", infiniteHealth: true },
    start: [51, 29],
    ...meleeGear,
  },
  {
    // A Mirrorback shares his damage, then is killed beside the player.
    name: "araxxor/mirrorback",
    kind: KIND,
    seed: 9,
    ticks: 60,
    mechanics: { araxxorEggs: "white", infiniteHealth: true },
    start: besideHim,
    ...meleeGear,
    script(tick, api) {
      const mirrorback = api.npcs().find((npc) => npc.id === "araxyte-0");
      const target = mirrorback && tick > 45 ? mirrorback.id : BOSS;
      if (api.player().attackTarget !== target) attack(api, target);
    },
  },
  {
    // Enraged; off his corner, 2 tiles away, as he cleaves: one pool (red
    // eggs, t 332), then away from him: he stands for 2 ticks and comes.
    name: "araxxor/cleave-off-corner",
    kind: KIND,
    seed: 3,
    ticks: 24,
    mechanics: { araxxorEggs: "red", infiniteHealth: true },
    start: [46, 29],
    ...meleeGear,
    script(tick, api) {
      if (tick === 3) setBossHp(api, 250);
      if (tick === 7) api.moveTo(45, 30);
      if (tick === 9) api.moveTo(45, 33);
    },
  },
  {
    // Aranea boots, in magic armour (he shoots, its ranged defence being the
    // lower): his shots at a player who runs from side to side; then the
    // cleaves of his enrage at one who stands still.
    name: "araxxor/aranea-boots",
    kind: KIND,
    seed: 5,
    ticks: 130,
    mechanics: { araxxorEggs: "red", infiniteHealth: true },
    start: [63, 24],
    equipment: { ...magicGear.equipment, boots: 29806 },
    script(tick, api) {
      if (tick === 80) setBossHp(api, 250);
      if (tick < 80) {
        const araxxor = boss(api), west = Math.floor(tick / 14) % 2 === 1;
        if (araxxor && tick % 14 === 0) api.moveTo(west ? 38 : 62, 24);
      }
    },
  },
  {
    // Elder maul specials: his Defence goes down by 45 levels and no further, before the enrage and after.
    name: "araxxor/defence-drain",
    kind: KIND,
    seed: 7,
    ticks: 60,
    mechanics: { araxxorEggs: "red", infiniteHealth: true, infiniteSpecialAttack: true },
    start: besideHim,
    ...meleeGear,
    equipment: { ...meleeGear.equipment, weapon: 21003, shield: undefined },
    script(tick, api) {
      if (tick === 1) attack(api, BOSS);
      if (tick === 30) setBossHp(api, 200);
      if (tick % 6 === 1) special(api); // a maul's attack every 6 ticks
      const araxxor = boss(api);
      if (araxxor && araxxor.vitals.hp < 120) setBossHp(api, 200);
    },
  },
];
