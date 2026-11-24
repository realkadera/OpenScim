// What the delve changes, and the game's ids. Sources: the wiki ("Doom of
// Mokhaiotl" and its strategy guide) and, where the wiki is silent or
// garbled, the timings of live captures written up by the TSPS project
// (github.com/RSPSApp/tsps, docs/doom-of-mokhaiotl.md, BSD-2), checked
// against the wiki where both speak. A number from neither is marked a guess.
//
// OBS below: 20 recorded runs of delves 1 to 8 and past it (183 delves,
// about 36,000 ticks; the Outside plugin's encounter recorder, format 6,
// SaluteCFlagg's fights on outside.wiki). Where they disagree with the wiki
// or TSPS, they win.
import { monsterByNpcTypeIdAndVersion } from "../../data/monsters.js";

export const npcTypeIds = {
  doom: 14707,
  burrowed: 14709,
  larva: 14710,
  rangedLarva: 14711,
  magicLarva: 14712,
  meleeLarva: 14713,
  volatileEarth: 14714,
  earthenShield: 14715,
  giantRangedLarva: 14788,
  giantMagicLarva: 14789,
};
export const locIds = { acid: 57283, rock: 57286 };

export const seqIds = {
  idle: 12405, orb: 12406, rockThrow: 12407,
  beamCharge: 12408, beamLoop: 12409, beamCancel: 12410, beamFire: 12411,
  areaCharge: 12412, areaLoop: 12413, areaSlam: 12414, areaReturn: 12415,
  tongue: 12416, emerge: 12418, despawn: 12422,
  // Burrowing (OBS): the shield breaking (12420), then as 14709 his pose
  // (12421), a zoom (12417 each tick he moves) and an attack (12419).
  shieldBreak: 12420, burrowIdle: 12421, burrowMove: 12417, burrowAttack: 12419,
  earthIdle: 12431, earthSpawn: 12432, earthDeath: 12433, earthPop: 12434,
  shieldIdle: 12435, shieldSpawn: 12436, shieldDeath: 12437,
  larvaCrawl: 12456, larvaSpawn: 12458, larvaDeath: 12459,
};

export const spotAnims = {
  orb: { melee: 3378, magic: 3379, range: 3380 },
  // The burst of an orb that lands unprayed (captured: VFX_LEVIATHAN_01_PROJECTILE_IMPACT_*, at height 100).
  orbImpact: { melee: 2491, magic: 2492, range: 2490 },
  emerge: 3372,
  rockLaunch: { range: 3384, magic: 3385 },
  rockSplit: { range: 3386, magic: 3387 },
  debris: [3388, 3389, 3390, 3391, 3392, 3393, 3394, 3395],
  debrisShadow: 2380,
  debrisImpact: 3404,
  areaSlam: 3370,
  floorSlam: [3405, 3406, 3407],
  beamHead: 3409, beamMiddle: 3410, beamEnd: 3411, beamCharge: 3412, beamImpact: 3413,
  larvaSpawn: 3417, larvaBlast: 3374, larvaImpact: 3426,
  acidBlob: 3445, acidSplat: [3429, 3430, 3431, 3432],
  despawn: 3377,
  holyWater: 192, holyWaterShadow: 1446, holyWaterSplash: 68,
  // Burrowing (OBS): the shield breaking (3375, on him), a falling rock's
  // shadow (2529, 20 cycles on), a rock crumbling (2699), the eye where he
  // will stop (3416, and 3415 60 cycles on), his glow while burrowed (3414),
  // as he moves (3371) and as he attacks (3373, 120 cycles on); his orbs then
  // fly with a trail of their own (2487 ranged, 2488 melee, 2489 magic).
  shieldBreak: 3375, fallingRock: 2529, rockCrumble: 2699,
  eye: 3416, eyeLinger: 3415, burrowGlow: 3414, burrowMove: 3371, burrowAttack: 3373,
  burrowOrbTrail: { range: 2487, melee: 2488, magic: 2489 },
};

// The room's floor (local tiles of map square 20,149).
export const floor = { minX: 19, maxX: 43, minY: 23, maxY: 49 };
export const bossStart = [29, 35];
export const bossSize = 5;

// OBS: the 47 tiles volatile earth comes up on. While he stands where he
// surfaced at the start (every recorded shockwave of delves 1-4, 61 of them)
// only the first 32 are used; once a burrow has moved him the rest come in,
// never within 3 tiles of his centre (3,214 recorded earths, none outside).
export const earthPool = [
  [21, 47], [22, 29], [22, 34], [22, 45], [23, 40], [24, 37], [25, 32], [25, 43], [25, 47], [26, 28],
  [27, 35], [27, 39], [28, 45], [29, 31], [29, 42], [30, 27], [31, 47], [32, 32], [32, 44], [33, 29],
  [35, 27], [35, 41], [36, 33], [36, 38], [36, 44], [38, 29], [38, 36], [39, 32], [39, 42], [40, 35],
  [40, 38], [40, 45],
  [29, 38], [29, 49], [31, 40], [33, 37], [34, 35], [39, 48], [40, 49],
  [19, 27], [19, 42], [20, 38], [30, 35], [33, 25], [35, 48], [37, 25], [40, 26],
];
export const earthPoolAtStart = 32;

// Orbs fly from cycle 55 to this one, whatever the distance (OBS, every delve: 145 from delve 5 on).
const orbEndCycles = [205, 205, 175, 175, 145, 145, 145, 145];
// How many times a thrown rock picks a tile for a piece, the player's own
// among them: the picks fall within four tiles of it and may repeat, so fewer
// pieces land (OBS: the best fit to 1,147 bursts at delves 1-7; 8, from the
// trend and the most seen, 27, is inferred).
const rockPieces = [8, 12, 15, 18, 20, 22, 25, 27];

export function delveRules(delve) {
  const stats = monsterByNpcTypeIdAndVersion.get(`${npcTypeIds.doom}:Delve ${delve}`);
  return {
    delve,
    hitpoints: stats.levels.hitpoints,
    attackSpeed: stats.attackSpeed,
    // The wiki's infobox gives 47 and 65; the captures fill in the rest.
    orbMaxHit: [47, 50, 50, 50, 53, 53, 57, 65][delve - 1],
    orbStyles: delve >= 2 ? ["range", "magic", "melee"] : ["range", "magic"],
    orbEndCycles: orbEndCycles[delve - 1],
    rocks: delve >= 8 ? 2 : 1,
    rockPieces: rockPieces[delve - 1],
    rockOrbs: delve >= 4 ? 3 : delve >= 2 ? 2 : 1,
    rockBurstTicks: delve >= 5 ? 6 : 7,
    // OBS: the thrown rock lands at cycle 210, 180 from delve 5; at delve 8
    // both rocks leave together, the second landing at 270 (3 ticks later).
    rockFlightCycles: delve >= 5 ? 180 : 210,
    secondRockFlightCycles: 270,
    // Cycle the rock's first orb lands, after leaving the debris, a tick
    // between the rest (OBS: 90, 150 at delve 2; 30 from delve 7).
    rockOrbFirstCycles: delve >= 7 ? 30 : delve === 2 ? 150 : 90,
    // Ticks to his next attack after a throw: twice his attack speed, three
    // times at delve 8 with its two rocks (OBS: 54 throws, every one 12).
    afterRockTicks: (delve >= 8 ? 3 : 2) * stats.attackSpeed,
    beamMaxHit: delve >= 6 ? 99 : delve >= 4 ? 80 : 60,
    punishDelayTicks: delve >= 7 ? 6 : delve >= 3 ? 7 : 8,
    shockwaves: [1, 1, 2, 2, 3, 3, 4, 5][delve - 1],
    // The earthen shield steps every 2 ticks at delves 1-2 ("half speed"), then every tick.
    earthenShieldStepTicks: delve >= 3 ? 1 : 2,
    // One attack in three drops a larva at delve 1, one in six deeper (captured; OBS agrees).
    larvaChance: delve === 1 ? 0.3 : 0.15,
    // OBS: outside the shield two of a colour side by side at delves 5-7
    // (115 of 115), one giant at delve 8 (78 of 78).
    larvaeAtOnce: delve >= 5 && delve <= 7 ? 2 : 1,
    giantLarvae: delve >= 8,
    // The most a larva reaching him deals (TSPS, seen in game: 20 from delve 8).
    larvaReachCap: delve >= 8 ? 20 : 12,
    acid: delve >= 3,
    acidExtraBlobs: delve >= 8 ? 3 : delve >= 4 ? 2 : 1,
    demonicShield: delve >= 3,
    // From delve 5 each shield ends in a burrow (burrow.js), and the shield
    // comes again two attacks after the shockwaves that follow it.
    burrows: delve >= 5,
    // OBS: the burrowed Doom's zooms (2 at delve 5, then 3) and their speed in tiles a tick.
    zooms: delve >= 6 ? 3 : 2,
    zoomSpeed: [4, 4, 4, 4, 4, 4, 6, 8][delve - 1],
    // A car slam 9 ticks after each eye from delve 6 (OBS; wiki).
    carSlams: delve >= 6,
    // Rocks falling as he burrows (OBS: 25-31 at delve 5, 21-23 at 6-7, 14-16 at 8).
    fallingRocks: delve >= 8 ? 16 : delve >= 6 ? 23 : 28,
    // Trampled by a zoom (wiki; TSPS saw 10 at delve 5).
    trampleDamage: [10, 10, 10, 10, 10, 20, 30, 40][delve - 1],
  };
}

export const tongueMaxHit = 40;
export const debrisMaxHit = 21;
export const larvaBlastMaxHit = 21;
export const shockwaveDamage = [26, 42]; // wiki 30-42; 26-33 captured
export const acidDamage = [3, 7];
// The car slam's damage: never seen, the recorded player kept a rock between
// them in all 168 slams; the shockwave's, as TSPS guesses (inferred).
export const carSlamDamage = shockwaveDamage;
