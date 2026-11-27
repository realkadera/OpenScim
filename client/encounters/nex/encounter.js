// Nex (https://oldschool.runescape.wiki/w/Nex), the fifth general, in her
// chamber of the Ancient Prison: OpenScim's first fight of a team.
//
// The party (party.js) is the player and the teammates the encounter plays
// (teammates.js), the mechanics' team size in all, until the site has a
// backend to bring people together; party.js says how people will take their
// places.
//
// Her intro: she rises ("AT LAST!") and calls her four mages, one every 4
// ticks; then five phases, each with its two specials (specials.js) and its
// way of attacking:
// - Smoke: her magic at everyone, melee at whoever is beside her.
// - Shadow: her shadow shots at everyone, harder the closer.
// - Blood: her blood barrage at one (and whoever stands beside him).
// - Ice: her ice barrage at everyone, freezing whoever does not pray magic.
// - Zaros: magic at everyone and melee, through her curses; she heals 500
//   as it starts.
// She attacks every 4 ticks, at the nearest of the party she can reach; with
// him beside her, three blows in a row, then a spell. After five attacks, a
// special. At each fifth of her hitpoints she calls the phase's mage, who can
// then be killed (minions.js); she can still be hurt for 170 more, then not
// until it dies, and its death starts her next phase. As she dies, her wrath.
//
// Sources, as every number below names them: OBS the thirteen recordings of
// seven kills of 2026-11-26 and, "OBS (27th)", the twenty-two of eleven kills
// of 2026-11-27 (ids.js); WIKI the boss's page, its strategies page and its
// mages' pages, read 2026-11-26 and 27; TABLE the monster table; CACHE the
// game cache; inferred.
//
// Not yet: the altar (OBS (27th): loc 42965 "Altar" on the east bridge,
// local 59,17; "Pray" fills prayer to its level and 1 over, "You cannot pray
// at the altar while in combat." otherwise, by a rule the recordings do not
// settle; the client cannot click a loc for an encounter yet); her curses'
// own icons over her (the client draws the three protection prayers only:
// Deflect Melee shows as Protect from Melee, Soul Split as none); the
// coughing of a virus through a spectral spirit shield (WIKI: "reduces the
// prayer drain"); Fumus's poison (WIKI: 4; no recorder was poisoned, both
// wore anti-venom); Turmoil's and Umbra's drains on teammates (they fight by
// fixed stats); her drops (party.js keeps each member's damage for them);
// people instead of teammates (party.js).
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { getWeaponFormulaStyle } from "../../engine/weapons.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { buildActorVisualTarget, faceActorToward, getProjectileSourcePosition, healNpc } from "../shared/npcHelpers.js";
import { emitInfernoVisual } from "../inferno/events.js";
import {
  mapSquare, bossSize, bossStart, playerStart, teammateStarts, npcTypeIds, spotAnims, sounds, heights, flight,
  gapTo, chebyshev, middleOf, footprintTiles, inChamber, jumpSpots, colors,
} from "./ids.js";
import { Party, LOCAL_ID } from "./party.js";
import { Teammates, teammateDefinition } from "./teammates.js";
import { Specials, phaseSpecials, holdAfter } from "./specials.js";
import { Minions, mages, mageDefinition, reaverDefinition, stalagmiteDefinition, mageActorId } from "./minions.js";
import { nexLoadouts } from "./loadouts.js";

export const nexKind = "nex";
export const nexMapSquare = mapSquare;
export const bossActorId = "nex";

const hitpoints = 3400; // WIKI, TABLE; OBS: the damage less her heals came to 3,400 in every kill, for three or four
const phaseOrder = ["smoke", "shadow", "blood", "ice", "zaros"];
// WIKI: at 80%, 60%, 40%, 20% she calls the phase's mage; OBS: "Fumus, don't fail me!" as she fell to 2,720.
const thresholds = [2720, 2040, 1360, 680];
// WIKI (25 June 2025): she takes up to 170 more before she is immune; OBS: 850 dealt in a smoke phase (680 + 170).
const transitionOverflow = 170;
const attackTicks = 4; // WIKI, TABLE; OBS: 4 between her attacks
const specialEvery = 5; // OBS: a special after five attacks, in every phase of every kill
const firstSpecialTicks = 4; // OBS: a phase's first special 4 ticks after its first words (5 in a blood phase)
const jumpIdleTicks = 8; // WIKI: "If Nex isn't fighting anyone for 8 ticks, she dashes to the centre"
const afterJumpTicks = 2; // OBS: her next attack 2 ticks after she lands (all but two of her jumps)
const reach = 10; // inferred: how far she attacks from (OBS: at players 11 tiles off in her shadow phase, rarely)
const zarosHeal = 500; // WIKI; OBS: a heal of 500 in all six kills that reached it
const maxHits = { melee: 27, magic: 33 }; // WIKI; OBS: 27 the most of her melee unprayed (smoke, blood, ice), 32 of her Zaros magic
// WIKI (Nex/Strategies, "Mechanics and Numbers", refs. 3 and 4): what a correct protection lets through.
const keepMelee = 1 / 5;
const keepMeleeZaros = 1 / 3; // OBS: 9 the most through Protect from Melee in her Zaros phase
const keepMagic = 1 / 2;
const keepRange = 1 / 2;
const keepZarosLate = 3 / 4; // WIKI: Protect from Magic put up after her cast: 25%
// OBS (shadow shots, 1,004 of them, by distance and prayer): ~25 the most through Protect from Missiles a tile or two
// off, ~7 at 9 to 11 tiles. Here: 65 less 5 a tile, at least 10 (inferred, a line through them; WIKI: "up to 30 with
// protection").
const shadowMax = (distance) => Math.max(10, 65 - 5 * distance);
const iceFreezeTicks = 15; // WIKI (ref. 6)
const zarosPrayerDrain = 5; // WIKI: "Magic drains 5 prayer on hit"
const meleeRun = 3; // WIKI: "three melee attacks in succession", then a spell; OBS: M M M R
// OBS (27th), 70 of her blood barrages: they heal her by the damage and a seventh again (12 -> 13, 20 -> 23, 25 -> 28),
// and drain half the damage in prayer (7 -> 3, 12 -> 6, 14 -> 7).
const bloodHealShare = 1.15;
const bloodDrainShare = 1 / 2;
// OBS (27th): under Soul Split her spells heal her by all they deal, a tick after they land (13 of 14 single hits), and
// her blows by half, 3 ticks after (150 of 155).
const soulSplit = { magic: { share: 1, after: 1 }, melee: { share: 1 / 2, after: 3 } };
// OBS (27th): under Deflect Melee a melee hit on her shows 0 and comes back at the one who dealt it ("Nex deflects your
// damage back at you!", 5 times, 4 to 16 back); how much of the roll comes back is inferred.
const deflectShare = 1 / 4;
// WIKI: Soul Split, after 4 attacks Deflect Melee, after 4 none, after 4 Soul Split again. OBS (27th): her form turns
// on her attack (32 turns), the first on her first attack of the phase, until then none.
const curseRun = 4;
// OBS (27th): under Turmoil (all her Zaros phase), a blow of hers that hurts drains 2 from Attack, Strength, Defence,
// Ranged and Magic at once (81 of 182 such blows on the recorders; WIKI: "drain the player's melee, range and magic
// stats"). Her spells drain none of them (they drain prayer).
const turmoil = { drain: 2, chance: 1 / 2 };
const crushDefence = 35; // WIKI (20 October 2026: "reduced from +60"); TABLE has 60
// OBS: her intro, ticks from her rising: "Fumus!" 5, "Umbra!" 9, "Cruor!" 13, "Glacies!" 17, "Fill my soul with smoke!" 21.
const intro = { rises: 1, calls: [5, 9, 13, 17], smoke: 21 };
const deathTicks = { victory: 8 }; // OBS: her death animation a tick after her last hitsplat, her body gone 7 after
const phaseWords = {
  smoke: "Fill my soul with smoke!", shadow: "Darken my shadow!", blood: "Flood my lungs with blood!",
  ice: "Infuse me with the power of ice!", zaros: "NOW, THE POWER OF ZAROS!",
};
// The mechanics: the team's size, the player included (OBS: three and four). One is a solo kill.
const teamSizeKey = "nexTeamSize";
const defaultTeamSize = 4;

const bossDefinition = defineNpc({
  id: "nex",
  move: ({ actor, context, config }) => config.moveBoss(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

class NexEncounter {
  kind = nexKind;
  runStartMechanicsKeys = [teamSizeKey];
  constructor() {
    this.party = new Party(this);
    this.teammates = new Teammates(this);
    this.specials = new Specials(this);
    this.minions = new Minions(this);
    this.definitions = new NpcDefinitionRegistry([
      bossDefinition.register(this),
      teammateDefinition.register({ teammates: this.teammates }),
      mageDefinition.register({ minions: this.minions }),
      reaverDefinition.register({ minions: this.minions }),
      stalagmiteDefinition.register({}),
    ]);
    this.teamSize = defaultTeamSize;
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
    this.stage = "intro";
    this.phase = "smoke";
    this.called = [false, false, false, false];
    this.floorHp = 0; // while her mage lives: what her hitpoints cannot fall below
    this.hitTick = -1; // the tick of the hits on her judged last, and her hitpoints after them (adjustHit)
    this.hpAfterHits = 0;
    this.nextAttackAt = Infinity;
    this.untilSpecial = specialEvery;
    this.specialTurn = 0;
    this.meleeRun = 0;
    this.lastFought = 0;
    this.specialSerial = 0;
    this.curse = null;
    this.curseCount = 0;
    this.jumping = false;
    this.specials.reset();
    this.minions.reset();
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
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return { [teamSizeKey]: defaultTeamSize };
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
  // The arena from the map, kept to the chamber: the lobby west of the barrier is not part of the fight.
  refineArenaConfig(arena) {
    if (!arena?.walkableTiles) return arena;
    const walkableTiles = new Set([...arena.walkableTiles].filter((entry) => {
      const [x, y] = String(entry).split(",").map(Number);
      return inChamber([x, y]);
    }));
    return { ...arena, walkableTiles };
  }
  configureRunStart(mechanics, context) {
    this.random = createSeededRandom(this.seed);
    this.startRun();
    this.teamSize = clampTeam(mechanics?.[teamSizeKey]);
    const world = context?.world;
    if (!world) return;
    // The team: as many teammates as the team's size asks, the ones the run started with taken out or put back.
    const wanted = this.teamSize - 1;
    const actors = this.teammates.createActors(wanted, teammateStarts);
    for (const npc of world.getNpcs()) if (teammateDefinition.isActor(npc)) context.despawnNpc?.(npc.id);
    for (const actor of actors) context.spawnNpc?.(actor);
    this.party.reset(actors.map((actor) => ({ id: actor.id, name: actor.state.name, role: actor.state.role })));
    const boss = world.actors.get(bossActorId);
    if (boss) Object.assign(boss, this.bossBase());
    for (const spec of mages) {
      const npc = world.actors.get(mageActorId(spec.key));
      if (npc) Object.assign(npc, { untargetable: true, state: { ...npc.state, vulnerable: false, nextAttackAt: Infinity } });
    }
  }
  bossBase() {
    const formulaStats = structuredClone(getMonsterFormulaStats(npcTypeIds.nex));
    formulaStats.defensive.crush = crushDefence;
    return {
      npcTypeId: npcTypeIds.nexRising, formulaStats, untargetable: true, position: [...bossStart], previousPosition: [...bossStart],
      vitals: { hp: hitpoints, maxHp: hitpoints }, overheadPrayers: undefined,
    };
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.nex); // TABLE: 3,400
    const teammates = this.teammates.createActors(this.teamSize - 1, teammateStarts);
    this.party.reset(teammates.map((actor) => ({ id: actor.id, name: actor.state.name, role: actor.state.role })));
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", archetypeId: "nex", size: bossSize, alive: true,
          ...this.bossBase(), vitals: { hp, maxHp: hp }, facing: 0, history: new Map(),
          combat: {
            attackSpeed: attackTicks, attackRange: reach, attackStyle: "magic", nextActionTick: Infinity, targetId: LOCAL_ID, lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
      ...this.minions.createMages(),
      ...teammates,
    ];
  }

  // --- every tick ------------------------------------------------------------
  resolveHazards(context) {
    this.enter(context);
    if (context.tick === intro.rises && this.stage === "intro") this.rise(context);
    this.runTasks(context);
    if (this.stage !== "dead") {
      this.specials.coughs(context);
      this.specials.darknessTick(context);
    }
    this.specials.tidy(context.tick);
    return this.drainPending(context);
  }
  processPostTick(context) {
    this.enter(context);
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) {
      this.outcome = { ...this.outcome, phase: "victory" };
      this.announceMvp(context);
    }
    this.runTasks(context);
    this.watchThresholds(context);
    const boss = this.boss(context.world);
    if (boss) {
      boss.overheadPrayers = this.curse === "deflect" && boss.alive ? ["melee"] : undefined;
      // OBS (27th): her form shows her curse (ids.js); as she dies, her dying form.
      if (this.stage === "dead") boss.npcTypeId = npcTypeIds.nexDying;
      else if (this.phase === "zaros") boss.npcTypeId = this.curse === "soulSplit" ? npcTypeIds.nexSoulSplit : this.curse === "deflect" ? npcTypeIds.nexDeflect : npcTypeIds.nex;
    }
    return this.drainPending(context);
  }
  enter(context) {
    this.now = context.tick;
    this.world = context.world;
    this.context = context;
  }
  runTasks(context) {
    for (let index = this.tasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.tasks.findIndex((entry) => entry.tick <= this.now)) {
      const entry = this.tasks.splice(index, 1)[0];
      entry.task(context);
    }
  }
  drainPending(context) {
    const player = context.world.getPlayer();
    const hits = this.pending;
    this.pending = [];
    return player.alive ? hits : [];
  }
  message(context, message) {
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [typeof message === "string" ? { text: message } : { ...message }] });
  }
  // Her words: over her head, and in the chat (OBS: NPC_SAY "Nex|...").
  say(context, text) {
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: text, overheadCycle: 3 });
    this.message(context, { text: `Nex: ${text}`, color: "#ffff00" });
  }
  visual(context, { animations = [], projectiles = [], graphics = [], sounds: played = [] }) {
    emitInfernoVisual(context.tickEvents, {
      animations: animations.map(({ actorId = bossActorId, clipId, delayCycles = 0 }) => ({ actorId, clipId, delayCycles })),
      projectiles, graphics, nexSounds: played,
    });
  }
  // One of her projectiles (OBS: ids.js, `flight`).
  projectile(boss, target, spotAnimId, [startHeight, endHeight]) {
    const end = this.flightCycles(boss, target.position);
    return {
      spotAnimId, sourcePosition: getProjectileSourcePosition(boss), target: buildActorVisualTarget(target),
      startDelayCycles: flight.leaves, endDelayCycles: end, slope: flight.slope, startOffset: flight.offset, startHeight, endHeight,
    };
  }
  flightCycles(boss, tile) {
    return Math.max(flight.least, flight.base + flight.perTile * chebyshev(middleOf(boss.position), tile));
  }
  hitTicks(boss, tile) {
    return Math.max(1, Math.round(this.flightCycles(boss, tile) / 30));
  }

  // --- her intro and her phases ---------------------------------------------
  rise(context) {
    const boss = this.boss(context.world);
    if (!boss) return;
    this.say(context, "AT LAST!");
    this.visual(context, { animations: [{ clipId: "darkness" }], sounds: [{ id: sounds.rise }] });
    mages.forEach((spec, index) => {
      this.later(intro.calls[index] - intro.rises, (ctx) => {
        this.say(ctx, `${spec.name}!`);
        this.visual(ctx, { animations: [{ clipId: index % 2 === 0 ? "magic" : "cast" }], sounds: [{ id: sounds.call }] });
        this.minions.empower(ctx, spec.phase);
      });
    });
    this.later(intro.smoke - intro.rises, (ctx) => this.startPhase(ctx, "smoke"));
  }
  startPhase(context, phase) {
    const boss = this.boss(context.world);
    if (!boss?.alive) return;
    this.specials.interrupt();
    this.stage = "fight";
    this.phase = phase;
    this.specialSerial++;
    boss.npcTypeId = npcTypeIds.nex;
    boss.untargetable = false;
    this.floorHp = 0;
    this.say(context, phaseWords[phase]);
    if (phase === "zaros") {
      // WIKI, OBS: she heals 500. OBS (27th): no curse until her first attack, which turns Soul Split on (turnCurse).
      this.visual(context, {
        animations: [{ clipId: "zaros" }],
        graphics: [{ spotAnimId: spotAnims.power, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }],
        sounds: [{ id: sounds.power, delayCycles: 30 }],
      });
      this.healBoss(boss, zarosHeal, context);
      this.curse = null;
      this.curseCount = curseRun - 1;
    } else {
      this.visual(context, { sounds: [{ id: sounds.call }] });
      this.minions.empower(context, phase);
    }
    this.minions.clearReavers(context);
    const specials = phaseSpecials[phase];
    // OBS: her virus first in her smoke phase (7 of 7); either first in the others.
    this.specialTurn = phase === "smoke" || specials.length === 0 ? 0 : Math.floor(this.random() * specials.length);
    this.untilSpecial = specials.length ? 0 : Infinity;
    this.meleeRun = 0;
    this.nextAttackAt = context.tick + (phase === "zaros" ? 5 : firstSpecialTicks); // OBS: her first Zaros attack 5 to 11 after
    this.lastFought = context.tick;
    boss.combat.nextActionTick = this.nextAttackAt;
  }
  // After the player's turn: her hitpoints past a fifth call the mage (WIKI, OBS).
  watchThresholds(context) {
    const boss = this.boss(context.world);
    if (!boss?.alive || this.stage !== "fight") return;
    const index = phaseOrder.indexOf(this.phase);
    if (index < 0 || index >= thresholds.length || this.called[index]) return;
    if (boss.vitals.hp > thresholds[index]) return;
    this.called[index] = true;
    this.floorHp = thresholds[index] - transitionOverflow;
    const spec = mages[index];
    this.say(context, `${spec.name}, don't fail me!`);
    this.minions.wake(context, spec.phase);
  }
  // The mage of her phase died: her next phase, a tick later (OBS).
  mageDied(context, npc) {
    const index = mages.findIndex((spec) => mageActorId(spec.key) === npc.id);
    if (index < 0 || this.stage === "dead") return;
    const next = phaseOrder[index + 1];
    this.later(1, (ctx) => this.startPhase(ctx, next));
  }

  // --- her movement ------------------------------------------------------------
  moveBoss(boss, context) {
    this.enter(context);
    if (!boss.alive || this.stage !== "fight" || this.specials.kneeling || this.specials.dashing) return [];
    const target = this.nearestTarget(boss, context.world);
    if (!target) return [];
    boss.combat.targetId = target.id;
    return getNpcPursuitMoves(boss, { ...context, random: this.random }, this.party.actorOf(target, context.world));
  }
  // WIKI: "Nex targets the nearest valid player", the one with the lower defence on a tie; not one under her.
  nearestTarget(boss, world) {
    const ranked = this.party.byDistance(boss.position, bossSize, world).filter((entry) => entry.gap > 0);
    if (ranked.length === 0) return null;
    const nearest = ranked.filter((entry) => entry.gap === ranked[0].gap);
    if (nearest.length === 1) return nearest[0].member;
    // inferred: her roll at each decides a tie (the lower defence is the likelier to lose it).
    return nearest[Math.floor(this.random() * nearest.length)].member;
  }
  // Whether a melee blow reaches: beside her body, not at a corner (the game's rule for an NPC's melee).
  inMeleeReach(boss, tile) {
    if (gapTo(tile, boss.position) !== 1) return false;
    const [x, y] = tile;
    const maxX = boss.position[0] + bossSize - 1;
    const maxY = boss.position[1] + bossSize - 1;
    const outsideX = x < boss.position[0] || x > maxX;
    const outsideY = y < boss.position[1] || y > maxY;
    return !(outsideX && outsideY);
  }

  // --- her turn ----------------------------------------------------------------
  bossTurn(boss, context) {
    const idle = { environmentalDamages: [] };
    this.enter(context);
    if (!boss.alive || this.stage !== "fight" || context.tick < this.nextAttackAt) return idle;
    if (this.specials.kneeling || this.specials.dashing) return idle;
    const target = this.nearestTarget(boss, context.world);
    const targetActor = target ? this.party.actorOf(target, context.world) : null;
    if (!target || gapTo(targetActor.position, boss.position) > reach) {
      // WIKI: no one to fight for 8 ticks, she leaps back to the middle (OBS: or a bridge near her).
      if (context.tick - this.lastFought >= jumpIdleTicks) this.jump(boss, context);
      return idle;
    }
    faceActorToward(boss, targetActor);
    const specials = phaseSpecials[this.phase];
    if (specials.length && this.untilSpecial <= 0) {
      const name = specials[this.specialTurn % specials.length];
      this.specialTurn++;
      this.untilSpecial = specialEvery;
      this.specialSerial++;
      this.startSpecial(name, boss, context);
      this.nextAttackAt = context.tick + holdAfter[name];
      this.lastFought = context.tick;
      boss.combat.nextActionTick = this.nextAttackAt;
      return idle;
    }
    this.untilSpecial--;
    this.nextAttackAt = context.tick + attackTicks;
    boss.combat.nextActionTick = this.nextAttackAt;
    boss.combat.lastAttackTick = context.tick;
    this.lastFought = context.tick;
    if (this.phase === "zaros") this.turnCurse();
    if (this.inMeleeReach(boss, targetActor.position) && this.meleeRun < meleeRun) {
      this.meleeRun++;
      this.melee(boss, target, context);
    } else {
      this.meleeRun = 0;
      this.spell(boss, target, context);
    }
    return idle;
  }
  startSpecial(name, boss, context) {
    switch (name) {
      case "choke": return this.specials.choke(context, boss);
      case "dash": return this.specials.smokeDash(context, boss);
      case "darkness": return this.specials.startDarkness(context, boss);
      case "smash": return this.specials.smash(context);
      case "siphon": return this.specials.startSiphon(context, boss);
      case "sacrifice": return this.specials.startSacrifice(context, boss);
      case "containment": return this.specials.startContainment(context, boss);
      case "prison": return this.specials.startPrison(context, boss);
      default: return undefined;
    }
  }
  jump(boss, context) {
    const middle = middleOf(boss.position);
    // OBS: the middle, unless she is there already; then the nearest bridge.
    const atMiddle = boss.position[0] === bossStart[0] && boss.position[1] === bossStart[1];
    const spots = atMiddle ? jumpSpots.slice(1) : jumpSpots.slice(0, 1);
    const to = spots.sort((a, b) => chebyshev(a, middle) - chebyshev(b, middle))[0];
    boss.previousPosition = [...boss.position];
    boss.position = [...to];
    boss.movementPath = [];
    this.visual(context, { animations: [{ clipId: "jump" }], sounds: [{ id: sounds.jump, delayCycles: 30 }] });
    this.lastFought = context.tick;
    this.nextAttackAt = context.tick + afterJumpTicks;
    boss.combat.nextActionTick = this.nextAttackAt;
  }
  // Her blows: crush (WIKI), at the one she targets, landing as her animation plays (OBS: the hitsplat on its tick).
  melee(boss, member, context) {
    const zaros = this.phase === "zaros";
    const damage = this.party.roll(boss, member, { formulaStyle: "melee_crush", maxHit: maxHits.melee }, this.random, context.world);
    boss.combat.attackStyle = "melee";
    this.visual(context, { animations: [{ clipId: "melee" }], sounds: [{ id: sounds.melee, delayCycles: 30 }] });
    const done = this.party.hurt(member, { damage, style: "melee", keep: zaros ? keepMeleeZaros : keepMelee, source: "Nex" }, context);
    this.soulSplit(done, "melee");
    if (zaros && done > 0 && this.random() < turmoil.chance) {
      const drain = (stat) => stat.current - turmoil.drain;
      this.party.drainStats(member, { attack: drain, strength: drain, defence: drain, ranged: drain, magic: drain }, context.world);
    }
  }
  // Her spell or shots of the phase.
  spell(boss, target, context) {
    const world = context.world;
    const phase = this.phase;
    boss.combat.attackStyle = phase === "shadow" ? "range" : "magic";
    const living = this.party.living(world);
    let struck;
    if (phase === "blood") {
      // WIKI: her blood barrage, at one and whoever stands beside him (3 x 3; OBS: 1 to 4 struck).
      const at = this.party.tile(target, world);
      struck = [target, ...living.filter((member) => member.id !== target.id && chebyshev(this.party.tile(member, world), at) <= 1)];
    } else {
      struck = living.filter((member) => gapTo(this.party.tile(member, world), boss.position) > 0);
    }
    const kinds = {
      smoke: { spot: spotAnims.smoke, impact: spotAnims.smokeImpact, clip: "magic", sound: sounds.smoke, heights: heights.smoke },
      shadow: { spot: spotAnims.shadow, impact: null, clip: "magic", sound: sounds.shadow, heights: heights.shadow },
      blood: { spot: spotAnims.blood, impact: spotAnims.bloodImpact, clip: "cast", sound: sounds.blood, heights: heights.blood },
      ice: { spot: spotAnims.ice, impact: spotAnims.iceImpact, clip: "cast", sound: sounds.ice, heights: heights.ice },
      zaros: { spot: spotAnims.zaros, impact: spotAnims.zarosImpact, clip: "magic", sound: sounds.zaros, heights: heights.zaros },
    };
    const kind = kinds[phase];
    const actors = struck.map((member) => this.party.actorOf(member, world));
    this.visual(context, {
      animations: [{ clipId: kind.clip }],
      projectiles: actors.map((actor) => this.projectile(boss, actor, kind.spot, kind.heights)),
      graphics: kind.impact ? actors.map((actor) => ({ spotAnimId: kind.impact, target: buildActorVisualTarget(actor), height: phase === "zaros" ? 0 : 100, delayCycles: this.flightCycles(boss, actor.position) })) : [],
      sounds: [{ id: kind.sound }],
    });
    for (const member of struck) {
      const tile = this.party.tile(member, world);
      const distance = chebyshev(middleOf(boss.position), tile);
      const delay = this.hitTicks(boss, tile) + (phase === "zaros" ? 1 : 0); // OBS: her Zaros spells a tick later
      if (phase === "shadow") {
        const damage = this.party.roll(boss, member, { formulaStyle: "ranged", maxHit: shadowMax(distance) }, this.random, world);
        this.later(delay, (ctx) => this.party.hurt(member, { damage, style: "range", keep: keepRange, source: "Nex" }, ctx));
        continue;
      }
      const damage = this.party.roll(boss, member, { formulaStyle: "magic", maxHit: maxHits.magic }, this.random, world);
      const prayingAtCast = this.party.protection(member, world) === "magic";
      this.later(delay, (ctx) => {
        if (!this.party.alive(member, ctx.world)) return;
        const keep = phase === "zaros" && !prayingAtCast ? keepZarosLate : keepMagic;
        const done = this.party.hurt(member, { damage, style: "magic", keep, source: "Nex" }, ctx);
        const her = this.boss(ctx.world);
        if (phase === "blood" && done > 0) {
          if (her?.alive) this.healBoss(her, Math.floor(done * bloodHealShare), ctx);
          this.party.drainPrayer(member, Math.floor(done * bloodDrainShare), ctx.world);
        }
        if (phase === "ice") {
          // WIKI: it freezes for 15 ticks whoever does not pray magic; it drains prayer by half the damage.
          if (this.party.protection(member, ctx.world) !== "magic" && this.party.freeze(member, iceFreezeTicks, ctx.tick)) this.frozenMessage(member, ctx);
          this.party.drainPrayer(member, Math.floor(done / 2), ctx.world);
        }
        if (phase === "zaros" && done > 0) {
          this.party.drainPrayer(member, zarosPrayerDrain, ctx.world);
          this.soulSplit(done, "magic");
        }
      });
    }
    if (phase === "smoke") this.specials.maybeDrag(context, boss);
  }
  // WIKI: in her Zaros phase, Soul Split, Deflect Melee and none, four of her attacks each.
  turnCurse() {
    this.curseCount++;
    if (this.curseCount < curseRun) return;
    this.curseCount = 0;
    this.curse = this.curse === "soulSplit" ? "deflect" : this.curse === "deflect" ? null : "soulSplit";
  }
  // A hit of hers under Soul Split heals her, a little later (OBS (27th): `soulSplit`).
  soulSplit(damage, style) {
    if (this.curse !== "soulSplit" || damage <= 0) return;
    const { share, after } = soulSplit[style];
    const heal = Math.floor(damage * share);
    if (heal <= 0) return;
    this.later(after, (ctx) => {
      const her = this.boss(ctx.world);
      if (her?.alive && this.stage === "fight") this.healBoss(her, heal, ctx);
    });
  }
  // OBS (27th): "You have been frozen!" as an ice barrage (hers, Glacies's) holds the player.
  frozenMessage(member, context) {
    if (this.party.isLocal(member)) this.message(context, { text: "You have been frozen!", color: colors.red });
  }
  // A special that holds her next attack back (her blood sacrifice unleashed).
  delayAttack(ticks) {
    this.nextAttackAt = Math.max(this.nextAttackAt, this.now + ticks);
    const boss = this.boss();
    if (boss) boss.combat.nextActionTick = this.nextAttackAt;
  }
  healBoss(boss, amount, context) {
    if (!boss?.alive || amount <= 0) return 0;
    return healNpc(boss, amount, context.tickEvents);
  }

  // --- the party's hits -----------------------------------------------------------
  getEngineRules() {
    return {
      playerDamageOnNpc: (damage, { target, attacker }) => this.playerHit(damage, target, attacker),
    };
  }
  // A hit of the player on one of hers.
  playerHit(damage, target, attacker) {
    const context = this.context;
    if (this.minions.isStalagmite(target)) return this.stalagmiteHit(target, attacker, context);
    if (target.id === bossActorId && this.stage === "fight" && this.curse === "deflect" && attacker && isMeleeAttack(attacker)) {
      // OBS (27th): her hitsplat 0, and some of it back at the player (`deflectShare`).
      const back = Math.floor(damage * deflectShare);
      if (back > 0 && context) {
        this.party.hurt(this.party.member(LOCAL_ID), { damage: back, style: "typeless", source: "Deflect Melee" }, context);
        this.message(context, { text: "Nex deflects your damage back at you!", color: colors.red });
      }
      return 0;
    }
    return this.adjustHit(LOCAL_ID, target, damage, context);
  }
  // What a hit on one of hers does: her immunity, her siphon, a reaver's heal; the damage that counts for the member.
  adjustHit(memberId, target, damage, context) {
    if (target.id === bossActorId) {
      if (this.stage !== "fight") return 0;
      // WIKI: while she kneels for her siphon, the damage heals her.
      if (this.specials.kneeling) {
        if (context && damage > 0) this.healBoss(target, damage, context);
        return 0;
      }
      // Hits of one tick are judged before the engine applies any of them: each counts the ones before it.
      const hp = this.hitTick === this.now ? Math.min(target.vitals.hp, this.hpAfterHits) : target.vitals.hp;
      // Her phase's floor holds from the start: hits of one tick may cross her threshold and the 170 together.
      const index = phaseOrder.indexOf(this.phase);
      const floor = index >= 0 && index < thresholds.length ? thresholds[index] - transitionOverflow : 0;
      const room = Math.max(0, hp - floor);
      const done = Math.min(damage, room);
      this.hitTick = this.now;
      this.hpAfterHits = hp - done;
      if (this.floorHp > 0 && room === 0 && context && memberId === LOCAL_ID) this.message(context, "Nex is immune to your attacks!"); // OBS
      this.party.credit(memberId, done);
      return done;
    }
    if (this.minions.isReaver(target)) {
      const done = Math.min(damage, target.vitals.hp);
      // WIKI: hitting a reaver heals for half the damage.
      if (context && done > 0) this.party.heal(this.party.member(memberId), Math.floor(done * this.minions.reaverHealShare()), context);
      return done;
    }
    return damage;
  }
  // WIKI: only a stab or a crush breaks a stalagmite. OBS (27th): the game's words for each.
  stalagmiteHit(target, attacker, context) {
    const style = attacker?.equipment ? getWeaponFormulaStyle(attacker.equipment.weapon, attacker.selectedAttackStyleIndex) : null;
    if (style === "melee_stab" || style === "melee_crush") {
      if (context) this.message(context, { text: "You manage to destroy the icicle!", color: colors.magenta });
      return target.vitals.hp;
    }
    if (context) this.message(context, "Your weapon is unsuitable to break the ice.");
    return 0;
  }
  // A teammate's hit as it lands (teammates.js): the same rules as the player's, then the engine's hit.
  teamHit(member, targetId, damage, style, context) {
    const target = context.world.getNpc(targetId);
    if (!member || !target?.alive || target.death || !this.party.alive(member, context.world)) return;
    const done = this.adjustHit(member.id, target, damage, context);
    if (target.id === bossActorId && this.specials.kneeling) return;
    context.queueNpcHit({
      attackerId: member.id, targetId, style, attackKind: style === "range" ? "range_arrow" : "melee_stab",
      rolledDamage: done, accuracySucceeded: true, impactDelayTicks: 0, sourceDeathPolicy: "persist",
    });
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    const npc = context.world.getNpc(defeat.npcId);
    if (defeat.npcId === bossActorId) return this.died(defeat, context, completionOwnership);
    if (npc && this.minions.isMage(npc)) this.mageDied(context, npc);
    if (npc && this.minions.isStalagmite(npc)) this.specials.stalagmiteGone(npc.id, context);
  }
  died(defeat, context, completionOwnership) {
    const boss = this.boss(context.world);
    this.stage = "dead";
    this.specials.interrupt();
    this.curse = null;
    this.minions.clearReavers(context);
    if (boss) this.specials.startWrath(context, boss);
    // Her death sequence is the scene's (presentation.js, bossDeathAnimationEnabled); its sound the server's (OBS).
    this.later(1, (ctx) => this.visual(ctx, { sounds: [{ id: sounds.death }] }));
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = {
      phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks.victory, primaryActorId: bossActorId,
      completionActorIds: [bossActorId, ...mages.map((spec) => mageActorId(spec.key))],
    };
  }
  // WIKI: the MVP is whoever dealt her the most damage. OBS (27th): "You were the MVP for this fight!" (8 kills) or
  // "The MVP for this fight was: " and a name (the recorder hides other players' names: "a player"), as she dies.
  announceMvp(context) {
    let best = null;
    for (const member of this.party.members()) {
      const damage = this.party.contribution.get(member.id) ?? 0;
      if (!best || damage > best.damage) best = { member, damage };
    }
    if (!best) return;
    this.message(context, this.party.isLocal(best.member) ? "You were the MVP for this fight!" : `The MVP for this fight was: ${best.member.name}.`);
  }
  getOutcome() {
    return this.outcome;
  }
  // Held where he stands: a freeze, an ice prison, her drag's stun.
  moveDisplacedPlayer(player) {
    if (!this.party.frozenAt(this.party.member(LOCAL_ID), this.now)) return undefined;
    player.previousPosition = [...player.position];
    player.movementPath = [];
    player.isMoving = false;
    player.isRunning = false;
    return false;
  }

  // --- what the teammates ask --------------------------------------------------------
  dangerAt(tile, member) {
    return this.specials.dangerAt(tile, this.boss());
  }
  isBlockedForPlayers(tile) {
    const world = this.world;
    if (!world) return false;
    if (this.specials.isPrisonWall(tile, world)) return true;
    const mage = mages.some((spec) => {
      const npc = world.getNpc(mageActorId(spec.key));
      return npc?.alive && npc.position[0] === tile[0] && npc.position[1] === tile[1];
    });
    return mage;
  }

  // --- the controls -------------------------------------------------------------
  // A boss hitpoints preset: into that phase as it starts (the mages before it dead), at the start of the next tick.
  enterBossHpPhase(hp, context) {
    const boss = this.boss(context.world);
    if (!boss?.alive) return;
    this.enter(context);
    this.tasks = [];
    this.specials.interrupt();
    const index = hp > thresholds[0] ? 0 : hp > thresholds[1] ? 1 : hp > thresholds[2] ? 2 : hp > thresholds[3] ? 3 : 4;
    for (let earlier = 0; earlier < index; earlier++) {
      this.called[earlier] = true;
      const npc = context.world.getNpc(mageActorId(mages[earlier].key));
      if (npc?.alive) context.despawnNpc(npc.id);
    }
    boss.vitals = { ...boss.vitals, hp };
    this.later(0, (ctx) => this.startPhase(ctx, phaseOrder[index]));
  }
  syncBossHp(hp, { world }) {
    const boss = world.getNpc(bossActorId);
    if (boss) boss.vitals = { ...boss.vitals, hp };
  }
  getSnapshot({ tick } = {}) {
    const now = tick ?? this.now;
    const world = this.world;
    return {
      kind: this.kind,
      state: {
        stage: this.stage,
        phase: this.phase,
        teamSize: this.teamSize,
        nextAttackAt: this.nextAttackAt,
        untilSpecial: this.untilSpecial,
        nextSpecial: phaseSpecials[this.phase]?.[this.specialTurn % Math.max(1, phaseSpecials[this.phase].length)] ?? null,
        floorHp: this.floorHp,
        curse: this.curse,
        party: world ? this.party.snapshot(world, now) : [],
        ...this.specials.snapshot(now),
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel(npcId) {
    if (npcId?.startsWith("nex-reaver")) return "Blood Reaver";
    const spec = mages.find((entry) => mageActorId(entry.key) === npcId);
    if (spec) return spec.name;
    return "Nex";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

function clampTeam(value) {
  const size = Number(value);
  return Number.isInteger(size) && size >= 1 && size <= 6 ? size : defaultTeamSize;
}
function isMeleeAttack(attacker) {
  const style = getWeaponFormulaStyle(attacker.equipment?.weapon, attacker.selectedAttackStyleIndex);
  return typeof style === "string" && style.startsWith("melee");
}

const phasePresets = [
  { label: "Smoke (full)", hp: hitpoints, hint: "Her virus and smoke dash; her magic at everyone." },
  { label: "Shadow", hp: thresholds[0], hint: "Fumus dead: her darkness and shadows; shots at everyone, harder up close." },
  { label: "Blood", hp: thresholds[1], hint: "Umbra dead: her siphon and reavers, her blood sacrifice." },
  { label: "Ice", hp: thresholds[2], hint: "Cruor dead: her containment and ice prison; her barrage freezes." },
  { label: "Zaros", hp: thresholds[3], hint: "Glacies dead: she heals 500; her curses, and her wrath as she dies." },
];

export const nexDefinition = {
  kind: nexKind,
  factory: () => new NexEncounter(),
  descriptor: {
    kind: nexKind,
    displayName: "Nex",
    description: "Nex in her chamber with a team: her five phases and their specials (virus, smoke dash, darkness, shadows, siphon, blood sacrifice, containment, ice prison), her mages and reavers, her curses and wrath. The team is played by teammates until the site can bring people together.",
    seo: {
      title: "OSRS Nex Simulator",
      description: "Practice Nex in your browser with a team: her smoke, shadow, blood, ice and Zaros phases, every special, her mages and blood reavers, and her wrath.",
      h1: "Nex Simulator",
      intro: "Nex is the fifth general of the God Wars Dungeon, fought by a team in the Ancient Prison. This sim covers her five phases and their specials (her virus and smoke dash, her darkness and shadows, her siphon and blood sacrifice, her containment and ice prison), her four mages and her blood reavers, her curses in the Zaros phase and her wrath, with teammates who fight beside you.",
      keywords: ["Nex", "OSRS Nex simulator", "Nex simulator", "Nex practice", "Nex team", "Ancient Prison"],
    },
    mapSquare: nexMapSquare,
    playerStart,
    loadsMapLocs: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "NEX DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: nexLoadouts,
    tileMarkerPresets: [{
      id: "nex_aisles", name: "Middle and aisles", description: "Her body at the middle, where she rises and leaps back to, and the far end of each aisle of her smoke dash",
      link: "https://oldschool.runescape.wiki/w/Nex/Strategies",
      markers: [
        ...footprintTiles(bossStart).map(([x, y]) => [x, y, "#55FFFFFF"]),
        [45, 29, "#CCFF5050", "N"], [45, 9, "#CCFF5050", "S"], [55, 19, "#CCFF5050", "E"], [35, 19, "#CCFF5050", "W"],
      ],
    }],
  },
  controls: {
    defaultMechanicsConfig: { [teamSizeKey]: defaultTeamSize },
    mechanicsToggles: [{
      key: teamSizeKey, label: "Team size", setup: true,
      choices: [1, 2, 3, 4, 5].map((size) => ({ value: size, label: size === 1 ? "Solo" : String(size) })),
      info: "Players in all, you included. The others are teammates the fight plays for you.",
    }],
    bossHpPresets: phasePresets,
    debugActions: [],
  },
};
export { nexDefinition as definition };
export const order = 79;
