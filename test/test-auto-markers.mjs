// What the encounters mark for the replay (getAutoMarkers), on the
// determinism harness's scenarios: the tick and the name of each marker, as
// the application takes them (the first tick an id is listed on).
import assert from "node:assert/strict";
import { loadScenarios, runScenario } from "../tools/determinism/harness.mjs";

async function markersOf(file, name) {
  const scenario = (await loadScenarios(file)).find((each) => each.name === name);
  const marked = [];
  let previous = new Set();
  await runScenario(scenario, {
    onTick(tick, engine) {
      const markers = engine.encounter.getAutoMarkers({ world: engine.worldState });
      marked.push(...markers.filter(({ id }) => !previous.has(id)).map(({ label }) => `${tick} ${label}`));
      previous = new Set(markers.map(({ id }) => id));
      assert.equal(previous.size, markers.length, "an id is listed once");
    },
  });
  return marked;
}

// The Colosseum: the reinforcements come 66 ticks after the wave.
assert.deepEqual(await markersOf("colosseum", "colosseum/wave-1-reinforcements"), ["5 wave 1", "71 wave 1 reinforcements", "157 wave 2"]);
// The Inferno: the healers of a wave's Jad, of each of the three, and what comes in Zuk's fight.
assert.deepEqual(await markersOf("inferno", "inferno/wave-66-pillars-fall-jad"), ["1 wave 66", "195 wave 67", "229 Jad's healers", "343 wave 68"]);
assert.deepEqual(await markersOf("inferno", "inferno/wave-68-triple-jad-into-zuk"), ["1 wave 68", "45 Jad's healers", "137 Jad's healers", "241 Jad's healers", "326 wave 69"]);
assert.deepEqual(await markersOf("inferno", "inferno/zuk-jad-healers-victory"), ["0 wave 69", "5 Zuk's Jad", "40 Jad's healers", "154 Zuk's healers"]);
// A set is a mager and a ranger on one tick: one marker.
assert.deepEqual(await markersOf("inferno", "inferno/zuk-set-destroys-shield-death"), ["0 wave 69", "72 Zuk's set"]);
// The Doom: each shield, and the burrow it breaks into from delve 5.
assert.deepEqual(await markersOf("doom-of-mokhaiotl", "doom/delve-8-ranged"), ["48 shield", "65 burrow", "156 shield", "173 burrow"]);
// Phases and enrages.
assert.deepEqual(await markersOf("sol-heredit", "sol-heredit/melee-through-every-phase"), ["24 phase 2", "65 phase 3", "105 phase 4", "145 phase 5", "176 phase 6"]);
assert.deepEqual(await markersOf("leviathan", "leviathan/enrage-and-kill"), ["44 enrage"]);
assert.deepEqual(await markersOf("araxxor", "araxxor/enrage-and-kill"), ["42 enrage"]);
assert.deepEqual(await markersOf("zebak", "zebak/careful-ranged-kill"), ["25 Tidal Waves", "65 Great Roar", "91 enrage"]);
console.log("The encounters mark their waves, reinforcements, healers, shields and phases on the tick they come");
