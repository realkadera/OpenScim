// Phosani's Nightmare (https://oldschool.runescape.wiki/w/Phosani%27s_Nightmare),
// alone in Phosani's dream under the Sisterhood Sanctuary.
//
// Three phases (since the rework of 2025), each in one of her four forms,
// which come round a cycle from a random start (ids.js). In each:
// - her shield, 400, which any hit wears down;
// - with it gone, her weakened form and the four totems, 200 charge each, magic
//   charging them twice as fast; charged, they blast her for a third of her
//   hitpoints (the third blast leaves her 1);
// - her blast form at the centre: sleepwalkers walk to her, and she blasts the
//   player, harder for each that reached her; then her next form.
// After the third, her desperation: 150 hitpoints, her claws over and over, and
// a sleepwalker at a time.
//
// She attacks every 6 ticks with magic or ranged (80) or, the player beside
// her, now and then melee (73), each stopped by the right protection. Between
// one and five of them apart she uses a special: her claws, or the next of her
// form's three, in their order from a random start (specials.js, minions.js):
// 9416 parasite, flowers, surge; 11153 surge, husks, spores; 9418 parasite,
// flowers, curse; 9417 spores, husks, curse. In her third phase she switches
// off the protection that would stop her attack as she attacks.
//
// Sources: WIKI the boss's page and its strategies page; TABLE the monster
// table; CACHE the game cache (ids.js). tsps: RSPSApp/tsps's reading of rsprox
// recordings of the game (docs/nightmare.md; the data and units of
// server/plugins/bosses/; the recordings are of Leagues and Grid Master worlds,
// so their damage is the wiki's), "tsps, theirs" where they chose. OBS
// (runelogs): fourteen combat logs of the fight on runelogs.com, ten of them
// kills, from two accounts, May 2025 to September 2026 (RuneLite's combat
// logger: hitsplats, prayers, boosted levels, positions and NPC changes a
// tick at a time; no animations, graphics, projectiles or messages). Where a
// log and another source disagree, the log is followed and the other named.
// Numbers no source gives are marked inferred. There are no Outside
// recordings of it yet.
//
// Not yet: the dream's way in (the Pool of Nightmares, her countdown and her
// waking); the totems' overlay and her bar in the boss interface (her shield
// is the blue bar over her, a totem's charge left to go its own bar); the
// flies' and the flowers' heal on a totem; a team's fight.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { getWeaponFormulaStyle } from "../../engine/weapons.js";
import { CollisionFlag } from "../../engine/collision.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget, faceActorToward, getProjectileSourcePosition } from "../shared/npcHelpers.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import {
  mapSquare, bossSize, bossStart, playerStart, npcTypeIds, formCycle, totems as totemSpecs, isFloor, floorBounds,
  gapTo, footprintTiles, chebyshev, spotAnims, sounds,
} from "./ids.js";
import { Specials, drowsyAttackDelay, runCounts } from "./specials.js";
import { Minions, totemDefinition, huskDefinition, parasiteDefinition, sleepwalkerDefinition, sleepwalkerCounts } from "./minions.js";
import { phosanisNightmareLoadouts } from "./loadouts.js";

export const phosanisNightmareKind = "phosanis_nightmare";
export const phosanisNightmareMapSquare = mapSquare;
export const bossActorId = "phosanis-nightmare";

const hitpoints = 3200; // WIKI, TABLE
export const shieldMax = 400; // WIKI, tsps; OBS (runelogs): 400 of her shield went in every phase of the ten kills
const phases = 3; // WIKI, tsps; OBS (runelogs): three since 2025 (a log of May 2025 has four)
// WIKI, tsps: a third of her hitpoints a blast, the last leaving her 1. OBS
// (runelogs): hitsplats of 1,066 for each, then a heal of 149 (149 in every kill) into her desperation of 150.
const blastShare = Math.floor(hitpoints / 3);
const desperationHp = 150; // WIKI, tsps; OBS (runelogs): 150 dealt in it, every kill
const attackTicks = 6; // WIKI, TABLE, tsps; OBS (runelogs): her hits on the player 6 ticks apart
const firstAttackTicks = 2; // tsps: a phase's first attack two ticks after her form
const maxHits = { melee: 73, magic: 80, range: 80 }; // WIKI (the recordings of tsps are of Leagues worlds)
// tsps: melee for 4 of 88 of her attacks with the player in reach in her first
// phases, 10 of 29 in her last (WIKI: "an increased chance to use melee").
const meleeChance = { early: 0.08, last: 0.34 };
const hitTicks = { magic: 4, range: 4, melee: 2 }; // tsps
// tsps: the projectiles leave 3 ticks after her animation and land 30 (magic) or
// 20 (ranged) cycles after that, and a cycle more a tile from her middle tile.
const flight = { leaves: 90, base: { magic: 30, range: 20 }, startHeight: 86, endHeight: 31, slope: 14, startOffset: 96 };
// inferred (WIKI: "The boss roots during magic and ranged animations"): no step on the tick of the animation or the next.
const rootTicks = 2;
// tsps: one to five standard attacks between specials, a third of them (35%) her claws.
const specialGap = [1, 5];
const clawShare = 0.35;
// tsps (70+ phases): each form's three, in this order from a random start.
const formSpecials = {
  9416: ["parasite", "flowers", "surge"],
  11153: ["surge", "husks", "spores"],
  9418: ["parasite", "flowers", "curse"],
  9417: ["spores", "husks", "curse"],
};
const holdAfter = { claws: 9, husks: 6, curse: 6, parasite: 6 }; // tsps: the ticks to her next turn
// tsps: the blast lands 3 ticks after the last totem is charged; she leaves on 4 and is back in her blast form on 6.
const totemBlast = { hits: 3, leaves: 4, blastForm: 6 };
const deathTicks = { victory: 10 }; // tsps: her death animation a tick after, her loot 9 after that
const messages = {
  shieldFails: { text: "As the Nightmare's shield fails, the totems in the area are activated.", color: "#ff3045" },
  noEffect: "Your attacks have no effect on the Nightmare.",
  survives: { text: "The Nightmare survives the blast!", color: "#ff3045" },
  lashes: { text: "The Nightmare lashes out to survive.", color: "#ff3045" },
}; // tsps, as captured
const protectionPrayers = { magic: "ProtectMagic", range: "ProtectRange", melee: "ProtectMelee" };

const bossDefinition = defineNpc({
  id: "phosanis-nightmare",
  move: ({ actor, context, config }) => config.moveBoss(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

class PhosanisNightmareEncounter {
  kind = phosanisNightmareKind;
  shieldMax = shieldMax;
  constructor() {
    this.specials = new Specials(this);
    this.minions = new Minions(this);
    this.definitions = new NpcDefinitionRegistry([
      bossDefinition.register(this),
      totemDefinition.register(this),
      huskDefinition.register(this),
      parasiteDefinition.register(this),
      sleepwalkerDefinition.register(this),
    ]);
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.startRun();
  }
  startRun() {
    this.outcome = { phase: "active" };
    this.now = 0;
    this.world = null;
    this.tasks = [];
    this.pending = [];
    this.epoch = 0; // counts her blasts, phases and death: a task of an earlier one does nothing
    const start = Math.floor(this.random() * formCycle.length);
    this.forms = [0, 1, 2].map((n) => formCycle[(start + n) % formCycle.length]);
    this.phase = 1;
    this.stage = "shield";
    this.shield = shieldMax;
    this.nextAttackAt = firstAttackTicks;
    this.stillUntil = 0;
    this.away = false;
    this.melee = []; // her melee in the air: { at, from }
    this.specials.reset();
    this.minions.reset();
    this.startSpecials();
  }
  randomInt(low, high) {
    return low + Math.floor(this.random() * (high - low + 1));
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  boss(world = this.world) {
    return world?.getNpc(bossActorId);
  }
  form() {
    return this.forms[this.phase - 1];
  }
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
  // CACHE: the dream is on plane 3, and the application builds an arena from
  // plane 0, so the encounter makes its own from the floor of plane 3 (ids.js).
  getArenaConfig() {
    return (this.arena ??= buildArena());
  }
  configureRunStart(mechanics, context) {
    this.random = createSeededRandom(this.seed);
    this.startRun();
    const world = context?.world;
    if (!world) return;
    const boss = world.actors.get(bossActorId);
    if (boss) Object.assign(boss, this.bossBase());
    totemSpecs.forEach((_, index) => this.minions.setTotem(world, index, "dormant"));
  }
  bossBase() {
    return {
      npcTypeId: this.forms[0], formulaStats: structuredClone(getMonsterFormulaStats(this.forms[0])),
      position: [...bossStart], previousPosition: [...bossStart], untargetable: false, shieldBar: { ratio: 1 },
      vitals: { hp: hitpoints, maxHp: hitpoints },
    };
  }
  createNpcs() {
    const hp = getMonsterHitpoints(this.forms[0]); // TABLE: 3,200
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", archetypeId: "phosanis_nightmare", size: bossSize, alive: true,
          ...this.bossBase(), vitals: { hp, maxHp: hp }, facing: 0, history: new Map(),
          combat: {
            // attackRange: she walks to stand beside the player (OBS (runelogs): 171 of 398 of her logged tiles a tile
            // from him, a step at most a tick); her magic and ranged reach him anywhere.
            attackSpeed: attackTicks, attackRange: 1, attackStyle: "magic", nextActionTick: firstAttackTicks, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
      ...this.minions.createTotems(),
    ];
  }

  // --- every tick ----------------------------------------------------------
  // Before the NPCs: what is due, the claws coming up, the spores, the
  // parasite, the sleepwalkers beside her (tsps: taken in before they would
  // step), the yawns and the curse.
  resolveHazards(context) {
    this.now = context.tick;
    this.world = context.world;
    this.context = context;
    this.runTasks(context);
    if (this.stage !== "dead") {
      this.specials.stepRun(context);
      this.specials.clawHits(context);
      this.specials.sporeCheck(context);
      this.specials.curseCheck(context);
      this.minions.burstCheck(context);
      this.minions.watchWalkers(context);
    }
    this.specials.drowse(context);
    this.minions.watchCures(context);
    return this.drainPending(context);
  }
  // After the player has moved: the flowers' flies, the sleepwalkers, what is drawn.
  processPostTick(context) {
    this.now = context.tick;
    this.world = context.world;
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    this.runTasks(context);
    this.melee = this.melee.filter((swing) => swing.at >= context.tick);
    this.minions.watchCures(context);
    if (this.stage !== "dead") {
      this.specials.flies(context);
    }
    const boss = this.boss(context.world);
    if (boss) boss.shieldBar = this.stage === "shield" && boss.alive ? { ratio: this.shield / shieldMax } : undefined;
    return this.drainPending(context);
  }
  runTasks(context) {
    for (let index = this.tasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.tasks.findIndex((entry) => entry.tick <= this.now)) {
      this.tasks.splice(index, 1)[0].task(context);
    }
  }
  // Damage to the player, applied by the hook that runs next.
  hurt(hit) {
    this.pending.push({ attackType: "typeless", ...hit });
  }
  drainPending(context) {
    const player = context.world.getPlayer();
    const hits = this.pending.map((hit) => ({ ...hit, playerPosition: [...player.position] }));
    this.pending = [];
    return player.alive ? hits : [];
  }
  message(context, message) {
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [typeof message === "string" ? { text: message } : { ...message }] });
  }
  // A visual event: clips (hers unless an actor is named), projectiles, graphics, and the sounds the audio layer plays (audio.js).
  visual(context, { animations = [], projectiles = [], graphics = [], sounds: played = [] }) {
    emitInfernoVisual(context.tickEvents, {
      animations: animations.map(({ actorId = bossActorId, clipId, delayCycles = 0 }) => ({ actorId, clipId, delayCycles })),
      projectiles, graphics, nightmareSounds: played,
    });
  }
  sound(context, id) {
    this.visual(context, { sounds: [{ id }] });
  }
  playerTarget(player) {
    return buildActorVisualTarget(player);
  }
  projectileFrom(source, target, { spotAnimId, start, end, slope, startOffset, startHeight, endHeight }) {
    return { spotAnimId, sourcePosition: getProjectileSourcePosition(source), target: buildActorVisualTarget(target), startDelayCycles: start, endDelayCycles: end, slope, startOffset, startHeight, endHeight };
  }

  // --- her movement --------------------------------------------------------
  moveBoss(boss, context) {
    this.now = context.tick;
    this.world = context.world;
    if (!boss.alive || this.away || context.tick < this.stillUntil) return [];
    if (this.stage !== "shield" && this.stage !== "totems" && this.stage !== "desperate") return [];
    if (!context.world.getPlayer().alive) return [];
    return getNpcPursuitMoves(boss, { ...context, random: this.random });
  }
  // She leaves (her flowers and her surge start so): out of reach until she is back.
  leave(context) {
    const boss = this.boss(context.world);
    if (!boss) return;
    this.away = true;
    boss.untargetable = true;
    this.visual(context, { animations: [{ clipId: "leave" }] });
  }
  // Back: at the centre, or at a lane's start facing along it.
  comeBack(context, at = bossStart, facing = null) {
    const boss = this.boss(context.world);
    if (!boss) return;
    boss.position = [...at];
    boss.previousPosition = [...at];
    boss.movementPath = [];
    boss.untargetable = false;
    if (facing) faceActorToward(boss, { position: facing, size: bossSize });
    this.away = facing !== null; // her surge: still until she crosses
    if (!facing) this.stillUntil = Math.max(this.stillUntil, context.tick + 4); // tsps: still until the segment animation
    this.visual(context, { animations: [{ clipId: "back" }] });
  }
  crossTo(context, to) {
    const boss = this.boss(context.world);
    if (!boss) return;
    boss.previousPosition = [...boss.position];
    boss.position = [...to];
    this.away = false;
    this.visual(context, { animations: [{ clipId: "surge" }] });
  }

  // --- her turn ------------------------------------------------------------
  bossTurn(boss, context) {
    const idle = { environmentalDamages: [] };
    this.now = context.tick;
    if (!boss.alive || context.tick < this.nextAttackAt || this.away) return idle;
    if (this.stage !== "shield" && this.stage !== "totems" && this.stage !== "desperate") return idle;
    const player = context.world.getPlayer();
    if (!player.alive) return idle;
    this.nextAttackAt = context.tick + attackTicks;
    boss.combat.nextActionTick = this.nextAttackAt;
    boss.combat.lastAttackTick = context.tick;
    if (this.stage === "desperate") {
      // tsps: her claws on and on (specials.js: a run starts the next as it ends).
      if (!this.specials.run && !this.despRunning) {
        this.despRunning = true;
        this.specials.startRun(context, runCounts.flowers, true);
      }
      return idle;
    }
    const special = this.nextSpecial();
    if (special) {
      faceActorToward(boss, player);
      const hold = this.startSpecial(special, context) ?? holdAfter[special];
      this.nextAttackAt = context.tick + hold;
      boss.combat.nextActionTick = this.nextAttackAt;
      this.specials.turnTaken(context);
      return idle;
    }
    const attacks = this.standardAttack(boss, player, context);
    this.specials.turnTaken(context);
    return { environmentalDamages: [], npcAttacks: attacks };
  }
  startSpecials() {
    const order = formSpecials[this.form()];
    this.specialOrder = { list: order, next: Math.floor(this.random() * order.length) };
    this.untilSpecial = this.randomInt(...specialGap);
  }
  // tsps: a special when its count runs out, unless her husks hold the player or her flowers or surge are on.
  nextSpecial() {
    if (--this.untilSpecial > 0 || this.minions.frozen || this.specials.blocking()) return null;
    this.untilSpecial = this.randomInt(...specialGap) + 1;
    if (this.random() < clawShare) return "claws";
    const { list, next } = this.specialOrder;
    this.specialOrder.next = (next + 1) % list.length;
    return list[next];
  }
  startSpecial(name, context) {
    switch (name) {
      case "claws":
        this.specials.claws(context);
        return null;
      case "husks":
        return this.minions.startHusks(context);
      case "parasite":
        return this.minions.startParasite(context);
      case "flowers":
        return this.specials.startFlowers(context);
      case "spores":
        this.visual(context, { animations: [{ clipId: "spores" }] });
        return this.specials.startSpores(context);
      case "curse":
        return this.specials.startCurse(context);
      case "surge":
        return this.specials.startSurge(context);
      default:
        return null;
    }
  }
  // Under her, or beside her on the side the player was when she struck (tsps).
  inMeleeReach(boss, targetTile, tile) {
    if (gapTo(tile, boss.position) > 1) return false;
    if (gapTo(tile, boss.position) === 0) return true;
    const [minX, minY] = boss.position;
    const maxX = minX + bossSize - 1;
    const maxY = minY + bossSize - 1;
    const side = ([x, y]) => [x < minX ? -1 : x > maxX ? 1 : 0, y < minY ? -1 : y > maxY ? 1 : 0];
    const [tx, ty] = side(targetTile);
    const [sx, sy] = side(tile);
    return (tx !== 0 && sx === tx) || (ty !== 0 && sy === ty);
  }
  standardAttack(boss, player, context) {
    const last = this.phase === phases;
    const reach = this.inMeleeReach(boss, player.position, player.position);
    const style = reach && this.random() < (last ? meleeChance.last : meleeChance.early) ? "melee" : this.random() < 0.5 ? "magic" : "range";
    const stoppedBy = this.specials.protectionFor(style);
    // tsps (rsprox 1148, 1156): in her third phase the protection that would stop the attack goes off on her animation,
    // any other stays on. While cursed, the shuffled one (not captured: tsps, theirs). OBS (runelogs): of the protections the
    // player had on that went off with none in their place, those 4 ticks before a hit on him (her magic or ranged
    // animation) or 2 before one 4 after the last (her melee): 23 of 95 in her third phase, 14 of 206 in the two before.
    if (last && player.activePrayer === protectionPrayers[stoppedBy]) context.setProtectionPrayer?.(null);
    boss.combat.attackStyle = style;
    if (style === "melee") {
      const targetTile = [...player.position];
      const epoch = this.epoch;
      this.melee.push({ at: context.tick + hitTicks.melee, from: [...boss.position] });
      emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "melee", kind: "phosanis_nightmare_melee", impactDelayTicks: hitTicks.melee });
      // WIKI: it always hits, and a step away before her claws come up dodges it.
      this.later(hitTicks.melee, (ctx) => {
        const now = this.boss(ctx.world);
        const you = ctx.world.getPlayer();
        if (this.epoch !== epoch || !now?.alive || !this.inMeleeReach(now, targetTile, you.position)) return;
        this.sound(ctx, sounds.meleeHit);
        this.hurt({ baseDamage: [0, maxHits.melee], attackType: this.specials.protectionFor("melee"), source: "Phosani's Nightmare" });
      });
      return [];
    }
    this.stillUntil = Math.max(this.stillUntil, context.tick + rootTicks);
    const attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      plan: {
        formulaStyle: style === "magic" ? "magic" : "ranged", damageType: stoppedBy, attackKind: style === "magic" ? "magic" : "range_arrow",
        // inferred: the prayer counts as the hit lands (WIKI: "3 ticks to react").
        maxHit: maxHits[style], impactDelayTicks: hitTicks[style], prayerCheckAt: "impact", sourceDeathPolicy: "persist",
      },
    });
    if (!attack) throw new TypeError("Missing formula stats for Phosani's Nightmare");
    const middle = [boss.position[0] + 2, boss.position[1] + 2];
    const end = flight.leaves + flight.base[style] + chebyshev(middle, player.position);
    const projectiles = [{
      spotAnimId: style === "magic" ? spotAnims.magic : spotAnims.range, sourcePosition: getProjectileSourcePosition(boss), target: buildActorVisualTarget(player),
      startDelayCycles: flight.leaves, endDelayCycles: end, slope: flight.slope, startOffset: flight.startOffset, startHeight: flight.startHeight, endHeight: flight.endHeight,
    }];
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: style, kind: "phosanis_nightmare_" + style, impactDelayTicks: hitTicks[style], projectiles });
    if (style === "magic") this.visual(context, { graphics: [{ spotAnimId: spotAnims.magicImpact, target: buildActorVisualTarget(player), height: 124, delayCycles: end }] });
    return [attack];
  }

  // --- her shield, the totems, the blast -----------------------------------
  healShield(amount) {
    if (this.stage !== "shield" || amount <= 0) return;
    this.shield = Math.min(shieldMax, this.shield + amount);
  }
  shieldBroken(context) {
    if (this.stage !== "shield") return;
    this.stage = "totems";
    const boss = this.boss(context.world);
    if (boss) boss.npcTypeId = npcTypeIds.forms[this.form()];
    this.minions.wakeTotems(context.world);
    this.message(context, messages.shieldFails);
    this.sound(context, sounds.shieldFails);
  }
  totemsCharged(context) {
    if (this.stage !== "totems") return;
    this.stage = "blast";
    this.epoch++;
    const epoch = this.epoch;
    const last = this.phase >= phases;
    // tsps: what is going on ends; the spores stay to her blast form and the curse to the blast's landing.
    this.specials.interrupt({ keepSpores: true, keepCurse: true });
    this.minions.freePlayer(context, false);
    for (const npc of context.world.getNpcs()) if (npc.alive && this.minions.isHusk(npc)) context.despawnNpc(npc.id);
    this.away = false;
    const boss = this.boss(context.world);
    if (boss) boss.untargetable = true;
    this.minions.fireTotems(context);
    this.later(totemBlast.hits, (ctx) => {
      if (this.epoch !== epoch) return;
      const her = this.boss(ctx.world);
      if (!her) return;
      const amount = last ? her.vitals.hp - 1 : Math.min(her.vitals.hp - 1, blastShare);
      her.vitals = { ...her.vitals, hp: her.vitals.hp - amount };
      ctx.tickEvents.emit({ type: "hitsplat_spawned", targetId: her.id, amount, hitsplatType: "damage" });
      this.minions.sleepTotems(ctx.world);
      this.specials.liftCurse(ctx);
      if (last) this.message(ctx, messages.survives);
    });
    this.later(totemBlast.leaves, (ctx) => this.epoch === epoch && this.visual(ctx, { animations: [{ clipId: "leave" }] }));
    this.later(totemBlast.blastForm, (ctx) => this.epoch === epoch && this.blastForm(ctx, last));
  }
  blastForm(context, last) {
    const boss = this.boss(context.world);
    if (!boss) return;
    boss.position = [...bossStart];
    boss.previousPosition = [...bossStart];
    boss.movementPath = [];
    boss.npcTypeId = npcTypeIds.blast;
    // tsps: her spores burst as she comes back, and the drowsiness ends.
    this.specials.burstAll(context);
    this.specials.drowsy = null;
    this.visual(context, { animations: [{ clipId: "blastForm" }] });
    this.minions.summon(context, sleepwalkerCounts[this.phase - 1], (ctx) => (last ? this.desperation(ctx) : this.nextPhase(ctx)));
  }
  nextPhase(context) {
    this.message(context, { text: "The Nightmare restores her shield.", color: "#ff3045" });
    this.startPhase(context, this.phase + 1);
  }
  startPhase(context, phase) {
    this.epoch++;
    this.phase = phase;
    this.stage = "shield";
    this.shield = shieldMax;
    this.away = false;
    this.stillUntil = 0;
    const boss = this.boss(context.world);
    if (boss) {
      boss.npcTypeId = this.form();
      boss.untargetable = false;
    }
    this.startSpecials();
    this.nextAttackAt = context.tick + firstAttackTicks;
    if (boss) boss.combat.nextActionTick = this.nextAttackAt;
  }
  desperation(context) {
    this.epoch++;
    this.stage = "desperate";
    this.despRunning = false;
    const boss = this.boss(context.world);
    if (boss) {
      const heal = desperationHp - boss.vitals.hp;
      boss.vitals = { ...boss.vitals, hp: desperationHp };
      boss.npcTypeId = npcTypeIds.desperation;
      boss.untargetable = false;
      if (heal > 0) context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount: heal, hitsplatType: "heal" });
    }
    this.message(context, messages.lashes);
    this.specials.interrupt();
    this.minions.startDesperation(context);
    this.nextAttackAt = context.tick + 1; // tsps
  }
  // A boss hitpoints preset: straight into that phase, as it starts, at the start of the next tick (the preset's context
  // has no tick events).
  enterBossHpPhase(hp, context) {
    const boss = this.boss(context.world);
    if (!boss?.alive) return;
    this.now = context.tick;
    this.world = context.world;
    this.epoch++;
    this.tasks = [];
    this.specials.interrupt();
    this.minions.walk = null;
    this.minions.sleepTotems(context.world);
    this.stage = "preset";
    this.later(0, (ctx) => {
      if (hp <= desperationHp) {
        this.phase = phases;
        this.desperation(ctx);
        return;
      }
      this.startPhase(ctx, hp > hitpoints - blastShare ? 1 : hp > hitpoints - 2 * blastShare ? 2 : 3);
    });
  }

  // --- the player's side ---------------------------------------------------
  getEngineRules() {
    return {
      playerDamageOnNpc: (damage, { target, attack }) => this.playerHit(damage, target, attack),
      // WIKI: crush always hits husks and weakened parasites for its most.
      playerAlwaysAccurate: (rules, attack) => this.crushes(rules, attack),
      playerMinimumHit: (maximum, rules, attack) => (this.crushes(rules, attack) ? maximum : 0),
      // WIKI: drowsy, her attacks come 2 ticks slower, "doubled when using magic".
      modifyPlayerCombatParams: (params, { player }) => {
        if (!this.specials.drowsy) return params;
        const magic = player.manualCastSpell || getWeaponFormulaStyle(player.equipment.weapon, player.selectedAttackStyleIndex) === "magic" || player.combatSupplies?.selectedSpell;
        return { ...params, attackSpeed: params.attackSpeed + drowsyAttackDelay * (magic ? 2 : 1) };
      },
    };
  }
  crushes(rules, attack) {
    const target = attack?.target;
    if (!target || attack.style !== "melee") return false;
    if (!(this.minions.isHusk(target) || (this.minions.isParasite(target) && target.state.weak))) return false;
    const player = rules.player;
    return getWeaponFormulaStyle(player.equipment.weapon, player.selectedAttackStyleIndex) === "melee_crush";
  }
  playerHit(damage, target, attack) {
    if (target.id === bossActorId) return this.hitBoss(damage, target);
    if (totemDefinition.isActor(target)) return this.minions.chargeTotem(target, damage, attack, this.context);
    // WIKI: any damage kills a sleepwalker.
    if (this.minions.isWalker(target)) return target.vitals.hp;
    return damage;
  }
  // Her shield takes the hit (the hitpoints it would have taken are put back first); in her desperation her
  // hitpoints do; else nothing does. From a quadrant her berries border, a hit heals her shield instead (WIKI, tsps).
  hitBoss(damage, boss) {
    const context = this.context;
    if (this.stage === "desperate") return damage;
    if (this.stage !== "shield") {
      if (context) this.message(context, messages.noEffect);
      return 0;
    }
    const player = this.world?.getPlayer();
    if (player && this.specials.berryArms(player.position).length > 0) {
      this.healShield(damage);
      return 0;
    }
    const amount = Math.min(damage, this.shield);
    this.shield -= amount;
    boss.vitals = { ...boss.vitals, hp: boss.vitals.hp + amount };
    if (this.shield <= 0) this.later(0, (ctx) => this.shieldBroken(ctx));
    return amount;
  }
  // Held by her husks' trance (WIKI, tsps), the player stays where he is.
  moveDisplacedPlayer(player) {
    if (!this.minions.frozen) return undefined;
    player.previousPosition = [...player.position];
    player.movementPath = [];
    player.isMoving = false;
    player.isRunning = false;
    return false;
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    const npc = context.world.getNpc(defeat.npcId);
    if (defeat.npcId === bossActorId) return this.died(defeat, context, completionOwnership);
    if (npc && this.minions.isHusk(npc)) this.minions.huskDied(context, defeat.npcId);
    if (npc && this.minions.isWalker(npc)) this.minions.walkerKilled(context, defeat.npcId);
  }
  died(defeat, context, completionOwnership) {
    this.stage = "dead";
    this.epoch++;
    this.tasks = [];
    this.pending = [];
    this.specials.interrupt();
    this.minions.clearAll(context);
    // Her death sequence is her last form's (presentation.js: 8612, tsps).
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks.victory, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  // What a script or the scene reads: the stage, the shield, what is coming.
  getSnapshot({ tick } = {}) {
    const now = tick ?? this.now;
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        stage: this.stage,
        form: this.form(),
        forms: [...this.forms],
        shield: this.shield,
        nextAttackAt: this.nextAttackAt,
        untilSpecial: this.untilSpecial,
        nextSpecial: this.specialOrder.list[this.specialOrder.next],
        away: this.away,
        // Her melee coming, and the protection that stops it now.
        melee: this.melee.filter((swing) => swing.at >= now).map((swing) => ({ ...swing, stoppedBy: this.specials.protectionFor("melee") })),
        ...this.specials.snapshot(now),
        ...this.minions.snapshot(now),
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel(npcId) {
    if (npcId?.startsWith("nightmare-husk")) return "Husk";
    if (npcId?.startsWith("nightmare-parasite")) return "Parasite";
    return "Phosani's Nightmare";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

// The floor of plane 3 as an arena: every tile that is not floor blocked.
function buildArena() {
  const size = 64;
  const flags = new Int32Array(size * size);
  const walkableTiles = new Set();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (isFloor([x, y])) walkableTiles.add(x + "," + y);
      else flags[x + y * size] |= CollisionFlag.OBJECT;
    }
  }
  const getFlag = (x, y) => (x < 0 || x >= size || y < 0 || y >= size ? -1 : flags[x + y * size]);
  return {
    bounds: { ...floorBounds, width: floorBounds.maxX - floorBounds.minX + 1, height: floorBounds.maxY - floorBounds.minY + 1 },
    walkableTiles,
    collisionMap: {
      sizeX: size, sizeY: size, flags, getFlag,
      hasFlag: (x, y, mask) => { const flag = getFlag(x, y); return flag !== -1 && (flag & mask) !== 0; },
      flag(x, y, mask) { if (getFlag(x, y) !== -1) flags[x + y * size] |= mask; },
      unflag(x, y, mask) { if (getFlag(x, y) !== -1) flags[x + y * size] &= ~mask; },
    },
  };
}

const phasePresets = [
  { label: "Phase 1 (full)", hp: hitpoints, hint: "Her first form's shield." },
  { label: "Phase 2", hp: hitpoints - blastShare, hint: "After the first blast: her second form." },
  { label: "Phase 3", hp: hitpoints - 2 * blastShare, hint: "Her last form: she turns off the protection that would stop her attack." },
  { label: "Desperation (150)", hp: desperationHp, hint: "Her claws without end, and a sleepwalker every 8 ticks." },
];

export const phosanisNightmareDefinition = {
  kind: phosanisNightmareKind,
  factory: () => new PhosanisNightmareEncounter(),
  descriptor: {
    kind: phosanisNightmareKind,
    displayName: "Phosani's Nightmare",
    description: "Phosani's dream: her shield and the totems across three phases, her forms' specials in their order (claws, husks, flowers, curse, parasites, spores, surge), the sleepwalkers, her third phase's prayer disable and her last stand.",
    mapSquare: phosanisNightmareMapSquare,
    playerStart,
    loadsMapLocs: true,
    // CACHE: the dream is on plane 3 (encounter.getArenaConfig).
    collision: { mode: "custom" },
    victory: { title: "VICTORY", narrative: "PHOSANI'S NIGHTMARE DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: phosanisNightmareLoadouts,
    tileMarkerPresets: [{
      id: "phosanis_nightmare_centre", name: "Centre and totems", description: "The tiles of her body at the centre, where her flowers and her blast form put her, and the middle of each totem",
      link: "https://oldschool.runescape.wiki/w/Phosani%27s_Nightmare/Strategies",
      markers: [
        ...footprintTiles(bossStart).map(([x, y]) => [x, y, "#55FFFFFF"]),
        ...totemSpecs.map(({ tile: [x, y], corner }) => [x + 1, y + 1, "#CC30C0FF", corner.toUpperCase()]),
      ],
    }],
  },
  controls: {
    defaultMechanicsConfig: {},
    mechanicsToggles: [],
    bossHpPresets: phasePresets,
    debugActions: [],
  },
};
// How the registry finds it (encounters/registry.js), and where it stands in the encounter picker.
export { phosanisNightmareDefinition as definition };
export const order = 78;
