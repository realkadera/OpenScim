// Scurrius, the Rat King (https://oldschool.runescape.wiki/w/Scurrius), in his
// lair under the Varrock Sewers: the solo version (a private instance, 500
// hitpoints).
//
// - Phase one: he walks in on the player and, beside him, swipes his tail
//   (up to 13) or stomps (7 to 3); out of reach he stomps. Every 4 ticks.
// - At 80% he runs to one of three food piles and eats there in rounds: each
//   turn a heal of 5 or 10 and an attack, 6 or 7 ticks apart: a bolt of
//   electricity (magic, up to 8), a fur ball (ranged, up to 7), a stomp, or a
//   call of six giant rats (rats.js). After three to five heals he gets up
//   (with a last stomp, 3 rounds in 10), walks two tiles off, swipes three to
//   five times, and runs back to a pile to eat again.
// - At 30% he runs to the middle of the room and stays: magic, ranged,
//   stomps and rats every 4 ticks. Healed above 30%, he goes back to eating.
// - A stomp brings rubble down on twelve tiles, one under the player and the
//   rest anywhere on the floor; it lands 9 ticks later for 15 to 22 on a
//   player who stood on one of them at the end of the tick before.
// - Bolts and fur balls land 4 ticks after the cast, whatever the distance,
//   against the protection prayer up as they land (WIKI: "can be blocked with
//   late reactions").
//
// Sources: WIKI Scurrius, Scurrius/Strategies and Giant rat (Scurrius); TABLE
// his stats and the rats' (client/data/monsters.js); OBS (tsps) RSPSApp/tsps
// docs/scurrius.md and server/plugins/bosses/scurrius/, which read the cache
// and rsprox captures of live kills (a main-game world, rev 241, six solo
// kills; Leagues and event worlds for animations, tiles and timings only).
// Numbers no source gives are marked inferred.
//
// Not yet: the public lair (7221, 1,500 hitpoints and higher max hits) as a
// variant; his eating idle as his stand at a pile (a base animation the
// default scene has no way to change); the projectiles leaving from a back
// corner of his body (tsps); of his sounds that are in no animation
// (audio.js), all but the bricks and the bolts and fur balls landing.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { isRatBoneWeapon } from "../../engine/playerAttack/profiles.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack, isNpcInAttackRange } from "../shared/npcAttack.js";
import { buildActorVisualTarget, getProjectileSourcePosition, faceActorToward, healNpc } from "../shared/npcHelpers.js";
import { canFootprintStepInArena, getNpcPursuitMoves, isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, spotAnims, mapSquare, bossSize, floor, bossStart, centreTile, playerStart, feedingSpots, onFloor, sameTile } from "./ids.js";
import { Rats, ratDefinition, ratWaveLimit, ratCallCooldownTicks, ratSpawnTicks } from "./rats.js";
import { scurriusLoadouts } from "./loadouts.js";

export const scurriusKind = "scurrius";
export const scurriusMapSquare = mapSquare;
export const bossActorId = "scurrius";

const firstAttackTick = 4; // OBS (tsps): he attacks 4 ticks after he appears
const attackSpeed = 4; // TABLE, OBS (tsps; Encounter Recorder: his swipes 4 ticks apart)
const feedingSpeeds = [6, 7]; // OBS (tsps): 6 or 7 ticks while he eats
const feedThreshold = 0.8; // WIKI
const enrageThreshold = 0.3; // WIKI
const maxHits = { melee: 13, magic: 8, ranged: 7 }; // WIKI: solo
const rubbleDamage = [15, 22]; // WIKI: solo
const rubbleTiles = 12; // OBS (tsps): 12 in 641 of 989 stomps, fewer where they overlapped
const rubbleLandTicks = 9; // OBS (tsps): 68 of 93 players on a tile were hit 9 ticks after the stomp
const debrisDelayCycles = 60; // OBS (tsps): the rubble's graphic, delayed 60 cycles
const distantHitTicks = 4; // OBS (tsps): 47 of 52 casts landed 4 ticks after, whatever the distance
// OBS (tsps): the projectiles fly from 30 to 120 cycles, 50 to 25 high, slope 40.
const flight = { startDelayCycles: 30, endDelayCycles: 120, slope: 40, startOffset: 0, startHeight: 50, endHeight: 25 };
export const splashSpotAnim = 85; // OBS (tsps): a bolt that misses splashes
const feedHeals = [3, 5]; // OBS (tsps): 3 to 5 heals a round, 10 rounds
const healWeights = [[10, 2], [5, 1]]; // OBS (tsps): 10 in 26 of 38 heals with no rats alive (WIKI: 5 or 10)
const healWithRats = 5; // OBS (tsps): 5 in all 4 heals with rats alive (WIKI: they get in the way)
const swipesBetween = [3, 5]; // OBS (tsps): 3 to 5 swipes between rounds
const lastTurnStomp = [3, 10]; // OBS (tsps): a round ends with a stomp in 3 of 10
const samePile = [5, 6]; // OBS (tsps): back to the same pile in 5 kills of 6
const stepOffTiles = 2; // OBS (tsps): 11 of 11 rounds
const stepOffTicks = 1; // OBS (tsps): a tick after he gets up
const stepOffAfterStompTicks = 5; // OBS (tsps): or as his last stomp finishes
const backToEatingTicks = 2; // OBS (tsps): about two ticks after the last swipe
const firstTurnTicks = 2; // OBS (tsps): his first turn, two ticks after he reaches a pile or the middle
const stuckTicks = attackSpeed; // inferred (tsps): out of reach without a step for an attack cycle, he stomps
const walkStallLimit = 10; // inferred (tsps): a walk that gets nowhere this long is given up
const deathTicks = 5; // OBS (tsps): he is removed 5 ticks into his death
const cardinals = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// OBS (tsps): his attacks' shares. Phase one beside his target: swipe 24,
// stomp 10. Eating: magic 18, ranged 18, stomp 7, rats 2. Below 30%: magic 8,
// ranged 8, stomp 13, rats 4.
const phaseOne = [["melee", 7], ["stomp", 3]];
const eating = [["magic", 4], ["ranged", 4], ["stomp", 2], ["summon", 1]];
const enraged = [["magic", 2], ["ranged", 2], ["stomp", 3], ["summon", 1]];

const bossDefinition = defineNpc({
  id: "scurrius",
  move: ({ actor, context, config }) => config.moveBoss(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

const onTile = (spotAnimId, position, delayCycles = 0) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height: 0, delayCycles, onGround: true });
const onActor = (spotAnimId, actor) => ({ spotAnimId, target: buildActorVisualTarget(actor), height: 0, delayCycles: 0 });

class ScurriusEncounter {
  kind = scurriusKind;
  // The fight's world, for the engine rules (getEngineRules), which are asked of a target alone. Private, so the
  // encounter's state (snapshots, digests) leaves it out.
  #world = null;
  constructor() {
    this.rats = new Rats(this);
    this.definitions = new NpcDefinitionRegistry([bossDefinition, ratDefinition].map((definition) => definition.register(this)));
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
    this.incoming = []; // rubble on its way: { kind: "rubble", tiles, landsAt }
    // "one" | "walking-pile" | "feeding" | "rising" | "stepping" | "between" | "walking-centre" | "enraged" | "dead"
    this.phase = "one";
    this.nextAt = firstAttackTick;
    this.walk = null; // { dest, steps, onArrive, stalls }
    this.spot = null;
    this.feeding = null; // { heals, of }
    this.swingsLeft = 0;
    this.stall = null; // between rounds: { at, since }
    this.ratWaves = 0;
    this.lastCallAt = -Infinity;
    this.rats.reset();
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }
  chance([times, outOf]) {
    return this.random() * outOf < times;
  }
  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }
  weighted(choices, allowed = () => true) {
    const pool = choices.filter(([name]) => allowed(name));
    let roll = this.random() * pool.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [name, weight] of pool) {
      roll -= weight;
      if (roll < 0) return name;
    }
    return pool[pool.length - 1][0];
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }

  // --- what the engine always calls ------------------------------------------
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
    boss.facing = 0;
    delete boss.lockedFacing;
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.solo); // TABLE: 500
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.solo, archetypeId: "scurrius", size: bossSize, alive: true,
          // OBS (tsps): he appears facing south.
          position: [...bossStart], previousPosition: [...bossStart], facing: 0, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.solo)),
          combat: {
            attackSpeed, attackRange: 1, attackStyle: "melee", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
    ];
  }

  // --- every tick --------------------------------------------------------------
  // Before the NPCs: what is due (rubble, rats), and the phase his hitpoints call for.
  resolveHazards(context) {
    this.now = context.tick;
    this.#world = context.world;
    for (let due = this.takeDueTask(); due; due = this.takeDueTask()) due.task(context);
    this.incoming = this.incoming.filter((entry) => entry.landsAt > this.now);
    const boss = this.boss(context.world);
    if (boss?.alive && this.phase !== "dead") this.advancePhase(boss);
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

  // --- his phases --------------------------------------------------------------
  // inferred: checked every tick, as a hit takes him past a threshold (tsps checks on each hit and each turn).
  advancePhase(boss) {
    const ratio = boss.vitals.hp / boss.vitals.maxHp;
    if (ratio <= enrageThreshold) {
      if (this.phase !== "enraged" && this.phase !== "walking-centre") this.enrage(boss);
      return;
    }
    if (this.phase === "enraged") this.goEat(boss); // WIKI: healed above 30%, he goes back to eating
    else if (this.phase === "one" && ratio <= feedThreshold) this.goEat(boss);
  }
  // OBS (tsps): he faces the pile he eats from, attacks included, and in the
  // middle the way his last step went until a stomp turns him to the player's
  // tile; walking, he faces where he walks. Without a lock the engine and the
  // scene turn an NPC to its target every tick.
  lockFacing(boss, facing = boss.facing) {
    boss.facing = facing;
    boss.lockedFacing = facing;
  }
  unlockFacing(boss) {
    delete boss.lockedFacing;
  }
  goEat(boss) {
    this.phase = "walking-pile";
    this.feeding = null;
    this.unlockFacing(boss);
    const spot = this.spot && this.chance(samePile) ? this.spot : this.pick(feedingSpots);
    this.walkTo(spot.stand, 2, (arrived) => {
      if (this.phase !== "walking-pile") return;
      this.phase = "feeding";
      this.spot = spot;
      this.feeding = { heals: 0, of: this.randomInt(feedHeals) };
      this.nextAt = this.now + firstTurnTicks;
      faceActorToward(arrived, { position: spot.face, size: 1 });
      this.lockFacing(arrived);
    });
  }
  enrage(boss) {
    this.phase = "walking-centre";
    this.feeding = null;
    this.unlockFacing(boss);
    this.walkTo(centreTile, 2, (arrived) => {
      if (this.phase !== "walking-centre") return;
      this.phase = "enraged";
      this.nextAt = this.now + firstTurnTicks;
      this.lockFacing(arrived); // the way his last step went
    });
  }
  // He gets up from the pile; a tick later (5 after a last stomp) he walks two
  // tiles off it in a straight line, any way but towards the pile.
  finishFeeding(stomped) {
    this.feeding = null;
    this.phase = "rising";
    this.swingsLeft = this.randomInt(swipesBetween);
    this.stall = null;
    this.later(stomped ? stepOffAfterStompTicks : stepOffTicks, (context) => {
      if (this.phase !== "rising") return;
      const boss = this.boss(context.world);
      if (!boss?.alive) return;
      const ways = cardinals
        .filter(([dx, dy]) => dx !== this.spot.pile[0] || dy !== this.spot.pile[1])
        .map(([dx, dy]) => [boss.position[0] + dx * stepOffTiles, boss.position[1] + dy * stepOffTiles])
        .filter((tile) => this.roomFor(tile));
      this.unlockFacing(boss);
      if (ways.length === 0) {
        this.phase = "between";
        return;
      }
      this.phase = "stepping";
      this.walkTo(this.pick(ways), 1, (arrived) => {
        if (this.phase !== "stepping") return;
        this.unlockFacing(arrived); // back to the player, to swipe
        this.phase = "between";
        this.nextAt = Math.max(this.nextAt, this.now + 1); // inferred: he swings once his walk is done
      });
    });
  }
  // His whole body on the floor, with its south-west corner on `tile`.
  roomFor(tile) {
    return onFloor(tile) && onFloor([tile[0] + bossSize - 1, tile[1] + bossSize - 1]) && isArenaFootprintWalkable(tile, bossSize);
  }
  walkTo(dest, steps, onArrive) {
    this.walk = { dest: [...dest], steps, onArrive, stalls: 0 };
  }

  // --- his movement --------------------------------------------------------------
  // A scripted walk or run (OBS, tsps: two tiles a tick to the food and the
  // middle), through the player and his rats; in phase one and between rounds
  // he walks in on the player; eating and in the middle he keeps his place.
  moveBoss(boss, context) {
    if (!boss.alive || this.phase === "dead") return [];
    if (this.walk) {
      const path = [];
      let at = boss.position;
      for (let n = 0; n < this.walk.steps && !sameTile(at, this.walk.dest); n++) {
        const dx = Math.sign(this.walk.dest[0] - at[0]);
        const dy = Math.sign(this.walk.dest[1] - at[1]);
        const next = [[at[0] + dx, at[1] + dy], [at[0] + dx, at[1]], [at[0], at[1] + dy]]
          .filter(([x, y]) => x !== at[0] || y !== at[1])
          .find((tile) => canFootprintStepInArena(at, tile, { width: bossSize, height: bossSize }));
        if (!next) break;
        path.push(next);
        at = next;
      }
      if (path.length === 0) {
        this.walk.stalls++;
        return [];
      }
      // OBS (Encounter Recorder): on his way he no longer faces the player but where he goes (east, all the way to
      // the east pile), as the lockFacing note above says; held until he arrives.
      faceActorToward(boss, { position: path[path.length - 1], size: bossSize });
      this.lockFacing(boss);
      // OBS (Encounter Recorder): two tiles a tick, he runs (his run sequence, ids.js); one, he walks.
      if (path.length > 1) this.animate(context, "run");
      return [{ npcId: boss.id, path }];
    }
    if (this.phase === "one" || this.phase === "between") return getNpcPursuitMoves(boss, context);
    return [];
  }

  // --- his turn ---------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (this.walk) {
      if (sameTile(boss.position, this.walk.dest) || this.walk.stalls > walkStallLimit) {
        const { onArrive } = this.walk;
        this.walk = null;
        onArrive(boss);
      }
      return none;
    }
    const inReach = player.alive && isNpcInAttackRange(boss, player, 1);
    if (this.phase === "between") this.trackStall(boss, inReach);
    if (context.tick < this.nextAt || !player.alive) return none;
    // At the pile, his last turn (a stomp as he gets up) is still one of his eating ones.
    const feeding = this.phase === "feeding";
    let action = null;
    if (this.phase === "one") action = inReach ? this.weighted(phaseOne) : "stomp";
    else if (this.phase === "between") action = inReach ? "melee" : this.stuck() ? "stomp" : null;
    else if (this.phase === "feeding") action = this.feedingTurn(boss, context);
    else if (this.phase === "enraged") action = this.weighted(enraged, (name) => this.canSummon(name, context.world));
    if (action === null) return none;
    const result = { environmentalDamages: [], npcAttacks: [] };
    if (action === "melee") result.npcAttacks.push(this.swipe(boss, player, context));
    else if (action === "stomp") this.stomp(boss, player, context, feeding);
    else if (action === "summon") this.summon(boss, context, feeding);
    else result.npcAttacks.push(this.cast(action, boss, player, context, feeding));
    this.nextAt = context.tick + (feeding ? this.randomInt(feedingSpeeds) : attackSpeed);
    if (this.phase === "between" && --this.swingsLeft <= 0) {
      this.later(backToEatingTicks, (ctx) => {
        const scurrius = this.boss(ctx.world);
        if (this.phase === "between" && scurrius?.alive) this.goEat(scurrius);
      });
    }
    return result;
  }
  // Between rounds: out of reach without a step for an attack cycle (his rats walling him off).
  trackStall(boss, inReach) {
    if (inReach) {
      this.stall = null;
      return;
    }
    if (!this.stall || !sameTile(this.stall.at, boss.position)) this.stall = { at: [...boss.position], since: this.now };
  }
  stuck() {
    return this.stall !== null && this.now - this.stall.since >= stuckTicks;
  }
  canSummon(name, world) {
    return name !== "summon" || (this.ratWaves < ratWaveLimit && this.now - this.lastCallAt >= ratCallCooldownTicks && !this.rats.anyAlive(world));
  }
  // A turn at the pile: a heal, then an attack, until the round's heals are
  // done; the turn after the last heal he gets up, sometimes with a stomp.
  feedingTurn(boss, context) {
    if (this.feeding.heals >= this.feeding.of) {
      const stomped = this.chance(lastTurnStomp);
      this.finishFeeding(stomped);
      return stomped ? "stomp" : null;
    }
    this.feeding.heals++;
    const amount = this.rats.anyAlive(context.world) ? healWithRats : this.weighted(healWeights);
    healNpc(boss, amount, context.tickEvents);
    return this.weighted(eating, (name) => this.canSummon(name, context.world));
  }
  // The attack helpers turn him to the player: back to his locked facing, if he has one.
  keepFacing(boss) {
    if (boss.lockedFacing !== undefined) boss.facing = boss.lockedFacing;
  }
  animate(context, clipId, graphics = []) {
    emitInfernoVisual(context.tickEvents, { animations: clipId ? [{ actorId: bossActorId, clipId, delayCycles: 0 }] : [], projectiles: [], graphics });
  }

  // The tail swipe: melee, landing on the swing's tick (OBS, tsps; OBS, Encounter Recorder: all 32 swipes of three
  // solo kills, rev 243, up to 13; a fourth: Protect from Melee blocked all 9 it was up for). inferred: slash (the wiki
  // names no style, and a hitsplat shows none).
  swipe(boss, player, context) {
    const attack = rollNpcAttack({
      attacker: boss,
      target: player,
      plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", maxHit: maxHits.melee, impactDelayTicks: 0, sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Scurrius");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "melee", kind: "scurrius_melee", impactDelayTicks: 0 });
    return attack;
  }
  // A bolt of electricity or a fur ball, rolled now and judged against the prayer as it lands.
  cast(kind, boss, player, context, feeding) {
    const magic = kind === "magic";
    const attack = rollNpcAttack({
      attacker: boss,
      target: player,
      plan: {
        formulaStyle: magic ? "magic" : "ranged", damageType: magic ? "magic" : "range", attackKind: magic ? "magic_fire" : "range_arrow",
        maxHit: magic ? maxHits.magic : maxHits.ranged, impactDelayTicks: distantHitTicks, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact",
      },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Scurrius");
    const projectile = { spotAnimId: magic ? spotAnims.magicProjectile : spotAnims.rangedProjectile, sourcePosition: getProjectileSourcePosition(boss), target: buildActorVisualTarget(player), ...flight };
    const clipId = feeding ? (magic ? "feedingMagic" : "feedingRanged") : kind;
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId, kind: "scurrius_" + kind, impactDelayTicks: distantHitTicks, projectiles: [projectile] });
    this.keepFacing(boss);
    if (magic) this.animate(context, null, [onActor(feeding ? spotAnims.feedingMagicCast : spotAnims.magicCast, boss)]);
    const impact = magic ? (attack.accuracySucceeded ? spotAnims.magicImpact : splashSpotAnim) : spotAnims.rangedImpact;
    this.later(distantHitTicks, (ctx) => {
      if (!this.boss(ctx.world)?.alive) return;
      // scurriusLanding: what audio.js hears it by (the splash's graphic is every fight's).
      emitInfernoVisual(ctx.tickEvents, { animations: [], projectiles: [], graphics: [onActor(impact, ctx.world.getPlayer())], scurriusLanding: true });
    });
    return attack;
  }
  // Rubble on twelve tiles: one under the player, the rest anywhere on the floor.
  stomp(boss, player, context, feeding) {
    // OBS (tsps): in the middle a stomp turns him to the player's tile, and he keeps that facing until the next.
    if (this.phase === "enraged") {
      faceActorToward(boss, player);
      this.lockFacing(boss);
    } else if (boss.lockedFacing === undefined) faceActorToward(boss, player);
    const tiles = [[...player.position]];
    const taken = new Set([player.position.join()]);
    for (let attempt = 0; tiles.length < rubbleTiles && attempt < rubbleTiles * 4; attempt++) {
      const tile = [floor.minX + Math.floor(this.random() * (floor.maxX - floor.minX + 1)), floor.minY + Math.floor(this.random() * (floor.maxY - floor.minY + 1))];
      if (taken.has(tile.join()) || !isArenaFootprintWalkable(tile, 1)) continue;
      taken.add(tile.join());
      tiles.push(tile);
    }
    const landsAt = context.tick + rubbleLandTicks;
    this.animate(context, feeding ? "feedingStomp" : "stomp", tiles.map((tile) => onTile(spotAnims.debris, tile, debrisDelayCycles)));
    this.incoming.push({ kind: "rubble", tiles, landsAt });
    this.later(rubbleLandTicks, (ctx) => {
      const you = ctx.world.getPlayer();
      if (!this.boss(ctx.world)?.alive || !you.alive) return;
      if (tiles.some((tile) => sameTile(tile, you.position))) {
        this.pending.push({ baseDamage: rubbleDamage, attackType: "typeless", source: "Falling bricks", playerPosition: [...you.position] });
      }
    });
  }
  summon(boss, context, feeding) {
    this.ratWaves++;
    this.lastCallAt = context.tick;
    this.animate(context, feeding ? "feedingSummon" : "enragedSummon");
    this.later(ratSpawnTicks, (ctx) => {
      if (this.boss(ctx.world)?.alive) this.rats.spawnWave(ctx);
    });
  }

  // --- the player's hits ------------------------------------------------------
  // WIKI: any hit of the player's kills a giant rat; inferred: one that misses too (tsps).
  getEngineRules() {
    return {
      playerDamageOnNpc: (damage, { target }) => (this.rats.isRat(target) ? target.vitals.hp : damage),
      playerAlwaysAccurate: (context, attack) => this.rats.isRat(attack.target),
      // WIKI (Bone mace, Bone shortbow, Bone staff): "no attack cooldown when attacking the giant rats that Scurrius
      // summons": a rat is attacked whatever the timer, and the timer stays as it was.
      playerAttackOnCooldown: (target) => (this.ratBoneOnRat(target) ? { keepCooldown: true } : undefined),
      playerAttackKeepsReady: (target) => this.ratBoneOnRat(target),
    };
  }
  ratBoneOnRat(target) {
    return this.rats.isRat(target) && isRatBoneWeapon(this.#world?.getPlayer()?.equipment?.weapon);
  }

  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    this.phase = "dead";
    this.tasks = [];
    this.pending = [];
    this.incoming = [];
    this.walk = null;
    this.feeding = null;
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  // What a script reads (tools/determinism/scenarios/scurrius.mjs) and the interface shows.
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        nextAttackAt: this.nextAt,
        pile: this.spot?.name ?? null,
        heals: this.feeding ? { taken: this.feeding.heals, of: this.feeding.of } : null,
        swingsLeft: this.swingsLeft,
        ratWaves: this.ratWaves,
        incoming: this.incoming.filter((entry) => entry.landsAt > this.now),
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel(npcId) {
    return npcId === bossActorId ? "Scurrius" : "Giant rat";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const scurriusDefinition = {
  kind: scurriusKind,
  factory: () => new ScurriusEncounter(),
  descriptor: {
    kind: scurriusKind,
    displayName: "Scurrius",
    description: "The Rat King under Varrock. Tail swipes, then eating at his food piles while he throws bolts and fur balls, falling bricks and giant rats, and the middle of his lair below 30%.",
    mapSquare: scurriusMapSquare,
    playerStart,
    loadsMapLocs: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "SCURRIUS DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: scurriusLoadouts,
  },
  controls: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] },
};
export { scurriusDefinition as definition };
export const order = 80;
