// Phosani's Nightmare (client/encounters/phosanis-nightmare/). The dream's
// floor is x 23 to 41, y 21 to 41, the corners cut for the totems (their
// south-west tiles 23,22, 39,22, 23,38 and 39,38); she starts with her
// south-west tile on 30,29 and the player south of her, on 33,28. The
// snapshot tells what a player watches for: the stage and the shield, her
// melee coming, the claws' tiles, the flowers, the spores, the surge, the
// husks' trance, the parasite and the totems' charge. Each script decides
// from it and the tick alone.
import { attack, boss, equip, item, meleeGear, protect, use } from "./common.mjs";
import { floorTiles, gapTo, isTotemTile, chebyshev, same, bossSize } from "../../../client/encounters/phosanis-nightmare/ids.js";

const KIND = "phosanis_nightmare";
const BOSS = "phosanis-nightmare";
const health = { infiniteHealth: true };
const prayers = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };
const sanfews = [10925, 10927, 10929, 10931];

const state = (api) => api.engine.getEncounterSnapshot().state;
const has = (tiles, tile) => tiles.some((other) => same(other, tile));

// Inquisitor's, the guide's melee set (loadouts.js), with Tumeken's shadow for the totems, sanfew serums and food.
const mace = 24417;
const shadow = item.tumekensShadow;
const gear = {
  equipment: {
    ...meleeGear.equipment, weapon: mace, head: 24419, body: 24420, legs: 24421, boots: 31097,
  },
  inventory: [shadow, ...Array(4).fill(10925), ...Array(4).fill(item.prayerPotion), ...Array(8).fill(item.anglerfish)],
};
// The weapon for the stage: the shadow while the totems are up, the mace otherwise.
function wield(api, wanted) {
  const me = api.player();
  if (me.equipment.weapon === wanted) return false;
  const slot = me.inventory.findIndex((entry) => entry?.id === wanted);
  if (slot < 0) return false;
  equip(api, slot, "weapon");
  return true;
}

// The protection against the first hit in the air (hers, her husks', her parasite's), or her melee coming.
function pray(api, tick) {
  const s = state(api);
  const melee = s.melee.find((swing) => swing.at >= tick);
  const inAir = (api.engine.worldState.pendingHits ?? [])
    .filter((hit) => hit.targetId === "player" && hit.sourceId !== "player" && hit.impactTick >= tick)
    .sort((a, b) => a.impactTick - b.impactTick)[0];
  const style = melee && (!inAir || melee.at <= inAir.impactTick) ? melee.stoppedBy : inAir?.style;
  const wanted = prayers[style];
  if (wanted && api.player().activePrayer !== wanted) protect(api, wanted);
}

// Tiles that hurt now or soon: the claws' portals and her body under them, the
// berry quadrants of her flowers, the spores and the tiles beside them, her surge's lane.
function dangerTiles(api, tick, clawWarning) {
  const s = state(api);
  const her = boss(api);
  const tiles = [];
  const claws = s.claws.filter((set) => set.at - tick <= clawWarning);
  for (const set of claws) tiles.push(...set.tiles);
  if (claws.length > 0 && her) for (let dx = 0; dx < bossSize; dx++) for (let dy = 0; dy < bossSize; dy++) tiles.push([her.position[0] + dx, her.position[1] + dy]);
  if (s.flowers && s.flowers.stage !== "leaving") {
    const safe = s.flowers.safe;
    for (const tile of floorTiles) {
      const [x, y] = tile;
      if (x === 32 || y === 31) continue;
      const quadrant = (y > 31 ? "n" : "s") + (x > 32 ? "e" : "w");
      if (quadrant !== safe) tiles.push(tile);
    }
  }
  for (const spore of s.spores?.tiles ?? []) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push([spore[0] + dx, spore[1] + dy]);
  if (s.surge) {
    const { from, to } = s.surge;
    for (let x = Math.min(from[0], to[0]); x <= Math.max(from[0], to[0]) + 4; x++) for (let y = Math.min(from[1], to[1]); y <= Math.max(from[1], to[1]) + 4; y++) tiles.push([x, y]);
  }
  return tiles;
}

// The nearest safe tile, beside her if one is.
function safeTile(api, danger) {
  const me = api.player().position;
  const her = boss(api);
  let best = null;
  let bestScore = Infinity;
  for (const tile of floorTiles) {
    if (isTotemTile(tile) || has(danger, tile)) continue;
    const score = chebyshev(me, tile) * 10 + (her ? Math.abs(gapTo(tile, her.position) - 1) : 0);
    if (score < bestScore) {
      best = tile;
      bestScore = score;
    }
  }
  return best;
}

function fight(tick, api) {
  const s = state(api);
  const me = api.player();
  pray(api, tick);
  if (s.infection && !s.infection.weak) {
    const slot = me.inventory.findIndex((entry) => entry && sanfews.includes(entry.id));
    if (slot >= 0) use(api, slot);
  } else if (me.prayerState.points < 30 && tick % 3 === 0) {
    const slot = me.inventory.findIndex((entry) => entry && [item.prayerPotion, 139, 141, 143].includes(entry.id));
    if (slot >= 0) use(api, slot);
  }
  const danger = dangerTiles(api, tick, s.stage === "desperate" ? 1 : 3);
  if (!s.held && has(danger, me.position)) {
    const tile = safeTile(api, danger);
    if (tile && !same(tile, me.position)) {
      if (me.attackTarget !== null) attack(api, null);
      api.moveTo(...tile);
      return;
    }
  }
  const npcs = api.npcs();
  // The mace for husks and parasites (crush always hits them for its most), the shadow for the totems.
  const crushable = npcs.some((npc) => npc.id.startsWith("nightmare-husk") || npc.id.startsWith("nightmare-parasite"));
  if (wield(api, s.stage === "totems" && !crushable ? shadow : mace)) return;
  const pick = (test) => npcs.filter(test).sort((a, b) => chebyshev(a.position, me.position) - chebyshev(b.position, me.position))[0];
  const husk = pick((npc) => npc.id.startsWith("nightmare-husk") && !npc.untargetable);
  // In her desperation a sleepwalker costs 15: he keeps on her.
  const walker = s.stage === "desperate" ? null : pick((npc) => npc.id.startsWith("nightmare-sleepwalker") && !npc.untargetable);
  const parasite = pick((npc) => npc.id.startsWith("nightmare-parasite"));
  const totem = s.stage === "totems" ? pick((npc) => npc.id.startsWith("nightmare-totem") && !npc.untargetable) : null;
  const target = husk ?? walker ?? parasite ?? totem ?? (s.stage === "shield" || s.stage === "desperate" ? boss(api) : null);
  if (target && me.attackTarget !== target.id) attack(api, target.id);
}

export const scenarios = [
  {
    // The whole fight with the guide's melee set, praying against each hit,
    // stepping off the claws, the berries, the spores and her lane, killing
    // husks, parasites and sleepwalkers, charging the totems by hand, and
    // drinking a sanfew serum when a parasite takes hold.
    name: "phosanis-nightmare/kill",
    kind: KIND,
    seed: 11,
    ticks: 1500,
    mechanics: health,
    ...gear,
    script: fight,
  },
  {
    // The same from another start of her cycle of forms (11153, 9418, 9417; the first's 9418, 9417, 9416).
    name: "phosanis-nightmare/kill-other-forms",
    kind: KIND,
    seed: 2,
    ticks: 1500,
    mechanics: health,
    ...gear,
    script: fight,
  },
  {
    // The player stands where he starts, attacks her and prays nothing: her
    // standard attacks, her specials in their order, the claws and her surge as they come.
    name: "phosanis-nightmare/standing",
    kind: KIND,
    seed: 5,
    ticks: 260,
    mechanics: health,
    ...gear,
    script(tick, api) {
      if (tick === 1) attack(api, BOSS);
    },
  },
  {
    // Her 9418 form first (parasite, flowers, curse): the player stands, attacks her and drinks nothing, so her
    // parasite comes out fully grown, heals her shield and, with it full, attacks him.
    name: "phosanis-nightmare/parasite",
    kind: KIND,
    seed: 6,
    ticks: 300,
    mechanics: health,
    ...gear,
    script(tick, api) {
      if (tick === 1) attack(api, BOSS);
    },
  },
  {
    // Her 9417 form first (spores, husks, curse): the player walks next to a spore as they arm, then attacks her
    // while drowsy, and again once it has worn off.
    name: "phosanis-nightmare/spores",
    kind: KIND,
    seed: 5,
    ticks: 300,
    mechanics: health,
    ...gear,
    script(tick, api) {
      const s = state(api);
      const me = api.player();
      if (s.spores?.armed && !s.drowsy && s.spores.tiles.length > 0) {
        const [x, y] = s.spores.tiles[0];
        const beside = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].find((tile) => floorTiles.some((floor) => same(floor, tile)));
        if (me.attackTarget !== null) attack(api, null);
        api.moveTo(...beside);
        return;
      }
      if (me.attackTarget !== BOSS && !s.away) attack(api, BOSS);
    },
  },
  {
    // Her third phase (the boss hitpoints preset): the player prays against
    // each attack ahead of time, and she switches the protection off.
    name: "phosanis-nightmare/third-phase",
    kind: KIND,
    seed: 9,
    ticks: 200,
    mechanics: health,
    ...gear,
    script(tick, api) {
      if (tick === 1) api.act({ type: "applyBossHpPreset", hp: 1068 });
      if (tick >= 2) fight(tick, api);
    },
  },
  {
    // Her desperation (the boss hitpoints preset): her claws on and on, a
    // sleepwalker every 8 ticks; the player stands and lets them come.
    name: "phosanis-nightmare/desperation",
    kind: KIND,
    seed: 4,
    ticks: 80,
    mechanics: health,
    ...gear,
    script(tick, api) {
      if (tick === 1) api.act({ type: "applyBossHpPreset", hp: 150 });
    },
  },
];
