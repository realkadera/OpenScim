// The Alchemical Hydra's own judges of its combat achievements (its
// descriptor's `combatAchievements`, client/combatAchievements/tracker.js). Its
// 12 tasks are the wiki's (client/combatAchievements/tasks.js, checked against
// WIKI: Alchemical Hydra, Combat Achievements, 2026-11-27); the kill counts,
// the speed tasks, Working Overtime and Alcleanical Hydra are judged by the
// shared judges (client/combatAchievements/judges.js), the other six here. How
// each is judged:
// - "hit by" a mechanic is a hit on the player its encounter names: the
//   lightning's currents "Lightning" (lightning.js), the flame wall's and the
//   tracking fire's "Fire" (fire.js, the burn after them "Burn"), the acid's
//   pools "Poison pool" (poison.js);
// - empowered is the snapshot's `empowered`, set as a wrong vent erupts under
//   it (encounter.js); a flame wall spawned is its flame special reaching its
//   breath, the stage that lights the walls, as it stops in the middle (WIKI:
//   The Flame Skipper: it fails once the Hydra "reach[es] the middle and
//   stop[s] moving");
// - a kill's time runs from the fight's first tick to the tick it dies. Where
//   the game's timer starts is not on the wiki's pages (inferred);
// - "without leaving the room" is clean kills in a row of the Hydra without
//   choosing another fight or dying;
// - the kill counts are the kills in this browser that counted;
// - a task fails (`failed`, told in the chat when the player wants it) the
//   tick it can no longer be met: the hit, the empowering, the flame wall,
//   the time run past, a weapon other than the greataxe or more than 10
//   hitpoints. The kill counts and Working Overtime do not fail in a fight.
//   `failed` gives the reason the chat line tells after the task's name
//   ("You have failed <task>: <reason>", chat.js). inferred: the Hydra's own
//   reasons are not recorded; these are written as the recorded ones of solo
//   tasks are (OBS (rsprox, ToA): "You lost a prayer point.").
import { hitsFrom, unless } from "../../combatAchievements/judges.js";

// Dharok's greataxe and its degraded forms (client/data/equipment.js).
const dharoksGreataxes = new Set([4718, 4886, 4887, 4888, 4889, 4890]);
const onlyGreataxe = (run) => [...run.weapons].every((id) => dharoksGreataxes.has(id));

export const alchemicalHydraCombatAchievements = {
  observe(state, facts) {
    if (state.empowered) facts.empowered = true;
    if (state.fireSpecial?.stage === "breath") facts.flameWall = true;
  },
  judges: {
    "Lightning Lure": unless((run) => hitsFrom(run, "Lightning") > 0, "You were hit by the lightning attack."),
    "Don't Flame Me": unless((run) => hitsFrom(run, "Fire") > 0, "You were hit by the flame wall attack."),
    "Unrequired Antipoisons": unless((run) => hitsFrom(run, "Poison pool") > 0, "You were hit by the acid pool attack."),
    "Mixing Correctly": unless((run) => Boolean(run.facts.empowered), "The Alchemical Hydra was empowered."),
    "The Flame Skipper": unless((run) => Boolean(run.facts.flameWall), "The Alchemical Hydra spawned a flame wall attack."),
    "No Pressure": {
      check: (run) => run.weapons.size > 0 && onlyGreataxe(run) && run.highestHp <= 10,
      failed: (run) => (!onlyGreataxe(run) ? "You used a weapon other than Dharok's greataxe." : run.highestHp > 10 && "You had more than 10 Hitpoints."),
    },
  },
};
