// Phosani's Nightmare's specials, and what outlasts them: her curse and the
// spores' drowsiness (encounter.js says when she uses them).
//
// Sources, as in encounter.js: WIKI the boss's page and its strategies page;
// tsps RSPSApp/tsps's reading of rsprox recordings of the game (docs/
// nightmare.md, server/plugins/bosses/data/nightmare.json and the units of
// server/plugins/bosses/nightmare/); OBS (runelogs) fourteen combat logs from
// runelogs.com (tiles, hitsplats, prayers and boosted levels a tick at a
// time, but no animations, graphics or messages).
import {
  bossSize, flowerCross, floorBounds, floorTiles, isFloor, isTotemTile, gapTo, chebyshev, key, same,
  spotAnims, surgeLanes, sporeLayouts, sounds,
} from "./ids.js";

// --- Grasping Claws --------------------------------------------------------
// tsps: the portals open with her animation, the claws come up 4 ticks later
// (WIKI: "after 3 ticks") and hit whoever stands on one, or under her (WIKI:
// "except the corners"), for 50 to 65 (WIKI, tsps). A player her husks hold
// gets none under him (WIKI). The pattern (tsps, "captured: about 40 a set
// (24-55), some 10 of them within two tiles of the player (826 sets)"): each
// tile within two of the player a portal 2 times in 5, any other tile of the
// floor 9 times in 100. OBS (Outside, five recordings of 2026-11-25 and 26,
// 142 sets, 27 to 54 portals, 39 on average): one under the player (where he
// stood as the tick began) in 138, the 4 others while her husks held him (2),
// while he stood under her (1), and once beside her; within two tiles of him
// 1,382 of 3,340 (41%), further out 4,081 of 44,088 (9%); no form, kind of set
// or her desperation stands apart (near 27% to 53%, far 8% to 10%, on small
// counts). None on her body but its four corners (34 of 34 portals that
// fell on her body). The logs of runelogs carry no graphics.
const clawHitTicks = 4; // tsps
const clawDamage = [50, 65]; // WIKI, tsps
const clawNear = 2; // tsps
const clawNearChance = 0.4; // tsps
const clawFarChance = 0.09; // tsps
// tsps: a run of claws, a set every 5 ticks: five with her flowers, six with
// her spores, without end in her desperation; her start animation (12 cycles
// late), one between, and her end animation 5 ticks after the last set. OBS
// (Outside, five recordings): the start (9102) with the first set and the
// run (9103) with the second, each once, 9103 held through the sets that
// follow; in her desperation no end. CACHE: 9102 is 4 ticks and loops its
// last 2 frames, 9103 4 ticks looping whole (frame step 24 of 24 frames).
// The scene plays an attack clip once, then her stand: here 9103 follows
// 9102's end at once (a tick before the game's, which holds 9102 meanwhile)
// and is played again every 4 ticks to the run's end, as its loop does.
const runEvery = 5;
const runStartDelayCycles = 12;
const runEndRoot = 5;
const runClipTicks = 4; // CACHE: 9102 and 9103, 120 cycles each
export const runCounts = { flowers: 5, spores: 6 };

// --- Corpse flowers --------------------------------------------------------
// tsps: she leaves; 2 ticks later she is back at the centre; 3 after that her
// segment animation, then from it: the flowers planted on 1, the message and
// their growth on 3, ready on 4, opening on 8, active 9 to 29, withered on 30.
// Her claws start 9 ticks after the segment animation.
const flowerBack = 2;
const flowerSegment = 3;
const flowerTimes = { planted: 1, message: 3, ready: 4, opening: 8, active: 9, end: 29 };
const flowerClawsAfter = 9;
const flyMax = 20; // tsps (a fly a tick from each berry line beside the player, 1 to 20)
const flowerQuadrants = { ne: ["north", "east"], nw: ["north", "west"], se: ["south", "east"], sw: ["south", "west"] };

// --- Spores ----------------------------------------------------------------
// tsps: the spores planted a tick after her animation in one of four layouts
// (ids.js), the message and their growth a tick later, armed on the fifth. From
// the sixth a player within a tile of one where he ended the last tick sets it
// off, and those left burst by themselves on the thirtieth, a player beside
// one infected too. Her claws start 6 ticks after her animation.
const sporeTimes = { planted: 1, message: 2, armed: 5, end: 30 };
const sporeClawsAfter = 6;
// Drowsy (tsps): 25 ticks; a yawn 2 ticks in and every 6 after; no running.
// WIKI: her attacks come 2 ticks slower, "doubled when using magic" (OBS
// (Outside): drowsy, the Eye of Ayak, a 3-tick staff, cast 7 ticks apart twice).
// Each yawn drains 5 + one per 20 of the prayer left: tsps's estimate from
// three yawns, which five yawns of one runelogs log bear out (OBS (runelogs):
// 8 to 2, 29 to 22, 21 to 15, 13 to 8 and 31 to 25, a point of the ordinary
// drain falling on the first two); the wiki's 6 a yawn would have left 7 of 13.
const drowsyTicks = 25;
const firstYawn = 2;
const yawnEvery = 6;
export const drowsyAttackDelay = 2; // WIKI, tsps
export const yawnDrain = (prayer) => 5 + Math.floor(prayer / 20); // tsps, OBS (runelogs)

// --- Curse -----------------------------------------------------------------
// tsps: her animation, the message 2 ticks later; it wears off 5 ticks after
// her fifth turn from then (specials count), or as the totems' blast lands.
// While it lasts what each protection stops is shuffled (tsps: "the prayer
// clicked is the one that turns on", 206 of 206 cursed hits): Protect from
// Magic stops missiles, Protect from Missiles melee, Protect from Melee magic.
const curseMessageTicks = 2;
const curseTurns = 5;
const curseEndTicks = 5;
export const curseStops = { magic: "range", range: "melee", melee: "magic" };

// --- Surge -----------------------------------------------------------------
// tsps, OBS (runelogs, 10 surges): she leaves; 2 ticks later she stands at one
// end of a lane (ids.js), facing along it; 4 later she crosses it in one tick,
// hurting whoever is in her way, about 85 at most (WIKI; tsps: "up to 60" the
// Nightmare's, 85 Phosani's), at least half of it (tsps).
const surgeJump = 2;
const surgeCross = 6;
const surgeMax = 85;
// Her shield broken before she stands at the lane's start, or on that tick, nulls the surge (OBS (Outside): Don Danz,
// 2026-11-26, tick 327: her leave; 329: his hit breaks her shield as she appears there in her weakened form, she walks
// at him from that tick and never crosses; her next attack 336, 9 ticks after her leave). Broken on the tick she
// crosses, she crosses (the same recording, tick 507). Broken while she waits at the start: no recording, so she
// crosses. Here a shield broken on the landing tick frees her from the next tick (the hit lands after her move).
const nulledSurgeAttack = 9;

export const messages = {
  flowers: { text: "The Nightmare splits the area into segments!", color: "#a53fff" },
  spores: { text: "The Nightmare summons some infectious spores!", color: "#a53fff" },
  infected: { text: "The Nightmare's spores have infected you, making you feel drowsy!", color: "#ff289d" },
  reinfected: { text: "The Nightmare's spores have reinfected you, making you feel drowsy!", color: "#ff289d" },
  tooDrowsy: "You're too drowsy to run!",
  worn: { text: "The Nightmare's infection has worn off.", color: "#229628" },
  cursed: { text: "The Nightmare has cursed you, shuffling your prayers!", color: "#a53fff" },
  uncursed: { text: "You feel the effects of the Nightmare's curse wear off.", color: "#229628" },
  surge: { text: "The Nightmare surges across the room, damaging you as she does!", color: "#ff3045" },
}; // tsps, as captured

export class Specials {
  constructor(encounter) {
    this.e = encounter;
  }
  reset() {
    this.clawSets = []; // { at, tiles: Set }
    this.run = null; // { left, count, next, again }
    this.flowers = null;
    this.spores = null;
    this.drowsy = null; // { until, nextYawn }
    this.curse = null; // { turns, endsAt }
    this.surge = null; // { from, to }
  }
  // Specials in progress keep her from starting another (tsps: her husks' trance, her flowers, a surge).
  blocking() {
    return this.flowers !== null || this.surge !== null;
  }

  // --- the claws -----------------------------------------------------------
  claws(context, clip = "claws", delayCycles = 0) {
    const e = this.e;
    const player = context.world.getPlayer();
    const held = e.minions.frozen ? key(player.position) : null;
    const mine = key(player.position);
    const boss = e.boss(context.world);
    const inner = (tile) => boss && gapTo(tile, boss.position) === 0 && !this.isBodyCorner(tile, boss.position);
    const tiles = floorTiles.filter((tile) => {
      if (isTotemTile(tile) || key(tile) === held || inner(tile)) return false; // OBS (Outside): none under her but her corners
      if (key(tile) === mine) return true; // OBS (Outside)
      return e.random() < (chebyshev(tile, player.position) <= clawNear ? clawNearChance : clawFarChance);
    });
    this.clawSets.push({ at: context.tick + clawHitTicks, tiles: new Set(tiles.map(key)) });
    // OBS (Outside, five recordings, 1,301 and more portals): every one at the floor's height (-1240), on the dark
    // floor as on the green. Drawn over the floor (onGround): its tiles and lines are objects of plane 2, which hid
    // the flat portal under them everywhere but on the green.
    e.visual(context, {
      animations: clip ? [{ clipId: clip, delayCycles }] : [],
      graphics: tiles.map((position) => ({ spotAnimId: spotAnims.claw, target: { kind: "tile", position: [...position] }, height: 0, delayCycles: 0, onGround: true })),
    });
  }
  // A run of `count` sets (Infinity: her desperation's).
  startRun(context, count) {
    if (this.run) return;
    this.run = { left: count, done: 0, next: context.tick };
    this.stepRun(context);
  }
  stepRun(context) {
    const run = this.run;
    if (!run || context.tick < run.next) return;
    const first = run.done === 0;
    this.claws(context, first ? "clawRunStart" : null, first ? runStartDelayCycles : 0);
    const epoch = this.e.epoch;
    if (first) {
      const loop = (ctx) => {
        if (this.e.epoch !== epoch || this.run !== run || ctx.tick >= (run.endAt ?? Infinity)) return;
        this.e.visual(ctx, { animations: [{ clipId: "clawRun", delayCycles: runStartDelayCycles }] });
        this.e.later(runClipTicks, loop);
      };
      this.e.later(runClipTicks, loop);
    }
    run.done++;
    run.left--;
    run.next = context.tick + runEvery;
    if (run.left > 0) return;
    // OBS (Outside): her end animation 5 ticks after the last set, her first step 5 after that (15 of 15).
    run.endAt = context.tick + runEvery;
    this.e.later(runEvery, (ctx) => {
      if (this.e.epoch !== epoch || this.run !== run) return;
      this.run = null;
      this.e.visual(ctx, { animations: [{ clipId: "clawRunEnd" }] });
      const boss = this.e.boss(ctx.world);
      if (boss) this.e.root(boss, ctx.tick, runEndRoot);
    });
  }
  // Who stands on a portal or under her (WIKI: but her corners) as the claws come up.
  clawHits(context) {
    const due = this.clawSets.filter((set) => set.at <= context.tick);
    if (due.length === 0) return;
    this.clawSets = this.clawSets.filter((set) => set.at > context.tick);
    const e = this.e;
    const player = context.world.getPlayer();
    const boss = e.boss(context.world);
    const under = boss && gapTo(player.position, boss.position) === 0 && !e.minions.frozen && !this.isBodyCorner(player.position, boss.position);
    for (const set of due) {
      e.sound(context, sounds.claws);
      if (!set.tiles.has(key(player.position)) && !under) continue;
      e.hurt({ baseDamage: clawDamage, attackType: "typeless", source: "Grasping Claws" });
    }
  }
  isBodyCorner([x, y], [bx, by]) {
    const edgeX = x === bx || x === bx + bossSize - 1;
    const edgeY = y === by || y === by + bossSize - 1;
    return edgeX && edgeY;
  }

  // --- the flowers ---------------------------------------------------------
  startFlowers(context) {
    const e = this.e;
    const safe = Object.keys(flowerQuadrants)[Math.floor(e.random() * 4)]; // inferred: any of the four
    const start = context.tick;
    const segmentAt = start + flowerBack + flowerSegment;
    this.flowers = { safe, safeArms: new Set(flowerQuadrants[safe]), stage: "leaving", start, segmentAt, activeFrom: segmentAt + flowerTimes.active, endAt: segmentAt + flowerTimes.end };
    e.leave(context);
    const epoch = e.epoch;
    const state = this.flowers;
    const live = () => e.epoch === epoch && this.flowers === state;
    e.later(flowerBack, (ctx) => live() && e.comeBack(ctx));
    e.later(flowerBack + flowerSegment, (ctx) => {
      if (!live()) return;
      state.stage = "segment";
      e.visual(ctx, { animations: [{ clipId: "flowers" }] });
      // OBS (Outside): still from it to her claws (no step sooner than 7 ticks in 8).
      const boss = e.boss(ctx.world);
      if (boss) e.root(boss, ctx.tick, flowerClawsAfter);
    });
    e.later(flowerBack + flowerSegment + flowerTimes.planted, () => live() && (state.stage = "planted"));
    e.later(flowerBack + flowerSegment + flowerTimes.message, (ctx) => live() && e.message(ctx, messages.flowers));
    e.later(flowerBack + flowerSegment + flowerTimes.ready, () => live() && (state.stage = "ready"));
    e.later(flowerBack + flowerSegment + flowerTimes.opening, (ctx) => {
      if (!live()) return;
      state.stage = "opening";
      e.sound(ctx, sounds.flowersOpen);
    });
    e.later(flowerBack + flowerSegment + flowerTimes.active, () => live() && (state.stage = "active"));
    e.later(flowerBack + flowerSegment + flowerClawsAfter, (ctx) => live() && this.startRun(ctx, runCounts.flowers));
    e.later(flowerBack + flowerSegment + flowerTimes.end, () => live() && (state.stage = "withering"));
    e.later(flowerBack + flowerSegment + flowerTimes.end + 1, () => live() && (this.flowers = null));
    // tsps: her next turn after the claws, 6 ticks after the last set.
    return flowerBack + flowerSegment + flowerClawsAfter + runEvery * runCounts.flowers + 6;
  }
  quadrantOf([x, y]) {
    const [cx, cy] = flowerCross;
    if (x === cx || y === cy) return null;
    return (y > cy ? "n" : "s") + (x > cx ? "e" : "w");
  }
  // The berry lines beside the quadrant a player stands in, while the flowers are open.
  berryArms(tile) {
    if (this.flowers?.stage !== "active") return [];
    const quadrant = this.quadrantOf(tile);
    return quadrant ? flowerQuadrants[quadrant].filter((arm) => !this.flowers.safeArms.has(arm)) : [];
  }
  // The flies: one from each berry line beside the player, every tick; she heals twice what they do (tsps).
  flies(context) {
    const player = context.world.getPlayer();
    const arms = this.berryArms(player.position);
    if (arms.length === 0) return;
    const e = this.e;
    for (const arm of arms) {
      const from = this.armTile(arm, player.position);
      const damage = 1 + Math.floor(e.random() * flyMax);
      e.visual(context, { projectiles: [{ spotAnimId: spotAnims.flies, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: e.playerTarget(player), startDelayCycles: 0, endDelayCycles: 30, slope: 0, startOffset: 12, startHeight: 0, endHeight: 0 }] });
      e.later(1, () => {
        e.hurt({ baseDamage: damage, attackType: "typeless", source: "Corpse flowers" });
        e.healShield(damage * 2);
      });
    }
  }
  // The tile of a line nearest the player, give or take two (tsps).
  armTile(arm, [px, py]) {
    const [cx, cy] = flowerCross;
    const shift = Math.floor(this.e.random() * 5) - 2;
    if (arm === "north" || arm === "south") {
      const y = arm === "north" ? Math.max(cy + 1, Math.min(floorBounds.maxY, py + shift)) : Math.min(cy - 1, Math.max(floorBounds.minY, py + shift));
      return [cx, y];
    }
    const x = arm === "east" ? Math.max(cx + 1, Math.min(floorBounds.maxX, px + shift)) : Math.min(cx - 1, Math.max(floorBounds.minX, px + shift));
    return [x, cy];
  }
  // The cross's tiles and whether each is a safe (white) one, for the scene.
  flowerTiles() {
    const flowers = this.flowers;
    if (!flowers || flowers.stage === "leaving" || flowers.stage === "segment") return [];
    const [cx, cy] = flowerCross;
    const tiles = [{ tile: [cx, cy], safe: true }];
    const arms = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };
    for (const [arm, [dx, dy]] of Object.entries(arms)) {
      for (let at = [cx + dx, cy + dy]; at[0] >= floorBounds.minX && at[0] <= floorBounds.maxX && at[1] >= floorBounds.minY && at[1] <= floorBounds.maxY; at = [at[0] + dx, at[1] + dy]) {
        if (isFloor(at)) tiles.push({ tile: [...at], safe: flowers.safeArms.has(arm) });
      }
    }
    return tiles;
  }

  // --- the spores ----------------------------------------------------------
  startSpores(context) {
    const e = this.e;
    const layout = sporeLayouts[Math.floor(e.random() * sporeLayouts.length)];
    const state = { tiles: [], start: context.tick, armed: false, planted: context.tick + sporeTimes.planted, layout };
    this.spores = state;
    const epoch = e.epoch;
    const live = () => e.epoch === epoch && this.spores === state;
    e.later(sporeTimes.planted, () => live() && (state.tiles = layout.map((tile) => [...tile])));
    e.later(sporeTimes.message, (ctx) => live() && e.message(ctx, messages.spores));
    e.later(sporeTimes.armed, () => live() && (state.armed = true));
    e.later(sporeClawsAfter, (ctx) => live() && e.stage !== "blast" && this.startRun(ctx, runCounts.spores));
    e.later(sporeTimes.end, (ctx) => {
      if (!live()) return;
      if (this.sporesNear(ctx.world.getPlayer().position).length > 0) this.makeDrowsy(ctx);
      this.burstAll(ctx);
    });
    return sporeClawsAfter + runEvery * runCounts.spores + 6; // tsps
  }
  sporesNear(tile) {
    return (this.spores?.tiles ?? []).filter((spore) => chebyshev(spore, tile) <= 1);
  }
  // At the start of a tick: the player where he ended the last (tsps).
  sporeCheck(context) {
    const state = this.spores;
    if (!state?.armed || context.tick <= state.start + sporeTimes.armed) return;
    const near = this.sporesNear(context.world.getPlayer().position);
    if (near.length === 0) return;
    this.makeDrowsy(context);
    for (const spore of near) this.burst(context, spore);
  }
  burst(context, spore) {
    const state = this.spores;
    if (!state) return;
    state.tiles = state.tiles.filter((tile) => !same(tile, spore));
    this.e.visual(context, { sounds: [{ id: sounds.sporeBurst, delayCycles: 12, range: 5, position: [...spore] }], graphics: [] });
    (state.bursting ??= []).push({ tile: [...spore], at: context.tick });
  }
  burstAll(context) {
    for (const tile of [...(this.spores?.tiles ?? [])]) this.burst(context, tile);
    this.spores = null;
  }
  makeDrowsy(context) {
    const e = this.e;
    const again = this.drowsy !== null;
    this.drowsy = { until: context.tick + drowsyTicks, nextYawn: context.tick + firstYawn };
    e.message(context, again ? messages.reinfected : messages.infected);
    const player = context.world.getPlayer();
    player.isRunEnabled = false; // tsps: run goes off with every infection
  }
  // Every tick while drowsy: no running, and the yawns.
  drowse(context) {
    const state = this.drowsy;
    if (!state) return;
    const player = context.world.getPlayer();
    if (player.isRunEnabled) {
      player.isRunEnabled = false;
      this.e.message(context, messages.tooDrowsy);
    }
    if (context.tick >= state.until) {
      this.drowsy = null;
      this.e.message(context, messages.worn);
      return;
    }
    if (context.tick < state.nextYawn) return;
    state.nextYawn = context.tick + yawnEvery;
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: "player" }, overheadText: "*yawn*", overheadCycle: 3 });
    const points = player.prayerState.points;
    const left = Math.max(0, points - yawnDrain(points));
    player.prayerState = { ...player.prayerState, points: left };
    if (points > 0 && left === 0) context.deactivateAllPrayers?.();
  }

  // --- the curse -----------------------------------------------------------
  startCurse(context) {
    const e = this.e;
    const epoch = e.epoch;
    e.visual(context, { animations: [{ clipId: "curse" }] });
    e.later(curseMessageTicks, (ctx) => {
      if (e.epoch !== epoch) return;
      e.message(ctx, messages.cursed);
      e.sound(ctx, sounds.cursed);
      this.curse = { turns: curseTurns, endsAt: null, since: ctx.tick };
    });
    return null;
  }
  // One of her turns: the fifth from the curse ends it 5 ticks later.
  turnTaken(context) {
    const curse = this.curse;
    if (!curse || curse.endsAt !== null || --curse.turns > 0) return;
    curse.endsAt = context.tick + curseEndTicks;
  }
  liftCurse(context) {
    if (!this.curse) return;
    this.curse = null;
    this.e.message(context, messages.uncursed);
    this.e.sound(context, sounds.curseEnds);
  }
  curseCheck(context) {
    if (this.curse?.endsAt !== null && this.curse?.endsAt <= context.tick) this.liftCurse(context);
  }
  // The protection that stops a style: shuffled while cursed.
  protectionFor(style) {
    if (!this.curse) return style;
    return Object.keys(curseStops).find((prayer) => curseStops[prayer] === style);
  }

  // --- the surge -----------------------------------------------------------
  startSurge(context) {
    const e = this.e;
    const lane = surgeLanes[Math.floor(e.random() * surgeLanes.length)];
    const [from, to] = e.random() < 0.5 ? lane : [lane[1], lane[0]];
    this.surge = { from, to, start: context.tick, landsAt: context.tick + surgeJump, nulled: false };
    e.leave(context);
    const epoch = e.epoch;
    const state = this.surge;
    const live = () => e.epoch === epoch && this.surge === state;
    e.later(surgeJump, (ctx) => {
      if (!live()) return;
      e.comeBack(ctx, from, to, state.nulled);
      if (state.nulled) this.surge = null;
    });
    e.later(surgeCross, (ctx) => {
      if (!live()) return;
      this.surge = null;
      e.crossTo(ctx, to);
      const player = ctx.world.getPlayer();
      const [px, py] = player.position;
      const minX = Math.min(from[0], to[0]);
      const maxX = Math.max(from[0], to[0]) + bossSize - 1;
      const minY = Math.min(from[1], to[1]);
      const maxY = Math.max(from[1], to[1]) + bossSize - 1;
      e.sound(ctx, sounds.surge);
      if (px < minX || px > maxX || py < minY || py > maxY) return;
      e.message(ctx, messages.surge);
      e.hurt({ baseDamage: [Math.ceil(surgeMax / 2), surgeMax], attackType: "typeless", source: "Surge" });
    });
    return surgeCross + 5; // tsps: her next attack 5 ticks after the surge (83 of 83)
  }
  // Her shield has failed: a surge she has not yet landed for is nulled.
  shieldFailed(context) {
    const surge = this.surge;
    if (!surge || context.tick > surge.landsAt) return;
    const e = this.e;
    surge.nulled = true;
    if (context.tick === surge.landsAt) {
      // Already at the lane's start: free from here.
      this.surge = null;
      e.away = false;
    }
    e.nextAttackAt = surge.start + nulledSurgeAttack;
    const boss = e.boss(context.world);
    if (boss) boss.combat.nextActionTick = e.nextAttackAt;
  }

  // Her blast, or her death: what is going on ends. The spores stay to the
  // blast form (tsps), the curse to the blast's landing.
  interrupt({ keepSpores = false, keepCurse = false } = {}) {
    this.clawSets = [];
    this.run = null;
    this.flowers = null;
    this.surge = null;
    if (!keepSpores) {
      this.spores = null;
      this.drowsy = null;
    }
    if (!keepCurse) this.curse = null;
  }
  snapshot(tick) {
    return {
      claws: this.clawSets.map((set) => ({ at: set.at, tiles: [...set.tiles].map((tile) => tile.split(",").map(Number)) })),
      clawRun: this.run ? { left: this.run.left, next: this.run.next } : null,
      flowers: this.flowers ? { safe: this.flowers.safe, stage: this.flowers.stage, tiles: this.flowerTiles(), endAt: this.flowers.endAt, activeFrom: this.flowers.activeFrom } : null,
      spores: this.spores ? { tiles: this.spores.tiles.map((tile) => [...tile]), armed: this.spores.armed, planted: tick >= this.spores.planted, start: this.spores.start, bursting: this.spores.bursting ?? [] } : null,
      drowsy: this.drowsy ? { until: this.drowsy.until } : null,
      cursed: this.curse !== null,
      surge: this.surge ? { from: [...this.surge.from], to: [...this.surge.to] } : null,
    };
  }
}
