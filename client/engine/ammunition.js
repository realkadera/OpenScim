import { getBaseItemId } from "../data/itemVariants.js";
import { getEquipmentDefinition } from "../data/equipment.js";
var variantArrowsByItemId = {
  33553: { // Seeking bronze arrow
    baseArrowId: 882,
    rangedStrength: 7,
  },
  33559: { // Seeking iron arrow
    baseArrowId: 884,
    rangedStrength: 10,
  },
  33565: { // Seeking steel arrow
    baseArrowId: 886,
    rangedStrength: 16,
  },
  33571: { // Seeking mithril arrow
    baseArrowId: 888,
    rangedStrength: 22,
  },
  33577: { // Seeking adamant arrow
    baseArrowId: 890,
    rangedStrength: 31,
  },
  33583: { // Seeking rune arrow
    baseArrowId: 892,
    rangedStrength: 49,
  },
  33589: { // Seeking amethyst arrow
    baseArrowId: 21326,
    rangedStrength: 55,
  },
  33595: { // Seeking dragon arrow
    baseArrowId: 11212,
    rangedStrength: 60,
  },
  33601: { // Seeking broad arrows
    baseArrowId: 4160,
    rangedStrength: 28,
  },
};
var atlatlWeaponIds = new Set([29000, 29851]);
var arrowWeaponIds = new Set([6724, 11235, 20997, 27610, 29591]);
// WIKI: the Seercull "fires arrows up to Amethyst", so not dragon arrows.
var arrowsUpToAmethystWeaponIds = new Set([6724]);
var DRAGON_ARROW_ID = 11212;
function isDragonArrow(ammoId) {
  const baseArrowId = variantArrowsByItemId[ammoId]?.baseArrowId ?? ammoId;
  return baseArrowId === DRAGON_ARROW_ID || /^dragon /i.test(getEquipmentDefinition(baseArrowId)?.name ?? "");
}
var standardBoltWeaponIds = new Set([9185]);
var dragonBoltWeaponIds = new Set([11785, 26374]);
var arrowNamePattern =
  /^(?:bronze|iron|steel|mithril|adamant|rune|broad|amethyst|dragon)(?: fire)? arrows?/i;
var standardBoltNamePattern =
  /^(?:bronze|blurite|iron|steel|mithril|adamant|runite|silver|broad|amethyst broad|opal|jade|pearl|topaz|sapphire|emerald|ruby|diamond|dragonstone|onyx) bolts?/i;
var dragonBoltNamePattern =
  /^(?:dragon|opal dragon|jade dragon|pearl dragon|topaz dragon|sapphire dragon|emerald dragon|ruby dragon|diamond dragon|dragonstone dragon|onyx dragon) bolts?/i;
function getAmmoKind(ammoId) {
  if (ammoId === 28991) { // Atlatl dart
    return "atlatl_dart";
  }
  if (variantArrowsByItemId[ammoId] !== undefined) {
    return "arrow";
  }
  const definition = getEquipmentDefinition(ammoId);
  if (definition?.slot !== "ammo") {
    return "unsupported";
  } else if (dragonBoltNamePattern.test(definition.name)) {
    return "dragon_bolt";
  } else if (standardBoltNamePattern.test(definition.name)) {
    return "standard_bolt";
  } else if (arrowNamePattern.test(definition.name)) {
    return "arrow";
  } else {
    return "unsupported";
  }
}
function isArrowOrBolt(ammoId) {
  const ammoKind = getAmmoKind(ammoId);
  return ammoKind === "arrow" || ammoKind === "standard_bolt" || ammoKind === "dragon_bolt";
}
function weaponRequiresAmmo(weaponId) {
  const baseWeaponId = weaponId === undefined ? undefined : getBaseItemId(weaponId);
  return baseWeaponId !== undefined && (atlatlWeaponIds.has(baseWeaponId) || arrowWeaponIds.has(baseWeaponId) || standardBoltWeaponIds.has(baseWeaponId) || dragonBoltWeaponIds.has(baseWeaponId));
}
function isAmmoCompatibleWithWeapon(weaponId, ammoId) {
  const baseWeaponId = getBaseItemId(weaponId);
  const ammoKind = getAmmoKind(ammoId);
  if (atlatlWeaponIds.has(baseWeaponId)) {
    return ammoKind === "atlatl_dart";
  } else if (arrowWeaponIds.has(baseWeaponId)) {
    return ammoKind === "arrow" && !(arrowsUpToAmethystWeaponIds.has(baseWeaponId) && isDragonArrow(ammoId));
  } else if (standardBoltWeaponIds.has(baseWeaponId)) {
    return ammoKind === "standard_bolt";
  } else {
    return dragonBoltWeaponIds.has(baseWeaponId) && (ammoKind === "standard_bolt" || ammoKind === "dragon_bolt");
  }
}
export { variantArrowsByItemId, isArrowOrBolt, weaponRequiresAmmo, isAmmoCompatibleWithWeapon };
