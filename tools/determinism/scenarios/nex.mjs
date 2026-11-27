// Nex (client/encounters/nex/). Her chamber is x 31 to 59, y 5 to 33 of map
// square 45,81; she rises with her south-west tile on 44,18 and the player
// west of her on 42,19, the teammates around her. The snapshot tells what a
// player watches for: the phase, the party, her shadows, the aisle she looks
// down, her containment, an ice prison, a sacrifice. Each script decides from
// it and the tick alone.
import { attack, boss, equip, item, protect, use } from "./common.mjs";
import { gapTo, chebyshev, bossSize, inChamber } from "../../../client/encounters/nex/ids.js";
import { isArenaTileWalkable } from "../../../client/engine/arena.js";

const KIND = "nex";
const BOSS = "nex";
const health = { infiniteHealth: true };
const prayers = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };

const state = (api) => api.engine.getEncounterSnapshot().state;

// The guide's ranged setup (loadouts.js): the Zaryte crossbow, Osmumten's fang for the stalagmites, potions and brews.
const gear = {
  equipment: {
    weapon: item.zaryteCrossbow, shield: 21000, head: item.masoriMask, body: item.masoriBody, legs: item.masoriChaps, hands: item.zaryteVambraces,
    boots: 31097, amulet: 33639, cape: 28955, ring: item.venatorRing,
  },
  supplies: { equippedAmmo: { id: item.rubyDragonBoltsE } },
  inventory: [item.osmumtensFang, item.zaryteCrossbow, ...Array(6).fill(item.superRestore), ...Array(12).fill(item.saradominBrew)],
};
const fang = item.osmumtensFang;

function wield(api, wanted) {
  const me = api.player();
  if (me.equipment.weapon === wanted) return false;
  const slot = me.inventory.findIndex((entry) => entry?.id === wanted);
  if (slot < 0) return false;
  equip(api, slot, "weapon");
  return true;
}

// The protection the phase calls for (WIKI): missiles in her shadow phase, magic otherwise.
function pray(api) {
  const s = state(api);
  const wanted = s.phase === "shadow" ? prayers.range : prayers.magic;
  if (api.player().activePrayer !== wanted) protect(api, wanted);
}

// What to hit: a stalagmite of a prison, a reaver, the mage she has called, else her.
function target(api) {
  const npcs = api.npcs();
  const stalagmite = npcs.find((npc) => npc.id.startsWith("nex-stalagmite") && chebyshev(npc.position, api.player().position) <= 1);
  if (stalagmite) return stalagmite;
  const reaver = npcs.find((npc) => npc.id.startsWith("nex-reaver") && !npc.death);
  if (reaver) return reaver;
  const mage = npcs.find((npc) => npc.archetypeId === "nex_mage" && !npc.untargetable && !npc.death);
  if (mage) return mage;
  const her = boss(api);
  return her && !her.untargetable ? her : null;
}

function walkable(tile) {
  return inChamber(tile) && isArenaTileWalkable(tile[0], tile[1]);
}
// A tile clear of what is coming: her shadows, the aisle she looks down, the ring of her containment, her wrath.
function dangerous(api, tile) {
  const s = state(api);
  const her = boss(api);
  if (s.shadows.some((shadow) => shadow.tile[0] === tile[0] && shadow.tile[1] === tile[1])) return true;
  if (s.dashing && her) {
    const aisle = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] }[s.dashing.aisle];
    const [dx, dy] = aisle;
    const along = dx !== 0 ? (tile[0] - her.position[0]) * dx : (tile[1] - her.position[1]) * dy;
    const across = dx !== 0 ? tile[1] - her.position[1] : tile[0] - her.position[0];
    if (along > 0 && across >= 0 && across < bossSize) return true;
  }
  if (her && s.stage === "fight" && s.phase === "ice" && gapTo(tile, her.position) <= 1) return true;
  if (her && s.darkness && gapTo(tile, her.position) <= 1) return true;
  if (her && s.stage === "dead" && gapTo(tile, her.position) <= 1) return true;
  return false;
}
function nearestSafe(api, from, accept = () => true) {
  for (let radius = 1; radius <= 8; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const tile = [from[0] + dx, from[1] + dy];
        if (walkable(tile) && !dangerous(api, tile) && accept(tile)) return tile;
      }
    }
  }
  return null;
}

// A ranger's fight, as the recorded team fought: by her (west of her, a tile off) and 8 off in her shadow phase;
// off her shadows, out of the aisle and her containment; away when sacrificed; the fang for a prison.
function rangerScript({ dodge = true } = {}) {
  return (tick, api) => {
    const me = api.player();
    const s = state(api);
    const her = boss(api);
    if (tick === 1) return;
    pray(api);
    if (me.vitals.hp < 60 && tick % 3 === 0) {
      const brew = me.inventory.findIndex((entry) => entry?.id === item.saradominBrew);
      if (brew >= 0) use(api, brew);
    }
    if ((me.prayerState?.points ?? 99) < 30 && tick % 3 === 1) {
      const restore = me.inventory.findIndex((entry) => entry?.id === item.superRestore);
      if (restore >= 0) use(api, restore);
    }
    if (!her) return;
    const prisonAround = api.npcs().some((npc) => npc.id.startsWith("nex-stalagmite"));
    if (prisonAround) {
      if (wield(api, fang)) return;
    } else if (wield(api, item.zaryteCrossbow)) return;
    if (dodge) {
      if (s.sacrificeTarget === "player" && gapTo(me.position, her.position) < 8) {
        const far = nearestSafe(api, me.position, (tile) => gapTo(tile, her.position) >= 8);
        if (far) {
          api.moveTo(...far);
          return;
        }
      }
      if (dangerous(api, me.position)) {
        const safe = nearestSafe(api, me.position);
        if (safe) {
          api.moveTo(...safe);
          return;
        }
      }
    }
    const want = target(api);
    // By her (a tile west of her), 8 off in her shadow phase; not while a mage or a reaver is the target.
    const goal = s.phase === "shadow" || s.darkness ? [her.position[0] - 8, her.position[1] + 1] : [her.position[0] - 1, her.position[1] + 1];
    if (want?.id === BOSS && s.stage === "fight" && chebyshev(me.position, goal) > 1 && walkable(goal) && !dangerous(api, goal)) {
      api.moveTo(...goal);
      return;
    }
    if (want && me.attackTarget !== want.id) attack(api, want.id);
  };
}

const base = { kind: KIND, ...gear, mechanics: health };

export const scenarios = [
  // The whole fight with the default team of four: her five phases, the mages, the reavers, her wrath.
  { ...base, name: "nex/kill", seed: 1, ticks: 900, script: rangerScript() },
  // Alone: no teammates; every special on the player.
  { ...base, name: "nex/solo", seed: 2, ticks: 300, mechanics: { ...health, nexTeamSize: 1 }, script: rangerScript() },
  // A team of five, standing in what comes: her specials land.
  { ...base, name: "nex/standing", seed: 3, ticks: 400, mechanics: { ...health, nexTeamSize: 5 }, script: rangerScript({ dodge: false }) },
];
