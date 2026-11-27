// Nex's specials, two a phase, one after every five of her attacks (OBS: in
// all seven kills a special came after five attacks, her jumps not counted;
// the two of a phase take turns). Which comes first: her virus in her smoke
// phase (7 of 7), either of the two in the others (OBS: shadow 5 darkness, 2
// shadows; ice 5 containment, 2 prison).
//
// Smoke: her virus (Choke) and her smoke dash, her drag with her magic.
// Shadow: her darkness and her shadows (Shadow Smash).
// Blood: her siphon (with her reavers, minions.js) and her blood sacrifice.
// Ice: her containment and her ice prison.
// Zaros: none; her curses (encounter.js) and her wrath as she dies.
//
// Every number here names its source: OBS the recordings (ids.js), WIKI the
// strategy guide (Nex/Strategies, read 2026-11-26), or inferred.
import { buildActorVisualTarget, faceActorToward } from "../shared/npcHelpers.js";
import { isArenaTileWalkable } from "../../engine/arena.js";
import { spotAnims, sounds, aisles, gapTo, chebyshev, middleOf, bossSize, key, inChamber, heights, colors } from "./ids.js";

// What comes after a special before her next attack (OBS: the ticks from the special to her next animation).
export const holdAfter = { choke: 4, dash: 12, darkness: 4, smash: 8, siphon: 10, sacrifice: 7, containment: 7, prison: 8 };
// The specials of each phase, in the order they take turns.
export const phaseSpecials = {
  smoke: ["choke", "dash"],
  shadow: ["darkness", "smash"],
  blood: ["siphon", "sacrifice"],
  ice: ["containment", "prison"],
  zaros: [],
};

// Smoke.
const virus = {
  catches: 1, // OBS (27th): "You become surrounded by smoke clouds!" a tick after her words (25 of 25)
  ticks: 15, // OBS (27th): "The smoke clouds around you dissipate." 15 ticks later (23 of 25 caught once; no mask)
  coughEvery: 3, // OBS (27th): "*Cough*" 1, 4, 7, 10 and 13 ticks after it caught (22 of 23)
  drain: 2, // WIKI: 2 prayer a cough
  masked: 0.5, // WIKI: a gas mask, facemask or slayer helmet halves it
};
const dash = { strikes: 5, hits: 8, maxHit: 50 }; // OBS: at the aisle's end 5 ticks after "There is...", hits 3 later; WIKI: up to 50
const drag = { chance: 1 / 4, prayingChance: 1 / 8, reach: 6, stunTicks: 2 }; // WIKI (ref. 5); stun inferred
// Shadow.
// OBS (27th): "Darkness begins to surround Nex." with her words, "The darkness recedes." 31 ticks later (64 of 64 not cut
// short by her phase's end). Beside her (WIKI: "constant damage"; "10-15 seconds" away from her to clear it): after 8
// ticks there, "The darkness starts to engulf you!", then 10 to 12 a tick while one stays (3 recorders' engulfings).
const darkness = { ticks: 31, engulfs: 8, minHit: 10, maxHit: 12, reach: 1 };
const shadows = { strikes: 4, maxHit: 50, spentTicks: 9 }; // OBS: they strike 4 ticks after "Fear the shadow!", gone 9 after; WIKI: up to 50
// Blood.
const siphon = { kneel: 8 }; // WIKI: "kneels for about 8 ticks" (OBS: her next attack 10 after)
// OBS (27th): the mark with her words, its end 6 ticks later (33 of 33): escaped from 7 tiles off her; the hits 3 after.
const sacrifice = { resolves: 6, lands: 3, reach: 7, maxHit: 50, keep: 1 / 3, others: 12, prayerShare: 1 / 3, afterUnleash: 4 }; // OBS: 6 ticks to "Nex unleashes a blood sacrifice!", 2 to the hits; WIKI: the rest
// Ice.
const containment = { strikes: 5, maxHit: 60, lasts: 4 }; // OBS: the icicles 5 ticks after "Contain this!"; WIKI: up to 60; lasts inferred
// OBS: its stalagmites 2 ticks after; WIKI: "4 seconds", up to 75. OBS (27th): "The ice prison shatters and pierces your
// flesh!" 8 ticks after "You've been trapped in an ice prison!" (2 of 2; 25 others broken out sooner).
const prison = { locks: 2, shatters: 8, maxHit: 75 };
// Zaros.
const wrath = { strikes: 4, maxHit: 50 }; // OBS: her wrath's graphics 4 ticks after her last hitsplat; WIKI: up to 50 in 5 x 5

export class Specials {
  constructor(encounter) {
    this.encounter = encounter;
    this.reset();
  }
  reset() {
    this.infected = new Map(); // member id -> { until, next }
    this.dashing = null; // { aisle, strikeAt, from }
    this.shadowTiles = []; // { tile, strikeAt }
    this.spent = []; // { tile, until }
    this.darkness = null; // { until }
    this.exposure = new Map();
    this.kneeling = false;
    this.kneelUntil = 0;
    this.sacrificeTarget = null;
    this.sacrificeAt = 0;
    this.icicles = null; // { tiles, until, strikeAt, position }
    this.prisoned = null; // { memberId, tile, locksAt, shattersAt, stalagmites: [ids] }
    this.wrathTiles = null;
    this.stalagmiteSerial = 0;
  }
  get party() {
    return this.encounter.party;
  }

  // --- smoke --------------------------------------------------------------
  // WIKI: "targets the furthest player with the lowest magic defence bonus".
  choke(context, boss) {
    const encounter = this.encounter;
    const world = context.world;
    const ranked = this.party.living(world).map((member) => ({
      member, gap: gapTo(this.party.tile(member, world), boss.position), magic: this.party.magicDefence(member, world),
    })).sort((a, b) => b.gap - a.gap || a.magic - b.magic);
    encounter.say(context, "Let the virus flow through you!");
    encounter.visual(context, {
      animations: [{ clipId: "cast" }],
      graphics: [{ spotAnimId: spotAnims.virus, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }],
      sounds: [{ id: sounds.virus }],
    });
    const victim = ranked[0]?.member;
    if (victim) encounter.later(virus.catches, (ctx) => {
      if (this.encounter.stage === "fight" && this.party.alive(victim, ctx.world)) this.infect(victim, ctx);
    });
  }
  // OBS (27th): the game's words to the one who catches it, and to the one who spread it.
  infect(member, context, from = null) {
    if (this.infected.has(member.id)) return;
    const masked = this.party.wearsVirusMask(member, context.world);
    const ticks = Math.round(virus.ticks * (masked ? virus.masked : 1));
    this.infected.set(member.id, { until: context.tick + ticks, next: context.tick + 1 });
    if (this.party.isLocal(member)) this.encounter.message(context, { text: from ? "Someone has spread some smoke clouds to you!" : "You become surrounded by smoke clouds!", color: colors.purple });
    if (from && this.party.isLocal(from)) this.encounter.message(context, { text: "You have spread the smoke clouds to someone else!", color: colors.purple });
  }
  // Every tick: the coughs, and the virus spreading to whoever stands beside a cough (WIKI: "spreads to adjacent players").
  coughs(context) {
    const now = context.tick;
    for (const [id, infection] of [...this.infected]) {
      const member = this.party.member(id);
      if (!member || !this.party.alive(member, context.world)) {
        this.infected.delete(id);
        continue;
      }
      if (now >= infection.until) {
        this.infected.delete(id);
        if (this.party.isLocal(member)) this.encounter.message(context, { text: "The smoke clouds around you dissipate.", color: colors.green }); // OBS
        continue;
      }
      if (now < infection.next) continue;
      infection.next = now + virus.coughEvery;
      context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: member.id }, overheadText: "*Cough*", overheadCycle: 2 });
      this.encounter.visual(context, { sounds: [{ id: sounds.cough }] });
      this.party.drainPrayer(member, virus.drain, context.world);
      const here = this.party.tile(member, context.world);
      for (const other of this.party.living(context.world)) {
        if (other.id === id || this.infected.has(other.id)) continue;
        if (chebyshev(this.party.tile(other, context.world), here) <= 1) this.infect(other, context, member);
      }
    }
  }
  isInfected(memberId) {
    return this.infected.has(memberId);
  }
  // "There is..." then "NO ESCAPE!": down the aisle where most of the party stands (inferred: OBS 9 dashes, each down
  // an aisle with a player in it), the far end in a tick.
  smokeDash(context, boss) {
    const encounter = this.encounter;
    const world = context.world;
    const counts = Object.keys(aisles).map((name) => ({ name, count: this.party.living(world).filter((member) => this.inAisle(name, boss.position, this.party.tile(member, world))).length }));
    const most = Math.max(...counts.map((entry) => entry.count));
    const choices = counts.filter((entry) => entry.count === most);
    const aisle = choices[Math.floor(encounter.random() * choices.length)].name;
    const end = aisles[aisle].end;
    faceActorToward(boss, { position: end, size: bossSize });
    encounter.say(context, "There is...");
    encounter.visual(context, { animations: [{ clipId: "dash" }] });
    this.dashing = { aisle, from: [...boss.position], strikeAt: context.tick + dash.strikes };
    encounter.later(dash.strikes, (ctx) => this.dashStrike(ctx));
  }
  // The tiles of an aisle: from her body to its far end, as wide as she is.
  aisleBox(name, from) {
    const end = aisles[name].end;
    return {
      minX: Math.min(from[0], end[0]), maxX: Math.max(from[0], end[0]) + bossSize - 1,
      minY: Math.min(from[1], end[1]), maxY: Math.max(from[1], end[1]) + bossSize - 1,
    };
  }
  inAisle(name, from, [x, y]) {
    const box = this.aisleBox(name, from);
    return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY && gapTo([x, y], from) > 0;
  }
  dashStrike(context) {
    const encounter = this.encounter;
    const boss = encounter.boss(context.world);
    const dashing = this.dashing;
    if (!boss?.alive || !dashing || encounter.stage !== "fight") return;
    encounter.say(context, "NO ESCAPE!");
    encounter.visual(context, { sounds: [{ id: sounds.dash }] });
    const struck = this.party.living(context.world).filter((member) => this.inAisle(dashing.aisle, dashing.from, this.party.tile(member, context.world)));
    // OBS: she is at the far end for the tick, and back where she was the next.
    boss.previousPosition = [...boss.position];
    boss.position = [...aisles[dashing.aisle].end];
    encounter.later(1, (ctx) => {
      const her = encounter.boss(ctx.world);
      if (!her?.alive) return;
      her.previousPosition = [...her.position];
      her.position = [...dashing.from];
      this.dashing = null;
    });
    // OBS (27th): "Nex dashes into you and knocks you out of the way!" 1 or 2 ticks after "NO ESCAPE!", and whoever was
    // in her path is beside it, off the aisle (4 of 4); the hit 2 ticks after that.
    encounter.later(1, (ctx) => {
      for (const member of struck) {
        if (!this.party.alive(member, ctx.world)) continue;
        const aside = this.besideAisle(dashing, this.party.tile(member, ctx.world));
        if (aside) this.party.moveTo(member, aside, ctx);
        if (this.party.isLocal(member)) encounter.message(ctx, { text: "Nex dashes into you and knocks you out of the way!", color: colors.magenta });
      }
    });
    encounter.later(dash.hits - dash.strikes, (ctx) => {
      for (const member of struck) this.party.hurt(member, { damage: encounter.randomInt(0, dash.maxHit), style: "typeless", source: "Smoke Dash" }, ctx);
    });
  }
  // The nearest free tile beside an aisle, across it from where one stood in it.
  besideAisle(dashing, tile) {
    const box = this.aisleBox(dashing.aisle, dashing.from);
    const across = aisles[dashing.aisle].step[0] === 0 ? [[box.minX - 1, tile[1]], [box.maxX + 1, tile[1]]] : [[tile[0], box.minY - 1], [tile[0], box.maxY + 1]];
    return across.filter((spot) => this.walkable(spot)).sort((a, b) => chebyshev(a, tile) - chebyshev(b, tile))[0] ?? null;
  }
  // WIKI (ref. 5): with her smoke magic, a player within 6 tiles is dragged to her, stunned, his protection off: 1 in 4,
  // 1 in 8 when he prays against magic.
  maybeDrag(context, boss) {
    const encounter = this.encounter;
    const world = context.world;
    const near = this.party.living(world).filter((member) => gapTo(this.party.tile(member, world), boss.position) <= drag.reach && gapTo(this.party.tile(member, world), boss.position) > 1);
    if (near.length === 0) return;
    const member = near[Math.floor(encounter.random() * near.length)];
    const chance = this.party.protection(member, world) === "magic" ? drag.prayingChance : drag.chance;
    if (encounter.random() >= chance) return;
    const tile = this.besideHer(boss, this.party.tile(member, world));
    if (!tile) return;
    this.party.moveTo(member, tile, context);
    this.party.disableProtection(member, context, context.tick + drag.stunTicks);
    this.party.freeze(member, drag.stunTicks, context.tick, { ignoreGap: true });
    // OBS (27th): the game says nothing of a drag (no such message in 22 recordings).
  }
  besideHer(boss, from) {
    let best = null;
    for (const tile of this.ring(boss.position, 1)) {
      if (!this.walkable(tile)) continue;
      if (!best || chebyshev(tile, from) < chebyshev(best, from)) best = tile;
    }
    return best;
  }

  // --- shadow -------------------------------------------------------------
  startDarkness(context, boss) {
    const encounter = this.encounter;
    encounter.say(context, "Embrace darkness!");
    encounter.visual(context, { animations: [{ clipId: "darkness" }], sounds: [{ id: sounds.darkness }] });
    encounter.message(context, { text: "Darkness begins to surround Nex.", color: colors.magenta });
    this.darkness = { until: context.tick + darkness.ticks };
    this.exposure.clear();
  }
  // Every tick of her darkness: beside her too long, it engulfs (`darkness`).
  darknessTick(context) {
    if (!this.darkness) return;
    if (context.tick >= this.darkness.until) {
      this.darkness = null;
      this.encounter.message(context, { text: "The darkness recedes.", color: colors.green });
      return;
    }
    const boss = this.encounter.boss(context.world);
    if (!boss) return;
    for (const member of this.party.living(context.world)) {
      const close = gapTo(this.party.tile(member, context.world), boss.position) <= darkness.reach;
      const ticks = close ? (this.exposure.get(member.id) ?? 0) + 1 : 0;
      this.exposure.set(member.id, ticks);
      if (ticks === darkness.engulfs && this.party.isLocal(member)) this.encounter.message(context, { text: "The darkness starts to engulf you!", color: colors.magenta });
      if (ticks > darkness.engulfs) {
        this.party.hurt(member, { damage: this.encounter.randomInt(darkness.minHit, darkness.maxHit), style: "typeless", source: "Embrace Darkness" }, context);
      }
    }
  }
  // "Fear the shadow!": a shadow under everyone; 4 ticks later it strikes whoever is on one (OBS).
  smash(context) {
    const encounter = this.encounter;
    encounter.say(context, "Fear the shadow!");
    encounter.visual(context, { animations: [{ clipId: "smash" }], sounds: [{ id: sounds.smash, delayCycles: 30 }, { id: sounds.smashSecond, delayCycles: 30 }] });
    const strikeAt = context.tick + shadows.strikes;
    const tiles = new Map();
    for (const member of this.party.living(context.world)) {
      const tile = this.party.tile(member, context.world);
      tiles.set(key(tile), [...tile]);
    }
    for (const tile of tiles.values()) this.shadowTiles.push({ tile, strikeAt });
    encounter.later(shadows.strikes, (ctx) => this.shadowStrike(ctx, strikeAt));
  }
  shadowStrike(context, strikeAt) {
    const encounter = this.encounter;
    const striking = this.shadowTiles.filter((shadow) => shadow.strikeAt === strikeAt);
    this.shadowTiles = this.shadowTiles.filter((shadow) => shadow.strikeAt !== strikeAt);
    if (encounter.stage === "dead") return;
    const tiles = new Set(striking.map((shadow) => key(shadow.tile)));
    encounter.visual(context, { graphics: striking.map((shadow) => ({ spotAnimId: spotAnims.shadowBurst, target: { kind: "tile", position: [...shadow.tile] }, height: 0, delayCycles: 0 })) });
    for (const shadow of striking) this.spent.push({ tile: shadow.tile, until: context.tick + shadows.spentTicks });
    for (const member of this.party.living(context.world)) {
      if (tiles.has(key(this.party.tile(member, context.world)))) {
        this.party.hurt(member, { damage: encounter.randomInt(0, shadows.maxHit), style: "typeless", source: "Shadow Smash" }, context);
        if (this.party.isLocal(member)) encounter.message(context, { text: "Nex's shadow consumes you!", color: colors.purple }); // OBS (27th)
      }
    }
  }

  // --- blood --------------------------------------------------------------
  startSiphon(context, boss) {
    const encounter = this.encounter;
    encounter.say(context, "A siphon will solve this!");
    encounter.visual(context, {
      animations: [{ clipId: "siphon" }],
      graphics: [{ spotAnimId: spotAnims.siphon, target: buildActorVisualTarget(boss), height: 0, delayCycles: 0 }],
      sounds: [{ id: sounds.siphon }, { id: sounds.siphonKneel, delayCycles: 30 }],
    });
    this.kneeling = true;
    this.kneelUntil = context.tick + siphon.kneel;
    encounter.minions.summonReavers(context, boss);
    encounter.later(siphon.kneel, () => {
      if (this.kneelUntil <= this.encounter.now) this.kneeling = false;
    });
  }
  // "I demand a blood sacrifice!": one of the party glows red, and has 6 ticks to be 7 tiles from her (OBS, WIKI).
  startSacrifice(context, boss) {
    const encounter = this.encounter;
    const living = this.party.living(context.world);
    if (living.length === 0) return;
    const target = living[Math.floor(encounter.random() * living.length)];
    encounter.say(context, "I demand a blood sacrifice!");
    encounter.visual(context, { sounds: [{ id: sounds.sacrifice }] });
    this.sacrificeTarget = target.id;
    this.sacrificeAt = context.tick;
    if (this.party.isLocal(target)) encounter.message(context, { text: "Nex has marked you for a blood sacrifice! RUN!", color: colors.red }); // OBS (27th)
    encounter.later(sacrifice.resolves, (ctx) => this.sacrificeResolve(ctx, target));
  }
  sacrificeResolve(context, target) {
    const encounter = this.encounter;
    this.sacrificeTarget = null;
    const boss = encounter.boss(context.world);
    if (!boss?.alive || encounter.stage !== "fight" || !this.party.alive(target, context.world)) return;
    const escaped = gapTo(this.party.tile(target, context.world), boss.position) >= sacrifice.reach;
    // OBS (27th): the marked one is told which (33 of 33).
    if (this.party.isLocal(target)) {
      encounter.message(context, escaped
        ? { text: "You managed to escape from Nex's blood sacrifice.", color: colors.green }
        : { text: "You failed to escape from Nex's blood sacrifice!", color: colors.red });
    }
    if (escaped) return; // OBS: run clear, nothing
    encounter.message(context, { text: "Nex unleashes a blood sacrifice!", color: colors.red }); // OBS
    // OBS: her next attack 4 ticks after it (3 of 4), 7 after her words when it is run clear.
    encounter.delayAttack(sacrifice.afterUnleash);
    const struck = [target, ...this.party.living(context.world).filter((member) => member.id !== target.id && gapTo(this.party.tile(member, context.world), boss.position) < sacrifice.reach)];
    encounter.visual(context, {
      animations: [{ clipId: "cast" }],
      projectiles: struck.map((member) => encounter.projectile(boss, this.party.actorOf(member, context.world), spotAnims.sacrifice, heights.sacrifice)),
      graphics: struck.map((member) => ({ spotAnimId: spotAnims.sacrificeImpact, target: buildActorVisualTarget(this.party.actorOf(member, context.world)), height: 0, delayCycles: 76 })),
    });
    const rolls = struck.map((member, index) => ({
      member,
      damage: index === 0
        ? this.party.roll(boss, member, { formulaStyle: "magic", maxHit: sacrifice.maxHit, alwaysHits: true }, encounter.random, context.world)
        : encounter.randomInt(0, sacrifice.others),
    }));
    encounter.later(sacrifice.lands, (ctx) => {
      const her = encounter.boss(ctx.world);
      for (const { member, damage } of rolls) {
        // WIKI: through Protect from Magic (2/3 blocked); a third of the prayer left; it heals her.
        const done = this.party.hurt(member, { damage, style: "magic", keep: sacrifice.keep, source: "Blood Sacrifice" }, ctx);
        this.party.drainPrayer(member, Math.floor(this.party.prayerPoints(member, ctx.world) * sacrifice.prayerShare), ctx.world);
        if (member.id === target.id && her?.alive) encounter.healBoss(her, done, ctx);
      }
    });
  }

  // --- ice ----------------------------------------------------------------
  startContainment(context, boss) {
    const encounter = this.encounter;
    encounter.say(context, "Contain this!");
    encounter.visual(context, { animations: [{ clipId: "smash" }], sounds: [{ id: sounds.smash, delayCycles: 30 }, { id: sounds.smashSecond, delayCycles: 30 }] });
    const strikeAt = context.tick + containment.strikes;
    this.icicles = { strikeAt, tiles: [], inner: [], until: strikeAt + containment.lasts };
    encounter.later(containment.strikes, (ctx) => this.containmentStrike(ctx));
  }
  // OBS: icicles on her body's tiles (26209) and on the ring about it (42943): 5 x 5 (WIKI); everyone in it is hit and
  // loses his protection.
  containmentStrike(context) {
    const encounter = this.encounter;
    const boss = encounter.boss(context.world);
    if (!boss?.alive || !this.icicles || encounter.stage !== "fight") return;
    this.icicles.inner = this.ring(boss.position, 0);
    this.icicles.tiles = this.ring(boss.position, 1).filter((tile) => inChamber(tile));
    this.icicles.position = [...boss.position];
    for (const member of this.party.living(context.world)) {
      if (gapTo(this.party.tile(member, context.world), boss.position) > 1) continue;
      this.party.disableProtection(member, context, context.tick + 1);
      this.party.hurt(member, { damage: encounter.randomInt(0, containment.maxHit), style: "typeless", source: "Containment" }, context);
      if (this.party.isLocal(member)) {
        // OBS (27th): the game's words as the icicles strike (9 of 9).
        encounter.message(context, { text: "Nex's icicles spike you to the spot!", color: colors.purple });
        encounter.message(context, { text: "Your protection prayers have been disabled!", color: colors.red });
      }
    }
  }
  // "Die now, in a prison of ice!": a member locked in by stalagmites on the tiles about him (OBS), his protection off,
  // and 4 seconds to break them all with stabs or crushes or take up to 75 (WIKI).
  startPrison(context, boss) {
    const encounter = this.encounter;
    const living = this.party.living(context.world);
    if (living.length === 0) return;
    const target = encounter.nearestTarget(boss, context.world) ?? living[0];
    const actor = this.party.actorOf(target, context.world);
    encounter.say(context, "Die now, in a prison of ice!");
    faceActorToward(boss, actor);
    encounter.visual(context, {
      animations: [{ clipId: "cast" }],
      projectiles: [encounter.projectile(boss, actor, spotAnims.prison, heights.prison)],
      sounds: [{ id: sounds.prison }],
    });
    encounter.later(prison.locks, (ctx) => this.lockPrison(ctx, target));
  }
  lockPrison(context, target) {
    const encounter = this.encounter;
    const boss = encounter.boss(context.world);
    if (!boss?.alive || encounter.stage !== "fight" || !this.party.alive(target, context.world)) return;
    const tile = [...this.party.tile(target, context.world)];
    const walls = this.ring([tile[0], tile[1]], 1, 1).filter((wall) => this.walkable(wall) && gapTo(wall, boss.position) > 0);
    // OBS: the others beside him are shoved aside.
    for (const member of this.party.living(context.world)) {
      if (member.id === target.id) continue;
      const at = this.party.tile(member, context.world);
      if (!walls.some((wall) => wall[0] === at[0] && wall[1] === at[1])) continue;
      const out = [at[0] + Math.sign(at[0] - tile[0]), at[1] + Math.sign(at[1] - tile[1])];
      if (this.walkable(out)) this.party.moveTo(member, out, context);
    }
    const ids = walls.map((wall) => encounter.minions.spawnStalagmite(context, wall, ++this.stalagmiteSerial));
    const shattersAt = context.tick + prison.shatters;
    this.prisoned = { memberId: target.id, tile, shattersAt, stalagmites: ids };
    this.party.freeze(target, prison.shatters, context.tick, { ignoreGap: true });
    this.party.disableProtection(target, context, shattersAt);
    if (this.party.isLocal(target)) encounter.message(context, { text: "You've been trapped in an ice prison!", color: colors.magenta }); // OBS (27th)
    encounter.later(prison.shatters, (ctx) => this.shatter(ctx));
  }
  shatter(context) {
    const encounter = this.encounter;
    const prisoned = this.prisoned;
    if (!prisoned) return;
    this.prisoned = null;
    const live = prisoned.stalagmites.filter((id) => context.world.getNpc(id)?.alive);
    for (const id of prisoned.stalagmites) if (context.world.getNpc(id)) context.despawnNpc(id);
    const member = this.party.member(prisoned.memberId);
    if (!member) return;
    this.party.unfreeze(member, context.tick);
    if (live.length > 0 && encounter.stage !== "dead") {
      this.party.hurt(member, { damage: encounter.randomInt(0, prison.maxHit), style: "typeless", source: "Ice Prison" }, context);
      if (this.party.isLocal(member)) encounter.message(context, { text: "The ice prison shatters and pierces your flesh!", color: colors.magenta }); // OBS (27th)
    }
  }
  liveStalagmites(world) {
    if (!this.prisoned) return [];
    return this.prisoned.stalagmites.map((id) => world.getNpc(id)).filter((npc) => npc?.alive && !npc.death);
  }
  breakStalagmite(id, context) {
    const npc = context.world.getNpc(id);
    if (!npc?.alive) return;
    context.despawnNpc(id);
    this.stalagmiteGone(id, context);
  }
  // OBS (27th): "You've been freed from the ice prison!" as the last of them breaks (25 of 27 prisons), its walls gone.
  // A teammate's break (above) or the player's (encounter.js, onNpcDefeated).
  stalagmiteGone(id, context) {
    const prisoned = this.prisoned;
    if (!prisoned || this.liveStalagmites(context.world).some((npc) => npc.id !== id)) return;
    this.prisoned = null;
    const member = this.party.member(prisoned.memberId);
    if (!member) return;
    this.party.unfreeze(member, context.tick);
    if (this.party.isLocal(member)) this.encounter.message(context, { text: "You've been freed from the ice prison!", color: colors.green });
  }
  isPrisonWall(tile, world) {
    return this.liveStalagmites(world).some((npc) => npc.position[0] === tile[0] && npc.position[1] === tile[1]);
  }

  // --- her death ----------------------------------------------------------
  // "Taste my wrath!" as she dies; 4 ticks later her wrath on the tiles about her body (OBS; WIKI: 5 x 5, up to 50).
  startWrath(context, boss) {
    const encounter = this.encounter;
    encounter.say(context, "Taste my wrath!");
    const position = [...boss.position];
    this.wrathTiles = { position, at: context.tick + wrath.strikes };
    encounter.later(wrath.strikes, (ctx) => {
      const middle = middleOf(position);
      const tiles = this.ring(position, 1).filter((tile) => (tile[0] + tile[1]) % 3 === 0).slice(0, 6);
      encounter.visual(ctx, {
        graphics: [
          { spotAnimId: spotAnims.wrathCentre, target: { kind: "tile", position: middle }, height: 0, delayCycles: 0 },
          ...tiles.map((tile) => ({ spotAnimId: spotAnims.wrath, target: { kind: "tile", position: tile }, height: 0, delayCycles: 10 + 4 * chebyshev(tile, middle) })),
        ],
        projectiles: tiles.map((tile) => ({
          spotAnimId: spotAnims.wrathThrow, sourcePosition: [middle[0] + 0.5, middle[1] + 0.5], target: { kind: "tile", position: tile },
          startDelayCycles: 0, endDelayCycles: 10 + 4 * chebyshev(tile, middle), slope: 0, startOffset: 0, startHeight: 0, endHeight: 0,
        })),
      });
      for (const member of this.party.living(ctx.world)) {
        if (gapTo(this.party.tile(member, ctx.world), position) <= 1) this.party.hurt(member, { damage: encounter.randomInt(0, wrath.maxHit), style: "typeless", source: "Wrath" }, ctx);
      }
      this.wrathTiles = null;
    });
  }

  // --- what the others ask ------------------------------------------------
  // Whether a tile will hurt soon: a shadow, the aisle she looks down, her containment ring, her darkness, her wrath.
  dangerAt(tile, boss) {
    if (this.shadowTiles.some((shadow) => shadow.tile[0] === tile[0] && shadow.tile[1] === tile[1])) return true;
    if (this.dashing && this.inAisle(this.dashing.aisle, this.dashing.from, tile)) return true;
    if (boss && this.icicles && this.encounter.now < this.icicles.strikeAt && gapTo(tile, boss.position) <= 1) return true;
    if (boss && this.darkness && gapTo(tile, boss.position) <= darkness.reach) return true;
    if (this.wrathTiles && gapTo(tile, this.wrathTiles.position) <= 1) return true;
    return false;
  }
  // Every tick: what wears off.
  tidy(now) {
    this.spent = this.spent.filter((entry) => entry.until > now);
    if (this.icicles && now >= this.icicles.until) this.icicles = null;
    if (this.kneeling && now >= this.kneelUntil) this.kneeling = false;
  }
  // The tiles a tile out from a footprint (a ring).
  ring(position, distance, size = bossSize) {
    const tiles = [];
    for (let x = position[0] - distance; x <= position[0] + size - 1 + distance; x++) {
      for (let y = position[1] - distance; y <= position[1] + size - 1 + distance; y++) {
        if (gapTo([x, y], position, size) === distance) tiles.push([x, y]);
      }
    }
    return tiles;
  }
  walkable(tile) {
    return inChamber(tile) && isArenaTileWalkable(tile[0], tile[1]);
  }
  // Interrupted (a phase ends, she dies): what is in the air ends, what lies on the floor stays to wear off.
  interrupt() {
    this.dashing = null;
    this.darkness = null;
    this.kneeling = false;
    this.sacrificeTarget = null;
  }
  // What the scene and a script read.
  snapshot(now) {
    return {
      infected: [...this.infected.keys()],
      dashing: this.dashing ? { aisle: this.dashing.aisle, strikeAt: this.dashing.strikeAt } : null,
      shadows: this.shadowTiles.map((shadow) => ({ tile: [...shadow.tile], strikeAt: shadow.strikeAt })),
      spentShadows: this.spent.map((entry) => [...entry.tile]),
      darkness: this.darkness ? { until: this.darkness.until } : null,
      kneeling: this.kneeling,
      sacrificeTarget: this.sacrificeTarget,
      icicles: this.icicles && now >= this.icicles.strikeAt ? this.icicles.inner.map((tile) => [...tile]) : [],
      icicleRing: this.icicles && now >= this.icicles.strikeAt ? this.icicles.tiles.map((tile) => [...tile]) : [],
      prison: this.prisoned ? {
        memberId: this.prisoned.memberId, tile: [...this.prisoned.tile], shattersAt: this.prisoned.shattersAt,
        stalagmites: this.encounter.world ? this.liveStalagmites(this.encounter.world).map((npc) => [...npc.position]) : [],
      } : null,
    };
  }
}
