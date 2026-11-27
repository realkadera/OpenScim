// The teammates the encounter plays itself (party.js, members of the kind
// "bot"): rangers in the wiki's ranged setup, who fight as the recorded team
// fought. They are NPCs of the world, drawn as player-like NPCs of the cache
// (ids.js), that the player cannot attack and that block no one.
//
// What they do, from the recordings (OBS) where the recordings show it and the
// wiki's strategy guide (WIKI, Nex/Strategies) otherwise:
// - They stand by her (a tile from her body, one to a side) in her smoke,
//   blood, ice and Zaros phases (OBS: the team around her, a tile away), and 8
//   tiles off in her shadow phase (OBS: 8 to 11; WIKI: "max range").
// - They pray against what she uses in the phase: magic, missiles in her
//   shadow phase (OBS: the other players' overhead prayers).
// - They shoot the mage she calls once it can be hit, then her (OBS: Fumus dead
//   40 to 75 ticks after her call), and her reavers before her.
// - They step off her shadows, out of the aisle she looks down, out of her
//   containment, away from her when she sacrifices them, and they break the
//   stalagmites of an ice prison with a stab.
// Everything they decide comes from the encounter's seeded generator. A
// teammate's skill (`reaction`) is the chance it sees a special in time.
import { isArenaTileWalkable } from "../../engine/arena.js";
import { defineNpc } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget, faceActorToward, getProjectileSourcePosition } from "../shared/npcHelpers.js";
import { npcTypeIds, spotAnims, gapTo, chebyshev, middleOf, inChamber, key } from "./ids.js";

// inferred: a maxed account in the wiki's best ranged setup (Masori (f), necklace of anguish, Zaryte crossbow, ruby
// dragon bolts (e), Rigour, a ranging potion): its levels and bonuses, near enough for her rolls at it and its at her.
const rangerStats = {
  burnImmunity: null, freezeResistance: 0, poisonResistance: 0, attributes: [],
  levels: { attack: 99, strength: 99, defence: 99, ranged: 112, magic: 99 },
  offensive: { atk: 0, ranged: 270, magic: 0, str: 0, rangedStr: 120, magicStr: 0 },
  defensive: { stab: 110, slash: 100, crush: 120, rangedLight: 150, rangedStandard: 150, rangedHeavy: 150, magic: 130 },
};
const rangerMaxHit = 52; // inferred: the Zaryte crossbow with ruby dragon bolts (e) in that setup
// WIKI (Ruby dragon bolts (e), Zaryte crossbow): 6% a shot, 10% more with the Zaryte crossbow, for a fifth of the
// target's hitpoints, at most 100.
const rubyChance = 0.066;
const rubyShare = 0.2;
const rubyMost = 100;
const rangerAttackTicks = 5; // WIKI: the Zaryte crossbow, rapid
const rangerReach = 9; // inferred: the Zaryte crossbow's 7, 9 on longrange (WIKI: 8 to 10 tiles in her shadow phase)
const stabTicks = 4; // inferred: a stab with the fang (WIKI: "Osmumten's fang or Belle's folly")
const hitpoints = 99;
const prayerPoints = 99;
const food = { count: 40, heal: 16, below: 60 }; // inferred: Saradomin brew doses (WIKI's inventory: brews), under 60
const restores = { count: 8, restore: 32, below: 25 }; // inferred: super restores
export const reaction = 0.85; // inferred: how often a teammate sees a special in time
const shadowRange = 8; // OBS: 8 to 11 tiles off in her shadow phase
// The sides they take around her: a tile from her body, north, south, east, west (OBS: the team around her), and
// two more for a team of six.
const sides = [[1, 3], [1, -1], [3, 1], [-1, 1], [3, 3], [-1, -1]];

const teammateDefinition = defineNpc({
  id: "nex-teammate",
  move: ({ actor, context, config }) => config.teammates.move(actor, context),
  tick: ({ actor, context, config }) => config.teammates.turn(actor, context),
});
export { teammateDefinition };

export class Teammates {
  constructor(encounter) {
    this.encounter = encounter;
  }
  get party() {
    return this.encounter.party;
  }
  // The bots of a run (the mechanics' team size, less the player).
  createActors(count, starts) {
    const actors = [];
    for (let index = 0; index < count; index++) {
      const id = `nex-mate-${index + 1}`;
      const position = [...starts[index % starts.length]];
      actors.push(teammateDefinition.createActor(
        {
          id, kind: "npc", role: "ally", npcTypeId: npcTypeIds.rangerMate, archetypeId: "nex_teammate", size: 1, alive: true,
          untargetable: true, blocksNpcMovement: false, menuColor: "#55dd55",
          position, previousPosition: [...position], facing: 1024, history: new Map(),
          vitals: { hp: hitpoints, maxHp: hitpoints }, formulaStats: structuredClone(rangerStats),
          combat: {
            attackSpeed: rangerAttackTicks, attackRange: rangerReach, attackStyle: "range", nextActionTick: 0, targetId: null, lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {
          name: `Teammate ${index + 1}`, role: "ranger", side: sides[index % sides.length], protection: "magic", prayer: prayerPoints,
          food: food.count, restores: restores.count, nextAttackAt: 3 + index, dead: false, goal: null, mask: index === 0, prayerOffUntil: 0,
        },
      ));
    }
    return actors;
  }
  memberOf(actor) {
    return this.party.member(actor.id);
  }

  // --- where it goes ---------------------------------------------------------
  move(actor, context) {
    const encounter = this.encounter;
    const member = this.memberOf(actor);
    if (!member || actor.state.dead || this.party.frozenAt(member, context.tick)) return [];
    const goal = this.goal(actor, context);
    actor.state.goal = goal;
    if (!goal || (goal[0] === actor.position[0] && goal[1] === actor.position[1])) return [];
    const path = [];
    let at = actor.position;
    for (let step = 0; step < 2; step++) {
      const next = this.stepToward(at, goal, encounter);
      if (!next) break;
      path.push(next);
      at = next;
      if (at[0] === goal[0] && at[1] === goal[1]) break;
    }
    return path.length ? [{ npcId: actor.id, path }] : [];
  }
  stepToward(from, goal, encounter) {
    const dx = Math.sign(goal[0] - from[0]);
    const dy = Math.sign(goal[1] - from[1]);
    const options = [[from[0] + dx, from[1] + dy], [from[0] + dx, from[1]], [from[0], from[1] + dy]];
    return options.find((tile) => (tile[0] !== from[0] || tile[1] !== from[1]) && this.walkable(tile) && !encounter.isBlockedForPlayers(tile));
  }
  walkable(tile) {
    return inChamber(tile) && isArenaTileWalkable(tile[0], tile[1]);
  }
  // Where it wants to be this tick: away from what is coming, else at its post.
  goal(actor, context) {
    const encounter = this.encounter;
    const boss = encounter.boss(context.world);
    const member = this.memberOf(actor);
    if (!boss) return null;
    const here = actor.position;
    const danger = encounter.dangerAt.bind(encounter);
    // Nex dead: her wrath, 5 x 5 about her (WIKI): out of it.
    if (!boss.alive || encounter.stage === "dead") return gapTo(here, boss.position) <= 1 ? this.away(here, boss.position, 3) : null;
    // Sacrificed: 8 tiles from her (WIKI: 7 or more).
    if (encounter.specials.sacrificeTarget === member.id && this.sees(actor, "sacrifice")) {
      return gapTo(here, boss.position) >= 8 ? null : this.away(here, boss.position, 8);
    }
    // A prison to break: beside a stalagmite (or inside it, the prisoner).
    const stalagmite = this.stalagmiteToBreak(actor, context);
    if (stalagmite) return chebyshev(here, stalagmite.position) <= 1 ? null : this.beside(stalagmite.position, here);
    // Danger underfoot (a shadow, the aisle she looks down, her containment, her darkness): the nearest safe tile.
    if (danger(here, member) && this.sees(actor, "danger")) return this.nearestSafe(here, member) ?? null;
    // A mage or a reaver to shoot, out of reach: near enough (OBS: the team shot the mage from by her, or walked up).
    const target = this.pickTarget(actor, context);
    if (target && target.id !== boss.id && gapTo(here, target.position, target.size) > rangerReach - 2) return this.toward(here, target, rangerReach - 2, member);
    return this.post(actor, boss, member);
  }
  // Whether a teammate saw a special coming, decided once a special (encounter.specialSerial).
  sees(actor, what) {
    const serial = this.encounter.specialSerial;
    const memo = actor.state.seen;
    if (memo?.serial === serial && memo.what === what) return memo.sees;
    const sees = this.encounter.random() < reaction;
    actor.state.seen = { serial, what, sees };
    return sees;
  }
  post(actor, boss, member) {
    const encounter = this.encounter;
    const [sx, sy] = actor.state.side;
    const base = [boss.position[0] + sx, boss.position[1] + sy];
    let tile = base;
    const far = encounter.phase === "shadow" || encounter.specials.darkness;
    if (far) {
      const middle = middleOf(boss.position);
      const out = [Math.sign(base[0] - middle[0]), Math.sign(base[1] - middle[1])];
      const range = encounter.phase === "shadow" ? shadowRange : 3;
      tile = [middle[0] + out[0] * (range + 1), middle[1] + out[1] * (range + 1)];
    }
    tile = this.nearestWalkable(tile) ?? actor.position;
    if (encounter.dangerAt(tile, member)) tile = this.nearestSafe(tile, member) ?? tile;
    return tile;
  }
  // The nearest safe tile within `range` of a target, on the way from here.
  toward(from, target, range, member) {
    let best = null;
    for (let x = target.position[0] - range; x <= target.position[0] + target.size - 1 + range; x++) {
      for (let y = target.position[1] - range; y <= target.position[1] + target.size - 1 + range; y++) {
        const tile = [x, y];
        if (gapTo(tile, target.position, target.size) === 0 || !this.walkable(tile) || this.encounter.isBlockedForPlayers(tile)) continue;
        if (this.encounter.dangerAt(tile, member) || this.underHer(tile)) continue;
        if (!best || chebyshev(tile, from) < chebyshev(best, from)) best = tile;
      }
    }
    return best;
  }
  underHer(tile) {
    const boss = this.encounter.boss();
    return Boolean(boss?.alive && gapTo(tile, boss.position) === 0);
  }
  away(from, position, gap) {
    const middle = middleOf(position);
    let dx = Math.sign(from[0] - middle[0]);
    let dy = Math.sign(from[1] - middle[1]);
    if (dx === 0 && dy === 0) dx = 1;
    for (let distance = gap + 2; distance >= gap; distance--) {
      const tile = this.nearestWalkable([middle[0] + dx * (distance + 1), middle[1] + dy * (distance + 1)]);
      if (tile && gapTo(tile, position) >= gap) return tile;
    }
    return this.nearestWalkable([middle[0] + dx * (gap + 2), middle[1] + dy * (gap + 2)]);
  }
  beside(tile, from) {
    let best = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const candidate = [tile[0] + dx, tile[1] + dy];
        if ((dx || dy) && this.walkable(candidate) && !this.encounter.isBlockedForPlayers(candidate)) {
          if (!best || chebyshev(candidate, from) < chebyshev(best, from)) best = candidate;
        }
      }
    }
    return best;
  }
  nearestWalkable(tile) {
    for (let radius = 0; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = [tile[0] + dx, tile[1] + dy];
          if (this.walkable(candidate) && !this.encounter.isBlockedForPlayers(candidate)) return candidate;
        }
      }
    }
    return null;
  }
  nearestSafe(tile, member) {
    for (let radius = 1; radius <= 6; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = [tile[0] + dx, tile[1] + dy];
          if (this.walkable(candidate) && !this.encounter.isBlockedForPlayers(candidate) && !this.encounter.dangerAt(candidate, member) && !this.underHer(candidate)) return candidate;
        }
      }
    }
    return null;
  }
  stalagmiteToBreak(actor, context) {
    const live = this.encounter.specials.liveStalagmites(context.world);
    if (live.length === 0) return null;
    // The nearest, and the one most of the others are not on (inferred: they spread over them).
    return live.sort((a, b) => chebyshev(a.position, actor.position) - chebyshev(b.position, actor.position))[0];
  }

  // --- its turn ---------------------------------------------------------------
  turn(actor, context) {
    const idle = { environmentalDamages: [] };
    const encounter = this.encounter;
    const member = this.memberOf(actor);
    if (!member || actor.state.dead) return idle;
    const now = context.tick;
    this.pray(actor, context);
    this.supplies(actor, now);
    if (now < actor.state.nextAttackAt) return idle;
    const stalagmite = this.stalagmiteToBreak(actor, context);
    if (stalagmite && chebyshev(actor.position, stalagmite.position) <= 1) {
      this.stab(actor, stalagmite, context);
      return idle;
    }
    const target = this.pickTarget(actor, context);
    if (!target) return idle;
    if (gapTo(actor.position, target.position, target.size) > rangerReach) return idle;
    if (gapTo(actor.position, target.position, target.size) === 0) return idle;
    this.shoot(actor, target, context);
    return idle;
  }
  // WIKI: the protection prayer the phase calls for; none while she has turned it off.
  pray(actor, context) {
    const encounter = this.encounter;
    if (actor.state.prayer <= 0 || context.tick < actor.state.prayerOffUntil) {
      actor.state.protection = null;
    } else {
      actor.state.protection = encounter.phase === "shadow" ? "range" : "magic";
    }
    actor.overheadPrayers = actor.state.protection ? [actor.state.protection] : undefined;
  }
  supplies(actor, now) {
    const state = actor.state;
    if (actor.vitals.hp < food.below && state.food > 0) {
      state.food--;
      actor.vitals = { ...actor.vitals, hp: Math.min(actor.vitals.maxHp, actor.vitals.hp + food.heal) };
      state.nextAttackAt = Math.max(state.nextAttackAt, now + 3); // the game: eating delays the next attack 3 ticks
    }
    if (state.prayer < restores.below && state.restores > 0) {
      state.restores--;
      state.prayer = Math.min(prayerPoints, state.prayer + restores.restore);
    }
  }
  pickTarget(actor, context) {
    const encounter = this.encounter;
    const world = context.world;
    const reavers = encounter.minions.reavers(world).filter((npc) => npc.alive && !npc.death);
    if (reavers.length) return reavers.sort((a, b) => chebyshev(a.position, actor.position) - chebyshev(b.position, actor.position))[0];
    const mage = encounter.minions.vulnerableMage(world);
    if (mage) return mage;
    const boss = encounter.boss(world);
    // WIKI: not while she kneels for her siphon (the damage heals her), nor in her intro.
    if (!boss?.alive || encounter.specials.kneeling || encounter.stage !== "fight") return null;
    return boss;
  }
  shoot(actor, target, context) {
    const encounter = this.encounter;
    const attack = rollNpcAttack({
      attacker: actor, target, random: encounter.random,
      plan: { formulaStyle: "ranged", damageType: "range", attackKind: "range_arrow", maxHit: rangerMaxHit, impactDelayTicks: 0, sourceDeathPolicy: "persist" },
    });
    let damage = attack?.accuracySucceeded ? attack.rolledDamage : 0;
    if (encounter.random() < rubyChance) damage = Math.min(rubyMost, Math.floor(target.vitals.hp * rubyShare));
    faceActorToward(actor, target);
    actor.state.nextAttackAt = context.tick + rangerAttackTicks;
    actor.combat.lastAttackTick = context.tick;
    const distance = gapTo(actor.position, target.position, target.size);
    // The game: a crossbow's bolt lands 1 + (3 + distance) / 6 ticks after the shot.
    const delay = 1 + Math.floor((3 + distance) / 6);
    const end = 41 + 5 * distance + 30;
    encounter.visual(context, {
      animations: [{ actorId: actor.id, clipId: "shoot" }],
      projectiles: [{
        spotAnimId: spotAnims.bolt, sourcePosition: getProjectileSourcePosition(actor), target: buildActorVisualTarget(target),
        startDelayCycles: 41, endDelayCycles: end, slope: 5, startOffset: 11, startHeight: 40, endHeight: 36,
      }],
    });
    const member = this.memberOf(actor);
    encounter.later(delay, (ctx) => encounter.teamHit(member, target.id, damage, "range", ctx));
  }
  stab(actor, stalagmite, context) {
    const encounter = this.encounter;
    faceActorToward(actor, stalagmite);
    actor.state.nextAttackAt = context.tick + stabTicks;
    encounter.visual(context, { animations: [{ actorId: actor.id, clipId: "stab" }] });
    // WIKI: a stab or crush breaks a stalagmite (Belle's folly and the fang "are reliable").
    encounter.specials.breakStalagmite(stalagmite.id, context);
  }
  died(member, context) {
    const actor = this.party.actorOf(member, context.world);
    if (!actor || actor.state.dead) return;
    actor.state.dead = true;
    actor.state.protection = null;
    actor.overheadPrayers = undefined;
    this.encounter.visual(context, { animations: [{ actorId: actor.id, clipId: "death" }] });
    this.encounter.message(context, { text: `${member.name} has been slain by Nex.`, color: "#ff3045" });
    this.encounter.later(4, (ctx) => ctx.despawnNpc?.(actor.id));
  }
  // Which tiles teammates stand on (her containment and wrath ask; the shadows go under them).
  tiles(world) {
    return new Set(this.party.living(world).filter((member) => member.kind === "bot").map((member) => key(this.party.tile(member, world))));
  }
}
