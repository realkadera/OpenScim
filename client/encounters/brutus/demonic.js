// Demonic Brutus (https://oldschool.runescape.wiki/w/Demonic_Brutus), the hard
// version of Brutus, in the same field: the Brutus picker's "Version".
//
// He butts the player every 5 ticks: crush, up to 4, through Protect from
// Melee. After two butts he fades and uses a special, then three more (now and
// then two), and so on:
// - charge: he reappears on a side of the player and dashes across him; three
//   ghosts do the same from the other sides, a tick apart, clockwise.
// - slam: he reappears at a corner of the player and stomps the corner tile,
//   the two beside it and his own; three ghosts the same at the other corners.
// The two alternate, from sides and corners that go round the player: E, SW,
// W, NE (or S, NW, N, SE), from a random one of the four. Each bull hits for 45
// to 56, through prayer. A charge's lanes are offset round the player, each
// bull's left row on him: a tile clear of the first two, then one clear of the
// last two, dodge it; two tiles straight dodge a slam.
// - from 500 hitpoints his first bull is 3 ticks after he fades, not 5;
// - from 250 the ghosts go counterclockwise;
// - a player too close to an obstacle as a special starts is pushed into
//   open space, and walks (no running) till it ends;
// - at 0 he says "moo moo!" and heals 487: phase 2, the same with four orbs
//   over the player's head, which land with the bulls, each a projectile of
//   the style its colour shows (magic, melee, ranged, then one at random) for
//   18 to 20, which that protection prayer stops.
//
// Not here: the orbs' projectiles in flight (only their splash, and them held
// and dropping over the player's head).
//
// Sources: WIKI Demonic Brutus and Demonic Brutus/Strategies; TABLE his stats
// (client/data/monsters.js, 15628); CACHE his ids (ids.js); OBS one kill read
// from a video (tools/video-timeline, 2:37.20, 7 specials in phase 1 and 4 in
// phase 2), which gives every timing below. Numbers no source gives are marked
// inferred.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { reviveNpc } from "../../engine/npcState.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget, faceActorToward } from "../shared/npcHelpers.js";
import { isArenaFootprintWalkable } from "../shared/npcMovement.js";
import { brutusPursuitMoves, besideHim } from "./movement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, demonicSeqIds, orbSpotAnims, spotAnims, bossSize, bossStart, playerStart, sameTile } from "./ids.js";
import { demonicSlamTiles } from "./stomp.js";

export const demonicBrutusKind = "brutus_demonic";
export const bossActorId = "brutus";

const attackSpeed = 5; // WIKI, OBS
const meleeMaxHit = 4; // WIKI: "max hit of 4", "can hit through Protect from Melee"; OBS up to 3, praying melee
// WIKI (Strategies): "Every two to three attacks" (the article: "After three basic attacks"); OBS, four kills on video:
// 5 ticks apart, then the special 5 on. Before his first special, two (both kills that show it, at 81 and 93 damage
// dealt: the wiki's "~100 damage at the start" isn't needed); before each later one, two for 6 of 40, else three.
const standardsBeforeFirstSpecial = 2;
const twoStandardsChance = 6 / 40;
const bullDamage = [45, 56]; // WIKI: "45-56 damage"; OBS none (every bull dodged)
const orbDamage = [18, 20]; // WIKI: "18-20"; OBS 19 and 20
const healAtPhaseTwo = 487; // WIKI, OBS: 0/750, then 487/750
const fastBelowHp = 500; // WIKI; OBS: the first bull 5 ticks after the fade above, 3 from 500 down
const counterclockwiseBelowHp = 250; // WIKI; OBS: clockwise at 547 and 386, counterclockwise at 216 and 142
const leadTicks = { slow: 5, fast: 3 }; // OBS
const nextButtAfterLastBull = 4; // OBS: the last bull t137, his next butt t141
const phaseTwoFirstButt = 5; // OBS: "moo moo!" t169, his next butt t174
const deathTicks = 4; // as Brutus's (inferred)
const charge = { tiles: 7, tilesPerTick: 4, gap: 2 }; // as Brutus's charge (inferred); gap: tiles between him and the player
const ghostStayTicks = 2; // inferred: a ghost goes once its bull is done
// WIKI: "if the player stands too close to an obstacle when a special starts, they are pushed into open space and cannot
// run for the special's duration". inferred: too close is an obstacle within 3 tiles (the 7 x 7 his slam's corners
// stand in); open space is the nearest tile, by a walk of at most `pushSearch` tiles, with none.
const clearance = 3;
const pushSearch = 12;

// The specials' starts, in turn: a charge from a side, a slam from a corner. OBS: E, SW, W, NE in three kills on
// video; S, NW, N, SE in a fourth (from a slam at NW). WIKI: "If West, specials start W or E ... If South, they swap
// N and S".
const rotations = [
  [["charge", "E"], ["slam", "SW"], ["charge", "W"], ["slam", "NE"]],
  [["charge", "S"], ["slam", "NW"], ["charge", "N"], ["slam", "SE"]],
];
const sides = ["N", "E", "S", "W"]; // clockwise
const corners = ["NE", "SE", "SW", "NW"]; // clockwise
const step = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const dashFacings = { S: 0, W: 512, N: 1024, E: 1536 }; // the game's facings (2048ths: 0 south, 512 west)
const orbStyles = ["magic", "melee", "ranged"]; // OBS: cyan, red, yellow, in every special; the fourth at random
const orbAttackTypes = { magic: "magic", melee: "melee", ranged: "range" }; // the engine's names (engine/damage.js)

const specialKeys = { charge: "demonicBrutusCharge", slam: "demonicBrutusSlam" };
const defaultMechanics = Object.fromEntries(Object.values(specialKeys).map((key) => [key, true]));
const specialToggles = [
  { key: specialKeys.charge, label: "Charge", info: "From a side of you, then three ghosts round you: step two tiles diagonally." },
  { key: specialKeys.slam, label: "Slam", info: "From a corner of you, then three ghosts round you: step two tiles straight." },
].map((toggle) => ({ ...toggle, section: "Specials", setup: true }));

const key = ([x, y]) => x + "," + y;
const onTile = (spotAnimId, position) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height: 0, delayCycles: 0, onGround: true });
const onActor = (spotAnimId, actor, height = 0) => ({ spotAnimId, target: buildActorVisualTarget(actor), height, delayCycles: 0 });
const footprint = (corner) => {
  const tiles = [];
  for (let x = 0; x < bossSize; x++) for (let y = 0; y < bossSize; y++) tiles.push([corner[0] + x, corner[1] + y]);
  return tiles;
};

// Where a bull stands for a charge from `side` of the player at `p`, and the way it dashes: `charge.gap` tiles off him,
// with the player in the row (or column) on the bull's left as it faces him (OBS: from the west, the player in his north
// row; from the east, in his south row; north and south inferred, the same turned). So the four lanes don't cross on
// the player's tile: a tile clear of the first two bulls, then one clear of the last two, two tiles diagonally apart
// (WIKI: "once on the second dodge tile").
export function chargeStart(side, [px, py]) {
  const far = charge.gap + 1;
  if (side === "W") return { corner: [px - far - bossSize + 1, py - 2], direction: "E" };
  if (side === "E") return { corner: [px + far, py], direction: "W" };
  if (side === "S") return { corner: [px, py - far - bossSize + 1], direction: "N" };
  return { corner: [px - 2, py + far], direction: "S" };
}

// A charge's lane: every tile his 3x3 covers from where he stands to where he stops, 7 tiles on, or short of the first
// step `canStand` refuses.
export function chargeLane(corner, direction, canStand = () => true) {
  const [dx, dy] = step[direction];
  const path = [];
  for (let n = 1; n <= charge.tiles; n++) {
    const next = [corner[0] + dx * n, corner[1] + dy * n];
    if (!canStand(next, bossSize)) break;
    path.push(next);
  }
  const lane = new Set();
  for (const at of [corner, ...path]) for (const tile of footprint(at)) lane.add(key(tile));
  return { path, lane };
}

// Where a bull stands for a slam from `cornerName` of the player at `p`: his corner tile diagonal to the player's
// (inferred: OBS him at the player's corner, the dust on the tiles round the player).
export function slamCorner(cornerName, [px, py]) {
  const west = cornerName.endsWith("W");
  const south = cornerName.startsWith("S");
  return [west ? px - bossSize : px + 1, south ? py - bossSize : py + 1];
}

// Whether a tile has no obstacle within `clearance` tiles of it.
function isOpen([x, y]) {
  for (let dx = -clearance; dx <= clearance; dx++) {
    for (let dy = -clearance; dy <= clearance; dy++) if (!isArenaFootprintWalkable([x + dx, y + dy], 1)) return false;
  }
  return true;
}

// Where a player at `p` is pushed as a special starts: `p` itself if open, else the nearest open tile by a walk over
// walkable tiles (as far as `pushSearch`), else nowhere (null: he stays).
export function openSpaceFor(p) {
  if (isOpen(p)) return [...p];
  const seen = new Set([key(p)]);
  let frontier = [p];
  for (let distance = 1; distance <= pushSearch && frontier.length; distance++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const tile = [x + dx, y + dy];
        if (seen.has(key(tile)) || !isArenaFootprintWalkable(tile, 1)) continue;
        seen.add(key(tile));
        if (isOpen(tile)) return tile;
        next.push(tile);
      }
    }
    frontier = next;
  }
  return null;
}

// The four starts of a special from `first`, clockwise or not.
export function specialStarts(kind, first, clockwise) {
  const ring = kind === "charge" ? sides : corners;
  const at = ring.indexOf(first);
  return Array.from({ length: 4 }, (_, n) => ring[(at + (clockwise ? n : -n) + 8) % 4]);
}

const bossDefinition = defineNpc({
  id: "brutus",
  move: ({ actor, context, config }) => config.bullMove(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});
const ghostDefinition = defineNpc({
  id: "brutus-ghost",
  move: ({ actor, context, config }) => config.bullMove(actor, context),
  tick: () => ({ environmentalDamages: [] }),
});

class DemonicBrutusEncounter {
  kind = demonicBrutusKind;
  constructor() {
    this.definitions = new NpcDefinitionRegistry([bossDefinition, ghostDefinition].map((definition) => definition.register(this)));
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
    this.epoch = 0;
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.phase = 1; // 1 | 2 | "dead"
    this.nextAt = 1;
    this.standards = 0;
    this.standardsNeeded = null; // butts before the next special, drawn as the first of them is due
    this.specialsDone = 0;
    this.rotation = null; // { list, next }, chosen as the first special is due
    this.special = null;
    this.dashes = new Map(); // bull id -> { path, travelled, from }
    this.pushTo = null; // the tile the player is pushed to this tick
    this.walkOnlyUntil = 0; // a pushed player walks, not runs, before this tick
    this.ghosts = 0;
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  laterAfterMove(ticks, task) {
    this.postTasks.push({ tick: this.now + ticks, task });
  }
  // A task of this special only: dropped when the phase changes under it.
  scheduled(ticks, task, afterMove = false) {
    const epoch = this.epoch;
    (afterMove ? this.laterAfterMove : this.later).call(this, ticks, (ctx) => {
      if (this.epoch === epoch && this.phase !== "dead") task(ctx);
    });
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }
  animate(context, actorId, clipId, graphics = []) {
    emitInfernoVisual(context.tickEvents, {
      animations: clipId ? [{ actorId, clipId, delayCycles: 0 }] : [],
      projectiles: [],
      graphics,
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
    const hp = getMonsterHitpoints(npcTypeIds.demonic); // TABLE: 750
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.demonic, archetypeId: "brutus", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 512, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.demonic)),
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
  hurt(source, baseDamage, attackType = "typeless") {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage, attackType, playerPosition: [...player.position] });
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  // --- movement: he walks after the player; a bull dashes in a charge ------------
  bullMove(actor, context) {
    const dash = this.dashes.get(actor.id);
    if (dash) {
      if (dash.travelled >= dash.path.length) return [];
      const path = dash.path.slice(dash.travelled, dash.travelled + charge.tilesPerTick);
      dash.travelled += path.length;
      return [{ npcId: actor.id, path }];
    }
    if (actor.id !== bossActorId || this.special || this.phase === "dead") return [];
    return brutusPursuitMoves(actor, context);
  }

  // --- his turn -------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (context.tick === 1) {
      this.animate(context, bossActorId, "spawn");
      this.say(context, "Moo"); // OBS
    }
    if (this.special) {
      if (context.tick < this.special.endsAt) return none;
      this.special = null;
    }
    if (context.tick < this.nextAt || !player.alive) return none;
    this.standardsNeeded ??= this.specialsDone === 0 ? standardsBeforeFirstSpecial : this.random() < twoStandardsChance ? 2 : 3;
    if (this.standards >= this.standardsNeeded && this.startSpecial(boss, player, context)) return none;
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
      plan: { formulaStyle: "melee_crush", damageType: "melee", attackKind: "melee_crush", maxHit: meleeMaxHit, impactDelayTicks: 0, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Demonic Brutus");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "attack", kind: "brutus_attack", impactDelayTicks: 0 });
    return { ...attack, prayerReduction: { type: "reduce", value: 1 } }; // WIKI: through Protect from Melee
  }

  // --- his specials -----------------------------------------------------------------
  // The next start of the rotation whose special the setup has on, or null with both off.
  nextStart() {
    if (!this.rotation) {
      const list = rotations[Math.floor(this.random() * rotations.length)];
      this.rotation = { list, next: Math.floor(this.random() * list.length) };
    }
    for (let n = 0; n < 4; n++) {
      const [kind, from] = this.rotation.list[this.rotation.next];
      this.rotation.next = (this.rotation.next + 1) % 4;
      if (this.mechanics?.[specialKeys[kind]] !== false) return { kind, from };
    }
    return null;
  }
  startSpecial(boss, player, context) {
    const start = this.nextStart();
    if (!start) return false;
    this.specialsDone++;
    const afterStandards = this.standards;
    this.standards = 0;
    this.standardsNeeded = null;
    const lead = boss.vitals.hp > fastBelowHp ? leadTicks.slow : leadTicks.fast;
    const clockwise = boss.vitals.hp > counterclockwiseBelowHp;
    const fadedAt = context.tick;
    const lastBull = fadedAt + lead + 3;
    this.special = { name: start.kind, from: start.from, afterStandards, fadedAt, firstBullAt: fadedAt + lead, endsAt: lastBull + 1, clockwise, bulls: [], orbs: [] };
    this.nextAt = lastBull + nextButtAfterLastBull;
    boss.untargetable = true;
    this.animate(context, bossActorId, "fadeOut");
    // Too close to an obstacle: pushed into open space as he fades (moveDisplacedPlayer, this tick), and walking only
    // till the special ends. The special is placed round the tile he is pushed to.
    const open = openSpaceFor(player.position);
    if (open && !sameTile(open, player.position)) {
      this.pushTo = open;
      this.walkOnlyUntil = this.special.endsAt;
      this.special.pushedTo = [...open];
    }
    this.scheduled(1, (ctx) => this.place(ctx, start, clockwise));
    // Each bull appears as its animation needs to land on its tick: a slam's fade-in stomp lands 2 ticks after it starts
    // (CACHE: its impact sound at frame 11 or 12, of 5 cycles each), a charge's fade-in run 1 tick after. So they appear
    // one by one, a tick apart (OBS: the ghosts appearing in turn round the player).
    const appearsBefore = start.kind === "slam" ? 2 : 1;
    for (let n = 0; n < 4; n++) {
      this.scheduled(lead + n - appearsBefore, (ctx) => this.appear(ctx, n));
      if (start.kind === "charge") this.scheduled(lead + n, () => this.dash(n));
      this.scheduled(lead + n, (ctx) => this.bullLands(ctx, n));
    }
    if (start.kind === "charge") this.scheduled(lead + 2, (ctx) => this.animate(ctx, bossActorId, "chargeEndFadeIn"));
    // Phase 2's orbs over the player's head from a tick after he fades, each till the tick before it lands.
    for (let t = 2; t <= lead + 2; t++) this.scheduled(t, (ctx) => this.holdOrbs(ctx, fadedAt + t));
    this.scheduled(lead + 3 + 1, (ctx) => {
      const now = this.boss(ctx.world);
      if (!now) return;
      now.untargetable = false;
      delete now.lockedFacing;
    });
    return true;
  }
  orbHeight(n) {
    return 220 + n * 60; // inferred: stacked over the player's head, the first to land at the bottom
  }
  // A tick after he fades: where he and his three ghosts will stand, round the player where he stands now; in phase 2,
  // the orbs over him.
  place(context, start, clockwise) {
    const player = context.world.getPlayer();
    const at = [...player.position];
    const special = this.special;
    special.at = at;
    special.bulls = specialStarts(start.kind, start.from, clockwise).map((from, n) => {
      const id = n === 0 ? bossActorId : `brutus_ghost_${++this.ghosts}`;
      if (start.kind === "charge") {
        const { corner, direction } = chargeStart(from, at);
        // He stops short of an obstacle, as Brutus's charge does (his ghosts pass through: they go); his lane is what he
        // covers. Otherwise he could end behind one, out of the player's reach.
        if (n === 0) return { id, from, corner, direction, ...chargeLane(corner, direction, isArenaFootprintWalkable) };
        return { id, from, corner, direction, ...chargeLane(corner, direction) };
      }
      const corner = slamCorner(from, at);
      return { id, from, corner, tiles: demonicSlamTiles(corner, at) };
    });
    if (this.phase === 2) {
      // OBS: four orbs over the player; they land bottom first: magic, melee, ranged, then one at random.
      special.orbs = [...orbStyles, orbStyles[Math.floor(this.random() * orbStyles.length)]];
      this.animate(context, null, null, special.orbs.map((style, n) => onActor(orbSpotAnims.spawn[style], player, this.orbHeight(n))));
    }
  }
  // A bull appears where place() put it, with the animation that brings it to its hit: he moves there; a ghost is
  // spawned. A slamming bull faces the tile it is round (OBS: every ghost turned to the player); a charging one, the way
  // it dashes (his lane is off the player's middle). Each keeps that facing through its charge or slam; his is let go
  // when the special ends.
  appear(context, n) {
    const special = this.special;
    const bull = special?.bulls[n];
    if (!bull) return;
    const charging = special.name === "charge";
    const facePlayer = (actor) => {
      if (charging) actor.facing = dashFacings[bull.direction];
      else faceActorToward(actor, { position: special.at, size: 1 });
      actor.lockedFacing = actor.facing;
      return actor;
    };
    if (bull.id === bossActorId) {
      const boss = this.boss(context.world);
      boss.position = [...bull.corner];
      boss.previousPosition = [...bull.corner];
      facePlayer(boss);
      this.animate(context, bossActorId, charging ? "chargeFadeIn" : "stompFadeIn");
      return;
    }
    context.spawnNpc(facePlayer(ghostDefinition.createActor({
      id: bull.id, kind: "npc", role: "npc", npcTypeId: npcTypeIds.demonicGhost, archetypeId: "brutus-ghost", size: bossSize, alive: true,
      position: [...bull.corner], previousPosition: [...bull.corner], facing: 0, history: new Map(),
      untargetable: true, blocksNpcMovement: false, passThruNpcs: true,
      vitals: { hp: 1, maxHp: 1 },
      combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
        animations: { idle: null, walk: null, run: null, attack: null, death: null } },
    }, {})));
    this.animate(context, bull.id, charging ? "ghostChargeFadeIn" : "ghostStompFadeIn");
  }
  // A charge's dash, on its bull's tick (its lane hits as it sets off, as Brutus's charge does). Its run is in the
  // fade-in animation it appeared with.
  dash(n) {
    const bull = this.special?.bulls[n];
    if (bull) this.dashes.set(bull.id, { path: bull.path, travelled: 0 });
  }
  // The orbs still to land, on tick `tick`: each held over the player's head (a static orb that loops a tick, drawn
  // again each tick) till the tick before it lands, then dropping onto him (CACHE: MILK_ORB_STATIC, MILK_ORB_DROP).
  holdOrbs(context, tick) {
    const special = this.special;
    if (!special?.orbs.length) return;
    const player = context.world.getPlayer();
    const graphics = [];
    special.orbs.forEach((style, n) => {
      const lands = special.firstBullAt + n;
      if (tick < lands - 1) graphics.push(onActor(orbSpotAnims.held[style], player, this.orbHeight(n)));
      else if (tick === lands - 1) graphics.push(onActor(orbSpotAnims.drop[style], player, this.orbHeight(n)));
    });
    if (graphics.length) this.animate(context, null, null, graphics);
  }
  // As the bull's tick starts, before the player moves (as Brutus's stomp and charge, OBS): what it finds him on, and
  // (phase 2) its orb.
  bullLands(context, n) {
    const special = this.special;
    const bull = special?.bulls[n];
    if (!bull) return;
    const player = context.world.getPlayer();
    const at = key(player.position);
    if (special.name === "slam") {
      const actor = context.world.getNpc(bull.id);
      this.animate(context, null, null, [...bull.tiles.outside.map((tile) => onTile(spotAnims.stompTile, tile)), ...(actor ? [onActor(spotAnims.stompBoss, actor)] : [])]);
      if (bull.tiles.all.some((tile) => key(tile) === at)) this.hurt("Demonic Brutus's slam", this.randomInt(bullDamage));
    } else if (bull.lane.has(at)) {
      this.hurt("Demonic Brutus's charge", this.randomInt(bullDamage));
    }
    const style = special.orbs[n];
    if (style) {
      this.animate(context, null, null, [onActor(orbSpotAnims.impact[style], player)]);
      this.hurt("Demonic Brutus's orb", this.randomInt(orbDamage), orbAttackTypes[style]);
    }
    if (bull.id !== bossActorId) {
      this.scheduled(ghostStayTicks, (ctx) => this.dropGhost(ctx, bull.id));
    } else if (special.name === "charge") {
      this.scheduled(2, () => this.dashes.delete(bossActorId));
    }
  }
  dropGhost(context, id) {
    this.dashes.delete(id);
    if (context.world.getNpc(id)) context.despawnNpc(id);
  }
  // The player's step, which the engine lets an encounter take over: the push as a special starts, and a pushed player
  // held to a walk (one tile a tick) till it ends.
  moveDisplacedPlayer(player, targetTile, place, playerStep) {
    if (this.pushTo) {
      const to = this.pushTo;
      this.pushTo = null;
      place(to, player.facing);
      return true;
    }
    if (this.now < this.walkOnlyUntil && playerStep?.stepTiles?.length > 1) {
      place(playerStep.stepTiles[0], player.facing);
      return true;
    }
    return undefined;
  }

  // A special cut short (his phase changes, or he dies): its ghosts go, its tasks are dropped.
  clearSpecial(context) {
    this.epoch++;
    for (const bull of this.special?.bulls ?? []) if (bull.id !== bossActorId && context.world.getNpc(bull.id)) context.despawnNpc(bull.id);
    this.dashes.clear();
    this.pushTo = null;
    this.walkOnlyUntil = 0;
    this.special = null;
    const boss = this.boss(context.world);
    if (boss) {
      boss.untargetable = false;
      delete boss.lockedFacing;
    }
  }

  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    const boss = this.boss(context.world);
    this.clearSpecial(context);
    if (this.phase === 1 && boss) {
      // WIKI, OBS: "moo moo!", and he heals 487: phase 2.
      reviveNpc(boss);
      boss.vitals = { ...boss.vitals, hp: healAtPhaseTwo };
      this.phase = 2;
      this.standards = 0;
      this.standardsNeeded = null;
      this.nextAt = defeat.tick + phaseTwoFirstButt;
      this.say(context, "moo moo!");
      context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount: healAtPhaseTwo, hitsplatType: "heal" });
      return;
    }
    this.phase = "dead";
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.say(context, "m-moo..."); // as Brutus (inferred)
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  getSnapshot() {
    const special = this.special;
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        standardsSinceSpecial: this.standards,
        specialsDone: this.specialsDone,
        nextAttackAt: this.nextAt,
        special: special && {
          name: special.name,
          from: special.from,
          afterStandards: special.afterStandards,
          fadedAt: special.fadedAt,
          firstBullAt: special.firstBullAt,
          endsAt: special.endsAt,
          clockwise: special.clockwise,
          at: special.at ? [...special.at] : null,
          pushedTo: special.pushedTo ?? null,
          bulls: special.bulls.map((bull) => ({ id: bull.id, from: bull.from, corner: [...bull.corner] })),
          orbs: [...special.orbs],
        },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "Demonic Brutus";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const demonicBrutusFactory = () => new DemonicBrutusEncounter();
export const demonicBrutusControls = { defaultMechanicsConfig: { ...defaultMechanics }, mechanicsToggles: specialToggles, debugActions: [] };
