// Brutus (https://oldschool.runescape.wiki/w/Brutus), the bull of The Ides of
// Milk, in an instanced copy of the north-east corner of the Lumbridge cow
// field.
//
// He walks after the player and butts him every 5 ticks: crush, up to 3, which
// Protect from Melee stops. After two standard attacks, then four between
// each, he uses one of two specials, the first at random, then in turn:
// - stomp ("*snorts*"): three stomps, 8 ticks apart, each landing 4 ticks
//   after its snort on the tiles beside him toward the player (three along
//   an edge, or an L of five round a corner) and on his own. Step back a tile
//   to dodge.
// - charge ("*growls*"): he dashes in a straight line toward the player, up
//   to 7 tiles, 4 ticks after the growl, hitting him if he's in its lane.
//   Step to the side.
// Each lands on the tile the player stands on as its tick starts: a step
// taken on that tick is too late (OBS).
// Both specials hit for 15 to 19 and ignore prayer.
//
// Not here: the charge he makes at a player who safespots him for 15 ticks
// ("*huff*"), which passes through obstacles. Demonic Brutus, the hard
// version, is the picker's other "Version" (demonic.js).
//
// Sources: WIKI Brutus and Brutus/Strategies; TABLE his stats
// (client/data/monsters.js, 15626); CACHE his ids (ids.js); OBS six kills
// recorded with Outside (2026-11-27), only one of which (62 s) let him use his
// specials: three stomps and a charge. Numbers no source gives are marked
// inferred.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { brutusPursuitMoves, besideHim } from "./movement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, spotAnims, soundIds, mapSquare, mapSquareOffsets, bossSize, bossStart, playerStart, removedLocs } from "./ids.js";
import { brutusLoadouts } from "./loadouts.js";
import { stompTiles } from "./stomp.js";
import { demonicBrutusKind, demonicBrutusFactory, demonicBrutusControls } from "./demonic.js";

export { stompTiles };

export const brutusKind = "brutus";
export const brutusMapSquare = mapSquare;
export const brutusMapSquareOffsets = mapSquareOffsets;
export const removedLocIds = new Set(removedLocs.map((loc) => loc.locId));
export const bossActorId = "brutus";

const attackSpeed = 5; // TABLE, WIKI, OBS: his attacks 5 ticks apart
const meleeMaxHit = 3; // WIKI: "3 (melee)"
const meleeImpactTicks = 0; // OBS: the hitsplat on the player on the tick of his attack
const firstStandards = 2; // OBS: his first special after two standard attacks, in all three kills that reached one
const standardsBetweenSpecials = 4; // OBS: four between (t34-t49, t67-t84); WIKI: "After four to five basic attacks"
const specialDamage = [15, 19]; // WIKI: 15-19 ("scales with the player's Hitpoints level": not modelled); OBS 17 to 19
const deathTicks = 4; // OBS: "m-moo..." and his death t97, gone t101
const stomp = {
  count: 3, // WIKI: "he will do this three times"; OBS: t10, t18, t26
  everyTicks: 8, // OBS
  landTicks: 4, // OBS: the snort t10, the hit t14; WIKI: "a 4 tick (2.4s) window"
  nextTurnTicks: 24, // OBS: the first snort t10, his next attack t34
};
const charge = {
  setOffTicks: 4, // OBS: the growl, and the hit 4 ticks on, in all 5 charges recorded; WIKI: "a 3 tick (1.8s) window"
  // OBS: 7 tiles where there was room (two charges), 6, 5 and 4 where a fence stopped him; WIKI: "Dash forward 4 Tiles".
  tiles: 7,
  // He charges only with room for 4 or more (inferred: OBS the shortest, 4; WIKI: "the attack is not used if the charge
  // would hit a wall").
  minTiles: 4,
  tilesPerTick: 4, // inferred: the 7 tiles in two ticks (OBS: still at t54, 7 tiles on by t60)
  nextTurnTicks: 8, // OBS: his next butt 8 ticks after the growl where he ended beside the player (t94, t102); later where he walked back
};
const specialOrder = ["stomp", "charge"];
// The setup menu's switches, one a special, both on: one switched off leaves the other alone; with none he only butts.
const specialKeys = { stomp: "brutusStomp", charge: "brutusCharge" };
const defaultMechanics = Object.fromEntries(Object.values(specialKeys).map((key) => [key, true]));
const specialToggles = [
  { key: specialKeys.stomp, label: "Stomp", info: "\"*snorts*\": step back a tile before each of his three stomps lands." },
  { key: specialKeys.charge, label: "Charge", info: "\"*growls*\": step out of the line he faces before he dashes." },
].map((toggle) => ({ ...toggle, section: "Specials", setup: true }));

const directions = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const key = ([x, y]) => x + "," + y;
const inFootprint = (corner, [x, y]) => x >= corner[0] && x < corner[0] + bossSize && y >= corner[1] && y < corner[1] + bossSize;

// The way he charges: toward the player, along the axis he's furthest on (inferred: OBS one charge, straight west at a
// player beside him on the west).
export function chargeDirection(corner, player) {
  const middle = [corner[0] + (bossSize >> 1), corner[1] + (bossSize >> 1)];
  const dx = player[0] - middle[0];
  const dy = player[1] - middle[1];
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "W" : "E";
  return dy < 0 ? "S" : "N";
}

const bossDefinition = defineNpc({
  id: "brutus",
  move: ({ actor, context, config }) => config.bossMove(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

const onTile = (spotAnimId, position) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height: 0, delayCycles: 0, onGround: true });
const onActor = (spotAnimId, actor) => ({ spotAnimId, target: buildActorVisualTarget(actor), height: 0, delayCycles: 0 });

class BrutusEncounter {
  kind = brutusKind;
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
    this.phase = "fighting"; // "fighting" | "dead"
    this.nextAt = 1;
    this.standards = 0;
    this.specialsDone = 0;
    this.nextSpecial = null; // decided at random as the first is due
    this.special = null; // { name, startedAt, endsAt, ... }
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  // After the player has moved on its tick (processPostTick): what a stomp or a charge finds him on.
  laterAfterMove(ticks, task) {
    this.postTasks.push({ tick: this.now + ticks, task });
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }
  // A visual event: his clip, graphics, and the sounds of no animation, which his audio layer plays (audio.js).
  animate(context, clipId, graphics = [], sounds = []) {
    emitInfernoVisual(context.tickEvents, {
      animations: clipId ? [{ actorId: bossActorId, clipId, delayCycles: 0 }] : [],
      projectiles: [],
      graphics,
      ...(sounds.length ? { brutusSounds: sounds.map(({ id, position }) => ({ id, position: [...position] })) } : {}),
    });
  }
  // His overhead text, for 5 ticks: the game client's 150 cycles (3 seconds) (overheadCycle is in ticks).
  say(context, text) {
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: text, overheadCycle: 5 });
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
    if (mechanics) this.mechanics = mechanics;
    this.random = createSeededRandom(this.seed);
    this.startRun();
    const boss = context?.world.actors.get(bossActorId);
    if (!boss) return;
    boss.position = [...bossStart];
    boss.previousPosition = [...bossStart];
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.brutus); // TABLE: 58
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.brutus, archetypeId: "brutus", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 512, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.brutus)),
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
    for (let index = this.tasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.tasks.findIndex((entry) => entry.tick <= this.now)) {
      this.tasks.splice(index, 1)[0].task(context);
    }
    return [];
  }
  processPostTick(context) {
    this.now = context.tick;
    this.context = context;
    for (let index = this.postTasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.postTasks.findIndex((entry) => entry.tick <= this.now)) {
      this.postTasks.splice(index, 1)[0].task(context);
    }
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    const damages = this.pending;
    this.pending = [];
    return damages;
  }
  // A special's hit: typeless, so prayer doesn't touch it (WIKI: "ignores protection prayers").
  hurt(source) {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage: this.randomInt(specialDamage), attackType: "typeless", playerPosition: [...player.position] });
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  // --- his movement and his turn ------------------------------------------------
  // He walks after the player, stands through a stomp, and dashes in a charge.
  bossMove(boss, context) {
    if (this.phase !== "fighting") return [];
    const special = this.special;
    if (!special) return brutusPursuitMoves(boss, context);
    if (special.name !== "charge" || context.tick < special.setsOffAt || special.travelled >= special.path.length) return [];
    const path = special.path.slice(special.travelled, special.travelled + charge.tilesPerTick);
    special.travelled += path.length;
    return [{ npcId: boss.id, path }];
  }
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase !== "fighting") return none;
    if (context.tick === 1) {
      this.animate(context, "spawn"); // OBS: 13790 as he appears
      this.say(context, "Moo"); // OBS
    }
    if (this.special) {
      if (this.special.snorts?.includes(context.tick)) this.snort(context);
      if (context.tick < this.special.endsAt) return none;
      this.special = null;
    }
    if (context.tick < this.nextAt || !player.alive) return none;
    const next = this.nextEnabledSpecial();
    const due = this.specialsDone === 0 ? firstStandards : standardsBetweenSpecials;
    if (next && this.standards >= due) {
      // A charge with no room to dash is a stomp instead (inferred), if the setup has stomps on.
      if (next === "charge" && this.startCharge(boss, player, context)) return none;
      if (this.mechanics?.[specialKeys.stomp] !== false) {
        this.startStomp(boss, player, context);
        return none;
      }
    }
    // A standard attack only from beside him, not from a corner (inferred: as any melee NPC).
    if (!this.inMeleeReach(boss, player)) return none;
    this.nextAt = context.tick + attackSpeed;
    this.standards++;
    return { environmentalDamages: [], npcAttacks: [this.butt(boss, player, context)] };
  }
  inMeleeReach(boss, player) {
    return besideHim(boss.position, player.position);
  }
  butt(boss, player, context) {
    const attack = rollNpcAttack({
      attacker: boss, target: player,
      plan: { formulaStyle: "melee_crush", damageType: "melee", attackKind: "melee_crush", maxHit: meleeMaxHit, impactDelayTicks: meleeImpactTicks, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Brutus");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "attack", kind: "brutus_attack", impactDelayTicks: meleeImpactTicks });
    return attack;
  }

  // --- his specials -------------------------------------------------------------------
  // The one due that the setup has on: the first at random (WIKI, OBS: a stomp first in two kills, a charge in one),
  // then the other each time.
  nextEnabledSpecial() {
    const on = specialOrder.filter((name) => this.mechanics?.[specialKeys[name]] !== false);
    if (on.length === 0) return null;
    if (this.nextSpecial === null) this.nextSpecial = specialOrder[Math.floor(this.random() * specialOrder.length)];
    return on.includes(this.nextSpecial) ? this.nextSpecial : on[0];
  }
  finishSpecial(name) {
    this.standards = 0;
    this.specialsDone++;
    this.nextSpecial = specialOrder[(specialOrder.indexOf(name) + 1) % specialOrder.length];
  }
  startStomp(boss, player, context) {
    this.finishSpecial("stomp");
    const startedAt = context.tick;
    // OBS: the snorts on the special's first tick and 8 and 16 ticks on, each on his turn.
    const snorts = Array.from({ length: stomp.count }, (_, n) => startedAt + n * stomp.everyTicks);
    this.special = { name: "stomp", startedAt, endsAt: startedAt + stomp.nextTurnTicks - 1, snorts };
    this.nextAt = startedAt + stomp.nextTurnTicks;
    this.snort(context);
  }
  // One stomp: the snort, and its tiles from where the player is now; it lands after he has moved, 4 ticks on.
  snort(context) {
    const boss = this.boss(context.world);
    if (!boss?.alive || this.phase !== "fighting") return;
    const tiles = stompTiles(boss.position, context.world.getPlayer().position);
    this.say(context, "*snorts*");
    this.animate(context, "stomp", [], [{ id: soundIds.snort, position: boss.position }]);
    this.special.tiles = tiles.all;
    // OBS: the stomp lands on the player's tile as its tick starts (a player who stepped back onto its tiles that tick
    // wasn't hit; one who stepped off them was).
    this.later(stomp.landTicks, (ctx) => {
      const now = this.boss(ctx.world);
      if (!now?.alive || this.phase !== "fighting") return;
      this.animate(ctx, null, [...tiles.outside.map((tile) => onTile(spotAnims.stompTile, tile)), onActor(spotAnims.stompBoss, now)]);
      const at = key(ctx.world.getPlayer().position);
      if (tiles.all.some((tile) => key(tile) === at)) this.hurt("Brutus's stomp");
    });
  }
  // The charge, as far as 7 tiles till an obstacle stops him, if there's room for 4: false if not.
  startCharge(boss, player, context) {
    const direction = chargeDirection(boss.position, player.position);
    const [dx, dy] = directions[direction];
    const path = [];
    let at = boss.position;
    for (let step = 0; step < charge.tiles; step++) {
      const next = [at[0] + dx, at[1] + dy];
      if (!isArenaFootprintWalkable(next, bossSize)) break;
      path.push(next);
      at = next;
    }
    if (path.length < charge.minTiles) return false;
    this.finishSpecial("charge");
    const startedAt = context.tick;
    // His lane: every tile his 3x3 covers from where he stands to where he stops.
    const lane = new Set();
    for (const corner of [boss.position, ...path]) for (let x = 0; x < bossSize; x++) for (let y = 0; y < bossSize; y++) lane.add(key([corner[0] + x, corner[1] + y]));
    this.special = { name: "charge", startedAt, endsAt: startedAt + charge.nextTurnTicks, direction, path, travelled: 0, setsOffAt: startedAt + charge.setOffTicks };
    this.nextAt = startedAt + charge.nextTurnTicks;
    this.say(context, "*growls*");
    this.animate(context, "charge", [], [{ id: soundIds.growl, position: boss.position }]);
    this.later(charge.setOffTicks, (ctx) => {
      if (this.phase !== "fighting") return;
      if (lane.has(key(ctx.world.getPlayer().position))) this.hurt("Brutus's charge");
    });
    return true;
  }

  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    this.phase = "dead";
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.special = null;
    this.say(context, "m-moo..."); // OBS
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
        standardsSinceSpecial: this.standards,
        specialsDone: this.specialsDone,
        nextSpecial: this.nextSpecial,
        nextAttackAt: this.nextAt,
        special: this.special && {
          name: this.special.name,
          startedAt: this.special.startedAt,
          endsAt: this.special.endsAt,
          direction: this.special.direction ?? null,
          tiles: this.special.tiles ? this.special.tiles.map((tile) => [...tile]) : null,
        },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "Brutus";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const brutusDefinition = {
  kind: brutusKind,
  factory: () => new BrutusEncounter(),
  descriptor: {
    kind: brutusKind,
    displayName: "Brutus",
    description: "The Lumbridge cow field. His butts, three stomps to step back from, and a charge to step aside from.",
    mapSquare: brutusMapSquare,
    mapSquareOffsets: brutusMapSquareOffsets,
    playerStart,
    loadsMapLocs: true,
    // The plant at 57,25 is gone in the fight's copy of the field (OBS). Collision leaves scenery out only by id: so too
    // the two plants of that id on the field's west edge (49,14 and 51,10), which presentation.js doesn't draw either.
    collision: { mode: "auto", seed: playerStart, excludedStaticLocIds: removedLocIds },
    victory: { title: "VICTORY", narrative: "BRUTUS DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    // Demonic Brutus is a variant kind with an encounter of its own (demonic.js), in the same field, with the same setups.
    variants: [
      { id: "brutus", encounterKind: brutusKind, name: "Brutus", subtitle: "58 hitpoints. Three stomps and a charge.", available: true, presetsKey: brutusKind },
      {
        id: "demonic", encounterKind: demonicBrutusKind, name: "Demonic Brutus",
        subtitle: "750 hitpoints and a second phase. His charges and slams come with three ghosts, and orbs to pray against.", available: true, presetsKey: brutusKind,
      },
    ],
    variantLabel: "Version",
    loadouts: brutusLoadouts,
  },
  controls: { defaultMechanicsConfig: { ...defaultMechanics }, mechanicsToggles: specialToggles, debugActions: [] },
  variantFactories: { [demonicBrutusKind]: demonicBrutusFactory },
  variantControls: { [demonicBrutusKind]: demonicBrutusControls },
};
export { brutusDefinition as definition };
export const order = 87;
