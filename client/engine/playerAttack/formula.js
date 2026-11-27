import { getBaseItemId } from "../../data/itemVariants.js";
var ECLIPSE_SPECIAL_FORMULA_GAP = "eclipse_special_formula";
var ANIMATION_ONLY_SPECIAL_GAP = "animation_only_special";
var chinchompaAreaConfigByWeaponId = new Map([
  [
    10033, // Chinchompa
    {
      radius: 1,
      maxTargets: 11,
    },
  ],
  [
    10034, // Red chinchompa
    {
      radius: 1,
      maxTargets: 11,
    },
  ],
  [
    11959, // Black chinchompa
    {
      radius: 1,
      maxTargets: 12,
    },
  ],
]);
function getChinchompaAreaConfig(weaponId) {
  if (weaponId === undefined) {
    return undefined;
  } else {
    return chinchompaAreaConfigByWeaponId.get(getBaseItemId(weaponId));
  }
}
var CHINCHOMPA_ACCURACY_PERCENT_BY_STYLE = {
  Accurate: [100, 75, 50],
  Rapid: [75, 100, 75],
  Longrange: [50, 75, 100],
};
var NO_FORMULA_STAGES = {
  attackRollStages: [],
  maxHitStages: [],
};
// Dragon hunter weapons against a dragon (the monster table's attribute
// "dragon"): [accuracy, damage] percent added. WIKI (Dragon hunter crossbow):
// +30% accuracy and +25% damage, its ornament kits' alike; (Dragon hunter
// lance): +20% and +20%. The dragon hunter wand is not here: profiles.js
// still refuses it against a dragon until its numbers are checked.
var dragonHunterPercentsByWeaponId = new Map([
  [21012, [30, 25]], // Dragon hunter crossbow
  [25916, [30, 25]], // Dragon hunter crossbow (t)
  [25918, [30, 25]], // Dragon hunter crossbow (b)
  [22978, [20, 20]], // Dragon hunter lance
]);
var DRAGON_ATTRIBUTE = "dragon";
function getDragonHunterStages(formulaStageInput) {
  const weaponId = formulaStageInput.weaponId;
  if (weaponId === undefined || !formulaStageInput.targetAttributes.includes(DRAGON_ATTRIBUTE)) {
    return null;
  }
  const percents = dragonHunterPercentsByWeaponId.get(weaponId) ?? dragonHunterPercentsByWeaponId.get(getBaseItemId(weaponId));
  if (undefined === percents) {
    return null;
  }
  return {
    attackRollStages: [percentToRatio(100 + percents[0])],
    maxHitStages: [percentToRatio(100 + percents[1])],
  };
}
var twistedBowIdSet = new Set([20997, 28540]);
var XERICIAN_ATTRIBUTE = "xerician";
var crystalBowIdSet = new Set([23983, 24123, 25865, 25867, 27187]);
var CRYSTAL_HELM_ID = 23971;
var CRYSTAL_BODY_ID = 23975;
var CRYSTAL_LEGS_ID = 23979;
var demonbaneSpellNameSet = new Set([
  "Inferior Demonbane",
  "Superior Demonbane",
  "Dark Demonbane",
]);
var purgingStaffIdSet = new Set([29594, 33184]);
var demonbanePercentByWeaponId = new Map([
  [2402, 60], // Silverlight
  [6745, 60], // Silverlight
  [6746, 60], // Darklight
  [19675, 70], // Arclight
  [29577, 5], // Burning claws
  [29589, 70], // Emberlight
  [29591, 30], // Scorching bow
]);
// A demonbane weapon or spell (the tables above), for rules that only demonbane passes.
function isDemonbaneAttack({ weaponId, spellId }) {
  return demonbaneSpellNameSet.has(spellId) || (weaponId !== undefined && demonbanePercentByWeaponId.has(getBaseItemId(weaponId)));
}
var DEMON_ATTRIBUTE = "demon";
// Golembane (WIKI: Golembane weapons, Golem (attribute)): against a golem, the weapon's accuracy and damage are up by
// its percentage, "stacks multiplicatively with the Slayer helmet's bonuses" (WIKI: Granite hammer), as demonbane does.
var GOLEM_ATTRIBUTE = "golem";
var golembanePercentByWeaponId = new Map([
  [21742, 30], // Granite hammer
  [25641, 15], // Barronite mace
  [25643, 15], // Barronite mace (l): inferred, the same mace
]);
function percentToRatio(percent) {
  return {
    numerator: percent,
    denominator: 100,
  };
}
function scalePercentByDemonbaneVulnerability(percent, demonbaneVulnerability) {
  return percentToRatio(100 + (percent - 100) * demonbaneVulnerability);
}
function getDemonbaneSpellStages(formulaStageInput) {
  const resources = formulaStageInput.resources;
  if ("spell" !== resources?.kind || !demonbaneSpellNameSet.has(resources.spellId)) {
    return null;
  }
  const demonbaneVulnerability = formulaStageInput.demonbaneVulnerability;
  const toDemonbaneRatio = (percent) => scalePercentByDemonbaneVulnerability(percent, demonbaneVulnerability);
  if (formulaStageInput.markOfDarknessActive) {
    if (formulaStageInput.weaponId !== undefined && purgingStaffIdSet.has(formulaStageInput.weaponId)) {
      return {
        attackRollStages: [toDemonbaneRatio(180)],
        maxHitStages: [toDemonbaneRatio(150)],
      };
    } else {
      return {
        attackRollStages: [toDemonbaneRatio(140)],
        maxHitStages: [toDemonbaneRatio(125)],
      };
    }
  } else {
    // WIKI (Purging staff): the staff "doubles the base accuracy bonus of
    // demonbane spells from 20% to 40%", with no Mark of Darkness needed.
    const purgingStaff = formulaStageInput.weaponId !== undefined && purgingStaffIdSet.has(formulaStageInput.weaponId);
    return {
      attackRollStages: [toDemonbaneRatio(purgingStaff ? 140 : 120)],
      maxHitStages: [],
    };
  }
}
function getTwistedBowStages(formulaStageInput) {
  if (formulaStageInput.weaponId === undefined || !twistedBowIdSet.has(formulaStageInput.weaponId)) {
    return null;
  }
  // WIKI (Twisted bow): the target's Magic counts up to 250, and up to 350
  // "within the Chambers of Xeric" (12 April 2018). Inferred: the monster
  // table's attribute "xerician" is what marks a monster of the Chambers.
  const magicCap = formulaStageInput.targetAttributes.includes(XERICIAN_ATTRIBUTE) ? 350 : 250;
  const targetMagic = Math.min(
    Math.max(formulaStageInput.targetMagicLevel, formulaStageInput.targetMagicAttackBonus),
    magicCap,
  );
  const accuracyPercent = twistedBowScalingPercent(targetMagic, true);
  const damagePercent = twistedBowScalingPercent(targetMagic, false);
  return {
    attackRollStages: [percentToRatio(accuracyPercent)],
    maxHitStages: [percentToRatio(damagePercent)],
  };
}
function getCrystalBowStages(formulaStageInput) {
  if (formulaStageInput.weaponId === undefined || !crystalBowIdSet.has(getBaseItemId(formulaStageInput.weaponId))) {
    return null;
  }
  const wornArmourIds = [formulaStageInput.headId, formulaStageInput.bodyId, formulaStageInput.legsId].map((itemId) =>
    itemId === undefined ? undefined : getBaseItemId(itemId),
  );
  const accuracyBonusPercent =
    (wornArmourIds.includes(CRYSTAL_HELM_ID) ? 5 : 0) +
    (wornArmourIds.includes(CRYSTAL_BODY_ID) ? 15 : 0) +
    (wornArmourIds.includes(CRYSTAL_LEGS_ID) ? 10 : 0);
  const damageBonusHalfPercents =
    (wornArmourIds.includes(CRYSTAL_HELM_ID) ? 5 : 0) +
    (wornArmourIds.includes(CRYSTAL_BODY_ID) ? 15 : 0) +
    (wornArmourIds.includes(CRYSTAL_LEGS_ID) ? 10 : 0);
  return {
    attackRollStages: [percentToRatio(100 + accuracyBonusPercent)],
    maxHitStages: [
      {
        numerator: 200 + damageBonusHalfPercents,
        denominator: 200,
      },
    ],
  };
}
function getDemonbaneWeaponStages(formulaStageInput) {
  const weaponId = formulaStageInput.weaponId;
  if (undefined === weaponId) {
    return NO_FORMULA_STAGES;
  }
  const toDemonbaneRatio = (percent) => scalePercentByDemonbaneVulnerability(percent, formulaStageInput.demonbaneVulnerability);
  const demonbanePercent = demonbanePercentByWeaponId.get(getBaseItemId(weaponId));
  if (undefined === demonbanePercent) {
    return NO_FORMULA_STAGES;
  } else {
    return {
      attackRollStages: [toDemonbaneRatio(100 + demonbanePercent)],
      maxHitStages: [toDemonbaneRatio(100 + demonbanePercent)],
    };
  }
}
function getGolembaneWeaponStages(formulaStageInput) {
  const weaponId = formulaStageInput.weaponId;
  const golembanePercent = weaponId === undefined ? undefined : golembanePercentByWeaponId.get(getBaseItemId(weaponId));
  if (golembanePercent === undefined) {
    return NO_FORMULA_STAGES;
  }
  return {
    attackRollStages: [percentToRatio(100 + golembanePercent)],
    maxHitStages: [percentToRatio(100 + golembanePercent)],
  };
}
function computeFormulaStages(formulaStageInput) {
  const demonbaneSpellStages = formulaStageInput.targetAttributes.includes(DEMON_ATTRIBUTE)
    ? getDemonbaneSpellStages(formulaStageInput)
    : null;
  if (null !== demonbaneSpellStages) {
    return demonbaneSpellStages;
  }
  if (formulaStageInput.resources?.kind === "spell") {
    return NO_FORMULA_STAGES;
  }
  const twistedBowStages = getTwistedBowStages(formulaStageInput);
  if (null !== twistedBowStages) {
    return twistedBowStages;
  }
  const crystalBowStages = getCrystalBowStages(formulaStageInput);
  if (crystalBowStages !== null) {
    return crystalBowStages;
  }
  const dragonHunterStages = getDragonHunterStages(formulaStageInput);
  if (dragonHunterStages !== null) {
    return dragonHunterStages;
  } else if (formulaStageInput.targetAttributes.includes(DEMON_ATTRIBUTE)) {
    return getDemonbaneWeaponStages(formulaStageInput);
  } else if (formulaStageInput.targetAttributes.includes(GOLEM_ATTRIBUTE)) {
    return getGolembaneWeaponStages(formulaStageInput);
  } else {
    return NO_FORMULA_STAGES;
  }
}
function twistedBowScalingPercent(targetMagic, forAccuracy) {
  const curveOffset = forAccuracy ? 10 : 14;
  const basePercent = forAccuracy ? 140 : 250;
  const linearTerm = Math.trunc((targetMagic * 3 - curveOffset) / 100);
  const quadraticTerm = Math.trunc((Math.trunc((3 * targetMagic) / 10) - 10 * curveOffset) ** 2 / 100);
  const uncappedPercent = basePercent + linearTerm - quadraticTerm;
  const minimumPercent = 0;
  const maximumPercent = basePercent;
  return Math.min(Math.max(uncappedPercent, minimumPercent), maximumPercent);
}
export {
  ECLIPSE_SPECIAL_FORMULA_GAP,
  ANIMATION_ONLY_SPECIAL_GAP,
  getChinchompaAreaConfig,
  CHINCHOMPA_ACCURACY_PERCENT_BY_STYLE,
  crystalBowIdSet,
  percentToRatio,
  computeFormulaStages,
  isDemonbaneAttack,
};
