import { projectileTimings } from "./projectiles.js";
import { getBaseItemId } from "../data/itemVariants.js";
import { getSpecialAttackDefinition } from "../data/specialAttackDefinitions.js";
import { weaponCategoryDefinitions, getActiveSpell, getWeaponCategory } from "../data/weaponCategories.js";
function getPoweredStaffBaseMaxHit(weaponId, magicLevel) {
  switch (weaponId === undefined ? undefined : getBaseItemId(weaponId)) {
    case 11905: // Trident of the Seas (full)
    case 11907: // Trident of the Seas
    case 22288: // Trident of the Seas (e)
      return Math.max(1, Math.floor(magicLevel / 3) - 5);
    case 12899: // Trident of the Swamp
    case 22292: // Trident of the Swamp (e)
      return Math.max(1, Math.floor(magicLevel / 3) - 2);
    case 22323: // Sanguinesti staff
      return Math.max(6, Math.floor(magicLevel / 3));
    case 27275: // Tumeken's shadow
    case 28547: // Corrupted tumeken's shadow
      return Math.max(1, Math.floor(magicLevel / 3) + 1);
    case 28585: // Warped sceptre
      return Math.floor((magicLevel * 8 + 963) / 37);
    case 22555: // Thammaron's sceptre
      return Math.floor(magicLevel / 3) - 8;
    case 27665: // Accursed sceptre
      return Math.floor(magicLevel / 3) - 6;
    case 28796: // Bone staff
      return Math.floor(magicLevel / 3) + 5;
    case 23898: // Crystal staff (basic)
    case 23852: // Corrupted staff (basic); inferred same max hit as crystal counterpart
      return 23;
    case 23899: // Crystal staff (attuned)
    case 23853: // Corrupted staff (attuned); inferred same max hit as crystal counterpart
      return 31;
    case 23900: // Crystal staff (perfected)
    case 23854: // Corrupted staff (perfected); inferred same max hit as crystal counterpart
      return 39;
    case 31113: // Eye of Ayak
      return Math.max(1, Math.floor(magicLevel / 3) - 6);
    case 24425: // Eldritch nightmare staff: its special attack, Invocate, and nothing else of it
      return Math.min(44, Math.floor((44 * magicLevel) / 99 + 1));
    default:
      return;
  }
}
var hitDelayKindByWeaponCategory = {
  bow: "bow",
  crossbow: "bow",
  thrown: "thrown",
  chinchompa: "thrown",
  powered_staff: "magic",
  staff: "melee",
  "2h_sword": "melee",
  axe: "melee",
  banner: "melee",
  blunt: "melee",
  bludgeon: "melee",
  bulwark: "melee",
  claw: "melee",
  partisan: "melee",
  pickaxe: "melee",
  polearm: "melee",
  scythe: "melee",
  slash_sword: "melee",
  spear: "melee",
  spiked: "melee",
  stab_sword: "melee",
  unarmed: "melee",
  whip: "melee",
};
var hitDelayKindByWeaponId = {
  27275: "magic_slow", // Tumeken's shadow
};
function getHitDelayWeaponKind(weaponId, formulaStyle) {
  if (weaponId !== undefined) {
    const weaponKind = hitDelayKindByWeaponId[getBaseItemId(weaponId)];
    if (weaponKind) {
      return weaponKind;
    }
    const category = getWeaponCategory(weaponId);
    if (category) {
      const categoryKind = hitDelayKindByWeaponCategory[category];
      if (categoryKind) {
        return categoryKind;
      }
    }
  }
  if (formulaStyle === "magic") {
    return "magic";
  } else {
    return "melee";
  }
}
var rangedDefenceTypeByWeaponCategory = {
  thrown: "light",
  bow: "standard",
  crossbow: "heavy",
  chinchompa: "heavy",
};
function getRangedDefenceType(weaponId) {
  const category = getWeaponCategory(weaponId);
  return (category === undefined ? undefined : rangedDefenceTypeByWeaponCategory[category]) ?? "standard";
}
var formulaStyleByAttackType = {
  Stab: "melee_stab",
  Slash: "melee_slash",
  Crush: "melee_crush",
  Ranged: "ranged",
  Magic: "magic",
};
function getWeaponFormulaStyle(weaponId, styleIndex = 0) {
  const category = getWeaponCategory(weaponId);
  const categoryDefinition = category ? weaponCategoryDefinitions[category] : weaponCategoryDefinitions.unarmed;
  if (!categoryDefinition) {
    return "melee_crush";
  }
  const style = categoryDefinition.styles[styleIndex] ?? categoryDefinition.styles[0];
  if (style) {
    return formulaStyleByAttackType[style.attackType] ?? "melee_crush";
  } else {
    return "melee_crush";
  }
}
var castingCombatStyles = new Set(["Casting", "Defensive Casting"]);
function computeStyleCombatParams(baseAttackSpeed, baseAttackRange, weaponId, selectedStyleIndex) {
  const category = getWeaponCategory(weaponId);
  const categoryDefinition = category ? weaponCategoryDefinitions[category] : weaponCategoryDefinitions.unarmed;
  if (!categoryDefinition) {
    return {
      attackSpeed: baseAttackSpeed,
      attackRange: baseAttackRange,
    };
  }
  const styleIndex = Math.min(Math.max(0, selectedStyleIndex), categoryDefinition.styles.length - 1);
  const style = categoryDefinition.styles[styleIndex];
  if (!style) {
    return {
      attackSpeed: baseAttackSpeed,
      attackRange: baseAttackRange,
    };
  }
  let attackSpeed = baseAttackSpeed;
  let attackRange = baseAttackRange;
  if (style.attackType === "Ranged" && style.combatStyle === "Rapid") {
    attackSpeed -= 1;
  } else if (castingCombatStyles.has(style.combatStyle)) {
    attackSpeed = 5;
  }
  if (style.combatStyle === "Longrange") {
    attackRange += 2;
  }
  attackRange = Math.min(attackRange, 10);
  attackSpeed = Math.max(attackSpeed, 1);
  return {
    attackSpeed: attackSpeed,
    attackRange: attackRange,
  };
}
function computePlayerCombatParams(player) {
  const combatParams = computeStyleCombatParams(
    player.equipmentStats.attackSpeed,
    player.equipmentStats.attackRange,
    player.equipment.weapon,
    player.selectedAttackStyleIndex,
  );
  const activeSpell = getActiveSpell({
    weaponId: player.equipment.weapon,
    selectedStyleIndex: player.selectedAttackStyleIndex,
    selectedSpell: player.combatSupplies?.selectedSpell,
    spellbook: player.combatSupplies?.spellbook ?? "arceuus",
  });
  if (activeSpell) {
    combatParams.attackRange = activeSpell.attackRange;
  }
  // A special attack with a reach of its own is made from that far while
  // it is switched on, whatever the weapon's attack style is.
  const specialAttackRange = player.isSpecialAttackActive ? getSpecialAttackDefinition(player.equipment.weapon)?.attackRange : undefined;
  if (specialAttackRange !== undefined) {
    combatParams.attackRange = specialAttackRange;
  }
  return combatParams;
}
function formulaStyleToAttackStyle(formulaStyle) {
  if (formulaStyle === "ranged") {
    return "range";
  } else if (formulaStyle === "magic") {
    return "magic";
  } else {
    return "melee";
  }
}
function formulaStyleToAttackKind(formulaStyle) {
  switch (formulaStyle) {
    case "melee_stab":
      return "melee_stab";
    case "melee_slash":
      return "melee_slash";
    case "melee_crush":
      return "melee_crush";
    case "ranged":
      return "range_arrow";
    case "magic":
      return "magic_fire";
  }
}
var projectileTimingByWeaponCategory = {
  bow: projectileTimings.arrow,
  crossbow: projectileTimings.arrow,
  thrown: projectileTimings.thrown,
  chinchompa: {
    delay: 21,
    lengthAdjustment: 11,
    stepMultiplier: 5,
    progress: 11,
  },
  powered_staff: projectileTimings.magic_spell,
};
var accursedSceptreSpecialProjectileTiming = {
  delay: 50,
  lengthAdjustment: -4,
  stepMultiplier: 10,
  progress: 70,
};
var projectileTimingByWeaponId = {
  12926: { // Toxic blowpipe
    ...projectileTimings.thrown,
    progress: 105,
  },
  27275: projectileTimings.tumekens_shadow, // Tumeken's shadow
  31113: projectileTimings.eye_of_ayak, // Eye of Ayak
  30070: projectileTimings.magic_spell, // Dragon hunter wand
  27665: { // Accursed sceptre
    delay: 46,
    lengthAdjustment: 0,
    stepMultiplier: 10,
    progress: 64,
  },
  27610: { // Venator bow
    delay: 31,
    lengthAdjustment: 15,
    stepMultiplier: 2,
    progress: 11,
  },
};
var specialProjectileTimingByWeaponId = {
  12926: { // Toxic blowpipe
    delay: 32,
    lengthAdjustment: 0,
    stepMultiplier: 7,
    progress: 105,
  },
  27665: accursedSceptreSpecialProjectileTiming, // Accursed sceptre
  27679: accursedSceptreSpecialProjectileTiming, // Accursed sceptre (a)
  27676: accursedSceptreSpecialProjectileTiming, // Accursed sceptre (au)
  29591: { // Scorching bow
    delay: 46,
    lengthAdjustment: 4,
    stepMultiplier: 4,
    progress: 80,
  },
};
function getWeaponProjectileTiming(weaponId, isSpecialAttack = false) {
  if (weaponId !== undefined) {
    const baseWeaponId = getBaseItemId(weaponId);
    const specialTiming = isSpecialAttack ? specialProjectileTimingByWeaponId[baseWeaponId] : undefined;
    if (specialTiming) {
      return specialTiming;
    }
    const weaponTiming = projectileTimingByWeaponId[baseWeaponId];
    if (weaponTiming) {
      return weaponTiming;
    }
    const category = getWeaponCategory(weaponId);
    if (category) {
      return projectileTimingByWeaponCategory[category];
    }
  }
}
export {
  getPoweredStaffBaseMaxHit,
  getHitDelayWeaponKind,
  getRangedDefenceType,
  getWeaponFormulaStyle,
  computePlayerCombatParams,
  formulaStyleToAttackStyle,
  formulaStyleToAttackKind,
  getWeaponProjectileTiming,
};
