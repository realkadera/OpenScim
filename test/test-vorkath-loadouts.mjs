// Vorkath's setups (client/encounters/vorkath/loadouts.js): the first column of the wiki's Ranged and Melee
// equipment tables with its inventories (WIKI: Vorkath/Strategies), then the dragon hunter crossbow. Each of the
// first two fights her: the Ascension crossbows fire their own bolts, the lance stabs, and the melee setup's
// Slayer's staff casts Crumble Undead from the pouch's runes.
// Plain Node with the harness's module hooks and the trimmed cache.
import assert from "node:assert/strict";
import { loadEnvironment } from "../tools/determinism/harness.mjs";

const { prepareArena, engineModule, objTypeLoader } = await loadEnvironment();
const { vorkathDefinition } = await import("../client/encounters/vorkath/encounter.js");
const loadouts = vorkathDefinition.descriptor.loadouts;

assert.deepEqual(Object.entries(loadouts).map(([key, { name }]) => [key, name]), [
  ["ranged", "Ranged (Ascension crossbows)"],
  ["melee", "Melee (Dragon hunter lance)"],
  ["dragon_hunter_crossbow", "Ranged (Dragon hunter crossbow)"],
]);
const { ranged, melee } = loadouts;
for (const { inventory, supplies } of Object.values(loadouts)) {
  assert.equal(inventory.length, 28);
  assert.ok(!inventory.includes(null), "every slot is filled");
  assert.equal(supplies.spellbook, "standard");
  assert.ok(inventory.includes(22209) && inventory.includes(29824), "an extended super antifire and an extended anti-venom+");
}
// WIKI: the first column of each table. The crossbows are two-handed: no shield.
assert.deepEqual(ranged.equipment, { head: 27235, cape: 28951, amulet: 12018, weapon: 34681, body: 27238, legs: 27241, hands: 26235, boots: 31097, ring: 28310 });
assert.deepEqual(ranged.supplies.equippedAmmo, { id: 34696 });
assert.deepEqual(melee.equipment, { head: 26382, cape: 21295, amulet: 12018, weapon: 22978, body: 26384, shield: 22322, legs: 26386, hands: 22981, boots: 31097, ring: 28307 });
assert.deepEqual([melee.inventory[0], melee.inventory[4], melee.inventory.at(-1)], [4170, 27690, 12791]); // Slayer's staff, Voidwaker, rune pouch
assert.equal(ranged.inventory[3], 26374); // Zaryte crossbow
assert.equal(ranged.inventory.at(-1), 27281); // Divine rune pouch

await prepareArena("vorkath");
const startFight = ({ equipment, inventory, supplies }) =>
  engineModule.createSimulationEngine({
    encounterConfig: { kind: "vorkath", mechanics: { infiniteHealth: true } },
    objTypeLoader,
    combatSeed: 3,
    inventory: inventory.map((id) => ({ id })),
    equipment: { ...equipment },
    combatSupplies: { ...engineModule.createEmptyCombatSupplies(), ...structuredClone(supplies) },
    attackStylePerCategory: {},
    startPosition: [32, 22],
  });
const step = (engine) => engine.advanceTick(engine.getState().playerPosition);
const messages = (engine) => engine.getLastTickEvents().filter((event) => event.type === "game_message").map((event) => event.segments.map(({ text }) => text).join(""));
// The player's attacks on a target over so many ticks, as the tick events have them.
function attacksOn(engine, targetId, ticks) {
  const seen = [];
  const said = [];
  for (let tick = 0; tick < ticks; tick++) {
    step(engine);
    said.push(...messages(engine));
    for (const event of engine.getLastTickEvents()) if (event.type === "attack_started" && event.targetId === targetId) seen.push(event);
  }
  return { seen, said };
}

for (const [name, loadout] of [["ranged", ranged], ["melee", melee]]) {
  const engine = startFight(loadout);
  for (let tick = 0; tick < 9; tick++) step(engine); // she rises
  engine.injectAction({ type: "attackTarget", targetId: "vorkath" });
  const { seen, said } = attacksOn(engine, "vorkath", 14);
  assert.ok(seen.length > 0, `${name}: no attack on her (${said.join(" | ")})`);
}
// Melee: the staff from the first slot, and Crumble Undead from the pouch's dust and chaos runes.
{
  const engine = startFight(melee);
  for (let tick = 0; tick < 9; tick++) step(engine);
  engine.injectAction({ type: "equipFromInventory", inventoryIndex: 0, itemId: 4170, slot: "weapon" });
  step(engine);
  assert.equal(engine.player().equipment.weapon, 4170);
  engine.injectAction({ type: "manualCast", targetId: "vorkath", spellName: "Crumble Undead" });
  const { seen, said } = attacksOn(engine, "vorkath", 12);
  assert.ok(seen.some((event) => event.spellId === "Crumble Undead"), `Crumble Undead was not cast (${said.join(" | ")})`);
}
console.log("Vorkath's setups: the wiki's best ranged and melee gear with their inventories; both fight her, and the melee one casts Crumble Undead");
process.exit(0);
