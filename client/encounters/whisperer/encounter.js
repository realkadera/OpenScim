// The Whisperer, the third boss of Desert Treasure II: the post-quest version and the awakened one (versions, below).
// https://oldschool.runescape.wiki/w/The_Whisperer/Strategies
//
// She waits in the sunken cathedral as the Odd Figure, until the player disturbs her from beside her. Then:
// - every 10 ticks a volley of three projectiles, a tick apart, each ranged or magic and each checked against the
//   player's prayer as it lands; the mix of the two grows with each special she has done. Five ticks after each
//   volley, four tentacles rise four tiles from the player and lash at the tile they stood on;
// - a player beside her is hit twice instead, a tick apart, through part of Protect from Melee;
// - at 720, 495 and 270 hitpoints a special: Corrupted Seeds, Screech and Soul Siphon, in one of two orders. Each is
//   met in the Shadow Realm, which the Blackstone fragment takes the player into and out of while it glows. The
//   Shadow Realm drains sanity and prayer; the normal realm gives sanity back. With none left, the player is hurt;
//   - seeds: the light seeds, known only in the Shadow Realm, must all be stomped within 40 ticks;
//   - screech: three screeches, each hiding the player behind one of eight floating columns or hurting them;
//   - soul siphon: twelve souls in four sets, hurt only in the Shadow Realm; each whole set killed gives something;
// - after each special she binds the player from afar and walks up to them, unless an ice spell freezes her;
// - at 0 hitpoints she heals to 140, pulls the player into the Shadow Realm, and fires one projectile and one
//   tentacle every two ticks until she dies.
//
// Sources, beside the usual: RSPSApp (data.js says what it is). Its timings are from recordings; where it says it
// chose without one, inferred is written here.
import { getMonsterFormulaStats } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { reviveNpc } from "../../engine/npcState.js";
import { monsterByNpcTypeIdAndVersion } from "../../data/monsters.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { emitInfernoVisual } from "../inferno/events.js";
import {
  arena, bossSite, columns as columnTiles, ids, local, mapSquare, messages, playerStart, screechY, seedLayout, seqs, soulSets,
  souls as soulTiles, spots, tentacleBounds,
} from "./data.js";
import { whispererLoadouts } from "./loadouts.js";

export { ids, seqs, spots, mapSquare, bossSite, playerStart } from "./data.js";
export const whispererKind = "whisperer";
export const whispererAwakenedKind = "whisperer_awakened"; // dt2/bosses.js, awakenedKind
export const bossActorId = "whisperer";
export const bossSize = 3; // CACHE, WIKI

const cyclesPerTick = 30;
// RSPSApp (recording 1703): the figure is disturbed, transforms 4 ticks later, and her first volley is 7 ticks after
// the disturbance (its shots on 8, 9 and 10). A player disturbing her from her north or south side is flung 3 tiles
// back that way; from another side, not (RSPSApp: only those two are recorded).
const transformTicks = 4;
const firstVolleyTicks = 7;
const knockbackTiles = 3;
// RSPSApp (1703): a volley's shots a tick apart, from the tick after it; each lands 3 ticks after it is fired,
// launched at cycle 30 and arriving at 90, from height 350 to 100 (the later recordings).
const volleyTicks = 10; // WIKI: 6 seconds
const shotImpactTicks = 3;
const shotProjectile = { startDelayCycles: 30, endDelayCycles: 90, slope: 254 / 16, startHeight: 350, endHeight: 100 };
const tentacleTicks = 5; // RSPSApp: a volley's tentacles rise 5 ticks after it
// RSPSApp (recording 3285): a tentacle rises, lashes a tick later, its path shows on the next, and it hits on the
// tick after that, then goes. One wave hits once, however many of its tentacles reach the player (WIKI).
const tentacleAttackAge = 1;
const tentaclePathAge = 2;
const tentacleHitAge = 3;
const tentacleGoneAge = 4;
const tentacleReach = 4; // WIKI: four tiles from the player
const meleeTicks = 5; // RSPSApp: her next attack 5 ticks after a melee (inferred)
// Thresholds of the specials, and the tick a special takes from her teleport. RSPSApp (3281): the fragment pulses
// on +6 for the seeds, +5 for the screech and +3 for the souls, with the announcement a tick after the teleport.
const activation = { seeds: 6, screech: 5, souls: 3 };
// RSPSApp: she takes 70% less damage during a special outside the Shadow Realm, 60% in it (WIKI).
const specialDamage = { normal: 0.3, shadow: 0.4 };
const resumeTicks = 15; // RSPSApp: her next attack 15 ticks after a special (inferred)
// RSPSApp (3281): the player is held in the Shadow Realm for a while after a special, as its end plays there.
const shadowExitTicks = { seeds: 2, souls: 7 };
const screechFirstTicks = 12; // RSPSApp (3285): the blasts at +17, +23 and +29 from the teleport
const screechEveryTicks = 6;
const screechHitTicks = 2; // RSPSApp, and the wiki's clip: the columns are hit 2 ticks after the screech
const screechCloseAge = 14; // RSPSApp (3281): the fragment stops answering 14 ticks after the teleport
const soulsChantEvery = 3; // RSPSApp (3281): the shadow souls chant every 3 ticks
const soulsLeaveTicks = 3;
// The bind. RSPSApp (22 casts in recordings 3281, 3285 and 3299): its projectile arrives after 200 cycles from 3
// tiles, 180 from 4 and 170 from further; it walks after the player from 5 ticks after the cast. The player is held
// for 8 ticks (RSPSApp: provisional; footage rules out 12) and the chase lasts 14 (inferred).
const bindCycles = { 3: 200, 4: 180, far: 170 };
const bindProjectile = { startDelayCycles: 80, startHeight: 580, endHeight: 0, slope: 1 };
const bindHoldTicks = 8;
const bindChaseTicks = 14;
const bindPursuitTicks = 5;
const bindGiveUpHp = 100; // WIKI: after the third special, below 100 she gives up the chase
// RSPSApp (a normal recording): at the enrage, her hitpoints are restored, she shows again 4 ticks later, the player
// is pulled into the Shadow Realm on 5 and her first shot is on 7.
const enrageAppearTicks = 4;
const enrageShadowTicks = 5;
const enrageFirstShotTicks = 7;
const enrageAttackTicks = 2; // WIKI
const deathTicks = 4; // inferred: as the other bosses of Desert Treasure II
// Sanity. WIKI: lost in the Shadow Realm, 3% with 3 prayer points; regained outside, 1% every 4 ticks
// (the strategies page). RSPSApp: the loss on the same 4-tick clock. With none left the player is hurt more each
// tick (RSPSApp: 5 more each time, provisional).
const sanityEvery = 4;
const insanityStep = 5;

// What differs between the two versions.
// https://oldschool.runescape.wiki/w/The_Whisperer/Strategies (Awakened)
// Nothing of the awakened fight has been read from a recording: its numbers are the WIKI's, and where it gives none,
// the post-quest one (inferred). Its sixteen souls are twelve here: where the four more stand is not known.
export const versions = {
  postQuest: {
    tableVersion: "Post-quest", // TABLE: 900 hitpoints
    maxHp: 900,
    thresholds: [720, 495, 270], // WIKI
    rangedMaxHit: 40, // WIKI
    magicMaxHit: 36, // WIKI
    // WIKI: 42 each, partly through Protect from Melee. The least is RSPSApp's (inferred), and so is the
    // prayed share: the "roughly one-third" mitigation of the wiki's Tentacular page.
    meleeHit: [28, 42],
    meleePrayed: 0.67,
    // WIKI: three, all one style; after one or two specials two of one and one of the other; after three, the
    // other in the middle.
    volley: (completed) => (completed >= 3 ? [0, 1, 0] : completed > 0 ? [0, 0, 1] : [0, 0, 0]),
    plusFromSpecials: 2, // WIKI: tentacles in a + as well as an X after the second special
    tentacleDamage: 20, // WIKI: and 20% sanity
    seedsTicks: 40, // RSPSApp (3281)
    darkSeedHit: [15, 25], // WIKI
    seedsFailHit: 75, // WIKI: and 75% sanity
    screeches: 3, // WIKI
    screechHit: 45, // WIKI: and 45% sanity
    // WIKI: one column of 60 hitpoints, one of 40 beside it, and up to three of 40 in all; the rest 20.
    columnHp: [60, 40],
    extraColumns40: [0, 2],
    soulsTicks: 18, // RSPSApp: 17 of the timer from the souls' appearance, a tick after the pulse
    soulsFailHit: 50, // WIKI: and she heals 100
    soulsFailHeal: 100,
    enrageHp: 140, // WIKI
    enrageStyle: (attacks) => (Math.floor(attacks / 2) % 2 ? 1 : 0), // WIKI: from ranged, the style every two attacks
    enrageTentacles: () => 1, // WIKI: one a shot
    sanityRegained: true,
    shadowDrain: 3, // WIKI
    bind: true,
  },
  awakened: {
    tableVersion: "Awakened", // TABLE: 2,700 hitpoints
    maxHp: 2700,
    thresholds: [2400, 2120, 1820, 1600, 1310, 1050, 800, 500], // WIKI: "roughly"
    rangedMaxHit: 53, // WIKI
    magicMaxHit: 45, // WIKI
    meleeHit: [50, 72], // WIKI: 50 to 72; 37 to 52 through prayer
    meleePrayed: 0.72,
    // WIKI: five, two of one style and three of the other; from the second special the middle three turned over;
    // after the seventh, the style every shot.
    volley: (completed) => (completed >= 7 ? [0, 1, 0, 1, 0] : completed >= 2 ? [0, 1, 1, 0, 0] : [0, 0, 0, 1, 1]),
    plusFromSpecials: 4, // WIKI
    tentacleDamage: 30, // WIKI: and 30% sanity
    seedsTicks: 26, // WIKI
    darkSeedHit: [60, 75], // WIKI (the seed's page has 55 to 65)
    seedsFailHit: 75, // inferred: the post-quest one
    screeches: 5, // WIKI
    screechHit: 70, // WIKI: and 70% sanity
    columnHp: [100, 80, 60, 40], // WIKI: one of 80 and one of 100 among the eight; beside each other, inferred
    extraColumns40: [0, 1],
    soulsTicks: 35, // WIKI
    soulsFailHit: 50, // inferred: the post-quest one
    soulsFailHeal: 100,
    enrageHp: 250, // WIKI
    enrageStyle: (attacks) => (attacks % 2 ? 0 : 1), // WIKI: from magic, the style every attack
    enrageTentacles: (attacks) => (attacks % 2 ? 0 : 2), // WIKI: "two or three tentacles every two attacks"
    sanityRegained: false, // WIKI: sanity does not come back outside the Shadow Realm
    shadowDrain: 4, // WIKI
    bind: true,
  },
};
const styles = ["ranged", "magic"];

const key = ([x, y]) => x + "," + y;
const chebyshev = ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const middleOf = (npc) => [npc.position[0] + 1, npc.position[1] + 1];
const tileTarget = (position) => ({ kind: "tile", position: [...position] });
// Beside her footprint, not on a diagonal (RSPSApp: a Manhattan distance of 1).
function isBeside(npc, [x, y]) {
  const [bx, by] = npc.position;
  const dx = Math.max(bx - x, x - (bx + npc.size - 1), 0);
  const dy = Math.max(by - y, y - (by + npc.size - 1), 0);
  return dx + dy === 1;
}
const inFootprint = (npc, [x, y]) => x >= npc.position[0] && x < npc.position[0] + npc.size && y >= npc.position[1] && y < npc.position[1] + npc.size;

// The monster table has an entry for each version of 12204; each version names the one it takes.
function tableFormulaStats(version) {
  const entry = monsterByNpcTypeIdAndVersion.get(ids.boss + ":" + version.tableVersion);
  if (entry?.levels.hitpoints !== version.maxHp) throw new Error(`The Whisperer: the monster table's ${ids.boss} has no entry with ${version.maxHp} hitpoints`);
  return structuredClone(getMonsterFormulaStats(ids.boss, version.tableVersion));
}
// A soul: one hitpoint, and nothing to stop a hit (inferred: the table has no entry for it).
const soulFormulaStats = () => ({
  burnImmunity: null, freezeResistance: 100, poisonResistance: 100, attributes: [],
  levels: { attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1 },
  offensive: { atk: 0, ranged: 0, magic: 0, str: 0, rangedStr: 0, magicStr: 0 },
  defensive: { stab: 0, slash: 0, crush: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0, magic: 0 },
});
// A Vita or Oratio set's reward: hitpoints or prayer, up to the player's level, kept in step with their stats.
function restore(player, stat, amount) {
  if (stat === "hitpoints") {
    const hp = Math.min(player.vitals.maxHp, player.vitals.hp + amount);
    player.vitals = { ...player.vitals, hp };
    player.stats = { ...player.stats, hitpoints: { ...player.stats.hitpoints, current: hp } };
    return;
  }
  const points = Math.min(player.prayerState.maxPoints, player.prayerState.points + amount);
  player.prayerState = { ...player.prayerState, points };
  player.stats = { ...player.stats, prayer: { ...player.stats.prayer, current: points } };
}
function plainActor(id, npcTypeId, size, position, idle, more = {}) {
  return {
    id, kind: "npc", role: "npc", npcTypeId, archetypeId: id.replace(/-\d+$/, ""), size, alive: true,
    position: [...position], previousPosition: [...position], facing: 0,
    untargetable: true, blocksNpcMovement: false, passThruNpcs: true, history: new Map(),
    vitals: { hp: 1, maxHp: 1 },
    combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
      animations: { idle, walk: idle, run: idle, attack: null, death: null } },
    ...more,
  };
}

class WhispererEncounter {
  constructor(kind = whispererKind, version = versions.postQuest) {
    this.kind = kind;
    Object.defineProperty(this, "version", { value: version }); // fixed for the fight: not state
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.phase = "asleep"; // "asleep", "waking", "fight", "enraged", "dead"
    // How she looks: the Odd Figure until she has risen, her binding form while she chases (RSPSApp: NPC types
    // 12213 and 12205). Her actor keeps 12204, the scene draws the form (presentation.js).
    this.form = "figure"; // "figure", "boss", "binding"
    this.wakeTick = null;
    this.sanity = 100;
    this.sanityClock = 0;
    this.insanity = 0;
    this.shadow = false;
    this.completed = 0; // specials done
    this.started = 0; // specials begun
    // WIKI, RSPSApp: one of two orders, for the whole fight (the awakened eight go round it).
    this.rotation = this.random() < 0.5 ? ["screech", "souls", "seeds"] : ["seeds", "screech", "souls"];
    this.special = null;
    this.nextAttack = Infinity;
    this.attacks = 0;
    this.transitionUntil = 0;
    this.events = []; // { due, type, ... }: what she does on a later tick
    this.tentacles = []; // { id, at, target, spawned, wave }
    this.waveHit = []; // the waves that have hit
    this.serial = 0;
    this.bind = null; // { until, pursuitAt, impactTick }
    this.playerBoundUntil = 0;
    this.giveUpChase = false;
    this.messages = []; // game messages for the next NPC turn to send
    this.prayerDrain = 0; // prayer the Shadow Realm has taken, for the next tick's start to take off
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
  getArenaConfig() {
    return { bounds: null, collisionMap: null, walkableTiles: null };
  }
  // The arena's open tiles, for the tentacles. Kept out of the state: the arena's, not the fight's.
  refineArenaConfig(arena) {
    Object.defineProperty(this, "walkable", { value: arena.walkableTiles ?? null, configurable: true, enumerable: false });
    return arena;
  }
  createNpcs() {
    const { maxHp } = this.version;
    return [{
      id: bossActorId, kind: "npc", role: "boss", npcTypeId: ids.boss, archetypeId: "whisperer", size: bossSize, alive: true,
      position: [...bossSite], previousPosition: [...bossSite], facing: 0, history: new Map(),
      vitals: { hp: maxHp, maxHp }, formulaStats: tableFormulaStats(this.version),
      combat: { attackSpeed: volleyTicks, attackRange: 1, attackStyle: "magic", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
        animations: { idle: seqs.idle, walk: seqs.walk, run: seqs.walk, attack: seqs.magic, death: seqs.death } },
    }];
  }
  // She stands, except to chase a player she has bound, or one who has gone more than 10 tiles off (RSPSApp).
  moveNpc(npc, context) {
    if (npc.id !== bossActorId || !(this.phase === "fight" || this.phase === "enraged") || this.special || this.transitionUntil > context.tick) return [];
    const player = context.world.getPlayer();
    if (!player?.alive || isBeside(npc, player.position)) return [];
    const chasing = this.bind && !this.giveUpChase && context.tick >= this.bind.pursuitAt && !this.frozen(npc, context.tick);
    if (chasing || chebyshev(middleOf(npc), player.position) > 10) return getNpcPursuitMoves(npc, { ...context, random: this.random });
    return [];
  }

  // --- each tick, before the NPCs ---------------------------------------
  resolveHazards(context) {
    // The fragment, used this tick.
    for (const use of context.inputs?.itemUses ?? []) if (use.itemId === ids.fragment || use.itemId === ids.fragmentActive) this.useFragment(context);
    return [];
  }
  // --- each tick, after the player -------------------------------------
  processPostTick(context) {
    const hits = [];
    const player = context.world.getPlayer();
    const boss = context.world.getNpc(bossActorId);
    if (this.phase === "asleep" && boss?.alive && player?.alive && player.attackTarget === boss.id && isBeside(boss, player.position)) this.disturb(boss, player, context);
    if (player?.alive && this.phase !== "asleep" && this.phase !== "dead") {
      this.stepSanity(player, hits);
      if (this.special?.kind === "seeds" && this.special.active) this.stompSeeds(player, context, hits);
    }
    for (const message of this.messages.splice(0)) this.say(context, message);
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    return hits;
  }
  processNpcTick(npc, context) {
    const idle = { environmentalDamages: [] };
    if (npc.id !== bossActorId) return idle;
    const player = context.world.getPlayer();
    if (this.phase === "asleep") {
      // As Duke Sucellus: the player who has clicked on her keeps her as a target, to walk up to her, and does not
      // attack her; nor does their thrall.
      if (player?.attackTarget === npc.id) player.attackInteractionActive = false;
      if (player?.thrall) player.thrall.nextAttackTick = Math.max(player.thrall.nextAttackTick, context.tick + 1);
      return idle;
    }
    if (this.phase === "dead" || !player?.alive) return idle;
    const turn = { environmentalDamages: [], npcAttacks: [] };
    const due = this.events.filter((event) => event.due <= context.tick);
    this.events = this.events.filter((event) => event.due > context.tick);
    for (const event of due) this.runEvent(event, npc, player, context, turn);
    this.stepTentacles(player, context, turn);
    if (this.phase === "waking" || this.transitionUntil > context.tick) return turn;
    if (this.special) {
      this.stepSpecial(npc, player, context, turn);
      return turn;
    }
    const { thresholds } = this.version;
    if (this.phase === "fight" && this.started < thresholds.length && context.tick >= this.nextAttack && npc.vitals.hp <= thresholds[this.started]) {
      this.clearTentacles(context);
      this.startSpecial(npc, context, this.rotation[this.started % this.rotation.length]);
      this.started++;
      return turn;
    }
    if (this.bind) this.stepBind(npc, player, context, turn);
    if (this.form === "binding" && !this.bind) this.form = "boss";
    if (this.bind && this.phase === "fight" && !this.giveUpChase) return turn;
    if (isBeside(npc, player.position)) {
      if (context.tick >= this.nextAttack) this.melee(npc, player, context, turn);
      return turn;
    }
    if (chebyshev(middleOf(npc), player.position) > 10) return turn;
    if (context.tick >= this.nextAttack) this.volley(npc, context);
    return turn;
  }

  // --- the start --------------------------------------------------------
  // Disturbed from beside her: the figure rises, flings a player on her north or south side back, and is her 4 ticks
  // later. She can be attacked from then (inferred).
  disturb(boss, player, context) {
    this.phase = "waking";
    this.wakeTick = context.tick;
    boss.attackBlockedUntilTick = context.tick + transformTicks;
    this.nextAttack = context.tick + firstVolleyTicks;
    this.events.push({ due: context.tick + transformTicks, type: "transform" });
    this.animate(context, bossActorId, "spawn");
    const [x, y] = player.position;
    const [bx, by] = boss.position;
    const along = x >= bx && x < bx + bossSize;
    const dy = along && y === by + bossSize ? knockbackTiles : along && y === by - 1 ? -knockbackTiles : 0;
    if (dy) context.teleportPlayer?.([x, y + dy]);
  }

  // --- what she does on later ticks --------------------------------------
  runEvent(event, boss, player, context, turn) {
    switch (event.type) {
      case "transform":
        this.phase = "fight";
        this.form = "boss";
        return;
      case "shot":
        // A player who has come beside her is meleed instead, and the rest of the volley goes (RSPSApp).
        if (isBeside(boss, player.position)) {
          this.events = this.events.filter((other) => other.type !== "shot");
          this.melee(boss, player, context, turn);
          return;
        }
        this.shoot(boss, player, context, turn, event.style, event.hand);
        if (this.phase === "enraged") this.spawnTentacles(boss, player, context, this.version.enrageTentacles(event.attack));
        return;
      case "tentacles":
        this.spawnTentacles(boss, player, context);
        return;
      case "melee":
        turn.environmentalDamages.push(this.meleeHit(event.damage, player));
        return;
      case "bindLands":
        if (this.bind && context.tick < this.bind.until) {
          this.playerBoundUntil = context.tick + bindHoldTicks;
          this.say(context, messages.bind);
          emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.bindImpact, target: buildActorVisualTarget(player), height: 0, delayCycles: 0 }] });
        }
        return;
      case "resume":
        this.resume(boss, context);
        return;
      case "enrageAppear":
        this.animate(context, bossActorId, "appear");
        return;
      case "enrageShadow":
        this.setShadow(true, context);
        this.say(context, messages.enrage);
        return;
      case "soulsLeave":
        for (const id of event.ids) context.despawnNpc(id);
        this.say(context, messages[event.result]);
        return;
      case "despawn":
        context.despawnNpc(event.id);
        return;
    }
  }

  // --- her attacks -------------------------------------------------------
  // A volley: its shots on the next ticks, one style or a mix (versions), and the tentacles 5 ticks after it.
  volley(boss, context) {
    if (this.form === "binding") this.form = "boss";
    const attack = this.attacks++;
    if (this.phase === "enraged") {
      this.events.push({ due: context.tick + 1, type: "shot", style: styles[this.version.enrageStyle(attack)], hand: attack % 2, attack });
      this.nextAttack = context.tick + enrageAttackTicks;
      return;
    }
    const first = this.random() < 0.5 ? 1 : 0; // RSPSApp: the volley's first style at random
    this.version.volley(this.completed).forEach((other, index) =>
      this.events.push({ due: context.tick + 1 + index, type: "shot", style: styles[other ? 1 - first : first], hand: index % 2, attack }));
    this.events.push({ due: context.tick + tentacleTicks, type: "tentacles" });
    this.nextAttack = context.tick + volleyTicks;
  }
  shoot(boss, player, context, turn, style, hand) {
    const magic = style === "magic";
    const attack = rollNpcAttack({
      attacker: boss, target: player, random: this.random,
      plan: { formulaStyle: style, damageType: magic ? "magic" : "range", attackKind: magic ? "magic_fire" : "range_arrow",
        maxHit: magic ? this.version.magicMaxHit : this.version.rangedMaxHit, impactDelayTicks: shotImpactTicks,
        prayerCheckAt: "impact", sourceDeathPolicy: "persist" }, // RSPSApp: her shots outlive a melee or a special
    });
    if (!attack) throw new TypeError("Missing formula stats for the Whisperer");
    boss.combat.lastAttackTick = context.tick;
    emitInfernoVisual(context.tickEvents, {
      animations: [{ actorId: boss.id, clipId: style + (hand ? "Alt" : ""), delayCycles: 0 }],
      projectiles: [{ spotAnimId: magic ? spots.magic : spots.ranged, sourcePosition: [middleOf(boss)[0] + 0.5, middleOf(boss)[1] + 0.5],
        target: buildActorVisualTarget(player), startOffset: 0, ...shotProjectile }],
      graphics: magic ? [{ spotAnimId: spots.magicImpact, target: buildActorVisualTarget(player), height: 0, delayCycles: shotProjectile.endDelayCycles }] : [],
    });
    turn.npcAttacks.push(attack);
  }
  // Two hits a tick apart of one roll, part of each through Protect from Melee (versions). The shots still to come
  // go, and her next attack is 5 ticks later.
  melee(boss, player, context, turn) {
    this.events = this.events.filter((event) => event.type !== "shot" && event.type !== "tentacles");
    this.nextAttack = context.tick + meleeTicks;
    boss.combat.lastAttackTick = context.tick;
    const [least, most] = this.version.meleeHit;
    const damage = least + Math.floor(this.random() * (most - least + 1));
    this.animate(context, bossActorId, "melee");
    turn.environmentalDamages.push(this.meleeHit(damage, player));
    this.events.push({ due: context.tick + 1, type: "melee", damage });
  }
  meleeHit(damage, player) {
    return { source: "The Whisperer", attackType: "melee", baseDamage: damage, prayerReduction: { type: "reduce", value: this.version.meleePrayed }, playerPosition: [...player.position] };
  }

  // --- tentacles -----------------------------------------------------------
  // Four tentacles four tiles from the player, at the corners (an X) or, from a special on, the sides (a +) at
  // random (WIKI); enraged, one or more at random of the eight. Each lashes at the tile the player stood on.
  spawnTentacles(boss, player, context, count = null) {
    const directions = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    let chosen;
    if (count !== null) {
      chosen = [];
      for (let n = 0; n < count; n++) chosen.push(directions[Math.floor(this.random() * directions.length)]);
    } else {
      const plus = this.completed >= this.version.plusFromSpecials && this.random() < 0.5;
      chosen = plus ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    }
    const wave = ++this.serial;
    const target = [...player.position];
    const animations = [];
    const graphics = [];
    for (const [dx, dy] of chosen) {
      const at = [target[0] + dx * tentacleReach, target[1] + dy * tentacleReach];
      if (!this.tentacleTileOpen(at, boss, context)) continue;
      const id = "whisperer-tentacle-" + ++this.serial;
      context.spawnNpc(plainActor(id, ids.tentacle, 3, [at[0] - 1, at[1] - 1], seqs.tentacleIdle));
      this.tentacles.push({ id, at, target, spawned: context.tick, wave });
      animations.push({ actorId: id, clipId: "spawn", delayCycles: 0 });
      graphics.push({ spotAnimId: spots.tentacleSpawn, target: tileTarget(at), height: 0, delayCycles: 0 });
    }
    if (animations.length) emitInfernoVisual(context.tickEvents, { animations, projectiles: [], graphics });
  }
  // RSPSApp: within the arena's tentacle bounds, not under her, and on a tile that can be walked.
  tentacleTileOpen([x, y], boss, context) {
    if (x < tentacleBounds.minX || x > tentacleBounds.maxX || y < tentacleBounds.minY || y > tentacleBounds.maxY) return false;
    if (inFootprint(boss, [x, y])) return false;
    return !this.walkable || this.walkable.has(key([x, y]));
  }
  stepTentacles(player, context, turn) {
    const animations = [];
    const graphics = [];
    for (const tentacle of [...this.tentacles]) {
      const age = context.tick - tentacle.spawned;
      const [dx, dy] = [Math.sign(tentacle.target[0] - tentacle.at[0]), Math.sign(tentacle.target[1] - tentacle.at[1])];
      const path = [1, 2, 3, 4].map((step) => [tentacle.at[0] + dx * step, tentacle.at[1] + dy * step]);
      if (age === tentacleAttackAge) {
        animations.push({ actorId: tentacle.id, clipId: "attack", delayCycles: 0 });
        graphics.push({ spotAnimId: spots.tentacleAttack, target: tileTarget(tentacle.at), height: 0, delayCycles: 0 });
      }
      if (age === tentaclePathAge)
        path.forEach((tile, step) => graphics.push({ spotAnimId: spots.tentaclePath[step], target: tileTarget(tile), height: 0, delayCycles: 5 * (step + 1), onGround: true }));
      if (age === tentacleHitAge && !this.waveHit.includes(tentacle.wave) && path.some((tile) => key(tile) === key(player.position))) {
        this.waveHit.push(tentacle.wave);
        turn.environmentalDamages.push({ source: "The Whisperer's tentacle", attackType: "typeless", baseDamage: this.version.tentacleDamage, playerPosition: [...player.position] });
      }
      if (age >= tentacleGoneAge) {
        context.despawnNpc(tentacle.id);
        this.tentacles.splice(this.tentacles.indexOf(tentacle), 1);
      }
    }
    const live = new Set(this.tentacles.map((tentacle) => tentacle.wave));
    this.waveHit = this.waveHit.filter((wave) => live.has(wave));
    if (animations.length || graphics.length) emitInfernoVisual(context.tickEvents, { animations, projectiles: [], graphics });
  }
  clearTentacles(context) {
    for (const tentacle of this.tentacles) context.despawnNpc(tentacle.id);
    this.tentacles = [];
    this.waveHit = [];
    this.events = this.events.filter((event) => event.type !== "tentacles");
  }

  // --- the Shadow Realm and sanity -----------------------------------------
  useFragment(context) {
    if (!this.special?.switchAllowed) {
      this.say(context, messages.unresponsive);
      return;
    }
    this.setShadow(!this.shadow, context);
  }
  setShadow(shadow, context) {
    if (this.shadow === shadow) return;
    this.shadow = shadow;
    // The columns and the souls look as the realm the player is in has them (RSPSApp).
    for (const column of this.special?.columns ?? []) {
      const npc = context.world.getNpc(column.id);
      if (npc) npc.npcTypeId = shadow ? ids.columnShadow : ids.column;
    }
    for (const soul of this.special?.souls ?? []) {
      const npc = context.world.getNpc(soul.id);
      if (npc) npc.npcTypeId = shadow ? ids.soulShadow : ids.soul;
    }
  }
  // The fragment glows while it can be used (RSPSApp: its item changes to the active one).
  glowFragment(world, glowing) {
    const player = world.getPlayer();
    if (!player?.inventory) return;
    player.inventory = player.inventory.map((item) =>
      item && (item.id === ids.fragment || item.id === ids.fragmentActive) ? { ...item, id: glowing ? ids.fragmentActive : ids.fragment } : item);
  }
  stepSanity(player, hits) {
    if (this.sanity <= 0) {
      if (!this.insanity) this.messages.push(messages.insanity);
      this.insanity++;
      hits.push({ source: "Insanity", attackType: "typeless", baseDamage: Math.min(99, insanityStep * this.insanity), playerPosition: [...player.position] });
      return;
    }
    this.insanity = 0;
    if (++this.sanityClock % sanityEvery !== 0) return;
    if (this.shadow) {
      this.changeSanity(-this.version.shadowDrain);
      this.prayerDrain += this.version.shadowDrain;
    } else if (this.version.sanityRegained) this.changeSanity(1);
  }
  changeSanity(amount) {
    this.sanity = Math.max(0, Math.min(100, this.sanity + amount));
  }

  // --- the specials ----------------------------------------------------------
  startSpecial(boss, context, kind) {
    this.special = { kind, age: 0, active: false, switchAllowed: false };
    this.bind = null;
    this.playerBoundUntil = 0;
    if (this.form === "binding") this.form = "boss";
    this.animate(context, bossActorId, "teleport");
  }
  stepSpecial(boss, player, context, turn) {
    const special = this.special;
    special.age++;
    if (special.age === 1) {
      // She comes back to her place, or for the screech south of the columns (RSPSApp).
      const to = special.kind === "screech" ? [bossSite[0], screechY] : [...bossSite];
      boss.position = to;
      boss.previousPosition = [...to];
      this.animate(context, bossActorId, special.kind === "souls" ? "souls" : "appear");
      this.say(context, messages[special.kind]);
    }
    if (special.age === 3) this.animate(context, bossActorId, special.kind === "souls" ? "soulChant" : special.kind === "seeds" ? "bind" : "screech");
    if (special.kind === "seeds" && special.age === 8) this.animate(context, bossActorId, "screech");
    if (special.kind === "seeds" && special.age === 10) this.animate(context, bossActorId, "screechHold");
    if (!special.active) {
      if (special.age === activation[special.kind]) this.activate(boss, context);
      return;
    }
    if (special.kind === "souls") return this.stepSouls(boss, player, context, turn);
    if (special.kind === "screech") return this.stepScreech(boss, player, context, turn);
    // The seeds' timer (the stomps are processPostTick's, after the player has moved).
    if (--special.left <= 0) {
      turn.environmentalDamages.push({ source: "The Whisperer's leeches", attackType: "typeless", baseDamage: this.version.seedsFailHit, playerPosition: [...player.position] });
      this.endSeeds(context, null);
      this.finish(boss, context, "seedsFailed", shadowExitTicks.seeds);
    }
  }
  activate(boss, context) {
    const special = this.special;
    Object.assign(special, { active: true, switchAllowed: true, activeAge: special.age });
    this.say(context, messages.pulse);
    this.glowFragment(context.world, true);
    if (special.kind === "seeds") {
      special.left = this.version.seedsTicks;
      const pattern = Math.floor(this.random() * 4);
      const [cx, cy] = [bossSite[0] + 1, bossSite[1] + 1];
      special.seeds = seedLayout(pattern).map(({ dx, dy, light }) => ({ at: [cx + dx, cy + dy], light, standing: true }));
      special.clean = true;
      emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: special.seeds.map((seed) => ({ spotAnimId: spots.seedSpawn, target: tileTarget(seed.at), height: 0, delayCycles: 0 })) });
    } else if (special.kind === "screech") {
      special.blasts = this.version.screeches;
      special.left = screechFirstTicks;
      special.columns = this.columnHitpoints().map((hp, index) => {
        const id = "whisperer-column-" + index;
        context.spawnNpc(plainActor(id, this.shadow ? ids.columnShadow : ids.column, 2, columnTiles[index], seqs.columnIdle,
          { vitals: { hp, maxHp: Math.max(...this.version.columnHp) }, blocksNpcMovement: true }));
        return { id, at: columnTiles[index], hp, standing: true };
      });
      this.animate(context, bossActorId, "screechHold");
      emitInfernoVisual(context.tickEvents, {
        animations: special.columns.map((column) => ({ actorId: column.id, clipId: "rise", delayCycles: 0 })), projectiles: [],
        graphics: special.columns.flatMap((column) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => ({ spotAnimId: spots.columnSpawn, target: tileTarget([column.at[0] + dx, column.at[1] + dy]), height: 0, delayCycles: 0 }))),
      });
    } else {
      special.left = this.version.soulsTicks;
      special.rewarded = [];
      // WIKI: twelve souls in four sets, shuffled among the tiles.
      const groups = soulSets.flatMap((set, group) => Array(set.size).fill(group));
      for (let index = groups.length - 1; index > 0; index--) {
        const other = Math.floor(this.random() * (index + 1));
        [groups[index], groups[other]] = [groups[other], groups[index]];
      }
      special.souls = soulTiles.map((at, index) => ({ id: "whisperer-soul-" + index, at, group: groups[index], dead: false, spawned: false }));
      emitInfernoVisual(context.tickEvents, { animations: [], graphics: [],
        projectiles: special.souls.map((soul) => ({ spotAnimId: spots.soulSpawn, sourcePosition: [middleOf(boss)[0] + 0.5, middleOf(boss)[1] + 0.5],
          target: tileTarget(soul.at), startOffset: 0, startDelayCycles: 0, endDelayCycles: 60, slope: 1, startHeight: 125, endHeight: 0 })) });
    }
  }
  // WIKI: one column of the most, the next most beside it, a few more of 40, the rest 20.
  columnHitpoints() {
    const hp = Array(8).fill(20);
    const strongest = Math.floor(this.random() * 8);
    this.version.columnHp.forEach((value, n) => {
      hp[(strongest + n) % 8] = value;
    });
    const [least, most] = this.version.extraColumns40;
    for (let n = least + Math.floor(this.random() * (most - least + 1)); n > 0; n--) {
      const weak = hp.flatMap((value, index) => (value === 20 ? [index] : []));
      if (weak.length) hp[weak[Math.floor(this.random() * weak.length)]] = 40;
    }
    return hp;
  }
  // The tiles the player stood on this tick: where they are, and the one they ran through (RSPSApp).
  stompSeeds(player, context, hits) {
    const special = this.special;
    const [x, y] = player.position;
    const [px, py] = player.previousPosition ?? player.position;
    const tiles = [[x, y]];
    if (Math.max(Math.abs(x - px), Math.abs(y - py)) === 2) tiles.unshift([px + Math.sign(x - px), py + Math.sign(y - py)]);
    for (const tile of tiles) {
      const seed = special.seeds.find((s) => s.standing && key(s.at) === key(tile));
      if (!seed) continue;
      seed.standing = false;
      const last = seed.light && special.seeds.every((s) => !s.light || !s.standing);
      if (!last) emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spots.seedStomp, target: tileTarget(seed.at), height: 0, delayCycles: 0 }] });
      if (!seed.light) {
        special.clean = false;
        const [least, most] = this.version.darkSeedHit;
        hits.push({ source: "A corrupted seed", attackType: "typeless", baseDamage: [least, most], playerPosition: [...player.position] });
      }
      if (last) {
        if (special.clean) this.changeSanity(15); // WIKI
        const boss = context.world.getNpc(bossActorId);
        this.endSeeds(context, seed);
        this.finish(boss, context, special.clean ? "seedsPerfect" : "seedsDone", shadowExitTicks.seeds);
        return;
      }
    }
  }
  // The seeds end (RSPSApp, 3281 and 3285): the dark ones vanish, the light ones still standing hatch, and a leech
  // flies from each into the player.
  endSeeds(context, last) {
    const special = this.special;
    const player = context.world.getPlayer();
    this.animate(context, bossActorId, "screechBlast");
    const hatch = [...special.seeds.filter((seed) => seed.standing && seed.light), ...(last ? [last] : [])];
    emitInfernoVisual(context.tickEvents, {
      animations: [],
      graphics: [
        ...special.seeds.filter((seed) => seed.standing && !seed.light).map((seed) => ({ spotAnimId: this.shadow ? spots.seedVanishShadow : spots.seedVanish, target: tileTarget(seed.at), height: 0, delayCycles: 0 })),
        ...hatch.map((seed) => ({ spotAnimId: this.shadow ? spots.seedHatchShadow : spots.seedHatch, target: tileTarget(seed.at), height: 0, delayCycles: 0 })),
      ],
      projectiles: player ? hatch.map((seed) => ({ spotAnimId: spots.leech, sourcePosition: [seed.at[0] + 0.5, seed.at[1] + 0.5], target: buildActorVisualTarget(player),
        startOffset: 0, startDelayCycles: 30, endDelayCycles: 100, slope: 1, startHeight: 0, endHeight: 0 })) : [],
    });
    for (const seed of special.seeds) seed.standing = false;
  }
  // The screech (RSPSApp, 3285): the first blast 12 ticks after the pulse, then every 6. Behind a column (the 2 x 2
  // north of it, she being south) the player is safe, and that column is spent; every other standing column loses 20.
  stepScreech(boss, player, context, turn) {
    const special = this.special;
    if (special.age === screechCloseAge) {
      special.switchAllowed = false;
      this.glowFragment(context.world, false);
      this.say(context, messages.deplete);
      special.depleted = true;
    }
    if (special.removeAt === special.age) {
      for (const column of special.columns.filter((c) => !c.standing && !c.removed)) {
        context.despawnNpc(column.id);
        column.removed = true;
      }
    }
    if (special.finishAt === special.age) return this.finish(boss, context, null, 0);
    const pending = special.pendingBlast;
    if (pending && special.age === pending.age + screechHitTicks) {
      if (!pending.cover) turn.environmentalDamages.push({ source: "The Whisperer's screech", attackType: "typeless", baseDamage: this.version.screechHit, playerPosition: [...player.position] });
      for (const column of special.columns.filter((c) => c.standing)) {
        column.hp -= 20;
        const npc = context.world.getNpc(column.id);
        if (npc) {
          npc.vitals = { ...npc.vitals, hp: Math.max(0, column.hp) };
          context.tickEvents.emit({ type: "hitsplat_spawned", targetId: column.id, amount: 20, hitsplatType: "damage" });
        }
        if (column.id === pending.cover || column.hp <= 0) column.standing = false;
      }
      special.removeAt = special.age + 1;
      special.pendingBlast = null;
      if (!special.blasts) special.finishAt = special.age + 1;
    }
    if (--special.left > 0) return;
    this.animate(context, bossActorId, "screechBlast");
    const cover = special.columns.find((c) => c.standing && player.position[0] >= c.at[0] && player.position[0] < c.at[0] + 2 && player.position[1] >= c.at[1] + 2 && player.position[1] < c.at[1] + 4);
    emitInfernoVisual(context.tickEvents, { animations: [], graphics: [{ spotAnimId: spots.screech, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }],
      projectiles: cover ? [{ spotAnimId: spots.screechProjectile, sourcePosition: [middleOf(boss)[0] + 0.5, middleOf(boss)[1] + 0.5], target: tileTarget(cover.at),
        startOffset: 0, startDelayCycles: 30, endDelayCycles: 70, slope: 1, startHeight: 100, endHeight: 10 }] : [] });
    special.pendingBlast = { age: special.age, cover: cover?.id ?? null };
    special.left = --special.blasts ? screechEveryTicks : Infinity;
  }
  stepSouls(boss, player, context, turn) {
    const special = this.special;
    if (special.age === special.activeAge + 1) {
      for (const soul of special.souls) {
        context.spawnNpc(plainActor(soul.id, this.shadow ? ids.soulShadow : ids.soul, 1, soul.at, seqs.soulIdle,
          { untargetable: false, vitals: { hp: 1, maxHp: 1 }, formulaStats: soulFormulaStats() }));
        soul.spawned = true;
      }
      this.animateMany(context, special.souls.map((soul) => soul.id), "spawn");
    }
    const since = special.age - special.activeAge;
    if (this.shadow && since >= 4 && since % soulsChantEvery === 1)
      for (const soul of special.souls.filter((s) => !s.dead))
        context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: soul.id }, overheadText: soulSets[soul.group].phrase, overheadCycle: soulsChantEvery });
    if (--special.left > 0) return;
    // Time is up: the souls still standing fly into her and go 3 ticks later.
    this.animate(context, bossActorId, "soulResolve");
    if (special.rewarded.length === 0) {
      turn.environmentalDamages.push({ source: "The Whisperer's chant", attackType: "typeless", baseDamage: this.version.soulsFailHit, playerPosition: [...player.position] });
      this.heal(boss, context, this.version.soulsFailHeal);
    }
    const left = special.souls.filter((soul) => !soul.dead);
    this.animateMany(context, left.map((soul) => soul.id), "fade");
    emitInfernoVisual(context.tickEvents, { animations: [], graphics: [],
      projectiles: left.map((soul) => ({ spotAnimId: this.shadow ? spots.soulAbsorbShadow : spots.soulAbsorb, sourcePosition: [soul.at[0] + 0.5, soul.at[1] + 0.5],
        target: buildActorVisualTarget(boss), startOffset: 0, startDelayCycles: 0, endDelayCycles: 60, slope: 1, startHeight: 0, endHeight: 100 })) });
    for (const soul of left) soul.dead = true;
    this.events.push({ due: context.tick + soulsLeaveTicks, type: "soulsLeave", ids: left.map((soul) => soul.id), result: special.rewarded.length ? "soulsPartial" : "soulsFailed" });
    special.souls = special.souls.filter((soul) => !left.includes(soul));
    this.finish(boss, context, null, shadowExitTicks.souls);
  }
  // A soul killed: a whole set gives its reward, all twelve 25 more damage to her and the end of the special.
  soulKilled(npcId, context) {
    const special = this.special;
    const soul = special?.kind === "souls" ? special.souls.find((s) => s.id === npcId && !s.dead) : null;
    if (!soul) return;
    soul.dead = true;
    if (special.souls.some((s) => s.group === soul.group && !s.dead) || special.rewarded.includes(soul.group)) return;
    special.rewarded.push(soul.group);
    const player = context.world.getPlayer();
    const boss = context.world.getNpc(bossActorId);
    if (soul.group === 0 && player) restore(player, "hitpoints", Math.floor(player.vitals.maxHp * 0.2));
    else if (soul.group === 1 && player?.prayerState) restore(player, "prayer", Math.floor(player.prayerState.maxPoints * 0.2));
    else if (soul.group === 2) this.changeSanity(15);
    else if (soul.group === 3) this.hurt(boss, context, 50);
    if (special.souls.every((s) => s.dead)) {
      this.hurt(boss, context, 25);
      this.say(context, messages.soulsFull);
      this.finish(boss, context, null, 0);
    }
  }
  // The end of a special. The player is let out of the Shadow Realm (some ticks later after some), and she binds
  // them, unless her hitpoints have already reached the next special.
  finish(boss, context, result, exitTicks) {
    if (!this.special.depleted) this.say(context, messages.deplete);
    if (result) this.say(context, messages[result]);
    this.clearSpecial(context);
    this.completed++;
    if (exitTicks > 0 && this.shadow) {
      this.transitionUntil = context.tick + exitTicks;
      this.events.push({ due: context.tick + exitTicks, type: "resume" });
      return;
    }
    this.resume(boss, context);
  }
  resume(boss, context) {
    this.nextAttack = context.tick + resumeTicks;
    this.setShadow(false, context);
    if (!boss?.alive || this.phase !== "fight") return;
    if (this.started < this.version.thresholds.length && boss.vitals.hp <= this.version.thresholds[this.started]) {
      this.nextAttack = context.tick;
      return;
    }
    if (this.version.bind) this.castBind(boss, context);
  }
  clearSpecial(context) {
    const special = this.special;
    if (!special) return;
    for (const column of special.columns ?? []) if (!column.removed) context.despawnNpc(column.id);
    for (const soul of special.souls ?? []) if (soul.spawned && !soul.dead) context.despawnNpc(soul.id);
    this.special = null;
    this.glowFragment(context.world, false);
  }

  // --- the bind --------------------------------------------------------------
  castBind(boss, context) {
    const player = context.world.getPlayer();
    if (!player?.alive) return;
    this.form = "binding";
    this.giveUpChase = false;
    const distance = chebyshev(middleOf(boss), player.position);
    const cycles = bindCycles[distance] ?? bindCycles.far;
    this.bind = { until: context.tick + bindChaseTicks, pursuitAt: context.tick + bindPursuitTicks };
    this.events.push({ due: context.tick + Math.ceil(cycles / cyclesPerTick), type: "bindLands" });
    emitInfernoVisual(context.tickEvents, {
      animations: [{ actorId: boss.id, clipId: "bind", delayCycles: 0 }],
      graphics: [{ spotAnimId: spots.bindCast, target: buildActorVisualTarget(boss), height: 120, delayCycles: 0 }],
      projectiles: [{ spotAnimId: spots.bind, sourcePosition: [middleOf(boss)[0] + 0.5, middleOf(boss)[1] + 0.5], target: buildActorVisualTarget(player),
        startOffset: 0, ...bindProjectile, endDelayCycles: cycles }],
    });
  }
  frozen(boss, tick) {
    return (boss.debuffs?.boundUntilTick ?? -1) >= tick;
  }
  // While she chases: frozen by the player's spell, the bind is off (WIKI); after the third special, below 100
  // hitpoints she gives up and shoots again 2 ticks later (RSPSApp); beside the player from 5 ticks after the cast,
  // she melees; at the end of the chase she goes back to her volleys.
  stepBind(boss, player, context, turn) {
    if (this.frozen(boss, context.tick)) {
      this.bind = null;
      this.playerBoundUntil = 0;
      this.form = "boss";
      return;
    }
    if (context.tick >= this.bind.until) {
      this.bind = null;
      this.form = "boss";
      return;
    }
    if (!this.giveUpChase && this.completed >= 3 && boss.vitals.hp < bindGiveUpHp) {
      this.giveUpChase = true;
      this.form = "boss";
      this.nextAttack = context.tick + 1;
      return;
    }
    if (context.tick >= this.bind.pursuitAt && isBeside(boss, player.position)) {
      this.bind = null;
      this.melee(boss, player, context, turn);
    }
  }

  // --- her death and the enrage -----------------------------------------------
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) {
      this.soulKilled(defeat.npcId, context);
      return;
    }
    const boss = context.world.getNpc(bossActorId);
    if (this.phase === "fight" && boss) {
      // WIKI: at 0 she heals 140 (250 awakened) and the enrage begins; RSPSApp: as a heal splat.
      reviveNpc(boss);
      const hp = this.version.enrageHp;
      boss.vitals = { ...boss.vitals, hp, maxHp: hp };
      context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount: hp, hitsplatType: "heal" });
      this.phase = "enraged";
      this.events = this.events.filter((event) => event.type === "melee");
      this.clearTentacles(context);
      this.clearSpecial(context);
      this.bind = null;
      this.playerBoundUntil = 0;
      this.form = "boss";
      this.attacks = 0;
      this.transitionUntil = defeat.tick + enrageFirstShotTicks - 1;
      this.nextAttack = this.transitionUntil;
      if (!this.shadow) {
        this.events.push({ due: defeat.tick + enrageAppearTicks, type: "enrageAppear" });
        this.events.push({ due: defeat.tick + enrageShadowTicks, type: "enrageShadow" });
      }
      return;
    }
    this.phase = "dead";
    this.events = [];
    this.clearTentacles(context);
    this.clearSpecial(context);
    this.bind = null;
    this.playerBoundUntil = 0;
    this.sanity = 100; // RSPSApp: restored as she dies
    this.setShadow(false, context);
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }

  // --- the rest ------------------------------------------------------------------
  getEngineRules() {
    return {
      // The Shadow Realm's drain of prayer, as the engine takes prayer off (prayers go when it runs out).
      onTickStart: () => {
        if (!this.prayerDrain) return;
        const prayerPointsDelta = -this.prayerDrain;
        this.prayerDrain = 0;
        return { prayerPointsDelta };
      },
      // The bind holds the player where they stand.
      playerMovementLocked: ({ tick }) => tick < this.playerBoundUntil,
      // During a special she takes 70% less (60% in the Shadow Realm); a soul is hurt only from the Shadow Realm.
      playerDamageOnNpc: (damage, { target }) => {
        if (target?.id === bossActorId && this.special) return Math.floor(damage * (this.shadow ? specialDamage.shadow : specialDamage.normal));
        if (target?.id?.startsWith("whisperer-soul-") && !this.shadow) return 0;
        return damage;
      },
      // WIKI: what her tentacles, screech and leeches take from the player's sanity, as much as the hit (when it hits).
      onPlayerDamageTaken: (hit) => {
        if (!(hit.effectiveDamage > 0)) return;
        if (hit.source === "The Whisperer's tentacle") this.changeSanity(-this.version.tentacleDamage);
        else if (hit.source === "The Whisperer's screech") this.changeSanity(-this.version.screechHit);
        else if (hit.source === "The Whisperer's leeches") this.changeSanity(-this.version.seedsFailHit);
      },
    };
  }
  heal(boss, context, amount) {
    if (!boss?.alive) return;
    boss.vitals = { ...boss.vitals, hp: Math.min(boss.vitals.maxHp, boss.vitals.hp + amount) };
    context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount, hitsplatType: "heal" });
  }
  // The Mors souls' damage: never her last hitpoint (inferred: the specials end far above it).
  hurt(boss, context, amount) {
    if (!boss?.alive) return;
    const dealt = Math.min(amount, boss.vitals.hp - 1);
    boss.vitals = { ...boss.vitals, hp: boss.vitals.hp - dealt };
    context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount: dealt, hitsplatType: "damage" });
  }
  animate(context, actorId, clipId) {
    emitInfernoVisual(context.tickEvents, { animations: [{ actorId, clipId, delayCycles: 0 }], projectiles: [], graphics: [] });
  }
  animateMany(context, actorIds, clipId) {
    if (actorIds.length) emitInfernoVisual(context.tickEvents, { animations: actorIds.map((actorId) => ({ actorId, clipId, delayCycles: 0 })), projectiles: [], graphics: [] });
  }
  say(context, { text, color }) {
    context.tickEvents.emit({ type: "game_message", kind: "game", segments: [color ? { text, color } : { text }] });
  }
  getSnapshot() {
    const special = this.special;
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        wakeTick: this.wakeTick,
        sanity: this.sanity,
        shadow: this.shadow,
        form: this.form,
        specialsDone: this.completed,
        playerBoundUntil: this.playerBoundUntil,
        special: special && {
          kind: special.kind,
          age: special.age,
          active: special.active,
          switchAllowed: special.switchAllowed,
          left: special.left ?? null,
          seeds: (special.seeds ?? []).filter((seed) => seed.standing).map((seed) => ({ at: [...seed.at], light: seed.light })),
          columns: (special.columns ?? []).filter((column) => column.standing).map((column) => ({ at: [...column.at], hp: column.hp })),
        },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "The Whisperer";
  }
}

export const whispererDefinition = {
  kind: whispererKind,
  factory: () => new WhispererEncounter(),
  descriptor: {
    kind: whispererKind,
    displayName: "The Whisperer",
    description: "Desert Treasure II. The Lassar Undercity's sunken cathedral: volleys and tentacles, the Shadow Realm, seeds, screeches and souls.",
    seo: {
      title: "OSRS Whisperer Simulator",
      description: "Practice the Whisperer from Desert Treasure II in your browser: her volleys and tentacles, the Shadow Realm and sanity, the Corrupted Seeds, the Screech and the Soul Siphon.",
      h1: "The Whisperer Simulator",
      intro: "The Whisperer is one of the four Desert Treasure II bosses in OSRS, fought in the sunken cathedral of the Lassar Undercity. This sim covers her volleys and tentacles, the Shadow Realm and its sanity, her three specials and her enrage, so you can drill the fight before doing it for real.",
      keywords: ["OSRS Whisperer", "Whisperer simulator", "Whisperer practice", "Desert Treasure II bosses", "DT2 boss simulator"],
    },
    mapSquare,
    playerStart,
    loadsMapLocs: true,
    isWorkInProgress: true,
    // No "3, 2, 1": she waits until the player disturbs her.
    fightStartCountdown: false,
    collision: { mode: "auto", seed: playerStart },
    victory: { eyebrow: "Triumphant", title: "VICTORY", narrative: "THE WHISPERER DEFEATED", accent: "gold" },
    variants: [
      { id: "post_quest", encounterKind: whispererKind, name: "Post-quest", subtitle: "900 hitpoints.", available: true, presetsKey: whispererKind },
      { id: "awakened", encounterKind: whispererAwakenedKind, name: "Awakened", subtitle: "2,700 hitpoints; five-shot volleys, eight specials. From the wiki, with twelve souls.", available: true, presetsKey: whispererKind },
    ],
    variantLabel: "Version",
    loadouts: whispererLoadouts,
  },
  controls: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] },
  variantFactories: { [whispererAwakenedKind]: () => new WhispererEncounter(whispererAwakenedKind, versions.awakened) },
  variantControls: { [whispererAwakenedKind]: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] } },
};
// How the registry finds it (encounters/registry.js), and where it stands in the encounter picker.
export { whispererDefinition as definition };
export const order = 81;
// For the tests.
export { local, arena };
