// Scurrius' ids and his lair's tiles. The ids are the game cache's, as
// RSPSApp/tsps (docs/scurrius.md, server/plugins/bosses/scurrius/) lists them
// from the cache and its rsprox captures. Tiles are local to map square
// 51,154 (region 13210): tsps gives them in world coordinates, and a local
// tile is the world one minus (3264, 9856). "Encounter Recorder" below is four
// solo kills recorded with that RuneLite plugin (rev 243, 2026-11-26).
export const npcTypeIds = {
  solo: 7222, // CACHE rat_boss_instance, 3x3; TABLE "Scurrius" (Solo), 500 hitpoints
  public: 7221, // CACHE rat_boss_normal; TABLE "Scurrius" (Group), 1,500 hitpoints. Not fought here yet
  rat: 7223, // CACHE rat_boss_giant_rat, 2x2; TABLE "Giant rat", 15 hitpoints
};

export const seqIds = {
  idle: 10687, // CACHE: the stand of his NPC type
  walk: 10690, // CACHE: the walk of his NPC type
  run: 10691, // OBS (Encounter Recorder): his pose on his two-tile-a-tick runs, to a pile (encounter.js)
  spawn: 10686, // CACHE npc_rat_boss_spawn_01 (tsps)
  melee: 10693, // CACHE, OBS (tsps): the tail swipe
  ranged: 10694, // CACHE, OBS (tsps)
  magic: 10696, // CACHE, OBS (tsps)
  stomp: 10698, // CACHE, OBS (tsps): the stomp that brings the rubble down
  feedingIdle: 10689, // CACHE, OBS (tsps): his stand while he eats
  feedingRanged: 10695, // CACHE, OBS (tsps)
  feedingMagic: 10697, // CACHE, OBS (tsps)
  feedingStomp: 10699, // CACHE, OBS (tsps)
  feedingSummon: 10703, // CACHE, OBS (tsps): the rats called from the pile
  enragedSummon: 10706, // OBS (tsps): the screech that calls them below 30%
  death: 10705, // CACHE, OBS (tsps)
  ratIdle: 4931, // CACHE: the stand of the rat's NPC type
  ratWalk: 4932, // CACHE: the walk of the rat's NPC type
  ratAttack: 4933, // OBS (Encounter Recorder): each bite, 4 ticks apart (30 of 33 gaps)
  ratBlock: 4934, // OBS (Encounter Recorder): as the killing hit comes in, 12 of 19 deaths. Not played: the engine plays a block only on a hit the NPC lives through
  ratDeath: 4935, // OBS (Encounter Recorder): after the killing hit, in all 19 deaths
};

export const spotAnims = {
  magicCast: 2638, // CACHE vfx_rat_boss_* (tsps): on him as he casts below 30%
  feedingMagicCast: 2639, // CACHE (tsps): on him as he casts at a pile
  magicProjectile: 2640, // CACHE, OBS (tsps): the bolt of electricity
  magicImpact: 2641, // CACHE, OBS (tsps): on the player as it lands
  rangedProjectile: 2642, // CACHE, OBS (tsps): the fur ball
  rangedImpact: 2643, // CACHE, OBS (tsps)
  debris: 2644, // CACHE, OBS (tsps): the falling rubble, on each of its tiles
};

// CACHE: the map square the lair is in.
export const mapSquare = { x: 51, y: 154 };
export const bossSize = 3; // CACHE
export const ratSize = 2; // CACHE

// OBS (tsps): every rubble tile and rat lands on this floor.
export const floor = { minX: 26, maxX: 42, minY: 4, maxY: 19 };
// OBS (tsps): he appears here, facing south.
export const bossStart = [37, 11];
// OBS (tsps): below 30% he runs to the middle of the room.
export const centreTile = [34, 11];
// OBS (tsps): where a player lands, through the broken bars.
export const playerStart = [26, 12];
// OBS (tsps): the tile he stands on to eat from each food pile (his south-west
// corner), the tile he faces as he eats, and the pile's side of him (he never
// steps off towards it). The piles are 2x2: north 34,20, east 43,11, south 34,2.
export const feedingSpots = [
  { name: "north", stand: [33, 17], face: [34, 20], pile: [0, 1] },
  { name: "east", stand: [40, 10], face: [43, 11], pile: [1, 0] },
  { name: "south", stand: [34, 4], face: [35, 3], pile: [0, -1] },
];

export const onFloor = ([x, y]) => x >= floor.minX && x <= floor.maxX && y >= floor.minY && y <= floor.maxY;
export const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
