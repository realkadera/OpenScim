// Burrowing, from delve 5 (OBS: 135 burrows in 20 recorded runs, delves 5
// to 8 and past; the wiki's "car phase" and TSPS's notes agree where they
// speak). Ticks are counted from the shield breaking (t0):
//
// - t0: he plays 12420 with 3375, and rocks fall: their shadows (2529, 20
//   cycles on) on 28 tiles at delve 5, 23 at 6-7, 16 at 8 (a few fewer when
//   they meet), one on his centre in 57 of 135, never on the ring around it.
//   They stand at t6.
// - t5: he burrows (14709). Burrowed, every hit lands and restarts a 20-tick
//   charge that fires the beam if it runs out (TSPS); no acid comes from him.
// - an eye (3416, 3415) marks where his centre will stop: from his centre,
//   the compass direction of the player's tile (one of eight), as far as the
//   player is plus four, short of the floor's edge (279 of 280 eyes). The
//   eyes come at t8 and t22 at delve 5; t8, t23 and t36 deeper (t24, t37 at
//   delve 6).
// - 3 ticks after the eye he zooms there, 4 tiles a tick (6 at delve 7, 8 at
//   8), breaking every rock under him (2699) and trampling a player in the
//   way (wiki: 10, 20, 30, 40 at delves 5-8); one left under him is pushed
//   out.
// - from delve 6 he throws an orb as he sets off, and one more 2 ticks later
//   half the time (a zoom that goes nowhere throws only that one): 121
//   recorded zooms that moved threw 1 or 2 alike, 125 that didn't, 0 or 1.
//   They fly from cycle 0 to 90 with a trail of their own.
// - from delve 6, 9 ticks after each eye, the car slam (slam, below, has
//   how rocks stop it).
// - he surfaces 9 ticks after the last eye (with the last slam), where he
//   is: he stays there. 5 ticks later he attacks, 6 ticks later volatile
//   earth comes up (19 of 19, 18 of 18, 43 of 43), into the shockwaves.
import { isArenaTileWalkable } from "../../engine/arena.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, spotAnims, floor, bossSize, carSlamDamage } from "./delves.js";

const key = ([x, y]) => x + "," + y;
const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const tileTarget = (position) => ({ kind: "tile", position: [...position] });
// On the floor: drawn over the terrain (onGround), or a shadow or a marker all but vanishes into it.
const graphic = (spotAnimId, position, delayCycles = 0, height = 0) => ({ spotAnimId, target: tileTarget(position), height, delayCycles, ...(height === 0 ? { onGround: true } : {}) });
const centreOf = (corner) => [corner[0] + (bossSize >> 1), corner[1] + (bossSize >> 1)];
const cornerOf = (centre) => [centre[0] - (bossSize >> 1), centre[1] - (bossSize >> 1)];
const covers = (corner, [x, y]) => x >= corner[0] && x < corner[0] + bossSize && y >= corner[1] && y < corner[1] + bossSize;
// The eight compass directions, east first, anticlockwise.
const compass = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

// The tiles from `from` to `to`, `to` included and `from` not (Bresenham).
export function lineTiles(from, to) {
  const tiles = [];
  let [x, y] = from;
  const dx = Math.abs(to[0] - x);
  const dy = Math.abs(to[1] - y);
  const sx = x < to[0] ? 1 : -1;
  const sy = y < to[1] ? 1 : -1;
  let error = dx - dy;
  while (x !== to[0] || y !== to[1]) {
    const twice = 2 * error;
    if (twice > -dy) {
      error -= dy;
      x += sx;
    }
    if (twice < dx) {
      error += dx;
      y += sy;
    }
    tiles.push([x, y]);
  }
  return tiles;
}

const breakAt = 5; // he burrows
const rocksStandAt = 6;
const zoomDelay = 3; // eye to setting off
const slamAfterEye = 9;
const surfaceAfterEye = 9;
const chargeTicks = 20; // TSPS: 600 cycles
const centreRockChance = 57 / 135;
const eyeTicks = (delve) => (delve === 5 ? [8, 22] : delve === 6 ? [8, 24, 37] : [8, 23, 36]);
// WIKI: the burrowed form (14709) is immune to freezes, 100%. A bind on him (the scorching bow's special) ends as he
// burrows, and one that lands while he's burrowed doesn't hold him: the engine keeps a bound NPC in place, which left
// him in the centre for the whole burrow (#145).
const unbind = (boss) => {
  if (boss.debuffs) {
    delete boss.debuffs.boundFromTick;
    delete boss.debuffs.boundUntilTick;
  }
};

export class Burrow {
  constructor(doom) {
    this.doom = doom;
  }
  reset() {
    this.active = null; // { at, burrowed, zoom, chargeFrom }
  }
  get burrowed() {
    return this.active?.burrowed === true;
  }
  // The demonic shield has broken (or fired): the rocks fall, he burrows.
  start(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    doom.phase = "burrow";
    this.active = { at: context.tick, burrowed: false, zoom: null, chargeFrom: null };
    doom.animate(context, "shieldBreak", [{ spotAnimId: spotAnims.shieldBreak, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }]);
    const tiles = this.fallingRockTiles(boss, context.world.getPlayer().position);
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: tiles.map((tile) => graphic(spotAnims.fallingRock, tile, 20)) });
    doom.later(rocksStandAt, () => tiles.forEach((tile) => doom.rocks.place(tile)));
    doom.later(breakAt, (ctx) => this.burrow(ctx));
    const eyes = eyeTicks(doom.rules.delve).slice(0, doom.rules.zooms);
    for (const at of eyes) {
      doom.later(at, (ctx) => this.eye(ctx));
      if (doom.rules.carSlams) doom.later(at + slamAfterEye, (ctx) => this.slam(ctx));
    }
    doom.later(eyes[eyes.length - 1] + surfaceAfterEye, (ctx) => this.surface(ctx));
  }
  fallingRockTiles(boss, playerTile) {
    const doom = this.doom;
    const centre = centreOf(boss.position);
    const tiles = new Map();
    if (doom.random() < centreRockChance) tiles.set(key(centre), centre);
    for (let attempt = 0; attempt < doom.rules.fallingRocks * 4 && tiles.size < doom.rules.fallingRocks; attempt++) {
      const tile = [doom.randomInt(floor.minX, floor.maxX), doom.randomInt(floor.minY, floor.maxY)];
      if (chebyshev(tile, centre) === 1 || !isArenaTileWalkable(...tile) || doom.rocks.has(tile) || key(tile) === key(playerTile)) continue;
      tiles.set(key(tile), tile);
    }
    return [...tiles.values()];
  }
  burrow(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    if (!boss?.alive || !this.active) return;
    this.active.burrowed = true;
    this.active.chargeFrom = context.tick;
    boss.npcTypeId = npcTypeIds.burrowed;
    unbind(boss);
    doom.setChargeAccuracy(boss, true);
  }
  // A hit on him restarts the charge.
  hit() {
    if (this.burrowed) this.active.chargeFrom = this.doom.now;
  }
  // His turn while burrowed: the glow, the charge, and the orbs of a zoom.
  turn(boss, context) {
    const active = this.active;
    if (!active?.burrowed) return;
    const zoom = active.zoom;
    if (zoom && context.tick === zoom.arrivedAt) this.pushOut(boss, context);
    if (zoom?.orbs.includes(context.tick)) this.throwOrb(boss, context, zoom.orbs.indexOf(context.tick) > 0);
    if (context.tick >= active.chargeFrom + chargeTicks) {
      active.chargeFrom = context.tick;
      this.doom.fireBeam(boss, context);
    } else if (active.chargeFrom !== context.tick) {
      emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [{ spotAnimId: spotAnims.burrowGlow, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }] });
    }
  }
  // The eye: where his centre will stop.
  eye(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    if (!boss?.alive || !this.burrowed) return;
    const from = centreOf(boss.position);
    const to = this.destination(from, context.world.getPlayer().position);
    emitInfernoVisual(context.tickEvents, { animations: [], projectiles: [], graphics: [graphic(spotAnims.eye, to), graphic(spotAnims.eyeLinger, to, 60)] });
    const setsOff = context.tick + zoomDelay;
    const moves = key(to) !== key(from);
    const orbs = doom.rules.carSlams ? [...(moves ? [setsOff] : []), ...(doom.random() < 0.5 ? [setsOff + 2] : [])] : [];
    this.active.zoom = { to: cornerOf(to), setsOff, arrivedAt: moves ? null : setsOff, trampled: false, orbs };
  }
  destination(centre, playerTile) {
    const dx = playerTile[0] - centre[0];
    const dy = playerTile[1] - centre[1];
    if (dx === 0 && dy === 0) return centre;
    const [ux, uy] = compass[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
    let at = centre;
    for (let step = Math.max(Math.abs(dx), Math.abs(dy)) + 4; step > 0; step--) {
      const next = [at[0] + ux, at[1] + uy];
      if (!this.fits(cornerOf(next))) break;
      at = next;
    }
    return at;
  }
  // His 5x5 on the room's floor.
  fits(corner) {
    for (let dx = 0; dx < bossSize; dx++) for (let dy = 0; dy < bossSize; dy++) if (!isArenaTileWalkable(corner[0] + dx, corner[1] + dy)) return false;
    return true;
  }
  // The boss's movement hook: a zoom's tiles for this tick.
  move(boss, context) {
    if (this.burrowed) unbind(boss);
    const zoom = this.active?.zoom;
    if (!this.burrowed || !zoom || zoom.arrivedAt !== null || context.tick < zoom.setsOff) return [];
    const path = [];
    let at = boss.position;
    for (let step = 0; step < this.doom.rules.zoomSpeed && key(at) !== key(zoom.to); step++) {
      at = [at[0] + Math.sign(zoom.to[0] - at[0]), at[1] + Math.sign(zoom.to[1] - at[1])];
      path.push(at);
    }
    if (key(at) === key(zoom.to)) zoom.arrivedAt = context.tick;
    const player = context.world.getPlayer();
    const crumbled = [];
    for (const corner of path) {
      for (const tile of this.doom.rocks.standing) if (covers(corner, tile.split(",").map(Number))) crumbled.push(tile);
      if (!zoom.trampled && covers(corner, player.position)) {
        zoom.trampled = true;
        this.doom.pendingDamages.push({ baseDamage: this.doom.rules.trampleDamage, attackType: "typeless", source: "Doom of Mokhaiotl", playerPosition: [...player.position] });
      }
    }
    for (const tile of new Set(crumbled)) this.doom.rocks.crumble(tile.split(",").map(Number), context);
    this.doom.animate(context, "burrowMove", [{ spotAnimId: spotAnims.burrowMove, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }]);
    return [{ npcId: boss.id, path }];
  }
  // Wiki: a player he stops on is shoved out of the way.
  pushOut(boss, context) {
    const player = context.world.getPlayer();
    if (!covers(boss.position, player.position)) return;
    const aside = [];
    for (let x = boss.position[0] - 1; x <= boss.position[0] + bossSize; x++)
      for (let y = boss.position[1] - 1; y <= boss.position[1] + bossSize; y++) {
        const tile = [x, y];
        if (!covers(boss.position, tile) && isArenaTileWalkable(x, y) && !this.doom.rocks.has(tile)) aside.push(tile);
      }
    aside.sort((a, b) => chebyshev(a, player.position) - chebyshev(b, player.position));
    if (aside.length) context.teleportPlayer(aside[0]);
  }
  throwOrb(boss, context, attacking) {
    const doom = this.doom;
    const player = context.world.getPlayer();
    if (!player.alive) return;
    const style = doom.rules.orbStyles[doom.randomInt(0, doom.rules.orbStyles.length - 1)];
    const end = 90;
    context.queueNpcHit(doom.rollOrb(boss, player, style, { impactDelayTicks: end / 30 }));
    doom.orbImpact(style, end / 30);
    const centre = centreOf(boss.position);
    const flight = (spotAnimId) => ({
      spotAnimId, sourcePosition: [centre[0] + 0.5, centre[1] + 0.5], target: buildActorVisualTarget(player),
      startDelayCycles: 0, endDelayCycles: end, slope: 30, startOffset: 0, startHeight: 200, endHeight: 100,
    });
    const projectiles = [flight(spotAnims.orb[style]), flight(spotAnims.burrowOrbTrail[style])];
    if (attacking) doom.animate(context, "burrowAttack", [{ spotAnimId: spotAnims.burrowAttack, target: buildActorVisualTarget(boss), height: 0, delayCycles: 120 }], projectiles);
    else emitInfernoVisual(context.tickEvents, { animations: [], projectiles, graphics: [] });
  }
  // The car slam (delve 6+). A rock under his centre takes it alone
  // ("rockblock", wiki). Otherwise every rock within 15 tiles that no other
  // rock shelters crumbles, and the player is hit unless a rock stands
  // between them and his centre (OBS: in 149 of the 168 recorded slams a rock
  // stood on that line; none hit the player).
  slam(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    if (!boss?.alive || !this.burrowed) return;
    const centre = centreOf(boss.position);
    if (doom.rocks.has(centre)) return doom.rocks.crumble(centre, context);
    const standing = [...doom.rocks.standing].map((tile) => tile.split(",").map(Number));
    const shelters = (tile) => lineTiles(centre, tile).slice(0, -1).some((on) => doom.rocks.has(on));
    const player = context.world.getPlayer();
    const playerSheltered = shelters(player.position);
    doom.shockwave.floorSlam(context, centre, 15);
    // Which rocks go is settled before any does: a rock that crumbles still
    // shelters the ones behind it from this slam (wiki: "excluding rocks that
    // were protected by another rock").
    const crumbling = standing.filter((tile) => chebyshev(tile, centre) <= 15 && !shelters(tile));
    for (const tile of crumbling) doom.rocks.crumble(tile, context);
    if (!playerSheltered && player.alive) {
      doom.pendingDamages.push({ baseDamage: carSlamDamage, attackType: "typeless", source: "Car slam", playerPosition: [...player.position] });
    }
  }
  // He comes up where he is.
  surface(context) {
    const doom = this.doom;
    const boss = doom.boss(context.world);
    this.active = null;
    if (!boss?.alive) return;
    boss.npcTypeId = npcTypeIds.doom;
    doom.setChargeAccuracy(boss, false);
    doom.surfaced(boss, context);
  }
}
