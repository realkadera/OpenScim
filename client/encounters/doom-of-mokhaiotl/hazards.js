// Everything in the room besides the Doom himself: thrown rocks and the
// rocks they leave, larvae, volatile earth and the earthen shield, acid
// blood. Each piece keeps its own state and is handed the encounter (`doom`)
// for the delve's rules, the random generator and the timer (`doom.later`).
import { CollisionFlag } from "../../engine/collision.js";
import { isArenaTileWalkable } from "../../engine/arena.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { buildActorVisualTarget, healNpc } from "../shared/npcHelpers.js";
import { emitInfernoVisual } from "../inferno/events.js";
import {
  npcTypeIds, seqIds, spotAnims, floor, earthPool, earthPoolAtStart, bossSize, bossStart,
  debrisMaxHit, larvaBlastMaxHit, acidDamage, shockwaveDamage,
} from "./delves.js";
import { larvaTrackerKeys, larvaTrackerSetting } from "./larvaTracker.js";

const key = ([x, y]) => x + "," + y;
const unkey = (text) => text.split(",").map(Number);
const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const onFloor = ([x, y]) => x >= floor.minX && x <= floor.maxX && y >= floor.minY && y <= floor.maxY;
const tileTarget = (position) => ({ kind: "tile", position: [...position] });
// On the floor: drawn over the terrain (onGround), or a shadow or a marker all but vanishes into it.
const graphic = (spotAnimId, position, delayCycles = 0, height = 0) => ({ spotAnimId, target: tileTarget(position), height, delayCycles, ...(height === 0 ? { onGround: true } : {}) });
export const inFootprint = (actor, [x, y]) =>
  x >= actor.position[0] && x < actor.position[0] + actor.size && y >= actor.position[1] && y < actor.position[1] + actor.size;
export const bossCentre = (boss) => [boss.position[0] + (bossSize >> 1), boss.position[1] + (bossSize >> 1)];
const projectile = (spotAnimId, from, to, startDelayCycles, endDelayCycles, startHeight, endHeight, slope = 0) => ({
  spotAnimId,
  sourcePosition: [from[0] + 0.5, from[1] + 0.5],
  target: tileTarget(to),
  startDelayCycles,
  endDelayCycles,
  slope,
  startOffset: 0,
  startHeight,
  endHeight,
});

// An NPC of the room that is not in the monster table: stats of its own.
// The player's hits on larvae and volatile earth all land (OBS, 18 recorded
// runs: none of about 1,000 hits of the style they take missed; every one of
// 228 on volatile earth hit; wiki: the earth takes a player's maximum hit).
function ownFormulaStats({ defence = 1, magic = 1 } = {}) {
  return {
    alwaysAccuratePlayerHit: true,
    burnImmunity: null, freezeResistance: 0, poisonResistance: 100,
    attributes: ["demon"],
    levels: { attack: 1, strength: 1, defence, ranged: 1, magic },
    offensive: { atk: 0, ranged: 0, magic: 0, str: 0, rangedStr: 0, magicStr: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0, magic: 0 },
  };
}
function roomNpc(definition, { id, npcTypeId, size = 1, position, hp, tick, untargetable = false, overheadPrayers }, state) {
  return definition.createActor(
    {
      id, kind: "npc", role: "minion", npcTypeId, archetypeId: id.replace(/-\d+$/, ""), size, alive: true,
      position: [...position], previousPosition: [...position], facing: 0, history: new Map(),
      vitals: { hp, maxHp: hp }, formulaStats: ownFormulaStats(), spawnTick: tick,
      ...(untargetable ? { untargetable: true } : {}),
      ...(overheadPrayers ? { overheadPrayers } : {}),
      blocksNpcMovement: false,
      combat: { attackSpeed: 4, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
        animations: { idle: null, walk: null, run: null, attack: null, death: null } },
    },
    state,
  );
}
function animate(context, actorId, clipId, graphics = [], projectiles = []) {
  emitInfernoVisual(context.tickEvents, { animations: actorId ? [{ actorId, clipId, delayCycles: 0 }] : [], projectiles, graphics });
}

// Killed by a punish (within a tick of it), seven drops of holy water fall
// from above his centre, one a tick, on tiles 2 to 4 from it, each with a
// shadow first and a splash (captured: 192, 1446, 68). The player gets 25%
// special energy at once, then 4 hitpoints and about 3 prayer points as each
// drop lands (captured: +28 and +19 to 20 over the seven); each landing
// clears acid in a 3x3 (wiki).
const holyWaterPrayer = 20;
export function holyWater(doom, context, boss) {
  const player = context.world.getPlayer();
  player.specialAttack.energy = Math.min(100, player.specialAttack.energy + 25);
  // Where he died: a burrow may have moved him.
  const centre = bossCentre(boss);
  const tiles = [];
  for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) >= 2) tiles.push([centre[0] + dx, centre[1] + dy]);
  const graphics = [];
  const projectiles = [];
  for (let drop = 0; drop < 7; drop++) {
    const [tile] = tiles.splice(Math.floor(doom.random() * tiles.length), 1);
    projectiles.push(projectile(spotAnims.holyWater, centre, tile, 0, 30 * (drop + 1), 600, 0, 10));
    graphics.push(graphic(spotAnims.holyWaterShadow, tile, 30 * drop), graphic(spotAnims.holyWaterSplash, tile, 30 * (drop + 1)));
    const prayer = Math.floor(((drop + 1) * holyWaterPrayer) / 7) - Math.floor((drop * holyWaterPrayer) / 7);
    doom.later(drop + 1, (ctx) => {
      const you = ctx.world.getPlayer();
      if (!you.alive) return;
      you.vitals.hp = Math.min(you.vitals.maxHp, you.vitals.hp + 4);
      you.prayerState.points = Math.min(you.prayerState.maxPoints, you.prayerState.points + prayer);
      doom.acid.clearAround(tile);
    });
  }
  animate(context, null, null, graphics, projectiles);
}

// --- rocks ------------------------------------------------------------------

// A thrown rock lands beside the Doom, towards the player, and bursts into
// pieces: one on the player's tile, the rest within four tiles. The player's
// protection prayers go off. Three ticks later a rock stands on the marked
// tile (a player there is pushed aside), a player on any piece is hit for up
// to 21, and the rock's orbs leave from the pieces, landing a tick apart,
// alternating styles (captured; the wiki agrees on what, not when).
// At delve 8 the two rocks leave together for the same tile, the second
// flying 3 ticks longer, so it bursts 3 ticks after the first (OBS: 158 of
// 158 double throws, cycles 60-180 and 60-270).
export class Rocks {
  standing = new Set();
  orbsLandAt = 0;
  collision = null; // set by adoptCollision
  constructor(doom) {
    this.doom = doom;
  }
  reset() {
    for (const tile of this.standing) this.collision?.unflag(...unkey(tile), CollisionFlag.OBJECT);
    this.standing.clear();
    this.orbsLandAt = 0;
  }
  // The arena's collision, from the encounter's refineArenaConfig. The arena is
  // applied anew during a fight too (a Take Over), each time a fresh copy: the
  // rocks that stand block there as well.
  adoptCollision(map) {
    this.collision = map;
    for (const tile of this.standing) map.flag(...unkey(tile), CollisionFlag.OBJECT);
  }
  has(tile) {
    return this.standing.has(key(tile));
  }
  throw(context) {
    const doom = this.doom;
    const style = doom.random() < 0.5 ? "range" : "magic";
    const boss = doom.boss(context.world);
    if (!boss?.alive) return;
    const at = this.burstTile(boss, context.world.getPlayer().position);
    const flights = [doom.rules.rockFlightCycles, doom.rules.secondRockFlightCycles].slice(0, doom.rules.rocks);
    animate(context, boss.id, "rockThrow", [], flights.map((end) => projectile(spotAnims.rockLaunch[style], bossCentre(boss), at, 60, end, 340, 500, 50)));
    // Its orbs leave as it lands (3 ticks after the burst), the last landing
    // this many ticks later: the boss's next orb waits on it (orbHold).
    const lastOrb = Math.ceil((doom.rules.rockOrbFirstCycles + 30 * (doom.rules.rockOrbs - 1)) / 30);
    flights.forEach((end, index) => {
      const burstsIn = doom.rules.rockBurstTicks + (end - flights[0]) / 30;
      this.orbsLandAt = Math.max(this.orbsLandAt, context.tick + burstsIn + 3 + lastOrb);
      doom.later(burstsIn, (later) => this.burst(at, style, later, index));
    });
  }
  burstTile(boss, playerTile) {
    const centre = bossCentre(boss);
    const dx = playerTile[0] - centre[0];
    const dy = playerTile[1] - centre[1];
    const far = Math.max(Math.abs(dx), Math.abs(dy));
    const reach = (bossSize >> 1) + 1;
    if (far === 0) return [centre[0], centre[1] - reach];
    return [centre[0] + Math.round((dx * reach) / far), centre[1] + Math.round((dy * reach) / far)];
  }
  burst(at, style, context, index) {
    const doom = this.doom;
    const here = [...context.world.getPlayer().position];
    // Delve 8: the second rock's debris never falls on the first's (wiki),
    // its marked tile neither: a player still on one of the first's shadows
    // as it bursts gets the rock on a tile near them instead (OBS: 0 of 12
    // such bursts marked the player's tile, against 94 of 99 otherwise; the
    // rock stood 1 to 3 tiles away).
    const avoid = index === 1 ? this.firstPieces : undefined;
    const marked = avoid?.has(key(here)) ? (this.nearestFree(here, avoid) ?? here) : here;
    const pieces = [marked, ...this.debrisTiles(marked, doom.rules.rockPieces - 1, avoid)];
    if (doom.rules.rocks > 1 && index === 0) this.firstPieces = new Set(pieces.map(key));
    const ends = pieces.map((tile) => 60 + 3 * chebyshev(at, tile));
    animate(context, null, null, [graphic(spotAnims.rockSplit[style], at), ...pieces.map((tile) => graphic(spotAnims.debrisShadow, tile))],
      pieces.map((tile, piece) => projectile(spotAnims.debris[piece % spotAnims.debris.length], at, tile, 0, ends[piece], 500, 0)));
    doom.pendingDamages.push({ baseDamage: 0, attackType: "typeless", source: "Rock", playerPosition: here, disablesProtectionPrayersForTicks: 1 });
    doom.later(2, (ctx) => animate(ctx, null, null, pieces.map((tile, piece) => graphic(spotAnims.debrisImpact, tile, Math.max(0, ends[piece] - 60)))));
    doom.later(3, (ctx) => this.land(marked, pieces, style, ctx, index));
  }
  // The rest of the pieces: `picks` tiles within four of the player's, a tile
  // picked twice (or the player's again) making one piece (OBS: delves.js).
  debrisTiles(centre, picks, avoid = new Set()) {
    const taken = new Set([key(centre), ...avoid]);
    const tiles = [];
    for (let pick = 0; pick < picks; pick++) {
      const tile = [centre[0] + this.doom.randomInt(-4, 4), centre[1] + this.doom.randomInt(-4, 4)];
      if (taken.has(key(tile)) || !onFloor(tile) || this.has(tile)) continue;
      taken.add(key(tile));
      tiles.push(tile);
    }
    return tiles;
  }
  // The floor tiles nearest `centre` (out to four) outside `avoid` with no rock, one of them at random.
  nearestFree(centre, avoid) {
    for (let ring = 1; ring <= 4; ring++) {
      const tiles = [];
      for (let dx = -ring; dx <= ring; dx++)
        for (let dy = -ring; dy <= ring; dy++) {
          const tile = [centre[0] + dx, centre[1] + dy];
          if (chebyshev(tile, centre) === ring && onFloor(tile) && !avoid.has(key(tile)) && !this.has(tile)) tiles.push(tile);
        }
      if (tiles.length) return tiles[this.doom.randomInt(0, tiles.length - 1)];
    }
    return null;
  }
  land(marked, pieces, style, context, index) {
    const doom = this.doom;
    const here = context.world.getPlayer().position;
    if (pieces.some((tile) => key(tile) === key(here))) {
      doom.pendingDamages.push({ baseDamage: [0, debrisMaxHit], attackType: "typeless", source: "Rock", playerPosition: [...here] });
    }
    this.place(marked);
    if (key(here) === key(marked)) {
      const aside = this.freeNeighbours(marked);
      if (aside.length) context.teleportPlayer(aside[Math.floor(doom.random() * aside.length)]);
    }
    // Delve 8: two rock throws (wiki), each sending its own set as a single throw does.
    const orbs = doom.rules.rockOrbs;
    const sources = pieces.filter((tile) => key(tile) !== key(marked));
    const player = context.world.getPlayer();
    const boss = doom.boss(context.world);
    for (let orb = 0, current = style; orb < orbs && boss?.alive; orb++, current = current === "range" ? "magic" : "range") {
      const from = sources.length ? sources.splice(Math.floor(doom.random() * sources.length), 1)[0] : marked;
      const end = doom.rules.rockOrbFirstCycles + 30 * orb;
      const impactDelayTicks = Math.ceil(end / 30);
      context.queueNpcHit(doom.rollOrb(boss, player, current, { impactDelayTicks }));
      // The orb follows the player, as the boss's own do. They all leave
      // together, at every delve (OBS: from delve 7, cycles 0-30, 0-60, 0-90).
      animate(context, null, null, [], [{ ...projectile(spotAnims.orb[current], from, player.position, 0, end, 100, 100), target: buildActorVisualTarget(player) }]);
      doom.orbImpact(current, impactDelayTicks, { evenPrayed: true });
      this.orbsLandAt = Math.max(this.orbsLandAt, context.tick + impactDelayTicks);
    }
  }
  place(tile) {
    if (this.has(tile)) return;
    this.standing.add(key(tile));
    this.collision?.flag(...tile, CollisionFlag.OBJECT);
    this.doom.acid.clear(tile);
  }
  // A rock broken by the burrowed Doom (OBS: graphic 2699 where it stood).
  crumble(tile, context) {
    if (!this.has(tile)) return;
    this.standing.delete(key(tile));
    this.collision?.unflag(...tile, CollisionFlag.OBJECT);
    animate(context, null, null, [graphic(spotAnims.rockCrumble, tile)]);
  }
  freeNeighbours([x, y]) {
    const tiles = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const tile = [x + dx, y + dy];
        if ((dx || dy) && onFloor(tile) && !this.has(tile)) tiles.push(tile);
      }
    return tiles;
  }
}

// --- larvae -----------------------------------------------------------------

// Larvae drop about four tiles past the player, away from the Doom (during
// his shield, from his north-west), and crawl a tile every two ticks to his
// centre. Reaching it, the larva charge goes up by one: the player takes the
// charge (at most 12) and the Doom heals 9 plus it. They have 2 hitpoints and
// take 1 a hit, except from demonbane; one praying against the attack's style
// takes nothing. Killed, a larva bursts over its 3x3: up to 21 to the player,
// or, if the Doom is caught, 5-10 to him (100 to his shield) and not the player.
// Prayers: half pray Melee at delves 1-2, any one of the three at delve 3
// (captured). From delve 4 they are coloured: green (ranged), blue (magic)
// and, only during the shield, red (melee), each taking only its own style
// (wiki). Every larva, red ones too, steps 1 tick after it lands, then
// every 2 ticks (captured: 30 larvae, 230 steps).
// OBS: they drop with the attack, on its tick. Outside the shield, delves 5-7
// drop two of one colour side by side, and delve 8 one giant (2x2, ranged or
// magic, 4 hitpoints; wiki: a 4x4 burst, and three times the heal and the
// hit if it reaches him). A larva crawls on into him to his centre tile and
// is taken in the tick after it gets there (OBS: 50 of 59 taken 5 ticks
// after their first step into him, three steps). One that has not reached
// him 30 ticks after it dropped goes, if a burrow has moved him since (OBS:
// 71 of 78; wiki: "about 20 seconds").
// ponytail: larvae walking around rocks.
const larvaDefinition = defineNpc({
  id: "doom-larva",
  move: ({ actor, context, config }) => config.larvae.step(actor, context),
  tick: ({ actor, context, config }) => ({ environmentalDamages: config.larvae.reach(actor, context) }),
});
const larvaHitpoints = 2;
const giantHitpoints = 4;
const giantReachCap = 30; // TSPS, seen in game
const larvaHeal = 9;
const larvaStepTicks = 2;
const larvaLostTicks = 30;
// A larva over his centre tile (a giant's 2x2 over it).
const overCentre = (larva, centre) =>
  centre[0] >= larva.position[0] && centre[0] < larva.position[0] + larva.size && centre[1] >= larva.position[1] && centre[1] < larva.position[1] + larva.size;
const footprintsOverlap = (a, b) =>
  a.position[0] < b.position[0] + b.size && b.position[0] < a.position[0] + a.size &&
  a.position[1] < b.position[1] + b.size && b.position[1] < a.position[1] + a.size;

export class Larvae {
  definition = larvaDefinition;
  constructor(doom) {
    this.doom = doom;
  }
  reset() {
    this.count = 0;
    this.charge = 0; // carries over between delves in the game; one delve here
  }
  isLarva(npc) {
    return larvaDefinition.isActor(npc);
  }
  spawn(context, { duringShield = false } = {}) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    const tile = duringShield ? this.northWestTile(boss) : this.pastPlayerTile(boss, context.world.getPlayer().position);
    if (!tile) return;
    const kind = this.kind(duringShield);
    this.spawnOne(context, tile, kind);
    if (duringShield || doom.rules.larvaeAtOnce < 2) return;
    const beside = this.besideTile(tile, boss);
    if (beside) this.spawnOne(context, beside, kind);
  }
  spawnOne(context, tile, { npcTypeId, prayer = null, style = null, giant = false }) {
    const id = "doom-larva-" + this.count++;
    // Overhead: the prayer a plain larva uses, or the two a coloured one's style leaves (captured: one combined icon).
    const overheadPrayers = prayer ? [prayer] : style ? ["melee", "range", "magic"].filter((other) => other !== style) : undefined;
    const hp = giant ? giantHitpoints : larvaHitpoints;
    const bossAt = [...(this.doom.boss(context.world)?.position ?? bossStart)];
    context.spawnNpc(roomNpc(larvaDefinition, { id, npcTypeId, size: giant ? 2 : 1, position: tile, hp, tick: context.tick, overheadPrayers }, { prayer, style, giant, movedAt: context.tick - 1, bossAt }));
    // Larva Tracker can leave the landing animation out (larvaTracker.js); the graphic stays.
    const withAnimation = !larvaTrackerSetting(this.doom.mechanics, larvaTrackerKeys.removeSpawnAnimation);
    animate(context, withAnimation ? id : null, withAnimation ? "spawn" : null, [graphic(spotAnims.larvaSpawn, tile)]);
  }
  // The second of a pair: beside the first, on a side more often than a
  // corner (OBS: 62 of 84 pairs).
  besideTile([x, y], boss) {
    const free = (offsets) => offsets.map(([dx, dy]) => [x + dx, y + dy]).filter((tile) => onFloor(tile) && !this.doom.rocks.has(tile) && !inFootprint(boss, tile));
    const sides = free([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const corners = free([[1, 1], [-1, 1], [1, -1], [-1, -1]]);
    const from = sides.length && (!corners.length || this.doom.random() < 62 / 84) ? sides : corners;
    return from.length ? from[this.doom.randomInt(0, from.length - 1)] : null;
  }
  // A plain larva with the prayer it uses, or a coloured one with the style it takes.
  kind(duringShield) {
    const doom = this.doom;
    if (doom.rules.delve <= 2) return { npcTypeId: npcTypeIds.larva, prayer: doom.random() < 0.5 ? "melee" : null };
    if (doom.rules.delve === 3) return { npcTypeId: npcTypeIds.larva, prayer: ["melee", "range", "magic"][doom.randomInt(0, 2)] };
    const styles = duringShield ? ["range", "magic", "melee"] : ["range", "magic"];
    const style = styles[doom.randomInt(0, styles.length - 1)];
    if (!duringShield && doom.rules.giantLarvae) {
      return { npcTypeId: style === "range" ? npcTypeIds.giantRangedLarva : npcTypeIds.giantMagicLarva, style, giant: true };
    }
    return { npcTypeId: { range: npcTypeIds.rangedLarva, magic: npcTypeIds.magicLarva, melee: npcTypeIds.meleeLarva }[style], style };
  }
  pastPlayerTile(boss, playerTile) {
    const centre = bossCentre(boss);
    const dx = Math.sign(playerTile[0] - centre[0]);
    const dy = Math.sign(playerTile[1] - centre[1]);
    for (let attempt = 0; attempt < 40; attempt++) {
      const reach = this.doom.randomInt(3, 5);
      const side = this.doom.randomInt(-2, 2);
      const tile = attempt < 30 && (dx || dy)
        ? [playerTile[0] + dx * reach + (dx === 0 ? side : 0), playerTile[1] + dy * reach + (dy === 0 ? side : 0)]
        : [playerTile[0] + this.doom.randomInt(-4, 4), playerTile[1] + this.doom.randomInt(-4, 4)];
      if (onFloor(tile) && !this.doom.rocks.has(tile) && chebyshev(tile, centre) > 3) return tile;
    }
    return null;
  }
  northWestTile(boss) {
    const centre = bossCentre(boss);
    for (let attempt = 0; attempt < 20; attempt++) {
      const reach = this.doom.randomInt(7, 9);
      const tile = [centre[0] - reach, centre[1] + reach + this.doom.randomInt(-2, 2)];
      if (onFloor(tile) && !this.doom.rocks.has(tile)) return tile;
    }
    return [floor.minX + 1, floor.maxY - 1];
  }
  step(larva, context) {
    const boss = this.doom.boss(context.world);
    if (!larva.alive || !boss?.alive || context.tick - larva.state.movedAt < larvaStepTicks) return [];
    const centre = bossCentre(boss);
    if (overCentre(larva, centre)) return [];
    larva.state.movedAt = context.tick;
    const next = [larva.position[0] + Math.sign(centre[0] - larva.position[0]), larva.position[1] + Math.sign(centre[1] - larva.position[1])];
    // A crawl: the tile drawn over its 2 ticks, so it keeps moving rather than stepping and waiting (game: NPC crawl).
    return [{ npcId: larva.id, path: [next], movementSpeed: "crawl" }];
  }
  // Into the Doom: the charge, the player's hit and his heal (a giant's three times over).
  reach(larva, context) {
    const boss = this.doom.boss(context.world);
    if (!larva.alive || !boss?.alive) return [];
    const moved = boss.position[0] !== larva.state.bossAt[0] || boss.position[1] !== larva.state.bossAt[1];
    if (moved && context.tick - larva.spawnTick >= larvaLostTicks && !footprintsOverlap(boss, larva)) {
      context.despawnNpc(larva.id);
      return [];
    }
    // On his centre since an earlier tick.
    if (!overCentre(larva, bossCentre(boss)) || context.tick <= larva.state.movedAt) return [];
    context.despawnNpc(larva.id);
    this.charge++;
    const times = larva.state.giant ? 3 : 1;
    const cap = larva.state.giant ? giantReachCap : this.doom.rules.larvaReachCap;
    animate(context, null, null, [{ spotAnimId: spotAnims.larvaImpact, target: buildActorVisualTarget(context.world.getPlayer()), height: 0, delayCycles: 0 }]);
    healNpc(boss, times * (larvaHeal + this.charge), context.tickEvents);
    return [{ baseDamage: Math.min(times * this.charge, cap), attackType: "typeless", source: "Demonic larva", playerPosition: [...context.world.getPlayer().position] }];
  }
  // A hit on a larva: nothing through its prayer (a coloured one prays the
  // other two styles); 2 from demonbane or the Eye of Ayak, killing a larva
  // and taking a giant in two (wiki; OBS, 18 runs with the Scorching bow and
  // the Eye: every larva hit was a 2, every giant took 2 and 2), otherwise at
  // most 1 (wiki).
  damage(larva, damage, attack, demonbane) {
    const { prayer, style } = larva.state;
    if ((prayer && prayer === attack.style) || (style && style !== attack.style)) return 0;
    return demonbane ? 2 : Math.min(1, damage);
  }
  killed(larva, context) {
    const doom = this.doom;
    const [x, y] = larva.position;
    const blast = [];
    // Its own tiles and a ring around them: 3x3, a giant's 4x4.
    for (let dx = -1; dx <= larva.size; dx++) for (let dy = -1; dy <= larva.size; dy++) blast.push([x + dx, y + dy]);
    animate(context, null, null, blast.map((tile) => graphic(spotAnims.larvaBlast, tile)));
    const boss = doom.boss(context.world);
    if (boss?.alive && blast.some((tile) => inFootprint(boss, tile))) {
      if (doom.shield.up) doom.shield.hit(100, context);
      else {
        doom.hitBoss(boss, doom.randomInt(5, 10), context);
        doom.acid.spray(boss, context);
      }
      return;
    }
    if (doom.shield.up) doom.shield.store();
    if (blast.some((tile) => key(tile) === key(context.world.getPlayer().position))) {
      doom.pendingDamages.push({ baseDamage: [0, larvaBlastMaxHit], attackType: "typeless", source: "Larva blast", playerPosition: [...context.world.getPlayer().position] });
    }
  }
}

// --- volatile earth, the earthen shield and the shockwave -------------------

// Volatile earth comes up on 19-28 tiles of its pool (delves.js) when the
// encounter says: at delves 1-4 on the turn after his 11th (OBS), from delve
// 5 as he surfaces (burrow.js). The Doom attacks for 15 ticks more, then
// charges: a slam at 19, landing at 21 and every 2 ticks after for each
// further shockwave (26-42 each) on anyone outside the earthen shield, the
// slams spreading from where he stands. The second earth destroyed brings
// the shield (3x3) on its tile; it walks to the first, diagonally first, and
// its centre clears acid. It goes when it arrives or the shockwaves end.
const idle = () => ({ environmentalDamages: [] });
const earthDefinition = defineNpc({ id: "doom-volatile-earth", move: false, tick: idle });
const earthenShieldDefinition = defineNpc({
  id: "doom-earthen-shield",
  move: ({ actor, context, config }) => config.shockwave.walk(actor, context),
  tick: idle,
});
const wave = { charge: 15, loop: 17, slam: 19, lands: 21, between: 2 };

export class Shockwave {
  constructor(doom) {
    this.doom = doom;
  }
  reset() {
    this.active = null; // { at }
    this.earth = new Set();
    this.destroyed = [];
    this.shieldTile = null; // the shield NPC's destination
    this.count = 0;
  }
  start(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    if (!boss?.alive) return;
    this.active = { at: context.tick };
    const centre = bossCentre(boss);
    const atStart = boss.position[0] === bossStart[0] && boss.position[1] === bossStart[1];
    const pool = atStart ? earthPool.slice(0, earthPoolAtStart) : earthPool;
    const free = pool.filter((tile) => !doom.rocks.has(tile) && chebyshev(tile, centre) > 3);
    const count = Math.min(free.length, doom.randomInt(19, 28));
    for (let picked = 0; picked < count; picked++) {
      const [tile] = free.splice(Math.floor(doom.random() * free.length), 1);
      const id = "doom-earth-" + this.count++;
      context.spawnNpc(roomNpc(earthDefinition, { id, npcTypeId: npcTypeIds.volatileEarth, position: tile, hp: 1, tick: context.tick }, {}));
      this.earth.add(id);
      animate(context, id, "spawn");
    }
    const at = context.tick;
    const shockwaves = doom.rules.shockwaves;
    const last = wave.lands + (shockwaves - 1) * wave.between;
    doom.later(wave.charge, (ctx) => animate(ctx, "doom", "areaCharge"));
    doom.later(wave.loop, (ctx) => animate(ctx, "doom", "areaLoop"));
    doom.later(wave.slam, (ctx) => animate(ctx, "doom", "areaSlam", [{ spotAnimId: spotAnims.areaSlam, target: buildActorVisualTarget(doom.boss(ctx.world)), height: 0, delayCycles: 0 }]));
    for (let index = 0; index < shockwaves; index++) doom.later(wave.lands + index * wave.between, (ctx) => this.land(ctx));
    doom.later(last, (ctx) => animate(ctx, "doom", "areaReturn"));
    doom.later(last + 1, (ctx) => {
      this.active = null;
      doom.shockwaveEnded(ctx);
    });
    doom.later(last + 3, (ctx) => this.clear(ctx));
    return at;
  }
  // The Doom keeps attacking until the charge.
  holdsAttacks(tick) {
    return this.active !== null && tick >= this.active.at + wave.charge;
  }
  // Captured: a slam on every floor tile 2 to `reach` tiles from his centre, a
  // cycle later for each tile further out; which of the three looks random
  // (here a hash of the tile). The car slam's is the same (OBS).
  floorSlam(context, centre, reach) {
    const graphics = [];
    for (let x = floor.minX; x <= floor.maxX; x++)
      for (let y = floor.minY; y <= floor.maxY; y++) {
        const ring = chebyshev([x, y], centre);
        if (ring >= 2 && ring <= reach && isArenaTileWalkable(x, y)) graphics.push(graphic(spotAnims.floorSlam[(x * 5 + y * 3 + context.tick) % 3], [x, y], ring - 2));
      }
    animate(context, null, null, graphics);
  }
  land(context) {
    const boss = this.doom.boss(context.world);
    this.floorSlam(context, boss ? bossCentre(boss) : [bossStart[0] + (bossSize >> 1), bossStart[1] + (bossSize >> 1)], 12);
    if (this.sheltered(context)) return;
    this.doom.pendingDamages.push({ baseDamage: shockwaveDamage, attackType: "typeless", source: "Shockwave", playerPosition: [...context.world.getPlayer().position] });
  }
  sheltered(context) {
    const shield = context.world.getNpc("doom-earthen-shield");
    return Boolean(shield?.alive && inFootprint(shield, context.world.getPlayer().position));
  }
  earthDestroyed(earth, context) {
    this.earth.delete(earth.id);
    if (this.shieldTile || !this.active) return;
    this.destroyed.push([...earth.position]);
    if (this.destroyed.length < 2) return;
    const [destination, from] = this.destroyed;
    this.shieldTile = destination;
    context.spawnNpc(roomNpc(earthenShieldDefinition, {
      id: "doom-earthen-shield", npcTypeId: npcTypeIds.earthenShield, size: 3, position: [from[0] - 1, from[1] - 1], hp: 1, tick: context.tick, untargetable: true,
    }, { movedAt: context.tick }));
    animate(context, "doom-earthen-shield", "spawn");
    for (const id of this.earth) this.removeLater(id, context, 2, "death");
    this.earth.clear();
  }
  walk(shield, context) {
    const centre = [shield.position[0] + 1, shield.position[1] + 1];
    this.doom.acid.clear(centre);
    if (key(centre) === key(this.shieldTile)) {
      context.despawnNpc(shield.id);
      this.shieldTile = null;
      return [];
    }
    if (context.tick - shield.state.movedAt < this.doom.rules.earthenShieldStepTicks) return [];
    shield.state.movedAt = context.tick;
    const next = [shield.position[0] + Math.sign(this.shieldTile[0] - centre[0]), shield.position[1] + Math.sign(this.shieldTile[1] - centre[1])];
    return [{ npcId: shield.id, path: [next] }];
  }
  removeLater(id, context, ticks, clipId) {
    if (clipId) animate(context, id, clipId);
    this.doom.later(ticks, (ctx) => ctx.world.getNpc(id) && ctx.despawnNpc(id));
  }
  clear(context) {
    for (const id of this.earth) if (context.world.getNpc(id)) context.despawnNpc(id);
    this.earth.clear();
    this.destroyed = [];
    if (context.world.getNpc("doom-earthen-shield")) context.despawnNpc("doom-earthen-shield");
    this.shieldTile = null;
  }
  get definitions() {
    return [earthDefinition, earthenShieldDefinition];
  }
}

// --- acid blood (delve 3+) --------------------------------------------------

// Each delve the acid goes one way from the Doom. Every hit on him sends a
// blob to the tile just past his edge that way, plus one more at delve 3 (2-6
// out, up to 2 to the side), two from delve 4 and three from 8 (1-9 out, up to
// 4 to the side); a pool forms where each lands. Standing in one hurts 3-7 a
// tick. None while he is shielded or burrowed (wiki). Rocks cover acid.
// ponytail: the venom.
export class Acid {
  pools = new Set();
  constructor(doom) {
    this.doom = doom;
  }
  reset() {
    this.pools.clear();
    this.direction = [[0, 1], [1, 0], [0, -1], [-1, 0]][this.doom.randomInt(0, 3)];
  }
  spray(boss, context) {
    const doom = this.doom;
    if (!doom.rules.acid || doom.shield.up || doom.burrow.burrowed) return;
    const [dx, dy] = this.direction;
    const centre = bossCentre(boss);
    const offsets = [[3, 0]];
    for (let blob = 0; blob < doom.rules.acidExtraBlobs; blob++) {
      offsets.push(doom.rules.delve === 3 ? [doom.randomInt(2, 6), doom.randomInt(-2, 2)] : [doom.randomInt(1, 9), doom.randomInt(-4, 4)]);
    }
    const projectiles = [];
    const splats = [];
    for (const [out, side] of offsets) {
      const tile = [centre[0] + dx * out + (dx === 0 ? side : 0), centre[1] + dy * out + (dy === 0 ? side : 0)];
      if (!onFloor(tile) || inFootprint(boss, tile)) continue;
      const end = 15 + 3 * chebyshev(centre, tile);
      projectiles.push(projectile(spotAnims.acidBlob, centre, tile, 0, end, 100, 0));
      // Captured: any of the four splats (_N, _E, _S, _W), whatever the direction; here a hash of the tile.
      splats.push(graphic(spotAnims.acidSplat[(tile[0] * 5 + tile[1] * 3 + context.tick) % 4], tile, end));
      doom.later(Math.ceil(end / 30), () => !doom.rocks.has(tile) && this.pools.add(key(tile)));
    }
    animate(context, null, null, splats, projectiles);
  }
  // Every tick: standing in acid.
  hurt(context) {
    if (!this.pools.has(key(context.world.getPlayer().position))) return [];
    return [{ baseDamage: acidDamage, attackType: "typeless", source: "Acid blood", playerPosition: [...context.world.getPlayer().position] }];
  }
  clear(tile) {
    this.pools.delete(key(tile));
  }
  clearAround([x, y]) {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) this.pools.delete(key([x + dx, y + dy]));
  }
  tiles() {
    return [...this.pools].map(unkey);
  }
}

export const roomDefinitions = [larvaDefinition, earthDefinition, earthenShieldDefinition];
