// Phosani's Nightmare's totems, husks, parasites and sleepwalkers.
// Sources as in encounter.js (WIKI, TABLE, tsps, OBS (runelogs)).
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { faceActorToward } from "../shared/npcHelpers.js";
import {
  npcTypeIds, totems as totemSpecs, totemSize, sleepwalkerTiles, walkerTiles, isFloor, isTotemTile, gapTo, same, spotAnims, sounds,
} from "./ids.js";

// --- the totems ------------------------------------------------------------
// WIKI, tsps: 200 charge each in Phosani's dream; magic charges twice as fast.
// OBS (runelogs): what they took sums to 800 a phase in 29 of the 30 phases of
// the ten kills, 852 in the one a parasite drained (the doubling is in the
// hitsplats). Charged, a totem
// says so (tsps); all four, and they blast her.
export const totemCharge = 200;
const totemMessages = {
  full: (name) => `The ${name} totem is fully charged.`,
  all: { text: "All four totems are fully charged.", color: "#ff3045" },
  // OBS (Outside, four recordings of the Nightmare's group fight, Vaerric, 2026-11-27): a charged totem keeps its
  // "Charge" option (the cache's 9445 and 9442 have it); clicked, this message on that tick and no attack (2 of 2).
  already: "That totem is already charged.",
}; // tsps, as captured

// --- husks -----------------------------------------------------------------
// tsps: her animation; 2 ticks later a projectile at the player; 2 after that
// the trance (the player held where he stands) and a magic and a ranged husk
// on two of the tiles straight beside him (130 of 130 captured). The magic
// one attacks 3 ticks after they rise, the ranged one 5, then every 6 in
// Phosani's dream. WIKI: 20 hitpoints (TABLE: 20) and a max hit of 26 (OBS
// (runelogs): of 9 hits taken with husks up, the highest 24, 24 and 26; tsps
// has the Nightmare's 14); the right protection stops them; crush always hits
// them for its most.
const huskProjectileTicks = 2;
const huskRiseTicks = 4;
const huskFirst = { magic: 3, range: 5 };
const huskEvery = 6;
const huskMaxHit = 26;
const huskFlightTicks = 2; // tsps: the projectiles land at 67 and 60 cycles
export const huskMessages = {
  trance: { text: "The Nightmare puts you in a strange trance, preventing you from moving!", color: "#ff289d" },
  free: { text: "As the last husk dies, you feel yourself become free of the Nightmare's trance.", color: "#229628" },
};

// --- parasites -------------------------------------------------------------
// tsps: her animation; 2 ticks later it flies at the player; 3 after that it
// takes hold. 20 ticks later it bursts out (21 if weakened, 84 of 84
// captured): 56 to 80 fully grown, 4 to 9 if a Sanfew serum or Relicym's
// balm weakened it first (tsps; WIKI: "massive" damage). OBS (Outside, five
// recordings): 21 ticks every time it was weakened (7 of 7), and those bursts
// hit 9, 5, 6, 10, 9, 7 and 9: at least 10 weakened, so 4 to 10 here. It acts 6 ticks after
// it is out, then every 4: 31 to 50 back on her shield, or as much from the
// least charged totem, or else an attack on the player, ranged first, 12 at
// most (10 weakened), which the right protection stops. WIKI: weakened, 55
// hitpoints (TABLE: 55); "Unweakened parasites add the damage they dealt to
// their base HP"; crush always hits a weakened one for its most.
const parasiteFlightTicks = 2;
const infectTicks = 5; // from her animation
const burstTicks = { full: 20, weak: 21 };
const burstDamage = { full: [56, 80], weak: [4, 10] }; // tsps; OBS (Outside): the weakened top
const parasiteFirst = 6;
const parasiteEvery = 4;
const parasiteHeal = [31, 50];
const parasiteMaxHit = { full: 12, weak: 10 };
// OBS (Outside): its projectiles start at 84 (magic 1771, drain 1773, heal 1774) and 40 (ranged 1775) in the game's
// height units, a quarter of that here (21 and 10); its magic's impact (1772) shows at 104. Their timing is tsps's.
// Sanfew serum(4) to (1) and Relicym's balm(4) to (1).
export const parasiteCures = new Set([10925, 10927, 10929, 10931, 4842, 4844, 4846, 4848]);
export const parasiteMessages = {
  infected: { text: "The Nightmare has impregnated you with a deadly parasite!", color: "#ff289d" },
  weakened: { text: "The parasite within you has been weakened.", color: "#229628" },
  burstWeak: { text: "The parasite bursts out of you, weakened by your potion!", color: "#ff3045" },
  burstFull: { text: "The parasite bursts out of you, fully grown!", color: "#ff3045" },
}; // tsps, as captured

// --- sleepwalkers ----------------------------------------------------------
// tsps: 2 ticks after she takes her blast form they rise by the totems (ids.js)
// and walk to her from their fourth tick, a tile a tick; one that reaches her
// (a tile from her body) is taken in. She blasts once the last is gone: a tick
// after the last one's death, or three after the last is taken in, at the
// latest 16 ticks after they rose; the blast's graphic 4 ticks after her
// animation and its hit 2 after that, 9 ticks after her animation her next
// form. WIKI, tsps: 2, 3 and 4 of them after the three phases; any damage
// kills one; the blast does 5, and 144 more shared out over those that reached
// her (OBS (runelogs): 5 with none taken in, 41 with one of four, 53 with
// one of three).
// OBS (Outside, one kill): they rose 2 ticks after her blast form, and walked
// from their fourth tick after her first two phases but their seventh after
// her last. OBS (Outside, five recordings of 2026-11-25 and 26, 15 blasts): her
// blast animation 2 ticks after the last one's death in 12 (3 in the other 3),
// and 2 after the last was taken in (1 of 1, tsps: 3). The rule that it came an
// even number of ticks after they rose, from the first recording, holds for 7.
//
// Her desperation (WIKI, tsps): one at a time, each that reaches her a hit of
// 15, the next ones 8 apart. OBS (Outside): the first rises 2 ticks after her
// desperation form (tsps: 2), walks from its seventh tick, and is taken in a
// tick after it is beside her; its hit lands 4 ticks after that, 19 ticks after
// her form (OBS (runelogs, the 4 kills that lasted that long): 19 too). OBS
// (Outside, five recordings): every one of its hits on the player 15 (6 of 6).
export const sleepwalkerCounts = [2, 3, 4];
const riseTicks = 2;
const walkAfter = { early: 4, last: 7 };
const latestBlast = 16;
const absorbGoneTicks = 2;
const blastAfterAbsorb = 2;
const blastAfterDeath = 2;
const blastImpactTicks = 4;
const blastHitTicks = 2;
const nextFormTicks = 9;
const blastDamage = (absorbed, spawned) => 5 + Math.floor((144 * absorbed) / Math.max(1, spawned));
const desperationFirst = 2;
const desperationEvery = 8;
const desperationDamage = 15;
const desperationHitTicks = 4;
export const walkerMessages = {
  charging: { text: "The Nightmare begins to charge up a devastating attack.", color: "#ff3045" },
  restores: { text: "The Nightmare restores her shield.", color: "#ff3045" },
}; // tsps, as captured

export const totemDefinition = defineNpc({ id: "phosanis-nightmare-totem", move: false, tick: () => ({ environmentalDamages: [] }) });
export const huskDefinition = defineNpc({
  id: "phosanis-nightmare-husk",
  move: false,
  tick: ({ actor, context, config }) => config.minions.huskTurn(actor, context),
});
export const parasiteDefinition = defineNpc({
  id: "phosanis-nightmare-parasite",
  move: false,
  tick: ({ actor, context, config }) => config.minions.parasiteTurn(actor, context),
});
export const sleepwalkerDefinition = defineNpc({
  id: "phosanis-nightmare-sleepwalker",
  move: ({ actor, context, config }) => config.minions.walkerMove(actor, context),
  tick: () => ({ environmentalDamages: [] }),
});

const baseActor = (id, npcTypeId, position, size, hp, statsId = npcTypeId) => ({
  id, kind: "npc", role: "minion", npcTypeId, archetypeId: id.replace(/-\d+.*$/, ""), size, alive: true,
  position: [...position], previousPosition: [...position], facing: 0, history: new Map(),
  vitals: { hp, maxHp: hp }, formulaStats: structuredClone(getMonsterFormulaStats(statsId)),
  combat: { attackSpeed: 4, attackRange: 10, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
    animations: { idle: null, walk: null, run: null, attack: null, death: null } },
});

export class Minions {
  constructor(encounter) {
    this.e = encounter;
  }
  reset() {
    this.count = 0;
    this.charges = totemSpecs.map(() => 0);
    this.charged = totemSpecs.map(() => false);
    this.frozen = false;
    this.husks = []; // ids
    this.infection = null; // { infectedAt, burstAt, weak }
    this.seenEvents = new Set();
    this.walk = null; // the blast form's sleepwalkers: { spawned, absorbed, risen, readyAt, blasted, done }
    this.walkers = new Set();
    this.desperate = false;
  }

  // --- totems --------------------------------------------------------------
  totemId(index) {
    return "nightmare-totem-" + totemSpecs[index].corner;
  }
  createTotems() {
    // TABLE has the ready totem (9435): no stats. inferred: every corner's the same.
    return totemSpecs.map((spec, index) =>
      totemDefinition.createActor(
        { ...baseActor(this.totemId(index), npcTypeIds.totems[spec.corner][0], spec.tile, totemSize, totemCharge, 9435), untargetable: true, blocksNpcMovement: true },
        { index },
      ),
    );
  }
  totemIndex(npc) {
    return totemDefinition.isActor(npc) ? npc.state.index : -1;
  }
  setTotem(world, index, stage) {
    const totem = world.getNpc(this.totemId(index));
    if (!totem) return;
    const spec = totemSpecs[index];
    totem.npcTypeId = npcTypeIds.totems[spec.corner][["dormant", "ready", "charged"].indexOf(stage)];
    totem.untargetable = stage === "dormant";
    if (stage !== "charged") totem.vitals = { hp: totemCharge, maxHp: totemCharge };
  }
  wakeTotems(world) {
    this.charges = totemSpecs.map(() => 0);
    this.charged = totemSpecs.map(() => false);
    totemSpecs.forEach((_, index) => this.setTotem(world, index, "ready"));
  }
  sleepTotems(world) {
    this.charges = totemSpecs.map(() => 0);
    this.charged = totemSpecs.map(() => false);
    totemSpecs.forEach((_, index) => this.setTotem(world, index, "dormant"));
  }
  // A player's hit on a totem: its charge, which the hitsplat shows. The bar shows what is left to charge (inferred: the
  // game fills a bar of its own), so the totem's hitpoints never reach 0 and it is never killed: its last point is put
  // back before the engine takes the hit.
  chargeTotem(totem, damage, attack, context) {
    const index = this.totemIndex(totem);
    if (index < 0 || this.charged[index] || this.e.stage !== "totems") return 0;
    const magic = attack?.style === "magic" || attack?.spellId !== undefined;
    const amount = Math.min(totemCharge - this.charges[index], damage * (magic ? 2 : 1));
    if (amount <= 0) return 0;
    this.charges[index] += amount;
    totem.vitals = { ...totem.vitals, hp: Math.max(1, totemCharge - this.charges[index]) + amount };
    if (this.charges[index] >= totemCharge) {
      this.charged[index] = true;
      this.e.later(0, (ctx) => this.totemFull(ctx, index));
    }
    return amount;
  }
  totemFull(context, index) {
    this.setTotem(context.world, index, "charged");
    // OBS (Outside, the four group and five Phosani recordings): the player charging it stops as it is charged, without
    // the message (his target gone the next tick 30 times of 30, 13 of them with no click on that tick or the next).
    const player = context.world.getPlayer();
    if (player.attackTarget === this.totemId(index)) {
      player.attackTarget = null;
      player.attackInteractionActive = false;
    }
    if (this.charged.every(Boolean)) {
      this.e.message(context, totemMessages.all);
      this.e.totemsCharged(context);
    } else {
      this.e.message(context, totemMessages.full(totemSpecs[index].name));
    }
  }
  // A click on a charged totem (the player's target is read before this, so a target on one now is a click of this
  // tick): the message, and the totem blocked for this tick alone, which drops the target before he moves or attacks
  // (as Hydra's form change does).
  refuseCharged(context) {
    const player = context.world.getPlayer();
    totemSpecs.forEach((_, index) => {
      if (!this.charged[index]) return;
      const totem = context.world.getNpc(this.totemId(index));
      if (!totem || totem.untargetable) return;
      totem.attackBlockedUntilTick = context.tick + 1;
      if (player.attackTarget === totem.id) this.e.message(context, totemMessages.already);
    });
  }
  leastCharged() {
    let best = -1;
    this.charges.forEach((charge, index) => {
      if (!this.charged[index] && charge > 0 && (best < 0 || charge < this.charges[best])) best = index;
    });
    return best;
  }
  drainTotem(world, index, amount) {
    if (this.e.stage !== "totems" || this.charged[index]) return;
    this.charges[index] = Math.max(0, this.charges[index] - amount);
    const totem = world.getNpc(this.totemId(index));
    if (totem) totem.vitals = { ...totem.vitals, hp: totemCharge - this.charges[index] };
  }
  // The four bolts at her as the last is charged (tsps: 30 to 92 cycles, the impact on her 90).
  fireTotems(context) {
    const boss = this.e.boss(context.world);
    if (!boss) return;
    const target = { kind: "actor", actorId: boss.id, size: boss.size, position: [...boss.position] };
    this.e.visual(context, {
      projectiles: totemSpecs.map((spec) => ({ spotAnimId: spotAnims.totemBolt, sourcePosition: [spec.tile[0] + 1.5, spec.tile[1] + 1.5], target, startDelayCycles: 30, endDelayCycles: 92, slope: 2, startOffset: 64, startHeight: 137, endHeight: 76 })),
      graphics: [{ spotAnimId: spotAnims.totemImpact, target, height: 42, delayCycles: 90 }],
      sounds: [{ id: sounds.totems }],
    });
  }

  // --- husks ---------------------------------------------------------------
  startHusks(context) {
    const e = this.e;
    const epoch = e.epoch;
    e.visual(context, { animations: [{ clipId: "husks" }] });
    e.later(huskProjectileTicks, (ctx) => {
      if (e.epoch !== epoch) return;
      const boss = e.boss(ctx.world);
      const player = ctx.world.getPlayer();
      if (boss) e.visual(ctx, { projectiles: [e.projectileFrom(boss, player, { spotAnimId: spotAnims.huskFlight, start: 0, end: 60, slope: 6, startOffset: 0, startHeight: 80, endHeight: 31 })] });
    });
    e.later(huskRiseTicks, (ctx) => e.epoch === epoch && this.raiseHusks(ctx));
    return null;
  }
  raiseHusks(context) {
    const e = this.e;
    const player = context.world.getPlayer();
    if (!player.alive || this.frozen) return;
    const [px, py] = player.position;
    const boss = e.boss(context.world);
    const free = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [px + dx, py + dy])
      .filter((tile) => isFloor(tile) && !isTotemTile(tile) && !(boss && gapTo(tile, boss.position) === 0) && !context.world.getNpcs().some((npc) => npc.alive && npc.size === 1 && same(npc.position, tile)));
    // inferred: two of them, at random; with one free tile, both on it.
    for (let n = free.length - 1; n > 0; n--) {
      const m = Math.floor(e.random() * (n + 1));
      [free[n], free[m]] = [free[m], free[n]];
    }
    if (free.length === 0) return;
    e.message(context, huskMessages.trance);
    this.frozen = true;
    this.husks = [];
    ["magic", "range"].forEach((style, n) => {
      const id = `nightmare-husk-${this.count++}-${style}`;
      const npcTypeId = npcTypeIds.husks[style];
      const hp = getMonsterHitpoints(npcTypeId); // TABLE: 20
      const tile = free[n] ?? free[0];
      const husk = huskDefinition.createActor({ ...baseActor(id, npcTypeId, tile, 1, hp), menuColor: style === "magic" ? "#5fa8ff" : "#5fff7a" }, { style, next: context.tick + huskFirst[style] });
      faceActorToward(husk, player);
      context.spawnNpc(husk);
      this.husks.push(id);
      e.visual(context, { animations: [{ actorId: id, clipId: "rise" }], sounds: [{ id: sounds.huskRise }] });
    });
  }
  huskTurn(husk, context) {
    const idle = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!husk.alive || !player.alive || context.tick < husk.state.next) return idle;
    husk.state.next = context.tick + huskEvery;
    const style = husk.state.style;
    faceActorToward(husk, player);
    const attack = rollNpcAttack({
      attacker: husk, target: player, random: context.random,
      plan: {
        formulaStyle: style === "magic" ? "magic" : "ranged", damageType: this.e.specials.protectionFor(style), attackKind: style === "magic" ? "magic" : "range_arrow",
        maxHit: huskMaxHit, impactDelayTicks: huskFlightTicks, sourceDeathPolicy: "persist",
      },
    });
    const projectile = style === "magic"
      ? { spotAnimId: spotAnims.huskMagic, start: 60, end: 67, slope: 2, startOffset: 20, startHeight: 27, endHeight: 26 }
      : { spotAnimId: spotAnims.huskRange, start: 46, end: 60, slope: 0, startOffset: 20, startHeight: 23, endHeight: 26 };
    this.e.visual(context, {
      animations: [{ actorId: husk.id, clipId: style }],
      projectiles: [this.e.projectileFrom(husk, player, projectile)],
      graphics: style === "magic" ? [{ spotAnimId: spotAnims.huskMagicImpact, target: this.e.playerTarget(player), height: 104, delayCycles: 67 }] : [],
    });
    return { environmentalDamages: [], npcAttacks: attack ? [attack] : [] };
  }
  huskDied(context, npcId) {
    if (!this.husks.includes(npcId)) return;
    const living = this.husks.filter((id) => id !== npcId && context.world.getNpc(id)?.alive);
    if (living.length > 0) return;
    this.freePlayer(context, true);
  }
  freePlayer(context, announce) {
    if (!this.frozen) return;
    this.frozen = false;
    if (announce) this.e.message(context, huskMessages.free);
  }
  isHusk(npc) {
    return huskDefinition.isActor(npc);
  }

  // --- parasites -----------------------------------------------------------
  startParasite(context) {
    const e = this.e;
    const epoch = e.epoch;
    e.visual(context, { animations: [{ clipId: "parasite" }] });
    e.later(parasiteFlightTicks, (ctx) => {
      if (e.epoch !== epoch) return;
      const boss = e.boss(ctx.world);
      if (boss) e.visual(ctx, { projectiles: [e.projectileFrom(boss, ctx.world.getPlayer(), { spotAnimId: spotAnims.parasiteFlight, start: 10, end: 90, slope: 6, startOffset: 0, startHeight: 80, endHeight: 31 })] });
    });
    e.later(infectTicks, (ctx) => {
      if (e.epoch !== epoch || this.infection || !ctx.world.getPlayer().alive) return;
      this.infection = { infectedAt: ctx.tick, burstAt: ctx.tick + burstTicks.full, weak: false };
      e.message(ctx, parasiteMessages.infected);
    });
    return null;
  }
  // A cure drunk while it grows weakens it (tsps). The engine says what was drunk in its events.
  watchCures(context) {
    if (!this.infection || this.infection.weak) return;
    for (const event of context.tickEvents?.eventBuffer ?? []) {
      if (event.type !== "item_consumed" || this.seenEvents.has(event.eventId)) continue;
      this.seenEvents.add(event.eventId);
      if (!parasiteCures.has(event.itemId)) continue;
      this.infection.weak = true;
      this.infection.burstAt = this.infection.infectedAt + burstTicks.weak;
      this.e.message(context, parasiteMessages.weakened);
      return;
    }
  }
  burstCheck(context) {
    const infection = this.infection;
    if (!infection || context.tick < infection.burstAt) return;
    this.infection = null;
    const e = this.e;
    const player = context.world.getPlayer();
    if (!player.alive) return;
    const kind = infection.weak ? "weak" : "full";
    const [low, high] = burstDamage[kind];
    const damage = low + Math.floor(e.random() * (high - low + 1));
    e.message(context, infection.weak ? parasiteMessages.burstWeak : parasiteMessages.burstFull);
    e.hurt({ baseDamage: damage, attackType: "typeless", source: "Parasite" });
    const npcTypeId = infection.weak ? npcTypeIds.parasiteWeak : npcTypeIds.parasite;
    const hp = getMonsterHitpoints(npcTypeId) + (infection.weak ? 0 : damage); // TABLE: 55; WIKI: grown, the damage it did on top
    const id = `nightmare-parasite-${this.count++}`;
    const parasite = parasiteDefinition.createActor({ ...baseActor(id, npcTypeId, player.position, 1, hp), menuColor: "#ff9de0" }, { weak: infection.weak, next: context.tick + parasiteFirst, ranged: true });
    context.spawnNpc(parasite);
    e.visual(context, {
      animations: [{ actorId: id, clipId: "rise" }],
      graphics: [{ spotAnimId: infection.weak ? spotAnims.vomitWeak : spotAnims.vomit, target: e.playerTarget(player), height: 0, delayCycles: 0 }],
      sounds: [{ id: sounds.parasiteBurst, delayCycles: 4 }],
    });
  }
  parasiteTurn(parasite, context) {
    const idle = { environmentalDamages: [] };
    const e = this.e;
    if (!parasite.alive || context.tick < parasite.state.next) return idle;
    parasite.state.next = context.tick + parasiteEvery;
    const boss = e.boss(context.world);
    const amount = parasiteHeal[0] + Math.floor(e.random() * (parasiteHeal[1] - parasiteHeal[0] + 1));
    if (boss && e.stage === "shield" && e.shield < e.shieldMax) {
      faceActorToward(parasite, boss);
      e.visual(context, { animations: [{ actorId: parasite.id, clipId: "cast" }], projectiles: [e.projectileFrom(parasite, boss, { spotAnimId: spotAnims.parasiteHeal, start: 35, end: 60, slope: 2, startOffset: 32, startHeight: 21, endHeight: 26 })] });
      e.later(2, () => e.healShield(amount));
      return idle;
    }
    const totem = e.stage === "totems" ? this.leastCharged() : -1;
    if (totem >= 0) {
      const target = context.world.getNpc(this.totemId(totem));
      if (target) {
        faceActorToward(parasite, target);
        e.visual(context, { animations: [{ actorId: parasite.id, clipId: "cast" }], projectiles: [e.projectileFrom(parasite, target, { spotAnimId: spotAnims.parasiteDrain, start: 35, end: 60, slope: 2, startOffset: 32, startHeight: 21, endHeight: 26 })] });
        e.later(2, (ctx) => this.drainTotem(ctx.world, totem, amount));
        return idle;
      }
    }
    const player = context.world.getPlayer();
    if (!player.alive) return idle;
    const style = parasite.state.ranged ? "range" : "magic";
    parasite.state.ranged = !parasite.state.ranged;
    faceActorToward(parasite, player);
    const attack = rollNpcAttack({
      attacker: parasite, target: player, random: context.random,
      plan: {
        formulaStyle: style === "magic" ? "magic" : "ranged", damageType: e.specials.protectionFor(style), attackKind: style === "magic" ? "magic" : "range_arrow",
        maxHit: parasite.state.weak ? parasiteMaxHit.weak : parasiteMaxHit.full, impactDelayTicks: 2, sourceDeathPolicy: "persist",
      },
    });
    const projectile = style === "magic"
      ? { spotAnimId: spotAnims.parasiteMagic, start: 35, end: 60, slope: 2, startOffset: 32, startHeight: 21, endHeight: 26 }
      : { spotAnimId: spotAnims.parasiteRange, start: 35, end: 60, slope: 0, startOffset: 20, startHeight: 10, endHeight: 26 };
    e.visual(context, {
      animations: [{ actorId: parasite.id, clipId: style === "magic" ? "cast" : "range" }],
      projectiles: [e.projectileFrom(parasite, player, projectile)],
      graphics: style === "magic" ? [{ spotAnimId: spotAnims.parasiteMagicImpact, target: e.playerTarget(player), height: 104, delayCycles: 60 }] : [],
    });
    return { environmentalDamages: [], npcAttacks: attack ? [attack] : [] };
  }
  isParasite(npc) {
    return parasiteDefinition.isActor(npc);
  }

  // --- sleepwalkers --------------------------------------------------------
  // Her blast form: they come, she blasts, then `done`.
  summon(context, count, done) {
    const e = this.e;
    const state = { spawned: 0, absorbed: 0, risen: false, readyAt: 0, blasted: false, done };
    this.walk = state;
    const epoch = e.epoch;
    e.later(riseTicks, (ctx) => {
      if (e.epoch !== epoch || this.walk !== state) return;
      e.message(ctx, walkerMessages.charging);
      e.sound(ctx, sounds.sleepwalkers);
      for (const tile of walkerTiles(count, () => e.random())) if (this.rise(ctx, tile, false)) state.spawned++;
      state.risen = true;
      state.risenAt = ctx.tick;
      state.readyAt = ctx.tick + 1;
      e.later(latestBlast, (late) => {
        if (e.epoch !== epoch || this.walk !== state || state.blasted) return;
        for (const id of [...this.walkers]) {
          const walker = late.world.getNpc(id);
          if (walker?.alive && !walker.state.desperate) this.absorb(late, walker);
        }
      });
    });
  }
  rise(context, tile, desperate) {
    const id = `nightmare-sleepwalker-${this.count++}`;
    const hp = getMonsterHitpoints(npcTypeIds.sleepwalker); // TABLE: 10
    const late = desperate || this.e.phase >= sleepwalkerCounts.length;
    const walker = sleepwalkerDefinition.createActor({ ...baseActor(id, npcTypeIds.sleepwalker, tile, 1, hp), blocksNpcMovement: false }, { walkAt: context.tick + (late ? walkAfter.last : walkAfter.early), desperate, absorbed: false });
    context.spawnNpc(walker);
    this.walkers.add(id);
    this.e.visual(context, { animations: [{ actorId: id, clipId: "rise" }] });
    return walker;
  }
  walkerMove(walker, context) {
    if (!walker.alive || walker.state.absorbed || context.tick < walker.state.walkAt) return [];
    const boss = this.e.boss(context.world);
    if (!boss) return [];
    if (gapTo(walker.position, boss.position) <= 1) return [];
    const [x, y] = walker.position;
    const [bx, by] = boss.position;
    const dx = x < bx ? 1 : x > bx + 4 ? -1 : 0;
    const dy = y < by ? 1 : y > by + 4 ? -1 : 0;
    const step = [[x + dx, y + dy], [x + dx, y], [x, y + dy]].find((to) => !same(to, walker.position) && isFloor(to));
    return step ? [{ npcId: walker.id, path: [step] }] : [];
  }
  // At the start of a tick: those beside her are taken in; then whether she blasts.
  watchWalkers(context) {
    const boss = this.e.boss(context.world);
    for (const id of [...this.walkers]) {
      const walker = context.world.getNpc(id);
      if (!walker || !walker.alive) {
        if (walker?.state?.absorbed !== true) this.gone(context, id, blastAfterDeath);
        continue;
      }
      if (walker.state.absorbed || context.tick < walker.state.walkAt || !boss) continue;
      if (gapTo(walker.position, boss.position) <= 1) this.absorb(context, walker);
    }
    this.blastWhenClear(context);
  }
  absorb(context, walker) {
    const e = this.e;
    walker.state.absorbed = true;
    walker.untargetable = true;
    this.gone(context, walker.id, blastAfterAbsorb);
    e.visual(context, { animations: [{ actorId: walker.id, clipId: "absorb" }] });
    if (walker.state.desperate) {
      const epoch = e.epoch;
      e.later(desperationHitTicks, () => e.epoch === epoch && e.hurt({ baseDamage: desperationDamage, attackType: "typeless", source: "Sleepwalker" }));
    }
    else if (this.walk) this.walk.absorbed++;
    e.later(absorbGoneTicks, (ctx) => ctx.world.getNpc(walker.id) && ctx.despawnNpc(walker.id));
  }
  gone(context, id, ticks) {
    if (!this.walkers.delete(id)) return;
    if (this.walk && !this.desperate) this.walk.readyAt = Math.max(this.walk.readyAt, context.tick + ticks);
  }
  walkerKilled(context, id) {
    this.gone(context, id, blastAfterDeath);
  }
  isWalker(npc) {
    return sleepwalkerDefinition.isActor(npc);
  }
  blastWhenClear(context) {
    const state = this.walk;
    if (!state || !state.risen || state.blasted || this.walkers.size > 0 || context.tick < state.readyAt) return;
    state.blasted = true;
    const e = this.e;
    const epoch = e.epoch;
    const { absorbed, spawned } = state;
    e.visual(context, { animations: [{ clipId: "blast" }] });
    e.later(blastImpactTicks, (ctx) => {
      if (e.epoch !== epoch) return;
      e.visual(ctx, { graphics: [{ spotAnimId: spotAnims.blastImpact, target: e.playerTarget(ctx.world.getPlayer()), height: 0, delayCycles: 0 }], sounds: [{ id: sounds.blastImpact, delayCycles: 60 }] });
    });
    e.later(blastImpactTicks + blastHitTicks, () => e.epoch === epoch && e.hurt({ baseDamage: blastDamage(absorbed, spawned), attackType: "typeless", source: "The Nightmare's blast" }));
    e.later(nextFormTicks, (ctx) => {
      if (e.epoch !== epoch || this.walk !== state) return;
      this.walk = null;
      state.done(ctx);
    });
  }
  // Her desperation: one at a time, from the eight tiles.
  startDesperation(context) {
    this.desperate = true;
    const e = this.e;
    const epoch = e.epoch;
    const next = (ctx) => {
      if (e.epoch !== epoch || e.stage !== "desperate") return;
      this.rise(ctx, sleepwalkerTiles[Math.floor(e.random() * sleepwalkerTiles.length)], true);
      e.later(desperationEvery, next);
    };
    e.later(desperationFirst, next);
  }
  // Her death: the minions go with her (tsps: parasites outlast a blast, not her death).
  clearAll(context) {
    for (const npc of context.world.getNpcs()) {
      if (!npc.alive || !(this.isHusk(npc) || this.isParasite(npc) || this.isWalker(npc))) continue;
      context.despawnNpc(npc.id);
    }
    this.walkers.clear();
    this.walk = null;
    this.frozen = false;
    this.infection = null;
  }
  snapshot() {
    return {
      totems: totemSpecs.map((spec, index) => ({ corner: spec.corner, charge: this.charges[index], charged: this.charged[index] })),
      held: this.frozen,
      infection: this.infection ? { burstAt: this.infection.burstAt, weak: this.infection.weak } : null,
      sleepwalkers: this.walk ? { spawned: this.walk.spawned, absorbed: this.walk.absorbed, blasted: this.walk.blasted } : null,
    };
  }
}
