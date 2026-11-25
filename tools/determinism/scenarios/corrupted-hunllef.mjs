import { attack, equip } from "./common.mjs";

// TABLE: three corrupted tiers of each weapon. Single-style runs verify that
// Hunllef eventually protects against that style and blocks further damage.
const weaponSets = [
  { name: "halberd", ids: [23849, 23850, 23851] },
  { name: "staff", ids: [23852, 23853, 23854] },
  { name: "bow", ids: [23855, 23856, 23857] },
];
export const scenarios = [
  {
    name: "corrupted-hunllef/pursuit-into-range", kind: "corrupted_hunllef",
    seed: 71, ticks: 12, start: [50, 50], mechanics: { infiniteHealth: true },
    script() {},
  },
  ...["middle", "low"].map((startPhase) => ({
    name: `corrupted-hunllef/start-${startPhase}-phase`, kind: "corrupted_hunllef",
    seed: 71, ticks: 12, mechanics: { infiniteHealth: true, corruptedHunllefStartPhase: startPhase },
    script() {},
  })),
  {
    name: "corrupted-hunllef/halberd-one-tile-gap", kind: "corrupted_hunllef",
    seed: 71, ticks: 50, start: [56, 55], equipment: { weapon: 23851 },
    mechanics: { infiniteHealth: true },
    script(tick, api) { if (tick === 1) attack(api, "corrupted-hunllef"); },
  },
  ...weaponSets.flatMap(({ name, ids }) => ids.map((weapon, tier) => ({
    name: `corrupted-hunllef/${name}-tier-${tier + 1}`, kind: "corrupted_hunllef",
    seed: 71 + tier, ticks: 100, equipment: { weapon }, mechanics: { infiniteHealth: true },
    script(tick, api) { if (tick === 1) attack(api, "corrupted-hunllef"); },
  }))),
  {
    name: "corrupted-hunllef/prayer-switch-and-victory", kind: "corrupted_hunllef",
    seed: 71, ticks: 1400, equipment: { weapon: 23854 }, inventory: [23857],
    mechanics: { infiniteHealth: true },
    script(tick, api) {
      if (tick === 1) attack(api, "corrupted-hunllef");
      const equipped = api.player().equipment.weapon;
      const protection = api.engine.encounter.protection;
      const blocked = (equipped === 23854 && protection === "magic") || (equipped === 23857 && protection === "range");
      if (blocked) {
        const next = equipped === 23854 ? 23857 : 23854;
        const slot = api.player().inventory.findIndex(item => item?.id === next);
        if (slot >= 0) {
          equip(api, slot, "weapon");
          attack(api, "corrupted-hunllef");
        }
      }
    },
  },
];
