// Vardorvis's own judges of his combat achievements (his descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). His 9 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts and the speed tasks are judged by the shared judges, Perfect Vardorvis here. Not tracked yet: Budget Cutter
// (the gear's worth: there are no prices here) and Axe Enthusiast (his enrage, which his snapshot does not give).
// - avoidable damage (WIKI: Perfect Vardorvis): "a melee attack off-prayer", his own hits ("Vardorvis") that dealt
//   damage on a style the player did not pray against, and "all special attacks": damage from any hit
//   encounter.js names otherwise (his axes, heads, spikes, tendrils and bleed);
// - Perfect Vardorvis: 5 kills without it in one visit, not in a row (WIKI: "rather than having to do so 5 kills in
//   a row").
import { hitsExcept, inOneVisitUnless } from "../../combatAchievements/judges.js";

const melee = "Vardorvis";
const avoidable = (run) => (run.hits[melee]?.unprayedDamaged ?? 0) > 0 || hitsExcept(run, [melee], "damaged") > 0;

export const vardorvisCombatAchievements = {
  judges: {
    "Perfect Vardorvis": inOneVisitUnless(5, avoidable, "You took avoidable damage."),
  },
};
