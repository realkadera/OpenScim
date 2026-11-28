// Scurrius' six setups (scurrius/loadouts.js, the wiki's strategy guide): each
// item is one the client has, in the slot it goes to; each weapon has a weapon
// category (none punches); the arrows suit the bow; each inventory item is one
// the client can use or wield. The first is Melee (mid level), the bone mace.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { cacheZip, loadEnvironment } from "../tools/determinism/harness.mjs";
import { scurriusLoadouts } from "../client/encounters/scurrius/loadouts.js";

const skip = !existsSync(cacheZip) && `${cacheZip} is missing (npm run assets)`;

test("Scurrius' setups: real items, in their slots, nothing that punches", { skip }, async () => {
  // The harness's environment first: the client's modules reach a stylesheet.
  await loadEnvironment();
  const { getEquipmentDefinition } = await import("../client/data/equipment.js");
  const { getWeaponCategory } = await import("../client/data/weaponCategories.js");
  const { weaponRequiresAmmo, isAmmoCompatibleWithWeapon } = await import("../client/engine/ammunition.js");
  const { getConsumableDefinition } = await import("../client/engine/consumables.js");

  const keys = Object.keys(scurriusLoadouts);
  assert.deepEqual(keys, ["mid_melee", "mid_ranged", "mid_magic", "high_melee", "high_ranged", "high_magic"]);
  // A loadout's slot names and the equipment list's.
  const slotOf = { head: ["head"], cape: ["cape"], amulet: ["neck"], weapon: ["weapon", "2h"], body: ["body"], shield: ["shield"], legs: ["legs"], hands: ["hands"], boots: ["feet"], ring: ["ring"] };
  for (const key of keys) {
    const { equipment, inventory, supplies } = scurriusLoadouts[key];
    for (const [slot, itemId] of Object.entries(equipment)) {
      const definition = getEquipmentDefinition(itemId);
      assert.ok(definition, `${key}: ${slot} ${itemId} is not in the equipment list`);
      assert.ok(slotOf[slot]?.includes(definition.slot), `${key}: ${definition.name} is ${definition.slot}, not ${slot}`);
    }
    const weapon = getEquipmentDefinition(equipment.weapon);
    assert.ok(getWeaponCategory(equipment.weapon), `${key}: ${weapon.name} has no weapon category`);
    if (weapon.slot === "2h") assert.equal(equipment.shield, undefined, `${key}: a shield with a two-handed weapon`);
    const ammo = supplies.equippedAmmo?.id;
    if (weaponRequiresAmmo(equipment.weapon)) assert.ok(ammo && isAmmoCompatibleWithWeapon(equipment.weapon, ammo), `${key}: ${weapon.name} cannot fire ${ammo}`);
    else if (ammo !== undefined) assert.equal(getEquipmentDefinition(ammo)?.slot, "ammo", `${key}: ammo ${ammo}`);
    assert.ok(inventory.length <= 28, `${key}: ${inventory.length} items`);
    for (const itemId of inventory) {
      assert.ok(getConsumableDefinition(itemId) || getEquipmentDefinition(itemId), `${key}: inventory item ${itemId} is neither usable nor wieldable`);
      if (getEquipmentDefinition(itemId)?.slot === "weapon" || getEquipmentDefinition(itemId)?.slot === "2h") assert.ok(getWeaponCategory(itemId), `${key}: inventory weapon ${itemId} has no category`);
    }
  }
  assert.equal(scurriusLoadouts.mid_melee.equipment.weapon, 28792); // the guide's first pick: the rat bone mace
});
