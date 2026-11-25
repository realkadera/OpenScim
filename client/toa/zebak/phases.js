import {specialDrops} from "./special-layouts.js";
import { thresholds } from "./rules.js";
import { cyclesPerTick, specialThrow, roarWindupTick } from "./timing.js";

const key = ([x, y]) => x + "," + y;
const distance = (a, b) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const offsetFromFootprint = (origin, size, target) =>
  target.map((value, axis) => value - Math.max(origin[axis], Math.min(value, origin[axis] + size - 1)));
const tile = (position) => ({ kind: "tile", position });
const shoreRockColumns = [18, 21, 24, 27, 30, 33, 36, 39];
// OBS (rev 243 recording, 2026-11-25): the boulders, splashes and every crest
// of a Tidal Waves start on local row 21 when they run north and on row 43
// when they run south, one row off the platform (y 22-42). A crest then moves
// a row a tick for 24 ticks, to row 45 or 19, and is gone on the 25th.
const crestShore = direction => direction > 0 ? 21 : 43;
const hazard = (source, baseDamage, extras = {}) => ({
  source,
  baseDamage,
  attackType: "typeless",
  ...extras,
});
const matrix = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

export const phaseModels = [
  { npcTypeId: 11735, idleSeqId: -1 },
  { npcTypeId: 11736, idleSeqId: -1, walkSeqId: 6 },
  { npcTypeId: 11737, idleSeqId: -1 },
  { npcTypeId: 11738, idleSeqId: 7877, walkSeqId: 7877, spawnSeqId: 7878 },
  { npcTypeId: 11742, idleSeqId: 8102, walkSeqId: 8101 },
  { npcTypeId: 11743, idleSeqId: 8102, walkSeqId: 8101 },
];
// All seven variants are cache locs. Keep the same mesh until the pool is cleared.
const acidVariants = [45570, 45571, 45574, 45575, 45570, 45574, 45572, 45573, 45576, 45571, 45575, 45570];
function acidLoc(x, y) {
  const hash = Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663);
  return acidVariants[(hash >>> 0) % acidVariants.length];
}
export const acidScene = () => ({
  consumeEvents() {},
  update({ state, interpolatedTick }) {
    const decals = (state.encounter.state.acid ?? []).map(([x, y]) => {
      const id = "acid-" + x + "-" + y;
      return {
        id,
        meshId: id,
        materialId: "osrs-npc",
        modelMatrix: matrix,
        lifecycle: { kind: "sync" },
        classification: "groundDecal",
        data: {
          kind: "loc",
          locId: acidLoc(x, y),
          modelType: 10,
          rotation: (x + y) % 4,
          localX: x,
          localY: y,
          level: 1,
          seqId: -1,
        },
      };
    });
    for (const [x, y] of state.encounter.state.bloodTrail ?? []) {
      const id = `zebak-blood-${x}-${y}`;
      // These are the three blood ground decorations already on the arena edges.
      decals.push({
        id, meshId: id, materialId: "osrs-npc", modelMatrix: matrix,
        lifecycle: {kind: "sync"}, classification: "groundDecal",
        data: {kind: "loc", locId: 652 + (x + y) % 3, modelType: 22,
          rotation: (x + y) % 4, localX: x, localY: y, level: 1, seqId: -1},
      });
    }
    for (const splash of state.encounter.state.splashes ?? []) {
      for (const position of splash.tiles) {
        const age = interpolatedTick - splash.tick - (4 + 5 * distance(splash.origin, position)) / cyclesPerTick;
        if (age < 0 || age >= 2) continue;
        const [x, y] = position;
        const id = `jug-water-${splash.id}-${x}-${y}`;
        decals.push({
          id, meshId: id, materialId: "osrs-npc", modelMatrix: matrix,
          lifecycle: {kind: "sync"}, classification: "groundDecal",
          style: {opacity: age < 1 ? 0.9 : age < 1.5 ? 0.6 : 0.3, zOffset: 0.08, cullFace: "none"},
          data: {kind: "loc", locId: 745, modelType: 22, rotation: (x + y) % 4,
            localX: x, localY: y, level: 1, seqId: -1},
        });
      }
    }
    return decals;
  },
});

export class ZebakPhases {
  constructor(random, walkable, emit) {
    this.random = random;
    this.walkable = walkable;
    this.emit = emit;
    this.next = random() < 0.5 ? "roar" : "waves";
    this.crossed = 0;
    this.queue = [];
    this.count = { roar: 0, waves: 0 };
    this.actors = new Map();
    this.acid = new Map();
    this.splashes = [];
    this.waveFronts = [];
    this.water = null;
    this.wavePush = null;
    this.droppedWalk = null;
    this.serial = 0;
    this.acidTicks = 0;
    this.active = null;
    this.enraged = false;
  }
  snapshot() {
    return {
      special: this.active?.kind ?? null,
      enraged: this.enraged,
      waveShove: this.waveShove ?? null,
      acid: Array.from(this.acid.values(), pool => pool.position),
      splashes: [...this.splashes],
      queued: [...this.queue],
    };
  }
  observe(boss) {
    if (this.enraged) return false;
    if (boss.vitals.hp * 4 < boss.vitals.maxHp) {
      this.enraged = true;
      this.queue = [];
      return true;
    }
    while (
      this.crossed < thresholds.length &&
      boss.vitals.hp * 100 <= boss.vitals.maxHp * thresholds[this.crossed]
    ) {
      this.queue.push(this.next);
      this.next = this.next === "roar" ? "waves" : "roar";
      this.crossed++;
    }
    return false;
  }
  land(p) {
    return this.walkable()?.has(key(p)) ?? false;
  }
  spawn(context, kind, model, position, hp = kind === "jug" ? 5 : 1) {
    const id = "zebak-" + kind + "-" + ++this.serial;
    const actor = {
      id,
      kind: "npc",
      role: "npc",
      npcTypeId: model,
      archetypeId: "zebak-" + kind,
      position: [...position],
      previousPosition: [...position],
      facing: 0,
      ...(kind === "cloud" ? {lockedFacing: 0} : {}),
      size: model === 11742 ? 2 : 1,
      alive: true,
      spawnTick: context.tick,
      blocksNpcMovement: false,
      history: new Map(),
      vitals: { hp, maxHp: hp },
      combat: {
        attackSpeed: 1,
        attackRange: 0,
        attackStyle: "typeless",
        nextActionTick: 0,
        targetId: null,
        lastAttackTick: null,
        animations: {
          idle:
            phaseModels.find((x) => x.npcTypeId === model)?.idleSeqId ?? null,
          walk: phaseModels.find(type => type.npcTypeId === model)?.walkSeqId ?? null,
          run: null,
          attack: null,
          death: null,
        },
      },
    };
    context.spawnNpc(actor);
    if (kind === "rock") this.setRockCollision?.(position, true);
    this.actors.set(id, { actor, kind });
    return this.actors.get(id);
  }
  remove(context, object) {
    if (object.kind === "rock")
      this.setRockCollision?.(object.actor.position, false);
    context.despawnNpc(object.actor.id);
    this.actors.delete(object.actor.id);
  }
  move(object, position) {
    object.destination = position;
  }
  movementFor(actor) {
    const object = this.actors.get(actor.id);
    if (!object?.destination) return [];
    const path = [object.destination];
    object.destination = null;
    return [{ npcId: actor.id, path }];
  }
  of(kind) {
    return [...this.actors.values()].filter((o) => o.kind === kind);
  }
  graphics(context, graphics, clipId, projectiles = []) {
    this.emit(context.tickEvents, {
      animations: clipId
        ? ["zebak", "zebak-tail"].map((actorId) => ({
            actorId,
            clipId,
            delayCycles: 0,
          }))
        : [],
      graphics,
      projectiles,
      ...(clipId === "roar" && this.active?.kind === "roar" ? {greatRoarStart: true} : {}),
    });
  }
  effect(id, position) {
    return {
      spotAnimId: id,
      target: tile([...position]),
      height: 0,
      delayCycles: 0,
    };
  }
  breakJug(context, jug, cause, origin = jug.actor.position) {
    const actor = jug.actor;
    jug.kind = "broken-jug";
    jug.breakCause = cause;
    jug.shatterTick = context.tick + 1;
    jug.destination = null;
    actor.position = [...origin];
    actor.previousPosition = [...origin];
    actor.movementPath = [];
    actor.isMoving = false;
    const damage = actor.vitals.hp;
    actor.vitals.hp = 0;
    actor.npcTypeId = 11735;
    actor.combat.animations.walk = null;
    actor.untargetable = true;
    actor.healthBarWhenUntargetable = true;
    context.tickEvents.emit({type: "hitsplat_spawned", targetId: actor.id, amount: damage, hitsplatType: "damage"});
  }
  splash(context, jug, settings) {
    const origin = jug.actor.position;
    const r = (settings.jugWidth - 1) / 2;
    const graphics = [this.effect(2192, origin), {...this.effect(2449, origin), delayCycles: 4}];
    const droplets = [];
    const tiles = [];
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const target = [origin[0] + dx, origin[1] + dy];
        this.acid.delete(key(target));
        if (this.land(target)) {
          tiles.push(target);
          graphics.push({...this.effect(95, target), delayCycles: 4 + 5 * distance(origin, target)});
        }
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        droplets.push({
          spotAnimId: 2193, sourcePosition: origin.map(v => v + 0.5),
          target: tile([origin[0] + dx, origin[1] + dy]),
          startDelayCycles: 4, endDelayCycles: 16, startOffset: 0,
          startHeight: 20, endHeight: 0, slope: 18,
        });
      }
    this.splashes.push({id: jug.actor.id, tick: context.tick, origin: [...origin], tiles});
    this.emit(context.tickEvents, {animations: [], graphics, projectiles: droplets, jugBreakCause: jug.breakCause});
    this.remove(context, jug);
  }
  splashIntoWater(context, jug, waterTile) {
    this.graphics(context, [this.effect(2449, waterTile)]);
    this.remove(context, jug);
  }
  scatter(p, width, targets) {
    const r = (width - 1) / 2;
    for (let x = -r; x <= r; x++)
      for (let y = -r; y <= r; y++) {
        const dest = [p[0] + x, p[1] + y];
        if ((x || y) && this.land(dest) && this.random() < 0.6)
          targets.set(key(dest), {from: p, to: dest});
      }
  }
  canBegin(tick) {
    return !this.enraged && (!this.active || (
      this.active.kind === "waves" && tick - this.active.start >= 39
    ));
  }
  begin(context, kind, settings) {
    if (!this.canBegin(context.tick)) return;
    const iteration = this.count[kind]++;
    this.active = {
      kind,
      start: context.tick,
      direction: iteration % 2 ? -1 : 1,
      secondRoar: kind === "roar" && iteration > 0,
    };
    const throws = specialDrops(kind, iteration, this.random, this.walkable());
    this.active.throws = throws;
    const boss = context.world.actors.get("zebak");
    const mouth = [boss.position[0] + boss.size - 0.5, boss.position[1] + boss.size / 2];
    this.graphics(
      context,
      [],
      "attack",
      throws.map(({ kind, position, spotAnimId }) => ({
        spotAnimId,
        sourcePosition: mouth,
        target: tile(position),
        startDelayCycles: specialThrow.release,
        endDelayCycles: (kind === "acid" ? specialThrow.acidLandingTick : specialThrow.solidLandingTick) * cyclesPerTick,
        slope: 24,
        startOffset: 0,
        startHeight: 160,
        endHeight: 0,
      })),
    );
  }
  landThrows(context, settings, age) {
    if (age === specialThrow.acidLandingTick) {
      const spread = new Map();
      const graphics = [];
      for (const {kind, position, spread: splatters} of this.active.throws) {
        if (kind !== "acid") continue;
        this.depositAcid(position);
        if (splatters) this.scatter(position, settings.acidWidth, spread);
        graphics.push(this.effect(1556, position));
      }
      this.active.acidSpread = [...spread.values()].map(({from, to}) => ({
        from, to, travelTicks: distance(from, to),
      }));
      this.graphics(context, graphics, null, this.active.acidSpread.map(({from, to, travelTicks}) => ({
        spotAnimId: 2194, sourcePosition: from.map(v => v + 0.5), target: tile(to),
        startDelayCycles: 0, endDelayCycles: travelTicks * cyclesPerTick, startOffset: 0,
        startHeight: 12, endHeight: 0, slope: 25,
      })));
    }
    if (age === specialThrow.solidLandingTick) {
      const graphics = [];
      for (const {kind, position} of this.active.throws) {
        if (kind === "rock") {
          this.spawn(context, "rock", 11737, position, 150);
          graphics.push(this.effect(2174, position));
        } else if (kind === "jug") this.spawn(context, "jug", 11735, position);
      }
      this.emit(context.tickEvents, {animations: [], projectiles: [], graphics, objectsLanded: true});
      this.active.throws = null;
    }
  }
  command(command, context) {
    const jug = this.actors.get(command.id);
    if (
      jug?.kind !== "jug" ||
      !["Push", "Pull", "Hit"].includes(command.action)
    )
      return null;
    const player = context.world.actors.get("player");
    if (!player?.alive || this.water) return null;
    if (command.action === "Hit" && jug.breakTick !== undefined) return {};
    player.attackTarget = command.id;
    // Keep the target for pathfinding. The jug action owns the gesture or weapon
    // launch once it comes into range, including the weapon's attack cooldown.
    player.attackInteractionActive = false;
    player.manualCastSpell = null;
    this.pendingJug = { id: command.id, action: command.action };
    return {};
  }
  stepJugs(context, settings, player) {
    for (const jug of this.of("broken-jug"))
      if (context.tick >= jug.shatterTick) this.splash(context, jug, settings);
    const action = this.pendingJug;
    if (action) {
      const jug = this.actors.get(action.id);
      if (!jug || player.attackTarget !== action.id) this.pendingJug = null;
      else if (
        !(action.action === "Hit" && context.getPlayerWeaponState?.().cooldown > 0) &&
        distance(player.position, jug.actor.position) <=
        (action.action === "Hit"
          ? (context.getPlayerWeaponState?.().range ?? 1)
          : 1)
      ) {
        this.pendingJug = null;
        if (player.attackTarget === action.id) {
          player.attackTarget = null;
          player.attackInteractionActive = false;
          player.manualCastSpell = null;
        }
        const [dx, dy] = jug.actor.position.map((v, i) => v - player.position[i]);
        if (dx || dy) player.facing = (Math.round(Math.atan2(-dx, -dy) * 1024 / Math.PI) + 2048) % 2048;
        if (action.action === "Hit") {
          const delay = context.attackObject(jug.actor);
          if (delay !== undefined) jug.breakTick = Math.min(jug.breakTick ?? Infinity, context.tick + delay);
        } else {
          context.tickEvents.emit({type: "player_jug_action", action: action.action, weaponId: player.equipment.weapon});
          const sign = action.action === "Push" ? 1 : -1;
          jug.step = jug.actor.position.map(
            (v, i) => sign * Math.sign(v - player.position[i]),
          );
          if (!jug.step.some(Boolean)) jug.step = null;
          else {
            jug.remaining = 6;
            jug.actor.npcTypeId = 11736;
            jug.actor.combat.animations.walk = 6;
          }
        }
      }
    }
    for (const jug of this.of("jug")) {
      if (context.tick >= jug.breakTick) {
        this.breakJug(context, jug, "weapon");
        continue;
      }
      if (!jug.step) continue;
      if (jug.remaining === 0) {
        jug.step = null;
        jug.actor.npcTypeId = 11735;
        jug.actor.combat.animations.walk = null;
        continue;
      }
      const dest = jug.actor.position.map((v, i) => v + jug.step[i]);
      if (this.of("rock").some(o => !distance(dest, o.actor.position)))
        this.breakJug(context, jug, "collision", dest);
      else if (!this.land(dest))
        this.splashIntoWater(context, jug, dest);
      else {
        this.move(jug, dest);
        jug.remaining--;
      }
    }
  }
  clouds(context, player) {
    for (const c of this.of("cloud")) {
      const [x, y] = c.actor.position;
      const size = c.actor.size;
      const offset = offsetFromFootprint([x, y], size, player.position);
      c.contactOrigin = [x, y];
      // The true tile starts moving three ticks after the cloud becomes visible.
      if (context.tick - c.actor.spawnTick < 3 || c.pendingTravelDamage >= c.actor.vitals.hp) continue;
      const touching = offset.every(v => Math.abs(v) <= 1);
      const dx = c.aggro ? (touching ? 0 : Math.sign(offset[0])) : Math.floor(this.random() * 3) - 1;
      const dy = c.aggro ? (touching ? 0 : Math.sign(offset[1])) : Math.floor(this.random() * 3) - 1;
      const step = [[x + dx, y + dy], [x + dx, y], [x, y + dy]]
        .find(position => distance(position, [x, y]) && this.land(position));
      if (step && !this.of("rock").some(r =>
        offsetFromFootprint(step, size, r.actor.position).every(v => v === 0)))
        this.move(c, step);
    }
  }
  resolveCloudContact(context, settings) {
    const player = context.world.actors.get("player");
    const boss = context.world.actors.get("zebak");
    const hits = [];
    if (!player?.alive || !boss?.alive) return hits;
    for (const c of this.of("cloud")) {
      if (!c.contactOrigin) continue;
      const {position, size, vitals} = c.actor;
      const steps = distance(c.contactOrigin, position);
      c.contactOrigin = null;
      const completedTravelDamage = c.pendingTravelDamage ?? 0;
      c.pendingTravelDamage = 2 * steps;
      if (completedTravelDamage > 0) {
        // Show the 2 when the cloud arrives, one tick after its true tile advances.
        const loss = Math.min(vitals.hp, completedTravelDamage);
        vitals.hp -= loss;
        context.tickEvents.emit({type: "hitsplat_spawned", targetId: c.actor.id, amount: loss, hitsplatType: "damage"});
        if (vitals.hp === 0) {
          this.remove(context, c);
          continue;
        }
      }
      if (c.pendingTravelDamage < vitals.hp && c.aggro &&
        offsetFromFootprint(position, size, player.position).every(v => Math.abs(v) <= 1)) {
        hits.push(hazard("Blood cloud", 2));
        vitals.hp = Math.min(vitals.maxHp, vitals.hp + 2);
        boss.vitals.hp = Math.min(
          boss.vitals.maxHp,
          boss.vitals.hp + (settings.spray ? 4 : 2),
        );
      }
    }
    return hits;
  }
  summonClouds(context, settings, player) {
    const south = this.random() < 0.5;
    // Uninterrupted travel in the game recording: the normal cloud takes
    // twelve 2s and a final 1. Thinned clouds take fifteen 2s each.
    const maxHp = settings.clouds ? 30 : 25;
    for (let i = 0; i < settings.cloudCount; i++) {
      const p = [29 + i, south ? 24 : 40],
        cloud = this.spawn(context, "cloud", settings.clouds ? 11743 : 11742, p, maxHp);
      cloud.aggro = distance(p, player.position) <= 15;
    }
  }
  depositAcid(position) {
    const id = key(position);
    if (!this.acid.has(id)) this.acid.set(id, {position, crestsRemaining: null});
  }
  washAcidRow(front) {
    for (let x = 22; x <= 38; x++) {
      if (x >= front.gap && x < front.gap + front.gapWidth) continue;
      const id = key([x, front.y]);
      const pool = this.acid.get(id);
      if (!pool) continue;
      // The recorded first crest clears some pools of either shape. The
      // one-to-three contact distribution is an estimate (see the wave audit).
      pool.crestsRemaining ??= 1 + Math.floor(this.random() * 3);
      if (--pool.crestsRemaining === 0) this.acid.delete(id);
    }
  }
  advanceWaveFronts(context, player = null, hits = []) {
    for (const front of this.waveFronts) {
      const offset = context.tick - front.startTick;
      if (offset > 24) {
        for (const wave of front.actors) this.remove(context, wave);
        continue;
      }
      // A crest strikes before it steps, so the tick after it spawned is its first.
      if (front.tick < context.tick) this.strikeWithCrest(context, front, player, hits);
      front.y = crestShore(front.direction) + front.direction * offset;
      if (front.tick !== context.tick) this.washAcidRow(front);
      front.tick = context.tick;
      for (const wave of front.actors) this.move(wave, [wave.actor.position[0], front.y]);
      for (const jug of this.of("jug")) {
        const [x, y] = jug.actor.position;
        if (y !== front.y || (x >= front.gap && x < front.gap + front.gapWidth)) continue;
        const dest = [x, y + front.direction];
        if (this.land(dest)) {
          this.move(jug, dest);
          this.acid.delete(key(dest));
        } else this.splashIntoWater(context, jug, dest);
      }
    }
    this.waveFronts = this.waveFronts.filter(front => front.tick === context.tick);
    return hits;
  }
  // OBS (rev 243 recording, 2026-11-25, ticks 1916-1929): a crest hits only a
  // player whose true tile it stands on when its turn comes, before it steps.
  // Three times the player stood a row ahead of a crest, ran two tiles through
  // it in the tick it stepped onto his row, and took nothing: the wave skip.
  // Running or walking past its row is safe, ending a tick on its tile is not.
  // OBS (18 recorded hits, as RSPSApp/tsps's Zebak notes give them): the hit
  // throws the player 3 tiles the way the crest runs, or, where fewer than 3
  // tiles of platform are left, off its edge into the water. WIKI: it deals 6-10.
  // inferred (tsps, no capture of a second hit): every crest that finds him on
  // its tile hits him again, so standing still in its path is hit after 3 ticks.
  strikeWithCrest(context, front, player, hits) {
    if (!player?.alive || this.water || this.wavePush) return;
    const [x, y] = player.position;
    if (y !== front.y || (x >= front.gap && x < front.gap + front.gapWidth)) return;
    const direction = front.direction;
    let to = [x, y], intoWater = false;
    for (let step = 1; step <= 3 && !intoWater; step++) {
      to = [x, y + direction * step];
      intoWater = !this.land(to);
    }
    hits.push(hazard("Tidal Wave", [6, 10]));
    this.wavePush = {tick: context.tick, to, direction, intoWater};
    this.waveShove = {tick: context.tick, from: [x, y], to: [...to], facing: player.facing};
  }
  // The engine moves the player after the NPCs: a crest's push replaces his own
  // step for that tick. In the water he wades instead, one tile a tick.
  moveWithTide(player, destination, place) {
    const push = this.wavePush;
    this.wavePush = null;
    if (push && player.alive) {
      if (push.intoWater) this.water = {direction: push.direction, entered: push.tick};
      // inferred (RSPSApp/tsps resets the movement queue on a throw): the walk he
      // had clicked is dropped with it. The engine keeps the clicked tile until he
      // clicks again (a new tile object) or takes a target; until then he stands.
      this.droppedWalk = destination ?? null;
      place(push.to, player.facing);
      return true;
    }
    if (this.droppedWalk && destination === this.droppedWalk && !player.attackTarget) {
      player.previousPosition = [...player.position];
      player.movementPath = [];
      player.isMoving = false;
      player.isRunning = false;
      return false;
    }
    this.droppedWalk = null;
    if (!this.water) return undefined;
    // The normal movement step is skipped in water. Reset last tick's carried
    // path so an idle player at the shore doesn't replay the shove each frame.
    player.previousPosition = [...player.position];
    player.movementPath = [];
    player.isMoving = false;
    player.isRunning = false;
    if (!destination || !distance(player.position, destination)) return false;
    const dir = this.water.direction,
      rampX = 30;
    const edge = (x) => {
      const ys = [...(this.walkable() ?? [])]
        .map((k) => k.split(",").map(Number))
        .filter((p) => p[0] === x)
        .map((p) => p[1]);
      return ys.length ? (dir > 0 ? Math.max(...ys) : Math.min(...ys)) : null;
    };
    const [x, y] = player.position;
    const targetX = Math.max(22, Math.min(38, destination[0]));
    const nextX = x + Math.sign(targetX - x),
      edgeY = edge(nextX);
    if (edgeY === null) return false;
    let next;
    if (x === rampX && targetX === rampX && (destination[1] - y) * dir <= 0) {
      next = [rampX, edgeY];
      if (distance(player.position, next) <= 1) this.water = null;
    } else next = [nextX, edgeY + dir];
    next = next.map(
      (v, i) => player.position[i] + Math.sign(v - player.position[i]),
    );
    if (!distance(player.position, next)) return false;
    place(next, player.facing);
    return true;
  }
  clearSpecial(context) {
    this.waveFronts = [];
    this.pendingJug = null;
    for (const obj of [...this.of("rock"), ...this.of("wave"), ...this.of("jug"), ...this.of("broken-jug")])
      this.remove(context, obj);
    this.active = null;
  }
  finish(context) {
    this.clearSpecial(context);
    for (const cloud of this.of("cloud")) this.remove(context, cloud);
    this.acid.clear();
    this.splashes.length = 0;
    this.water = null;
    this.waveShove = null;
    this.wavePush = null;
    this.droppedWalk = null;
    this.queue.length = 0;
  }
  step(context, settings, boss) {
    this.waveShove = null;
    if (this.splashes.length) this.splashes = this.splashes.filter(s => context.tick - s.tick < 3);
    const hits = [],
      player = context.world.actors.get("player");
    if (!player?.alive || !boss?.alive) return hits;
    if (this.observe(boss)) {
      this.clearSpecial(context);
      // The first enraged spit already plays its own growl. The Great Roar
      // sequence would override the opening of its jaw.
    }
    if (this.active?.throws) this.landThrows(context, settings, context.tick - this.active.start);
    if (this.active?.acidSpread?.length) {
      const elapsed = context.tick - this.active.start - specialThrow.acidLandingTick;
      this.active.acidSpread = this.active.acidSpread.filter(({to, travelTicks}) => {
        if (travelTicks > elapsed) return true;
        this.depositAcid(to);
        return false;
      });
    }
    this.stepJugs(context, settings, player);
    this.clouds(context, player);
    if (this.acid.has(key(player.position))) {
      this.acidTicks++;
      hits.push(
        hazard("Zebak acid", Math.min(24, this.acidTicks * 2), {
          applyPoison: 2,
        }),
      );
    } else this.acidTicks = 0;
    if (this.water && (context.tick - this.water.entered) % 4 === 0)
      hits.push(
        hazard("Crocodile bite", [8, 20], {
          attackType: "melee",
          prayerReduction: { type: "reduce", value: 0.6 },
        }),
      );
    this.advanceWaveFronts(context, player, hits);
    if (!this.active) return hits;
    const { kind, start, direction } = this.active,
      age = context.tick - start;
    if (kind === "roar") {
      const roarAge = age - roarWindupTick(settings.period, this.active.secondRoar);
      if (roarAge === 0) this.graphics(context, [], "roar");
      const rocks = this.of("rock");
      const sheltered = ([x, y]) => rocks.some(({actor}) => {
        const [rockX, rockY] = actor.position;
        return y === rockY && x > rockX && x <= rockX + 3;
      });
      if ([2, 4, 6].includes(roarAge)) {
        const dust = [];
        for (const key of this.walkable() ?? []) {
          const position = key.split(",").map(Number);
          if (sheltered(position) || rocks.some(({actor}) => !distance(position, actor.position))) continue;
          // Start at the boss-facing edge and sweep east across the platform.
          dust.push({...this.effect(2184, position), delayCycles: Math.max(0, position[0] - 22) * 2});
        }
        this.graphics(context, dust);
      }
      if ([3, 5, 7].includes(roarAge)) {
        if (!sheltered(player.position)) hits.push(hazard("Great Roar", 50));
        for (const jug of this.of("jug")) this.breakJug(context, jug, "roar");
        const debris = [];
        for (const {actor} of rocks) {
          const damage = Math.min(50, actor.vitals.hp);
          if (!damage) continue;
          actor.vitals.hp -= damage;
          context.tickEvents.emit({type: "hitsplat_spawned", targetId: actor.id, amount: damage, hitsplatType: "damage"});
          if (actor.vitals.hp === 0) debris.push(this.effect(2191, actor.position));
        }
        this.emit(context.tickEvents, {
          animations: [], projectiles: [], roarPulse: (roarAge - 3) / 2,
          graphics: debris,
        });
      }
      if (roarAge >= 9) this.clearSpecial(context);
    } else {
      // OSRS footage shows a new row every 4.2s. The longer surge sound
      // repeats after 6.6s and 7.8s, independently of the visible crests.
      const soundAge = age + (settings.path >= 2 ? 1 : 0);
      const shore = crestShore(direction);
      if (soundAge === 6) this.graphics(context, [], "tail");
      if (age === 7) {
        // Each boulder raises a fan of droplets when the first crest appears,
        // including boulders underneath the safe opening.
        const untilCrest = 7 * cyclesPerTick;
        const rocks = shoreRockColumns.map(x => ({
          ...this.effect(2195, [x, shore]),
          // In sequence 8450 the boulder's lowest vertex crosses the surface at cycle 204.
          delayCycles: untilCrest - 204,
        }));
        const splashes = rocks.map(rock => ({
          ...this.effect(68, rock.target.position),
          // Sequence 465 opens with ten cycles of flat water before the first droplets rise.
          delayCycles: untilCrest - 10,
        }));
        this.emit(context.tickEvents, {
          animations: [], projectiles: [], graphics: [...rocks, ...splashes],
          shoreSoundDelayCycles: settings.path >= 2 ? 0 : cyclesPerTick,
        });
      }
      if ([14, 25, 38].includes(soundAge))
        this.emit(context.tickEvents, {animations: [], graphics: [], projectiles: [], tidalSurgeSound: true});
      if ([14, 21, 28].includes(age)) {
        const gap = 24 + Math.floor(this.random() * 10);
        const front = {startTick: context.tick, direction, gap, gapWidth: settings.gap, actors: []};
        front.y = shore;
        front.tick = context.tick;
        for (let x = shoreRockColumns[0]; x <= shoreRockColumns.at(-1); x++) {
          if (x >= gap && x < gap + settings.gap) continue;
          const wave = this.spawn(context, "wave", 11738, [x, shore]);
          wave.actor.facing = direction > 0 ? 1024 : 0;
          front.actors.push(wave);
        }
        this.waveFronts.push(front);
      }
      if (age >= 53) this.clearSpecial(context);
    }
    return hits;
  }
}
