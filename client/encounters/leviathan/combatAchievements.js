// The Leviathan's own judges of its combat achievements (its descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). Its 9 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts and the speed tasks are judged by the shared judges, the other three here. How each is judged:
// - avoidable damage (WIKI: Perfect Leviathan): damage from any of its hits but its roar, which the wiki has as
//   unavoidable ("minor unavoidable damage from the roar", WIKI: Serpentine Solo). inferred: the wiki forgives a
//   volley's damage on the prayer in the change to the enrage; here any damage but the roar's fails it;
// - Perfect Leviathan: 5 kills without it in one visit, not in a row, as its other "perfectly 5 times" tasks are
//   (WIKI: Perfect Duke Sucellus, Perfect Vardorvis);
// - Serpentine Solo: a stun is a new `stunnedUntil` in its snapshot (encounter.js); at most one;
// - Unconventional: every attack of the player's with mithril ammunition, its ammunition or the thrown weapon itself
//   (client/data/equipment.js: "Mithril arrow", "Mithril dart", ...), and no more than 25 hitpoints at any tick.
//   inferred: an attack whose ammunition the engine does not name (a blowpipe's darts) does not count as mithril.
import { hitsExcept, unless, inOneVisitUnless } from "../../combatAchievements/judges.js";
import { getItemName } from "../../data/equipment.js";

// Its actor's id, as encounter.js gives it; not imported, as encounter.js imports this.
const bossActorId = "leviathan";
const roar = "The Leviathan's roar";
const avoidable = (run) => hitsExcept(run, [roar], "damaged") > 0;
const isMithril = (id) => Boolean(id) && /^Mithril /.test(getItemName(id) ?? "");

export const leviathanCombatAchievements = {
  observe(state, facts, { events }) {
    if (state.stunnedUntil != null && state.stunnedUntil !== facts.stunnedUntil) facts.stuns = (facts.stuns ?? 0) + 1;
    facts.stunnedUntil = state.stunnedUntil;
    for (const event of events) {
      if (event.type !== "attack_started" || event.sourceId !== "player" || event.targetId !== bossActorId) continue;
      if (event.spellId || !isMithril(event.ammoId ?? event.weaponId)) facts.notMithril = true;
    }
  },
  judges: {
    "Perfect Leviathan": inOneVisitUnless(5, avoidable, "You took avoidable damage."),
    "Serpentine Solo": unless((run) => (run.facts.stuns ?? 0) > 1, "You stunned the Leviathan more than once."),
    Unconventional: {
      check: (run) => run.attacks > 0 && !run.facts.notMithril && run.highestHp <= 25,
      failed: (run) => (run.facts.notMithril ? "You attacked with something other than mithril ammunition." : run.highestHp > 25 && "You had more than 25 Hitpoints."),
    },
  },
};
