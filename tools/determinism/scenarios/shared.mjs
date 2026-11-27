// Scenarios for the rules the engine and the encounters share (client/assets/rendering.js): the arena, the NPC death
// lifecycle, attack range and line of sight, occupancy and decisions, the combat formulas, NPC attack rolls, NPC
// movement, NPC definitions and route search. No fight is run: each scenario calls the exported functions on hand-made
// inputs and returns what they answered, so that the branches no fight reaches (unknown styles, guard returns, thrown
// errors, the fallback of the route search) are digested too.
//
// Every export is written `rendering.<name>` in full, so that a rename can be applied to this file by search.

const pure = (run) => (engine, objTypeLoader, registry, controlsOf, rendering) => run(rendering);

/** What `run` returns, or the error it threw. The class of the error is left out: classes are renamed. */
const caught = (run) => {
  try {
    return run();
  } catch (error) {
    return { threw: error.name, message: error.message };
  }
};

/** A record as it is now: the functions under test change the records they are given. */
const copy = (value) => structuredClone(value);

const npc = (id, position, size = 1, extra = {}) => ({ id, kind: "npc", alive: true, position, size, combat: { attackRange: 1, targetId: "player" }, vitals: { hp: 50, maxHp: 100 }, ...extra });

/** One string per row, north first: cell(x, y) for every tile of the square from (min, min) to (max, max). */
const grid = (min, max, cell) => {
  const rows = [];
  for (let y = max; y >= min; y--) {
    let row = "";
    for (let x = min; x <= max; x++) row += cell(x, y);
    rows.push(row);
  }
  return rows;
};
const mark = (value) => (value ? "#" : ".");

/** The first step of the moves an NPC at `from` was given, as the key of a numeric keypad (8 is north); "." for none. */
const stepKey = (from, moves) => (moves.length === 0 ? "." : "123456789"[(moves[0].path[0][1] - from[1] + 1) * 3 + moves[0].path[0][0] - from[0] + 1]);

const tilesText = (tiles) => tiles.map((tile) => tile.join()).join(" ");
const routeText = (route) => (route.steps ? { ...route, steps: tilesText(route.steps) } : route);
const movesText = (moves) => (Array.isArray(moves) ? moves.map((move) => ({ ...move, path: tilesText(move.path) })) : moves);

function collisionMap(rendering, width, height, flagged) {
  const map = rendering.createCollisionMap(width, height);
  for (const [x, y, flags] of flagged) map.flag(x, y, flags);
  return map;
}

/**
 * Runs `run` in a hand-made arena. The arena is one global, shared with every other scenario and with the engine, so
 * what was there is put back afterwards.
 */
function withArena(rendering, config, defaultWalkable, run) {
  const saved = { bounds: rendering.getArenaBounds(), walkableTiles: rendering.getArenaWalkableTiles(), collisionMap: rendering.getArenaCollisionMap() };
  const savedDefault = rendering.getArenaDefaultWalkable();
  try {
    rendering.setArenaConfig({ bounds: null, walkableTiles: null, collisionMap: null, ...config }, defaultWalkable);
    return run();
  } finally {
    rendering.setArenaConfig(saved, savedDefault);
  }
}

// ---------------------------------------------------------------------------

function arena(rendering) {
  const map = collisionMap(rendering, 4, 3, [
    [1, 1, rendering.CollisionFlag.OBJECT | rendering.CollisionFlag.WALL_EAST],
    [3, 2, rendering.CollisionFlag.FLOOR],
    [4, 0, rendering.CollisionFlag.OBJECT], // off the map, like the next one: nothing is written
    [0, -1, rendering.CollisionFlag.OBJECT],
  ]);
  map.unflag(1, 1, rendering.CollisionFlag.OBJECT);
  map.unflag(0, 3, rendering.CollisionFlag.OBJECT);
  const mapTiles = [[1, 1], [3, 2], [0, 0], [-1, 0], [4, 0], [0, -1], [0, 3]];
  const collision = {
    size: [map.sizeX, map.sizeY],
    flags: [...map.flags],
    getFlag: mapTiles.map(([x, y]) => map.getFlag(x, y)),
    hasFlag: mapTiles.map(([x, y]) => [map.hasFlag(x, y, rendering.CollisionFlag.WALL_EAST), map.hasFlag(x, y, rendering.CollisionFlag.FLOOR_BLOCKED)]),
    monsterObstacle: rendering.monsterObstacleCollisionFlags,
  };
  // Tile names the packed lookup cannot hold (no comma, not canonical, out of its range, not whole) are asked of the set itself.
  const tiles = new Set(["1,1", "2,1", "-3,-4", "bogus", "01,2", "3,x", "60000,1", "1.5,2"]);
  const bounds = { minX: 1, minY: 2, maxX: 6, maxY: 8 };
  const read = () => ({
    bounds: rendering.getArenaBounds(),
    walkableTiles: rendering.getArenaWalkableTiles(),
    collisionMap: rendering.getArenaCollisionMap(),
    config: rendering.getCurrentArenaConfig(),
    defaultWalkable: rendering.getArenaDefaultWalkable(),
    walkable: mark(rendering.isArenaTileWalkable(60000, 1)) + mark(rendering.isArenaTileWalkable(1.5, 2)) + mark(rendering.isArenaTileWalkable(70000, 0)),
    walkableNear: grid(-4, 3, (x, y) => mark(rendering.isArenaTileWalkable(x, y))),
    inside: grid(0, 9, (x, y) => mark(rendering.isInsideArenaBounds(x, y))),
  });
  return withArena(rendering, {}, undefined, () => {
    const empty = read(); // nothing set and no default given: no tile is walkable
    rendering.setArenaConfig({ bounds: null, walkableTiles: null, collisionMap: null }, true);
    const open = read();
    rendering.setArenaConfig({ bounds, walkableTiles: tiles, collisionMap: map }, true);
    const full = read();
    tiles.add("0,0"); // the lookup is built again when the set has grown
    const grown = rendering.isArenaTileWalkable(0, 0);
    rendering.setArenaConfig({ bounds, walkableTiles: new Set(["0,0", "1,1"]), collisionMap: null }, false);
    const packed = read();
    return { collision, empty, open, full, grown, packed };
  });
}

// ---------------------------------------------------------------------------

function npcLifecycle(rendering) {
  const ticks = [4, 5, 9, 10, 14, 15];
  const over = (from, until, test) => Array.from({ length: until - from + 1 }, (_, index) => mark(test(from + index))).join("");
  const debuffs = [undefined, { boundUntilTick: 10 }, { boundFromTick: 5, boundUntilTick: 10 }, { boundFromTick: 5 }];
  const shields = [{}, { untargetable: true }, { targetableFromTick: 5 }, { attackBlockedUntilTick: 10 }, { targetableFromTick: 10, attackBlockedUntilTick: 5 }, { untargetable: false, targetableFromTick: 15 }];

  const drained = [
    npc("no-floor", [0, 0]),
    npc("floor", [0, 0], 1, { defenceDrainFloor: 80, formulaStats: { levels: { defence: 100 } }, debuffs: { attackDrain: 2 } }),
    npc("floor-without-stats", [0, 0], 1, { defenceDrainFloor: 80 }),
    npc("floor-above-level", [0, 0], 1, { defenceDrainFloor: 120, formulaStats: { levels: { defence: 100 } } }),
  ];
  const drains = [30, 5].map((amount) => drained.map((actor) => (rendering.setNpcDefenceDrain(actor, amount), copy(actor.debuffs))));

  const burning = npc("burning", [0, 0], 1, { burnStacks: [3, 2], burnNextPulseTick: 7, poison: { damage: 4 } });
  rendering.clearNpcBurn(burning);
  const doused = copy(burning);
  rendering.clearNpcPoison(burning);

  // The death of an NPC, act by act: what each call returned, the record after it, and what the questions about it answer.
  const status = (actor, tick) => ({
    alive: [rendering.isActorAlive(actor), rendering.isActorAliveOrDeathPending(actor), rendering.isNpcAlive(actor), rendering.canNpcBeHealed(actor)],
    life: rendering.getActorLifeGeneration(actor),
    despawnTick: rendering.getNpcDespawnTick(actor),
    canAct: over(tick - 1, tick + 4, (at) => rendering.canNpcActAtTick(actor, at)),
    deathDue: over(tick - 1, tick + 4, (at) => rendering.isNpcDeathDueAtTick(actor, at)),
    animationDue: over(tick - 1, tick + 4, (at) => rendering.isNpcDeathAnimationDueAtTick(actor, at)),
    animationStarts: over(tick - 1, tick + 4, (at) => rendering.isNpcDeathAnimationTick(actor, at)),
  });
  const tale = (actor, tick, acts) =>
    acts.map(([label, act]) => {
      const returned = copy(caught(act));
      const { id, kind, position, size, vitals, ...changing } = actor;
      return { label, returned, actor: copy(changing), ...status(actor, tick) };
    });
  const mortal = (id, extra) =>
    npc(id, [3, 3], 1, {
      burnStacks: [1], burnNextPulseTick: 12, poison: { damage: 2 }, deathAnimationTick: 99,
      combat: { attackRange: 1, targetId: "player", retaliation: { pending: [{ tick: 9 }], lastIncomingAttackTick: 9 } }, ...extra,
    });
  const immediate = mortal("immediate");
  const queued = mortal("queued", { deathPolicy: "queued" });
  const scripted = mortal("scripted", { deathPolicy: "queued", lastStepTick: 19 });
  const interrupted = mortal("interrupted");
  const deaths = {
    immediate: tale(immediate, 10, [
      ["step", () => rendering.recordNpcStepTick(immediate, 9)],
      ["kill", () => rendering.recordNpcDeath(immediate, 10, "hit-queue")],
      ["kill again", () => rendering.recordNpcDeath(immediate, 11, "hit-queue")],
      ["hurry", () => rendering.expediteQueuedNpcDeath(immediate, 10)],
      ["start", () => rendering.markNpcDeathStarted(immediate)],
      ["start again", () => rendering.markNpcDeathStarted(immediate)],
      ["revive", () => rendering.reviveNpc(immediate)],
      ["revive unharmed", () => rendering.reviveNpc(immediate)],
    ]),
    queued: tale(queued, 10, [
      ["step", () => rendering.recordNpcStepTick(queued, 9)],
      ["kill", () => rendering.recordNpcDeath(queued, 10, "hit-queue")],
      ["hurry at another tick", () => rendering.expediteQueuedNpcDeath(queued, 11)],
      ["hurry", () => rendering.expediteQueuedNpcDeath(queued, 10)],
      ["hurry again", () => rendering.expediteQueuedNpcDeath(queued, 10)],
      ["step while dying", () => rendering.recordNpcStepTick(queued, 10)],
      ["start", () => rendering.markNpcDeathStarted(queued)],
      ["despawn at the kill", () => void (queued.despawnTick = 10)],
      ["revive", () => rendering.reviveNpc(queued)],
      ["kill by poison", () => rendering.recordNpcDeath(queued, 12, "poison")],
      ["hurry", () => rendering.expediteQueuedNpcDeath(queued, 12)],
      ["despawn later", () => void (queued.despawnTick = 14)],
      ["start", () => rendering.markNpcDeathStarted(queued)],
      ["revive", () => rendering.reviveNpc(queued)],
    ]),
    scripted: tale(scripted, 20, [
      ["script", () => rendering.startScriptedNpcDeath(scripted, 20)],
      ["script again", () => rendering.startScriptedNpcDeath(scripted, 22)],
      ["revive", () => rendering.reviveNpc(scripted)],
    ]),
    interrupted: tale(interrupted, 30, [
      ["kill", () => rendering.recordNpcDeath(interrupted, 30, "hit-queue")],
      ["script", () => rendering.startScriptedNpcDeath(interrupted, 31)],
    ]),
    // A queued death without an animation tick, which the calls above never leave behind.
    despawnWithoutAnimationTick: rendering.getNpcDespawnTick(npc("odd", [0, 0], 1, { deathPolicy: "queued", despawnTick: 7, death: { status: "started", killTick: 7, processTick: 7, causeStage: "scripted" } })),
  };

  const regen = npc("regen", [0, 0], 1, { vitals: { hp: 98, maxHp: 100 } });
  const regenAt = (tick) => (rendering.applyNpcHitpointRegen(regen, tick), [tick, regen.vitals.hp, regen.hitpointRegenNextTick]);
  const regeneration = [regenAt(500)]; // not scheduled yet
  rendering.scheduleNpcHitpointRegen(regen, 5);
  regeneration.push(...[105, 106, 107, 206, 306].map(regenAt));
  regen.vitals.hp = 0;
  regeneration.push(regenAt(406));
  regen.alive = false;
  regeneration.push(regenAt(506));

  const events = [];
  const sink = { emit: (event) => events.push(event) };
  const hurt = npc("hurt", [0, 0], 1, { vitals: { hp: 90, maxHp: 100 } });
  const vitalsBefore = hurt.vitals;
  const heals = [
    rendering.healNpc(null, 5, sink),
    rendering.healNpc(hurt, 0, sink),
    rendering.healNpc(hurt, 4, sink),
    rendering.healNpc(hurt, 40, sink),
    rendering.healNpc(hurt, 1, sink), // full
    rendering.healNpc(npc("dead", [0, 0], 1, { alive: false }), 5, sink),
    rendering.healNpc(npc("dying", [0, 0], 1, { death: { status: "pending" } }), 5, sink),
  ];

  const waiting = npc("waiting", [0, 0]);
  rendering.scheduleNextActionTick(waiting, 7, 4);

  const self = npc("self", [4, 4], 3);
  const world = { actors: new Map([[self.id, self]]) };
  const facings = [[5, 9, 1], [9, 9, 1], [9, 5, 1], [9, 0, 1], [5, 0, 1], [0, 0, 1], [0, 5, 1], [0, 9, 1], [6, 9, 2], [7, 2, 1], [5, 5, 1], [4, 4, 3]].map(([x, y, size]) => {
    const turned = npc("turned", [4, 4], 3, { facing: -1 });
    rendering.faceActorToward(turned, { position: [x, y], size });
    return turned.facing;
  });

  return {
    bound: debuffs.map((given) => ticks.map((tick) => mark(rendering.isNpcBoundAtTick({ debuffs: given }, tick)) + mark(rendering.isNpcBindImmuneAtTick({ debuffs: given }, tick))).join(" ")),
    targetable: shields.map((shield) => ticks.map((tick) => mark(rendering.isNpcTargetableAtTick(shield, tick)) + mark(rendering.isNpcAttackableAtTick(shield, tick))).join(" ")),
    drains,
    doused,
    cured: burning,
    deaths,
    regeneration,
    heals: { heals, events, vitals: hurt.vitals, vitalsReplaced: hurt.vitals !== vitalsBefore },
    nextActionTick: waiting.nextActionTick,
    facings,
    misc: {
      inferno: [rendering.isInfernoSnapshot({ kind: "inferno" }), rendering.isInfernoSnapshot({ kind: "yama_p3" })],
      inWorld: [rendering.isActorInWorld(world, self), rendering.isActorInWorld(world, { ...self }), rendering.isActorInWorld(world, npc("absent", [0, 0]))],
      playerLife: rendering.getActorLifeGeneration({ kind: "player", lifeGeneration: 4 }),
      activeOutcome: rendering.activeOutcome,
      players: [{ kind: "player", alive: true, death: {} }, { kind: "player", alive: false }].map((player) => [rendering.isActorAlive(player), rendering.isActorAliveOrDeathPending(player)]),
    },
  };
}

// ---------------------------------------------------------------------------

function rangeAndSight(rendering) {
  // A 2x2 footprint at (3,3) with a wall on every side of it, each wall a flag of another tile; projectile blockers around it.
  const map = collisionMap(rendering, 8, 8, [
    [2, 3, rendering.CollisionFlag.WALL_EAST], [3, 4, rendering.CollisionFlag.WALL_WEST],
    [4, 3, rendering.CollisionFlag.WALL_EAST | rendering.CollisionFlag.WALL_SOUTH], [5, 4, rendering.CollisionFlag.WALL_WEST],
    [3, 5, rendering.CollisionFlag.WALL_SOUTH], [4, 4, rendering.CollisionFlag.WALL_NORTH], [3, 2, rendering.CollisionFlag.WALL_NORTH],
    [6, 5, rendering.CollisionFlag.OBJECT_PROJECTILE_BLOCKER], [1, 6, rendering.CollisionFlag.WALL_SOUTH_PROJECTILE_BLOCKER],
    [6, 1, rendering.CollisionFlag.WALL_WEST_PROJECTILE_BLOCKER], [0, 4, rendering.CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER],
    [1, 1, rendering.CollisionFlag.WALL_NORTH_PROJECTILE_BLOCKER | rendering.CollisionFlag.WALL_EAST_PROJECTILE_BLOCKER],
  ]);
  const all = (test) => grid(-1, 8, (x, y) => mark(test(x, y)));
  const boss = npc("boss", [3, 3], 2);
  const lancer = npc("lancer", [3, 3], 2, { combat: { attackRange: 1, targetId: "player", meleeReach: "diagonal" } });
  const target = { southWest: [3, 3], width: 2, height: 2 };
  const tall = { southWest: [3, 3], width: 2, height: 3 };
  const footprints = () => [
    [{ southWest: [1, 3], width: 2, height: 2 }, target, { attackRange: 1 }], // walls are not asked about
    [{ southWest: [1, 3], width: 2, height: 2 }, target, { attackRange: 1, checkCollision: true }], // a wall on both rows
    [{ southWest: [1, 3], width: 2, height: 3 }, tall, { attackRange: 1, checkCollision: true }], // the third row is open
    [{ southWest: [3, 5], width: 2, height: 2 }, target, { attackRange: 1, checkCollision: true }], // a wall on both columns
    [{ southWest: [3, 5], width: 3, height: 1 }, { southWest: [3, 3], width: 3, height: 2 }, { attackRange: 1, checkCollision: true }], // the third column is open
    [{ southWest: [5, 3], width: 1, height: 2 }, target, { attackRange: 1, checkCollision: true }],
    [{ southWest: [3, 1], width: 2, height: 2 }, target, { attackRange: 1, checkCollision: true }],
    [{ southWest: [1, 3], width: 2.9, height: 0 }, target, { attackRange: 1, checkCollision: true }], // sizes are cut to whole tiles, at least one
    [{ southWest: [2, 2], width: 1, height: 1 }, target, { attackRange: 1, checkCollision: true }],
    [{ southWest: [2, 2], width: 1, height: 1 }, target, { attackRange: 1, checkCollision: true, meleeReach: "diagonal" }],
    [{ southWest: [0, 0], width: 2, height: 2 }, target, { attackRange: 1, meleeReach: "diagonal" }],
    [{ southWest: [0, 0], width: 2, height: 2 }, target, { attackRange: 2, checkCollision: true }],
    [{ southWest: [6, 6], width: 2, height: 2 }, target, { attackRange: 3, checkCollision: true }],
    [{ southWest: [4, 4], width: 2, height: 2 }, target, { attackRange: 1, checkCollision: true }], // overlapping
  ].map(([from, to, options]) => rendering.isFootprintInAttackRange(from, to, options));
  const measured = () => ({
    sight: [[3, 3], [0, 0], [7, 6]].map(([fromX, fromY]) => all((x, y) => rendering.hasLineOfSight(fromX, fromY, x, y))),
    melee: all((x, y) => rendering.isInAttackRangeWithCollision(x, y, 3, 3, 2, 1)),
    meleeOfOpenTile: all((x, y) => rendering.isInAttackRangeWithCollision(x, y, 6, 2, 1, 1)),
    meleeByPosition: all((x, y) => rendering.isTileInAttackRange([x, y], [3, 3], 2, 1, true)),
    meleeDiagonal: all((x, y) => rendering.isInAttackRangeWithCollision(x, y, 3, 3, 2, 1, "diagonal")),
    halberd: all((x, y) => rendering.isInAttackRangeWithCollision(x, y, 3, 3, 2, 2)),
    ranged: all((x, y) => rendering.isInAttackRangeWithCollision(x, y, 3, 3, 0, 5)),
    footprints: footprints(),
    npcMelee: all((x, y) => rendering.isNpcInAttackRange(boss, { position: [x, y], size: 1 }, 1)),
    npcDiagonal: all((x, y) => rendering.isNpcInAttackRange(lancer, { position: [x, y], size: 1 }, 1)),
    npcRanged: all((x, y) => rendering.isNpcInAttackRange(boss, { position: [x, y], size: 2 }, 4)),
    npcNoRange: [0, -1].map((range) => rendering.isNpcInAttackRange(boss, { position: [2, 3], size: 1 }, range)),
    // Half a tile apart: the wall check is asked about two tiles that are not neighbours.
    betweenTiles: [rendering.isInAttackRangeWithCollision(0, 0, 0.5, 0, 1, 1), rendering.isInAttackRangeWithCollision(0, 0.5, 0, 0, 1, 1)],
  });
  return {
    walled: withArena(rendering, { collisionMap: map }, true, measured),
    noMap: withArena(rendering, {}, true, measured),
    // What follows does not look at the arena.
    distance: grid(-1, 8, (x, y) => rendering.getDistanceToFootprint(x, y, 3, 3, 2)),
    distanceToTile: grid(0, 4, (x, y) => rendering.getDistanceToFootprint(x, y, 2, 2, 1)),
    reach: {
      cardinal: all((x, y) => rendering.isTileInAttackRange([x, y], [3, 3], 2, 1)),
      diagonal: all((x, y) => rendering.isTileInAttackRange([x, y], [3, 3], 2, 1, false, "diagonal")),
      long: all((x, y) => rendering.isTileInAttackRange([x, y], [3, 3], 1, 3)),
    },
    within: [
      all((x, y) => rendering.isTileInsideFootprint([x, y], [3, 3], 2)),
      all((x, y) => rendering.isPointInsideFootprint(x, y, 2, 4, 3)),
      all((x, y) => rendering.isTileInFootprint([1, 2], 4, [x, y])),
      all((x, y) => rendering.isTileUnderFootprint([5, 0], 1, [x, y])),
    ],
    fromCentre: [[boss, [0, 0]], [boss, [4, 4]], [boss, [7, 3]], [npc("wide", [2, 2], 5), [0, 9]], [npc("small", [2, 2]), [2, 0]]].map(([actor, position]) => rendering.getDistanceFromNpcCentre(actor, { position })),
  };
}

// ---------------------------------------------------------------------------

function occupancyAndDecisions(rendering) {
  const occupancy = new rendering.OccupancyMap();
  const picture = () => grid(0, 8, (x, y) => mark(occupancy.isBlocked(x, y)));
  const big = npc("big", [2, 2], 2);
  const small = npc("small", [5, 5]);
  const ghost = npc("ghost", [0, 0], 1, { blocksNpcMovement: false });
  const pictures = {};
  occupancy.add(big);
  occupancy.add(small);
  occupancy.add(ghost); // takes no room
  pictures.added = picture();
  occupancy.step(big, big.position, [3, 2]);
  big.position = [3, 2];
  occupancy.step(ghost, ghost.position, [1, 0]);
  occupancy.step(small, [6, 6], [7, 7]); // not from where it was entered: both places are cleared
  small.position = [7, 7];
  pictures.stepped = picture();
  big.position = [4, 5];
  const visitor = npc("visitor", [0, 7]);
  const sameObject = occupancy.syncActors([big, ghost, visitor]) === occupancy; // big has moved, small has gone
  pictures.synced = picture();
  visitor.blocksNpcMovement = false;
  big.size = 3;
  occupancy.syncActors([big, visitor]);
  pictures.resized = picture();
  occupancy.remove(big);
  occupancy.remove(big);
  pictures.removed = picture();
  occupancy.enter(small, [1, 1]);
  occupancy.mark({ x: 6, y: 0, size: 2 }, true);
  pictures.marked = picture();
  occupancy.clear();
  pictures.cleared = picture();

  occupancy.add(npc("pillar", [4, 4]));
  occupancy.add(npc("block", [1, 5], 2));
  const canStep = rendering.createOccupancyStepCheck(occupancy);
  const directions = [[-1, 1], [0, 1], [1, 1], [-1, 0], [0, 0], [1, 0], [-1, -1], [0, -1], [1, -1]];
  const steps = [1, 2].map((size) => grid(0, 7, (x, y) => directions.reduce((mask, [dx, dy], bit) => mask | (canStep([x, y], [x + dx, y + dy], size) << bit), 0).toString(16).padStart(3, "0") + " "));

  const overlaps = grid(0, 7, (x, y) => mark(rendering.areFootprintsOverlapping({ position: [x, y], size: 2 }, { position: [3, 3], size: 3 })));

  const random = rendering.createSeededRandom(7);
  const decisions = rendering.createRandomDecisions(random);
  const given = { next: () => 0.25 };
  const loaded = [{ value: "rare", weight: 1 }, { value: "common", weight: 8 }, { value: "never", weight: 0 }, { value: "uncommon", weight: 3 }];
  return {
    pictures,
    sameObject,
    steps,
    tooFar: [canStep([0, 0], [2, 0], 1), canStep([0, 0], [0, -2], 1), canStep([0, 0], [2, 2], 2)],
    overlaps,
    seeded: [0, 1, 7, -1, 2 ** 32 + 7, 1.9].map((seed) => {
      const next = rendering.createSeededRandom(seed);
      return [next(), next(), next()];
    }),
    hashes: [0, 1, 2, -1, 123456789, 2 ** 32 + 1, 3.7].map((value) => rendering.hashInteger(value)),
    decisions: {
      keepsItsSource: decisions.next === random,
      draws: [
        decisions.next(), decisions.chance({ site: "test" }, 0.5), decisions.chance({ site: "test" }, 0), decisions.chance({ site: "test" }, 1),
        decisions.int({ site: "test" }, 3, 9), decisions.int({ site: "test" }, -2, 2), decisions.int({ site: "test" }, 5, 5),
        decisions.choose({ site: "test" }, rendering.weightEqually(["a", "b", "c"])), decisions.choose({ site: "test" }, loaded), decisions.choose({ site: "test" }, loaded),
      ],
      chosen: [0, 0.08, 0.09, 0.74, 0.76, 0.999].map((draw) => rendering.createRandomDecisions(() => draw).choose({ site: "test" }, loaded)),
      bounds: [rendering.createRandomDecisions(() => 0).int({}, 3, 9), rendering.createRandomDecisions(() => 0.999).int({}, 3, 9), rendering.createRandomDecisions(() => 0.5).chance({}, 0.5)],
      refused: [
        caught(() => rendering.createRandomDecisions(() => 0.5).choose({ site: "test" }, [])),
        caught(() => rendering.createRandomDecisions(() => 1).choose({ site: "test" }, rendering.weightEqually(["a", "b"]))),
        caught(() => rendering.createRandomDecisions(() => 0.5).choose({ site: "test" }, [{ value: "a", weight: Number.NaN }])),
      ],
      equalWeights: rendering.weightEqually(["a", ["b"], 3]),
      ofContext: [rendering.getContextDecisions({ decisions: given, random }) === given, rendering.getContextDecisions({ random: () => 0.75 }).int({}, 0, 3)],
    },
  };
}

// ---------------------------------------------------------------------------

const styles = ["melee_stab", "melee_slash", "melee_crush", "ranged", "magic", "bogus"];
const monsterStats = (extra = {}) => ({
  levels: { attack: 120, strength: 140, defence: 90, ranged: 110, magic: 130 },
  offensive: { atk: 40, str: 55, ranged: 30, rangedStr: 25, magic: 60, magicStr: 35 },
  defensive: { stab: 20, slash: 40, crush: 60, magic: 80, rangedLight: 100, rangedStandard: 120, rangedHeavy: 140 },
  ...extra,
});
const gear = {
  attackStab: 70, attackSlash: 90, attackCrush: 50, attackMagic: 30, attackRanged: 110, defenceStab: 200, defenceSlash: 210, defenceCrush: 220, defenceMagic: 60, defenceRanged: 230,
  meleeStrength: 100, rangedStrength: 80, magicDamage: 15, prayer: 10, attackSpeed: 4, attackRange: 1,
};

function formulas(rendering) {
  const stances = ["Accurate", "Aggressive", "Controlled", "Defensive", "Longrange", "Other"];
  const voidSets = ["melee", "ranged", "elite_ranged", "magic", "elite_magic"];
  const variants = [...stances.map((stance) => ({ stance })), ...voidSets.map((voidSet) => ({ voidSet }))];
  const player = (extra) => ({ kind: "player", levels: { attack: 99, strength: 98, defence: 97, ranged: 96, magic: 95 }, stance: "Accurate", ...extra });
  const monster = (extra) => ({ kind: "npc", ...monsterStats(extra) });
  const boosted = { attack: 1.2, strength: 1.23, defence: 1.25, ranged: 1.18, rangedStrength: 1.21, magic: 1.15, magicDamage: 1.04 };
  const prayerPairs = [["ProtectMelee", "Piety"], [null, "Rigour"], ["Augury", "Piety"], ["MysticMight", "EagleEye"], ["Deadeye", "Zeal"], [undefined, undefined], ["Nope", null]];
  return {
    neutral: rendering.neutralPrayerMultipliers,
    prayers: prayerPairs.map(([first, second]) => rendering.getPrayerMultipliers(first, second)),
    noPrayerIsNeutral: rendering.getPrayerMultipliers(null, null) === rendering.neutralPrayerMultipliers,
    hitChance: [[100, 50], [50, 100], [50, 50], [0, 0], [1, 0], [0, 7]].map(([attack, defence]) => [rendering.getSingleRollHitChance(attack, defence), rendering.getDoubleRollHitChance(attack, defence)]),
    blended: [[1, 5], [0.5, 3], [0.25, 0], [0, 4]].map(([first, second]) => rendering.getSteadyStateHitChance(first, second)),
    // The player's attack roll for each style: by stance, then by void set.
    playerAttack: styles.map((style) => variants.map((variant) => rendering.getPlayerAccuracyRolls(player(variant), monster(), style, gear, boosted).attackRoll)),
    // The monster's defence roll against each style, by the weight of the ranged weapon; then with a raid level.
    monsterDefence: styles.map((style) => ["light", "standard", "heavy", "bogus"].map((weight) => [undefined, 300].map((toaRaidLevel) => rendering.getPlayerAccuracyRolls(player(), monster({ toaRaidLevel }), "melee_slash", gear, boosted, style, weight).defenceRoll))),
    playerHits: [
      rendering.getPlayerAccuracyRolls(player(), monster(), "melee_slash", gear),
      rendering.getPlayerAccuracyRolls(player({ stance: "Longrange" }), monster(), "ranged", gear, boosted, "ranged", "heavy"),
      rendering.getPlayerAccuracyRolls(player(), monster(), "magic", gear, boosted, "melee_crush"),
      rendering.getPlayerAccuracyRolls(player(), monster(), "bogus", gear),
    ],
    monsterAttackRoll: styles.map((style) => rendering.getNpcAttackRoll(monster(), style)),
    playerDefence: styles.map((style) => stances.map((stance) => rendering.getPlayerDefenceRoll(player({ stance }), style, gear, boosted))),
    monsterAccuracy: styles.map((style) => [
      rendering.getNpcAttackAccuracy(monster(), player({ stance: "Defensive" }), style, gear, boosted),
      rendering.getNpcAttackAccuracy(monster({ toaRaidLevel: 150 }), player(), style, gear),
      rendering.getNpcAttackAccuracy(monster(), monster({ toaRaidLevel: 150 }), style, gear),
      rendering.getNpcAttackAccuracy(monster(), { kind: "bogus", note: "handed back" }, style, gear),
    ]),
    monsterMaxHit: styles.map((style) => rendering.getFormulaMaxHit(monster(), style, gear)),
    playerMaxHit: styles.map((style) =>
      [...variants, { meleeStrengthBonusPercent: 20 }, { rangedStrengthLevel: 112 }, { magicBaseMaxHit: 30.7 }, { magicBaseMaxHit: 30, voidSet: "elite_magic" }].map((variant) => [
        rendering.getFormulaMaxHit(player(variant), style, gear),
        rendering.getFormulaMaxHit(player(variant), style, gear, boosted),
      ]),
    ),
    // Where the product as a double falls just under the whole number: 100 Ranged with Eagle Eye is 115, so the roll
    // is (115 + 8) * (110 + 64) = 21402; a base of 25 with +16% magic damage is 29.
    rounding: [
      rendering.getPlayerAccuracyRolls(player({ levels: { attack: 99, strength: 98, defence: 97, ranged: 100, magic: 95 }, stance: "Other" }), monster(), "ranged", gear, { ...rendering.neutralPrayerMultipliers, ranged: 1.15 }).attackRoll,
      rendering.getFormulaMaxHit(player({ magicBaseMaxHit: 25 }), "magic", { ...gear, magicDamage: 16 }),
    ],
    maxHitOfNeither: rendering.getFormulaMaxHit({ kind: "bogus", note: "handed back" }, "magic", gear),
    hitDelay: ["melee", "bow", "thrown", "magic", "magic_slow", "bogus"].map((kind) => [1, 4, 10].map((distance) => rendering.getHitDelayTicks(kind, distance))),
    projectileTimings: rendering.projectileTimings,
    projectileFlight: Object.values(rendering.projectileTimings).map((timing) =>
      [0, 1, 7].map((distance) => {
        const cycles = rendering.getProjectileFlightCycles(timing, distance);
        return [cycles, rendering.getHitDelayTicksFromCycles(cycles), rendering.getTicksFromCycles(cycles)];
      }),
    ),
  };
}

// ---------------------------------------------------------------------------

function npcAttack(rendering) {
  const attacker = npc("mage", [4, 4], 3, { npcTypeId: 7699, formulaStats: monsterStats(), debuffs: { attackDrain: 5, strengthDrain: 200, magicDrain: 7, defenceDrain: 9 } });
  const victim = npc("nibbler", [9, 6], 1, { npcTypeId: 7691, formulaStats: monsterStats({ toaRaidLevel: 0 }) });
  const unknown = npc("unknown", [9, 9]); // no formula stats: it cannot attack or be attacked by an NPC
  const stat = (current) => ({ current, max: 99 });
  const player = {
    id: "player", kind: "player", alive: true, position: [10, 12], size: 1,
    stats: { attack: stat(91), strength: stat(92), defence: stat(93), ranged: stat(94), magic: stat(95), hitpoints: stat(96), prayer: stat(97) },
    equipment: { weapon: 4151 }, selectedAttackStyleIndex: 1, equipmentStats: gear, activePrayer: "ProtectMagic", offensivePrayer: "Piety",
  };
  const plan = (extra) => ({ formulaStyle: "magic", damageType: "magic", attackKind: "fireball", impactDelayTicks: 2, sourceDeathPolicy: "continue", ...extra });
  // Decisions that are told what they decide: the keys they are given are part of the result.
  const asked = [];
  const told = {
    chance: (key, chance) => (asked.push({ ...key, chance }), chance > 0.5),
    int: (key, low, high) => (asked.push({ ...key, low, high }), high),
  };
  const roll = (input) => rendering.rollNpcAttack({ attacker, target: player, plan: plan(), random: rendering.createSeededRandom(21), ...input });
  const projectile = { spotAnimId: 448, timing: rendering.projectileTimings.arrow, slope: 16, startHeight: 172, endHeight: 124 };
  const target = rendering.buildActorVisualTarget(victim);
  // No weapon category is without styles or has a style of an unknown kind, so the two answers for those can only be
  // had by changing the table: the styles of the unarmed entry are replaced for two calls and put back.
  const unarmed = rendering.weaponCategoryDefinitions.unarmed;
  const unarmedStyles = unarmed.styles;
  const oddStyles = [];
  try {
    unarmed.styles = [];
    oddStyles.push(rendering.getPlayerStance({ equipment: {}, selectedAttackStyleIndex: 0 }));
    unarmed.styles = [{ combatStyle: "bogus" }];
    oddStyles.push(caught(() => rendering.getPlayerStance({ equipment: {}, selectedAttackStyleIndex: 0 })));
  } finally {
    unarmed.styles = unarmedStyles;
  }
  return {
    rolls: [
      roll({}),
      roll({ plan: plan({ formulaStyle: "ranged", damageType: "ranged", projectile: rendering.projectileTimings.magic_spell, windupTicks: 1 }) }),
      roll({ plan: plan({ formulaStyle: "melee_crush", damageType: "melee", maxHit: 61.9, alwaysHits: true, prayerCheckAt: "launch" }), random: () => 0.999 }),
      roll({ plan: plan({ maxHit: -3 }), random: () => 0 }),
      roll({ target: victim }),
      roll({ target: victim, plan: plan({ formulaStyle: "melee_stab", maxHit: 9 }), labelled: { decisions: told, tick: 31 } }),
      roll({ labelled: { decisions: told, tick: 32 } }),
      roll({ target: unknown }),
      roll({ attacker: unknown }),
    ],
    asked,
    drained: [attacker, victim, unknown, npc("zeroed", [0, 0], 1, { formulaStats: monsterStats({ levels: { attack: 1, strength: 2, defence: 3, ranged: 4, magic: 5 } }), debuffs: { attackDrain: 9, defenceDrain: 3 } })].map((actor) => rendering.getDrainedNpcFormulaStats(actor)),
    playerStats: rendering.getPlayerFormulaStats(player),
    // Unarmed, whip, bow, powered staff, staff, bulwark: the stance of each attack style, and of an index that is none.
    stances: [undefined, 4151, 11235, 11907, 29594, 21015].map((weapon) => [0, 1, 2, 3, 99, -3, Number.NaN].map((selectedAttackStyleIndex) => rendering.getPlayerStance({ equipment: { weapon }, selectedAttackStyleIndex })).join()),
    oddStyles,
    visuals: {
      target,
      targetKeepsItsOwnPosition: target.position !== victim.position,
      sources: [attacker, victim, npc("even", [1, 1], 4)].map((actor) => rendering.getProjectileSourcePosition(actor)),
      projectiles: [
        rendering.buildNpcProjectileVisual(attacker, player, projectile),
        rendering.buildNpcProjectileVisual(attacker, victim, projectile, 20),
        rendering.buildNpcProjectileVisual(attacker, player, projectile, 70, victim),
      ],
    },
  };
}

// ---------------------------------------------------------------------------

function npcMovement(rendering) {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  // For every tile, the directions a footprint with its south-west corner there may step in, as a mask of two hex digits.
  const stepMasks = (min, max, width, height) =>
    grid(min, max, (x, y) => directions.reduce((mask, [dx, dy], bit) => mask | (rendering.canFootprintStepInArena([x, y], [x + dx, y + dy], { width, height }) << bit), 0).toString(16).padStart(2, "0") + " ");
  const shapes = [[1, 1], [2, 2], [3, 3], [3, 1], [1, 2]];

  // One wall of each kind, an object, two kinds of floor, and a flag that stops no step.
  const walls = collisionMap(rendering, 10, 10, [
    [2, 2, rendering.CollisionFlag.WALL_NORTH_WEST], [4, 2, rendering.CollisionFlag.WALL_NORTH], [6, 2, rendering.CollisionFlag.WALL_NORTH_EAST], [7, 4, rendering.CollisionFlag.WALL_EAST],
    [6, 6, rendering.CollisionFlag.WALL_SOUTH_EAST], [4, 7, rendering.CollisionFlag.WALL_SOUTH], [2, 6, rendering.CollisionFlag.WALL_SOUTH_WEST], [1, 4, rendering.CollisionFlag.WALL_WEST],
    [4, 4, rendering.CollisionFlag.OBJECT], [8, 8, rendering.CollisionFlag.FLOOR], [0, 8, rendering.CollisionFlag.FLOOR_DECORATION], [8, 1, rendering.CollisionFlag.BLOCK_NPCS],
  ]);
  const walled = withArena(rendering, { bounds: { minX: 0, minY: 0, maxX: 9, maxY: 9 }, collisionMap: walls }, true, () => ({
    steps: shapes.map(([width, height]) => stepMasks(0, 9, width, height)),
    refused: [
      [[5, 0], [5, 0], { width: 1, height: 1 }], [[5, 0], [7, 0], { width: 1, height: 1 }], [[5, 0], [5, 2], { width: 1, height: 1 }],
      [[5, 0], [6, 0], { width: 0, height: 1 }], [[5, 0], [6, 0], { width: 1.5, height: 1 }], [[5, 0], [6, 0], { width: 1, height: 0 }], [[5, 0], [6, 0], { width: 1, height: "1" }],
      // Steps of half a tile: neither a side nor a corner.
      [[5, 0], [5.5, 0], { width: 1, height: 1 }], [[5, 0], [5, 0.5], { width: 1, height: 1 }], [[5, 0], [5.5, 0.5], { width: 1, height: 1 }],
    ].map(([from, to, footprint]) => rendering.canFootprintStepInArena(from, to, footprint)),
    walkable: [1, 2, 3].map((size) => grid(-1, 10, (x, y) => mark(rendering.isArenaFootprintWalkable([x, y], size)))),
  }));

  const floor = new Set();
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 5; y++) if (`${x},${y}` !== "2,2" && `${x},${y}` !== "3,4") floor.add(`${x},${y}`);
  const tiled = withArena(rendering, { walkableTiles: floor }, true, () => ({
    steps: shapes.map(([width, height]) => stepMasks(-1, 6, width, height)),
    walkable: [1, 2].map((size) => grid(-1, 6, (x, y) => mark(rendering.isArenaFootprintWalkable([x, y], size)))),
  }));
  const nowhere = withArena(rendering, {}, false, () => [rendering.canFootprintStepInArena([0, 0], [1, 0], { width: 1, height: 1 }), rendering.isArenaFootprintWalkable([0, 0], 1)]);

  const pursuit = withArena(rendering, { bounds: { minX: 0, minY: 0, maxX: 20, maxY: 20 } }, true, () => {
    const playerAt = (position, extra) => ({ id: "player", kind: "player", alive: true, position, size: 1, attackTarget: null, attackInteractionActive: false, ...extra });
    const player = playerAt([10, 10]);
    const giant = npc("giant", [9, 9], 3);
    const context = (actors, extra) => ({
      tick: 1, random: rendering.createSeededRandom(3),
      world: { actors: new Map(actors.map((actor) => [actor.id, actor])), getPlayer: () => actors.find((actor) => actor.kind === "player") ?? null, occupancy: new rendering.OccupancyMap().syncActors(actors.filter((actor) => actor.kind === "npc")) },
      ...extra,
    });
    // Where an NPC of each size steps from every tile around a player, and around a 3x3 NPC it was told to chase.
    const chase = (size, target) => {
      const random = rendering.createSeededRandom(size);
      return grid(4, 16, (x, y) => {
        const hunter = npc("hunter", [x, y], size, { combat: { attackRange: 1, targetId: target ? null : "player" } });
        return stepKey(hunter.position, rendering.getNpcPursuitMoves(hunter, context([player, hunter], { random }), target));
      });
    };
    const hunterAt = (position, extra) => npc("hunter", position, 1, extra);
    const moves = (hunter, others = [player], extra, target) => movesText(caught(() => rendering.getNpcPursuitMoves(hunter, context([...others, hunter], extra), target)));
    const blockers = (tiles) => tiles.map((tile, index) => npc("blocker" + index, tile));
    const attacking = { attackTarget: "hunter", attackInteractionActive: true };
    const escapeKeys = [];
    const escape = (choice, position, extra) =>
      moves(npc("hunter", position, 3, extra), [playerAt([10, 10], attacking)], { decisions: { choose: (key, options) => (escapeKeys.push({ ...key, options: options.length }), options[choice].value) } });
    return {
      aroundPlayer: [1, 2, 3].map((size) => chase(size)),
      aroundGiant: [1, 2, 3].map((size) => chase(size, giant)),
      // The corner tile, then each side tile, then all three are taken; and a hunter that walks through other NPCs.
      crowded: [[], [[3, 3]], [[3, 2]], [[2, 3]], [[3, 3], [3, 2]], [[3, 3], [3, 2], [2, 3]]].map((tiles) => [moves(hunterAt([2, 2]), [player, ...blockers(tiles)]), moves(hunterAt([2, 2], { passThruNpcs: true }), [player, ...blockers(tiles)])]),
      guards: {
        dead: moves(hunterAt([2, 2], { alive: false })),
        dying: moves(hunterAt([2, 2], { alive: false, death: { status: "pending", killTick: 1, processTick: 2, causeStage: "hit-queue" } })),
        deathProcessed: moves(hunterAt([2, 2], { alive: false, death: { status: "pending", killTick: 0, processTick: 1, causeStage: "hit-queue" } })),
        notSpawned: moves(hunterAt([2, 2], { spawnTick: 2 })),
        spawned: moves(hunterAt([2, 2], { spawnTick: 1 })),
        noRange: moves(hunterAt([2, 2], { combat: { attackRange: 0, targetId: "player" } })),
        noTarget: moves(hunterAt([2, 2], { combat: { attackRange: 1, targetId: null } })),
        unknownTarget: moves(hunterAt([2, 2], { combat: { attackRange: 1, targetId: "nobody" } })),
        deadTarget: moves(hunterAt([2, 2]), [playerAt([10, 10], { alive: false })]),
        deadTargetGiven: moves(hunterAt([2, 2]), [player], {}, { ...giant, alive: false }),
        bound: moves(hunterAt([2, 2], { debuffs: { boundUntilTick: 5 } })),
        inRange: moves(hunterAt([9, 10])),
        longRange: [moves(hunterAt([4, 10], { combat: { attackRange: 6, targetId: "player" } })), moves(hunterAt([3, 10], { combat: { attackRange: 6, targetId: "player" } }))],
        heldUnderAttacker: moves(npc("hunter", [9, 9], 3), [playerAt([10, 10], attacking)]),
        noPlayer: moves(hunterAt([2, 2], { combat: { attackRange: 1, targetId: "giant" } }), [giant]),
      },
      escapes: [0, 1, 2, 3].map((choice) => escape(choice, [9, 9], { movesWithAttackerUnder: true })),
      escapeAtTheEdge: [0, 1, 2, 3].map((choice) => moves(npc("hunter", [0, 0], 2, { movesWithAttackerUnder: true }), [playerAt([1, 1])], { decisions: { choose: (key, options) => options[choice].value } })),
      escapeKeys,
      escapeBySeed: [1, 2, 3, 4, 5, 6].map((seed) => stepKey([9, 9], rendering.getNpcPursuitMoves(npc("hunter", [9, 9], 3), context([player], { random: rendering.createSeededRandom(seed) })))).join(""),
      held: [
        [npc("hunter", [9, 9], 3), null], [npc("hunter", [9, 9], 3, { debuffs: { boundUntilTick: 2 } }), null], [npc("hunter", [9, 9], 3, { debuffs: { boundUntilTick: 1 } }), null],
        [npc("hunter", [9, 9], 3), playerAt([10, 10], attacking)], [npc("hunter", [9, 9], 3), playerAt([10, 10], { ...attacking, attackInteractionActive: false })],
        [npc("hunter", [9, 9], 3), playerAt([10, 10], { ...attacking, attackTarget: "giant" })], [npc("hunter", [9, 9], 3), playerAt([12, 10], attacking)],
        [npc("hunter", [9, 9], 3, { movesWithAttackerUnder: true }), playerAt([10, 10], attacking)], [npc("hunter", [9, 9], 3), playerAt([10, 10])],
      ].map(([hunter, attackerOrNone]) => rendering.isNpcHeldInPlace(hunter, attackerOrNone, 1)),
    };
  });
  return { walled, tiled, nowhere, pursuit };
}

// ---------------------------------------------------------------------------

function npcDefinitions(rendering) {
  const calls = [];
  const hook = (name, answer) => (input) => {
    calls.push({ hook: name, given: Object.keys(input).join(), actor: input.actor.id, config: input.config, tick: input.context.tick, damage: input.damage, defeat: input.defeat, ownership: input.ownership });
    return answer;
  };
  const blob = rendering.defineNpc({
    id: "blob", spawnUntargetableTicks: 3, deathPolicy: "queued",
    onDamageResolved: hook("onDamageResolved"), onDefeated: hook("onDefeated"), onDespawn: hook("onDespawn"), onDeathStarted: hook("onDeathStarted"), onDeathAnimation: hook("onDeathAnimation"),
    releaseOnDeathAnimation: hook("releaseOnDeathAnimation", ["released"]), move: hook("move", [{ npcId: "blob-1", path: [[1, 1]] }]), tick: hook("tick", { environmentalDamages: ["burn"] }),
    postTick: hook("postTick", ["after"]), resolveLocalEffects: hook("resolveLocalEffects", ["effect"]), attackTimer: hook("attackTimer", 4),
  });
  const bare = rendering.defineNpc({ id: "bare" }); // no hooks: every answer is the default one, and it walks like any NPC
  const statue = rendering.defineNpc({ id: "statue", move: false, spawnUntargetableTicks: 0 });
  const otherBlob = rendering.defineNpc({ id: "blob" }); // the same id, another definition

  const blobActor = blob.createActor(npc("blob-1", [2, 2], 1, { spawnTick: 7 }), { mood: "calm" });
  const secondBlob = blob.createActor(npc("blob-2", [3, 3], 1, { spawnTick: 0 }), { mood: "cross" });
  const bareActor = bare.createActor(npc("bare-1", [2, 2]), { count: 1 });
  const statueActor = statue.createActor(npc("statue-1", [8, 8]), {});
  const impostor = otherBlob.createActor(npc("impostor", [5, 5]), {});
  const stateless = blob.createActor(npc("stateless", [0, 0], 1, { spawnTick: 0 }), undefined);
  const stranger = npc("stranger", [6, 6]); // of no definition
  const created = copy([blobActor, bareActor, statueActor, stateless]);

  const player = { id: "player", kind: "player", alive: true, position: [6, 5], size: 1, attackTarget: null, attackInteractionActive: false };
  const world = { actors: new Map([[player.id, player]]), getPlayer: () => player, occupancy: new rendering.OccupancyMap() };
  const context = (tick) => ({ tick, world, random: rendering.createSeededRandom(tick) });
  const registry = new rendering.NpcDefinitionRegistry([blob.register("blob settings"), bare.register("bare settings"), statue.register("statue settings")]);
  const empty = new rendering.NpcDefinitionRegistry();
  const everything = (among, actor) => ({
    damage: among.notifyDamageResolved(actor, { amount: 5 }, context(1)),
    defeated: among.notifyDefeated(actor, { cause: "hit" }, "encounter", context(2)),
    despawn: among.notifyDespawn(actor, context(3)),
    released: among.releaseOnDeathAnimation(actor, context(4)),
    move: movesText(among.move(actor, context(5))),
    tick: among.tick(actor, context(6)),
    postTick: among.postTick(actor, context(7)),
    effects: among.resolveLocalEffects(actor, context(8)),
    timer: among.attackTimer(actor, context(9)),
  });
  // The default move is a pursuit, which looks at the arena.
  const answers = withArena(rendering, {}, true, () => [blobActor, bareActor, statueActor, impostor, stateless, stranger].map((actor) => everything(registry, actor)));

  // Death: a queued death shows its animation a tick after the kill; a scripted one at once.
  rendering.recordNpcDeath(blobActor, 10, "hit-queue");
  rendering.markNpcDeathStarted(blobActor);
  rendering.startScriptedNpcDeath(secondBlob, 10);
  rendering.recordNpcDeath(bareActor, 10, "hit-queue");
  rendering.markNpcDeathStarted(bareActor);
  const deaths = [
    registry.notifyDeathStarted(blobActor, context(10)),
    rendering.isNpcDeathAnimationDueAtTick(blobActor, 11),
    registry.notifyDeathAnimation(blobActor, context(10)),
    registry.notifyDeathAnimation(blobActor, context(11)),
    registry.notifyDeathAnimation(blobActor, context(12)), // told already
    rendering.isNpcDeathAnimationDueAtTick(blobActor, 12),
    registry.notifyDeathStarted(secondBlob, context(10)),
    registry.notifyDeathStarted(bareActor, context(10)),
    registry.notifyDeathAnimation(bareActor, context(11)),
    ...[impostor, stranger].flatMap((actor) => [registry.notifyDeathStarted(actor, context(13)), registry.notifyDeathAnimation(actor, context(13))]),
  ];
  const registration = blob.register("direct");
  return {
    definitions: { ids: [blob.id, bare.id, statue.id], identities: [blob.identity, bare.identity], oneIdentityEach: blob.identity !== otherBlob.identity && blobActor.definition === blob.identity },
    created,
    refused: [
      caught(() => rendering.defineNpc({ id: "negative", spawnUntargetableTicks: -1 })),
      caught(() => rendering.defineNpc({ id: "fraction", spawnUntargetableTicks: 1.5 })),
      caught(() => blob.createActor(npc("unspawned", [0, 0]), {})),
    ],
    states: [blobActor, bareActor, impostor, stateless, stranger].map((actor) => [blob.getState(actor), blob.isActor(actor), bare.getState(actor), bare.isActor(actor)]),
    duplicate: caught(() => new rendering.NpcDefinitionRegistry([blob.register("first"), statue.register("between"), otherBlob.register("second")])),
    checked: [blobActor, bareActor, statueActor, stranger, impostor, stateless, { ...stranger, id: "orphan", state: {} }, { ...stranger, id: "foreign", definition: { id: "unknown" }, state: {} }].map((actor) => caught(() => registry.assertDefinitionMatches(actor) ?? "accepted")),
    answers,
    unregistered: withArena(rendering, {}, true, () => everything(empty, blobActor)),
    deaths,
    deathRecords: copy([blobActor.death, secondBlob.death, bareActor.death]),
    direct: [registration.definitionId, registration.isActor(blobActor), registration.isActor(impostor), registration.notifyDespawn(stranger, context(20)), registration.attackTimer(blobActor, context(21)), registration.attackTimer(impostor, context(22))],
    calls,
  };
}

// ---------------------------------------------------------------------------

function routes(rendering) {
  // A wall across the south with a gap one tile wide, open at its east end; and a tile closed in on all eight sides.
  const flagged = [];
  for (let x = 0; x <= 9; x++) if (x !== 7) flagged.push([x, 5, rendering.CollisionFlag.OBJECT]);
  for (let x = 11; x <= 13; x++) for (let y = 11; y <= 13; y++) if (x !== 12 || y !== 12) flagged.push([x, y, rendering.CollisionFlag.FLOOR]);
  const map = collisionMap(rendering, 16, 16, flagged);
  const canOccupy = (tile, size) => rendering.isArenaFootprintWalkable(tile, size);
  const search = (source, size, destination, mode, extra) => routeText(rendering.findNpcRoute({ source, size, destination, canOccupy, ...extra }, mode));
  const summary = (route) => (route.steps === undefined ? route : { kind: route.kind, steps: route.steps.length, first: route.steps[0], last: route.steps.at(-1) });
  const gapClosed = (from, to) => !(to[0] === 7 && to[1] === 5);

  const walled = withArena(rendering, { bounds: { minX: 0, minY: 0, maxX: 15, maxY: 15 }, collisionMap: map }, true, () => {
    const pursue = (position, playerTile, options, random = rendering.createSeededRandom(5)) =>
      movesText(caught(() => rendering.getBossPursuitMoves({ id: "boss", position }, playerTile, random, { size: 2, maxSpeed: 1, canOccupy, underFootprint: "random-cardinal", unreachable: "nearest-reachable", ...options })));
    return {
      melee: [1, 2, 3].map((size) => search([2, 2], size, [2, 9], "melee")),
      meleeHelper: routeText(rendering.findNpcRouteToMeleeRange({ source: [2, 2], size: 1, destination: [2, 9], canOccupy })),
      gapClosed: search([2, 2], 1, [2, 9], "melee", { canStep: gapClosed }),
      stepsGiven: (() => {
        const seen = [];
        search([2, 2], 2, [5, 2], "melee", { canStep: (from, to, size) => (seen.push([from.join(), to.join(), size].join(" ")), true) });
        return seen;
      })(),
      alreadyThere: [search([2, 8], 1, [2, 9], "melee"), search([2, 9], 1, [2, 9], "tile"), search([2, 9], 2, [3, 10], "melee")],
      tile: [search([2, 2], 1, [5, 9], "tile"), search([2, 2], 2, [5, 9], "tile"), search([14, 14], 1, [15, 0], "tile")],
      // The closed-in tile cannot be stood on or next to: the nearest tile that can be reached, or nothing.
      closedIn: [
        search([2, 2], 1, [12, 12], "tile"),
        search([2, 2], 1, [12, 12], "melee"),
        search([2, 2], 1, [12, 12], "melee", { moveNear: true }),
        search([2, 2], 1, [12, 12], "melee", { moveNear: false }),
        search([14, 14], 2, [12, 12], "melee"),
        search([12, 12], 1, [2, 2], "melee"),
      ],
      // Nowhere to go from under the destination; and a destination no reached tile is near.
      stuck: [search([5, 7], 2, [6, 8], "melee", { canOccupy: () => false }), search([2, 2], 1, [2, 14], "melee", { canOccupy: (tile) => tile[1] < 3 })],
      boss: {
        walk: [1, 2, 5].map((maxSpeed) => pursue([2, 2], [2, 9], { maxSpeed })),
        small: pursue([2, 2], [2, 9], { size: 1, maxSpeed: 3 }),
        stopped: [pursue([2, 2], [2, 9], { maxSpeed: 0 }), pursue([2, 8], [2, 8], { maxSpeed: -1, underFootprint: "bogus" })],
        inReach: pursue([2, 7], [2, 9], {}),
        underHeld: pursue([5, 7], [6, 8], { underFootprint: "hold" }),
        underBySeed: [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => pursue([5, 7], [6, 8], {}, rendering.createSeededRandom(seed))),
        underNoRoom: pursue([5, 7], [6, 8], { canOccupy: () => false }),
        underVetoed: pursue([5, 7], [6, 8], { canStep: () => false }),
        underInTheCorner: [1, 5, 7, 8].map((seed) => pursue([0, 0], [1, 1], { canOccupy: () => true }, rendering.createSeededRandom(seed))),
        underUnknown: pursue([5, 7], [6, 8], { underFootprint: "bogus" }),
        closedIn: [pursue([2, 2], [12, 12], { maxSpeed: 2 }), pursue([2, 2], [12, 12], { unreachable: "hold" }), pursue([2, 2], [12, 12], { unreachable: "bogus" })],
      },
    };
  });
  // No bounds: the search runs to the edge of its own window, 64 tiles around the source.
  const open = withArena(rendering, {}, true, () => {
    const far = (size, destination, mode) => summary(rendering.findNpcRoute({ source: [0, 0], size, destination, canOccupy: () => true }, mode));
    return [far(1, [70, 0], "melee"), far(3, [-70, -66], "melee"), far(1, [40, -30], "melee"), far(1, [200, 0], "melee"), far(1, [70, 0], "tile"), far(2, [0, 62], "tile"), far(2, [0, 63], "tile")];
  });
  return { walled, open };
}

// ---------------------------------------------------------------------------

/**
 * The player's rules the engine takes from rendering.js: prayers unlocked by the mechanics, a monster's stat override,
 * the equipment bonuses and the carried weight (with items made by hand, so that no cache is read), an NPC's
 * retaliation, the roll of a damage range and the protection prayer's reduction.
 */
function playerRules(rendering) {
  // Items as the cache's loader hands them out: params 0 to 14 are the bonuses, the weight is in grams.
  const items = new Map([
    [1333, { id: 1333, params: new Map([[1, 45], [10, 44], [13, 1], [14, 4]]), stackable: false, weight: 1814 }],
    [23330, { id: 23330, params: new Map(), stackable: false, weight: 1814 }], // a variant of 1333 with no bonuses of its own
    [23332, { id: 23332, params: new Map([[1, 7]]), stackable: false, weight: 5 }], // a variant of 1333 with its own
    [33553, { id: 33553, params: new Map([[4, 1]]), stackable: true, weight: 0 }], // an arrow of the variant table
    [24417, { id: 24417, params: new Map([[2, 95], [11, 2]]), stackable: false, weight: 2000 }], // has an entry in the override table
    [88, { id: 88, stackable: false, weight: 100 }],
    [89, { id: 89, stackable: false, weight: -4500 }], // what 88 weighs when worn
    [11851, { id: 11851, stackable: false, weight: -3000 }],
  ]);
  const loader = {
    load(id) {
      const item = items.get(id);
      if (!item) throw new Error("no item " + id);
      return item;
    },
  };
  const gracefulWorn = { head: 11851, cape: 11853, body: 11855, legs: 11857, hands: 11859, boots: 11861 };

  const formulaStats = {
    attributes: ["demon"],
    levels: { attack: 1, strength: 2, defence: 3, ranged: 4, magic: 5 },
    offensive: { atk: 6, str: 7 },
    defensive: { stab: 8, slash: 9, crush: 10, rangedLight: 11, rangedStandard: 12, rangedHeavy: 13, magic: 14 },
  };
  const override = (value) => rendering.applyMonsterStatOverride(copy(formulaStats), value);

  const retaliating = (mode, combat = {}) => ({ id: "npc", alive: true, combat: { attackSpeed: 5, nextActionTick: 0, targetId: null, retaliation: { mode, pending: [], lastIncomingAttackTick: null }, ...combat } });
  const hit = (style, accuracySucceeded, launchTick, impactTick, sourceId = "player") => ({ style, accuracySucceeded, launchTick, impactTick, sourceId });
  const schedule = (npc, attack) => caught(() => (rendering.scheduleNpcRetaliation(npc, attack), copy(npc.combat)));
  const scheduled = ["standard", "retarget", "one-tick", "bogus"].map((mode) => [
    mode,
    schedule(retaliating(mode), hit("melee", true, 20, 20)), // lands as it is launched: retaliates at once
    schedule(retaliating(mode), hit("ranged", false, 20, 22)), // waits for the impact
    schedule(retaliating(mode), hit("magic", true, 20, 23)),
    schedule(retaliating(mode), hit("magic", false, 20, 23)), // a splash: the tick after the cast, or the cast's own tick
  ]);
  const standardDelay = [
    schedule(retaliating("standard", { targetId: "player", nextActionTick: 12 }), hit("melee", true, 20, 20)), // already fighting the attacker
    schedule(retaliating("standard", { targetId: "player", nextActionTick: 11 }), hit("melee", true, 20, 20)), // ... but more than 8 ticks ago
    schedule(retaliating("standard", { targetId: "other", nextActionTick: 19 }), hit("melee", true, 20, 20)),
    schedule(retaliating("standard", { targetId: "other", nextActionTick: 30 }), hit("melee", true, 20, 20)), // never brought forward
  ];
  const quiet = [schedule({ ...retaliating("standard"), alive: false }, hit("melee", true, 20, 20)), schedule({ id: "npc", alive: true, combat: { attackSpeed: 4, nextActionTick: 0, targetId: null } }, hit("melee", true, 20, 20))];

  const pending = (...entries) => entries.map(([tick, sourceId]) => ({ tick, sourceId }));
  const resolve = (npcs) => {
    const world = { tick: 30, actors: new Map([["player", { alive: true }], ["ghost", { alive: false }]]), getNpcs: () => npcs };
    return caught(() => (rendering.resolvePendingRetaliations(world), copy(npcs.map((npc) => npc.combat))));
  };
  const withPending = (mode, entries, extra = {}) => {
    const npc = { ...retaliating(mode), ...extra };
    npc.combat.retaliation.pending = entries;
    return npc;
  };
  const resolved = [
    resolve([
      withPending("standard", pending([30, "player"], [31, "player"])), // one due, one kept
      withPending("one-tick", pending([29, "ghost"], [30, "nobody"], [30, "player"])), // a dead and an unknown attacker are dropped
      withPending("retarget", pending([30, "player"])),
      withPending("standard", pending([30, "player"]), { alive: false }), // a dead NPC forgets its retaliations
      { id: "plain", alive: true, combat: { attackSpeed: 4, nextActionTick: 0, targetId: null } },
    ]),
    resolve([withPending("bogus", pending([30, "player"]))]),
  ];

  const sequence = [0, 0.999, 0.5];
  const reductions = [undefined, { type: "block" }, { type: "cap", value: 3 }, { type: "cap" }, { type: "reduce", value: 0.5 }, { type: "reduce", value: 0.333 }, { type: "reduce" }, { type: "bypass" }, { type: "bogus" }];
  return {
    prayerUnlocked: [["Deadeye", {}], ["Deadeye", { upgradedPrayers: false }], ["MysticVigour", { upgradedPrayers: true }], ["Zeal", {}], ["Zeal", { zealPrayer: true }], ["Piety", {}], ["Piety", { zealPrayer: true }]].map(
      ([prayer, mechanics]) => rendering.isPrayerUnlockedByMechanics(prayer, mechanics),
    ),
    monsterOverride: [
      override({ skills: { atk: 10, str: 11, def: 12, ranged: 13, magic: 14 }, defensive: { stab: 20, slash: 21, crush: 22, light: 23, standard: 24, heavy: 25, magic: 26 } }),
      override({ skills: { def: 0 } }),
      override({ defensive: { heavy: 0 } }),
      override({}),
      override(undefined),
      rendering.applyMonsterStatOverride(undefined, { skills: { def: 0 } }),
    ],
    graceful: [gracefulWorn, { head: 11850, cape: 11852 }, { cape: 9771 }, { head: 11851, cape: 13340, shield: 11853 }, { ...gracefulWorn, ring: 1333, weapon: undefined }, {}].map((equipment) => rendering.getGracefulBonusPercent(equipment)),
    itemStats: [1333, 23330, 23332, 33553, 24417, 88, 424242].map((id) => caught(() => rendering.getItemEquipmentStats(id, loader))),
    equipmentStats: [{ weapon: 1333 }, { weapon: 23330, body: 24417, head: 424242, ammo: 33553 }, { shield: 23332, boots: 88 }, {}].map((equipment) => rendering.computeEquipmentStats(equipment, loader)),
    emptyStats: rendering.createEmptyEquipmentStats(),
    weight: [
      rendering.getCarriedWeight({ weapon: 1333, boots: 88, head: 11851, cape: 424242 }, [], loader),
      rendering.getCarriedWeight({}, [{ id: 1333, quantity: 2 }, null, { id: 33553, quantity: 100 }, { id: 424242 }, { id: 88 }], loader),
      rendering.getCarriedWeight({ boots: 89, ammo: 1333 }, [undefined], loader),
    ],
    scheduled,
    standardDelay,
    quiet,
    resolved,
    rolledDamage: [
      rendering.resolveRolledDamage(7),
      rendering.resolveRolledDamage([5, 5]),
      rendering.resolveRolledDamage([9, 3]),
      ...sequence.map((value) => rendering.resolveRolledDamage([3, 7], () => value)),
      [1, 2, 3, 4].map(((random) => () => rendering.resolveRolledDamage([0, 40], random))(rendering.createSeededRandom(11))),
    ],
    correctPrayer: ["magic", "range", "melee", "typeless"].map((attackType) => [undefined, null, "ProtectMagic", "ProtectRange", "ProtectMelee", "Piety"].map((prayer) => rendering.isCorrectProtectionPrayer(attackType, prayer))),
    prayerReduction: [
      ...reductions.map((reduction) => caught(() => rendering.applyPrayerReduction(37, "magic", "ProtectMagic", reduction))),
      rendering.applyPrayerReduction(0, "magic", "ProtectMagic", { type: "bypass" }),
      rendering.applyPrayerReduction(37, "typeless", "ProtectMagic"),
      rendering.applyPrayerReduction(37, undefined, "ProtectMagic"),
      rendering.applyPrayerReduction(37, "melee", null),
      rendering.applyPrayerReduction(37, "melee", "ProtectMagic"),
      rendering.applyPrayerReduction(37, "range", "ProtectRange"),
    ],
  };
}

// ---------------------------------------------------------------------------

/**
 * The player's starting state the engine takes from rendering.js: the spellbooks, the stat names with their labels and
 * level bounds, a stat block made new, from levels, cloned and reset, the combat level, and the special attack, timer,
 * poison and run energy records a run starts with.
 */
function playerStartState(rendering) {
  const fromLevels = (levels) => rendering.createStatsFromLevels({ attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1, prayer: 1, hitpoints: 10, agility: 1, ...levels });
  const mixed = fromLevels({ attack: 60, strength: 70, defence: 45, ranged: 80, magic: 75, prayer: 52, hitpoints: 71, agility: 30 });
  const drained = copy(mixed);
  drained.attack.current = 1;
  drained.hitpoints.current = 5;
  drained.magic.current = 80;
  const { agility, ...withoutAgility } = copy(drained);
  const cloned = rendering.cloneStats(drained);
  const levels = [0, 1, 9, 9.9, 10, 98.7, 99, 100, -5, NaN, Infinity, "50", null, undefined];
  return {
    spellbook: [rendering.defaultSpellbook, rendering.spellbookLabels, ["standard", "ancient", "lunar", "arceuus", "Arceuus", "", undefined, null, 3].map((value) => rendering.isSpellbook(value))],
    statNames: [rendering.statNames, rendering.combatStatNames, rendering.decayingStatNames],
    statLabels: rendering.statLabels,
    statBounds: rendering.statLevelBounds,
    clamped: rendering.statNames.map((stat) => levels.map((level) => rendering.clampStatLevel(stat, level))),
    valid: rendering.statNames.map((stat) => levels.map((level) => rendering.isValidStatLevel(stat, level))),
    unknownStat: [caught(() => rendering.clampStatLevel("slayer", 50)), caught(() => rendering.isValidStatLevel("slayer", 50))],
    fresh: rendering.createDefaultStats(),
    mixed,
    cloned: [cloned, cloned !== drained, cloned.attack !== drained.attack],
    reset: [rendering.resetStatsToMax(drained), rendering.resetStatsToMax(withoutAgility)],
    combatLevel: [
      rendering.createDefaultStats(),
      mixed,
      drained, // the current levels do not count
      fromLevels({}),
      fromLevels({ attack: 90, strength: 90 }), // melee
      fromLevels({ ranged: 90 }),
      fromLevels({ magic: 90, prayer: 43, defence: 20 }),
    ].map((stats) => rendering.getCombatLevel(stats)),
    specialAttack: rendering.createSpecialAttackState(),
    timers: [rendering.createCombatTimers(), rendering.createCombatTimers().statDecayLocks !== rendering.createCombatTimers().statDecayLocks],
    poison: rendering.createPoisonState(),
    runEnergy: [rendering.createRunEnergy(), rendering.maxRunEnergy],
    itemIds: [rendering.purgingStaffItemId, rendering.lightbearerItemId, rendering.ringOfEnduranceItemId],
  };
}

// ---------------------------------------------------------------------------

/**
 * The limits a replay is held to before it is played or taken over, and the types of the log's events: the error with
 * its reason and details, the limits, and the three tests of a cycle, a position and a size on values in and out of
 * bounds.
 */
function replayLimits(rendering) {
  const error = new rendering.ReplaySafetyError("takeover-work-limit", { actual: 29, limit: 28 });
  const bare = new rendering.ReplaySafetyError("invalid-clock");
  const cycles = [0, 1, 30, 1.5, -1, Number.MAX_SAFE_INTEGER, Math.floor(Number.MAX_SAFE_INTEGER / 20) - 30, Math.floor(Number.MAX_SAFE_INTEGER / 20) - 29, NaN, Infinity, "30", null, undefined];
  const positions = [[0, 0], [31.5, -12], [1000000, -1000000], [1000000.5, 0], [0, -1000001], [0, NaN], [Infinity, 0], [1, "2"], [1], [1, 2, 3], [], { 0: 1, 1: 2, length: 2 }, "12", null, undefined];
  const sizes = [1, 5, 64, 65, 0, -1, 2.5, NaN, Infinity, "3", null, undefined];
  return {
    error: [error.name, error.message, error.reason, error.details, error instanceof Error, error instanceof rendering.ReplaySafetyError],
    bare: [bare.name, bare.message, bare.reason, bare.details],
    separateDetails: bare.details !== new rendering.ReplaySafetyError("invalid-clock").details,
    limits: [rendering.projectileWorkLimit, rendering.projectileGeometryLimit, rendering.snapshotNpcLimit, rendering.snapshotGroundItemLimit, rendering.snapshotWorkLimit, rendering.snapshotFootprintLimit, rendering.totalSnapshotFootprintLimit],
    cycles: cycles.map((cycle) => rendering.isSafeReplayCycle(cycle)),
    positions: positions.map((position) => rendering.isSafeReplayPosition(position)),
    sizes: sizes.map((size) => rendering.isSafeReplaySize(size)),
    logEventTypes: rendering.LogEventType,
  };
}

// ---------------------------------------------------------------------------

/**
 * The lookups over the data tables the engine takes from rendering.js: item variants, monster names, the combat
 * spells, the equipment list with its canonical ids, the weapon categories and their styles, ammunition, the special
 * attacks, and what a weapon is to the rules (powered staff max hit, hit delay kind, formula style, speed and range,
 * projectile timing). No table is digested whole: each lookup is asked for chosen ids, the ones no fight asks for
 * among them (unknown ids, `undefined`, an item whose own id differs from its base).
 */
function dataTables(rendering) {
  const equipmentList = rendering.getEquipmentDefinitions();
  const spellNames = ["Wind Strike", "Magic Dart", "Ice Barrage", "Blood Burst", "Smoke Rush", "Dark Demonbane", "Ghostly Grasp", "Bind", "Tele Block", "Vengeance", "wind strike", "", undefined];
  const itemIds = [undefined, 1333, 23330, 88, 89, 468, 470, 9144, 28991, 33553, 882, 28687, 28688, 12926, 34428, 35, 424242];
  const weaponIds = [undefined, 424242, 4151, 12006, 1333, 9185, 21902, 11785, 12926, 28688, 11235, 29000, 10033, 21015, 13263, 4675, 21006, 29594, 11791, 27275, 22323, 11905, 12899, 28585, 22555, 28796, 27665, 23898, 23899, 23900, 31113];
  const ammoIds = [undefined, 882, 33553, 9144, 21316, 21905, 21944, 9244, 28991, 1333, 424242];
  const formulaStyles = ["melee_stab", "melee_slash", "melee_crush", "ranged", "magic", "bogus", undefined];
  const combatParams = (weapon, selectedAttackStyleIndex, combatSupplies) =>
    rendering.computePlayerCombatParams({ equipmentStats: { attackSpeed: 4, attackRange: 7 }, equipment: { weapon }, selectedAttackStyleIndex, combatSupplies });
  const activeSpell = (weaponId, selectedStyleIndex, selectedSpell, spellbook) => rendering.getActiveSpell({ weaponId, selectedStyleIndex, selectedSpell, spellbook });
  return {
    baseItemIds: itemIds.map((id) => rendering.getBaseItemId(id)),
    monsterNames: [7706, 1, 14176, -1, undefined].map((id) => rendering.getMonsterName(id)),
    spellsByBook: ["standard", "ancient", "lunar", "arceuus", "bogus", undefined].map((spellbook) => {
      const spells = rendering.getCombatSpellsOfSpellbook(spellbook);
      return [spells.length, spells[0], spells.at(-1)?.name];
    }),
    combatSpells: [rendering.combatSpells.length, rendering.combatSpells[0]],
    spellDefinitions: spellNames.map((name) => [rendering.getSpellDefinition(name), rendering.isSupportedCombatSpell(name)]),
    spellIcons: ["Wind Strike", "Tele Block", "  Ice--Barrage!  ", ""].map((name) => rendering.getSpellIconName(name)),
    equipmentList: [equipmentList.length, equipmentList[0], equipmentList.at(-1), equipmentList === rendering.getEquipmentDefinitions(), equipmentList.every((item, index) => index === 0 || equipmentList[index - 1].id < item.id)],
    equipment: itemIds.map((id) => [rendering.getEquipmentDefinition(id), rendering.getCanonicalEquipmentId(id), rendering.getEquipmentVariantIds(id)]),
    itemNames: [
      rendering.getItemName(1333, "Rune scimitar (cache)"),
      rendering.getItemName(1333, "null"),
      rendering.getItemName(1333, undefined),
      rendering.getItemName(1333, ""),
      rendering.getItemName(424242, "null"),
      rendering.getItemName(424242, undefined, "Item 424242"),
      rendering.getItemName(424242, "Named", "Item 424242"),
    ],
    inventoryActions: [
      rendering.getInventoryActions(1333, [null, "Wield", null, null, "Drop"]),
      rendering.getInventoryActions(1333, [null, null, null, null, null]),
      rendering.getInventoryActions(1333, []),
      rendering.getInventoryActions(88, [undefined, undefined]),
      rendering.getInventoryActions(12954, [null]), // a shield
      rendering.getInventoryActions(424242, [null, null]),
    ],
    weaponCategories: weaponIds.map((id) => {
      const definition = rendering.getWeaponCategoryDefinition(id);
      return [rendering.getWeaponCategory(id), rendering.getWeaponCategoryOrUnarmed(id), definition.name, definition.styles.length, definition === (rendering.weaponCategoryDefinitions[rendering.getWeaponCategory(id)] ?? rendering.weaponCategoryDefinitions.unarmed)];
    }),
    whipStyles: rendering.weaponCategoryDefinitions.whip,
    defaultStyle: weaponIds.map((id) => [undefined, "standard", "ancient", "arceuus", "lunar"].map((spellbook) => rendering.getDefaultAttackStyleIndex(id, spellbook))),
    activeSpell: [
      activeSpell(undefined, 0, "Wind Strike", "standard"),
      activeSpell(4151, 0, "Wind Strike", "standard"), // a whip has no casting style
      activeSpell(4675, 0, "Ice Barrage", "ancient"), // not on a casting style
      activeSpell(4675, 3, "Ice Barrage", "ancient"),
      activeSpell(4675, 4, "Dark Demonbane", "arceuus"),
      activeSpell(4675, 3, "Bogus Spell", "ancient"), // falls back to the staff's own spell
      activeSpell(4675, 3, undefined, "ancient"),
      activeSpell(4675, 3, undefined, "standard"),
      activeSpell(21006, 3, undefined, "arceuus"),
      activeSpell(21006, 3, undefined, "lunar"),
      activeSpell(29594, 3, undefined, undefined),
      activeSpell(4675, 99, "Wind Strike", "standard"),
    ],
    arrowVariants: [rendering.variantArrowsByItemId[33553], rendering.variantArrowsByItemId[33601], rendering.variantArrowsByItemId[882]],
    arrowOrBolt: ammoIds.map((id) => rendering.isArrowOrBolt(id)),
    requiresAmmo: weaponIds.map((id) => rendering.weaponRequiresAmmo(id)),
    ammoFits: [29000, 29851, 11235, 12765, 9185, 11785, 26374, 4151, 424242].map((weaponId) => ammoIds.map((ammoId) => rendering.isAmmoCompatibleWithWeapon(weaponId, ammoId))),
    specialAttacks: weaponIds.map((id) => rendering.hasSpecialAttack(id)),
    specialDefinitions: [12926, 28688, 12006, 27665, 11791, 11235, 29611, 424242, undefined].map((id) => rendering.getSpecialAttackDefinition(id)),
    spotAnimIds: [rendering.spotAnimIds.VFX_SHADOW_WALL_SMALL, rendering.spotAnimIds.VFX_YAMA_FIRE_IMMUNITY, rendering.spotAnimIds.NO_SUCH_SPOTANIM],
    poweredStaffMaxHit: weaponIds.map((id) => [1, 75, 99, 112].map((magicLevel) => rendering.getPoweredStaffBaseMaxHit(id, magicLevel))),
    hitDelayKind: weaponIds.map((id) => [undefined, "melee", "range", "magic"].map((style) => rendering.getHitDelayWeaponKind(id, style))),
    rangedDefenceType: weaponIds.map((id) => rendering.getRangedDefenceType(id)),
    formulaStyle: weaponIds.map((id) => [undefined, 0, 1, 2, 3, 4, 9, -1].map((styleIndex) => rendering.getWeaponFormulaStyle(id, styleIndex))),
    combatParams: [
      ...weaponIds.map((id) => [0, 1, 2, 3, 4].map((styleIndex) => combatParams(id, styleIndex, undefined))),
      combatParams(4675, 3, { selectedSpell: "Ice Barrage", spellbook: "ancient" }),
      combatParams(4675, 3, { spellbook: "ancient" }),
      combatParams(4675, 3, {}),
      combatParams(21006, 3, {}), // no spellbook: the staff's arceuus spell
      combatParams(12926, -3, undefined),
      combatParams(12926, 99, undefined),
      combatParams(11235, 2, undefined), // longrange is capped at 10
      rendering.computePlayerCombatParams({ equipmentStats: { attackSpeed: 1, attackRange: 9 }, equipment: { weapon: 12926 }, selectedAttackStyleIndex: 1 }), // rapid cannot go below 1
    ],
    formulaStyleToAttackStyle: formulaStyles.map((style) => rendering.formulaStyleToAttackStyle(style)),
    formulaStyleToAttackKind: formulaStyles.map((style) => rendering.formulaStyleToAttackKind(style)),
    projectileTiming: weaponIds.map((id) => [rendering.getWeaponProjectileTiming(id), rendering.getWeaponProjectileTiming(id, true)]),
  };
}

// ---------------------------------------------------------------------------

/**
 * The logger and the renderer's colour packing, the last two things the engine modules take from rendering.js besides
 * the encounter registry. The logger is one object for the whole client and it writes to the console, reads the URL
 * and puts `__log` on `window`: the scenario stands in for all three while it runs and puts the logger's own state
 * back afterwards. What is digested is what the logger answers and hands on: its level and category filters, the
 * breadcrumbs without their time (`at` is the clock), the tag and the number of values of each console call, what
 * the error sink was called with.
 */
function loggerAndColour(rendering) {
  const logger = rendering.logger;
  const saved = { level: logger.level, disabledCategories: logger.disabledCategories, enabledCategories: logger.enabledCategories, breadcrumbs: logger.breadcrumbs, errorSink: logger.errorSink };
  const realConsole = { log: console.log, warn: console.warn, error: console.error };
  const hadWindow = Object.hasOwn(globalThis, "window");
  const realWindow = globalThis.window;
  const printed = [];
  const print = (method) => (first, ...rest) => void printed.push([method, String(first), rest.length]);
  const takePrinted = () => printed.splice(0);
  const filters = () => ({ level: logger.getLevel(), enabled: logger.enabledCategories && [...logger.enabledCategories], disabled: [...logger.disabledCategories] });
  const crumbs = () => logger.getBreadcrumbs().map(({ level, category, message, at }) => [level, category, message, typeof at]);
  const unreadable = new Proxy({}, { ownKeys() { throw new Error("no keys"); } });
  const result = {};
  try {
    console.log = print("log");
    console.warn = print("warn");
    console.error = print("error");
    logger.level = 2;
    logger.disabledCategories = new Set();
    logger.enabledCategories = null;
    logger.breadcrumbs = [];
    logger.errorSink = null;

    // Levels: by name in any case, by number, an unknown name changes nothing, a number outside the table is "unknown".
    result.levels = ["debug", "TRACE", "loud", 1, "None", 7, "warn"].map((level) => {
      logger.setLevel(level);
      return [logger.getLevel(), logger.isEnabled(rendering.LogLevel.INFO, "Perf"), logger.isEnabled(1), logger.isEnabled(5, "Cache")];
    });
    result.logLevel = rendering.LogLevel;

    // The five methods at every level: what reaches the console, and what is kept as a breadcrumb.
    result.byLevel = [0, 1, 2, 3, 4, 5].map((level) => {
      logger.setLevel(level);
      logger.clearBreadcrumbs();
      logger.error("Sim", "failed", new RangeError("too far"));
      logger.warn("Sim", "odd", 3);
      logger.info("Sim", "tick", { tick: 4 });
      logger.debug("Sim", "detail");
      logger.trace("Sim");
      return { printed: takePrinted(), crumbs: crumbs() };
    });

    // Category filters: a disabled category, a list of enabled ones, no category at all.
    logger.setLevel(3);
    logger.disabledCategories.add("Perf");
    result.disabled = ["Perf", "Cache", "", undefined].map((category) => logger.isEnabled(3, category));
    logger.enabledCategories = new Set(["Cache"]);
    result.enabledOnly = ["Perf", "Cache", "Renderer", ""].map((category) => logger.isEnabled(3, category));
    logger.info("Perf", "filtered out, still a breadcrumb");
    logger.info("Cache", "printed");
    result.filteredPrinted = takePrinted();
    logger.enabledCategories = null;
    logger.disabledCategories.clear();

    // The error sink: called with the category and the values, also when the level prints nothing; a sink that throws.
    const sunk = [];
    logger.setLevel(0);
    logger.setErrorSink((category, values) => void sunk.push([category, values.length, String(values[0])]));
    logger.error("Replay", "bad frame", 12);
    logger.setErrorSink(() => {
      throw new Error("sink failed");
    });
    result.sinkThrows = caught(() => logger.error("Replay", "second"));
    logger.setErrorSink(null);
    logger.error("Replay", "no sink");
    result.sunk = sunk;
    result.sinkPrinted = takePrinted();

    // Breadcrumb messages: how each kind of value is described, the cut at 200 characters, the cap of 30.
    logger.clearBreadcrumbs();
    logger.info("Describe", "text", new TypeError("bad"), null, undefined, 12.5, true, new Uint8Array(3), new Float64Array(2), Object.setPrototypeOf(new Uint8Array(2), null), [1, 2, 3], { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }, {}, unreadable);
    logger.info("Describe");
    logger.info("Long", "x".repeat(150), "y".repeat(80));
    logger.info("Long", "x".repeat(199), "y");
    logger.info("Long", "x".repeat(200), "never read");
    logger.info("Long", "x".repeat(100), "y".repeat(99), "z", "never read");
    result.described = crumbs();
    logger.clearBreadcrumbs();
    for (let index = 0; index < 33; index++) logger.warn("Cap", index);
    result.capped = [logger.getBreadcrumbs().length, logger.getBreadcrumbs()[0].message, logger.getBreadcrumbs()[29].message, logger.getBreadcrumbs() === logger.breadcrumbs];
    logger.clearBreadcrumbs();
    result.cleared = logger.getBreadcrumbs().length;
    logger.breadcrumbs = null; // a broken list must not make a log call throw
    result.brokenBreadcrumbs = caught(() => logger.info("Broken", "still printed"));
    logger.breadcrumbs = [];
    takePrinted();

    // The URL: `logLevel` and `logCategories`, read when the logger is made. Asked again here with a URL of our own.
    const readUrl = (search) => {
      logger.level = 2;
      logger.enabledCategories = null;
      globalThis.window = { location: { search } };
      logger.readUrlParams();
      return filters();
    };
    result.url = ["", "?logLevel=trace", "?logLevel=loud&logCategories=Cache,%20Renderer,,", "?logCategories=Perf&logLevel=ERROR", "?logCategories="].map(readUrl);
    delete globalThis.window;
    logger.level = 2;
    logger.enabledCategories = null;
    logger.readUrlParams(); // no window: nothing is read and nothing is thrown
    result.urlWithoutWindow = filters();

    // `window.__log`, the logger's commands for the browser console.
    globalThis.window = { location: { search: "" } };
    logger.init();
    const commands = globalThis.window.__log;
    result.commandNames = Object.keys(commands);
    const commandState = () => ({ shown: commands.level, ...filters(), categories: commands.categories() });
    result.commands = [
      () => {},
      () => commands.setLevel("debug"),
      () => commands.setLevel("loud"),
      () => commands.setLevel(9),
      () => commands.disable("Perf"),
      () => commands.enable("Perf"),
      () => (logger.enabledCategories = new Set(["Cache"])),
      () => commands.enable("Renderer"),
      () => commands.disable("Cache"),
      () => commands.enableAll(),
    ].map((step) => {
      step();
      return commandState();
    });
    commands.help();
    result.help = takePrinted();
  } finally {
    Object.assign(console, realConsole);
    Object.assign(logger, saved);
    if (hadWindow) globalThis.window = realWindow;
    else delete globalThis.window;
  }

  // The colour packing: hue 0 to 255 in six bits, saturation in three, lightness 0 to 255 in seven; the saturation is
  // halved once for each of the four lightness steps above 179, 192, 217 and 243.
  result.packHsl = [[144, 246, 104], [0, 0, 0], [255, 255, 255], [40, 200, 179], [40, 200, 180], [40, 200, 193], [40, 200, 218], [40, 200, 244], [3, 31, 1], [4, 32, 2]].map(([hue, saturation, lightness]) => rendering.packHsl(hue, saturation, lightness));
  return result;
}

/**
 * The encounter registry: the object that hands the engine the encounter of a kind (`createSimulationEngine` asks it)
 * and the interface the descriptor of a kind or of one of its variants. Every fight goes through `create`; what no
 * fight does is ask for a kind that is not there, register a kind twice or with a descriptor of another kind, or
 * find a descriptor by a variant's kind, or hand the Inferno constructor options. The shared registry is only asked,
 * for a fixed list of kinds, so that a new encounter does not change this text. Everything that registers or fails is done on a second registry of the same
 * class, made here: its own properties when it is new, then thirteen steps, each with what it returned or threw, then
 * what it holds and answers. Of an error: its name, its message, and its own properties with their attributes (not
 * the stack).
 */
function encounterRegistry(rendering) {
  const registry = rendering.encounterRegistry;
  const kinds = ["yama_p3", "yama_p3_divine", "yama_p3_glyphic", "lobby", "sol_heredit", "inferno", "zuk", "not_a_kind"];
  const caught = (run) => {
    try {
      return { returned: run() };
    } catch (error) {
      const own = Object.entries(Object.getOwnPropertyDescriptors(error)).filter(([key]) => key !== "stack");
      return { name: error.name, message: error.message, isError: error instanceof Error, own: own.map(([key, property]) => [key, property.value, property.enumerable, property.writable, property.configurable]) };
    }
  };
  const fresh = new registry.constructor();
  const ownAtStart = Object.entries(Object.getOwnPropertyDescriptors(fresh)).map(([key, property]) => [key, property.value instanceof Map ? "a Map of " + property.value.size : property.value, property.enumerable, property.writable, property.configurable]);
  const factory = (options) => ({ made: options ?? "no options" });
  const steps = [
    caught(() => fresh.getRegisteredKinds()),
    caught(() => fresh.create("first")),
    caught(() => fresh.register("first", factory, { kind: "first", variants: [{ encounterKind: "first_variant" }, { encounterKind: "first_other" }] })),
    caught(() => fresh.register("first_variant", factory)),
    caught(() => fresh.register("second", factory, { kind: "second" })),
    caught(() => fresh.register("first", factory)),
    caught(() => fresh.register("first_variant", factory, { kind: "first_variant" })),
    caught(() => fresh.register("third", factory, { kind: "second" })),
    caught(() => fresh.register("fourth", factory, undefined)),
    caught(() => fresh.create("first", { wave: 3 })),
    caught(() => fresh.create("first_variant")),
    caught(() => fresh.create("third")),
    caught(() => fresh.create("first_other")),
  ];
  return {
    shared: kinds.map((kind) => [kind, registry.isRegistered(kind), registry.getDescriptor(kind)?.kind, registry.getDescriptorOfKindOrVariant(kind)?.kind, registry.getRegisteredKinds().includes(kind)]),
    sharedOrder: registry.getRegisteredKinds().filter((kind) => kinds.includes(kind)),
    sharedOwn: Object.keys(registry),
    // What the interface asks about a kind: is there an intro, does the player walk during the countdown (the Inferno:
    // not when the run starts at wave 69, which an empty setup does), which kind and mechanics a retired kind stands for, and the last two
    // mechanics toggles of its controls (infinite health and infinite special attack are added to every kind's).
    lookups: kinds.map((kind) => [kind, rendering.isIntroEnabledForKind(kind), rendering.hasCountdownMovement(kind, {}), rendering.hasCountdownMovement(kind, { infernoStartWave: "3" }), rendering.resolveKindOrRetiredEntry(kind), rendering.getEncounterControls(kind)?.mechanicsToggles.slice(-2).map((toggle) => toggle.key)]),
    refusedOptions: caught(() => registry.create("inferno", { wave: 3 })),
    ownAtStart,
    steps,
    freshFactories: [...fresh.factories.keys()],
    freshDescriptors: [...fresh.descriptors],
    freshAnswers: ["first", "first_variant", "first_other", "second", "third", "fourth"].map((kind) => [kind, fresh.isRegistered(kind), fresh.getDescriptor(kind)?.kind, fresh.getDescriptorOfKindOrVariant(kind)?.kind]),
    freshKinds: fresh.getRegisteredKinds(),
  };
}

export const scenarios = [
  { name: "shared/encounter-registry", pure: pure(encounterRegistry) },
  { name: "shared/logger-and-colour", pure: pure(loggerAndColour) },
  { name: "shared/data-tables", pure: pure(dataTables) },
  { name: "shared/replay-limits", pure: pure(replayLimits) },
  { name: "shared/player-start-state", pure: pure(playerStartState) },
  { name: "shared/player-rules", pure: pure(playerRules) },
  { name: "shared/arena", pure: pure(arena) },
  { name: "shared/npc-lifecycle", pure: pure(npcLifecycle) },
  { name: "shared/range-and-sight", pure: pure(rangeAndSight) },
  { name: "shared/occupancy-and-decisions", pure: pure(occupancyAndDecisions) },
  { name: "shared/formulas", pure: pure(formulas) },
  { name: "shared/npc-attack", pure: pure(npcAttack) },
  { name: "shared/npc-movement", pure: pure(npcMovement) },
  { name: "shared/npc-definitions", pure: pure(npcDefinitions) },
  { name: "shared/routes", pure: pure(routes) },
];
