// The Whisperer's fixed data: her arena's tiles, the specials' layouts, the cache's ids. The rules are encounter.js's.
//
// Sources, beside the usual: RSPSApp is RSPSApp/tsps (https://github.com/RSPSApp/tsps, BSD-2-Clause), its
// docs/whisperer.md and server/plugins/bosses/data/whisperer.json, which read the fight from rsprox recordings
// 1703, 3281, 3285 and 3299 (one quest fight and three of a Grid Master world). Its world tiles are turned into
// this map square's here (`local`). What it calls provisional is marked inferred.
// Ids are the cache's; their names are from its gameval index.

// CACHE: the sunken cathedral of the Lassar Undercity, region 10595 (WIKI: her pin, 2656,6369).
export const mapSquare = { x: 41, y: 99 };
const base = [mapSquare.x * 64, mapSquare.y * 64];
/** A world tile as this map square's. */
export const local = ([x, y]) => [x - base[0], y - base[1]];

export const ids = {
  figure: 12213, // CACHE: the Odd Figure, as she waits to be disturbed
  boss: 12204, // CACHE whisperer
  melee: 12205, // CACHE: her form as she binds the player and walks after them (RSPSApp: recorded)
  tentacle: 12208, // CACHE
  columnShadow: 12209, // CACHE: a Floating Column as the Shadow Realm shows it
  column: 12210, // CACHE
  soul: 12211, // CACHE: a Lost Soul
  soulShadow: 12212, // CACHE: as the Shadow Realm shows it
  fragment: 28357, // CACHE BLACKSTONE_FRAGMENT
  fragmentActive: 28356, // CACHE BLACKSTONE_FRAGMENT_ACTIVE: glowing, when it can be used
};
export const seqs = {
  figureIdle: 10231, // CACHE npc_whisperer_01_idle_03
  figureReturn: 10228, // CACHE npc_whisperer_01_spawn_02
  spawn: 10227, // CACHE npc_whisperer_01_spawn_01: disturbed
  idle: 10230, // CACHE npc_whisperer_01_idle_01
  walk: 10232, // CACHE npc_whisperer_01_walk_01
  melee: 10234, // CACHE npc_whisperer_01_attack_melee_01
  ranged: 10237, // CACHE npc_whisperer_01_attack_ranged_03; RSPSApp: the hands alternate, 10237 and 10238
  rangedAlt: 10238,
  magic: 10243, // CACHE npc_whisperer_01_attack_magic_03, and 10244
  magicAlt: 10244,
  teleport: 10247, // CACHE npc_whisperer_01_teleport_01: a special starts
  appear: 10248, // CACHE npc_whisperer_01_teleport_02
  screech: 10250, // CACHE npc_whisperer_01_attack_screech_01_start
  screechHold: 10251,
  screechBlast: 10252,
  bind: 10254, // CACHE npc_whisperer_01_summon_leeches_01: RSPSApp, recorded with the bind and the seeds
  souls: 10256, // CACHE npc_whisperer_01_teleport_summon_souls_01_start
  soulChant: 10257,
  soulResolve: 10259,
  death: 10260, // CACHE npc_whisperer_01_death_01
  tentacleSpawn: 10263, // CACHE npc_whisperer_tentacle_01_spawn_01
  tentacleIdle: 10264,
  tentacleAttack: 10266,
  tentacleDeath: 10267,
  columnSpawn: 10226, // CACHE vfx_whisperer_column_spawn
  columnIdle: 8867, // CACHE: the Floating Column's own
  soulIdle: 5538, // CACHE: the Lost Soul's own, and its walk 5539
  soulSpawn: 9047, // RSPSApp: recorded
  soulChantSay: 5545,
  soulFade: 5542,
  knockback: 9799, // RSPSApp: the player flung back from the figure
};
export const spots = {
  ranged: 2444, // CACHE proj_whisperer_01_ranged_01
  magic: 2445, // CACHE proj_whisperer_01_magic_01
  magicImpact: 2446, // CACHE whisperer_magic_impact
  tentaclePath: [2447, 2448, 2449, 2450], // RSPSApp: the four tiles of a tentacle's lash, 5 cycles apart (3285)
  tentacleSpawn: 2452, // CACHE spotanim_whisperer_tentacle_01_spawn_01
  tentacleAttack: 2454,
  leech: 2456, // CACHE projanim_whisperer_egg_01_larvae_01: a seed that hatches
  soulAbsorb: 2457, // CACHE projanim_whisperer_ghost_spawn_01; 2458 in the Shadow Realm
  soulAbsorbShadow: 2458,
  seedSpawn: 2459,
  seedVanishShadow: 2461,
  seedHatchShadow: 2462,
  seedStomp: 2463,
  seedVanish: 2464,
  seedHatch: 2465,
  bindImpact: 2466, // CACHE whisperer_entangle_impact
  bind: 2467, // CACHE whisperer_entangle_travel
  screech: 2470, // CACHE vfx_whisperer_01_attack_screech_01_end
  screechProjectile: 2471,
  columnSpawn: 2450, // RSPSApp: on each tile of a column as it rises
  soulSpawn: 668, // RSPSApp: the souls fly out of her on it
  bindCast: 177,
};
// CACHE: the seeds, as objects of the map. In the Shadow Realm a light seed and a dark one; outside, one look for both.
export const seedLocs = { light: 47573, dark: 47574, real: 47575 };

// RSPSApp (site): her place, where she waits and comes back to for each special; the player's arrival.
export const bossSite = local([2655, 6368]);
export const playerStart = local([2656, 6380]);
// RSPSApp: the arena, and the tiles a tentacle can rise on.
export const arena = { minX: local([2640, 0])[0], maxX: local([2676, 0])[0], minY: local([0, 6352])[1], maxY: local([0, 6385])[1] };
export const tentacleBounds = { minX: local([2641, 0])[0], maxX: local([2675, 0])[0], minY: local([0, 6353])[1], maxY: local([0, 6384])[1] };
// RSPSApp (specials): where she screeches from, south of the columns.
export const screechY = local([0, 6356])[1];
// RSPSApp (specials, corroborated by recording 3285): the eight columns' south-west tiles, each 2 x 2.
export const columns = [[2646, 6365], [2648, 6361], [2651, 6363], [2654, 6364], [2657, 6364], [2660, 6363], [2663, 6361], [2665, 6365]].map(local);
// RSPSApp (specials): the twelve souls' tiles.
export const souls = [
  [2650, 6375], [2650, 6373], [2648, 6373], [2660, 6375], [2662, 6373], [2648, 6366],
  [2650, 6364], [2652, 6362], [2662, 6362], [2662, 6364], [2664, 6364], [2664, 6371],
].map(local);
// WIKI, RSPSApp: the four sets of souls, by what killing a whole set gives.
export const soulSets = [
  { phrase: "Vita!", size: 2 }, // a fifth of the player's hitpoints
  { phrase: "Oratio!", size: 3 }, // a fifth of their prayer
  { phrase: "Sanitas!", size: 3 }, // 15 sanity
  { phrase: "Mors!", size: 4 }, // 50 damage to her
];

// The seeds of the Corrupted Seeds special: RSPSApp's transcription of the wiki's four route diagrams, which
// recording 3285 bears out tile for tile. Offsets from the middle tile of her place, and light (a seed to stomp)
// or dark.
export function seedLayout(pattern) {
  if (pattern < 2) {
    // The first two diagrams are drawn on the diagonal: their grid turned into the world's.
    const grid = [[0, 0], [1, -1], [2, -2], [0, 1], [1, 0], [0, 2], [1, 1], [2, 0], [4, -2], [1, 2], [1, 3], [2, 2], [4, 0], [5, -1], [5, 0], [2, 4], [4, 2], [5, 1], [6, 0], [5, 2], [6, 1], [4, 4], [5, 3], [6, 2]];
    const light = new Set(pattern === 0 ? [0, 2, 5, 7, 8, 11, 12, 15, 16, 18, 21, 23] : [0, 1, 2, 5, 7, 8, 10, 11, 12, 13, 15, 16, 18, 21, 22, 23]);
    return grid.map(([x, y], index) => ({ dx: x - 3 - (y - 1), dy: x - 3 + (y - 1), light: light.has(index) }));
  }
  const seeds = [];
  for (const y of [-6, -4, 4, 6]) for (const x of [-1, 0, 1]) seeds.push({ dx: x, dy: y, light: x !== 0 && (Math.abs(y) === 4 || pattern === 3) });
  for (const y of [-2, 2]) for (const x of [-5, -3, 3, 5]) seeds.push({ dx: x, dy: y, light: Math.abs(x) === 3 || pattern === 2 });
  for (const x of [-6, -5, -4, -3, 3, 4, 5, 6]) seeds.push({ dx: x, dy: 0, light: Math.abs(x) === 5 });
  return seeds;
}

export const messages = {
  pulse: { text: "Your blackstone fragment pulses with dark energy...", color: "#ff289d" },
  deplete: { text: "Your blackstone fragment loses all its energy.", color: "#ff3045" },
  unresponsive: { text: "Your blackstone fragment seems unresponsive." },
  screech: { text: "The Whisperer prepares to let out a powerful screech...", color: "#a53fff" },
  seeds: { text: "Leeches begin to grow from the shadows...", color: "#a53fff" },
  seedsPerfect: { text: "You manage to deter all of the shadow leeches perfectly, regaining some sanity.", color: "#229628" },
  seedsDone: { text: "You manage to deter all of the shadow leeches.", color: "#229628" },
  seedsFailed: { text: "Leeches from the shadows hatch, draining your health and mind!", color: "#ff3045" },
  souls: { text: "The Whisperer begins to call upon the lost...", color: "#a53fff" },
  soulsFull: { text: "You fully disturb the Whisperer's chant.", color: "#229628" },
  soulsPartial: { text: "You manipulated the Whisperer's chant in your favour.", color: "#229628" },
  soulsFailed: { text: "You fail to disrupt the Whisperer's chant.", color: "#ff3045" },
  bind: { text: "The Whisperer binds you in place!", color: "#ff3045" },
  enrage: { text: "The Whisperer pulls you into the Shadow Realm...", color: "#ff289d" },
  insanity: { text: "The darkness of the Shadow Realm begins to consume your mind!", color: "#ef1020" },
};
