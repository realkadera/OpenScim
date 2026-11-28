// The Corrupted Hunllef's own judges of its combat achievements (its descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). Its 11 tasks are the wiki's (client/combatAchievements/tasks.js); four are
// judged here. The fight here is its room alone, prepared for, so the tasks of the Gauntlet's preparation (the armour,
// weapons and egniol made, the gauntlet's time) are not tracked, nor Corrupted Warrior (the perfected armour) or
// Perfect Corrupted Hunllef (attacking it on the style it protects).
// - the Corrupted Gauntlet's kill counts: its kills that counted. inferred: a kill of the Hunllef is a gauntlet
//   completed, as the gauntlet ends with it;
// - 3, 2, 1 - Mage: no damage on a style the player did not pray against (its tornadoes, floor and stomp are not
//   prayed against, and do not count).
import { kills, unless } from "../../combatAchievements/judges.js";

const unprayedDamage = (run) => Object.values(run.hits).some((seen) => seen.unprayedDamaged > 0);

export const corruptedHunllefCombatAchievements = {
  judges: {
    "Corrupted Gauntlet Veteran": kills(5),
    "Corrupted Gauntlet Master": kills(10),
    "Corrupted Gauntlet Grandmaster": kills(50),
    "3, 2, 1 - Mage": unless(unprayedDamage, "You took damage off prayer."),
  },
};
