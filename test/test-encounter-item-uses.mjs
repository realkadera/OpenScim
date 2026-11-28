// An inventory item the engine has no use for (not food, a potion or the like) is handed to the encounter, as
// context.inputs.itemUses on the tick it is used: what the Whisperer's Blackstone fragment needs. An item the
// engine uses itself is not, and an option the engine has no case for (the fragment's "Activate") is the
// encounter's too, where it used to be taken for a definition. On the fixture encounter
// (test/fixtures/training-ground/), through the harness. A use acted on a tick reaches that tick's context.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { use } from "../tools/determinism/scenarios/common.mjs";

const blackstoneFragment = 28357; // CACHE: BLACKSTONE_FRAGMENT
const anglerfish = 13441;

const seen = new Map(); // tick -> context.inputs.itemUses
await runScenario(
  {
    name: "item-uses",
    kind: "training_ground",
    seed: 1,
    ticks: 8,
    inventory: [blackstoneFragment, anglerfish],
    startHp: 50,
    script(tick, api) {
      if (tick === 2) use(api, 0);
      if (tick === 4) use(api, 1);
      if (tick === 6) use(api, 0, "Activate");
    },
  },
  {
    onTick(tick, engine) {
      if (engine.encounter.recordingItemUses) return;
      engine.encounter.recordingItemUses = true;
      const resolveHazards = engine.encounter.resolveHazards.bind(engine.encounter);
      engine.encounter.resolveHazards = (context, mechanics) => {
        seen.set(context.tick, context.inputs.itemUses);
        return resolveHazards(context, mechanics);
      };
    },
  },
);

const uses = [...seen].filter(([, list]) => list);
assert.deepEqual(uses, [
  [2, [{ inventoryIndex: 0, itemId: blackstoneFragment, option: "default" }]],
  [6, [{ inventoryIndex: 0, itemId: blackstoneFragment, option: "Activate" }]],
]);
assert.ok([...seen.values()].every((list) => list === undefined || list.length > 0), "only a tick with a use has the list");
console.log("item uses: an item the engine has no use for reaches the encounter on the tick it is used; an anglerfish does not");
