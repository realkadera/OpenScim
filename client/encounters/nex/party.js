// The party Nex fights: the player and the rest of the team.
//
// Nex is the first fight of OpenScim with more than one player in it. The
// engine still has one player (`world.getPlayer()`, the actor "player"), and
// the site has no backend yet to put several people in one fight
// (ROADMAP.md: "Multiplayer", "Phase 5 — Backend"). So the encounter fights a
// party, and the party has members of three kinds:
//
// - "local": the player at this keyboard, the engine's player actor. What
//   Nex does to him goes through the engine (hazards, prayers, movement).
// - "bot": a teammate the encounter plays itself (teammates.js), an NPC of
//   the world drawn as a player-like NPC. It is the stand-in for a person
//   until the fight is played by people, and stays as the way to fill a team.
// - "remote": a person on another computer. Not made yet: see below.
//
// Every rule of the fight that touches a player (her targeting, her attacks
// at everyone, a virus that spreads from one to the next, a sacrifice, a
// prison) is written against a member, through the methods of this class,
// never against `world.getPlayer()`. That is the seam multiplayer needs: a
// remote member is one more kind of member, with the same methods.
//
// How a remote member will plug in (when the engine has several players and
// the site a backend):
// - The fight runs in lockstep: every client runs the same simulation from the
//   same seeds (the encounter's random generator is seeded, `getSeeds()`), and
//   a tick goes on when every client's inputs for it have arrived. The server
//   relays the inputs and keeps the seeds; it does not simulate. Nothing in
//   this encounter reads a clock or Math.random after the seed is drawn.
// - Each remote member is an engine player actor of its own (an id other than
//   "player"), so `actorOf` returns it and `isPlayerActor` is true for it. Its
//   hits are the engine's hazards for that player, as the local player's are.
// - `members()` lists the local player and the remote players in the order the
//   server gave them (the same on every client), then the bots that fill the
//   team (the mechanics' team size).
// - Damage contribution (her drops are shared by it, and the MVP is who did
//   the most) is kept per member here (`contribution`), so the victory screen
//   and a later loot table can read it.
import { Prayer } from "../../engine/prayerTables.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { gapTo, chebyshev } from "./ids.js";

export const LOCAL_ID = "player";

// What a protection prayer is called by the engine, by the style it protects from.
const enginePrayer = { magic: Prayer.ProtectMagic, range: Prayer.ProtectRange, melee: Prayer.ProtectMelee };
const styleOfPrayer = new Map(Object.entries(enginePrayer).map(([style, prayer]) => [prayer, style]));

// WIKI (Nex/Strategies, "Choke"): a gas mask, a facemask or a slayer helmet halves the virus. CACHE: their item ids.
const virusMasks = new Set([1506, 4164, 11864, 11865, 19639, 19641, 19643, 19645, 19647, 19649, 21264, 21266, 21888, 21890, 23073, 23075, 24370, 24444, 25177, 25179, 25181, 25183, 25185, 25187, 25898, 25900, 25902, 25904, 25910, 25912]);

export class Party {
  constructor(encounter) {
    this.encounter = encounter;
    this.reset([]);
  }
  // The members of a run: the local player first, then the people the server seats with him (`remote`, the same
  // order on every client; none until there is a server), then the bots that fill the team (teammates.js).
  reset(bots, remote = []) {
    this.list = [
      { id: LOCAL_ID, kind: "local", name: "You" },
      ...remote.map((person) => ({ id: person.id, kind: "remote", name: person.name })),
      ...bots.map((bot) => ({ id: bot.id, kind: "bot", name: bot.name, role: bot.role })),
    ];
    this.contribution = new Map(this.list.map((member) => [member.id, 0]));
    this.frozen = new Map(); // member id -> the tick the freeze ends
    this.lastFreezeEnd = new Map(); // member id -> the tick the last freeze ended (WIKI: a new one only 5 ticks after)
  }
  members() {
    return this.list;
  }
  member(id) {
    return this.list.find((member) => member.id === id);
  }
  isPlayerActor(member) {
    return member.kind === "local" || member.kind === "remote";
  }
  isLocal(member) {
    return member?.kind === "local";
  }
  actorOf(member, world = this.encounter.world) {
    if (!world || !member) return undefined;
    if (member.kind === "local") return world.getPlayer();
    // A remote member: an engine player actor of its own (not made yet: see the header).
    if (member.kind === "remote") return world.actors.get(member.id);
    return world.getNpc(member.id);
  }
  alive(member, world) {
    const actor = this.actorOf(member, world);
    if (!actor?.alive) return false;
    return member.kind === "bot" ? !actor.state.dead : true;
  }
  living(world) {
    return this.list.filter((member) => this.alive(member, world));
  }
  tile(member, world) {
    return this.actorOf(member, world)?.position;
  }
  // The protection prayer a member has on: "magic", "range", "melee" or null.
  protection(member, world) {
    const actor = this.actorOf(member, world);
    if (!actor) return null;
    if (member.kind === "bot") return actor.state.protection ?? null;
    return styleOfPrayer.get(actor.activePrayer) ?? null;
  }
  prayerPoints(member, world) {
    const actor = this.actorOf(member, world);
    if (!actor) return 0;
    if (member.kind === "bot") return actor.state.prayer;
    return actor.prayerState?.points ?? actor.stats?.prayer?.current ?? 0;
  }
  drainPrayer(member, amount, world) {
    const actor = this.actorOf(member, world);
    if (!actor || amount <= 0) return;
    if (member.kind === "bot") {
      actor.state.prayer = Math.max(0, actor.state.prayer - amount);
      if (actor.state.prayer === 0) actor.state.protection = null;
      return;
    }
    const points = Math.max(0, (actor.prayerState?.points ?? 0) - amount);
    if (actor.prayerState) actor.prayerState = { ...actor.prayerState, points };
    if (actor.stats?.prayer) actor.stats = { ...actor.stats, prayer: { ...actor.stats.prayer, current: points } };
  }
  // Her drains of a member's combat stats (Turmoil, Umbra's barrage): `drains` maps a stat ("attack", "strength",
  // "defence", "ranged", "magic") to the level it falls to, from the stat ({ current, max }); a drain never raises
  // one. Returns whether any fell. The player's levels only: a bot fights by fixed formula stats (teammates.js).
  drainStats(member, drains, world) {
    const actor = this.actorOf(member, world);
    if (!actor?.stats || member.kind === "bot") return false;
    let stats = actor.stats;
    for (const [name, to] of Object.entries(drains)) {
      const stat = stats[name];
      if (!stat) continue;
      const level = Math.max(0, Math.min(stat.current, to(stat)));
      if (level !== stat.current) stats = { ...stats, [name]: { ...stat, current: level } };
    }
    if (stats === actor.stats) return false;
    actor.stats = stats;
    return true;
  }
  // Her specials that turn a protection prayer off (her drag, containment, ice prison): for the player, until a tick.
  disableProtection(member, context, untilTick) {
    const actor = this.actorOf(member, context.world);
    if (!actor) return;
    if (member.kind === "bot") {
      actor.state.protection = null;
      actor.state.prayerOffUntil = untilTick;
      return;
    }
    context.setProtectionPrayer?.(null);
    if (untilTick !== undefined) context.disableProtectionPrayersUntil?.(untilTick);
  }
  // Freezes (her ice barrage, Glacies, her ice prison): a member held where it stands. WIKI (Nex/Strategies, ref. 6):
  // a new freeze takes only if the last ended more than 5 ticks before.
  freeze(member, ticks, now, { ignoreGap = false } = {}) {
    if (!ignoreGap) {
      if (this.frozenAt(member, now)) return false;
      const ended = this.lastFreezeEnd.get(member.id);
      if (ended !== undefined && now - ended <= 5) return false;
    }
    const until = now + ticks;
    this.frozen.set(member.id, Math.max(until, this.frozen.get(member.id) ?? 0));
    this.lastFreezeEnd.set(member.id, this.frozen.get(member.id));
    return true;
  }
  unfreeze(member, now) {
    if (!this.frozenAt(member, now)) return;
    this.frozen.set(member.id, now);
    this.lastFreezeEnd.set(member.id, now);
  }
  frozenAt(member, now) {
    return (this.frozen.get(member.id) ?? -1) > now;
  }
  // A member moved by her (her drag, a prison's shove).
  moveTo(member, tile, context) {
    const actor = this.actorOf(member, context.world);
    if (!actor) return;
    if (member.kind === "bot") {
      actor.previousPosition = [...actor.position];
      actor.position = [...tile];
      actor.movementPath = [];
      return;
    }
    context.teleportPlayer?.([...tile]);
  }
  // The magic defence bonus a member wears (her virus goes to the furthest with the least, WIKI).
  magicDefence(member, world) {
    const actor = this.actorOf(member, world);
    if (!actor) return 0;
    if (member.kind === "bot") return actor.formulaStats?.defensive?.magic ?? 0;
    return actor.equipmentStats?.defenceMagic ?? 0;
  }
  wearsVirusMask(member, world) {
    const actor = this.actorOf(member, world);
    if (!actor) return false;
    if (member.kind === "bot") return actor.state.mask === true;
    return virusMasks.has(actor.equipment?.head?.id ?? actor.equipment?.head);
  }
  // Nex's roll at a member: accuracy and damage by the game's formulas against what it wears (the player's equipment
  // and prayers; a bot's formula stats). Returns the damage before the protection prayer.
  roll(boss, member, { formulaStyle, maxHit, alwaysHits = false }, random, world) {
    const target = this.actorOf(member, world);
    if (!target) return 0;
    const attack = rollNpcAttack({
      attacker: boss, target, random,
      plan: { formulaStyle, damageType: "typeless", attackKind: "typeless", maxHit, impactDelayTicks: 0, sourceDeathPolicy: "persist", alwaysHits },
    });
    if (!attack) return 0;
    const damage = typeof attack.rolledDamage === "number" ? attack.rolledDamage : attack.rolledDamage[1];
    return attack.accuracySucceeded ? damage : 0;
  }
  // A hit on a member as it lands. `hit`: { damage, style ("magic" | "range" | "melee" | "typeless"), keep (the share
  // a protection prayer against `style` lets through, 0 to block it), keepWhen (the protection that counts, when it
  // was judged earlier), source, hitsplatType? }. Returns the damage done (for a bot; for the player the engine
  // decides as it applies the hazard, after this returns).
  hurt(member, hit, context) {
    const world = context.world;
    if (!this.alive(member, world)) return 0;
    const style = hit.style ?? "typeless";
    const keep = hit.keep ?? 0;
    if (this.isPlayerActor(member)) {
      const player = this.actorOf(member, world);
      // The engine's hazards are the local player's; a remote member's will be its own engine player's (ROADMAP).
      if (member.kind !== "local") return 0;
      this.encounter.pending.push({
        baseDamage: hit.damage, attackType: style, source: hit.source ?? "Nex",
        ...(style === "typeless" ? {} : { prayerReduction: keep <= 0 ? { type: "block" } : { type: "reduce", value: keep } }),
        ...(hit.hitsplatType ? { hitsplatType: hit.hitsplatType } : {}),
        playerPosition: [...player.position],
      });
      const prayed = style !== "typeless" && this.protection(member, world) === style;
      return prayed ? Math.floor(hit.damage * keep) : hit.damage;
    }
    const actor = this.actorOf(member, world);
    const prayed = style !== "typeless" && (hit.keepWhen ?? this.protection(member, world)) === style;
    const damage = Math.min(actor.vitals.hp, prayed ? Math.floor(hit.damage * keep) : hit.damage);
    actor.vitals = { ...actor.vitals, hp: actor.vitals.hp - damage };
    context.tickEvents.emit({ type: "hitsplat_spawned", targetId: actor.id, amount: damage, hitsplatType: damage > 0 ? (hit.hitsplatType ?? "damage") : "block" });
    if (actor.vitals.hp <= 0) this.encounter.teammates.died(member, context);
    return damage;
  }
  // Healing a member (a reaver's hit heals whoever dealt it; WIKI).
  heal(member, amount, context) {
    const actor = this.actorOf(member, context.world);
    if (!actor || amount <= 0 || !this.alive(member, context.world)) return;
    const max = actor.vitals.maxHp ?? actor.stats?.hitpoints?.max ?? 99;
    const hp = Math.min(max, actor.vitals.hp + amount);
    if (hp <= actor.vitals.hp) return;
    if (member.kind === "bot") {
      actor.vitals = { ...actor.vitals, hp };
      return;
    }
    actor.vitals = { ...actor.vitals, hp };
    if (actor.stats?.hitpoints) actor.stats = { ...actor.stats, hitpoints: { ...actor.stats.hitpoints, current: hp } };
  }
  credit(memberId, damage) {
    if (damage > 0) this.contribution.set(memberId, (this.contribution.get(memberId) ?? 0) + damage);
  }
  // The members nearest a footprint first (her targeting).
  byDistance(position, size, world) {
    return this.living(world)
      .map((member) => ({ member, gap: gapTo(this.tile(member, world), position, size) }))
      .sort((a, b) => a.gap - b.gap);
  }
  within(tile, range, world) {
    return this.living(world).filter((member) => chebyshev(this.tile(member, world), tile) <= range);
  }
  snapshot(world, now) {
    return this.list.map((member) => ({
      id: member.id, kind: member.kind, name: member.name, role: member.role ?? null, alive: this.alive(member, world),
      protection: this.protection(member, world), frozen: this.frozenAt(member, now), damage: this.contribution.get(member.id) ?? 0,
    }));
  }
}
