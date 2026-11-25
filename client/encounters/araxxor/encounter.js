// Araxxor, in his lair in the Morytania Spider Cave.
// https://oldschool.runescape.wiki/w/Araxxor/Strategies
//
// He comes up in the middle of his lair with nine eggs around it, three of
// each colour in one of three fixed orders. Every 6 ticks he attacks: with
// his legs when the player is beside him (diagonals too), otherwise with
// magic or ranged, whichever the player defends worse. Protection prayers
// only reduce his hits, and his ranged and magic drain Defence and Prayer.
// Every seventh attack is a special, which the colour of the first egg
// chooses: a red egg the acid drip (the player drips acid where he walks), a
// white one the acid spray, a green one the rolling acid ball. All three leave
// acid pools that stay for the rest of the fight and hurt a player standing
// in them.
//
// Eggs hatch one at a time, the south-easternmost first and then clockwise:
// a white Mirrorback, which takes a fifth of the damage dealt to Araxxor and
// throws half of that back at the player; a green Acidic, which spits from
// range and bursts into acid when it dies; a red Ruptura, which walks to the
// player and explodes, hurting whatever stands near it, Araxxor included.
//
// At 25% of his hitpoints he is enraged: tougher, no more specials, an attack
// every 4 ticks, and his melee becomes a cleave across a line of three tiles
// that the player dodges by stepping off it, and that leaves acid there. A
// player under him when he cleaves makes him cut himself.
//
// Sources, beside the usual: plain OBS is two kills BigSneezi recorded with
// the Outside plugin on 24 November 2026 (https://outside.wiki/bigsneezi):
// k1, red eggs first (bigsneezi-araxxor-2026-11-24.jsonl.gz; he comes up at
// t 164), and k2, green eggs first (the same name with "(1)"; he came up at
// t -7, before its first tick). "OBS k1 218" is tick 218 of the first. They
// were fought with melee beside him, so his ranged attack, the spray, the
// Ruptura's blast on the player and the cleave through Protect from Melee are
// not in them, nor an Acidic that is killed, nor an acid ball that hits. OBS
// (tsps) is RSPSApp's reading of rsprox recordings 1077-1095, 1442, 1445 and
// 1508 of ordinary worlds (RSPSApp/tsps docs/araxxor.md and
// server/plugins/bosses/araxxor). Ids are the cache's, their names its gameval
// names as RSPSApp exports them.
//
// Timing: the recorder sees a hit on the player a tick after the engine
// applies it (an NPC's melee is in the engine's tick of the swing and on the
// recorder's next), so a hit on him recorded n ticks after its attack is n - 1
// here. A hit on an NPC is recorded on the tick it lands (the player's own 77
// on Araxxor are, in both kills, on the tick they land here). Animations,
// effects, spawns, sounds and the acid on the floor are timed as recorded.
import { getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { CollisionFlag } from "../../engine/collision.js";
import { setArenaConfig, getArenaDefaultWalkable } from "../../engine/arena.js";
import { getPlayerDefenceRoll, getPlayerFormulaStats, getPrayerMultipliers } from "../../engine/combatFormulas.js";
import { rollNpcAttack, isNpcInAttackRange } from "../shared/npcAttack.js";
import { canFootprintStepInArena, getNpcPursuitMoves } from "../shared/npcMovement.js";
import { buildActorVisualTarget, faceActorToward } from "../shared/npcHelpers.js";
import { createOccupancyStepCheck } from "../../engine/occupancy.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { getCanonicalEquipmentId } from "../../data/equipment.js";
import { araxxorLoadouts } from "./loadouts.js";

export const araxxorKind = "araxxor";
// CACHE: the lair is map square 56,153 (region 14489) and the west edge of
// 57,153 (region 14745), where the tunnel comes in. Tiles are counted from the
// south-west corner of the first, so the second's are x 64 to 127.
export const araxxorMapSquare = { x: 56, y: 153 };
export const araxxorMapSquareOffsets = [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }];
const worldOrigin = [56 * 64, 153 * 64];
const fromWorld = ([x, y]) => [x - worldOrigin[0], y - worldOrigin[1]];
// OBS, OBS (tsps): he comes up here in every recorded fight (3631,9814).
export const bossStart = fromWorld([3631, 9814]);
// OBS (tsps): the tunnel puts the player here (3647,9815).
export const playerStart = fromWorld([3647, 9815]);
const bossSize = 7; // CACHE
// OBS, OBS (tsps): the eggs' south-west tiles in the order they hatch, the
// south-easternmost first and then clockwise (WIKI), the same in every fight.
export const eggTiles = [
  [3643, 9805], [3637, 9802], [3630, 9803], [3625, 9806], [3620, 9813],
  [3621, 9822], [3629, 9827], [3637, 9827], [3644, 9823],
].map(fromWorld);
const eggSize = 2; // CACHE
const araxyteSize = 2; // CACHE
const ballSize = 3; // CACHE

export const ids = {
  boss: 13668, // CACHE araxxor
  // CACHE: the eggs by the araxyte they hatch.
  eggs: { mirrorback: 13670, ruptura: 13672, acidic: 13674 },
  araxytes: { mirrorback: 13671, ruptura: 13673, acidic: 13675 },
  ball: 13676, // CACHE: the acid ball, 3 x 3
  pool: 54148, // CACHE araxxor_acidpool, "Acid pool"
};
export const seqs = {
  idle: 11474, // CACHE: his stand
  walk: 11473, // CACHE: his walk
  spawn: 11482, // CACHE npc_araxxor_01_spawn_01; OBS
  melee: 11480, // OBS
  magic: 11479, // OBS
  ranged: 11493, // OBS (tsps) acid_cannon_01
  ball: 11476, // OBS attack_ranged_01: the acid ball's throw
  spray: 11478, // OBS (tsps): the acid spray
  drip: 11477, // OBS: the acid drip
  cleave: 11487, // OBS: with "Skree!"
  enrage: 11488, // OBS
  enraged: 11489, // OBS: 2 ticks after 11488
  death: 11481, // OBS
  eggSpawn: 11506, // OBS egg_araxyte_spawn_01
  eggIdle: 11507, // CACHE: the egg's stand
  eggCrumble: 11508, // OBS: the eggs left when he dies
  hatch: 11503, // OBS npc_araxyte02_hatch
  araxyteIdle: 9137, // CACHE
  araxyteWalk: 9138, // CACHE
  acidicAttack: 11498, // OBS
  mirrorbackAttack: 11500, // OBS (tsps)
  mirrorbackDeath: 11510, // OBS npc_araxyte_mirror_back_death
  explode: 11504, // OBS npc_araxyte_explode: the Ruptura's blast and the Acidic's death
  ballRoll: 11491, // OBS
  ballBurst: 11492, // OBS
};
export const spots = {
  hatch: { mirrorback: 2929, ruptura: 2928, acidic: 2927 }, // OBS
  rupturaExplosion: 2925, // OBS araxyte_explosive_spider_explosion
  acidicDeath: 2926, // OBS (tsps)
  drip: 1626, // OBS araxxor_venom_drip, on the player each tick he drips
  splat: 2923, // OBS: where a blob of acid lands
  blob: 2924, // OBS: the blobs of acid
  magic: 1622, // OBS
  magicImpact: 1625, // OBS: on the player as the magic lands
  ranged: 2360, // OBS (tsps)
  acidic: 1560, // OBS
};

const bossActorId = "araxxor";
const eggActorId = (index) => `araxxor-egg-${index}`;
const araxyteActorId = (index) => `araxyte-${index}`;
const ballActorId = (count) => `acid-ball-${count}`;

// WIKI: the three orders; OBS: red, green, white in one kill, green, white,
// red in the other. Which one a fight gets is inferred: any, evenly.
export const patterns = {
  green: ["acidic", "mirrorback", "ruptura"],
  white: ["mirrorback", "ruptura", "acidic"],
  red: ["ruptura", "acidic", "mirrorback"],
};
// WIKI, OBS: the first egg's colour chooses the special.
const specialOf = { acidic: "ball", mirrorback: "spray", ruptura: "drip" };

const attackTicks = 6; // WIKI, OBS (k1 170 to 314, k2 5 to 143)
const enragedAttackTicks = 4; // WIKI, OBS (k1 320 to 352, k2 149 to 181)
// OBS: every seventh attack (k1 206, 248, 290; k2 35, 77, 119; WIKI: "every six standard attacks")
const specialEvery = 7;
const firstAttackTicks = 6; // OBS: 6 ticks after he comes up (k1 164 and 170)
// OBS: the first egg hatches 21 ticks after he comes up and the next every 42
// ticks, enraged too (k1 185, 227, 269, 311, 353; k2 14, 56, 98, 140, 182).
// WIKI: 3 ticks after the third standard attack and after every sixth, which
// is the same until the enrage.
const firstHatchTicks = 21;
const hatchTicks = 42;
// OBS: it turns to the player 3 ticks after it hatched (k1 188, 230, 272, 314,
// 356; k2 17, 59, 101, 143) and walks from 5 (k1 190, 232, 274, 316; k2 19,
// 61, 103, 145; OBS (tsps)).
const araxyteTurnTicks = 3;
const araxyteWakeTicks = 5;
const enrageThreshold = 0.25; // WIKI
// OBS: the first cleave 5 ticks after 11488 (k1 315 and 320, k2 144 and 149).
// It is also 6 after his last bite in both, so his usual 6 fits them as well.
const enrageFirstAttackTicks = 5;
const enrageBodyTicks = 2; // OBS: 11489 2 ticks after 11488 (k1 315 and 317, k2 144 and 146)
const cleaveReach = 2; // WIKI: "a cleave with range 2"
const cleaveHitTicks = 1; // OBS: its hit (k2 161 and 163) and its acid 2 ticks after the swing
const cleavePoolTicks = 2;
// OBS: the cut he gives himself 2 ticks after the swing (k2 173, 177, 181), or
// 3 (k2 161, 165; what makes it 3 does not show).
const cleaveCutTicks = 2;
// OBS: he drops his target with a cleave and has it back 3 ticks later (15 of
// 17; k2 173 and 177 after 2), with the acid ball's throw 4 (k2 35, 77, 119).
// Until then he neither turns nor steps (k1 333 and 334, k2 155, 158, 159).
const cleaveTargetTicks = 3;
const ballTargetTicks = 4;
// inferred (RSPSApp's): his ranged and magic reach 10 tiles; no source says.
const distantReach = 10;
const distantHitTicks = 3; // OBS (k1 218 and 222), OBS (tsps): 4 ticks after the cast, whatever the distance
const ballLandTicks = 2; // OBS: k2 35 and 37, 77 and 79, 119 and 121
// OBS: its middle is on the edge of his body in one of eight directions, the
// nearest to the player's: k2 37 and 79, north-east, 53,28 for a player at
// 53,29; k2 121, north, 50,28 for one at 51,29. tsps: on the player's tile.
const ballLandDistance = 3;
// OBS: each of three balls rolled 7 tiles (2, 2, 2, then 1) and burst, each
// at the lair's wall too (k2 37 to 42, 79 to 84, 121 to 126). tsps: it rolls
// until its next step is blocked.
const ballRollTiles = 7;
const dripLandTicks = 4; // OBS: k1 206 and 210, 248 and 252, 290 and 294
const dripTicks = 7; // OBS (k1 210 to 216, 252 to 258, 294 to 300), OBS (tsps): 1626 on the player for 7 ticks
const dripPools = 6; // OBS: a pool on each of the next 6 ticks (k1 211 to 216, 253 to 258, 295 to 300)
// OBS: the Ruptura blows up 2 ticks after it reaches the player, its blast
// lands on Araxxor 2 ticks later (k1 205 and 207, 333 and 335; k2 120 and 122)
// and, inferred, is recorded then on the player too; it goes 2 after that.
const rupturaFuseTicks = 2;
const rupturaNpcBlastTicks = 2;
const rupturaPlayerBlastTicks = 1;
const rupturaGoneTicks = 4;
// OBS: it walks until it is 8 tiles away and spits from no farther (52 spits;
// the first of each on the tick it gets there: k1 242, k2 25 and 150).
const acidicHoldRange = 8;
const mirrorbackGoneTicks = 3; // OBS: gone 3 ticks after the killing hit (k1 290 and 293, k2 83 and 86)
// OBS, from his death animation 11481: the araxytes die with it, the eggs
// crumble a tick later, the araxytes go 2 ticks after it and the eggs 3
// (k1 357, 358, 359, 360; k2 183, 184, 185, 186), and 5 after it he is his
// corpse (k1 362, k2 188; OBS (tsps)).
const deathTicks = 5;
const eggCrumbleTicks = 1;
const araxytesGoneTicks = 2;
const eggsGoneTicks = 3;
const cyclesPerTick = 30;

// Max hits (WIKI) and what a protection prayer leaves of them.
export const maxHits = { melee: 38, range: 34, magic: 21, acidic: 15 };
export const prayerLeaves = {
  // OBS: through Protect from Melee his legs hit 0 to 3 (42 swings, none
  // above 3; of the 38 that landed alone 11 were 0, 9 were 1, 8 were 2 and 10
  // were 3): a tenth of a hit, rounded down (inferred). WIKI says at most 5.
  melee: 0.1,
  range: 0.55, // WIKI: "reduces it by about 45%, to a max of 18"
  magic: 0.5, // WIKI: "reduces it by about 50%"
  cleave: 0.34, // WIKI: "reducing the damage by ~66%"
};
const maxDefenceDrain = 45; // WIKI: "His Defence level can be only drained by up to 45 levels"
// Aranea boots, WIKI and OBS (tsps, recordings 4060, 4067): they negate his
// ranged at most once every 8 ticks and his cleave once every 20, each an
// attack that would have hurt (tsps: inferred there). Magic and his bite never.
const araneaBoots = 29806;
const araneaTicks = { range: 8, cleave: 20 };
const araneaMessage = "Your Aranea boots let you avoid the spider-based attack.";
const drainShare = 0.09; // WIKI, OBS (tsps), OBS (k1 222: 3 of 37 Prayer): 9% of the level as it is, rounded down
const poolDamage = [4, 5]; // OBS (tsps): flat, however long the player stands in it; OBS: 4 and 4 (k1 217, k2 182)
const ballDamage = [14, 18]; // OBS (tsps)
const venom = 1_000_000; // WIKI: the acid envenoms (the engine's poisonVarp for venom)
// WIKI: the Ruptura's blast by distance from it (under it, beside it, 1 and 2
// tiles between), in proportion to its hitpoints left. On the player (not yet
// recorded: inferred); on Araxxor, an egg or another araxyte (OBS: 80 three
// times, each with him over it, k1 207 and 335, k2 122; nothing on an Acidic 4
// tiles away, k1 335, or 6, k2 122).
const rupturaOnPlayer = [70, 49, 28, 7];
const rupturaOnNpc = [80, 64, 48, 33];
const selfCut = [8, 12]; // WIKI; OBS: 8, 12, 10 and 8 (k2 164, 168, 175, 179)
const mirrorShare = 5; // OBS: it takes a fifth, rounded down (8 of 42, 1 of 5, 5 of 27, 6 of 34, 10 of 50 ...)
const mirrorRecoil = 2; // OBS: half of that, rounded down, back at the player (4, 2, 3, 5 ...; a 0 is shown, k2 64 and 76)
// OBS: one hatched 3 ticks before takes its share (k2 59), one hatched the
// tick before does not (k2 183). Between the two, inferred: from when it turns
// to the player.
const mirrorShareTicks = araxyteTurnTicks;
const mirrorMeleeRecoil = 2; // OBS: half of a melee hit on it (18 of 37)
const bossSpawnFacing = 1280; // OBS k1 164: he comes up facing north-east
// OBS: the eggs face this tile (their recorded facings point at its middle,
// both kills), and what hatches from one faces as it did until it turns.
const eggsFace = { position: fromWorld([3634, 9815]), size: 1 };
const eggHitpoints = 65; // CACHE
const araxyteHitpoints = 58; // TABLE

// Projectiles, OBS (tsps): [start, end] cycles from the attack; heights,
// slope and how far from the source they start. The magic (k1 218), the drip
// (k1 206, 248, 290), the ball's burst (k2 41, 83, 125) and the Acidic's spit
// (52 times) are so in plain OBS too.
const projectiles = {
  ranged: { spotAnimId: spots.ranged, start: 30, end: 120, startHeight: 296, endHeight: 50, slope: 35, startOffset: 0 },
  magic: { spotAnimId: spots.magic, start: 30, end: 120, startHeight: 69, endHeight: 50, slope: 35, startOffset: 62 },
  drip: { spotAnimId: spots.blob, start: 30, end: 120, startHeight: 170, endHeight: 30, slope: 35, startOffset: 200 },
  // These end 100 (the spray) or 90 (the others) cycles plus 10 a tile from
  // where they are thrown, and the acid is there on the tick they land.
  spray: { spotAnimId: spots.blob, start: 30, base: 100, startHeight: 170, endHeight: 0, slope: 35, startOffset: 200 },
  burst: { spotAnimId: spots.blob, start: 30, base: 90, startHeight: 254, endHeight: 0, slope: 35, startOffset: 0 },
  acidicDeath: { spotAnimId: spots.blob, start: 30, base: 90, startHeight: 140, endHeight: 0, slope: 35, startOffset: 20 },
  acidic: { spotAnimId: spots.acidic, start: 39, base: 39, startHeight: 32, endHeight: 64, slope: 16, startOffset: 40 },
};
const magicImpactHeight = 50; // OBS k1 218
const sprayBlobs = 9; // OBS (tsps)
const burstBlobs = 6; // OBS (tsps): within 2 tiles of the ball
const burstSpread = 2;
const acidicDeathBlobs = 13; // OBS (tsps): within 4 tiles
const acidicDeathSpread = 4;

const key = ([x, y]) => x + "," + y;
const footprintTiles = ([x, y], size) => {
  const tiles = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) tiles.push([x + dx, y + dy]);
  return tiles;
};
// Tiles between a tile and a footprint: 0 under it, 1 beside it.
const gapTo = ([px, py], [x, y], size) => Math.max(x - px, 0, px - (x + size - 1), y - py, py - (y + size - 1));
const middleOf = (actor) => [actor.position[0] + Math.floor(actor.size / 2), actor.position[1] + Math.floor(actor.size / 2)];
const chebyshev = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const tileTarget = (position) => ({ kind: "tile", position: [...position] });
const landingTicks = (endCycles) => Math.ceil(endCycles / cyclesPerTick);

// The egg's stats: CACHE (Defence 75, 65 hitpoints); its defence bonuses are
// not known (inferred: none).
const eggFormulaStats = () => ({
  burnImmunity: null, freezeResistance: 0, poisonResistance: 100, attributes: [],
  levels: { attack: 1, strength: 1, defence: 75, ranged: 1, magic: 1 },
  offensive: { atk: 0, ranged: 0, magic: 0, str: 0, rangedStr: 0, magicStr: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0, magic: 0 },
});
const tableStats = (npcTypeId, version) => {
  const stats = getMonsterFormulaStats(npcTypeId, version);
  if (!stats) throw new Error(`Araxxor: the monster table has no ${npcTypeId}${version ? " " + version : ""}`);
  return structuredClone(stats);
};

// The egg blocks its tiles until it hatches (OBS (tsps): an invisible
// blocking object under it, swapped for one that does not block).
const eggFlags = CollisionFlag.OBJECT;
function collisionWithEggs(map, blocked) {
  const getFlag = (x, y) => (blocked.has(key([x, y])) && map.getFlag(x, y) !== -1 ? map.getFlag(x, y) | eggFlags : map.getFlag(x, y));
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

export const patternKey = "araxxorEggs";
const patternChoices = [
  { value: "random", label: "Any" },
  { value: "green", label: "Green first (acid ball)" },
  { value: "white", label: "White first (acid spray)" },
  { value: "red", label: "Red first (acid drip)" },
];

class AraxxorEncounter {
  constructor() {
    this.kind = araxxorKind;
    // Not state: the arena as the engine handed it, its open tiles, the
    // tick's context (for the rules that are handed none).
    for (const name of ["arenaBase", "floor", "context"]) Object.defineProperty(this, name, { value: null, writable: true });
    this.floor = new Set();
    this.patternChoice = "random";
    // The eggs' order stays as the run started with it (registry.js).
    this.runStartMechanicsKeys = [patternKey];
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.tick = 0;
    this.choosePattern();
    this.spawned = false;
    this.attacks = 0;
    this.nextAttackTick = firstAttackTicks;
    this.enraged = false;
    this.nextHatchTick = firstHatchTicks;
    // The eggs, in the order they hatch: "egg", "hatched", "destroyed" or "spoiled".
    this.eggs = this.pattern.map((type, index) => ({ index, type, state: "egg" }));
    this.araxytes = new Map(); // actor id -> { type, hatchTick, wakeTick, fuse }
    this.pools = new Map(); // tile key -> [x, y]
    this.queue = []; // { tick, run(context, hits) }
    this.turn = { attack: null, middle: null }; // what he does this tick, and where his middle was as it began
    this.targetTick = 0; // until then he has no target
    this.araneaReady = { range: 0, cleave: 0 }; // when the Aranea boots can negate the next of each
    this.acidHitTick = null; // the last tick a landing blob's acid hurt the player
    this.playerTrail = []; // the player's tiles at the end of the last two ticks
    this.drip = null; // { from, until }
    this.ball = null; // { id, middle, direction, hit, burstTick }
    this.balls = 0;
    this.pendingPlayerHits = []; // the Mirrorback's recoil, until the NPCs have had their turns
    this.cleaves = []; // { tiles, lands }: for the scene
    this.updateArena();
  }
  choosePattern() {
    const colours = Object.keys(patterns);
    const colour = patterns[this.patternChoice] ? this.patternChoice : colours[Math.floor(this.random() * colours.length)];
    this.colour = colour;
    // The first three repeat (WIKI).
    this.pattern = [...patterns[colour], ...patterns[colour], ...patterns[colour]];
    this.special = specialOf[this.pattern[0]];
  }
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return { [patternKey]: "random" };
  }
  configureRunStart(mechanics) {
    const choice = mechanics?.[patternKey] ?? "random";
    if (choice === this.patternChoice) return;
    this.patternChoice = choice;
    this.choosePattern();
    this.eggs = this.pattern.map((type, index) => ({ index, type, state: "egg" }));
  }
  getDefaultPlayerStart() {
    return [...playerStart];
  }
  getIntroConfig() {
    return null;
  }
  getArenaConfig() {
    return { bounds: null, collisionMap: null, walkableTiles: null };
  }
  refineArenaConfig(arena) {
    this.arenaBase = arena;
    this.floor = new Set(arena?.walkableTiles ?? []);
    this.blocked = this.eggTilesBlocked();
    return this.arenaWithEggs();
  }
  eggTilesBlocked() {
    const blocked = new Set();
    for (const egg of this.eggs) if (egg.state === "egg") for (const tile of footprintTiles(eggTiles[egg.index], eggSize)) blocked.add(key(tile));
    return blocked;
  }
  arenaWithEggs() {
    const base = this.arenaBase;
    if (!base?.collisionMap) return base;
    const blocked = this.blocked;
    const walkableTiles = base.walkableTiles ? new Set([...base.walkableTiles].filter((tile) => !blocked.has(tile))) : null;
    return { bounds: base.bounds, walkableTiles, collisionMap: collisionWithEggs(base.collisionMap, blocked) };
  }
  updateArena() {
    this.blocked = this.eggTilesBlocked();
    if (this.arenaBase) setArenaConfig(this.arenaWithEggs(), getArenaDefaultWalkable());
  }
  isFloor(tile) {
    return this.floor.size === 0 || this.floor.has(key(tile));
  }
  // The floor and the tiles at its edge, where the acid can land too (OBS: a
  // blob's pool on a tile the player cannot step onto); not an egg's.
  isAcidTile(tile) {
    if (this.blocked.has(key(tile))) return false;
    if (this.isFloor(tile)) return true;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (this.isFloor([tile[0] + dx, tile[1] + dy])) return true;
    return false;
  }

  createNpcs() {
    const formulaStats = tableStats(ids.boss, "In combat");
    const maxHp = 1020; // TABLE, WIKI
    const boss = {
      id: bossActorId, kind: "npc", role: "boss", npcTypeId: ids.boss, archetypeId: "araxxor", size: bossSize, alive: true,
      position: [...bossStart], previousPosition: [...bossStart], facing: bossSpawnFacing, history: new Map(),
      deathPolicy: "queued", // OBS k1 356 and 357: his death animation the tick after the killing hit
      vitals: { hp: maxHp, maxHp }, formulaStats, defenceDrainFloor: formulaStats.levels.defence - maxDefenceDrain,
      combat: { attackSpeed: attackTicks, attackRange: 1, meleeReach: "diagonal", attackStyle: "melee", nextActionTick: firstAttackTicks, targetId: "player", lastAttackTick: null,
        animations: { idle: seqs.idle, walk: seqs.walk, run: seqs.walk, attack: seqs.melee, death: seqs.death } },
    };
    const eggs = this.eggs.map(({ index, type }) => ({
      id: eggActorId(index), kind: "npc", role: "minion", npcTypeId: ids.eggs[type], archetypeId: "araxxor-egg", size: eggSize, alive: true,
      position: [...eggTiles[index]], previousPosition: [...eggTiles[index]], facing: 0, history: new Map(),
      vitals: { hp: eggHitpoints, maxHp: eggHitpoints }, formulaStats: eggFormulaStats(),
      combat: { attackSpeed: attackTicks, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
        animations: { idle: seqs.eggIdle, walk: seqs.eggIdle, run: seqs.eggIdle, attack: null, death: seqs.eggCrumble } },
    }));
    for (const egg of eggs) faceActorToward(egg, eggsFace);
    return [boss, ...eggs];
  }
  moveNpc(npc, context) {
    if (!npc.alive || this.outcome.phase !== "active") return [];
    if (npc.id === bossActorId) return this.moveBoss(npc, context);
    if (npc.id === this.ball?.id) return this.ball.step ? [{ npcId: npc.id, path: this.ball.step }] : [];
    const araxyte = this.araxytes.get(npc.id);
    if (!araxyte) return [];
    if (npc.combat.targetId === null && context.tick >= araxyte.hatchTick + araxyteTurnTicks) npc.combat.targetId = "player";
    if (context.tick < araxyte.wakeTick || araxyte.fuse !== null) return [];
    return this.pursuit(npc, context);
  }
  // The default pursuit, with the fight's own random draws (it steps out from under the player at random).
  pursuit(npc, context) {
    return getNpcPursuitMoves(npc, { ...context, random: this.random });
  }
  // OBS: an attack is decided, and leaves him, where he stands as the tick
  // begins, and he steps in the same tick (k1 218: magic at a player 2 tiles
  // away, from 50,25, and a step up to him); not with a cleave or the ball,
  // which drop his target. He steps only along the axis he is short on (k1
  // 218, 263 and 305 north, 335 west, where the default pursuit goes
  // diagonally), and enraged too until he is beside the player (k1 335).
  moveBoss(boss, context) {
    const player = context.world.getPlayer();
    this.turn = { attack: this.bossAttack(boss, player, context.tick), middle: middleOf(boss) };
    if (!this.spawned || !player?.alive) return [];
    if (boss.combat.targetId === null) {
      if (context.tick < this.targetTick) return [];
      boss.combat.targetId = "player";
    }
    if (this.turn.attack === "cleave" || (this.turn.attack === "special" && this.special === "ball")) return [];
    const [px, py] = player.position, [x, y] = boss.position;
    if (gapTo(player.position, boss.position, bossSize) === 0) return this.pursuit(boss, context);
    if (isNpcInAttackRange(boss, player, 1)) return [];
    const dx = px < x ? -1 : px > x + bossSize - 1 ? 1 : 0, dy = py < y ? -1 : py > y + bossSize - 1 ? 1 : 0;
    const isFree = createOccupancyStepCheck(context.world.occupancy);
    const step = [[x + dx, y + dy], [x + dx, y], [x, y + dy]].find((to) =>
      canFootprintStepInArena(boss.position, to, { width: bossSize, height: bossSize }) && isFree(boss.position, to, bossSize));
    return step ? [{ npcId: boss.id, path: [step] }] : [];
  }
  bossAttack(boss, player, tick) {
    if (!this.spawned || tick < this.nextAttackTick || !player?.alive || (!this.enraged && this.shouldEnrage(boss))) return null;
    const gap = gapTo(player.position, boss.position, bossSize);
    if (this.enraged) return gap <= cleaveReach ? "cleave" : gap <= distantReach ? "distant" : null;
    if (gap <= distantReach && (this.attacks + 1) % specialEvery === 0) return "special";
    if (gap > 0 && isNpcInAttackRange(boss, player, 1)) return "melee";
    if (gap > 1 && gap <= distantReach) return "distant";
    return null; // under him or out of his reach: he waits (inferred)
  }
  shouldEnrage(boss) {
    return boss.vitals.hp <= Math.floor(boss.vitals.maxHp * enrageThreshold);
  }
  dropTarget(boss, context, ticks) {
    boss.combat.targetId = null;
    this.targetTick = context.tick + ticks;
  }

  // --- each tick, before the NPCs ---------------------------------------
  resolveHazards(context) {
    this.tick = context.tick;
    this.context = context;
    const hits = [];
    const due = this.queue.filter((entry) => entry.tick <= context.tick);
    this.queue = this.queue.filter((entry) => entry.tick > context.tick);
    for (const entry of due) entry.run(context, hits);
    if (this.outcome.phase !== "active") return hits;
    this.cleaves = this.cleaves.filter((cleave) => cleave.lands >= context.tick);
    this.stepDrip(context);
    this.stepBall(context, hits);
    if (this.spawned && context.tick >= this.nextHatchTick) {
      this.nextHatchTick += hatchTicks;
      this.hatch(context);
    }
    return hits;
  }
  // --- each tick, after the NPCs ----------------------------------------
  completeNpcBand(context) {
    const hits = this.pendingPlayerHits;
    this.pendingPlayerHits = [];
    if (hits.length) emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [], mirrorbackRecoil: true });
    return hits;
  }
  // --- each tick, after the player -------------------------------------
  processPostTick(context) {
    const hits = [];
    // OBS: the acid hurts the player who ends a tick in it (k1 216, recorded on 217; k2 181, on 182).
    if (this.pools.has(key(context.playerPos)) && this.acidHitTick !== context.tick && context.world.getPlayer()?.alive) hits.push(this.poolHit(context.playerPos));
    this.playerTrail = [this.playerTrail[1] ?? [...context.playerPos], [...context.playerPos]];
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    return hits;
  }
  processNpcTick(npc, context) {
    const idle = { environmentalDamages: [] };
    if (this.outcome.phase !== "active") return idle;
    const araxyte = this.araxytes.get(npc.id);
    if (!npc.alive) {
      // OBS: a Mirrorback still bites on the tick of the hit that kills it, and the bite does nothing (k1 290, k2 83).
      if (araxyte?.type === "mirrorback") this.mirrorbackBite(npc, context);
      return idle;
    }
    if (npc.id === bossActorId) return this.bossTurn(npc, context);
    if (araxyte) return this.araxyteTurn(npc, araxyte, context);
    return idle;
  }

  // --- Araxxor ---------------------------------------------------------
  bossTurn(boss, context) {
    const idle = { environmentalDamages: [] };
    const tick = context.tick;
    if (!this.spawned) {
      this.spawned = true;
      this.spawnTick = tick;
      this.nextAttackTick = tick + firstAttackTicks;
      this.nextHatchTick = tick + firstHatchTicks;
      this.animate(context, "spawn");
      for (const egg of this.eggs) this.animate(context, "spawn", eggActorId(egg.index));
      boss.combat.nextActionTick = this.nextAttackTick;
      return idle;
    }
    if (!this.enraged && this.shouldEnrage(boss)) this.enrage(boss, context);
    const player = context.world.getPlayer();
    const { attack } = this.turn;
    if (!attack) return idle;
    if (!this.enraged) this.attacks++;
    let turn;
    if (attack === "cleave") turn = this.cleave(boss, player, context);
    else if (attack === "special") turn = this.specialAttack(boss, player, context);
    else if (attack === "melee") turn = this.melee(boss, player, context);
    else turn = this.distantAttack(boss, player, context);
    boss.combat.lastAttackTick = tick;
    this.nextAttackTick = tick + (this.enraged ? enragedAttackTicks : attackTicks);
    boss.combat.nextActionTick = this.nextAttackTick; // for the interface's attack timer
    return turn;
  }
  melee(boss, player, context) {
    const attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      // A stab (inferred); its accuracy rolled.
      plan: { formulaStyle: "melee_stab", damageType: "melee", attackKind: "melee_stab", maxHit: maxHits.melee, impactDelayTicks: 0, sourceDeathPolicy: "cancel-before-impact" },
    });
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "attack", kind: "araxxor_melee", impactDelayTicks: 0 });
    return { environmentalDamages: [], npcAttacks: attack ? [{ ...attack, prayerReduction: { type: "reduce", value: prayerLeaves.melee } }] : [] };
  }
  // WIKI: magic or ranged, whichever of the player's defence rolls is lower
  // (inferred: ranged when they are equal).
  distantStyle(player) {
    const stats = getPlayerFormulaStats(player);
    const prayers = getPrayerMultipliers(player.activePrayer, player.offensivePrayer);
    const ranged = getPlayerDefenceRoll(stats, "ranged", player.equipmentStats, prayers);
    const magic = getPlayerDefenceRoll(stats, "magic", player.equipmentStats, prayers);
    return magic < ranged ? "magic" : "range";
  }
  distantAttack(boss, player, context) {
    const style = this.distantStyle(player);
    const shape = style === "magic" ? projectiles.magic : projectiles.ranged;
    let attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      plan: { formulaStyle: style === "magic" ? "magic" : "ranged", damageType: style, attackKind: style === "magic" ? "magic" : "range_arrow",
        maxHit: maxHits[style], impactDelayTicks: distantHitTicks, sourceDeathPolicy: "cancel-before-impact" },
    });
    // OBS (tsps): the message with the shot, which then hits a 0 and drains nothing.
    if (style === "range" && attack?.accuracySucceeded && this.araneaNegates("range", attack.rolledDamage, player, context)) {
      attack = { ...attack, accuracySucceeded: false, rolledDamage: 0 };
      this.araneaMessage(context);
    }
    emitInfernoNpcAttack(context, {
      actor: boss, target: player, clipId: style === "magic" ? "magic" : "ranged", kind: "araxxor_" + style, impactDelayTicks: distantHitTicks,
      projectiles: [this.projectile(shape, this.turn.middle, buildActorVisualTarget(player), shape.end)],
    });
    if (style === "magic") {
      emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
        graphics: [{ spotAnimId: spots.magicImpact, target: buildActorVisualTarget(player), height: magicImpactHeight, delayCycles: shape.end }] });
    }
    return { environmentalDamages: [], npcAttacks: attack ? [{ ...attack, prayerReduction: { type: "reduce", value: prayerLeaves[style] } }] : [] };
  }
  araneaNegates(kind, damage, player, context) {
    if (!(damage > 0) || context.tick < this.araneaReady[kind] || getCanonicalEquipmentId(player.equipment.boots) !== araneaBoots) return false;
    this.araneaReady[kind] = context.tick + araneaTicks[kind];
    return true;
  }
  araneaMessage(context) {
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [{ text: araneaMessage }] });
  }
  projectile(shape, from, target, endCycles) {
    return {
      spotAnimId: shape.spotAnimId, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target,
      startDelayCycles: Math.min(shape.start, endCycles), endDelayCycles: endCycles,
      slope: shape.slope, startOffset: shape.startOffset, startHeight: shape.startHeight, endHeight: shape.endHeight,
    };
  }

  // --- the specials ----------------------------------------------------
  specialAttack(boss, player, context) {
    const idle = { environmentalDamages: [] };
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: this.special, kind: "araxxor_" + this.special, impactDelayTicks: 0 });
    if (this.special === "drip") this.dripAt(boss, player, context);
    else if (this.special === "spray") this.spray(boss, player, context);
    else this.throwBall(boss, player, context);
    return idle;
  }
  // The drip: a blob on the player, 4 ticks later he drips for 7 ticks, and
  // the tile he stood on (and ran through) the tick before gets a pool on each
  // of the 6 ticks after it lands (OBS).
  dripAt(boss, player, context) {
    emitInfernoVisual(context.tickEvents, { animations: [], graphics: [],
      projectiles: [this.projectile(projectiles.drip, this.turn.middle, buildActorVisualTarget(player), projectiles.drip.end)] });
    this.later(dripLandTicks, (ctx) => {
      const target = ctx.world.getPlayer();
      if (!target?.alive) return;
      // OBS: "Araxxor covers you in venom. It slowly drips off you and covers the floor."
      ctx.tickEvents.emit({ type: "game_message", kind: "game",
        segments: [{ text: "Araxxor covers you in venom. It slowly drips off you and covers the floor.", color: "#ff3045" }] });
      this.drip = { from: ctx.tick + 1, until: ctx.tick + dripPools, gfxUntil: ctx.tick + dripTicks - 1 };
      this.dripGraphic(ctx, { dripStarts: true });
    });
  }
  dripGraphic(context, cue = {}) {
    const player = context.world.getPlayer();
    if (player) emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.drip, target: buildActorVisualTarget(player), height: 0, delayCycles: 0 }], ...cue });
  }
  stepDrip(context) {
    const drip = this.drip;
    if (!drip) return;
    if (context.tick <= drip.gfxUntil && context.tick > drip.from - 1) this.dripGraphic(context);
    if (context.tick >= drip.from && context.tick <= drip.until) {
      const [before, last] = this.playerTrail;
      const tiles = [last ?? context.playerPos];
      // A run of two tiles: the one between too.
      if (before && last && chebyshev(before, last) === 2) tiles.unshift([before[0] + Math.sign(last[0] - before[0]), before[1] + Math.sign(last[1] - before[1])]);
      for (const tile of tiles) this.placePool(tile);
    }
    if (context.tick >= Math.max(drip.until, drip.gfxUntil)) this.drip = null;
  }
  // The spray: nine blobs on tiles about the player, away from Araxxor (WIKI:
  // "in the player's general direction"; where exactly is RSPSApp's choice,
  // inferred: up to 3 tiles on past him and 1 back, 3 to either side).
  spray(boss, player, context) {
    const { middle } = this.turn;
    const [px, py] = player.position;
    const dx = Math.sign(px - middle[0]), dy = Math.sign(py - middle[1]);
    const tiles = new Map();
    for (let n = 0; n < sprayBlobs; n++) {
      const along = Math.floor(this.random() * 5) - 1;
      const across = Math.floor(this.random() * 7) - 3;
      const tile = dx === 0 && dy === 0
        ? [px + Math.floor(this.random() * 7) - 3, py + Math.floor(this.random() * 7) - 3]
        : [px + dx * along - dy * across, py + dy * along + dx * across];
      if (this.isAcidTile(tile)) tiles.set(key(tile), tile);
    }
    this.throwBlobs(context, middle, [...tiles.values()], projectiles.spray);
  }
  // Blobs from a tile, each landing by its own distance: its splash (OBS: on
  // the cycle it lands, 100 to 110 after the throw in k2 41, 83 and 125), then
  // the pool, which hurts a player on that tile as it lands (WIKI: "the
  // splatters will damage before the pool forms").
  throwBlobs(context, from, tiles, shape, cue = {}) {
    const flights = [], splats = [];
    for (const tile of tiles) {
      const end = shape.base + 10 * chebyshev(from, tile);
      flights.push(this.projectile(shape, from, tileTarget(tile), end));
      splats.push({ spotAnimId: spots.splat, target: tileTarget(tile), height: 0, delayCycles: end });
      this.later(landingTicks(end), (ctx, hits) => {
        if (ctx.world.getPlayer()?.alive && key(ctx.playerPos) === key(tile)) {
          hits.push(this.poolHit(ctx.playerPos));
          this.acidHitTick = ctx.tick;
        }
        this.placePool(tile);
      });
    }
    if (flights.length) emitInfernoVisual(context.tickEvents, { animations: [], projectiles: flights, graphics: splats, ...cue });
  }
  // The acid ball: he turns to the nearest of eight directions (OBS: facing
  // 1280 at k2 36 and 78, 1024 at 120), and 2 ticks after the throw it is at
  // his edge there and hurts a player under it. Then it rolls on 2 tiles a
  // tick, leaving acid on its middle and the tile behind, until it reaches a
  // wall; it throws six blobs, bursts and goes.
  throwBall(boss, player, context) {
    const bossMiddle = this.turn.middle;
    const ox = player.position[0] - bossMiddle[0], oy = player.position[1] - bossMiddle[1];
    const eighth = (Math.round(Math.atan2(oy, ox) / (Math.PI / 4)) * Math.PI) / 4;
    // North for a player on his middle (inferred).
    const direction = ox === 0 && oy === 0 ? [0, 1] : [Math.round(Math.cos(eighth)) + 0, Math.round(Math.sin(eighth)) + 0];
    const landing = [bossMiddle[0] + direction[0] * ballLandDistance, bossMiddle[1] + direction[1] * ballLandDistance];
    faceActorToward(boss, { position: [boss.position[0] + direction[0], boss.position[1] + direction[1]], size: bossSize });
    this.dropTarget(boss, context, ballTargetTicks);
    this.later(ballLandTicks, (ctx, hits) => {
      if (this.ball) return; // one at a time (inferred)
      const id = ballActorId(++this.balls);
      const position = [landing[0] - 1, landing[1] - 1];
      ctx.spawnNpc({
        id, kind: "npc", role: "npc", npcTypeId: ids.ball, archetypeId: "acid-ball", size: ballSize, alive: true,
        position, previousPosition: [...position], facing: boss.facing, history: new Map(),
        untargetable: true, blocksNpcMovement: false, passThruNpcs: true,
        vitals: { hp: 1, maxHp: 1 },
        combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
          animations: { idle: seqs.ballRoll, walk: seqs.ballRoll, run: seqs.ballRoll, attack: null, death: null } },
      });
      this.ball = { id, middle: [...landing], direction, rolled: 0, hit: false, step: null, burstTick: null, landedTick: ctx.tick };
      this.animate(ctx, "roll", id);
      this.ballHit(ctx, hits);
    });
  }
  ballHit(context, hits) {
    const ball = this.ball;
    if (ball.hit || !context.world.getPlayer()?.alive || chebyshev(ball.middle, context.playerPos) > 1) return;
    ball.hit = true;
    hits.push({ source: "Araxxor's acid ball", attackType: "typeless", baseDamage: [...ballDamage], playerPosition: [...context.playerPos], hitsplatType: "venom", applyPoison: venom });
  }
  stepBall(context, hits) {
    const ball = this.ball;
    if (!ball) return;
    ball.step = null;
    if (ball.burstTick !== null) {
      if (context.tick === ball.burstTick) this.animate(context, "burst", ball.id);
      else if (context.tick > ball.burstTick) {
        context.despawnNpc(ball.id);
        this.ball = null;
      }
      return;
    }
    if (context.tick === ball.landedTick) return;
    const [mx, my] = ball.middle;
    const [dx, dy] = ball.direction;
    this.placePool([mx, my]);
    this.placePool([mx - dx, my - dy]);
    // 2 tiles, or what is left of its roll; it stops short of the wall (inferred: before a middle off the edge of the floor).
    let steps = 0;
    while (steps < Math.min(2, ballRollTiles - ball.rolled) && this.isAcidTile([mx + dx * (steps + 1), my + dy * (steps + 1)])) steps++;
    if (steps > 0) {
      ball.step = Array.from({ length: steps }, (_, n) => [mx + dx * (n + 1) - 1, my + dy * (n + 1) - 1]);
      ball.middle = [mx + dx * steps, my + dy * steps];
      ball.rolled += steps;
      this.animate(context, "roll", ball.id);
    }
    if (steps < 2) {
      // OBS: blobs from where it set off this tick, onto tiles without acid.
      const tiles = new Map();
      for (let n = 0; n < burstBlobs; n++) {
        const tile = [mx + Math.floor(this.random() * (2 * burstSpread + 1)) - burstSpread, my + Math.floor(this.random() * (2 * burstSpread + 1)) - burstSpread];
        if (this.isAcidTile(tile) && !this.pools.has(key(tile))) tiles.set(key(tile), tile);
      }
      this.throwBlobs(context, [mx, my], [...tiles.values()], projectiles.burst, { ballBurst: true });
      ball.burstTick = context.tick + 1;
    }
    // WIKI: the ball's 3 x 3 hurts as it rolls too (inferred: once a ball).
    this.ballHit(context, hits);
  }

  // --- the enrage and the cleave ---------------------------------------
  enrage(boss, context) {
    this.enraged = true;
    // TABLE "Enraged" (WIKI: Defence +35, Magic +28, Ranged +31); what has
    // been drained stays drained (WIKI): the drains are kept apart.
    boss.formulaStats = { ...boss.formulaStats, levels: { ...tableStats(ids.boss, "Enraged").levels } };
    boss.defenceDrainFloor = boss.formulaStats.levels.defence - maxDefenceDrain;
    boss.combat.attackSpeed = enragedAttackTicks;
    boss.combat.attackRange = cleaveReach; // WIKI: he still closes the gap
    this.nextAttackTick = context.tick + enrageFirstAttackTicks;
    boss.combat.nextActionTick = this.nextAttackTick;
    this.animate(context, "enrage");
    this.later(enrageBodyTicks, (ctx) => this.outcome.phase === "active" && this.animate(ctx, "enraged"));
  }
  // A line of three tiles through the player's, across the blow (OBS: a
  // player north or south of his middle gets an east-west line, k1 320 to 328,
  // 348, 352, k2 149 to 157, east or west a north-south one, k1 336 to 344, k2
  // 169; equal, east-west, k2 161).
  cleaveLine(boss, tile) {
    const middle = middleOf(boss);
    const dx = tile[0] - middle[0], dy = tile[1] - middle[1];
    return Math.abs(dx) > Math.abs(dy)
      ? [[tile[0], tile[1] - 1], [...tile], [tile[0], tile[1] + 1]]
      : [[tile[0] - 1, tile[1]], [...tile], [tile[0] + 1, tile[1]]];
  }
  cleave(boss, player, context) {
    const tile = [...player.position];
    const gap = gapTo(tile, boss.position, bossSize);
    const under = gap === 0;
    const [x, y] = boss.position;
    // Off his corner, and not beside it (OBS k1 332: the player at 45,32, he at 47,25 to 53,31).
    const offCorner = gap > 1 && (tile[0] < x || tile[0] > x + bossSize - 1) && (tile[1] < y || tile[1] > y + bossSize - 1);
    const line = this.cleaveLine(boss, tile);
    this.dropTarget(boss, context, cleaveTargetTicks);
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "cleave", kind: "araxxor_cleave", impactDelayTicks: cleaveHitTicks });
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: "Skree!", overheadCycle: 3 });
    // Rolled as his melee (inferred); WIKI: up to his melee max.
    const attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", maxHit: maxHits.melee, impactDelayTicks: cleaveHitTicks, sourceDeathPolicy: "cancel-before-impact" },
    });
    const damage = attack?.accuracySucceeded ? attack.rolledDamage : 0;
    this.cleaves.push({ tiles: line.map((t) => [...t]), lands: context.tick + cleavePoolTicks });
    this.later(cleaveHitTicks, (ctx, hits) => {
      if (this.outcome.phase !== "active") return;
      // OBS: the 1 x 3 still hurts when he cleaves a player under him.
      const target = ctx.world.getPlayer();
      if (!target?.alive || !line.some((t) => key(t) === key(ctx.playerPos))) return;
      // OBS (tsps): the message 2 ticks after the swing and no hit; the acid lands all the same.
      if (this.araneaNegates("cleave", damage, target, ctx)) this.later(1, (next) => this.araneaMessage(next));
      else hits.push({ source: "Araxxor's cleave", attackType: "melee", baseDamage: damage, playerPosition: [...ctx.playerPos], prayerReduction: { type: "reduce", value: prayerLeaves.cleave } });
    });
    // WIKI, OBS: a player under him makes him cut himself.
    if (under) this.later(cleaveCutTicks, (ctx) => {
      if (this.outcome.phase === "active") this.hitNpc(ctx, bossActorId, bossActorId, selfCut[0] + Math.floor(this.random() * (selfCut[1] - selfCut[0] + 1)));
    });
    // OBS: the acid 2 ticks after the swing; one pool only, on the player's
    // tile, from under him (k2 161, 165, 173, 177, 181) and off his corner (k1
    // 332). WIKI has two more beside a corner, "north and east of the player"
    // to the south-west: no log has that.
    this.later(cleavePoolTicks, () => {
      if (this.outcome.phase !== "active") return;
      for (const t of under || offCorner ? [tile] : line) this.placePool(t);
    });
    return { environmentalDamages: [] };
  }

  // --- the eggs and the araxytes ---------------------------------------
  hatch(context) {
    const next = this.eggs.find((egg) => egg.state === "egg");
    if (!next) return;
    const egg = context.world.getNpc(eggActorId(next.index));
    if (!egg?.alive) {
      next.state = "destroyed";
      return this.hatch(context); // WIKI: the next in turn hatches instead
    }
    context.despawnNpc(egg.id);
    const left = araxyteHitpoints - (egg.vitals.maxHp - egg.vitals.hp); // WIKI: the egg's damage carries over
    if (left <= 0) {
      // WIKI: an egg dealt more than the araxyte's hitpoints does not hatch, and its turn is lost.
      next.state = "spoiled";
      this.updateArena();
      this.animate(context, "crumble", egg.id);
      return;
    }
    next.state = "hatched";
    this.updateArena();
    const id = araxyteActorId(next.index);
    const type = next.type;
    const position = [...eggTiles[next.index]];
    context.spawnNpc({
      id, kind: "npc", role: "minion", npcTypeId: ids.araxytes[type], archetypeId: "araxyte-" + type, size: araxyteSize, alive: true,
      position, previousPosition: [...position], facing: egg.facing, history: new Map(), passThruNpcs: true,
      ...(type === "mirrorback" ? { deathPolicy: "queued" } : {}), // OBS: its death animation the tick after the killing hit (k1 291, k2 84)
      vitals: { hp: left, maxHp: araxyteHitpoints }, formulaStats: tableStats(ids.araxytes[type]),
      combat: { attackSpeed: attackTicks, attackRange: type === "acidic" ? acidicHoldRange : 1, attackStyle: type === "acidic" ? "range" : "melee",
        nextActionTick: context.tick + araxyteWakeTicks, targetId: null, lastAttackTick: null,
        animations: { idle: seqs.araxyteIdle, walk: seqs.araxyteWalk, run: seqs.araxyteWalk, attack: null, death: type === "mirrorback" ? seqs.mirrorbackDeath : seqs.explode } },
    });
    this.araxytes.set(id, { type, hatchTick: context.tick, wakeTick: context.tick + araxyteWakeTicks, fuse: null });
    emitInfernoVisual(context.tickEvents, { animations: [{ actorId: id, clipId: "hatch", delayCycles: 0 }], projectiles: [],
      graphics: [{ spotAnimId: spots.hatch[type], target: { kind: "actor", actorId: id, size: araxyteSize, position }, height: 0, delayCycles: 0 }] });
  }
  araxyteTurn(npc, araxyte, context) {
    const idle = { environmentalDamages: [] };
    const tick = context.tick;
    const player = context.world.getPlayer();
    if (tick < araxyte.wakeTick || !player?.alive || araxyte.fuse !== null) return idle;
    if (araxyte.type === "ruptura") {
      // OBS: it reaches the player, and blows up 2 ticks later wherever he is.
      if (isNpcInAttackRange(npc, player, 1)) this.lightFuse(npc, araxyte, context);
      return idle;
    }
    if (tick < npc.combat.nextActionTick) return idle;
    if (araxyte.type === "acidic") {
      if (!isNpcInAttackRange(npc, player, acidicHoldRange)) return idle;
      const gap = gapTo(player.position, npc.position, araxyteSize);
      const end = projectiles.acidic.base + 10 * gap;
      // OBS: recorded on the tick its spit arrives, so many whole ticks after
      // it: 1 beside it (k2 174, 180), 2 from 3 tiles (k1 350, k2 168), 3 from
      // 6 to 8 (45 spits). From 2, 4 and 5 tiles inferred from its flight.
      const impactDelayTicks = Math.floor(end / cyclesPerTick) - 1;
      const attack = rollNpcAttack({
        attacker: npc, target: player, random: this.random,
        plan: { formulaStyle: "ranged", damageType: "range", attackKind: "range_arrow", maxHit: maxHits.acidic, impactDelayTicks, sourceDeathPolicy: "cancel-before-impact" },
      });
      emitInfernoNpcAttack(context, { actor: npc, target: player, clipId: "attack", kind: "araxyte_acidic", impactDelayTicks,
        projectiles: [this.projectile(projectiles.acidic, middleOf(npc), buildActorVisualTarget(player), end)] });
      npc.combat.lastAttackTick = tick;
      npc.combat.nextActionTick = tick + attackTicks;
      return { environmentalDamages: [], npcAttacks: attack ? [attack] : [] };
    }
    // The Mirrorback: its bite (a stab, inferred; TABLE max).
    if (!this.mirrorbackBite(npc, context)) return idle;
    const attack = rollNpcAttack({
      attacker: npc, target: player, random: this.random,
      plan: { formulaStyle: "melee_stab", damageType: "melee", attackKind: "melee_stab", impactDelayTicks: 0, sourceDeathPolicy: "cancel-before-impact" },
    });
    return { environmentalDamages: [], npcAttacks: attack ? [attack] : [] };
  }
  // Whether the Mirrorback bites, every 6 ticks (OBS k2 77 and 83; OBS (tsps)).
  mirrorbackBite(npc, context) {
    const player = context.world.getPlayer();
    if (context.tick < npc.combat.nextActionTick || !player?.alive || !isNpcInAttackRange(npc, player, 1)) return false;
    emitInfernoNpcAttack(context, { actor: npc, target: player, clipId: "attack", kind: "araxyte_mirrorback", impactDelayTicks: 0 });
    npc.combat.lastAttackTick = context.tick;
    npc.combat.nextActionTick = context.tick + attackTicks;
    return true;
  }
  lightFuse(npc, araxyte, context) {
    araxyte.fuse = context.tick;
    this.later(rupturaFuseTicks, (ctx) => {
      const ruptura = ctx.world.getNpc(npc.id);
      if (!ruptura?.alive || this.outcome.phase !== "active") return;
      ruptura.untargetable = true;
      const share = ruptura.vitals.hp / ruptura.vitals.maxHp; // WIKI: "proportional to its health"
      emitInfernoVisual(ctx.tickEvents, { animations: [{ actorId: npc.id, clipId: "explode", delayCycles: 0 }], projectiles: [],
        graphics: [{ spotAnimId: spots.rupturaExplosion, target: buildActorVisualTarget(ruptura), height: 0, delayCycles: 0 }] });
      this.later(rupturaPlayerBlastTicks, (later, hits) => {
        if (this.outcome.phase !== "active") return;
        const playerGap = gapTo(later.playerPos, ruptura.position, araxyteSize);
        if (later.world.getPlayer()?.alive && playerGap < rupturaOnPlayer.length)
          hits.push({ source: "Ruptura Araxyte's explosion", attackType: "typeless", baseDamage: Math.floor(rupturaOnPlayer[playerGap] * share), playerPosition: [...later.playerPos] });
      });
      this.later(rupturaNpcBlastTicks, (later) => {
        if (this.outcome.phase !== "active") return;
        for (const other of later.world.getNpcs()) {
          if (other.id === npc.id || !other.alive || other.id === this.ball?.id) continue;
          // Between footprints: 0 when they overlap.
          const gap = Math.max(
            ruptura.position[0] - (other.position[0] + other.size - 1), other.position[0] - (ruptura.position[0] + araxyteSize - 1),
            ruptura.position[1] - (other.position[1] + other.size - 1), other.position[1] - (ruptura.position[1] + araxyteSize - 1), 0);
          if (gap < rupturaOnNpc.length) this.hitNpc(later, npc.id, other.id, Math.floor(rupturaOnNpc[gap] * share));
        }
      });
      this.later(rupturaGoneTicks, (later) => {
        if (later.world.getNpc(npc.id)) later.despawnNpc(npc.id);
        this.araxytes.delete(npc.id);
      });
    });
  }
  // The Acidic's death: it bursts into 13 blobs within 4 tiles (OBS (tsps)).
  acidicBurst(npc, context) {
    const middle = middleOf(npc);
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [],
      graphics: [{ spotAnimId: spots.acidicDeath, target: buildActorVisualTarget(npc), height: 0, delayCycles: 0 }] });
    const tiles = new Map();
    for (let n = 0; n < acidicDeathBlobs; n++) {
      const tile = [middle[0] + Math.floor(this.random() * (2 * acidicDeathSpread + 1)) - acidicDeathSpread,
        middle[1] + Math.floor(this.random() * (2 * acidicDeathSpread + 1)) - acidicDeathSpread];
      if (this.isAcidTile(tile)) tiles.set(key(tile), tile);
    }
    this.throwBlobs(context, middle, [...tiles.values()], projectiles.acidicDeath);
  }
  sharingMirrorback(world) {
    for (const [id, araxyte] of this.araxytes) {
      if (araxyte.type !== "mirrorback" || world.tick < araxyte.hatchTick + mirrorShareTicks) continue;
      const npc = world.getNpc(id);
      if (npc?.alive) return npc;
    }
    return null;
  }

  // --- the acid --------------------------------------------------------
  placePool(tile) {
    if (!this.isAcidTile(tile) || this.pools.has(key(tile))) return;
    this.pools.set(key(tile), [...tile]);
  }
  poolHit(tile) {
    return { source: "Acid pool", attackType: "typeless", baseDamage: [...poolDamage], playerPosition: [...tile], hitsplatType: "venom", applyPoison: venom };
  }

  // --- the rest --------------------------------------------------------
  later(ticks, run) {
    this.queue.push({ tick: this.tick + ticks, run });
  }
  animate(context, clipId, actorId = bossActorId) {
    emitInfernoVisual(context.tickEvents, { animations: [{ actorId, clipId, delayCycles: 0 }], projectiles: [], graphics: [] });
  }
  hitNpc(context, attackerId, targetId, damage) {
    if (!context.world.getNpc(attackerId) || !context.world.getNpc(targetId)?.alive) return;
    context.queueNpcHit({ attackerId, targetId, style: "typeless", attackKind: "typeless", rolledDamage: damage, accuracySucceeded: true, impactDelayTicks: 0, sourceDeathPolicy: "persist" });
  }
  // A hit of the player's as it lands on one of the fight's NPCs. What the
  // Mirrorback takes of it lands with it (OBS: 8 of 8, k1 276 to k2 75), on its
  // turn after his; what it throws back is on the player that tick (OBS:
  // recorded on the next, k1 277 to k2 84).
  playerHit(damage, attack, target, player, world) {
    if (!target?.alive || damage <= 0) return damage;
    const recoils = (dealt) => this.pendingPlayerHits.push({ source: "Mirrorback Araxyte's reflection", attackType: "typeless", baseDamage: dealt, playerPosition: [...player.position] });
    if (target.id === bossActorId) {
      const mirrorback = this.sharingMirrorback(world);
      const share = Math.floor(damage / mirrorShare);
      if (!mirrorback || share <= 0) return damage;
      this.hitNpc(this.context, mirrorback.id, mirrorback.id, share);
      recoils(Math.floor(share / mirrorRecoil));
      return damage - share;
    }
    // WIKI, OBS: a melee hit on a Mirrorback from beside it throws half back
    // (a halberd from a tile away does not).
    if (this.araxytes.get(target.id)?.type === "mirrorback" && attack?.style === "melee" && gapTo(player.position, target.position, araxyteSize) <= 1)
      recoils(Math.floor(Math.min(damage, target.vitals.hp) / mirrorMeleeRecoil));
    return damage;
  }
  getEngineRules() {
    return {
      playerDamageOnNpc: (damage, { attacker, target, attack }) => this.playerHit(damage, attack, target, attacker, this.context.world),
      // His ranged drains Defence and his magic Prayer, 9% of what is left,
      // rounded down, when the hit does damage (WIKI, OBS (tsps)).
      onPlayerDamageTaken: (hit, rules) => {
        if (hit.sourceNpcTypeId !== ids.boss || !(hit.effectiveDamage > 0)) return undefined;
        const player = rules.player;
        if (hit.attackType === "range") return { playerStatDrains: { defence: Math.floor(player.stats.defence.current * drainShare) } };
        if (hit.attackType === "magic") return { prayerPointsDelta: -Math.floor(player.prayerState.points * drainShare) };
        return undefined;
      },
    };
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    const araxyte = this.araxytes.get(defeat.npcId);
    if (araxyte) {
      const npc = context.world.getNpc(defeat.npcId);
      if (araxyte.type === "acidic" && this.outcome.phase === "active") this.acidicBurst(npc, context);
      if (araxyte.type === "mirrorback") {
        this.deathAnimationTick(npc, defeat);
        this.later(mirrorbackGoneTicks, (ctx) => {
          if (ctx.world.getNpc(defeat.npcId)) ctx.despawnNpc(defeat.npcId);
        });
      }
      this.araxytes.delete(defeat.npcId);
      return;
    }
    const egg = this.eggs.find((e) => eggActorId(e.index) === defeat.npcId);
    if (egg) {
      if (egg.state === "egg") egg.state = "destroyed";
      this.updateArena();
      return;
    }
    if (defeat.npcId !== bossActorId) return;
    this.queue = [];
    this.drip = null;
    this.cleaves = [];
    this.pendingPlayerHits = [];
    // OBS: the acid goes with the killing hit (k1 356, k2 183).
    this.pools.clear();
    if (this.ball) {
      context.despawnNpc(this.ball.id);
      this.ball = null;
    }
    // Ticks from now to his death animation.
    const wait = this.deathAnimationTick(context.world.getNpc(bossActorId), defeat) - defeat.tick;
    const left = [...this.araxytes];
    const araxytes = context.world.getNpcs().map((npc) => npc.id).filter((id) => id.startsWith("araxyte-"));
    const eggs = this.eggs.filter((e) => e.state === "egg").map((e) => eggActorId(e.index));
    for (const [id] of left) {
      const npc = context.world.getNpc(id);
      if (!npc) continue;
      npc.untargetable = true;
      context.world.removePendingHitsFromSource?.(id);
    }
    // OBS: the oldest Acidic plays none of it and goes with the others (k1
    // 357, k2 183); why does not show, so all of them do here.
    const die = (ctx) => {
      for (const [id, { type }] of left) if (ctx.world.getNpc(id)) this.animate(ctx, type === "mirrorback" ? "death" : "explode", id);
    };
    if (wait > 0) this.later(wait, die);
    else die(context);
    this.later(wait + eggCrumbleTicks, (ctx) => {
      for (const id of eggs) if (ctx.world.getNpc(id)) this.animate(ctx, "crumble", id);
    });
    const despawn = (ids) => (ctx) => {
      for (const id of ids) if (ctx.world.getNpc(id)) ctx.despawnNpc(id);
    };
    this.later(wait + araxytesGoneTicks, despawn(araxytes));
    this.later(wait + eggsGoneTicks, despawn(eggs));
    this.araxytes.clear();
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + wait + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  // OBS: the tick after the killing hit, for one that stepped the tick before
  // it too (the Mirrorback of k1, 289 to 291); the engine waits 3 ticks from a
  // step. (Killed by his own cut he plays it on that tick, k2 183: not done.)
  deathAnimationTick(npc, defeat) {
    if (!npc?.death) return defeat.tick;
    delete npc.lastStepTick;
    npc.deathAnimationTick = npc.death.processTick;
    return npc.deathAnimationTick;
  }
  getOutcome() {
    return this.outcome;
  }
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        eggs: this.colour, // the colour of the first egg
        special: this.special,
        attacks: this.attacks,
        enraged: this.enraged,
        nextHatchTick: this.spawned ? this.nextHatchTick : null,
        pools: [...this.pools.values()].map((tile) => [...tile]),
        dripping: this.drip !== null,
        ball: this.ball && { middle: [...this.ball.middle] },
        cleaves: this.cleaves.map(({ tiles, lands }) => ({ tiles: tiles.map((t) => [...t]), lands })),
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel(npcId) {
    const araxyte = this.araxytes.get(npcId);
    if (araxyte) return { mirrorback: "Mirrorback Araxyte", acidic: "Acidic Araxyte", ruptura: "Ruptura Araxyte" }[araxyte.type];
    return "Araxxor";
  }
}

export const araxxorDefinition = {
  kind: araxxorKind,
  factory: () => new AraxxorEncounter(),
  descriptor: {
    kind: araxxorKind,
    displayName: "Araxxor",
    description: "The Morytania Spider Cave: his three attack styles, the acid of his specials, nine eggs and their araxytes, and the cleave of his enrage.",
    mapSquare: araxxorMapSquare,
    mapSquareOffsets: araxxorMapSquareOffsets,
    playerStart,
    loadsMapLocs: true,
    isWorkInProgress: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { eyebrow: "Triumphant", title: "VICTORY", narrative: "ARAXXOR DEFEATED", accent: "gold" },
    loadouts: araxxorLoadouts,
    // Each number on its egg's south-west tile.
    tileMarkerPresets: [{
      id: "araxxor_eggs", name: "Egg order", description: "The nine eggs in the order they hatch: the south-easternmost first, then clockwise",
      link: "https://oldschool.runescape.wiki/w/Araxxor/Strategies", markers: eggTiles.map(([x, y], index) => [x, y, "#CCFFAB00", String(index + 1)]),
    }],
  },
  controls: {
    defaultMechanicsConfig: { [patternKey]: "random" },
    mechanicsToggles: [{ key: patternKey, label: "Eggs", setup: true, choices: patternChoices }],
    debugActions: [],
  },
};
// How the registry finds it (encounters/registry.js), and where it stands in the encounter picker.
export { araxxorDefinition as definition };
export const order = 75;
