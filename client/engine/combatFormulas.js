import { scaleToaAccuracyRoll } from "/toa/zebak/rules.js";
import { getWeaponCategoryDefinition } from "../data/weaponCategories.js";
var prayerMultipliersByPrayer = {
  Piety: {
    attack: 1.2,
    strength: 1.23,
    defence: 1.25,
  },
  Zeal: {
    attack: 1.25,
    strength: 1.28,
    defence: 1.25,
  },
  Rigour: {
    ranged: 1.2,
    rangedStrength: 1.23,
    defence: 1.25,
  },
  Augury: {
    magic: 1.25,
    defence: 1.25,
    magicDamage: 1.04,
  },
  EagleEye: {
    ranged: 1.15,
    rangedStrength: 1.15,
  },
  MysticMight: {
    magic: 1.15,
    magicDamage: 1.02,
  },
  Deadeye: {
    ranged: 1.18,
    rangedStrength: 1.18,
    defence: 1.05,
  },
  MysticVigour: {
    magic: 1.18,
    magicDamage: 1.03,
    defence: 1.05,
  },
};
// A level times a prayer's multiplier, rounded down, in whole thousandths:
// 100 * 1.15 is 114.99999999999999 as a double, and the game's 115.
function scaleLevel(level, multiplier) {
  return Math.floor((level * Math.round(multiplier * 1000)) / 1000);
}
function getEffectiveMeleeAttackLevel(attacker, prayerMultipliers) {
  const prayerScaledAttack = scaleLevel(attacker.levels.attack, prayerMultipliers.attack);
  const stanceBonus = attacker.stance === "Accurate" ? 3 : attacker.stance === "Controlled" ? 1 : 0;
  const voidMultiplier = attacker.voidSet === "melee" ? 1.1 : 1;
  return Math.floor((prayerScaledAttack + stanceBonus + 8) * voidMultiplier);
}
function getStanceDefenceBonus(target) {
  if (target.stance === "Defensive" || target.stance === "Longrange") {
    return 3;
  } else if (target.stance === "Controlled") {
    return 1;
  } else {
    return 0;
  }
}
var neutralPrayerMultipliers = {
  attack: 1,
  strength: 1,
  defence: 1,
  ranged: 1,
  rangedStrength: 1,
  magic: 1,
  magicDamage: 1,
};
function getSingleRollHitChance(attackRoll, defenceRoll) {
  if (attackRoll > defenceRoll) {
    return 1 - (defenceRoll + 2) / ((attackRoll + 1) * 2);
  } else {
    return attackRoll / ((defenceRoll + 1) * 2);
  }
}
function getDoubleRollHitChance(attackRoll, defenceRoll) {
  if (attackRoll >= defenceRoll) {
    return 1 - ((defenceRoll + 2) * (defenceRoll * 2 + 3)) / ((attackRoll + 1) ** 2 * 6);
  } else {
    return (attackRoll * (attackRoll * 4 + 5)) / ((attackRoll + 1) * 6 * (defenceRoll + 1));
  }
}
function getSteadyStateHitChance(singleRollChance, doubleRollChance) {
  if (singleRollChance === 1) {
    return 1;
  }
  const doubleRollShare = (1 - singleRollChance) / (doubleRollChance + 1 - singleRollChance);
  return (1 - doubleRollShare) * singleRollChance + doubleRollShare * doubleRollChance;
}
function getEffectiveRangedAttackLevel(attacker, prayerMultipliers) {
  const prayerScaledRanged = scaleLevel(attacker.levels.ranged, prayerMultipliers.ranged);
  const stanceBonus = attacker.stance === "Accurate" ? 3 : 0;
  const voidMultiplier =
    attacker.voidSet === "ranged" || attacker.voidSet === "elite_ranged" ? 1.1 : 1;
  return Math.floor((prayerScaledRanged + stanceBonus + 8) * voidMultiplier);
}
function getEffectiveMagicAttackLevel(attacker, prayerMultipliers) {
  const prayerScaledMagic = scaleLevel(attacker.levels.magic, prayerMultipliers.magic);
  // WIKI (Damage per second/Magic, step two): the level times the prayer,
  // rounded down; times 1.45 in Void Magic; "+2 if using Accurate on powered
  // staves"; "+9". A spell cast and Longrange get the 9 alone.
  const stanceBonus = attacker.stance === "Accurate" ? 2 : 0;
  const voidMultiplier =
    attacker.voidSet === "magic" || attacker.voidSet === "elite_magic" ? 1.45 : 1;
  return Math.floor(prayerScaledMagic * voidMultiplier + stanceBonus + 9);
}
// Eleven switches of this module, from here on, end in a `default:` that
// returns what was switched on (a formula style, a defence style, a ranged
// defence type) or, in two of them, the attacker or the target whose `kind`
// was. That is not a result. Every other path gives a number; a value
// without a case comes back as it went in, and nothing here tests for it.
// getStanceForCombatStyle, further down, throws in the same place
// (throwUnhandledCombatStyle).
function getPlayerAttackRoll(attacker, formulaStyle, equipmentStats, prayerMultipliers) {
  switch (formulaStyle) {
    case "melee_stab":
      return Math.floor(getEffectiveMeleeAttackLevel(attacker, prayerMultipliers) * (equipmentStats.attackStab + 64));
    case "melee_slash":
      return Math.floor(getEffectiveMeleeAttackLevel(attacker, prayerMultipliers) * (equipmentStats.attackSlash + 64));
    case "melee_crush":
      return Math.floor(getEffectiveMeleeAttackLevel(attacker, prayerMultipliers) * (equipmentStats.attackCrush + 64));
    case "ranged":
      return Math.floor(
        getEffectiveRangedAttackLevel(attacker, prayerMultipliers) *
          (equipmentStats.attackRanged + 64),
      );
    case "magic":
      return Math.floor(
        getEffectiveMagicAttackLevel(attacker, prayerMultipliers) *
          (equipmentStats.attackMagic + 64),
      );
    default:
      return formulaStyle;
  }
}
function getPlayerAccuracyRolls(attacker, target, formulaStyle, equipmentStats, prayerMultipliers = neutralPrayerMultipliers, defenceStyle = formulaStyle, rangedDefenceType = "standard") {
  const attackRoll = getPlayerAttackRoll(attacker, formulaStyle, equipmentStats, prayerMultipliers);
  const defenceRoll = getNpcDefenceRoll(target, defenceStyle, rangedDefenceType);
  return {
    attackRoll: attackRoll,
    defenceRoll: defenceRoll,
    chance: getSingleRollHitChance(attackRoll, defenceRoll),
  };
}
function getNpcAttackAccuracy(attacker, target, formulaStyle, targetEquipmentStats, targetPrayerMultipliers = neutralPrayerMultipliers) {
  const attackRoll = scaleToaAccuracyRoll(getNpcAttackRoll(attacker, formulaStyle), attacker.toaRaidLevel);
  switch (target.kind) {
    case "npc":
      return getSingleRollHitChance(attackRoll, getNpcDefenceRoll(target, formulaStyle, "standard"));
    case "player":
      return getSingleRollHitChance(attackRoll, getPlayerDefenceRoll(target, formulaStyle, targetEquipmentStats, targetPrayerMultipliers));
    default:
      return target;
  }
}
function getNpcAttackRoll(attacker, formulaStyle) {
  switch (formulaStyle) {
    case "melee_stab":
    case "melee_slash":
    case "melee_crush":
      return Math.floor((attacker.levels.attack + 9) * (attacker.offensive.atk + 64));
    case "ranged":
      return Math.floor((attacker.levels.ranged + 9) * (attacker.offensive.ranged + 64));
    case "magic":
      return Math.floor((attacker.levels.magic + 9) * (attacker.offensive.magic + 64));
    default:
      return formulaStyle;
  }
}
function getEffectiveMagicDefenceLevel(target, targetPrayerMultipliers) {
  const prayerScaledMagic = scaleLevel(target.levels.magic, targetPrayerMultipliers.magic);
  const prayerScaledDefence = scaleLevel(target.levels.defence, targetPrayerMultipliers.defence);
  return Math.floor((prayerScaledMagic * 7) / 10) + Math.floor((prayerScaledDefence * 3) / 10) + getStanceDefenceBonus(target) + 8;
}
function getEffectiveMeleeOrRangedDefenceLevel(target, targetPrayerMultipliers) {
  return scaleLevel(target.levels.defence, targetPrayerMultipliers.defence) + getStanceDefenceBonus(target) + 8;
}
function getEquipmentDefenceBonus(formulaStyle, targetEquipmentStats) {
  switch (formulaStyle) {
    case "melee_stab":
      return targetEquipmentStats.defenceStab;
    case "melee_slash":
      return targetEquipmentStats.defenceSlash;
    case "melee_crush":
      return targetEquipmentStats.defenceCrush;
    case "ranged":
      return targetEquipmentStats.defenceRanged;
    case "magic":
      return targetEquipmentStats.defenceMagic;
    default:
      return formulaStyle;
  }
}
function getPlayerDefenceRoll(target, formulaStyle, targetEquipmentStats, targetPrayerMultipliers) {
  let effectiveDefenceLevel;
  switch (formulaStyle) {
    case "magic":
      effectiveDefenceLevel = getEffectiveMagicDefenceLevel(target, targetPrayerMultipliers);
      break;
    case "melee_stab":
    case "melee_slash":
    case "melee_crush":
    case "ranged":
      effectiveDefenceLevel = getEffectiveMeleeOrRangedDefenceLevel(target, targetPrayerMultipliers);
      break;
    default:
      return formulaStyle;
  }
  return Math.floor(
    effectiveDefenceLevel *
      (getEquipmentDefenceBonus(formulaStyle, targetEquipmentStats) +
        64),
  );
}
function getRangedDefensiveBonus(rangedDefenceType, defensiveBonuses) {
  switch (rangedDefenceType) {
    case "light":
      return defensiveBonuses.rangedLight;
    case "standard":
      return defensiveBonuses.rangedStandard;
    case "heavy":
      return defensiveBonuses.rangedHeavy;
    default:
      return rangedDefenceType;
  }
}
function getNpcDefensiveBonus(defenceStyle, rangedDefenceType, defensiveBonuses) {
  switch (defenceStyle) {
    case "melee_stab":
      return defensiveBonuses.stab;
    case "melee_slash":
      return defensiveBonuses.slash;
    case "melee_crush":
      return defensiveBonuses.crush;
    case "ranged":
      return getRangedDefensiveBonus(rangedDefenceType, defensiveBonuses);
    case "magic":
      return defensiveBonuses.magic;
    default:
      return defenceStyle;
  }
}
function getNpcDefenceRoll(target, defenceStyle, rangedDefenceType) {
  let defendingLevel;
  switch (defenceStyle) {
    case "magic":
      defendingLevel = target.levels.magic;
      break;
    case "melee_stab":
    case "melee_slash":
    case "melee_crush":
    case "ranged":
      defendingLevel = target.levels.defence;
      break;
    default:
      return defenceStyle;
  }
  const roll = Math.floor(
    (defendingLevel + 9) *
      (getNpcDefensiveBonus(defenceStyle, rangedDefenceType, target.defensive) +
        64),
  );
  return scaleToaAccuracyRoll(roll, target.toaRaidLevel);
}
function combinePrayerMultipliers(prayers) {
  let combinedMultipliers = neutralPrayerMultipliers;
  for (const prayer of prayers) {
    if (prayer == null) {
      continue;
    }
    const prayerMultipliers = prayerMultipliersByPrayer[prayer];
    if (prayerMultipliers !== undefined) {
      combinedMultipliers = {
        attack: Math.max(combinedMultipliers.attack, prayerMultipliers.attack ?? combinedMultipliers.attack),
        strength: Math.max(combinedMultipliers.strength, prayerMultipliers.strength ?? combinedMultipliers.strength),
        defence: Math.max(combinedMultipliers.defence, prayerMultipliers.defence ?? combinedMultipliers.defence),
        ranged: Math.max(combinedMultipliers.ranged, prayerMultipliers.ranged ?? combinedMultipliers.ranged),
        rangedStrength: Math.max(
          combinedMultipliers.rangedStrength,
          prayerMultipliers.rangedStrength ?? combinedMultipliers.rangedStrength,
        ),
        magic: Math.max(combinedMultipliers.magic, prayerMultipliers.magic ?? combinedMultipliers.magic),
        magicDamage: Math.max(combinedMultipliers.magicDamage, prayerMultipliers.magicDamage ?? combinedMultipliers.magicDamage),
      };
    }
  }
  return combinedMultipliers;
}
function getPrayerMultipliers(activePrayer, offensivePrayer) {
  return combinePrayerMultipliers([activePrayer, offensivePrayer]);
}
function getNpcMaxHit(attacker, formulaStyle) {
  switch (formulaStyle) {
    case "melee_stab":
    case "melee_slash":
    case "melee_crush":
      return getMaxHitFromEffectiveLevel(attacker.levels.strength + 9, attacker.offensive.str);
    case "ranged":
      return getMaxHitFromEffectiveLevel(attacker.levels.ranged + 9, attacker.offensive.rangedStr);
    case "magic":
      return getMaxHitFromEffectiveLevel(attacker.levels.magic + 9, attacker.offensive.magicStr);
    default:
      return formulaStyle;
  }
}
function getEffectiveMeleeStrengthLevel(attacker, prayerMultipliers) {
  const meleeStrengthBonusPercent = attacker.meleeStrengthBonusPercent ?? 0;
  const prayerScaledStrength =
    meleeStrengthBonusPercent === 0
      ? scaleLevel(attacker.levels.strength, prayerMultipliers.strength)
      : Math.floor(
          (attacker.levels.strength *
            (Math.round(prayerMultipliers.strength * 100) + meleeStrengthBonusPercent)) /
            100,
        );
  const stanceBonus =
    attacker.stance === "Aggressive"
      ? 3
      : attacker.stance === "Controlled"
        ? 1
        : 0;
  const voidMultiplier = attacker.voidSet === "melee" ? 1.1 : 1;
  return Math.floor((prayerScaledStrength + stanceBonus + 8) * voidMultiplier);
}
function getEffectiveRangedStrengthLevel(attacker, prayerMultipliers) {
  const prayerScaledRanged = scaleLevel(
    attacker.rangedStrengthLevel ?? attacker.levels.ranged,
    prayerMultipliers.rangedStrength,
  );
  const stanceBonus = attacker.stance === "Accurate" ? 3 : 0;
  const voidMultiplier =
    attacker.voidSet === "elite_ranged"
      ? 1.125
      : attacker.voidSet === "ranged"
        ? 1.1
        : 1;
  return Math.floor((prayerScaledRanged + stanceBonus + 8) * voidMultiplier);
}
function getPlayerMaxHit(attacker, formulaStyle, equipmentStats, prayerMultipliers) {
  switch (formulaStyle) {
    case "melee_stab":
    case "melee_slash":
    case "melee_crush":
      return getMaxHitFromEffectiveLevel(
        getEffectiveMeleeStrengthLevel(attacker, prayerMultipliers),
        equipmentStats.meleeStrength,
      );
    case "ranged":
      return getMaxHitFromEffectiveLevel(
        getEffectiveRangedStrengthLevel(attacker, prayerMultipliers),
        equipmentStats.rangedStrength,
      );
    case "magic": {
      const magicBaseMaxHit = Math.floor(attacker.magicBaseMaxHit ?? 0);
      // The bonuses in whole tenths of a percent: 25 * (1 + 16 / 100) is
      // 28.999999999999996 as a double, and the game's 29.
      const equipmentDamageBonus = Math.round(equipmentStats.magicDamage * 10);
      const prayerDamageBonus = Math.round((prayerMultipliers.magicDamage - 1) * 1000);
      const voidDamageBonus = attacker.voidSet === "elite_magic" ? 50 : 0;
      return Math.floor(
        (magicBaseMaxHit * (1000 + equipmentDamageBonus + prayerDamageBonus + voidDamageBonus)) / 1000,
      );
    }
    default:
      return formulaStyle;
  }
}
function getFormulaMaxHit(attacker, formulaStyle, equipmentStats, prayerMultipliers = neutralPrayerMultipliers) {
  switch (attacker.kind) {
    case "npc":
      return getNpcMaxHit(attacker, formulaStyle);
    case "player":
      return getPlayerMaxHit(attacker, formulaStyle, equipmentStats, prayerMultipliers);
    default:
      return attacker;
  }
}
function getMaxHitFromEffectiveLevel(effectiveLevel, strengthBonus) {
  return Math.floor((effectiveLevel * (strengthBonus + 64) + 320) / 640);
}
function throwUnhandledCombatStyle(unhandledCombatStyle) {
  throw new TypeError(`Unhandled combat style: ${String(unhandledCombatStyle)}`);
}
function getStanceForCombatStyle(combatStyle) {
  switch (combatStyle) {
    case "Accurate":
    case "Aggressive":
    case "Defensive":
    case "Controlled":
    case "Longrange":
    case "Casting":
    case "Defensive Casting":
    case "Other":
      return combatStyle;
    case "Rapid":
    case "None":
      return "Other";
    default:
      return throwUnhandledCombatStyle(combatStyle);
  }
}
function getPlayerStance(player) {
  const styles = getWeaponCategoryDefinition(player.equipment.weapon).styles;
  const selectedStyle =
    styles[
      Math.min(Math.max(0, player.selectedAttackStyleIndex), styles.length - 1)
    ] ?? styles[0];
  if (selectedStyle === undefined) {
    return "Other";
  } else {
    return getStanceForCombatStyle(selectedStyle.combatStyle);
  }
}
function getDrainedNpcFormulaStats(npc) {
  if (!npc.formulaStats) {
    return null;
  }
  const { levels: levels } = npc.formulaStats;
  return {
    kind: "npc",
    id: npc.npcTypeId,
    ...npc.formulaStats,
    levels: {
      ...levels,
      attack: Math.max(0, levels.attack - (npc.debuffs?.attackDrain ?? 0)),
      strength: Math.max(0, levels.strength - (npc.debuffs?.strengthDrain ?? 0)),
      magic: Math.max(0, levels.magic - (npc.debuffs?.magicDrain ?? 0)),
      defence: Math.max(0, levels.defence - (npc.debuffs?.defenceDrain ?? 0)),
    },
  };
}
function getPlayerFormulaStats(player) {
  return {
    kind: "player",
    levels: {
      attack: player.stats.attack.current,
      strength: player.stats.strength.current,
      defence: player.stats.defence.current,
      ranged: player.stats.ranged.current,
      magic: player.stats.magic.current,
    },
    stance: getPlayerStance(player),
  };
}
export {
  neutralPrayerMultipliers,
  getSingleRollHitChance,
  getDoubleRollHitChance,
  getSteadyStateHitChance,
  getPlayerAccuracyRolls,
  getNpcAttackAccuracy,
  getNpcAttackRoll,
  getPlayerDefenceRoll,
  getPrayerMultipliers,
  getFormulaMaxHit,
  getPlayerStance,
  getDrainedNpcFormulaStats,
  getPlayerFormulaStats,
};
