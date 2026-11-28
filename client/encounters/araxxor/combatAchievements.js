// Araxxor's own judges of his combat achievements (his descriptor's `combatAchievements`,
// client/combatAchievements/tracker.js). His 12 tasks are the wiki's (client/combatAchievements/tasks.js); the kill
// counts and the ten without leaving are judged by the shared judges, three here. Not tracked yet: the three speed
// tasks (kills in 10:00 across a visit, with his respawn), Relaxxor (the eggs destroyed), Let it seep in (venom
// immunity) and Araxyte Betrayal (an araxyte's kills).
// - avoidable damage (WIKI: Perfect Araxxor): from him, damage on a style the player did not pray against (a 0 on the
//   prayer is forgiven: "not disqualified if the resulting hit is 0"); from the acidic and mirrorback araxytes, any
//   hit on a style not prayed against ("A hit of 0 without the proper protection prayer activated will still
//   disqualify"); and any hit of the acid pools, the acid ball, his cleave, a ruptura's explosion and the mirrorback's
//   reflection, as encounter.js names them;
// - Perfect Araxxor 2: that, and no attack of the player's on him while he is enraged (his snapshot's `enraged`).
//   inferred: an attack started counts, whether it lands or not;
// - Swimming in Venom: his tile never changes from the one he first stood on.
import { hitsExcept, unless } from "../../combatAchievements/judges.js";

// His actor's id, as encounter.js gives it; not imported, as encounter.js imports this.
const bossActorId = "araxxor";
const prayable = ["Araxxor", "Acidic Araxyte", "Mirrorback Araxyte"];
const avoidable = (run) =>
  (run.hits.Araxxor?.unprayedDamaged ?? 0) > 0 ||
  (run.hits["Acidic Araxyte"]?.unprayed ?? 0) + (run.hits["Mirrorback Araxyte"]?.unprayed ?? 0) > 0 ||
  hitsExcept(run, [...prayable, "Ruptura Araxyte"]) > 0;

export const araxxorCombatAchievements = {
  observe(state, facts, { events, engine }) {
    if (state.enraged && events.some((event) => event.type === "attack_started" && event.sourceId === "player" && event.targetId === bossActorId)) facts.hitEnraged = true;
    const boss = engine.worldState?.getNpcs?.().find((npc) => npc.id === bossActorId);
    if (boss?.position) {
      facts.bossTile ??= [...boss.position];
      if (boss.position[0] !== facts.bossTile[0] || boss.position[1] !== facts.bossTile[1]) facts.bossMoved = true;
    }
  },
  judges: {
    "Perfect Araxxor": unless(avoidable, "You took avoidable damage."),
    "Perfect Araxxor 2": unless((run) => avoidable(run) || Boolean(run.facts.hitEnraged), "You took avoidable damage or attacked Araxxor while enraged."),
    "Swimming in Venom": unless((run) => Boolean(run.facts.bossMoved), "Araxxor moved."),
  },
};
