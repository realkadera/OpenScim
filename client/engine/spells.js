import { getBaseItemId } from "../data/itemVariants.js";
var RUNE_ITEM_IDS = {
  fire: 554,
  water: 555,
  air: 556,
  earth: 557,
  mind: 558,
  body: 559,
  death: 560,
  nature: 561,
  chaos: 562,
  law: 563,
  cosmic: 564,
  blood: 565,
  soul: 566,
  wrath: 21880,
};
var COMBINATION_RUNE_ITEM_IDS = {
  steam: 4694,
  mist: 4695,
  dust: 4696,
  smoke: 4697,
  mud: 4698,
  lava: 4699,
  aether: 30843,
};
var RUNES_BY_COMBINATION_RUNE = {
  [COMBINATION_RUNE_ITEM_IDS.mist]: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.water],
  [COMBINATION_RUNE_ITEM_IDS.dust]: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.earth],
  [COMBINATION_RUNE_ITEM_IDS.smoke]: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire],
  [COMBINATION_RUNE_ITEM_IDS.mud]: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.earth],
  [COMBINATION_RUNE_ITEM_IDS.steam]: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.fire],
  [COMBINATION_RUNE_ITEM_IDS.lava]: [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.fire],
  [COMBINATION_RUNE_ITEM_IDS.aether]: [RUNE_ITEM_IDS.cosmic, RUNE_ITEM_IDS.soul],
};
var COMBINATION_RUNES_BY_RUNE = (() => {
  const combinationRunesByRune = new Map();
  for (const [combinationRuneId, componentRuneIds] of Object.entries(RUNES_BY_COMBINATION_RUNE)) {
    for (const runeId of componentRuneIds) {
      const combinationRuneIds = combinationRunesByRune.get(runeId) ?? [];
      combinationRuneIds.push(Number(combinationRuneId));
      combinationRunesByRune.set(runeId, combinationRuneIds);
    }
  }
  return Object.fromEntries(combinationRunesByRune);
})();
var RUNES_PROVIDED_BY_STAFF = {
  1381: [RUNE_ITEM_IDS.air], // Staff of air
  1397: [RUNE_ITEM_IDS.air], // Air battlestaff
  1405: [RUNE_ITEM_IDS.air], // Mystic air staff
  1383: [RUNE_ITEM_IDS.water], // Staff of water
  1395: [RUNE_ITEM_IDS.water], // Water battlestaff
  1403: [RUNE_ITEM_IDS.water], // Mystic water staff
  21006: [RUNE_ITEM_IDS.water], // Kodai wand
  1385: [RUNE_ITEM_IDS.earth], // Staff of earth
  1399: [RUNE_ITEM_IDS.earth], // Earth battlestaff
  1407: [RUNE_ITEM_IDS.earth], // Mystic earth staff
  1387: [RUNE_ITEM_IDS.fire], // Staff of fire
  1393: [RUNE_ITEM_IDS.fire], // Fire battlestaff
  1401: [RUNE_ITEM_IDS.fire], // Mystic fire staff
  3053: [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.fire], // Lava battlestaff
  3054: [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.fire], // Mystic lava staff
  6562: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.earth], // Mud battlestaff
  6563: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.earth], // Mystic mud staff
  11787: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.fire], // Steam battlestaff
  11789: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.fire], // Mystic steam staff
  11998: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire], // Smoke battlestaff
  12000: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire], // Mystic smoke staff
  20730: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.water], // Mist battlestaff
  20733: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.water], // Mystic mist staff
  20736: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.earth], // Dust battlestaff
  20739: [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.earth], // Mystic dust staff
  30634: [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.fire], // Twinflame staff
  20714: [RUNE_ITEM_IDS.fire], // Tome of Fire
  25574: [RUNE_ITEM_IDS.water], // Tome of Water
  30064: [RUNE_ITEM_IDS.earth], // Tome of Earth
};
var MARK_OF_DARKNESS_SPELL = "Mark of Darkness";
var DEATH_CHARGE_SPELL = "Death Charge";
var SPELL_MAGIC_LEVEL_REQUIREMENTS = {
  "Wind Strike": 1,
  "Water Strike": 5,
  "Earth Strike": 9,
  "Fire Strike": 13,
  "Wind Bolt": 17,
  "Water Bolt": 23,
  "Earth Bolt": 29,
  "Fire Bolt": 35,
  "Crumble Undead": 39,
  "Wind Blast": 41,
  "Water Blast": 47,
  "Iban Blast": 50,
  "Magic Dart": 50,
  "Earth Blast": 53,
  "Fire Blast": 59,
  "Saradomin Strike": 60,
  "Claws of Guthix": 60,
  "Flames of Zamorak": 60,
  "Wind Wave": 62,
  "Water Wave": 65,
  "Earth Wave": 70,
  "Fire Wave": 75,
  "Wind Surge": 81,
  "Water Surge": 85,
  "Earth Surge": 90,
  "Fire Surge": 95,
  "Smoke Rush": 50,
  "Shadow Rush": 52,
  "Blood Rush": 56,
  "Ice Rush": 58,
  "Smoke Burst": 62,
  "Shadow Burst": 64,
  "Blood Burst": 68,
  "Ice Burst": 70,
  "Smoke Blitz": 74,
  "Shadow Blitz": 76,
  "Blood Blitz": 80,
  "Ice Blitz": 82,
  "Smoke Barrage": 86,
  "Shadow Barrage": 88,
  "Blood Barrage": 92,
  "Ice Barrage": 94,
  "Ghostly Grasp": 35,
  "Inferior Demonbane": 44,
  "Skeletal Grasp": 56,
  "Superior Demonbane": 62,
  "Undead Grasp": 79,
  "Dark Demonbane": 82,
  "Arceuus Home Teleport": 1,
  [MARK_OF_DARKNESS_SPELL]: 59,
  [DEATH_CHARGE_SPELL]: 80,
  "Resurrect Greater Ghost": 76,
  "Resurrect Greater Skeleton": 76,
  "Resurrect Greater Zombie": 76,
};
var SPELL_RUNE_REQUIREMENTS = {
  "Wind Strike": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.mind],
  "Water Strike": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.mind],
  "Earth Strike": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.mind],
  "Fire Strike": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.mind],
  "Wind Bolt": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Water Bolt": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Earth Bolt": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Fire Bolt": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Crumble Undead": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Wind Blast": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.death],
  "Water Blast": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.death],
  "Iban Blast": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.death],
  "Magic Dart": [RUNE_ITEM_IDS.mind, RUNE_ITEM_IDS.death],
  "Earth Blast": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.death],
  "Fire Blast": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.death],
  "Saradomin Strike": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.air],
  "Claws of Guthix": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.air],
  "Flames of Zamorak": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.air],
  "Wind Wave": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood],
  "Water Wave": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood],
  "Earth Wave": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood],
  "Fire Wave": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood],
  "Wind Surge": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.wrath],
  "Water Surge": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.wrath],
  "Earth Surge": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.wrath],
  "Fire Surge": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.wrath],
  "Smoke Rush": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Shadow Rush": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.soul],
  "Blood Rush": [RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Ice Rush": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Smoke Burst": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Shadow Burst": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.soul],
  "Blood Burst": [RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Ice Burst": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.chaos, RUNE_ITEM_IDS.death],
  "Smoke Blitz": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death],
  "Shadow Blitz": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.soul],
  "Blood Blitz": [RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death],
  "Ice Blitz": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death],
  "Smoke Barrage": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death],
  "Shadow Barrage": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.soul],
  "Blood Barrage": [RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.soul],
  "Ice Barrage": [RUNE_ITEM_IDS.water, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.death],
  "Inferior Demonbane": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.chaos],
  "Superior Demonbane": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.soul],
  "Dark Demonbane": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.soul],
  "Ghostly Grasp": [RUNE_ITEM_IDS.air, RUNE_ITEM_IDS.chaos],
  "Skeletal Grasp": [RUNE_ITEM_IDS.earth, RUNE_ITEM_IDS.death],
  "Undead Grasp": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood],
  [MARK_OF_DARKNESS_SPELL]: [RUNE_ITEM_IDS.cosmic, RUNE_ITEM_IDS.soul],
  [DEATH_CHARGE_SPELL]: [RUNE_ITEM_IDS.death, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.soul],
  "Resurrect Greater Ghost": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.cosmic],
  "Resurrect Greater Skeleton": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.cosmic],
  "Resurrect Greater Zombie": [RUNE_ITEM_IDS.fire, RUNE_ITEM_IDS.blood, RUNE_ITEM_IDS.cosmic],
};
function getSpellRuneTypes(spellId) {
  return SPELL_RUNE_REQUIREMENTS[spellId] ?? null;
}
function isRuneProvidedByStaff(neededRuneId, equipment) {
  for (const equippedItemId of [equipment.weapon, equipment.shield]) {
    if (undefined !== equippedItemId && RUNES_PROVIDED_BY_STAFF[getBaseItemId(equippedItemId)]?.includes(neededRuneId)) {
      return true;
    }
  }
  return false;
}
function getAcceptedRuneIds(baseRuneId) {
  const combinationRuneIds = COMBINATION_RUNES_BY_RUNE[baseRuneId];
  if (combinationRuneIds) {
    return [baseRuneId, ...combinationRuneIds];
  } else {
    return [baseRuneId];
  }
}
function hasRuneAvailable(runeId, caster) {
  if (
    isRuneProvidedByStaff(runeId, caster.equipment)
  ) {
    return true;
  }
  const acceptedRuneIds = getAcceptedRuneIds(runeId);
  for (const itemRef of caster.inventory) {
    if (itemRef && acceptedRuneIds.includes(itemRef.id)) {
      return true;
    }
  }
  for (const pouchItemRef of caster.runePouch?.slots ?? []) {
    if (pouchItemRef && acceptedRuneIds.includes(pouchItemRef.id)) {
      return true;
    }
  }
  return false;
}
function checkSpellRequirements(spellId, caster) {
  const requiredRuneIds = getSpellRuneTypes(spellId);
  if (requiredRuneIds) {
    if (hasMagicLevelForSpell(spellId, caster.magicLevel)) {
      if (requiredRuneIds.every((runeId) => hasRuneAvailable(runeId, caster))) {
        return {
          ok: true,
        };
      } else {
        return {
          ok: false,
          reason: "missing-runes",
        };
      }
    } else {
      return {
        ok: false,
        reason: "missing-level",
      };
    }
  } else {
    return {
      ok: false,
      reason: "unknown-spell",
    };
  }
}
function getRequiredMagicLevel(spellKey) {
  return SPELL_MAGIC_LEVEL_REQUIREMENTS[spellKey] ?? null;
}
function hasMagicLevelForSpell(spellId, magicLevel) {
  if (undefined === magicLevel) {
    return true;
  }
  const requiredMagicLevel = getRequiredMagicLevel(spellId);
  return requiredMagicLevel === null || magicLevel >= requiredMagicLevel;
}
function canCastSpell(spellId, caster) {
  return checkSpellRequirements(spellId, caster).ok;
}
export {
  RUNE_ITEM_IDS,
  COMBINATION_RUNE_ITEM_IDS,
  MARK_OF_DARKNESS_SPELL,
  DEATH_CHARGE_SPELL,
  getSpellRuneTypes,
  hasRuneAvailable,
  checkSpellRequirements,
  hasMagicLevelForSpell,
  getRequiredMagicLevel,
  canCastSpell,
};
