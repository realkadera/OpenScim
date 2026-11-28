// The Mad Angel (https://oldschool.runescape.wiki/w/Mad_Angel), the
// post-quest golem in the nave of Ardeaglais, on Wyrmscraig.
//
// She wakes as the fight starts and walks after the player. Her standard
// attack is melee, every 6 ticks, up to 31; Protect from Melee leaves up to 5
// of it. After three standard attacks she does a special, in turn:
// - blast: a ball of light thrown to a tile; standing on the tile bounces it
//   back to her, three times; one that lands explodes over the whole nave.
//   Her standard attacks go on meanwhile.
// - sweep: she draws her sword to a side and cleaves, four times (six
//   enraged), the side the player is on and the side she drew from.
// - smite: lightning, once (three strikes enraged), for Protect from Magic.
// At 350 hitpoints she enrages ("...!"): her specials come quicker, and from
// then on one after another, the three of them first.
//
// Her mechanics are whole: a cleave dodged to her side earns the player's
// next attack a sure hit of at least half his maximum, a perfect prayer
// against her smite a maximum hit.
//
// Sources: WIKI Mad Angel and Mad Angel/Strategies; TABLE her stats
// (client/data/monsters.js, 16305); CACHE her ids (ids.js); OBS one kill
// recorded with the Encounter Recorder (2026-11-26, 248 ticks), which gives
// the ticks. Numbers no source gives are marked inferred.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { getNpcPursuitMoves, isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, seqIds, spotAnims, soundIds, mapSquare, bossSize, bossStart, playerStart } from "./ids.js";
import { madAngelLoadouts } from "./loadouts.js";

export const madAngelKind = "mad_angel";
export const madAngelMapSquare = mapSquare;
export const bossActorId = "mad-angel";

const wakeTick = 1; // inferred: she wakes on the fight's first tick (OBS: the wake 2 ticks into the recording, which began before it)
const awakeAfterTicks = 3; // OBS: 16307 on the wake's tick, 16305 three ticks later; inferred: untouchable till then
const firstAttackAfterTicks = 4; // OBS: the wake t2, her first swing t6
const attackSpeed = 6; // TABLE, WIKI, OBS: swings 6 ticks apart
const standardsBetweenSpecials = 3; // WIKI, OBS: three standard attacks after a special, then the next
const specialOrder = ["blast", "sweep", "smite"]; // OBS: blast t24, sweep t66, smite t114, and again (one kill)
// The setup menu's switches, one a special, all on: one switched off is skipped and the next one on comes instead; with
// none on she only swings, enraged too. For practising one special at a time.
const specialKeys = { blast: "madAngelBlast", sweep: "madAngelSweep", smite: "madAngelSmite" };
const defaultMechanics = Object.fromEntries(Object.values(specialKeys).map((key) => [key, true]));
const specialToggles = [
  { key: specialKeys.blast, label: "Blast", info: "The ball of light: stand on its tile to bounce it back to her." },
  { key: specialKeys.sweep, label: "Sweep", info: "Her sword's cleaves: step to the side opposite the sword, or behind her." },
  { key: specialKeys.smite, label: "Smite", info: "Her lightning: Protect from Magic on the tick it strikes." },
].map((toggle) => ({ ...toggle, section: "Specials", setup: true }));
const meleeMaxHit = 31; // WIKI: "will reduce the max hit of its standard attacks from 31 to 5"
const meleePrayedShare = 5 / 31; // WIKI; OBS: prayed hits of 0 to 5
const meleeImpactTicks = 2; // OBS: each hitsplat 2 ticks after her swing
const enrageHitpoints = 350; // WIKI: "Upon reaching 350 Hitpoints (~45%)"
const enrageToSpecialTicks = 4; // OBS: "...!" t144, her first enraged special t148
const deathTicks = 5; // inferred: her death animation t249, the recording stopped by hand at t256

// The specials' timing (OBS), in ticks from the special's start.
const blast = {
  releaseTicks: 1, // OBS: the ball leaves the tick after her throw (the animation t24, the projectile t25)
  flightTicks: 5, // OBS: it lands 150 cycles after it leaves
  flightTicksEnraged: 4, // OBS: 120 cycles
  throws: 3, // WIKI, OBS: bounced back three times
  rethrowTicks: 1, // OBS: thrown again, as a projectile alone, the tick after it lands (landed t30, thrown t31, landed t36)
  flight: { startHeight: 220, endHeight: 30, slope: 40 }, // OBS: the projectile's heights and slope
  back: { cycles: 30, startHeight: 30, endHeight: 220, slope: 17 }, // OBS: back to her in 30 cycles
  reach: 2, // OBS: every throw within 2 tiles of the player; WIKI: since 19 August 2026 it can be his own tile
  bounceDamage: [18, 22], // WIKI; OBS 19, 20, 18
  bounceHitTicks: 2, // OBS: her hitsplat 2 ticks after the ball comes back (t30 -> t32, t36 -> t38, t42 -> t44)
  explosionDamage: [30, 35], // WIKI "30+"; OBS 33, 32 unprotected. inferred: 35 at most
  explosionPrayedShare: 0.5, // WIKI: "can be reduced by ~50% with Protect from Magic"
};
const sweep = {
  cleaves: 4, // WIKI, OBS
  cleavesEnraged: 6, // WIKI, OBS
  everyTicks: 6, // OBS: t66 drawn, cleaves t72, t78, t84, t90
  everyTicksEnraged: 4, // OBS: t160 drawn, cleaves t164 to t184
  // OBS (15 cleaves, graphic 2184 on each tile swept): a cleave sweeps the half of the nave in front of her and on her
  // sword's side, cut along a diagonal through her middle tile; the tiles on the diagonal by this margin (0 within 2
  // tiles of the recording, the enraged ones 1).
  margin: 0,
  marginEnraged: 1,
  damage: [22, 28], // inferred: OBS 11 to 14 through Protect from Melee, which WIKI halves it
  prayedShare: 0.5, // WIKI: "Protect from Melee will reduce the damage from being caught in this attack by ~50%"
  // WIKI: "If an attack is successfully dodged to the side (not behind it), the player's next attack will be 100%
  // accurate and have its minimum hit raised to 50% of their maximum hit." inferred: rounded down.
  dodgedMinimumShare: 0.5,
};
// The four ways she faces, and her left of each (as she faces south, her left is east).
const directions = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const leftOf = ([fx, fy]) => [-fy, fx];
// The engine's angle of each (computeFacingFromDelta, client/engine/SimulationEngine.js). OBS: through a sweep she
// holds one of these, turning only right after a cleave (t72 south, t73 north, held till the cleave at t78).
const facingAngles = { S: 0, W: 512, N: 1024, E: 1536 };
const smite = {
  // OBS: the strike, its sounds (12070, 12071) and its hitsplat, 6 ticks after her smite (t114 -> t120); enraged 6, 10
  // and 12 (t190 -> t196, t200, t202). WIKI: the tick to pray on is "4 ticks after ... the blue crackling first becomes
  // visible" (OBS: its sounds from t+1, t+2) and, enraged, "4 ticks after the first, ... 2 ticks after the second".
  strikeTicks: 6,
  strikesEnraged: [6, 10, 12],
  impactLeadTicks: 1, // OBS: the impact graphic on the player the tick before each strike (t119, t195, t199, t201)
  damage: [28, 32], // inferred: OBS 29 to 32 unprayed; WIKI her max hit 32
  prayedShare: 0.25, // WIKI: "Simply having the prayer overhead will reduce the damage by ~75%"
};
// Her next turn, from the tick a special ends: the tick after its last cleave or its last strike.
// OBS: the last cleave t90 -> t96, the smite's hit t120 -> t126; inferred the blast (t158 -> t160, t223 -> t226).
const nextTurnAfterSpecialTicks = { blast: 3, sweep: attackSpeed - 1, smite: attackSpeed - 1 };

const bossDefinition = defineNpc({
  id: "mad-angel",
  // OBS: she walks after the player, but stands while she sweeps and smites.
  move: ({ actor, context, config }) => (config.standsStill() ? [] : getNpcPursuitMoves(actor, context)),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

const onTile = (spotAnimId, position, delayCycles = 0, height = 0) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height, delayCycles, onGround: true });
const onActor = (spotAnimId, actor, delayCycles = 0, height = 0) => ({ spotAnimId, target: buildActorVisualTarget(actor), height, delayCycles });
const centreOf = (position) => [position[0] + (bossSize >> 1), position[1] + (bossSize >> 1)];

class MadAngelEncounter {
  kind = madAngelKind;
  constructor() {
    this.definitions = new NpcDefinitionRegistry([bossDefinition].map((definition) => definition.register(this)));
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
    this.postTasks = [];
    this.pending = [];
    this.arenaTiles = null;
    this.phase = "waking"; // "waking" | "fighting" | "dead"
    this.nextAt = wakeTick + firstAttackAfterTicks;
    this.standards = 0; // standard attacks since the last special ended
    this.nextSpecial = 0; // its index in specialOrder
    this.special = null; // { name, startedAt, endsAt, ... }
    this.magicPrayedLastTick = false; // Protect from Magic on at the end of the last tick
    this.maxHitEarned = false; // a perfect prayer against a smite: the player's next attack is a maximum hit
    this.sideDodged = false; // a cleave dodged to her side: the player's next attack is sure, and at least half his maximum
    this.enraged = false;
    this.enrageAnnounced = false;
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  // A task for after the player has moved on its tick (processPostTick): what a landing or a cleave finds him on.
  laterAfterMove(ticks, task) {
    this.postTasks.push({ tick: this.now + ticks, task });
  }
  takeDueTask() {
    const index = this.tasks.findIndex((entry) => entry.tick <= this.now);
    return index < 0 ? null : this.tasks.splice(index, 1)[0];
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }
  // A visual event: her clip, the projectiles and graphics, and the sounds of no animation, which her audio layer plays
  // (audio.js): `madAngelSounds`, each { id, position }.
  animate(context, clipId, graphics = [], projectiles = [], sounds = []) {
    emitInfernoVisual(context.tickEvents, {
      animations: clipId ? [{ actorId: bossActorId, clipId, delayCycles: 0 }] : [],
      projectiles,
      graphics,
      ...(sounds.length ? { madAngelSounds: sounds.map(({ id, position }) => ({ id, position: [...position] })) } : {}),
    });
  }
  // She stands while she sweeps and smites (OBS), and while she wakes.
  standsStill() {
    return this.phase !== "fighting" || (this.special !== null && this.special.name !== "blast");
  }

  // --- what the engine always calls --------------------------------------------
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return { ...defaultMechanics };
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
    this.releaseFacing(boss);
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.madAngel); // TABLE: 755
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.madAngel, archetypeId: "mad_angel", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 0, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.madAngel)),
          combat: {
            attackSpeed, attackRange: 1, attackStyle: "melee", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
    ];
  }

  // --- every tick ----------------------------------------------------------------
  resolveHazards(context, mechanics) {
    if (mechanics) this.mechanics = mechanics;
    this.now = context.tick;
    this.context = context;
    for (let due = this.takeDueTask(); due; due = this.takeDueTask()) due.task(context);
    return [];
  }
  processPostTick(context) {
    this.now = context.tick;
    this.context = context;
    for (let index = this.postTasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.postTasks.findIndex((entry) => entry.tick <= this.now)) {
      this.postTasks.splice(index, 1)[0].task(context);
    }
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    this.magicPrayedLastTick = this.praysMagic(context.world.getPlayer());
    const damages = this.pending;
    this.pending = [];
    return damages;
  }
  hurt(source, baseDamage, attackType, prayedShare) {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage, attackType, prayerReduction: { type: "reduce", value: prayedShare }, playerPosition: [...player.position] });
  }
  // The tiles of the nave the player can stand on (the explosion's, and the cleaves' within it).
  arena() {
    if (!this.arenaTiles) {
      this.arenaTiles = [];
      for (let x = 0; x < 64; x++) for (let y = 0; y < 64; y++) if (isArenaFootprintWalkable([x, y], 1)) this.arenaTiles.push([x, y]);
    }
    return this.arenaTiles;
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  // --- her turn ---------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (this.phase === "waking") {
      if (context.tick === wakeTick) this.animate(context, "wake", [onActor(spotAnims.wake, boss)]);
      if (context.tick >= wakeTick + awakeAfterTicks) this.phase = "fighting";
      if (this.phase === "waking") return none;
    }
    if (this.special && context.tick >= this.special.endsAt) this.endSpecial(context);
    if (context.tick < this.nextAt || !player.alive) return none;
    // The blast lets her standard attacks go on; the others hold them till they end.
    if (this.special && this.special.name !== "blast") return none;
    if (!this.special && !this.enraged && boss.vitals.hp <= enrageHitpoints) return this.enrage(boss, context);
    const next = this.special ? null : this.nextEnabledSpecial();
    if (next && (this.enraged || this.standards >= standardsBetweenSpecials)) {
      this.startSpecial(next, boss, player, context);
      return none;
    }
    this.nextAt = context.tick + attackSpeed;
    if (!this.special) this.standards++;
    return { environmentalDamages: [], npcAttacks: [this.melee(boss, player, context)] };
  }
  // WIKI: at 350 she enrages "at the next available opportunity", with "...!" over her head.
  enrage(boss, context) {
    this.enraged = true;
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: "...!", overheadCycle: 90 });
    this.nextAt = context.tick + enrageToSpecialTicks;
    this.nextSpecial = 0; // WIKI: all three of her specials, one after another, the blast first (OBS)
    return { environmentalDamages: [] };
  }
  melee(boss, player, context) {
    // inferred: slash, her sword; prayer counted as it lands (OBS: the hitsplat 2 ticks after the swing).
    const attack = rollNpcAttack({
      attacker: boss, target: player,
      plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", maxHit: meleeMaxHit, impactDelayTicks: meleeImpactTicks, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for the Mad Angel");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "melee", kind: "mad_angel_melee", impactDelayTicks: meleeImpactTicks });
    return { ...attack, prayerReduction: { type: "reduce", value: meleePrayedShare } };
  }

  // --- her specials -------------------------------------------------------------------
  // Her next special in turn that the setup has on, or none.
  nextEnabledSpecial() {
    for (let n = 0; n < specialOrder.length; n++) {
      const name = specialOrder[(this.nextSpecial + n) % specialOrder.length];
      if (this.mechanics?.[specialKeys[name]] !== false) return name;
    }
    return null;
  }
  startSpecial(name, boss, player, context) {
    this.nextSpecial = (specialOrder.indexOf(name) + 1) % specialOrder.length;
    this.standards = 0;
    if (name === "blast") this.startBlast(boss, player, context);
    else if (name === "sweep") this.startSweep(boss, player, context);
    else this.startSmite(boss, player, context);
    this.nextAt = name === "blast" ? context.tick + attackSpeed : this.special.endsAt;
  }
  // A special over: sweep and smite give her next turn 6 ticks on; the blast left her standard attacks going. Enraged,
  // her next turn is her next special.
  endSpecial(context) {
    const name = this.special.name;
    this.special = null;
    if (name === "sweep") this.releaseFacing(this.boss(context.world));
    if (name !== "blast" || this.enraged) this.nextAt = Math.max(this.nextAt, context.tick + nextTurnAfterSpecialTicks[name]);
  }
  // A ball of light thrown to a tile near the player. On the tile as it lands, he bounces it back to her for 18 to 22, and
  // she throws it again; three times. Off it, it explodes over the whole nave and the blast is over.
  startBlast(boss, player, context) {
    const flight = this.enraged ? blast.flightTicksEnraged : blast.flightTicks;
    this.special = { name: "blast", startedAt: context.tick, endsAt: Infinity, flight, throwsLeft: blast.throws, ball: null };
    this.animate(context, "blast", [onActor(spotAnims.blastThrow, boss)]);
    this.later(blast.releaseTicks, (ctx) => this.releaseBall(ctx));
  }
  // inferred: any tile within 2 of the player he can stand on (OBS: all within 2).
  ballTile(player) {
    const tiles = [];
    for (let dx = -blast.reach; dx <= blast.reach; dx++) {
      for (let dy = -blast.reach; dy <= blast.reach; dy++) {
        const tile = [player.position[0] + dx, player.position[1] + dy];
        if (isArenaFootprintWalkable(tile, 1)) tiles.push(tile);
      }
    }
    return tiles.length ? tiles[Math.floor(this.random() * tiles.length)] : [...player.position];
  }
  releaseBall(context) {
    const boss = this.boss(context.world);
    const player = context.world.getPlayer();
    const special = this.special;
    if (!boss?.alive || special?.name !== "blast") return;
    const tile = this.ballTile(player);
    const from = centreOf(boss.position);
    special.ball = { tile, landsAt: context.tick + special.flight };
    this.animate(
      context,
      null,
      [onTile(spotAnims.shadow, tile)],
      [{ spotAnimId: spotAnims.ball, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: { kind: "tile", position: [...tile] }, startDelayCycles: 0, endDelayCycles: special.flight * 30, slope: blast.flight.slope, startOffset: 0, startHeight: blast.flight.startHeight, endHeight: blast.flight.endHeight }],
    );
    this.laterAfterMove(special.flight, (ctx) => this.landBall(ctx));
  }
  landBall(context) {
    const boss = this.boss(context.world);
    const player = context.world.getPlayer();
    const special = this.special;
    if (!boss?.alive || special?.name !== "blast" || !special.ball) return;
    const { tile } = special.ball;
    special.ball = null;
    if (player.alive && player.position[0] === tile[0] && player.position[1] === tile[1]) {
      // OBS: back to her in 30 cycles, the bounce graphic on her as it arrives, her hitsplat 2 ticks on.
      this.animate(
        context,
        null,
        [onActor(spotAnims.bounce, boss, blast.back.cycles)],
        [{ spotAnimId: spotAnims.ball, sourcePosition: [tile[0] + 0.5, tile[1] + 0.5], target: buildActorVisualTarget(boss), startDelayCycles: 0, endDelayCycles: blast.back.cycles, slope: blast.back.slope, startOffset: 0, startHeight: blast.back.startHeight, endHeight: blast.back.endHeight }],
        [{ id: soundIds.bounce, position: tile }],
      );
      // OBS: her hit by it heard from her, with her hitsplat.
      this.later(blast.bounceHitTicks, (ctx) => {
        const her = this.boss(ctx.world);
        if (her?.alive) this.animate(ctx, null, [], [], [{ id: soundIds.bounceHit, position: centreOf(her.position) }]);
      });
      context.queueNpcHit({ attackerId: bossActorId, targetId: bossActorId, style: "typeless", attackKind: "typeless", rolledDamage: this.randomInt(blast.bounceDamage), accuracySucceeded: true, impactDelayTicks: blast.bounceHitTicks, sourceDeathPolicy: "persist" });
      special.throwsLeft--;
      if (special.throwsLeft > 0) this.later(blast.rethrowTicks, (ctx) => this.releaseBall(ctx));
      else special.endsAt = context.tick + 1;
      return;
    }
    // OBS: the explosion's graphic on every tile of the nave, the player hit on the same tick; nothing thrown after it.
    this.animate(context, null, this.arena().map((each) => onTile(spotAnims.explosion, each)), [], [{ id: soundIds.explosion, position: tile }]);
    this.hurt("Exploding light", blast.explosionDamage, "magic", blast.explosionPrayedShare);
    special.endsAt = context.tick + 1;
  }
  // She draws her sword to a side and cleaves, four times (six enraged). Each cleave sweeps the half of the nave in front
  // of her and on her sword's side; she faces where the player was at the last swing. When he is on her other side, the
  // cleave goes across and the sword stays there. Out of the half (the side opposite the sword, or behind her) he is safe.
  // inferred: the side she draws to first (OBS: left twice, right once).
  startSweep(boss, player, context) {
    const cleaves = this.enraged ? sweep.cleavesEnraged : sweep.cleaves;
    const every = this.enraged ? sweep.everyTicksEnraged : sweep.everyTicks;
    const side = this.random() < 0.5 ? "left" : "right";
    this.special = { name: "sweep", startedAt: context.tick, endsAt: context.tick + cleaves * every + 1, side, facing: this.quadrantOf(boss, player), cleaves, swept: [] };
    this.holdFacing(boss, this.special.facing);
    this.animate(context, this.sweepClip(side, "draw"));
    for (let n = 1; n <= cleaves; n++) this.laterAfterMove(n * every, (ctx) => this.cleave(ctx, n));
  }
  // She holds the way she faces through the sweep: the engine turns no NPC with `lockedFacing` to its target.
  holdFacing(boss, facing) {
    boss.facing = facingAngles[facing];
    boss.lockedFacing = facingAngles[facing];
  }
  releaseFacing(boss) {
    if (boss) delete boss.lockedFacing;
  }
  // To her left or right as she faces, not in front of her and not behind her.
  isBeside(boss, player, facing) {
    const [u, v] = this.offsetOf(boss, player);
    const [fx, fy] = directions[facing];
    const [lx, ly] = leftOf(directions[facing]);
    return Math.abs(u * lx + v * ly) > Math.abs(u * fx + v * fy);
  }
  sweepClip(side, step) {
    // CACHE: enraged she has her own draw, cleave and across, and the reset of her calm sweep (OBS: 14432 at t184).
    return step !== "reset" && this.enraged ? `sweep_${side}Enraged_${step}` : `sweep_${side}_${step}`;
  }
  // Her middle tile, and the player from it.
  offsetOf(boss, player) {
    const [cx, cy] = centreOf(boss.position);
    return [player.position[0] - cx, player.position[1] - cy];
  }
  quadrantOf(boss, player) {
    const [u, v] = this.offsetOf(boss, player);
    if (Math.abs(u) > Math.abs(v)) return u > 0 ? "E" : "W";
    return v > 0 ? "N" : "S";
  }
  // The half a cleave sweeps: in front of her and on her sword's side.
  sweptBy(boss, facing, side) {
    const front = directions[facing];
    const left = leftOf(front);
    const toSide = side === "left" ? left : [-left[0], -left[1]];
    const margin = this.enraged ? sweep.marginEnraged : sweep.margin;
    const [cx, cy] = centreOf(boss.position);
    return (tile) => (tile[0] - cx) * (front[0] + toSide[0]) + (tile[1] - cy) * (front[1] + toSide[1]) >= margin;
  }
  cleave(context, n) {
    const boss = this.boss(context.world);
    const player = context.world.getPlayer();
    const special = this.special;
    if (!boss?.alive || special?.name !== "sweep") return;
    const inHalf = this.sweptBy(boss, special.facing, special.side);
    const underBoss = (tile) => tile[0] >= boss.position[0] && tile[0] < boss.position[0] + bossSize && tile[1] >= boss.position[1] && tile[1] < boss.position[1] + bossSize;
    const swept = this.arena().filter((tile) => inHalf(tile) && !underBoss(tile));
    special.swept = swept;
    // Across when he is on her other side; the last cleave is her reset.
    const left = leftOf(directions[special.facing]);
    const [u, v] = this.offsetOf(boss, player);
    const lateral = u * left[0] + v * left[1];
    const across = lateral !== 0 && (lateral > 0 ? "left" : "right") !== special.side;
    const clip = n === special.cleaves ? this.sweepClip(special.side, "reset") : this.sweepClip(special.side, across ? "across" : "cleave");
    this.animate(context, clip, swept.map((tile) => onTile(spotAnims.cleave, tile)));
    if (player.alive && inHalf(player.position)) this.hurt("Sweep", sweep.damage, "melee", sweep.prayedShare);
    else if (player.alive && this.isBeside(boss, player, special.facing)) this.sideDodged = true;
    if (across) special.side = special.side === "left" ? "right" : "left";
    special.facing = this.quadrantOf(boss, player);
    if (n < special.cleaves) this.holdFacing(boss, special.facing);
  }
  // Lightning: once, or three strikes enraged (WIKI, OBS). Each strike is judged on its tick: Protect from Magic switched
  // on that very tick negates it and earns a maximum hit for the player's next attack; already on, it takes ~75% off;
  // off, the strike lands whole, on that tick. Its impact graphic shows the tick before.
  startSmite(boss, player, context) {
    const strikes = this.enraged ? smite.strikesEnraged : [smite.strikeTicks];
    this.special = { name: "smite", startedAt: context.tick, endsAt: context.tick + strikes[strikes.length - 1] + 1, strikes: strikes.map((at) => context.tick + at) };
    this.animate(context, this.enraged ? "smite_enraged" : "smite", [onActor(this.enraged ? spotAnims.smiteEnraged : spotAnims.smite, boss)]);
    for (const at of strikes) {
      this.later(at - smite.impactLeadTicks, (ctx) => {
        const you = ctx.world.getPlayer();
        if (you.alive && this.boss(ctx.world)?.alive) this.animate(ctx, null, [onActor(spotAnims.smiteImpact, you)]);
      });
      this.laterAfterMove(at, (ctx) => this.strike(ctx));
    }
  }
  praysMagic(player) {
    return player?.activePrayer === "ProtectMagic";
  }
  // WIKI: "activating the prayer at the same tick that the lightning strikes will fully negate the damage, as well as
  // guarantee a maximum hit for the next attack"; a 1-tick flick switches it on that tick too.
  strike(context) {
    const player = context.world.getPlayer();
    if (!player.alive || !this.boss(context.world)?.alive || this.special?.name !== "smite") return;
    const prayed = this.praysMagic(player);
    const perfect = prayed && !this.magicPrayedLastTick;
    const roll = this.randomInt(smite.damage);
    const damage = perfect ? 0 : prayed ? Math.floor(roll * smite.prayedShare) : roll;
    if (perfect) this.maxHitEarned = true;
    this.hurtFixed("Smite", damage);
  }
  // A hit already judged: typeless, so that the prayer of the tick it lands on changes nothing.
  hurtFixed(source, damage) {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage: damage, attackType: "typeless", playerPosition: [...player.position] });
  }

  // --- the rules, the end, the snapshot -------------------------------------------------
  getEngineRules() {
    return {
      // inferred: untouchable till she has woken.
      playerDamageOnNpc: (damage, { target }) => (target.id === bossActorId && this.phase === "waking" ? 0 : damage),
      // WIKI: a perfect prayer against her smite guarantees "a maximum hit for the next attack". The engine asks this
      // only as an attack is launched.
      // WIKI: after a cleave dodged to her side, the player's next attack is "100% accurate" and at least half his
      // maximum. Spent as the attack starts (onPlayerAttackStarted): the engine plans an attack before it starts it.
      playerAlwaysAccurate: (context, { target }) => this.sideDodged && target?.id === bossActorId,
      playerMinimumHit: (maximum, context, { target }) =>
        this.sideDodged && target?.id === bossActorId ? Math.floor(maximum * sweep.dodgedMinimumShare) : 0,
      consumePlayerGuaranteedMaxHit: () => {
        if (!this.maxHitEarned) return false;
        this.maxHitEarned = false;
        return true;
      },
    };
  }
  onPlayerAttackStarted(attack) {
    if (attack.targetId === bossActorId) this.sideDodged = false;
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    this.phase = "dead";
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.special = null;
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        enraged: this.enraged,
        standardsSinceSpecial: this.standards,
        nextSpecial: this.nextEnabledSpecial(),
        nextAttackAt: this.nextAt,
        maxHitEarned: this.maxHitEarned,
        sideDodged: this.sideDodged,
        special: this.special && {
          name: this.special.name,
          startedAt: this.special.startedAt,
          endsAt: Number.isFinite(this.special.endsAt) ? this.special.endsAt : null,
          side: this.special.side ?? null,
          facing: this.special.facing ?? null,
          ball: this.special.ball ? { tile: [...this.special.ball.tile], landsAt: this.special.ball.landsAt } : null,
          strikes: this.special.strikes ? [...this.special.strikes] : null,
        },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "Mad Angel";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const madAngelDefinition = {
  kind: madAngelKind,
  factory: () => new MadAngelEncounter(),
  descriptor: {
    kind: madAngelKind,
    displayName: "Mad Angel",
    description: "Ardeaglais. Her sword sweeps, the ball of light to bounce back, the smite to pray against on the tick, and her enrage.",
    mapSquare: madAngelMapSquare,
    playerStart,
    loadsMapLocs: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "THE MAD ANGEL DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: madAngelLoadouts,
  },
  controls: { defaultMechanicsConfig: { ...defaultMechanics }, mechanicsToggles: specialToggles, debugActions: [] },
};
export { madAngelDefinition as definition };
export const order = 86;
