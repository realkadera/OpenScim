// Vorkath's fireball against 21 recorded ones (client/encounters/vorkath/encounter.js): it is aimed at the tile the
// player stands on after his step of the tick she rears up, not the one he stood on before it; it leaves her head,
// the tile two tiles from her middle along the line to its target; and it hurts by where he stood before his step
// of the tick it lands.
// Plain Node with the harness's module hooks and the trimmed cache.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
await prepareArena("vorkath");

function startFight() {
  const engine = engineModule.createSimulationEngine({
    encounterConfig: { kind: "vorkath", mechanics: { infiniteHealth: true } },
    objTypeLoader,
    combatSeed: 3,
    inventory: [],
    equipment: {},
    combatSupplies: engineModule.createEmptyCombatSupplies(),
    attackStylePerCategory: {},
    startPosition: [32, 22],
  });
  engine.encounter.weighted = () => "fireball"; // every standard attack of hers
  return engine;
}
const state = (engine) => engine.getEncounterSnapshot().state;
const at = (engine) => [...engine.player().position];
const fireballDamage = (engine) =>
  engine.getLastTickEvents().filter((event) => event.type === "hitsplat_spawned" && event.targetId === "player").map((event) => event.amount);

// OBS (REC): her head for the tiles the recorded shots and fireballs were aimed at; her middle is 32,33.
{
  const engine = startFight();
  const boss = engine.worldState.actors.get("vorkath");
  for (const [target, head] of [[[32, 29], [32, 31]], [[33, 29], [32, 31]], [[31, 29], [32, 31]], [[34, 29], [33, 31]], [[30, 29], [31, 31]], [[29, 29], [31, 31]]])
    assert.deepEqual(engine.encounter.head(boss, target), head, `aimed at ${target}`);
}

// He steps east in the tick she rears up: the fireball is aimed at the tile he stepped onto.
{
  const engine = startFight();
  while (engine.worldState.tick + 1 < state(engine).nextAttackAt) engine.advanceTick(at(engine));
  const before = at(engine);
  engine.advanceTick([before[0] + 1, before[1]]);
  const after = at(engine);
  assert.deepEqual(after, [before[0] + 1, before[1]], "he stepped");
  assert.deepEqual(state(engine).fireballs, [], "it has not left her yet");
  engine.advanceTick(after);
  const [fireball] = state(engine).fireballs;
  assert.deepEqual(fireball.tile, after, "aimed at the tile he stood on after his step");
  const leaves = engine.getLastTickEvents().find((event) => event.type === "inferno_visual" && event.projectiles?.some(({ spotAnimId }) => spotAnimId === 1481));
  const boss = engine.worldState.actors.get("vorkath");
  assert.deepEqual(leaves.projectiles[0].sourcePosition, engine.encounter.head(boss, after).map((value) => value + 0.5), "it leaves her head");

  // He stays on the tile until the tick it lands and steps off in that tick: too late, it hits him.
  while (engine.worldState.tick + 1 < fireball.landsAt) engine.advanceTick(after);
  engine.advanceTick([after[0] + 2, after[1]]);
  assert.equal(engine.worldState.tick, fireball.landsAt);
  assert.equal(fireballDamage(engine).length, 1, "on its tile before his step of the landing tick: hit");
}

// He is two tiles off before the tick it lands: nothing.
{
  const engine = startFight();
  while (engine.worldState.tick + 1 < state(engine).nextAttackAt) engine.advanceTick(at(engine));
  engine.advanceTick(at(engine)); // she rears up
  engine.advanceTick(at(engine)); // it leaves her
  const [fireball] = state(engine).fireballs;
  const away = [fireball.tile[0] + 2, fireball.tile[1]];
  while (engine.worldState.tick < fireball.landsAt) engine.advanceTick(away);
  assert.deepEqual(at(engine), away);
  assert.deepEqual(fireballDamage(engine), [], "two tiles off: no hit");
}
console.log("Vorkath's fireball: aimed at the tile he stepped onto as she reared up, from her head, and it hurts by where he stood before the landing tick's step");
process.exit(0);
