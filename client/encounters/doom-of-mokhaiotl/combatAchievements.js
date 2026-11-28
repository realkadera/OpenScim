// The Doom of Mokhaiotl's own judges of his combat achievements (his descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). His 15 tasks are the wiki's (client/combatAchievements/tasks.js); five are
// judged here. A fight here is one delve, chosen in the set-up (encounter.js), where the game's delve follows those
// before it: so a kill at a delve stands for reaching it. inferred: the tasks of a delve level count a kill at it or
// deeper. Not tracked yet: the tasks of levels 1 to 8 in one go, Exposed Doom (his melee charge), Mopping up (the
// acid splats cleared).
// - Doom Adept, Doom Veteran, It's Dark Down Here: a kill at delve 3, 8, 16 or deeper (his snapshot's `delve`);
// - Doom Crawler: a kill at delve 1 in less than 30 seconds;
// - Mokhaiotl Drift: a kill at delve 8 or deeper before his first burrow ends (his snapshot's `burrowed`, gone).
import { killTicks, ticksUnder } from "../../combatAchievements/runs.js";

const atDelve = (level) => ({ check: (run) => (run.facts.delve ?? 0) >= level });

export const doomOfMokhaiotlCombatAchievements = {
  observe(state, facts) {
    if (state.delve) facts.delve = state.delve;
    if (state.burrowed) facts.burrowing = true;
    else if (facts.burrowing) facts.burrowEnded = true;
  },
  judges: {
    "Doom Adept": atDelve(3),
    "Doom Veteran": atDelve(8),
    "It's Dark Down Here": atDelve(16),
    "Doom Crawler": { check: (run) => run.facts.delve === 1 && killTicks(run) <= ticksUnder(30) }, // WIKI: Doom Crawler, "less than 30 seconds"
    "Mokhaiotl Drift": { check: (run) => (run.facts.delve ?? 0) >= 8 && !run.facts.burrowEnded },
  },
};
