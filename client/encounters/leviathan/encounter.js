// The Leviathan, the fourth boss of Desert Treasure II: the post-quest version
// and the awakened one (versions, below).
// https://oldschool.runescape.wiki/w/The_Leviathan/Strategies
//
// It lies in the pool in the middle of its arena and never leaves it. From
// 4 ticks after it surfaces it fires volleys of orbs at the player, each orb
// a style of its own (magic, ranged, or from the third volley melee), which
// the right protection prayer blocks if it is up as the orb lands. Seven
// volleys, each faster than the last; the seventh repeats. After each volley
// it roars: a little damage, and a rock falls on the player's tile 7 ticks
// later and stays there, with loose ones all over the arena that do not. The first roar drops two more, on the east and west
// of the arena if its first special attack will be the lightning, on the north
// and south if the smoke. A player beside the pool is bitten now and then.
//
// A shadow spell stuns it, and starts no attack delay: it turns no more, and
// from the front only 10 gets through a hit made after it. A hit on its back (or 25% of its hitpoints dealt since the
// stun) wakes it with a special attack, lightning and smoke in turn, and its
// volleys start again further on. During a special it takes a third less
// damage. The lightning is a wedge of tiles that turns after the player; the
// smoke is sheltered from behind any rock.
//
// At a fifth of its hitpoints it is enraged: one roar, orbs at one speed for
// good, rocks on the player, and the abyssal pathfinder, which walks the arena
// clockwise. In its aura ranged hits cannot miss and do at least a fifth of
// their max, magic does double; outside it the orbs go through prayers.
//
// Awakened it has three times the hitpoints, drops five rocks where the other
// drops one, and from half its hitpoints
// a tornado follows the player, through the rocks and the pool.
//
// Sources, beside the usual: OBS 11/25 is four Outside recordings of 25
// November 2026 (an ordinary world, the awakened fight, four deaths: 47 stuns,
// each broken from behind; 23 lightnings, 24 smokes, 3 of them cut short by
// the enrage; 3 enrages; no kill, and no roar but the enrages', for every
// volley was cut short by a stun). What they show of the specials, the stun,
// the sounds and the messages is taken for both versions: the wiki's list of
// what awakened changes (The Leviathan/Strategies) has none of it, and the
// videos of ordinary kills agree on when a special starts, strikes and ends.
// What they show of damage and of the volleys is the awakened version's alone.
// OBS kills is 23 Outside recordings of post-quest kills of 25 November 2026
// (kill counts 2,766 to 2,789, one player, in ranged gear: 23 stuns, each
// broken from behind; 11 lightnings, 12 smokes; 23 enrages; 168 roars that
// are not a stun's; 9 bites, 8 of them in the one fight spent beside the pool).
// OBS 11/26 is three more of the same player's, of 26 November 2026: a
// post-quest kill with three stuns, roar rocks, thrown rocks and lightning on
// the player; two awakened fights of 15 and 16 stuns, the player dying enraged.
// OBS 11/26 kills is 22 more Outside recordings of 26 November 2026: 20
// post-quest kills of the same player's (kill counts 2,893 to 2,912), and two
// awakened fights of another's, a kill and a death enraged at 89 left.
// Plain OBS is rsprox recordings 1703 (an ordinary
// world's quest fight), 1751, 3285 and six more of Leagues V and Grid Master
// worlds (the 900-hitpoint Leviathan), as RSPSApp/tsps reads them
// (docs/leviathan-normal-evidence.md and docs/leviathan.md,
// server/plugins/bosses/data/leviathan.json). OBS (video) is RSPSApp's frame
// reading of videos of ordinary kills (the wiki's clips, a 2024 guide, a 2026
// kill): about a tick either way. What RSPSApp chose without a source, or
// calls provisional, is marked inferred here, as is what no source says.
// Ids are the cache's; their names are from its gameval tables, as RSPSApp
// exports them.
import { getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { monsterByNpcTypeIdAndVersion } from "../../data/monsters.js";
import { CollisionFlag, createCollisionMap } from "../../engine/collision.js";
import { setArenaConfig, getArenaDefaultWalkable } from "../../engine/arena.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { centre, heading, isSheltered, lightningSectors, ring, sectorCount, sectorOf, turnSector } from "./geometry.js";
import { leviathanLoadouts } from "./loadouts.js";
import { leviathanCombatAchievements } from "./combatAchievements.js";

export const leviathanKind = "leviathan";
export const leviathanAwakenedKind = "leviathan_awakened"; // dt2/bosses.js, awakenedKind
// CACHE: the Scar's arena, region 8291 (2048,6336). Its floor is a bridge:
// the tiles of level 1 over it (render flag 2) that are not blocked (flag 1),
// 320 of them, here as runs of x by y. The cache loader builds an arena from
// level 0, where rocks stand under the bridge, so this one is the
// encounter's own (collision "custom"). In the middle of the floor the pool,
// blocked, x 29 to 37 and y 32 to 40 but for its four corners (77 tiles, as
// RSPSApp counts them too); the Leviathan takes the 7 x 7 inside it.
export const leviathanMapSquare = { x: 32, y: 99 };
const floorRows = {
  26: [[28, 32]], 27: [[25, 34], [39, 41]], 28: [[24, 42]], 29: [[24, 42]], 30: [[24, 42]], 31: [[23, 42]],
  32: [[23, 29], [37, 42]], 33: [[23, 28], [38, 43]], 34: [[22, 28], [38, 44]], 35: [[22, 28], [38, 44]], 36: [[22, 28], [38, 44]],
  37: [[23, 28], [38, 44]], 38: [[23, 28], [38, 43]], 39: [[23, 28], [38, 43]], 40: [[23, 29], [37, 43]],
  41: [[23, 42]], 42: [[24, 42]], 43: [[24, 42]], 44: [[24, 42]], 45: [[24, 41]], 46: [[27, 29], [35, 40]], 47: [[36, 38]],
};
export const bossStart = [30, 33]; // OBS: 2078,6369
export const bossSize = 7; // CACHE, WIKI
// The tile the handholds (CACHE: 22,32) lead to. OBS 11/25: 4 of 4, 5 ticks before
// it surfaces; awakened, but both fights are climbed into there.
const climbedTo = [23, 32];
// Where a rock that lands on the player puts them, the first open one (pushAside).
const pushOrder = [[-1, -1], [-1, 0], [0, -1], [-1, 1], [1, -1], [0, 1], [1, 0], [1, 1]];
// Where the sandbox's player starts on the Scar (sandbox/arenas.js) without it as
// the host: RSPSApp's tile beside the handholds (inferred).
export const playerStart = [24, 34];
const pool = { minX: 29, maxX: 37, minY: 32, maxY: 40 }; // CACHE
// OBS: the pathfinder's corners, the middle of its 3 x 3, clockwise from the
// north-west: north-west, north-east and south-east recorded, south-west the
// rectangle's fourth (inferred).
const pathfinderCorners = [[27, 42], [39, 42], [39, 30], [27, 30]];
// OBS: the first roar's two extra rocks, one in each of a pair of 3 x 3s.
// WIKI: east and west for the lightning first, north and south for the smoke.
// Each a tile of its 3 x 3 at random (inferred: 306 first roars fill all of
// them, which does not say how they are drawn).
const tells = {
  lightning: [{ minX: 24, maxX: 26, minY: 35, maxY: 37 }, { minX: 40, maxX: 42, minY: 35, maxY: 37 }],
  smoke: [{ minX: 33, maxX: 35, minY: 28, maxY: 30 }, { minX: 32, maxX: 34, minY: 42, maxY: 44 }],
};

export const ids = {
  boss: 12214, // CACHE leviathan; OBS 11/25: the awakened one's too
  pathfinder: 12220, // CACHE leviathan_buff_npc, "Abyssal pathfinder"
  tornado: 12222, // CACHE leviathan_tornado; OBS 11/25
  rubble: 47590, // CACHE leviathan_rubble, the loc a fallen rock leaves
};
export const seqs = {
  idle: 10276, // CACHE npc_leviathan_01_idle_01
  spawn: 10291, // CACHE npc_leviathan_01_spawn; OBS (video): as it surfaces
  orbStart: 10278, // CACHE npc_leviathan_01_projectile_start_01; OBS: the first orb of a volley, and every orb of a slower one
  orbLoop: 10279, // CACHE npc_leviathan_01_projectile_loop_01; OBS: the others of a one-tick volley
  orbSingle: 10281, // CACHE npc_leviathan_01_projectile_single_01; OBS: a tick after an orbStart of a slower volley
  orbEnd: 10280, // CACHE npc_leviathan_01_projectile_end_01; OBS 11/25: as the enrage starts
  roar: 10282, // CACHE npc_leviathan_01_stun_01; OBS 11/25: as a stun is broken (47 of 47), and the enrage's roar (3 of 3)
  bite: 10283, // CACHE npc_leviathan_01_melee_01
  stunned: 10294, // CACHE npc_leviathan_01_stun_idle; OBS 11/25: from the tick after the stun until it is broken
  lightning: 10285, // CACHE npc_leviathan_01_360_start; OBS 11/25
  lightningLoop: 10286, // CACHE npc_leviathan_01_360_loop; OBS 11/25
  lightningEnd: 10287, // CACHE npc_leviathan_01_360_end; OBS 11/25: of the smoke too
  spit: 10288, // CACHE npc_leviathan_01_spit_start; OBS 11/25
  spitLoop: 10289, // CACHE npc_leviathan_01_spit_loop; OBS 11/25
  blast: 10290, // CACHE npc_leviathan_01_explosion_start; OBS 11/25
  death: 10293, // CACHE npc_leviathan_01_death; OBS
  pathfinderIdle: 10295, // CACHE npc_buff01_idle01
  pathfinderSpawn: 10296, // CACHE npc_buff01_spawn01; OBS
  tornado: 8100, // CACHE: its NPC's own
};
export const spots = {
  // CACHE vfx_leviathan_01_projectile_..., by style. OBS: the launch on the
  // boss, _02 with an orbStart and _01 with an orbLoop; the projectile; its
  // impact on the player (inferred: RSPSApp's).
  launchStart: { magic: 2486, range: 2484, melee: 2485 },
  launch: { magic: 2483, range: 2481, melee: 2482 },
  orb: { magic: 2489, range: 2487, melee: 2488 },
  impact: { magic: 2492, range: 2490, melee: 2491 },
  // CACHE spotanim_brain_01_falling_stay_01 to _04: a rock falling and
  // staying. OBS: on the tile of a roar's rock 50 cycles after the roar, its
  // number the rotation of the loc it leaves.
  falling: [2477, 2478, 2479, 2480],
  boulder: 2472, // CACHE projanim_brain_01: the smoke's thrown rocks (OBS 11/25)
  boulderLands: 2473, // CACHE projanim_brain_01_impact_01; OBS 11/25: where one lands and stays
  crumble: 2474, // OBS 11/26 kills: on each fallen rock as it goes after the kill (290 of 290)
  blastCharge: 2494, // CACHE spotanim_leviathan_explode; OBS 11/25: on it as the smoke gathers
  blast: 2505, // CACHE spotanim_leviathan_explode_02; OBS 11/25: on it as the smoke blows
  // OBS 11/25: the smoke's wave, one to a tile, by the way out from its middle:
  // east, then clockwise.
  wave: [2495, 2496, 2497, 2498, 2499, 2500, 2501, 2502],
  lightning: 2493, // OBS 11/25: on it with each strike
  lightningGround: 2503, // CACHE vfx_leviathan_360_ground; OBS 11/25: on each tile of a strike
  sideOrb: 2506, // CACHE dt2_leviathan_bomb01: the cyan orbs of the lightning (OBS 11/25)
  sideOrbShadow: 1446, // OBS 11/25: on the tile one is falling to
  sideOrbLands: 2504, // CACHE vfx_leviathan_360_lightning; OBS 11/25: where one lands
  stunned: 2379, // OBS 11/25: on it as it is stunned
  debris: [2475, 2476], // OBS 11/25: a rock that falls and does not stay
  pathfinderMark: 2298, // OBS 11/25: where the pathfinder will come
  tornadoHit: 2507, // CACHE leviathan_tornado_spotanim; OBS 11/25: on a player it hits
};

export const bossActorId = "leviathan";
const pathfinderActorId = "abyssal-pathfinder";
const tornadoActorId = "leviathan-tornado";
// The five tails in the water round the arena, which the scene draws
// (presentation.js): they are part of no rule. OBS 11/25 (4 of 4), OBS: each
// one's NPC, its south-west tile and the way it faces; each reacts as a stun is
// broken (47 of 47), and to a bite (OBS).
export const tails = [
  { npcTypeId: 12216, position: [5, 19], facing: 1248 },
  { npcTypeId: 12217, position: [31, 10], facing: 1009 },
  { npcTypeId: 12216, position: [27, 57], facing: 32 },
  { npcTypeId: 12216, position: [47, 21], facing: 736 },
  { npcTypeId: 12218, position: [48, 53], facing: 238 },
].map((tail, n) => ({ id: "leviathan-tail-" + n, ...tail }));
// By NPC: CACHE npc_leviathan_tail01_...; OBS 11/25 the stance and the reaction, OBS the bite's.
export const tailSeqs = {
  12216: { idle: 10298, bite: 10301, weakSpot: 10304 },
  12217: { idle: 10299, bite: 10302, weakSpot: 10305 },
  12218: { idle: 10300, bite: 10303, weakSpot: 10306 },
};

// The volleys, from the WIKI's seven: the ticks between orbs and the styles.
// OBS: the orbs of each (1751's first three; the fourth to the seventh from a
// 2026 kill, OBS (video)), and the ticks an orb flies (5, 5, 4, 3 and 3
// recorded; the WIKI's "2 ticks to react" and "1 tick to react" for the last
// two). The seventh repeats.
const volleys = [
  { interval: 3, orbs: 6, styles: ["magic", "range"], flight: 5 },
  { interval: 2, orbs: 8, styles: ["magic", "range"], flight: 5 },
  { interval: 2, orbs: 8, styles: ["magic", "range", "melee"], flight: 4 },
  { interval: 1, orbs: 12, styles: ["magic", "range"], flight: 3 },
  { interval: 1, orbs: 10, styles: ["magic", "range", "melee"], flight: 3 },
  { interval: 1, orbs: 10, styles: ["magic", "range", "melee"], flight: 2 },
  { interval: 1, orbs: 10, styles: ["magic", "range", "melee"], flight: 1 },
];
// OBS: the roar comes a volley's interval after its last orb, and the next
// volley's first orb 5 ticks after the roar (the first three), 6 after it
// (the one-tick volleys: 7 from last orb to first, OBS (video)).
// OBS kills: after a one-tick volley the roar's rocks and chip come on time,
// with its end (orbEnd) and the roar itself a tick later (46 of 46).
const pauseAfterRoar = (volley) => (volley.interval > 1 ? 5 : 6);
const firstAttackTicks = 4; // OBS: the first orb 4 ticks after it surfaces
const pathfinderTicks = 3; // OBS, OBS 11/25 (3 of 3): it appears 3 ticks after the enrage's rocks fall,
const pathfinderWalkTicks = 3; // OBS, OBS 11/25: and takes its first step 3 ticks after that, then one a tick.
// WIKI: a 5 x 5, 7 x 7 awakened. OBS 11/25: awakened too, orbs met with the
// right prayer went through it 3 tiles from its middle (2 of 2) and never
// closer (24 of 24).
const auraRadius = 2;
const rockTicks = 7; // OBS: a roar's rock lands 7 ticks after it (1,151 of 1,151)
const fallingDelayCycles = 50; // OBS
const chipTicks = 1; // OBS kills: the roar's chip a tick after its rocks (168 of 168)
const stunCap = 10; // WIKI: what gets through a hit from the front while it is stunned
const stunBreakShare = 0.25; // WIKI: "25% of The Leviathan's health in damage"; counted from the stun (inferred)
const rearRangedMinimum = 0.65; // WIKI: "at least a minimum of ~65% of your maximum hit"
const auraRangedMinimum = 0.2; // WIKI
const specialReduction = 0.33; // WIKI: "reduced by 33%"; rounded down (inferred)
// WIKI: a bite only for a player beside the pool, diagonals included, and
// "rarely used". OBS (video): one bite early in the fight, then none until
// after the third roar. OBS kills, turns with the player beside the pool: in
// the first volley a bite on the sixth (1 of 7); in the second and third
// none, after a stun too (0 of 40); in the one-tick volleys 6 of 34; enraged
// 2 of 108. A bite takes a turn of its own, not one of the volley's orbs, and
// the next attack is 4 ticks after it (9 of 9). The early bite comes once at
// most (OBS (video)), on a turn at the same odds (inferred).
const biteChance = 1 / 6;
const enragedBiteChance = 1 / 50;
const biteRest = 4;
// The lightning, from the hit that set it off. OBS 11/25 (23 of 23): a roar, its
// start 3 ticks in, its loop at 7, a strike a tick from 7 to 41, its end at 42,
// still at 44, and the first orb at 48 (12 of 12 not stunned before it). OBS
// (video) agrees within a tick on the first and the last strike and the end.
// A strike is on the sector the player was in 2 ticks before, as far as it can
// turn (turnSector; 782 of 782); WIKI, update of 7 February 2024: a tick sooner
// for a player on 25 hitpoints or less. The first is on the sector next to the
// one the player is in as its start begins, counter-clockwise (23 of 23). It
// hits a player on a tile of it as the tick begins (9 of 9, and no one else).
const lightning = { start: 3, loop: 7, first: 7, strikes: 35, end: 42, over: 44, rest: 4, lowHp: 25 };
// OBS 11/25: a strike on every fourth sector (192 of 193) also throws orbs at one
// of two sets of tiles, even odds (91 and 101). Each tile of it has the same
// chance (1,164 orbs of 2,728), and each flies 4, 5 or 6 ticks (387, 397, 380).
const sideOrbSets = [
  [[27, 32], [27, 34], [27, 37], [30, 30], [30, 42], [32, 42], [33, 30], [35, 42], [37, 30], [39, 38]],
  [[27, 33], [27, 35], [27, 39], [27, 41], [28, 30], [29, 42], [31, 29], [31, 42], [33, 42], [33, 43], [34, 30], [36, 29], [36, 42], [38, 42], [39, 33], [39, 35], [39, 39], [39, 41]],
];
const sideOrbEvery = 4;
const sideOrbChance = 0.43;
const sideOrbFlights = [{ ticks: 4, from: 20, shadow: 30 }, { ticks: 5, from: 40, shadow: 60 }, { ticks: 6, from: 60, shadow: 90 }]; // OBS 11/25; from and shadow in cycles
// The smoke, from the hit that set it off. OBS 11/25 (21 of 21): a roar, the spit
// 3 ticks in, ten rocks at the player one a tick from 4 to 13, each 2 ticks in
// the air, its charge at 13, the blast at 16, still at 18, and the first orb at
// 24 (3 of 3 not stunned before it). OBS (video) agrees within a tick. Any rock
// shelters, an older one too (4 of 4 behind one of an earlier smoke alone were
// unhurt, 3 of 3 behind none were hit). WIKI: rocks still in the air at the
// enrage land, and the blast still comes; OBS 11/25: not if the enrage comes of
// the very hit that set the smoke off (3 of 3).
const smoke = { spit: 3, firstRock: 4, rocks: 10, rockFlight: 2, charge: 13, blast: 16, over: 18, rest: 6 };
// OBS 11/25: the wave is drawn on the floor and the pool's rim between these
// distances from its middle, 3 cycles later for each tile further out.
const wave = { inner: 4, reach: 9, cycles: 3, first: -6 };
const deathTicks = 6; // OBS: from the kill to its removal (24 deaths); OBS 11/26 kills: 21 of 21, the awakened kill too

// Projectiles. OBS, OBS 11/25: from 30 cycles to the impact tick, from height 550
// to 100, slope 30, 124 out from the mouth. OBS kills: an orb of one tick from 30
// cycles to 50, and it lands the next tick (1 of 1). The mouth is 2 tiles out from its middle towards the
// player, on each side of its 7 x 7 the player is beyond (OBS, OBS 11/25).
const orbProjectile = { startHeight: 550, endHeight: 100, slope: 30, startOffset: 124 };
const oneTickOrbCycles = 50;
const boulderProjectile = { startHeight: 600, endHeight: 100, slope: 40, startOffset: 80 }; // OBS 11/25: from its mouth, at once
const sideOrbProjectile = { startHeight: 800, endHeight: 0, slope: 3, startOffset: 200 }; // OBS 11/25: from its middle
const impactHeight = 100; // OBS 11/25
const cyclesPerTick = 30;

// What differs between the two versions. Damage: WIKI, its infobox, but for
// what it has none of. A hit is [least, most].
export const versions = {
  postQuest: {
    tableVersion: "Post-quest", // TABLE: the "Post-quest" entry of 12214, 900 hitpoints
    maxHp: 900,
    enrageHp: 180, // WIKI: "Upon reaching 180 hitpoints (20% of its health)"
    orbMaxHit: { magic: 32, range: 24, melee: 50 },
    // OBS kills: 7 bites that landed, none met by Protect from Melee: 34, 35, 40,
    // 45, 48, 50, 50; WIKI: 50 at most. Not rolled for accuracy (inferred: none missed).
    biteHit: [34, 50],
    earlyBites: 1, // OBS (video), above
    roarHit: [4, 7], // OBS kills: 168 chips, 4 to 7, none 0; WIKI: "up to 7 chip damage"
    firstVolley: 0,
    rockHit: [19, 25], // OBS 11/26: a roar's 20 and 21, thrown 22 and 23; as awakened (OBS 11/25); WIKI: 25 at most
    lightningHit: [18, 22], // OBS kills: 18, 19, 20 and 22
    // OBS kills: none of the lightning's orbs, the smoke's rocks or its blast hit the player.
    // inferred: the side orbs as the rocks (RSPSApp's).
    sideOrbHit: [0, 25],
    // WIKI: 60 in its infobox; its Strategies says up to 59, which fits under it.
    smokeHit: [0, 60],
    // OBS 11/26: three stuns let run out: held still to 13, 13 and 14 ticks after
    // the message, the next orb at 14, 14 and 15, the volley going on where it
    // stopped, no special. WIKI: 15.
    stunTicks: 14,
    // WIKI: the stun resets it to the second volley, and each later one a volley
    // further down. OBS kills: the second after the first stun (23 of 23). OBS
    // 11/26: the second, the third, then the third again.
    volleyAfterStun: (stuns) => Math.min(2, Math.max(1, stuns)),
    // Enraged (WIKI): every 2 ticks, magic and ranged only. OBS, OBS kills: the
    // first orb 5 ticks after the enrage's rocks (21 of 23), flying 5 ticks, every
    // 2 (318 of 318); one rock on the player 8 ticks after those, then every 10
    // (22 of 23; 95 waves).
    enraged: { interval: 2, styles: ["magic", "range"], flight: 5 },
    enrageDelay: 0,
    enrageFirstAttackTicks: 5,
    enrageRockTicks: (wave) => (wave === 0 ? 8 : 10),
    pathfinderClear: 0, // OBS: a rock on the middle of a corner keeps the pathfinder from it, one beside it does not
    rockSpread: [[0, 0]],
    // OBS kills: loose rocks with every roar's and every enraged wave's rocks, 9 to
    // 35, 20 on average (5,040 in 252), of 320 tiles.
    debrisChance: 1 / 16,
    tornadoHp: 0,
  },
  awakened: {
    tableVersion: "Awakened", // TABLE: the "Awakened" entry of 12214; OBS 11/25: 2,700 on its health bar (4 of 4)
    maxHp: 2700,
    enrageHp: 540, // WIKI; OBS 11/25: enraged at 491, 491 and 499, not yet at 557, 565 and 567
    // WIKI. OBS 11/25: unprotected magic 14 to 54 (8 hits), ranged 9 and 11, melee none.
    orbMaxHit: { magic: 55, range: 41, melee: 86 },
    // WIKI: 86 at most; OBS 11/26: 84 (1). The least inferred: the post-quest bite's share of its most.
    biteHit: [58, 86],
    // OBS 11/26: 6 orbs 2 ticks apart flying 5 before the first stun, as the
    // post-quest second volley (2 fights; the four of 11/25 were stunned sooner).
    firstVolley: 1,
    earlyBites: 0, // OBS 11/25: no bite in 26 turns with the player beside the pool, before any roar
    roarHit: [4, 7], // OBS 11/25: 7, 7 and 4; the least as post-quest (OBS kills)
    rockHit: [19, 25], // OBS 11/25: 19, 19, 20 and 25; WIKI: 25 at most
    lightningHit: [19, 22], // OBS 11/25: 9 strikes, 19 to 22
    sideOrbHit: [19, 25], // inferred: as the rocks; none of 1,164 landed on the player
    smokeHit: [70, 75], // OBS 11/25: 70, 70 and 73; WIKI: 75 in its infobox, "70+"
    // OBS 11/25: still stunned 12 ticks in (2 of 47; 11 ticks in, 12 of 47), its
    // end not seen; as post-quest (inferred). WIKI: half of 15, which is not so.
    stunTicks: 14,
    volleyAfterStun: () => 2, // OBS 11/25: the third, from the first stun to the thirteenth (32 orbs: 2 ticks apart, flying 4, melee among them)
    // OBS 11/25: an orb a tick flying 3, magic and ranged (28 and 17); the first 6
    // ticks after the roar's rocks fall (3 of 3); rocks again 8 ticks after those
    // (3 of 3), then 10 (2 of 2).
    enraged: { interval: 1, styles: ["magic", "range"], flight: 3 },
    enrageDelay: 1, // OBS 11/25: its rocks fall the tick after the hit that enrages it (3 of 3)
    enrageFirstAttackTicks: 6,
    enrageRockTicks: (wave) => (wave === 0 ? 8 : 10),
    pathfinderClear: 2, // OBS 11/25: past a corner with rocks 2 tiles from its middle, to one with none nearer than 3 (3 of 3)
    rockSpread: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], // WIKI, OBS 11/25: a plus, but for its tiles that are not open (7 of 8; the eighth left out one a loose rock landed on that tick)
    // OBS 11/25: 14 to 27 loose rocks a wave (8 waves of the enrage, 149), of 320
    // tiles. At its other roars too (WIKI: "cause debris to fall around the arena").
    debrisChance: 1 / 17,
    tornadoHp: 1350, // WIKI; OBS 11/25: it comes at 1,345, 1,317 and 1,284, not yet at 1,359
    tornadoHit: [40, 48], // OBS 11/25: 9 hits, 42 to 48; OBS 11/26 kills: 40, 41, 43 and 44; WIKI: "40+"
  },
};
// OBS 11/25: loose rocks land 6, 7 or 8 ticks after they are sent, drawn 20, 50 or
// 80 cycles later.
const debrisFalls = [{ ticks: 6, delay: 20 }, { ticks: 7, delay: 50 }, { ticks: 8, delay: 80 }];
// The tornado. OBS 11/25: a step a tick towards where the player was (heading;
// 796 of 796), through rocks and pool; on the player's tile it hits, and stays 7
// ticks (8 of 8 that went on). It comes on the tick of the hit that takes the
// Leviathan to its hitpoints, 2, 2 and 7 tiles from the player: which tile three
// do not settle, here an open one so near, at random (inferred).
const tornadoHold = 7;
const tornadoNear = 7;

// OBS 11/25 (47, 47, 23, 24 and 3 times). The colours are inferred: the game's are
// the player's own for its highlights (green, purple, magenta).
const messages = {
  stunned: { text: "Your spell stuns the Leviathan!", color: "#2f9e3f" },
  weakSpot: { text: "You hit the Leviathan right in its weak spot!", color: "#2f9e3f" },
  lightning: { text: "The Leviathan charges up a lightning attack...", color: "#b58cd9" },
  smoke: { text: "The Leviathan begins to spit out debris...", color: "#b58cd9" },
  enraged: { text: "The Leviathan focuses on you intensely...", color: "#e05ad0" },
  melee: { text: "Your melee attacks can't reach the lure!" }, // WIKI; that it comes with each attack is inferred
};

const key = ([x, y]) => x + "," + y;
const chebyshev = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const inPool = ([x, y]) =>
  x >= pool.minX && x <= pool.maxX && y >= pool.minY && y <= pool.maxY && !((x === pool.minX || x === pool.maxX) && (y === pool.minY || y === pool.maxY));
// The 40 tiles beside the pool, diagonals included (WIKI; RSPSApp counts the
// same 40).
const besidePool = new Set();
for (let x = pool.minX - 1; x <= pool.maxX + 1; x++)
  for (let y = pool.minY - 1; y <= pool.maxY + 1; y++)
    if (!inPool([x, y]) && [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => inPool([x + dx, y + dy])))) besidePool.add(key([x, y]));
export const isBesidePool = (tile) => besidePool.has(key(tile));
const tileTarget = (position) => ({ kind: "tile", position: [...position] });

// The mouth its projectiles leave from (OBS, above).
function mouthFor([px, py]) {
  const [cx, cy] = centre;
  return [cx + (Math.abs(px - cx) > 3 ? Math.sign(px - cx) * 2 : 0), cy + (Math.abs(py - cy) > 3 ? Math.sign(py - cy) * 2 : 0)];
}
// Its back while it is stunned: the half of the arena away from where the player
// stood as it was. OBS 11/25: 47 hits from 0 to 84 degrees off straight behind
// it, every one on its weak spot; how far it goes past that none shows.
function isBehind(face, [px, py]) {
  return (px - centre[0]) * face[0] + (py - centre[1]) * face[1] < 0;
}
// The tiles the smoke's wave is drawn on, but for those that are sheltered.
const inWave = ([x, y]) => {
  const dx = x - centre[0], dy = y - centre[1];
  return ring([x, y]) <= wave.reach && dx * dx + dy * dy >= wave.inner * wave.inner;
};
const waveDirections = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]].map(String);
const prayerAgainst = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };

// The bridge's open tiles (floorRows), with a collision map of its own: the
// fight's arena, and the sandbox's on the Scar (sandbox/arenas.js).
export function leviathanFloorArena() {
  const walkableTiles = new Set();
  for (const [y, runs] of Object.entries(floorRows)) for (const [from, to] of runs) for (let x = from; x <= to; x++) walkableTiles.add(key([x, Number(y)]));
  const tiles = [...walkableTiles].map((tile) => tile.split(",").map(Number));
  const [minX, maxX] = [Math.min(...tiles.map(([x]) => x)), Math.max(...tiles.map(([x]) => x))];
  const [minY, maxY] = [Math.min(...tiles.map(([, y]) => y)), Math.max(...tiles.map(([, y]) => y))];
  const bounds = { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return { bounds, walkableTiles, collisionMap: createCollisionMap(64, 64) };
}

// A fallen rock blocks the way and the line of sight (WIKI) as an object does.
const rubbleFlags = CollisionFlag.OBJECT | CollisionFlag.OBJECT_PROJECTILE_BLOCKER;
// The arena's collision with the rubble on it, the base's left as it is.
function collisionWithRubble(map, rubble) {
  const getFlag = (x, y) => (rubble.has(key([x, y])) && map.getFlag(x, y) !== -1 ? map.getFlag(x, y) | rubbleFlags : map.getFlag(x, y));
  return {
    sizeX: map.sizeX,
    sizeY: map.sizeY,
    getFlag,
    hasFlag: (x, y, mask) => {
      const flag = getFlag(x, y);
      return flag !== -1 && (flag & mask) !== 0;
    },
  };
}

// The monster table has two entries for 12214, the awakened first; each
// version names its own, and this checks that it got it.
function tableFormulaStats(version) {
  const entry = monsterByNpcTypeIdAndVersion.get(ids.boss + ":" + version.tableVersion);
  if (entry?.levels.hitpoints !== version.maxHp) throw new Error(`The Leviathan: the monster table's ${ids.boss} has no entry with ${version.maxHp} hitpoints`);
  return structuredClone(getMonsterFormulaStats(ids.boss, version.tableVersion));
}

const shadowSpells = new Set(["Shadow Rush", "Shadow Burst", "Shadow Blitz", "Shadow Barrage"]);

class LeviathanEncounter {
  constructor(kind = leviathanKind, version = versions.postQuest) {
    this.kind = kind;
    Object.defineProperty(this, "version", { value: version }); // fixed for the fight: not state
    // Not state: the arena as the engine handed it, its open tiles, the world,
    // for the hooks that are handed none, and its undrained levels.
    for (const name of ["arenaBase", "floor", "world", "levels"]) Object.defineProperty(this, name, { value: null, writable: true });
    this.floor = [];
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.tick = 0;
    this.surfaced = false;
    // The volleys: which, how many orbs of it so far; the bites so far.
    this.volley = this.version.firstVolley;
    this.orbs = 0;
    this.bites = 0;
    this.stuns = 0;
    this.nextAttackTick = firstAttackTicks;
    // A count that moves on with every roar, stun, special and the enrage:
    // what was queued before one of them checks it before it goes off.
    this.epoch = 0;
    this.stun = null; // { until, face, dealt }
    this.special = null; // { kind, start, id }; the lightning's sector and where the player was too
    this.specialDue = false;
    this.nextSpecial = this.random() < 0.5 ? "lightning" : "smoke"; // inferred: either, evenly
    this.firstRoar = true;
    this.enraged = false;
    this.nextEnrageRockTick = null;
    this.rockWaves = 0; // the enraged waves of rocks so far
    this.pathfinder = null; // { spawnTick, destination }
    this.queue = []; // { tick, run(context, hits) }, in the order queued
    this.pendingVisuals = [];
    this.rubble = new Map(); // tile key -> [x, y, rotation]
    this.cover = new Set(); // the tiles sheltered from this smoke's blast
    this.warnings = []; // { tile, from, until }: the tiles of this tick's lightning, for the scene
    this.inFlight = []; // { style, lands }: the orbs on their way, for the scene
    this.falling = []; // { tile, lands }: the rocks on their way down
    this.pushed = null; // { tick, to }: where the last rock on the player put them
    // The awakened fight's own state; the post-quest one has none of it.
    if (this.version === versions.awakened) this.awakened = { enrageTick: null, tornado: null };
    if (this.arenaBase) setArenaConfig(this.arenaWithRubble(), getArenaDefaultWalkable());
  }
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return {};
  }
  getDefaultPlayerStart() {
    return [...climbedTo];
  }
  getIntroConfig() {
    return null;
  }
  getArenaConfig() {
    return leviathanFloorArena();
  }
  refineArenaConfig(arena) {
    this.arenaBase = arena;
    // The arena's open tiles, in a fixed order, for the side orbs to fall on.
    this.floor = arena.walkableTiles ? [...arena.walkableTiles].map((tile) => tile.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]) : [];
    return this.arenaWithRubble();
  }
  arenaWithRubble() {
    const base = this.arenaBase;
    if (!base || this.rubble.size === 0) return base;
    const walkableTiles = base.walkableTiles ? new Set(base.walkableTiles) : null;
    for (const tile of this.rubble.keys()) walkableTiles?.delete(tile);
    return { bounds: base.bounds, walkableTiles, collisionMap: collisionWithRubble(base.collisionMap, this.rubble) };
  }
  createNpcs() {
    const formulaStats = tableFormulaStats(this.version);
    const { maxHp } = this.version;
    this.levels = { ...formulaStats.levels };
    return [{
      id: bossActorId, kind: "npc", role: "boss", npcTypeId: ids.boss, archetypeId: "leviathan", size: bossSize, alive: true,
      position: [...bossStart], previousPosition: [...bossStart], facing: 0, history: new Map(),
      vitals: { hp: maxHp, maxHp }, formulaStats,
      combat: { attackSpeed: volleys[0].interval, attackRange: 30, attackStyle: "magic", nextActionTick: firstAttackTicks, targetId: "player", lastAttackTick: null,
        animations: { idle: seqs.idle, walk: seqs.idle, run: seqs.idle, attack: seqs.orbStart, death: seqs.death } },
    }];
  }
  moveNpc(npc, context) {
    if (npc.id === tornadoActorId) return this.moveTornado(npc, context);
    if (npc.id !== pathfinderActorId || !this.pathfinder || context.tick < this.pathfinder.walkTick) return [];
    const step = this.pathfinderStep(npc);
    this.pathfinder.destination = step.destination;
    return [{ npcId: npc.id, path: [[step.middle[0] - 1, step.middle[1] - 1]] }];
  }
  // OBS: one step a tick, straight along the side, through the rubble.
  pathfinderStep(npc) {
    const at = [npc.position[0] + 1, npc.position[1] + 1];
    let { destination } = this.pathfinder;
    if (key(at) === key(pathfinderCorners[destination])) destination = (destination + 1) % pathfinderCorners.length;
    const to = pathfinderCorners[destination];
    return { destination, middle: [at[0] + Math.sign(to[0] - at[0]), at[1] + Math.sign(to[1] - at[1])] };
  }

  // --- each tick, before the NPCs ---------------------------------------
  resolveHazards(context) {
    this.tick = context.tick;
    this.world = context.world;
    const hits = [];
    const due = this.queue.filter((entry) => entry.tick <= context.tick);
    this.queue = this.queue.filter((entry) => entry.tick > context.tick);
    for (const entry of due) entry.run(context, hits);
    this.warnings = this.warnings.filter((warning) => warning.until > context.tick);
    this.inFlight = this.inFlight.filter((orb) => orb.lands > context.tick);
    this.falling = this.falling.filter((rock) => rock.lands > context.tick);
    this.flushVisuals(context);
    return hits;
  }
  // --- each tick, after the player -------------------------------------
  processPostTick(context) {
    this.flushVisuals(context);
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    return [];
  }
  processNpcTick(npc, context) {
    const idle = { environmentalDamages: [] };
    if (npc.id === tornadoActorId) return this.tornadoTurn(npc, context);
    if (npc.id !== bossActorId) return idle;
    this.flushVisuals(context);
    const tick = context.tick;
    if (!this.surfaced) {
      this.surfaced = true;
      this.animate(context, "spawn");
    }
    if (this.awakened) {
      npc.formulaStats.levels = { ...this.levels }; // WIKI: awakened it is immune to stat drains
      if (!this.awakened.tornado && npc.vitals.hp <= this.version.tornadoHp) this.spawnTornado(context);
    }
    if (!this.enraged && npc.vitals.hp <= this.version.enrageHp && this.isEnrageDue(tick)) this.enrage(npc, context);
    if (this.enraged && tick >= this.nextEnrageRockTick) {
      this.dropRocks(context, context.playerPos);
      this.dropDebris(context);
      this.nextEnrageRockTick = tick + this.enrageRockGap();
    }
    if (this.specialDue) {
      this.specialDue = false;
      this.beginSpecial(npc, context);
    }
    if (this.stun) {
      if (tick < this.stun.until) return idle;
      // Run out: the volley goes on where it stopped, its next orb at once (OBS 11/26).
      this.endStun(npc);
      this.nextAttackTick = tick;
    }
    const player = context.world.getPlayer();
    if (this.special || tick < this.nextAttackTick || !player?.alive) return idle;
    npc.combat.lastAttackTick = tick;
    const turn = this.bitesNow(player) ? this.bite(npc, player, context) : this.fireOrb(npc, player, context);
    npc.combat.nextActionTick = this.nextAttackTick; // for the interface's attack timer
    return turn;
  }

  // --- its attacks -----------------------------------------------------
  currentVolley() {
    return this.enraged ? this.version.enraged : volleys[this.volley];
  }
  // Whether this turn is a bite (biteChance, above): never for a player away
  // from the pool; in the first volley as long as its version has an early bite
  // to come; in the others only the one-tick ones; enraged now and then.
  bitesNow(player) {
    if (!isBesidePool(player.position)) return false;
    if (this.enraged) return this.random() < enragedBiteChance;
    if (this.volley === 0 ? this.bites >= this.version.earlyBites : volleys[this.volley].interval > 1) return false;
    return this.random() < biteChance;
  }
  fireOrb(boss, player, context) {
    const tick = context.tick;
    const volley = this.currentVolley();
    const style = volley.styles[Math.floor(this.random() * volley.styles.length)]; // inferred: evenly
    // OBS: the startup sequence and its launch for the first orb of a volley
    // and every orb of a slower one, and the single a tick later.
    const startup = volley.interval > 1 || this.orbs === 0;
    const attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      // Accuracy is rolled (inferred: its attack bonuses in the monster table
      // are for that; a melee orb as a crush, inferred). The prayer is the one
      // up as the orb lands (WIKI).
      plan: { formulaStyle: style === "melee" ? "melee_crush" : style === "range" ? "ranged" : "magic", damageType: style, attackKind: style,
        maxHit: this.version.orbMaxHit[style], impactDelayTicks: volley.flight, sourceDeathPolicy: "cancel-before-impact" },
    });
    const damage = attack?.accuracySucceeded ? attack.rolledDamage : 0;
    const mouth = mouthFor(player.position);
    const flightCycles = volley.flight > 1 ? volley.flight * cyclesPerTick : oneTickOrbCycles;
    emitInfernoNpcAttack(context, {
      actor: boss, target: player, clipId: startup ? "orbStart" : "orbLoop", kind: "leviathan_" + style, impactDelayTicks: volley.flight,
      projectiles: [{ spotAnimId: spots.orb[style], sourcePosition: [mouth[0] + 0.5, mouth[1] + 0.5], target: buildActorVisualTarget(player),
        startDelayCycles: cyclesPerTick, endDelayCycles: flightCycles, ...orbProjectile }],
    });
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: [{ spotAnimId: (startup ? spots.launchStart : spots.launch)[style], target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }] });
    const epoch = this.epoch;
    this.inFlight.push({ style, lands: tick + volley.flight });
    if (volley.interval > 1) this.later(1, (ctx) => {
      if (this.epoch === epoch && !this.stun && !this.special) this.animate(ctx, "orbSingle");
    });
    this.later(volley.flight, (ctx, hits) => {
      const target = ctx.world.getPlayer();
      if (!target?.alive) return;
      // WIKI: enraged, its attacks go through the prayer of a player out of the
      // pathfinder's aura (not before the pathfinder is there: the update of 16
      // August 2023). OBS 11/25: as the pathfinder stands after this tick's step,
      // the player before theirs.
      const middle = this.enraged ? this.pathfinderMiddleNext(ctx) : null;
      const pierces = middle !== null && chebyshev(middle, ctx.playerPos) > auraRadius;
      // OBS 11/25: its impact is drawn on a player it hurts alone (12 of 12; none of
      // 57 that a prayer met). One whose roll misses too (inferred: none did).
      if (pierces || target.activePrayer !== prayerAgainst[style])
        emitInfernoVisual(ctx.tickEvents, { animations: [], projectiles: [],
          graphics: [{ spotAnimId: spots.impact[style], target: buildActorVisualTarget(target), height: impactHeight, delayCycles: 0 }] });
      hits.push({ source: "The Leviathan's orb", attackType: style, baseDamage: damage, playerPosition: [...ctx.playerPos], ...(pierces ? { prayerReduction: { type: "bypass" } } : {}) });
    });
    this.nextAttackTick = tick + volley.interval;
    if (this.enraged) {
      if (volley.interval === 1) this.orbs++; // its startup is the first orb's alone
    } else if (++this.orbs >= volley.orbs) {
      this.orbs = 0;
      this.nextAttackTick += pauseAfterRoar(volley);
      this.later(volley.interval, (ctx) => {
        if (this.epoch !== epoch || this.enraged || this.stun || this.special) return;
        this.roar(ctx, volley.interval === 1);
        this.volley = Math.min(volleys.length - 1, this.volley + 1);
      });
    }
    return { environmentalDamages: [] };
  }
  // The bite, for a player beside the pool (WIKI: Protect from Melee blocks it).
  // OBS kills: it lands a tick after it starts (7 of 7), and the volley goes on
  // 4 ticks after it (biteRest).
  bite(boss, player, context) {
    if (!this.enraged) this.bites++;
    this.nextAttackTick = context.tick + biteRest;
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "bite", kind: "leviathan_bite", impactDelayTicks: 1 });
    this.animateTails(context, "bite"); // OBS
    this.later(1, (ctx, hits) => {
      if (!ctx.world.getPlayer()?.alive) return;
      hits.push({ source: "The Leviathan's bite", attackType: "melee", baseDamage: [...this.version.biteHit], playerPosition: [...ctx.playerPos] });
    });
    return { environmentalDamages: [] };
  }
  // A roar: its chip a tick later, the rocks on the player, and the first time
  // the two rocks that tell its first special. `late`: after a one-tick volley,
  // its end now and the roar itself a tick later (pauseAfterRoar, above).
  roar(context, late = false) {
    this.epoch++;
    if (late) {
      this.animate(context, "orbEnd");
      const epoch = this.epoch;
      this.later(1, (ctx) => this.epoch === epoch && this.animate(ctx, "roar"));
    } else this.animate(context, "roar");
    this.chip();
    this.roarRocks(context);
  }
  chip() {
    this.later(chipTicks, (ctx, hits) => {
      if (ctx.world.getPlayer()?.alive) hits.push({ source: "The Leviathan's roar", attackType: "typeless", baseDamage: [...this.version.roarHit], playerPosition: [...ctx.playerPos] });
    });
  }
  // `roarRocks` on the event: with the sound recorded for a roar's rocks (audio.js).
  roarRocks(context) {
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [], roarRocks: true });
    this.dropRocks(context, context.playerPos);
    if (this.firstRoar) {
      this.firstRoar = false;
      for (const area of tells[this.nextSpecial]) {
        const x = area.minX + Math.floor(this.random() * (area.maxX - area.minX + 1));
        const y = area.minY + Math.floor(this.random() * (area.maxY - area.minY + 1));
        this.dropRock(context, [x, y]);
      }
    }
    this.dropDebris(context);
  }
  // The rocks that stay: one on the player, or a plus of them, its arms but where
  // there is no open floor.
  dropRocks(context, at) {
    for (const [dx, dy] of this.version.rockSpread) {
      const tile = [at[0] + dx, at[1] + dy];
      if ((dx === 0 && dy === 0) || this.isOpen(tile)) this.dropRock(context, tile);
    }
  }
  // The rocks that do not: here and there on the open floor.
  dropDebris(context) {
    if (this.version.debrisChance === 0) return;
    for (const tile of this.floor) {
      if (this.random() >= this.version.debrisChance || this.rubble.has(key(tile))) continue;
      const fall = debrisFalls[Math.floor(this.random() * debrisFalls.length)];
      const spotAnimId = spots.debris[Math.floor(this.random() * spots.debris.length)];
      emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId, target: tileTarget(tile), height: 0, delayCycles: fall.delay }] });
      this.falling.push({ tile: [...tile], lands: this.tick + fall.ticks });
      this.later(fall.ticks, (ctx, hits) => this.rockHits(ctx, hits, tile, "A falling rock", true, false));
    }
  }
  isOpen(tile) {
    return (this.arenaBase?.walkableTiles?.has(key(tile)) ?? true) && !this.rubble.has(key(tile));
  }
  // A rock lands: it hurts a player still on its tile. `heard`: with the sound
  // recorded for it (audio.js).
  // `push`: a rock that stays puts the player off its tile (pushAside).
  rockHits(context, hits, tile, source, heard, push) {
    if (!context.world.getPlayer()?.alive || key(context.playerPos) !== key(tile)) return;
    hits.push({ source, attackType: "typeless", baseDamage: [...this.version.rockHit], playerPosition: [...context.playerPos] });
    if (heard) emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [], rockHit: true });
    if (push) this.pushAside(context, tile);
  }
  // OBS 11/25, OBS 11/26: a rock that lands on the player puts them one tile
  // south-west (5 of 5 where it was open); where it was not, nor west nor south,
  // north-west (2 of 2). The rest of the order is inferred. They are put there
  // as they would step (moveDisplacedPlayer), and stand the tick after (7 of 7).
  pushAside(context, [x, y]) {
    const to = pushOrder.map(([dx, dy]) => [x + dx, y + dy]).find((tile) => this.isOpen(tile));
    if (to) this.pushed = { tick: context.tick, to };
  }
  moveDisplacedPlayer(player, targetTile, place) {
    if (this.pushed?.tick === this.tick) {
      place(this.pushed.to, player.facing);
      return true;
    }
    if (this.pushed?.tick !== this.tick - 1) return undefined;
    player.previousPosition = [...player.position];
    player.isMoving = false;
    player.isRunning = false;
    return false;
  }
  // A rock that falls for 7 ticks, hurts a player still on its tile and stays.
  dropRock(context, at) {
    const tile = [...at];
    const rotation = Math.floor(this.random() * 4);
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.falling[rotation], target: tileTarget(tile), height: 0, delayCycles: fallingDelayCycles }] });
    this.falling.push({ tile, lands: this.tick + rockTicks });
    this.later(rockTicks, (ctx, hits) => {
      this.rockHits(ctx, hits, tile, "A falling rock", false, true);
      this.placeRubble(tile, rotation);
    });
  }
  placeRubble(tile, rotation) {
    if (this.rubble.has(key(tile))) return false;
    if (this.arenaBase?.walkableTiles && !this.arenaBase.walkableTiles.has(key(tile))) return false;
    this.rubble.set(key(tile), [tile[0], tile[1], rotation]);
    if (this.arenaBase) setArenaConfig(this.arenaWithRubble(), getArenaDefaultWalkable());
    return true;
  }
  crumbleRubble(context) {
    if (this.rubble.size === 0) return;
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: [...this.rubble.values()].map(([x, y]) => ({ spotAnimId: spots.crumble, target: tileTarget([x, y]), height: 0, delayCycles: 0 })) });
    this.rubble.clear();
    if (this.arenaBase) setArenaConfig(this.arenaWithRubble(), getArenaDefaultWalkable());
  }

  // --- the stun and the specials -----------------------------------------
  // What it does to a hit of the player's on it, as the hit lands. OBS kills: a
  // shot let go before the stun, landing in it from the front, does its whole
  // damage (20 of 20 let go the tick after the cast: 19 to 43, or 0 for 6).
  playerHit(damage, attack, target, player) {
    if (target.id !== bossActorId || !target.alive) return damage;
    const at = player.position;
    const launched = this.tick - (attack.impactDelayTicks ?? 0);
    const stunned = this.stun !== null && launched >= this.stun.since;
    const rear = stunned && isBehind(this.stun.face, at);
    const aura = this.enraged && this.inAura(this.world, at);
    let dealt = damage;
    if (attack.style === "magic" && (rear || aura)) dealt *= 2; // WIKI
    if (stunned && !rear) dealt = Math.min(stunCap, dealt);
    if (this.special) dealt = Math.floor((dealt * Math.round((1 - specialReduction) * 100)) / 100);
    dealt = Math.min(dealt, target.vitals.hp);
    if (stunned && dealt > 0) {
      this.stun.dealt += dealt;
      if (rear || this.stun.dealt >= this.version.maxHp * stunBreakShare) this.breakStun(target, rear);
    } else if (this.stun === null && !this.enraged && !this.special && attack.style === "magic" && shadowSpells.has(attack.spellId)) {
      // WIKI: a shadow spell always stuns it. OBS 11/25: 47 of 47 in ranged gear,
      // none of them splashed, and none did any damage.
      this.beginStun(target, at);
      return 0;
    }
    return dealt;
  }
  wouldStun(spellId) {
    return shadowSpells.has(spellId) && this.stun === null && !this.enraged && !this.special;
  }
  beginStun(boss, at) {
    this.epoch++;
    this.stun = { since: this.tick, until: this.tick + this.version.stunTicks, face: [at[0] - centre[0], at[1] - centre[1]], dealt: 0 };
    boss.lockedFacing = boss.facing;
    this.pendingVisuals.push({ message: messages.stunned });
    const epoch = this.epoch;
    // OBS 11/25: the tick after, it holds still.
    this.later(1, (ctx) => {
      if (this.epoch !== epoch || !this.stun) return;
      this.animate(ctx, "stunned");
      this.onBoss(ctx, spots.stunned, 30);
    });
  }
  endStun(boss) {
    this.stun = null;
    delete boss.lockedFacing;
  }
  // OBS 11/26: only the stuns broken count towards the volley after one (a stun
  // run out and one broken: the second after it, not the third).
  breakStun(boss, rear) {
    this.stuns++;
    this.endStun(boss);
    this.epoch++;
    this.volley = this.version.volleyAfterStun(this.stuns);
    this.orbs = 0;
    this.specialDue = true;
    if (rear) this.pendingVisuals.push({ message: messages.weakSpot });
    this.pendingVisuals.push({ tails: "weakSpot" });
  }
  beginSpecial(boss, context) {
    if (this.enraged) return;
    const kind = this.nextSpecial;
    this.nextSpecial = kind === "lightning" ? "smoke" : "lightning";
    this.epoch++;
    const special = { kind, start: context.tick, id: this.epoch };
    this.special = special;
    const on = () => this.special === special;
    this.say(context, messages[kind]);
    this.animate(context, "roar");
    if (kind === "lightning") this.lightning(context, on);
    else this.smoke(context, on);
  }
  // `rest`: the ticks to the next orb.
  endSpecial(rest) {
    this.special = null;
    this.nextAttackTick = this.tick + rest;
  }
  lightning(context, on) {
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [], lightningCharges: true });
    this.later(lightning.start, (ctx) => {
      if (!on()) return;
      this.animate(ctx, "lightning");
      this.special.sector = (sectorOf(ctx.playerPos) + 1) % sectorCount;
    });
    this.later(lightning.loop, (ctx) => on() && this.animate(ctx, "lightningLoop"));
    for (let n = 0; n < lightning.strikes; n++) this.later(lightning.first + n, (ctx, hits) => on() && this.strike(ctx, hits));
    this.later(lightning.end, (ctx) => on() && this.animate(ctx, "lightningEnd"));
    this.later(lightning.over, () => on() && this.endSpecial(lightning.rest));
  }
  // One strike, on every tile of a sector at once.
  strike(context, hits) {
    const { special } = this;
    const player = context.world.getPlayer();
    if (!player?.alive) return;
    // Where it aims: where the player was a tick ago, but for the first strike.
    if (special.seen) special.sector = turnSector(special.sector, sectorOf(player.vitals.hp <= lightning.lowHp ? context.playerPos : special.seen));
    special.seen = [...context.playerPos];
    const tiles = lightningSectors[special.sector];
    this.warnings = tiles.map((tile) => ({ tile: [...tile], from: context.tick, until: context.tick + 1 }));
    this.onBoss(context, spots.lightning);
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: tiles.map((tile) => ({ spotAnimId: spots.lightningGround, target: tileTarget(tile), height: 0, delayCycles: 2 * ring(tile) })) });
    if (tiles.some((tile) => key(tile) === key(context.playerPos)))
      hits.push({ source: "The Leviathan's lightning", attackType: "typeless", baseDamage: [...this.version.lightningHit], playerPosition: [...context.playerPos] });
    if (special.sector % sideOrbEvery === 0) this.sideOrbs(context);
  }
  sideOrbs(context) {
    const set = sideOrbSets[this.random() < 0.5 ? 0 : 1];
    for (const tile of set) {
      if (this.random() >= sideOrbChance) continue;
      const flight = sideOrbFlights[Math.floor(this.random() * sideOrbFlights.length)];
      emitInfernoVisual(context.tickEvents, { animations: [],
        projectiles: [{ spotAnimId: spots.sideOrb, sourcePosition: [centre[0] + 0.5, centre[1] + 0.5], target: tileTarget(tile),
          startDelayCycles: flight.from, endDelayCycles: flight.ticks * cyclesPerTick, ...sideOrbProjectile }],
        graphics: [{ spotAnimId: spots.sideOrbShadow, target: tileTarget(tile), height: 0, delayCycles: flight.shadow }] });
      this.later(flight.ticks, (later, hits) => {
        emitInfernoVisual(later.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.sideOrbLands, target: tileTarget(tile), height: 0, delayCycles: 0 }] });
        if (later.world.getPlayer()?.alive && key(later.playerPos) === key(tile))
          hits.push({ source: "The Leviathan's lightning orb", attackType: "typeless", baseDamage: [...this.version.sideOrbHit], playerPosition: [...later.playerPos] });
      });
    }
  }
  smoke(context, on) {
    this.cover = new Set();
    this.later(smoke.spit, (ctx) => on() && this.animate(ctx, "spit"));
    for (let n = 0; n < smoke.rocks; n++)
      this.later(smoke.firstRock + n, (ctx) => {
        if (!on() || !ctx.world.getPlayer()?.alive) return;
        if (n === 0) this.animate(ctx, "spitLoop");
        const tile = [...ctx.playerPos];
        const mouth = mouthFor(tile);
        emitInfernoVisual(ctx.tickEvents, { animations: [], graphics: [],
          projectiles: [{ spotAnimId: spots.boulder, sourcePosition: [mouth[0] + 0.5, mouth[1] + 0.5], target: tileTarget(tile),
            startDelayCycles: 0, endDelayCycles: smoke.rockFlight * cyclesPerTick, ...boulderProjectile }] });
        this.falling.push({ tile, lands: ctx.tick + smoke.rockFlight });
        this.later(smoke.rockFlight, (later, hits) => {
          if (this.outcome.phase !== "active") return;
          this.rockHits(later, hits, tile, "A thrown rock", true, true);
          // OBS 11/25: a second rock on a tile leaves nothing more, and is not drawn landing.
          if (this.placeRubble(tile, 0))
            emitInfernoVisual(later.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.boulderLands, target: tileTarget(tile), height: 0, delayCycles: 0 }] });
        });
      });
    this.later(smoke.charge, (ctx) => {
      if (!on()) return;
      this.animate(ctx, "blast");
      this.onBoss(ctx, spots.blastCharge);
    });
    this.later(smoke.blast, (ctx, hits) => on() && this.blast(ctx, hits));
    this.later(smoke.over, () => on() && this.endSpecial(smoke.rest));
  }
  blast(context, hits) {
    this.animate(context, "lightningEnd");
    this.onBoss(context, spots.blast);
    const sheltered = (tile) => isSheltered(tile, (rock) => this.rubble.has(key(rock)));
    this.cover = new Set(this.floor.filter(sheltered).map(key));
    const rim = [];
    for (let x = pool.minX; x <= pool.maxX; x++) for (let y = pool.minY; y <= pool.maxY; y++) if (inPool([x, y])) rim.push([x, y]);
    const graphics = [...this.floor, ...rim].filter((tile) => inWave(tile) && !sheltered(tile)).map((tile) => {
      const dx = tile[0] - centre[0], dy = tile[1] - centre[1];
      return { spotAnimId: spots.wave[waveDirections.indexOf(String(heading(dx, dy)))], target: tileTarget(tile), height: 0,
        delayCycles: wave.cycles * (Math.abs(dx) + Math.abs(dy)) + wave.first };
    });
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics });
    if (context.world.getPlayer()?.alive && !this.cover.has(key(context.playerPos)))
      hits.push({ source: "The Leviathan's smoke blast", attackType: "typeless", baseDamage: [...this.version.smokeHit], playerPosition: [...context.playerPos] });
  }

  // --- the enrage and the pathfinder --------------------------------------
  // Awakened it waits a tick: the special its hit set off begins, and stops.
  isEnrageDue(tick) {
    if (!this.awakened) return true;
    this.awakened.enrageTick ??= tick + this.version.enrageDelay;
    return tick >= this.awakened.enrageTick;
  }
  enrage(boss, context) {
    this.enraged = true;
    if (this.stun) this.endStun(boss);
    this.orbs = 0;
    // WIKI: a smoke under way still blasts (not one the same hit set off: above,
    // smoke); a lightning stops (inferred: RSPSApp's).
    if (this.special?.kind !== "smoke" || context.tick <= this.special.start + this.version.enrageDelay) this.special = null;
    if (this.awakened) {
      // OBS 11/25 (3 of 3): its rocks first, and the roar, with its chip, a tick later.
      this.epoch++;
      this.animate(context, "orbEnd");
      this.roarRocks(context);
      this.chip();
      this.later(chipTicks, (ctx) => this.animate(ctx, "roar"));
    } else this.roar(context);
    this.nextEnrageRockTick = context.tick + this.enrageRockGap();
    this.nextAttackTick = context.tick + this.version.enrageFirstAttackTicks;
    const corner = this.pathfinderCorner();
    // OBS 11/25 (3 of 3): a plus over its corner, four times a second apart.
    const [cx, cy] = pathfinderCorners[corner];
    const plus = [[0, 0], [0, 1], [0, -1], [-1, 0], [1, 0]];
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: [0, 30, 60, 90].flatMap((delayCycles) => plus.map(([dx, dy]) => ({ spotAnimId: spots.pathfinderMark, target: tileTarget([cx + dx, cy + dy]), height: 0, delayCycles }))) });
    this.later(pathfinderTicks, (ctx) => this.spawnPathfinder(ctx, corner));
  }
  enrageRockGap() {
    return this.version.enrageRockTicks(this.rockWaves++);
  }
  // The first corner clockwise from the north-west that is clear of rubble, the
  // north-west if none is (WIKI). What counts differs (versions, pathfinderClear).
  pathfinderCorner() {
    const rocks = [...this.rubble.values()];
    return Math.max(0, pathfinderCorners.findIndex((corner) => !rocks.some((rock) => chebyshev(rock, corner) <= this.version.pathfinderClear)));
  }
  spawnPathfinder(context, corner) {
    if (this.outcome.phase !== "active") return;
    const [cx, cy] = pathfinderCorners[corner];
    this.say(context, messages.enraged); // OBS 11/25: as it appears (3 of 3)
    this.pathfinder = { walkTick: context.tick + pathfinderWalkTicks, destination: (corner + 1) % pathfinderCorners.length };
    context.spawnNpc({
      id: pathfinderActorId, kind: "npc", role: "npc", npcTypeId: ids.pathfinder, archetypeId: pathfinderActorId, size: 3, alive: true,
      position: [cx - 1, cy - 1], previousPosition: [cx - 1, cy - 1], facing: 0,
      untargetable: true, blocksNpcMovement: false, passThruNpcs: true, history: new Map(),
      vitals: { hp: 1, maxHp: 1 },
      combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
        animations: { idle: seqs.pathfinderIdle, walk: seqs.pathfinderIdle, run: seqs.pathfinderIdle, attack: null, death: null } },
    });
    this.animate(context, "spawn", pathfinderActorId);
  }
  pathfinderCentre(world) {
    const npc = world?.getNpc(pathfinderActorId);
    return npc?.alive ? [npc.position[0] + 1, npc.position[1] + 1] : null;
  }
  // Its middle once it has taken this tick's step, for what comes before the NPCs.
  pathfinderMiddleNext(context) {
    const npc = context.world.getNpc(pathfinderActorId);
    if (!npc?.alive) return null;
    return this.pathfinder && context.tick >= this.pathfinder.walkTick ? this.pathfinderStep(npc).middle : [npc.position[0] + 1, npc.position[1] + 1];
  }
  inAura(world, at) {
    const middle = this.pathfinderCentre(world);
    return middle !== null && chebyshev(middle, at) <= auraRadius;
  }

  // --- the tornado -----------------------------------------------------
  spawnTornado(context) {
    const near = this.floor.filter((tile) => chebyshev(tile, context.playerPos) <= tornadoNear && !this.rubble.has(key(tile)));
    const at = near[Math.floor(this.random() * near.length)] ?? [...context.playerPos];
    this.awakened.tornado = { holdUntil: context.tick + 1, hitTick: null };
    context.spawnNpc({
      id: tornadoActorId, kind: "npc", role: "npc", npcTypeId: ids.tornado, archetypeId: tornadoActorId, size: 1, alive: true,
      position: [...at], previousPosition: [...at], facing: 0,
      untargetable: true, blocksNpcMovement: false, passThruNpcs: true, history: new Map(),
      vitals: { hp: 1, maxHp: 1 },
      combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
        animations: { idle: seqs.tornado, walk: seqs.tornado, run: seqs.tornado, attack: null, death: null } },
    });
  }
  moveTornado(npc, context) {
    const { tornado } = this.awakened;
    if (context.tick < tornado.holdUntil) return [];
    const [x, y] = npc.position;
    const [dx, dy] = heading(context.playerPos[0] - x, context.playerPos[1] - y);
    if (dx === 0 && dy === 0) {
      tornado.hitTick = context.tick;
      tornado.holdUntil = context.tick + tornadoHold;
      return [];
    }
    return [{ npcId: npc.id, path: [[x + dx, y + dy]] }];
  }
  tornadoTurn(npc, context) {
    const player = context.world.getPlayer();
    if (this.awakened.tornado.hitTick !== context.tick || !player?.alive) return { environmentalDamages: [] };
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.tornadoHit, target: buildActorVisualTarget(player), height: 0, delayCycles: 0 }] });
    return { environmentalDamages: [{ source: "The tornado", attackType: "typeless", baseDamage: [...this.version.tornadoHit], playerPosition: [...context.playerPos] }] };
  }

  // --- the rest --------------------------------------------------------
  // WIKI: what a melee attack of the player's comes to.
  onPlayerAttackStarted(attack, context) {
    if (attack.targetId === bossActorId && attack.attackType === "melee") this.say(context, messages.melee);
  }
  later(ticks, run) {
    this.queue.push({ tick: this.tick + ticks, run });
  }
  animate(context, clipId, actorId = bossActorId) {
    emitInfernoVisual(context.tickEvents, { animations: [{ actorId, clipId, delayCycles: 0 }], projectiles: [], graphics: [] });
  }
  animateTails(context, clipId) {
    emitInfernoVisual(context.tickEvents, { animations: tails.map(({ id }) => ({ actorId: id, clipId, delayCycles: 0 })), projectiles: [], graphics: [] });
  }
  onBoss(context, spotAnimId, delayCycles = 0) {
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: [{ spotAnimId, target: buildActorVisualTarget(context.world.getNpc(bossActorId)), height: 0, delayCycles }] });
  }
  say(context, { text, color }) {
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [color ? { text, color } : { text }] });
  }
  // What a hit of the player's set off, which has no context of its own.
  flushVisuals(context) {
    for (const visual of this.pendingVisuals) {
      if (visual.message) this.say(context, visual.message);
      if (visual.tails) this.animateTails(context, visual.tails);
    }
    this.pendingVisuals = [];
  }
  getEngineRules() {
    return {
      // WIKI: "Your melee attacks can't reach the lure!"
      validateAttack: (attackKind, targetId) => (targetId === bossActorId && attackKind.startsWith("melee") ? false : null),
      playerDamageOnNpc: (damage, { attacker, target, attack }) => this.playerHit(damage, attack, target, attacker),
      // WIKI: stunning it resets the attack delay. OBS kills: the shot came the tick
      // after the cast in 20 of 23, with the weapon ready as it was cast: a shadow
      // spell cast on it to stun it starts no cooldown. Cast from the spellbook
      // (manualCastSpell), as it was in all of them.
      playerAttackKeepsReady: (target) => target.id === bossActorId && this.wouldStun(this.world?.getPlayer()?.manualCastSpell),
      // Its weak spot while it is stunned, the pathfinder's aura once enraged:
      // ranged cannot miss (inferred: RSPSApp's for the weak spot; WIKI for the
      // aura) and does at least a share of its max (WIKI).
      playerAlwaysAccurate: (rules, { style, target }) => this.rangedBoost(rules, style, target) !== null,
      playerMinimumHit: (maximum, rules, { style, target }) => {
        const share = this.rangedBoost(rules, style, target);
        return share === null ? 0 : Math.floor(maximum * share);
      },
    };
  }
  rangedBoost(rules, style, target) {
    if (style !== "range" || target?.id !== bossActorId) return null;
    const at = rules.player.position;
    if (this.stun && isBehind(this.stun.face, at)) return rearRangedMinimum;
    if (this.enraged && this.inAura(rules.world, at)) return auraRangedMinimum;
    return null;
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    this.queue = [];
    this.warnings = [];
    this.inFlight = [];
    this.falling = [];
    this.stun = null;
    this.special = null;
    this.cover.clear();
    // WIKI: "Once the Leviathan is slain, all debris on the field will be removed."
    // OBS 11/26 kills (21 of 21, 290 rocks): not at the kill; every rock stays
    // through its death and crumbles the tick after it is gone (kill + 7). The
    // fight stops as it goes (deathTicks), so here they crumble then, a tick early.
    this.queue.push({ tick: defeat.tick + deathTicks, run: (ctx) => this.crumbleRubble(ctx) });
    for (const id of [pathfinderActorId, tornadoActorId]) if (context.world.getNpc(id)) context.despawnNpc(id);
    this.pathfinder = null;
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  // The replay's auto markers (client/replay/markers.js).
  getAutoMarkers() {
    return this.enraged ? [{ id: "enrage", label: "enrage" }] : [];
  }
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        volley: this.volley + 1, // 1 to 7, as the wiki counts them
        enraged: this.enraged,
        stunnedUntil: this.stun?.until ?? null,
        special: this.special && { kind: this.special.kind, start: this.special.start },
        nextSpecial: this.nextSpecial,
        rubble: [...this.rubble.values()].map((tile) => [...tile]), // [x, y, rotation]
        lightning: this.warnings.map(({ tile, from, until }) => ({ tile: [...tile], from, until })),
        orbs: this.inFlight.map(({ style, lands }) => ({ style, lands })),
        falling: this.falling.map(({ tile, lands }) => ({ tile: [...tile], lands })),
        pathfinder: this.pathfinder && { destination: [...pathfinderCorners[this.pathfinder.destination]] },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "The Leviathan";
  }
}

export const leviathanDefinition = {
  kind: leviathanKind,
  factory: () => new LeviathanEncounter(),
  descriptor: {
    kind: leviathanKind,
    displayName: "The Leviathan",
    description: "Desert Treasure II. The Scar: volleys of orbs to pray against, rocks from its roars, a shadow stun, lightning and smoke, and the abyssal pathfinder.",
    // The texts of the page for search engines (client/seo/routes.js).
    seo: {
      title: "OSRS Leviathan Simulator",
      description: "Practice the Leviathan from Desert Treasure II in your browser: the volleys of orbs to pray against, the falling rocks, lightning and smoke, and the abyssal pathfinder.",
      h1: "Leviathan Simulator",
      intro: "The Leviathan is one of the four Desert Treasure II bosses in OSRS, fought in the Scar. This sim covers its volleys of orbs to pray against, the rocks from its roars, the shadow stun, lightning and smoke, and the abyssal pathfinder.",
      keywords: ["OSRS Leviathan", "Leviathan simulator", "Leviathan practice", "Leviathan prayer switches", "Desert Treasure II bosses", "DT2 boss simulator"],
    },
    mapSquare: leviathanMapSquare,
    playerStart: climbedTo,
    loadsMapLocs: true,
    isWorkInProgress: true,
    collision: { mode: "custom" }, // getArenaConfig, above
    victory: { eyebrow: "Triumphant", title: "VICTORY", narrative: "THE LEVIATHAN DEFEATED", accent: "gold" },
    // The awakened fight is a variant kind (client/dt2/bosses.js, awakenedKind).
    variants: [
      { id: "post_quest", encounterKind: leviathanKind, name: "Post-quest", subtitle: "900 hitpoints.", available: true, presetsKey: leviathanKind },
      { id: "awakened", encounterKind: leviathanAwakenedKind, name: "Awakened", subtitle: "2,700 hitpoints, harder hits, five rocks to a roar, a tornado from half health, an orb a tick once enraged.", available: true, presetsKey: leviathanKind },
    ],
    variantLabel: "Version",
    loadouts: leviathanLoadouts,
    // Its own judges of its combat achievements (client/combatAchievements/tracker.js).
    combatAchievements: leviathanCombatAchievements,
  },
  controls: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] },
  variantFactories: { [leviathanAwakenedKind]: () => new LeviathanEncounter(leviathanAwakenedKind, versions.awakened) },
  variantControls: { [leviathanAwakenedKind]: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] } },
};
// How the registry finds it (encounters/registry.js), and where it stands in the encounter picker.
export { leviathanDefinition as definition };
export const order = 80;
