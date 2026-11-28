// Vorkath (https://oldschool.runescape.wiki/w/Vorkath), the post-quest dragon
// in her crater on Ungael.
//
// She rises as the fight starts (immune for 7 ticks, her first attack 8 ticks
// in) and attacks every 5 ticks: ranged (up to 32), magic (30), melee (32, only
// beside her), three breaths of dragonfire (up to 80 unprotected: the regular,
// the venomous one and the one that switches the player's prayers off), and a
// fireball thrown high at the player's tile (up to 121 on it, half beside it).
// Every seventh turn is a special, the two in turn:
// - acid: pools all over the crater and one under the player, then 25 shots of
//   rapid fire at his tile, one a tick, 25 to 41 to a player still on it; the
//   acid burns 1 to 10 a tick and heals her as much; her damage taken is halved.
// - the zombified spawn: an icy breath freezes the player; a spawn lands 8
//   tiles off and walks in, and beside him it explodes for up to 60 (less as it
//   is hurt). She is immune until it is gone; Crumble Undead kills it at once.
//
// Dragonfire is cut by a dragonfire or anti-dragon shield, Protect from Magic
// and an antifire or super antifire potion (client/engine/consumables.js):
// the cap is 20 with a shield, else 30 with the prayer, else 80; an
// inaccurate breath caps at 50 unprotected; a potion takes 10 (antifire) or 20
// (super) off the roll, the venomous and prayer breaths 5 more (tsps, from the
// wiki's table, whose sums it gives: WIKI 10 with super and the prayer, 0 with
// super and a shield).
//
// Sources: WIKI Vorkath, Vorkath/Strategies and Zombified Spawn; TABLE her
// stats and the spawn's (client/data/monsters.js); OBS (tsps) RSPSApp/tsps
// server/plugins/bosses/vorkath/ and docs/vorkath.md, which read the cache and
// rsprox captures: 61 recordings, about 500 fights, most on Leagues or event
// worlds, so their timings, ids and shares are taken, not their damage.
// OBS (REC): three recordings of the game, 20261127-203033-vorkath,
// 20261127-204038-vorkath_1 and 20261127-204656-vorkath_2 (7 kills, 126 standard
// attacks, 15 acid phases, 10 spawns); where they and tsps differ, they win.
// Numbers no source gives are marked inferred.
//
// She rises as the fight-start countdown ends, which stands in for her poke.
// Not yet: the woox walk's subtleties beyond what the ticks give;
// Salve amulet's and the dragon hunter weapons' bonuses are the engine's
// (attributes "undead", "dragon").
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { getDragonfireProtection } from "../../engine/consumables.js";
import { getActiveSpell } from "../../data/weaponCategories.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget, healNpc } from "../shared/npcHelpers.js";
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, seqIds, spotAnims, mapSquare, bossSize, bossStart, playerStart, acidGrid, sameTile, underBoss, edgeDistance, centreOf } from "./ids.js";
import { vorkathLoadouts } from "./loadouts.js";
import { vorkathCombatAchievements } from "./combatAchievements.js";

export const vorkathKind = "vorkath";
export const vorkathMapSquare = mapSquare;
export const bossActorId = "vorkath";
export const spawnActorId = "vorkath-spawn";

const riseTick = 1; // inferred: she rises on the fight's first tick (in the game, a tick after the poke)
const riseImmuneTicks = 7; // OBS (tsps): awake 7 ticks into the rise; untouchable till then
const firstAttackTicks = 8; // OBS (REC, 7 of 7 kills): her first attack 8 ticks into the rise, a tick after she is awake (tsps: 13)
const attackSpeed = 5; // TABLE, WIKI
const standardsBeforeSpecial = 6; // WIKI: six standard attacks, then a special; OBS (REC): the first one too, 7 of 7 kills, and 16 of 16 after
const phaseRecheckTicks = 2; // OBS (tsps): during a special her turn waits 2 ticks at a time
const maxHits = { melee: 32, ranged: 32, magic: 30 }; // WIKI: post-quest
const fireballMax = 121; // WIKI
const rapidRange = [25, 41]; // WIKI: 25 to 41 regardless of protection
const poolRange = [1, 10]; // WIKI: up to 10, healed to her
const spawnHitpoints = 38; // TABLE, WIKI
const spawnExplosionMax = 60; // WIKI: up to 60, by its hitpoints left
const acidRapidShots = 25; // OBS (tsps)
const acidFirstShotTicks = 4; // OBS (tsps)
const acidForceEndTicks = 33; // OBS (tsps): the acid phase never runs longer
const acidNextAttackTicks = 33; // OBS (REC, 12 of 12): her next attack 33 ticks after she starts the acid
const acidPoolLandTicks = 3; // OBS (tsps): the pools land 3 ticks after the cast
const freezeTicks = 100; // OBS (tsps): 60 seconds, or until the spawn is gone
const spawnLandDistance = 8; // OBS (tsps): 297 of 317 spawns landed 8 tiles from the player (WIKI: 10)
const spawnThrowTicks = 4; // OBS (tsps): the spawn lands 4 ticks after it is thrown
const spawnDeathTicks = 5; // OBS (REC, 9 kills): the spawn is gone 5 ticks after the hit that kills it
const spawnUnfreezeTicks = 3; // OBS (REC, 10 of 10): "You become unfrozen as you kill the spawn." 3 ticks after that hit
const spawnFuseTicks = 60; // inferred (tsps): a spawn that never reaches him explodes where it is
const fireballThrowTicks = 1; // OBS (tsps): the fireball leaves a tick after she rears up
const fireballLandTicks = 4; // OBS (tsps): its impact 4 ticks after it leaves
const venomChance = 0.5; // inferred (tsps): the wiki gives no chance
const deathTicks = 6; // OBS (tsps): she is removed 6 ticks after her death animation starts
const venomVarp = 1_000_000; // the engine's poisonVarp for venom (as Araxxor's)
// CACHE: the shields that hold off dragonfire (client/data/equipment.js).
const dragonfireShields = new Set([1540, 11710, 11283, 11284, 22002, 22003, 33186]);
// OBS (tsps): her shots leave her head, two tiles from her middle toward the
// target, from 30 cycles, landing 70 + 5 a tile after; 35 to 31 high, slope 14.
const shot = { delay: 30, base: 70, perTile: 5, startHeight: 35, endHeight: 31, slope: 14, startOffset: 128 };
// OBS (tsps): what she throws at a tile: [start, end] cycles, heights, slope.
const tileFlights = {
  fireball: { start: 0, end: 120, startHeight: 85, endHeight: 9, slope: 46 },
  acid: { start: 32, end: 90, startHeight: 85, endHeight: 0, slope: 46 },
  rapid: { start: 0, end: 30, startHeight: 35, endHeight: 8, slope: 22 },
  spawn: { start: 32, end: 120, startHeight: 85, endHeight: 0, slope: 46 },
};

// OBS (tsps): the shares of her standard attacks from range (3,734 attacks):
// ranged 30, magic 24, dragonfire 15, venom 11, fireball 11, prayer 8; beside
// her melee takes 139 of 879 on top of the same mix.
const fromRange = [["ranged", 30], ["magic", 24], ["dragonfire", 15], ["venom", 11], ["fireball", 11], ["prayer", 8]];
const meleeWeight = 19;
const breaths = {
  dragonfire: { spotAnimId: spotAnims.dragonfire, impact: spotAnims.dragonfireImpact, penalty: 0, source: "Dragonfire" },
  venom: { spotAnimId: spotAnims.venomBreath, impact: spotAnims.venomImpact, penalty: 5, source: "Venomous dragonfire" },
  prayer: { spotAnimId: spotAnims.prayerBreath, impact: spotAnims.prayerImpact, penalty: 5, source: "Corrupting dragonfire" },
};

const bossDefinition = defineNpc({
  id: "vorkath",
  move: false, // she never walks
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});
const spawnDefinition = defineNpc({ id: "vorkath-spawn" }); // the default walk, towards the player; it never attacks

const onTile = (spotAnimId, position, delayCycles = 0, height = 0) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height, delayCycles, onGround: true });
const onActor = (spotAnimId, actor, delayCycles = 0, height = 0) => ({ spotAnimId, target: buildActorVisualTarget(actor), height, delayCycles });
const tileProjectile = (spotAnimId, from, to, flight) => ({
  spotAnimId, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: { kind: "tile", position: [...to] },
  startDelayCycles: flight.start, endDelayCycles: flight.end, slope: flight.slope, startOffset: 0, startHeight: flight.startHeight, endHeight: flight.endHeight,
});
const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
// The spell of the player's next attack, a cast or the autocast; null for none (as the Maggot King's).
function playerSpellName(player) {
  if (!player) return null;
  if (player.manualCastSpell) return typeof player.manualCastSpell === "string" ? player.manualCastSpell : (player.manualCastSpell.name ?? null);
  const spell = getActiveSpell({
    weaponId: player.equipment?.weapon, selectedStyleIndex: player.selectedAttackStyleIndex,
    selectedSpell: player.combatSupplies?.selectedSpell, spellbook: player.combatSupplies?.spellbook ?? "standard",
  });
  return spell?.name ?? null;
}

class VorkathEncounter {
  kind = vorkathKind;
  constructor() {
    this.definitions = new NpcDefinitionRegistry([bossDefinition, spawnDefinition].map((definition) => definition.register(this)));
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.startRun();
  }
  startRun() {
    this.now = 0;
    this.tasks = [];
    this.pending = [];
    this.phase = "rising"; // "rising" | "active" | "acid" | "spawn" | "dead"
    this.nextAt = riseTick + firstAttackTicks;
    this.attacks = 0;
    this.nextSpecial = null; // drawn on the first tick: WIKI, the first is random
    this.pools = []; // [x, y] of the acid on the floor
    this.acid = null; // { startedAt, shots }
    this.rapidTargets = []; // { tile, landsAt }
    this.fireballs = []; // { tile, landsAt }
    this.frozenUntil = -1;
    this.spawn = null; // { bornAt, exploding }
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }
  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }

  // --- what the engine always calls --------------------------------------------
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return {};
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
  configureRunStart(mechanics, context) {
    this.random = createSeededRandom(this.seed);
    this.startRun();
    const boss = context?.world.actors.get(bossActorId);
    if (!boss) return;
    boss.position = [...bossStart];
    boss.previousPosition = [...bossStart];
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.vorkath); // TABLE: 750
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.vorkath, archetypeId: "vorkath", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 0, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.vorkath)),
          combat: {
            attackSpeed, attackRange: 10, attackStyle: "range", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
    ];
  }

  // --- every tick ----------------------------------------------------------------
  // Before the NPCs: what is due (breaths, fireballs, rapid fire, the spawn),
  // and the acid under the player.
  resolveHazards(context) {
    this.now = context.tick;
    this.context = context;
    for (let due = this.takeDueTask(); due; due = this.takeDueTask()) due.task(context);
    this.rapidTargets = this.rapidTargets.filter((entry) => entry.landsAt > this.now);
    this.fireballs = this.fireballs.filter((entry) => entry.landsAt > this.now);
    const boss = this.boss(context.world);
    if (this.phase === "acid") this.tickAcid(boss, context);
    if (this.phase === "spawn") this.tickSpawn(context);
    const damages = this.pending;
    this.pending = [];
    return damages;
  }
  processPostTick(context) {
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    return [];
  }
  takeDueTask() {
    const index = this.tasks.findIndex((entry) => entry.tick <= this.now);
    return index < 0 ? null : this.tasks.splice(index, 1)[0];
  }
  hurt(source, baseDamage, extra = {}) {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage, attackType: "typeless", playerPosition: [...player.position], ...extra });
  }
  animate(context, clipId, graphics = [], projectiles = [], actorId = bossActorId) {
    emitInfernoVisual(context.tickEvents, { animations: clipId ? [{ actorId, clipId, delayCycles: 0 }] : [], projectiles, graphics });
  }

  // --- her turn ---------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (this.nextSpecial === null) this.nextSpecial = this.random() < 0.5 ? "acid" : "spawn"; // WIKI: the first special at random
    if (this.phase === "rising") {
      if (context.tick === riseTick) this.animate(context, "wake");
      if (context.tick >= riseTick + riseImmuneTicks) this.phase = "active";
      return none;
    }
    if (context.tick < this.nextAt || !player.alive) return none;
    if (this.phase !== "active") {
      this.nextAt = context.tick + phaseRecheckTicks;
      return none;
    }
    this.nextAt = context.tick + attackSpeed;
    if (this.attacks >= standardsBeforeSpecial) {
      this.attacks = 0;
      const special = this.nextSpecial;
      this.nextSpecial = special === "acid" ? "spawn" : "acid";
      if (special === "acid") this.startAcid(boss, player, context);
      else this.startSpawn(boss, player, context);
      return none;
    }
    this.attacks++;
    const beside = edgeDistance(boss.position, bossSize, player.position) <= 1 && !underBoss(boss.position, player.position);
    const choice = this.weighted(beside ? [["melee", meleeWeight], ...fromRange] : fromRange);
    if (choice === "melee") return { environmentalDamages: [], npcAttacks: [this.melee(boss, player, context)] };
    if (choice === "ranged" || choice === "magic") return { environmentalDamages: [], npcAttacks: [this.shoot(choice, boss, player, context)] };
    if (choice === "fireball") this.throwFireball(boss, player, context);
    else this.breathe(choice, boss, player, context);
    return none;
  }
  weighted(choices) {
    let roll = this.random() * choices.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [name, weight] of choices) {
      roll -= weight;
      if (roll < 0) return name;
    }
    return choices[choices.length - 1][0];
  }
  // Her head: two tiles from her middle along the line to the target, to the nearest tile. OBS (REC): the tile
  // 146 of 148 shots and breaths and 21 of 21 fireballs left from (two tiles along each axis fits 47 of the 148).
  head(boss, target) {
    const [cx, cy] = centreOf(boss.position);
    const length = Math.hypot(target[0] - cx, target[1] - cy) || 1;
    return [cx + Math.round((2 * (target[0] - cx)) / length), cy + Math.round((2 * (target[1] - cy)) / length)];
  }
  // A shot at the player: its flight's end in cycles, and the hit's delay in ticks. OBS (REC, 129 shots and
  // breaths): the hitsplat comes on the last tick that starts before it lands, 2 ticks on for a flight ending at 80
  // or 85 cycles, 3 at 90; the freeze and the spawn's throw of the icy breath come then too.
  shotTiming(boss, player) {
    const end = shot.base + shot.perTile * chebyshev(this.head(boss, player.position), player.position);
    return { end, ticks: Math.max(1, Math.floor(end / 30)) };
  }
  shotVisual(spotAnimId, boss, player, end) {
    const from = this.head(boss, player.position);
    return { spotAnimId, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: buildActorVisualTarget(player), startDelayCycles: shot.delay, endDelayCycles: end, slope: shot.slope, startOffset: shot.startOffset, startHeight: shot.startHeight, endHeight: shot.endHeight };
  }
  melee(boss, player, context) {
    // WIKI: slash; OBS (tsps): it lands on the animation's tick.
    const attack = rollNpcAttack({ attacker: boss, target: player, plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", maxHit: maxHits.melee, impactDelayTicks: 0, sourceDeathPolicy: "cancel-before-impact" }, random: this.random });
    if (!attack) throw new TypeError("Missing formula stats for Vorkath");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "melee", kind: "vorkath_melee", impactDelayTicks: 0 });
    return attack;
  }
  shoot(kind, boss, player, context) {
    const magic = kind === "magic";
    const { end, ticks } = this.shotTiming(boss, player);
    const attack = rollNpcAttack({
      attacker: boss, target: player,
      plan: { formulaStyle: magic ? "magic" : "ranged", damageType: magic ? "magic" : "range", attackKind: magic ? "magic_fire" : "range_arrow", maxHit: magic ? maxHits.magic : maxHits.ranged, impactDelayTicks: ticks, sourceDeathPolicy: "persist" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Vorkath");
    const projectile = this.shotVisual(magic ? spotAnims.magicShot : spotAnims.rangedShot, boss, player, end);
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "breath", kind: "vorkath_" + kind, impactDelayTicks: ticks, projectiles: [projectile] });
    // OBS (tsps): the impact goes out with the shot, timed to land with it, 124 high.
    this.animate(context, null, [onActor(magic ? spotAnims.magicImpact : spotAnims.rangedImpact, player, end, 124)]);
    return attack;
  }
  // A breath: rolled as it lands, against the shield, the prayer and the potion then.
  breathe(kind, boss, player, context) {
    const breath = breaths[kind];
    const { end, ticks } = this.shotTiming(boss, player);
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "breath", kind: "vorkath_" + kind, impactDelayTicks: ticks, projectiles: [this.shotVisual(breath.spotAnimId, boss, player, end)] });
    this.animate(context, null, [onActor(breath.impact, player, end, 124)]);
    this.later(ticks, (ctx) => {
      const you = ctx.world.getPlayer();
      const vorkath = this.boss(ctx.world);
      if (!you.alive || !vorkath?.alive) return;
      const damage = this.dragonfireDamage(vorkath, you, breath.penalty);
      this.hurt(breath.source, damage, kind === "venom" && this.random() < venomChance ? { applyPoison: venomVarp } : {});
      // WIKI: the corrupting breath switches every prayer off, protected or not.
      if (kind === "prayer") ctx.deactivateAllPrayers?.();
    });
  }
  // The roll of a breath: its accuracy is her magic's against the player's
  // magic defence (inferred, as tsps); the cap is the shield's or the prayer's,
  // a miss unprotected 50; the potion and the breath's kind take some off.
  dragonfireDamage(boss, player, penalty) {
    const shield = dragonfireShields.has(player.equipment?.shield);
    const prayer = player.activePrayer === "ProtectMagic";
    const potion = getDragonfireProtection(player.activeEffects);
    const cap = shield ? 20 : prayer ? 30 : 80;
    const missCap = shield || prayer ? cap : 50;
    const reduction = potion === "super" ? 20 : potion === "antifire" ? 10 : 0;
    const roll = rollNpcAttack({ attacker: boss, target: player, plan: { formulaStyle: "magic", damageType: "magic", attackKind: "magic_fire", maxHit: 1, impactDelayTicks: 0 }, random: this.random });
    const max = roll?.accuracySucceeded ? cap : missCap;
    return Math.max(0, this.randomInt([0, max]) - reduction - penalty);
  }
  // Thrown high at the player's tile: up to 121 on it, half beside it, nothing further.
  // OBS (REC, 21 fireballs): it is aimed at the tile the player stands on once he has stepped in the tick she rears
  // up (one of them at a player who stepped onto it then, two at a player who left it the tick after), and leaves
  // her head. A hazard runs before the player steps, so that tile is read as the fireball leaves, a tick on.
  throwFireball(boss, player, context) {
    this.animate(context, "high");
    this.later(fireballThrowTicks, (ctx) => {
      if (!this.boss(ctx.world)?.alive) return;
      const tile = [...ctx.world.getPlayer().position];
      this.animate(ctx, null, [], [tileProjectile(spotAnims.fireball, this.head(boss, tile), tile, tileFlights.fireball)]);
      this.fireballs.push({ tile, landsAt: this.now + fireballLandTicks });
      this.later(fireballLandTicks, (landed) => {
        if (!this.boss(landed.world)?.alive) return;
        // OBS (tsps): the impact on the tile, 38 high.
        this.animate(landed, null, [onTile(spotAnims.dragonfireImpact, tile, 0, 38)]);
        // OBS (REC): by where he stood before his step of this tick: a player a tile off then, and two off after
        // it, took 48. Hazards run before the step, so this is that.
        const you = landed.world.getPlayer();
        const distance = chebyshev(you.position, tile);
        if (distance > 1) return;
        const roll = this.randomInt([0, fireballMax]);
        this.hurt("Fireball", distance === 0 ? roll : Math.floor(roll / 2));
      });
    });
  }

  // --- the acid ------------------------------------------------------------------------
  startAcid(boss, player, context) {
    this.phase = "acid";
    this.nextAt = context.tick + acidNextAttackTicks;
    this.acid = { startedAt: context.tick, shots: 0 };
    const tiles = this.acidPoolTiles(boss, player);
    // OBS (REC, 15 of 15 acid phases): every pool leaves her head as it faces the player, not her middle.
    const from = this.head(boss, player.position);
    this.animate(context, "acid", [], tiles.map((tile) => tileProjectile(spotAnims.acid, from, tile, tileFlights.acid)));
    this.later(acidPoolLandTicks, () => {
      if (this.phase === "acid") this.pools = tiles;
    });
  }
  // OBS (tsps, 297 acid phases): one tile a cell of the 7 x 7 grid but its
  // middle, two a side just outside it, and the player's own tile; never under
  // her or where nothing can stand.
  acidPoolTiles(boss, player) {
    const pools = [];
    const seen = new Set();
    const open = (tile) => !seen.has(tile.join()) && !underBoss(boss.position, tile) && isArenaFootprintWalkable(tile, 1);
    const take = (tile) => {
      if (!open(tile)) return;
      seen.add(tile.join());
      pools.push(tile);
    };
    const { origin: [ox, oy], cells, cellSize, edgeNear, edgeFar, edgeSpread } = acidGrid;
    for (let cx = 0; cx < cells; cx++) {
      for (let cy = 0; cy < cells; cy++) {
        if (cx === cells >> 1 && cy === cells >> 1) continue;
        const candidates = [];
        for (let dx = 0; dx < cellSize; dx++) for (let dy = 0; dy < cellSize; dy++) {
          const tile = [ox + cx * cellSize + dx, oy + cy * cellSize + dy];
          if (open(tile)) candidates.push(tile);
        }
        if (candidates.length) take(this.pick(candidates));
      }
    }
    const span = cells * cellSize;
    const along = (first) => first + Math.floor(this.random() * edgeSpread);
    for (const tile of [
      [ox + along(edgeNear), oy - 1], [ox + along(edgeFar), oy - 1],
      [ox + along(edgeNear), oy + span], [ox + along(edgeFar), oy + span],
      [ox - 1, oy + along(edgeNear)], [ox - 1, oy + along(edgeFar)],
      [ox + span, oy + along(edgeNear)], [ox + span, oy + along(edgeFar)],
    ]) take(tile);
    take([...player.position]);
    return pools;
  }
  // A tick of the acid: a shot of rapid fire at the player's tile (it lands next
  // tick on whoever is still there), and the acid under him.
  tickAcid(boss, context) {
    const player = context.world.getPlayer();
    const elapsed = context.tick - this.acid.startedAt;
    if (!boss?.alive || !player.alive || elapsed >= acidForceEndTicks) {
      this.endAcid();
      return;
    }
    if (elapsed >= acidFirstShotTicks && this.acid.shots < acidRapidShots) {
      const tile = [...player.position];
      this.acid.shots++;
      // OBS (REC, 363 of 367 shots): from her head, toward the shot's tile.
      this.animate(context, null, [], [tileProjectile(spotAnims.rapid, this.head(boss, tile), tile, tileFlights.rapid)]);
      this.rapidTargets.push({ tile, landsAt: context.tick + 1 });
      this.later(1, (ctx) => {
        // OBS (tsps): on the tile, hit or miss, graphic 131, 30 high.
        this.animate(ctx, null, [onTile(spotAnims.rapidImpact, tile, 0, 30)]);
        if (sameTile(ctx.world.getPlayer().position, tile)) this.hurt("Rapid fire", rapidRange);
      });
      if (this.acid.shots >= acidRapidShots) {
        this.endAcid();
        return;
      }
    }
    if (this.pools.some((pool) => sameTile(pool, player.position))) {
      const amount = this.randomInt(poolRange);
      this.hurt("Acid", amount);
      healNpc(boss, amount, context.tickEvents);
    }
  }
  endAcid() {
    this.pools = [];
    this.acid = null;
    if (this.phase === "acid") this.phase = "active";
  }

  // --- the zombified spawn ---------------------------------------------------------------
  startSpawn(boss, player, context) {
    this.phase = "spawn";
    this.spawn = null;
    const { end, ticks } = this.shotTiming(boss, player);
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "breath", kind: "vorkath_ice", impactDelayTicks: ticks, projectiles: [this.shotVisual(spotAnims.ice, boss, player, end)] });
    // OBS (tsps): the ice block goes out with the shot, to land with the freeze.
    this.animate(context, null, [onActor(spotAnims.frozen, player, end, 0)]);
    this.later(ticks, (ctx) => {
      const you = ctx.world.getPlayer();
      const vorkath = this.boss(ctx.world);
      if (this.phase !== "spawn" || !vorkath?.alive || !you.alive) return this.endSpawn();
      this.frozenUntil = ctx.tick + freezeTicks;
      this.animate(ctx, "throw"); // the fireball's animation, under a name of its own: its sound is another (audio.js)
      const tile = this.spawnTile(vorkath, you);
      if (!tile) return this.endSpawn();
      // OBS (REC, 11 of 11): from her head as it faces the player, wherever the spawn lands.
      this.animate(ctx, null, [], [tileProjectile(spotAnims.spawnThrown, this.head(vorkath, you.position), tile, tileFlights.spawn)]);
      this.later(spawnThrowTicks, (landed) => {
        if (this.phase !== "spawn" || !this.boss(landed.world)?.alive || !landed.world.getPlayer().alive) return this.endSpawn();
        landed.spawnNpc(spawnDefinition.createActor(
          {
            id: spawnActorId, kind: "npc", role: "minion", npcTypeId: npcTypeIds.spawn, archetypeId: "vorkath-spawn", size: 1, alive: true,
            position: [...tile], previousPosition: [...tile], facing: 0, history: new Map(), spawnTick: landed.tick,
            vitals: { hp: spawnHitpoints, maxHp: spawnHitpoints }, formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.spawn)),
            passThruNpcs: true, // OBS (tsps): it walks through her
            combat: { attackSpeed: 4, attackRange: 1, attackStyle: "melee", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
              animations: { idle: null, walk: null, run: null, attack: null, death: null } },
          },
          {},
        ));
        this.spawn = { bornAt: landed.tick, exploding: false };
        this.later(1, (ctx) => {
          if (ctx.world.getNpc(spawnActorId)?.alive) this.animate(ctx, "land", [], [], spawnActorId);
        });
      });
    });
  }
  // OBS (tsps): 8 tiles from the player (then 7, 9, 6, 10), with a clear straight walk to him.
  spawnTile(boss, player) {
    const [px, py] = player.position;
    const clear = (from) => {
      let [x, y] = from;
      for (let guard = 0; guard < 64; guard++) {
        if (x === px && y === py) return true;
        x += Math.sign(px - x);
        y += Math.sign(py - y);
        if (underBoss(boss.position, [x, y]) || !isArenaFootprintWalkable([x, y], 1)) return false;
      }
      return false;
    };
    for (const distance of [spawnLandDistance, 7, 9, 6, 10]) {
      const ring = [];
      for (let dx = -distance; dx <= distance; dx++) for (let dy = -distance; dy <= distance; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const tile = [px + dx, py + dy];
        if (!underBoss(boss.position, tile) && isArenaFootprintWalkable(tile, 1) && clear(tile)) ring.push(tile);
      }
      if (ring.length) return this.pick(ring);
    }
    return null;
  }
  // Beside the player it explodes: a tick later the hit, by its hitpoints left (WIKI), and it is gone.
  tickSpawn(context) {
    const spawn = context.world.getNpc(spawnActorId);
    if (!this.spawn || !spawn?.alive || this.spawn.exploding) return;
    const player = context.world.getPlayer();
    const fuse = context.tick - this.spawn.bornAt > spawnFuseTicks;
    if (edgeDistance(spawn.position, 1, player.position) > 1 && !fuse) return;
    this.spawn.exploding = true;
    // OBS (tsps docs/vorkath.md): its attack, and watersurge_impact on its tile, 22 cycles on, 30 high.
    this.animate(context, "explode", [onTile(spotAnims.spawnExplosion, spawn.position, 22, 30)], [], spawnActorId);
    const hitpoints = spawn.vitals.hp;
    this.later(1, (ctx) => {
      if (this.phase !== "spawn") return;
      this.hurt("Zombified spawn", Math.floor((Math.max(0, Math.min(spawnHitpoints, hitpoints)) * spawnExplosionMax) / spawnHitpoints));
      if (ctx.world.getNpc(spawnActorId)) ctx.despawnNpc(spawnActorId);
      this.endSpawn();
    });
  }
  // OBS (REC): she attacks again as the spawn goes, on the tick it is gone (7 of 10; a tick off either way in the
  // others): 14 to 16 ticks after her icy breath.
  endSpawn() {
    this.frozenUntil = -1;
    this.spawn = null;
    if (this.phase === "spawn") {
      this.phase = "active";
      this.nextAt = this.now;
    }
  }

  // --- the player's hits ------------------------------------------------------------------
  getEngineRules() {
    return {
      playerDamageOnNpc: (damage, { target, attack }) => this.playerDamage(damage, target, attack),
      // WIKI (Zombified Spawn): Crumble Undead always hits it (for any magic attack bonus over -64) and kills it.
      playerAlwaysAccurate: (context, attack) => attack.target?.id === spawnActorId && playerSpellName(context.player) === "Crumble Undead",
      // The freeze of her icy breath (client/engine/SimulationEngine.js, playerMovementLocked).
      playerMovementLocked: (rules) => rules.tick < this.frozenUntil,
    };
  }
  playerDamage(damage, target, attack) {
    if (target.id === spawnActorId) return attack.spellId === "Crumble Undead" ? target.vitals.hp : damage;
    if (target.id !== bossActorId) return damage;
    if (this.phase === "rising" || this.phase === "spawn") return 0; // WIKI: immune while she rises and while the spawn is up
    if (this.phase === "acid") return Math.floor(damage / 2); // WIKI: a flat 50% reduction
    return damage;
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId === spawnActorId) {
      // WIKI: killing it unfreezes the player. OBS (REC): 3 ticks after the hit; she stays immune until it is gone.
      if (this.spawn && !this.spawn.exploding) {
        this.spawn = null;
        this.frozenUntil = defeat.tick + spawnUnfreezeTicks;
        this.tasks.push({ tick: defeat.tick + spawnDeathTicks, task: () => this.endSpawn() });
      }
      return;
    }
    if (defeat.npcId !== bossActorId) return;
    this.phase = "dead";
    this.tasks = [];
    this.pending = [];
    this.pools = [];
    this.acid = null;
    this.rapidTargets = [];
    this.fireballs = [];
    this.frozenUntil = -1;
    if (context.world.getNpc(spawnActorId)) context.despawnNpc(spawnActorId);
    this.spawn = null;
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  // The scene draws the acid from this (presentation.js); a script reads what is coming (tools/determinism/scenarios/vorkath.mjs).
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        attacksSinceSpecial: this.attacks,
        nextSpecial: this.nextSpecial,
        nextAttackAt: this.nextAt,
        acidPools: this.pools.map((tile) => [...tile]),
        rapidFire: this.rapidTargets.map(({ tile, landsAt }) => ({ tile: [...tile], landsAt })),
        fireballs: this.fireballs.map(({ tile, landsAt }) => ({ tile: [...tile], landsAt })),
        frozen: this.now < this.frozenUntil,
        spawnAlive: this.spawn !== null,
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel(npcId) {
    return npcId === bossActorId ? "Vorkath" : "Zombified spawn";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const vorkathDefinition = {
  kind: vorkathKind,
  factory: () => new VorkathEncounter(),
  descriptor: {
    kind: vorkathKind,
    displayName: "Vorkath",
    description: "Ungael. Ranged, magic and dragonfire breaths, a fireball to step off, acid and rapid fire, and the zombified spawn that freezes you.",
    mapSquare: vorkathMapSquare,
    playerStart,
    loadsMapLocs: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "VORKATH DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: vorkathLoadouts,
    // Her own judges of her combat achievements (client/combatAchievements/tracker.js).
    combatAchievements: vorkathCombatAchievements,
  },
  controls: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] },
};
export { vorkathDefinition as definition };
export const order = 85;
