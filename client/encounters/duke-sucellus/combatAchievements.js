// Duke Sucellus's own judges of his combat achievements (his descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). His 9 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts and the speed tasks are judged by the shared judges, the other three here. How each is judged:
// - avoidable damage (WIKI: Perfect Duke Sucellus): any hit of his magic attack, even a 0 on the prayer ("praying
//   against them will still fail the achievement"), and damage from his slam, his gaze and the gas, as encounter.js
//   names them. The icicles' chip as they rise is not avoidable ("considered unavoidable");
// - Perfect Duke Sucellus: 5 kills without it in one visit, not in a row (WIKI: "rather than having to do so 5 kills
//   in a row");
// - Cold Feet: without it, and the player never running (WIKI: "including the potion preparation portion");
// - Mirror Image: every attack of the player's on him on a tick he starts one of his (WIKI: Mirror Image). A kill by
//   recoil alone attacks never, and meets it.
import { hitsFrom, hitsExcept, unless, inOneVisitUnless } from "../../combatAchievements/judges.js";

// His actor's id and name for his hits, as encounter.js gives them; not imported, as encounter.js imports this.
const bossActorId = "duke-sucellus";
const magic = "Duke Sucellus";
const icicles = "Duke Sucellus' icicles";

const avoidable = (run) => hitsFrom(run, magic) > 0 || hitsExcept(run, [magic, icicles], "damaged") > 0;

export const dukeSucellusCombatAchievements = {
  observe(state, facts, { events }) {
    const hisAttack = events.some((event) => event.type === "zuk_attack" && event.sourceId === bossActorId);
    const ours = events.some((event) => event.type === "attack_started" && event.sourceId === "player" && event.targetId === bossActorId);
    if (ours && !hisAttack) facts.offBeat = true;
  },
  judges: {
    "Perfect Duke Sucellus": inOneVisitUnless(5, avoidable, "You took avoidable damage."),
    "Cold Feet": unless((run) => run.ran || avoidable(run), "You ran or took avoidable damage."),
    "Mirror Image": unless((run) => Boolean(run.facts.offBeat), "You attacked on a tick Duke Sucellus did not."),
  },
};
