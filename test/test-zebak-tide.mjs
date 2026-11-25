import assert from "node:assert/strict";
import {zebakDefinition} from "../client/toa/zebak/native.js";
import {ZebakPhases} from "../client/toa/zebak/phases.js";

for (const direction of [-1, 1]) {
  const rolls = [0.5, 0.01, 0.5, 0.99];
  const phases = new ZebakPhases(() => rolls.shift(), () => new Set(), () => {});
  for (const x of [22, 23, 24, 28, 39]) phases.depositAcid([x, 32]);
  phases.depositAcid([22, 33]);
  for (let pass = 1; pass <= 3; pass++) {
    const startTick = 7 * pass;
    phases.waveFronts = [{startTick, direction, gap: 28, gapWidth: 3, actors: []}];
    const context = {tick: startTick + 11}; // row 32: 11 rows from shore row 21 or 43
    phases.advanceWaveFronts(context);
    phases.advanceWaveFronts(context);
    const expected = [22, 23, 24].slice(pass).concat(28, 39);
    assert.deepEqual(phases.snapshot().acid, [...expected.map(x => [x, 32]), [22, 33]]);
    if (pass === 1) phases.depositAcid([24, 32]);
  }
  assert.equal(rolls.length, 0);
}

// A crest strikes the player's true tile before it steps (OBS, rev 243 recording,
// 2026-11-25): running or walking through it is safe, ending a tick on its tile
// is not, and a hit throws him 3 tiles the way it runs or off the platform.
for (const direction of [-1, 1]) {
  const tiles = new Set();
  for (let x = 22; x <= 38; x++)
    for (let y = 22; y <= 42; y++) tiles.add([x,y].join(","));
  const shore = direction > 0 ? 21 : 43;
  /** Plays ticks with a crest standing on `row` (gap 28-30), the player starting on `start`.
   *  `moves[i]` is where he walks in tick i+1 (null: stands); a push replaces his step. */
  function play(start, row, moves) {
    const phases = new ZebakPhases(() => 0, () => tiles, () => {});
    const offset = (row - shore) * direction;
    phases.waveFronts = [{startTick: -offset, direction, gap: 28, gapWidth: 3, actors: [], y: row, tick: 0}];
    const player = {alive: true, position: [...start], facing: 0, attackTarget: null};
    const log = [];
    moves.forEach((move, index) => {
      const context = {tick: index + 1};
      const hits = phases.advanceWaveFronts(context, player, []).filter(hit => hit.source === "Tidal Wave");
      const pushed = phases.moveWithTide(player, move, to => { player.position = [...to]; });
      if (pushed === undefined && move) player.position = [...move];
      log.push({hits: hits.length, at: [...player.position], crest: phases.waveFronts[0]?.y,
        water: phases.water && {...phases.water}, shove: phases.waveShove && {...phases.waveShove}});
      if (phases.waveShove?.tick !== context.tick) phases.waveShove = null;
    });
    return log;
  }
  const hits = log => log.reduce((sum, entry) => sum + entry.hits, 0);
  const d = direction;
  // On the crest's tile when its turn comes: hit once, thrown 3 tiles, his own click dropped.
  let log = play([33, 32], 32, [[33, 32 - 5 * d]]);
  assert.equal(log[0].hits, 1);
  assert.deepEqual(log[0].at, [33, 32 + 3 * d]);
  assert.deepEqual(log[0].shove, {tick: 1, from: [33, 32], to: [33, 32 + 3 * d], facing: 0});
  assert.equal(log[0].crest, 32 + d);
  assert.equal(log[0].water, null);
  // The click stays dropped while the engine keeps passing the same tile; a new click walks again.
  const click = [33, 32 - 5 * d];
  log = play([33, 32], 32, [click, click, [33, 32 + 2 * d]]);
  assert.deepEqual(log.map(entry => entry.at), [[33, 32 + 3 * d], [33, 32 + 3 * d], [33, 32 + 2 * d]]);
  // The wave skip (ticks 1916-1917 of the recording): a row ahead of the crest, he runs two tiles
  // through it in the tick it steps onto his row, and is never on its tile when it strikes.
  log = play([33, 32 + d], 32, [[33, 32 - d], null, null]);
  assert.equal(hits(log), 0);
  assert.deepEqual(log.map(entry => entry.crest), [32 + d, 32 + 2 * d, 32 + 3 * d]);
  // Walking one tile into it works the same: he ends behind it.
  assert.equal(hits(play([33, 32 + d], 32, [[33, 32], null])), 0);
  // Standing still a row ahead: the crest steps onto him and strikes on its next turn.
  log = play([33, 32 + d], 32, [null, null]);
  assert.deepEqual(log.map(entry => entry.hits), [0, 1]);
  assert.deepEqual(log[1].at, [33, 32 + 4 * d]);
  // Standing still afterwards, the same crest catches him again three ticks later.
  log = play([33, 32], 32, [null, null, null, null]);
  assert.deepEqual(log.map(entry => entry.hits), [1, 0, 0, 1]);
  assert.deepEqual(log[3].at, [33, 32 + 6 * d]);
  // In the gap of the crest: nothing.
  assert.equal(hits(play([29, 32], 32, [null, null, null])), 0);
  // Fewer than 3 tiles of platform ahead: off the edge, into the water beyond it.
  const edge = d > 0 ? 42 : 22;
  log = play([33, edge - d], edge - d, [null, null]);
  assert.equal(log[0].hits, 1);
  assert.deepEqual(log[0].at, [33, edge + d]);
  assert.deepEqual(log[0].water, {direction: d, entered: 1});
  // In the water a crest no longer finds him.
  assert.equal(log[1].hits, 0);
}
console.log("Both tide directions: struck on the crest's tile before it steps, skipped by running or walking through it, re-struck when standing still, the gap, and thrown 3 tiles or into the water.");
for (const direction of [-1, 1]) {
  const tiles = new Set();
  for (let x = 22; x <= 38; x++)
    for (let y = 23; y <= 41; y++) tiles.add([x,y].join(","));
  const cues = [];
  const boss = {alive: true, position: [14,28], size: 9, vitals: {hp:100,maxHp:100}};
  const player = {alive:true, position:[22,32], equipment:{}};
  const context = {tick:0, world:{actors:new Map([["zebak",boss],["player",player]])},
    tickEvents:{emit() {}}, spawnNpc() {}, despawnNpc() {}};
  const phases = new ZebakPhases(() => 0.5, () => tiles, (_, event) => cues.push({tick:context.tick,event}));
  phases.count.waves = direction < 0 ? 1 : 0;
  const settings = {gap:3,acidWidth:3,jugWidth:5};
  phases.begin(context, "waves", settings);
  const shore = direction > 0 ? 41 : 23;
  const jug = phases.spawn(context, "jug", 11735, [22,shore]);
  let damage = 0;
  for (; context.tick <= 58; context.tick++) {
    // Put the player on row 32 behind every crest that has just stepped onto it: its next turn
    // strikes him there and throws him 3 tiles on.
    if (phases.waveFronts.some(front => front.y === 32)) player.position = [22,32];
    damage += phases.step(context, settings, boss).filter(hit => hit.source === "Tidal Wave").length;
    if (phases.wavePush) {
      assert.equal(phases.moveWithTide(player, null, next => {
        assert.deepEqual(next,[22,32+3*direction]);
        player.position = next;
      }), true);
      player.position = [30,32]; // waits in the gap (29-31 for every crest here) for the next one

    }
    for (const object of phases.actors.values()) {
      if (object.destination) object.actor.position = phases.movementFor(object.actor)[0].path[0];
    }
    if (context.tick === 21 || context.tick === 28) {
      assert.equal(phases.waveFronts.length, context.tick === 21 ? 2 : 3);
      const [older, younger] = phases.waveFronts;
      assert.equal(older.y - younger.y, direction * 7);
      assert.ok(older.actors.every(o => o.actor.position[1] === older.y));
      assert.ok(younger.actors.every(o => o.actor.position[1] === younger.y));
      assert.equal(phases.of("wave").length, phases.waveFronts.length * 19);
      assert.deepEqual([older.actors[0].actor.position[0], older.actors.at(-1).actor.position[0]], [18,39]);
    }
  }
  assert.equal(damage, 3);
  assert.deepEqual(cues.filter(c => c.event.tidalSurgeSound).map(c => c.tick),[14,25,38]);
  assert.equal(cues.filter(c => c.event.graphics.some(g => g.spotAnimId === 2195)).length, 1);
  assert.equal(cues.filter(c => c.event.graphics.length === 1 && c.event.graphics[0].spotAnimId === 2449
    && c.event.graphics[0].target.position[0] === 22).length, 1);
  assert.equal(phases.actors.has(jug.actor.id), false);
  assert.equal(phases.of("wave").length, 0);
  assert.equal(phases.waveFronts.length, 0);
  assert.equal(phases.active,null);
}
console.log("Three overlapping crests preserved independent NPC rows, gap, a strike and push from each, shoreline splashes and cleanup in both directions.");
for (const path of [0, 3, 4]) {
  const cues = [];
  const tiles = new Set();
  for (let x = 22; x <= 38; x++)
    for (let y = 22; y <= 42; y++) tiles.add([x,y].join(","));
  const encounter = zebakDefinition({seedRandom: () => () => 0.5, walkable: () => tiles,
    animate: (_, event) => cues.push({tick:context.tick,event})}).factory();
  encounter.configureRunStart({path});
  const phases = encounter.phases;
  const boss = {id:"zebak", alive:true, size:9, position:[14,28], vitals:{hp:100,maxHp:100}};
  const player = {alive:true, position:[29,32], equipment:{}};
  const context = {tick:0, world:{actors:new Map([["zebak",boss],["player",player]])},
    tickEvents:{emit() {}}, spawnNpc() {}, despawnNpc() {}};
  phases.begin(context,"waves",encounter.settings);
  phases.queue.push("roar");
  const jug = phases.spawn(context,"jug",11735,[29,32]);
  for (context.tick = 1; context.tick <= 39; context.tick++) phases.step(context,encounter.settings,boss);
  context.tick = 39;
  encounter.processNpcTick(boss,context);
  assert.deepEqual(phases.queue, []);
  assert.equal(phases.active.kind,"roar");
  assert.equal(phases.active.start,39);
  assert.ok(phases.actors.has(jug.actor.id));
  assert.ok(phases.waveFronts.length > 0);
  const lastFront = phases.waveFronts.at(-1);
  const row = lastFront.y;
  context.tick++;
  phases.step(context,encounter.settings,boss);
  assert.equal(lastFront.y,row + 1);
  for (context.tick++; context.tick <= 54; context.tick++) phases.step(context,encounter.settings,boss);
  assert.equal(phases.waveFronts.length,0);
  assert.equal(phases.active.kind,"roar");
  assert.equal(phases.of("rock").length,3);
  assert.deepEqual(cues.filter(c => c.event.tidalSurgeSound).map(c => c.tick),path ? [13,24,37] : [14,25,38]);
}
console.log("A queued roar starts with water still moving and preserves existing jugs on paths 0, 3 and 4.");
