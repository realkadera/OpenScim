// The Maggot King's movement in his melee phase as the recorded kills and the wiki have it,
// asserted on the determinism harness's scenarios
// (tools/determinism/scenarios/maggot-king.mjs). Their digests say that
// nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/maggot-king.mjs";

// Each tick: his tile, the player's, the phase, the slam coming down and the slams that hit.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "maggot-king/" + name), {
    onTick(tick, engine) {
      const { state } = engine.getEncounterSnapshot();
      ticks[tick] = {
        boss: [...engine.worldState.getNpc("maggot-king").position], player: [...engine.player().position], phase: state.phase, slam: state.slam?.landsAt ?? null,
        slammed: engine.damageHistory.some((hit) => hit.tick === tick && hit.source === "Head slam"),
      };
    },
  });
  return ticks;
}
const middle = (tick) => tick.boss[0] + 2;
// The ticks his slams land on, in the first near rotation.
const landings = (ticks) => [...new Set(ticks.flatMap((tick) => (tick?.phase === "melee" && tick.slam !== null ? [tick.slam] : [])))].filter((n) => ticks[n]?.phase === "melee");

{
  // A player who steps out of the first slam and then stands without hitting
  // him: he walks his middle back over the player's column, and every slam
  // after the first lands on the player.
  const ticks = await ticksOf("near-afk");
  const [first, ...rest] = landings(ticks);
  assert.ok(rest.length >= 3, "slams after the first: " + rest.length);
  assert.notEqual(middle(ticks[first]), ticks[first].player[0]);
  for (const n of rest) {
    assert.equal(middle(ticks[n]), ticks[n].player[0], "his middle over the player at the slam on tick " + n);
    assert.ok(ticks[n].slammed, "the slam on tick " + n + " hits the player");
  }
}
{
  // A player under his body two columns off his middle, hitting him each
  // slam (the recorded kills): from the first slam the player meets in place
  // he does not move until his screech. (Opened near at once, he follows
  // the player who dodges his first slams on the way there.)
  const ticks = await ticksOf("near-punish");
  const [first, ...rest] = landings(ticks).filter((n, i, all) => all.slice(0, i + 1).some((m) => ticks[m].player[0] === ticks[m].boss[0]));
  assert.ok(rest.length >= 3, "slams after the first in place: " + rest.length);
  for (let n = first; n <= rest.at(-1); n++) assert.deepEqual(ticks[n].boss, ticks[first].boss, "he stands still on tick " + n);
}
