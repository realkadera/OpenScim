// Vorkath's own judges of her combat achievements (her descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). Her 11 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts, the speed tasks and Extended Encounter are judged by the shared judges (client/combatAchievements/
// judges.js), the other six here. How each is judged:
// - her special attacks are the acid (its rapid fire, "Rapid fire", and its pools, "Acid") and the zombified spawn
//   (its explosion, "Zombified spawn"), as encounter.js names their hits; the fireball is one of her standard
//   attacks (WIKI: Vorkath/Strategies). Any hit of a special fails Dodging the Dragon, whatever it dealt (WIKI:
//   Dodging the Dragon: "regardless of the amount of damage it deals");
// - The Walk is judged per acid special: 12 of the player's attacks on her while it lasts, any attack, whether it
//   hits or not, and no hit of its rapid fire or pools (WIKI: The Walk). inferred: the game completes it as the
//   special ends; here it is completed with the kill, as every task is;
// - Zombie Destroyer: a spawn killed by the player's hits (its 38 hitpoints dealt: TABLE, WIKI) with no Crumble
//   Undead cast at it. inferred: as The Walk, completed with the kill;
// - "only your fists": every attack of the player's without a weapon or a spell; "melee weapons only": every attack a
//   melee one. Both need an attack at least;
// - "without losing any prayer points": the player's prayer points never went down (WIKI: Faithless Encounter: a
//   flick that drains none keeps it).
import { hitsFrom, unless, inARowUnless } from "../../combatAchievements/judges.js";

// Her actors' ids, as encounter.js gives them (bossActorId, spawnActorId); not imported, as encounter.js imports this.
const bossActorId = "vorkath";
const spawnActorId = "vorkath-spawn";

const theWalkAttacks = 12; // WIKI: The Walk
const spawnHitpoints = 38; // TABLE, WIKI (Zombified Spawn)
const acidHits = (run) => hitsFrom(run, "Rapid fire") + hitsFrom(run, "Acid");
const specialHits = (run) => acidHits(run) + hitsFrom(run, "Zombified spawn");

export const vorkathCombatAchievements = {
  observe(state, facts, { events, run }) {
    // The Walk: the acid special now running, its attacks and the hits of it so far.
    if (state.phase === "acid") {
      facts.acid ??= { attacks: 0, hitsBefore: acidHits(run) };
      for (const event of events) if (event.type === "attack_started" && event.sourceId === "player" && event.targetId === bossActorId) facts.acid.attacks++;
      if (acidHits(run) > facts.acid.hitsBefore) facts.acid.hit = true;
    } else if (facts.acid) {
      if (facts.acid.attacks >= theWalkAttacks && !facts.acid.hit && acidHits(run) === facts.acid.hitsBefore) facts.walked = true;
      facts.acid = null;
    }
    // Zombie Destroyer: the spawn now up, the damage dealt to it and whether Crumble Undead was cast at it.
    if (state.spawnAlive) {
      facts.spawn ??= { damage: 0, crumbled: false };
      for (const event of events) {
        if (event.type === "hit_applied" && event.targetId === spawnActorId) facts.spawn.damage += event.damage ?? 0;
        if (event.type === "attack_started" && event.sourceId === "player" && event.targetId === spawnActorId && event.spellId === "Crumble Undead") facts.spawn.crumbled = true;
      }
      if (facts.spawn.damage >= spawnHitpoints && !facts.spawn.crumbled) facts.zombieDestroyed = true;
    } else facts.spawn = null;
  },
  judges: {
    "The Walk": { check: (run) => Boolean(run.facts.walked) },
    "Zombie Destroyer": { check: (run) => Boolean(run.facts.zombieDestroyed) },
    "Dodging the Dragon": inARowUnless(5, (run) => specialHits(run) > 0, "You were hit by a special attack."),
    "Stick 'em With the Pointy End": {
      check: (run) => run.attacks > 0 && [...run.attackStyles].every((style) => style === "melee"),
      failed: (run) => [...run.attackStyles].some((style) => style !== "melee") && "You attacked with a weapon other than a melee one.",
    },
    "The Fremennik Way": {
      check: (run) => run.attacks > 0 && [...run.attackWeapons].every((weapon) => weapon === "none") && run.spells.size === 0,
      failed: (run) => ([...run.attackWeapons].some((weapon) => weapon !== "none") || run.spells.size > 0) && "You attacked with something other than your fists.",
    },
    "Faithless Encounter": unless((run) => run.prayerLost, "You lost prayer points."),
  },
};
