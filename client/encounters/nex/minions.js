// Nex's mages, her blood reavers and the stalagmites of her ice prison.
//
// The mages (Fumus, Umbra, Cruor, Glacies) stand in the four corners from her
// intro (OBS: each on its own tile, still). Each empowers her in its phase
// and cannot be harmed (WIKI) until she loses a fifth of her hitpoints and
// calls it ("Fumus, don't fail me!"); from then it casts its barrage at the
// party every 5 ticks (OBS: 5 between casts; the first 5 to 10 after her
// call), and its death ends her phase (OBS: her next phase a tick after).
//
// Her reavers come with her siphon (specials.js) and cast at the party every 5
// ticks (OBS). Hitting one heals whoever hit it for half the damage (WIKI). A
// new siphon kills the reavers still alive, and they heal her for what they
// had left (WIKI); her next phase kills them too (WIKI).
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { isArenaTileWalkable } from "../../engine/arena.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { buildActorVisualTarget, faceActorToward, getProjectileSourcePosition } from "../shared/npcHelpers.js";
import { npcTypeIds, spotAnims, mageTiles, chebyshev, middleOf, gapTo, inChamber } from "./ids.js";

// The mage of each phase, and what its barrage is (OBS: graphics and projectiles; WIKI, each mage's page: a max hit of
// 29 for all four).
export const mages = [
  { name: "Fumus", key: "fumus", phase: "smoke", npcTypeId: npcTypeIds.fumus, projectile: spotAnims.smokeBarrage, impact: spotAnims.smokeBarrageImpact },
  { name: "Umbra", key: "umbra", phase: "shadow", npcTypeId: npcTypeIds.umbra, projectile: null, impact: spotAnims.shadowBarrageImpact },
  { name: "Cruor", key: "cruor", phase: "blood", npcTypeId: npcTypeIds.cruor, projectile: null, impact: spotAnims.bloodBarrageImpact },
  { name: "Glacies", key: "glacies", phase: "ice", npcTypeId: npcTypeIds.glacies, projectile: spotAnims.iceBarrage, impact: spotAnims.iceBarrageImpact },
];
const mageMaxHit = 29; // WIKI (Fumus, Umbra, Cruor, Glacies)
// WIKI (Umbra): "can lower players' Attack levels by 15%". OBS (27th): "You have been blinded!" as it lands, Attack
// 99 -> 84 each time (33 of 33), a hit or not.
const umbraBlind = 0.85;
const mageAttackTicks = 5; // OBS, WIKI
const mageFirstAttack = 8; // OBS: Fumus's first cast 8 ticks after her call in 5 of 7 kills (5 and 10 in the others)
const glaciesFreeze = 6; // WIKI (ref. 6): 6 ticks, through Protect from Magic
const reaverAttackTicks = 5; // OBS
const reaverMaxHit = 20; // WIKI (the Blood Reaver of the Ancient Prison; inferred the same)
const reaverHealShare = 0.5; // WIKI: "heal players for 50% of damage dealt to them"
const reaverReach = [3, 10]; // OBS: they rise 3 to 10 tiles from her middle

const mageDefinition = defineNpc({
  id: "nex-mage",
  move: false,
  tick: ({ actor, context, config }) => config.minions.mageTurn(actor, context),
});
const reaverDefinition = defineNpc({
  id: "nex-reaver",
  move: false,
  tick: ({ actor, context, config }) => config.minions.reaverTurn(actor, context),
});
const stalagmiteDefinition = defineNpc({
  id: "nex-stalagmite",
  move: false,
  tick: () => ({ environmentalDamages: [] }),
});
export { mageDefinition, reaverDefinition, stalagmiteDefinition };

export const mageActorId = (key) => `nex-${key}`;

export class Minions {
  constructor(encounter) {
    this.encounter = encounter;
    this.reset();
  }
  reset() {
    this.reaverSerial = 0;
  }
  get party() {
    return this.encounter.party;
  }
  createMages() {
    return mages.map((mage) => {
      const hp = getMonsterHitpoints(mage.npcTypeId); // TABLE: 500
      const position = [...mageTiles[mage.key]];
      return mageDefinition.createActor(
        {
          id: mageActorId(mage.key), kind: "npc", role: "minion", npcTypeId: mage.npcTypeId, archetypeId: "nex_mage", size: 1, alive: true,
          untargetable: true, position, previousPosition: [...position], facing: this.facingToMiddle(position), history: new Map(),
          vitals: { hp, maxHp: hp }, formulaStats: structuredClone(getMonsterFormulaStats(mage.npcTypeId)),
          combat: { attackSpeed: mageAttackTicks, attackRange: 30, attackStyle: "magic", nextActionTick: 0, targetId: null, lastAttackTick: null, animations: { idle: null, walk: null, run: null, attack: null, death: null } },
        },
        { mage, vulnerable: false, nextAttackAt: Infinity },
      );
    });
  }
  facingToMiddle([x, y]) {
    const dx = 45 - x;
    const dy = 19 - y;
    return (Math.round(Math.atan2(-dx, -dy) * (2048 / (Math.PI * 2))) + 2048) % 2048;
  }
  mage(world, phase) {
    const spec = mages.find((entry) => entry.phase === phase);
    return spec ? world.getNpc(mageActorId(spec.key)) : undefined;
  }
  // The mage the party can hit now, if any.
  vulnerableMage(world) {
    return mages.map((spec) => world.getNpc(mageActorId(spec.key))).find((npc) => npc?.alive && !npc.death && npc.state.vulnerable);
  }
  // Her call: the mage can be hit, and casts from 8 ticks on.
  wake(context, phase) {
    const npc = this.mage(context.world, phase);
    if (!npc?.alive) return;
    npc.untargetable = false;
    npc.state.vulnerable = true;
    npc.state.nextAttackAt = context.tick + mageFirstAttack;
  }
  // A mage's beam into her: her intro, and its phase's start (OBS: anim 1979 and projectile 2010 to her).
  empower(context, phase) {
    const npc = this.mage(context.world, phase);
    const boss = this.encounter.boss(context.world);
    if (!npc?.alive || !boss) return;
    this.encounter.visual(context, {
      animations: [{ actorId: npc.id, clipId: "cast" }],
      projectiles: [{
        spotAnimId: spotAnims.empower, sourcePosition: getProjectileSourcePosition(npc), target: buildActorVisualTarget(boss),
        startDelayCycles: 0, endDelayCycles: 90, slope: 3, startOffset: 0, startHeight: 190, endHeight: 120,
      }],
    });
  }
  mageTurn(actor, context) {
    const idle = { environmentalDamages: [] };
    const state = actor.state;
    if (!state.vulnerable || actor.death || context.tick < state.nextAttackAt || this.encounter.stage !== "fight") return idle;
    state.nextAttackAt = context.tick + mageAttackTicks;
    const living = this.party.living(context.world);
    if (living.length === 0) return idle;
    // inferred: at anyone of the party (OBS: at the recorder and the others alike).
    const member = living[Math.floor(this.encounter.random() * living.length)];
    const target = this.party.actorOf(member, context.world);
    faceActorToward(actor, target);
    const distance = chebyshev(actor.position, target.position);
    const delay = 1 + Math.floor((1 + distance) / 3); // the game: a spell lands 1 + (1 + distance) / 3 ticks after the cast
    const spec = state.mage;
    this.encounter.visual(context, {
      animations: [{ actorId: actor.id, clipId: "cast" }],
      projectiles: spec.projectile ? [{
        spotAnimId: spec.projectile, sourcePosition: getProjectileSourcePosition(actor), target: buildActorVisualTarget(target),
        startDelayCycles: 51, endDelayCycles: 51 + 10 * distance + 25, slope: 16, startOffset: 64, startHeight: 43, endHeight: 31,
      }] : [],
      graphics: [{ spotAnimId: spec.impact, target: buildActorVisualTarget(target), height: 0, delayCycles: delay * 30 }],
    });
    const damage = this.party.roll(actor, member, { formulaStyle: "magic", maxHit: mageMaxHit }, this.encounter.random, context.world);
    const freezes = spec.key === "glacies";
    this.encounter.later(delay, (ctx) => {
      if (!this.party.alive(member, ctx.world)) return;
      this.party.hurt(member, { damage, style: "magic", keep: 0, source: spec.name }, ctx);
      // WIKI: Glacies freezes for 6 ticks, through the prayer (when the last freeze ended over 5 ticks before).
      if (freezes && damage > 0 && this.party.freeze(member, glaciesFreeze, ctx.tick)) this.encounter.frozenMessage(member, ctx);
      if (spec.key === "umbra") {
        const blinded = this.party.drainStats(member, { attack: (stat) => Math.floor(stat.max * umbraBlind) }, ctx.world);
        if (blinded && this.party.isLocal(member)) this.encounter.message(ctx, "You have been blinded!");
      }
    });
    return idle;
  }
  // --- reavers --------------------------------------------------------------
  reavers(world) {
    return world.getNpcs().filter((npc) => reaverDefinition.isActor(npc));
  }
  // OBS: 2 for a team of four (6 of 7 siphons), 1 or 2 for three (3 of 5 were 2); WIKI: up to eight, by team size.
  // Here: half the team, a coin deciding the odd one, at least 1 and at most 8.
  reaverCount(teamSize) {
    const half = teamSize / 2;
    const extra = teamSize % 2 === 1 && this.encounter.random() < 0.5 ? 1 : 0;
    return Math.max(1, Math.min(8, Math.floor(half) + extra));
  }
  summonReavers(context, boss) {
    const encounter = this.encounter;
    // WIKI: the reavers of the last siphon die, and heal her for what they had left.
    let left = 0;
    for (const npc of this.reavers(context.world)) {
      if (!npc.alive || npc.death) continue;
      left += npc.vitals.hp;
      context.despawnNpc(npc.id);
    }
    if (left > 0) encounter.healBoss(boss, left, context);
    const count = this.reaverCount(this.party.members().length);
    const middle = middleOf(boss.position);
    for (let index = 0; index < count; index++) {
      const tile = this.reaverTile(middle, boss, context.world);
      if (!tile) continue;
      const hp = getMonsterHitpoints(npcTypeIds.reaver); // TABLE: 150
      context.spawnNpc(reaverDefinition.createActor(
        {
          id: `nex-reaver-${++this.reaverSerial}`, kind: "npc", role: "minion", npcTypeId: npcTypeIds.reaver, archetypeId: "nex_reaver", size: 2, alive: true,
          position: tile, previousPosition: [...tile], facing: 0, history: new Map(), spawnTick: context.tick,
          vitals: { hp, maxHp: hp }, formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.reaver)),
          combat: { attackSpeed: reaverAttackTicks, attackRange: 30, attackStyle: "magic", nextActionTick: 0, targetId: null, lastAttackTick: null, animations: { idle: null, walk: null, run: null, attack: null, death: null } },
        },
        { nextAttackAt: context.tick + 1 }, // OBS: the first cast the tick after they rise
      ));
    }
  }
  reaverTile(middle, boss, world) {
    const encounter = this.encounter;
    for (let attempt = 0; attempt < 40; attempt++) {
      const distance = encounter.randomInt(...reaverReach);
      const dx = encounter.randomInt(-distance, distance);
      const dy = encounter.random() < 0.5 ? -distance : distance;
      const [x, y] = encounter.random() < 0.5 ? [middle[0] + dx, middle[1] + dy] : [middle[0] + dy, middle[1] + dx];
      const ok = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].every((tile) => inChamber(tile) && isArenaTileWalkable(tile[0], tile[1]));
      if (!ok || gapTo([x, y], boss.position) < 2) continue;
      if (world.getNpcs().some((npc) => npc.alive && gapTo([x, y], npc.position, npc.size) === 0)) continue;
      return [x, y];
    }
    return null;
  }
  reaverTurn(actor, context) {
    const idle = { environmentalDamages: [] };
    if (actor.death || context.tick < actor.state.nextAttackAt || this.encounter.stage !== "fight") return idle;
    actor.state.nextAttackAt = context.tick + reaverAttackTicks;
    // OBS: at the nearest of the party.
    const near = this.party.byDistance(actor.position, actor.size, context.world)[0];
    if (!near) return idle;
    const member = near.member;
    const target = this.party.actorOf(member, context.world);
    faceActorToward(actor, target);
    const distance = gapTo(target.position, actor.position, actor.size);
    const delay = 1 + Math.floor((1 + distance) / 3);
    this.encounter.visual(context, {
      animations: [{ actorId: actor.id, clipId: "cast" }],
      projectiles: [{
        spotAnimId: spotAnims.reaverBolt, sourcePosition: getProjectileSourcePosition(actor), target: buildActorVisualTarget(target),
        startDelayCycles: 42, endDelayCycles: 42 + 6 * distance + 30, slope: 16, startOffset: 64, startHeight: 43, endHeight: 31,
      }],
      graphics: [{ spotAnimId: spotAnims.reaverImpact, target: buildActorVisualTarget(target), height: 0, delayCycles: delay * 30 }],
    });
    const damage = this.party.roll(actor, member, { formulaStyle: "magic", maxHit: reaverMaxHit }, this.encounter.random, context.world);
    this.encounter.later(delay, (ctx) => this.party.hurt(member, { damage, style: "magic", keep: 0, source: "Blood Reaver" }, ctx));
    return idle;
  }
  isReaver(npc) {
    return reaverDefinition.isActor(npc);
  }
  isMage(npc) {
    return mageDefinition.isActor(npc);
  }
  isStalagmite(npc) {
    return stalagmiteDefinition.isActor(npc);
  }
  reaverHealShare() {
    return reaverHealShare;
  }
  // Her next phase: the reavers left die (WIKI).
  clearReavers(context) {
    for (const npc of this.reavers(context.world)) if (npc.alive) context.despawnNpc(npc.id);
  }
  // --- stalagmites ------------------------------------------------------------
  spawnStalagmite(context, tile, serial) {
    const id = `nex-stalagmite-${serial}`;
    context.spawnNpc(stalagmiteDefinition.createActor(
      {
        id, kind: "npc", role: "minion", npcTypeId: npcTypeIds.stalagmite, archetypeId: "nex_stalagmite", size: 1, alive: true,
        position: [...tile], previousPosition: [...tile], facing: 0, history: new Map(), spawnTick: context.tick,
        vitals: { hp: 1, maxHp: 1 },
        // inferred: it has no stats; every hit reaches it (a stab or crush breaks it: encounter.js, playerHit).
        formulaStats: {
          burnImmunity: null, freezeResistance: 100, poisonResistance: 100, attributes: [], alwaysAccuratePlayerHit: true,
          levels: { attack: 1, strength: 1, defence: 1, ranged: 1, magic: 1 },
          offensive: { atk: 0, ranged: 0, magic: 0, str: 0, rangedStr: 0, magicStr: 0 },
          defensive: { stab: 0, slash: 0, crush: 0, rangedLight: 0, rangedStandard: 0, rangedHeavy: 0, magic: 0 },
        },
        combat: { attackSpeed: 4, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null, animations: { idle: null, walk: null, run: null, attack: null, death: null } },
      },
      {},
    ));
    return id;
  }
}
