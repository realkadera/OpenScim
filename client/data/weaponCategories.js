import { defaultSpellbook } from "../engine/playerState.js";
import { getBaseItemId } from "./itemVariants.js";
import { getSpellDefinition } from "./combatSpells.js";
var weaponCategoryDefinitions = {
  "2h_sword": {
    name: "2h Sword",
    styles: [
      {
        name: "Chop",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "2h_chop.png",
      },
      {
        name: "Slash",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "2h_slash.png",
      },
      {
        name: "Smash",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "2h_smash.png",
      },
      {
        name: "Block",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "2h_block.png",
      },
    ],
  },
  axe: {
    name: "Axe",
    styles: [
      {
        name: "Chop",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "axe_chop.png",
      },
      {
        name: "Hack",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "axe_hack.png",
      },
      {
        name: "Smash",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "axe_smash.png",
      },
      {
        name: "Block",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "axe_block.png",
      },
    ],
  },
  banner: {
    name: "Banner",
    styles: [
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Accurate",
        icon: "banner_lunge.png",
      },
      {
        name: "Swipe",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "banner_swipe.png",
      },
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Controlled",
        icon: "banner_pound.png",
      },
      {
        name: "Block",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "banner_block.png",
      },
    ],
  },
  blunt: {
    name: "Blunt",
    styles: [
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Accurate",
        icon: "blunt_pound.png",
      },
      {
        name: "Pummel",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "blunt_pummel.png",
      },
      {
        name: "Block",
        attackType: "Crush",
        combatStyle: "Defensive",
        icon: "blunt_block.png",
      },
    ],
  },
  bludgeon: {
    name: "Bludgeon",
    styles: [
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "bludgeon_pound.png",
      },
      {
        name: "Pummel",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "bludgeon_pummel.png",
      },
      {
        name: "Smash",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "bludgeon_smash.png",
      },
    ],
  },
  bulwark: {
    name: "Bulwark",
    styles: [
      {
        name: "Pummel",
        attackType: "Crush",
        combatStyle: "Accurate",
        icon: "bulwark_pummel.png",
      },
      {
        name: "Block",
        attackType: "None",
        combatStyle: "None",
        icon: "bulwark_block.png",
      },
    ],
  },
  claw: {
    name: "Claw",
    styles: [
      {
        name: "Chop",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "claw_chop.png",
      },
      {
        name: "Slash",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "claw_slash.png",
      },
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Controlled",
        icon: "claw_lunge.png",
      },
      {
        name: "Block",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "claw_block.png",
      },
    ],
  },
  partisan: {
    name: "Partisan",
    styles: [
      {
        name: "Stab",
        attackType: "Stab",
        combatStyle: "Accurate",
        icon: "partisan_stab.png",
      },
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Aggressive",
        icon: "partisan_lunge.png",
      },
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "partisan_pound.png",
      },
      {
        name: "Block",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "partisan_block.png",
      },
    ],
  },
  pickaxe: {
    name: "Pickaxe",
    styles: [
      {
        name: "Spike",
        attackType: "Stab",
        combatStyle: "Accurate",
        icon: "pickaxe_spike.png",
      },
      {
        name: "Impale",
        attackType: "Stab",
        combatStyle: "Aggressive",
        icon: "pickaxe_impale.png",
      },
      {
        name: "Smash",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "pickaxe_smash.png",
      },
      {
        name: "Block",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "pickaxe_block.png",
      },
    ],
  },
  polearm: {
    name: "Polearm",
    styles: [
      {
        name: "Jab",
        attackType: "Stab",
        combatStyle: "Controlled",
        icon: "polearm_jab.png",
      },
      {
        name: "Swipe",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "polearm_swipe.png",
      },
      {
        name: "Fend",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "polearm_fend.png",
      },
    ],
  },
  scythe: {
    name: "Scythe",
    styles: [
      {
        name: "Reap",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "scythe_reap.png",
      },
      {
        name: "Chop",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "scythe_chop.png",
      },
      {
        name: "Jab",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "scythe_jab.png",
      },
      {
        name: "Block",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "scythe_block.png",
      },
    ],
  },
  slash_sword: {
    name: "Slash Sword",
    styles: [
      {
        name: "Chop",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "slash_sword_chop.png",
      },
      {
        name: "Slash",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "slash_sword_slash.png",
      },
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Controlled",
        icon: "slash_sword_lunge.png",
      },
      {
        name: "Block",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "slash_sword_block.png",
      },
    ],
  },
  spear: {
    name: "Spear",
    styles: [
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Controlled",
        icon: "spear_lunge.png",
      },
      {
        name: "Swipe",
        attackType: "Slash",
        combatStyle: "Controlled",
        icon: "spear_swipe.png",
      },
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Controlled",
        icon: "spear_pound.png",
      },
      {
        name: "Block",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "spear_block.png",
      },
    ],
  },
  spiked: {
    name: "Spiked",
    styles: [
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Accurate",
        icon: "spiked_pound.png",
      },
      {
        name: "Pummel",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "spiked_pummel.png",
      },
      {
        name: "Spike",
        attackType: "Stab",
        combatStyle: "Aggressive",
        icon: "spiked_spike.png",
      },
      {
        name: "Block",
        attackType: "Crush",
        combatStyle: "Defensive",
        icon: "spiked_block.png",
      },
    ],
  },
  stab_sword: {
    name: "Stab Sword",
    styles: [
      {
        name: "Stab",
        attackType: "Stab",
        combatStyle: "Accurate",
        icon: "stab_sword_stab.png",
      },
      {
        name: "Lunge",
        attackType: "Stab",
        combatStyle: "Aggressive",
        icon: "stab_sword_lunge.png",
      },
      {
        name: "Slash",
        attackType: "Slash",
        combatStyle: "Aggressive",
        icon: "stab_sword_slash.png",
      },
      {
        name: "Block",
        attackType: "Stab",
        combatStyle: "Defensive",
        icon: "stab_sword_block.png",
      },
    ],
  },
  unarmed: {
    name: "Unarmed",
    styles: [
      {
        name: "Punch",
        attackType: "Crush",
        combatStyle: "Accurate",
        icon: "unarmed_punch.png",
      },
      {
        name: "Kick",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "unarmed_kick.png",
      },
      {
        name: "Block",
        attackType: "Crush",
        combatStyle: "Defensive",
        icon: "unarmed_block.png",
      },
    ],
  },
  whip: {
    name: "Whip",
    styles: [
      {
        name: "Flick",
        attackType: "Slash",
        combatStyle: "Accurate",
        icon: "whip_flick.png",
      },
      {
        name: "Lash",
        attackType: "Slash",
        combatStyle: "Controlled",
        icon: "whip_lash.png",
      },
      {
        name: "Deflect",
        attackType: "Slash",
        combatStyle: "Defensive",
        icon: "whip_deflect.png",
      },
    ],
  },
  bow: {
    name: "Bow",
    styles: [
      {
        name: "Accurate",
        attackType: "Ranged",
        combatStyle: "Accurate",
        icon: "bow_accurate.png",
      },
      {
        name: "Rapid",
        attackType: "Ranged",
        combatStyle: "Rapid",
        icon: "bow_rapid.png",
      },
      {
        name: "Longrange",
        attackType: "Ranged",
        combatStyle: "Longrange",
        icon: "bow_longrange.png",
      },
    ],
  },
  crossbow: {
    name: "Crossbow",
    styles: [
      {
        name: "Accurate",
        attackType: "Ranged",
        combatStyle: "Accurate",
        icon: "crossbow_accurate.png",
      },
      {
        name: "Rapid",
        attackType: "Ranged",
        combatStyle: "Rapid",
        icon: "crossbow_rapid.png",
      },
      {
        name: "Longrange",
        attackType: "Ranged",
        combatStyle: "Longrange",
        icon: "crossbow_longrange.png",
      },
    ],
  },
  thrown: {
    name: "Thrown",
    styles: [
      {
        name: "Accurate",
        attackType: "Ranged",
        combatStyle: "Accurate",
        icon: "thrown_accurate.png",
      },
      {
        name: "Rapid",
        attackType: "Ranged",
        combatStyle: "Rapid",
        icon: "thrown_rapid.png",
      },
      {
        name: "Longrange",
        attackType: "Ranged",
        combatStyle: "Longrange",
        icon: "thrown_longrange.png",
      },
    ],
  },
  chinchompa: {
    name: "Chinchompas",
    styles: [
      {
        name: "Short fuse",
        attackType: "Ranged",
        combatStyle: "Accurate",
        icon: "thrown_accurate.png",
      },
      {
        name: "Medium fuse",
        attackType: "Ranged",
        combatStyle: "Rapid",
        icon: "thrown_rapid.png",
      },
      {
        name: "Long fuse",
        attackType: "Ranged",
        combatStyle: "Longrange",
        icon: "thrown_longrange.png",
      },
    ],
  },
  staff: {
    name: "Staff",
    styles: [
      {
        name: "Bash",
        attackType: "Crush",
        combatStyle: "Accurate",
        icon: "staff_bash.png",
      },
      {
        name: "Pound",
        attackType: "Crush",
        combatStyle: "Aggressive",
        icon: "staff_pound.png",
      },
      {
        name: "Focus",
        attackType: "Crush",
        combatStyle: "Defensive",
        icon: "staff_focus.png",
      },
      {
        name: "Spell",
        attackType: "Magic",
        combatStyle: "Casting",
        icon: "staff_spell.png",
      },
      {
        name: "Spell",
        attackType: "Magic",
        combatStyle: "Defensive Casting",
        icon: "staff_spell_defensive.png",
      },
    ],
  },
  powered_staff: {
    name: "Powered Staff",
    styles: [
      {
        name: "Accurate",
        attackType: "Magic",
        combatStyle: "Accurate",
        icon: "powered_staff_accurate.png",
      },
      {
        name: "Longrange",
        attackType: "Magic",
        combatStyle: "Longrange",
        icon: "powered_staff_longrange.png",
      },
    ],
  },
};
var weaponCategoryByItemId = {
  23849: "polearm", 23850: "polearm", 23851: "polearm", // TABLE: corrupted halberds, basic to perfected
  23852: "powered_staff", 23853: "powered_staff", 23854: "powered_staff", // TABLE: corrupted staves
  23855: "bow", 23856: "bow", 23857: "bow", // TABLE: corrupted bows
  27291: "partisan",
  29594: "staff",
  29589: "slash_sword",
  11802: "2h_sword",
  11804: "2h_sword",
  11806: "2h_sword",
  11808: "2h_sword",
  26233: "2h_sword",
  20593: "2h_sword",
  4587: "slash_sword",
  27690: "slash_sword",
  30955: "slash_sword", // Arkan blade
  22324: "stab_sword",
  4151: "whip",
  12006: "whip",
  13576: "blunt",
  21003: "blunt",
  28338: "axe",
  28810: "axe",
  22325: "scythe",
  22486: "scythe",
  25736: "scythe",
  25738: "scythe",
  25739: "scythe",
  25741: "scythe",
  28543: "scythe",
  28545: "scythe",
  11235: "bow",
  20997: "bow",
  23983: "bow",
  24123: "bow",
  25865: "bow",
  25867: "bow",
  27610: "bow",
  29000: "bow",
  29591: "bow",
  9185: "crossbow",
  11785: "crossbow",
  26374: "crossbow",
  11905: "powered_staff",
  11907: "powered_staff",
  12899: "powered_staff",
  22288: "powered_staff",
  22292: "powered_staff",
  22323: "powered_staff",
  22481: "powered_staff",
  22552: "powered_staff",
  22555: "powered_staff",
  23898: "powered_staff",
  23899: "powered_staff",
  23900: "powered_staff",
  25731: "powered_staff",
  25733: "powered_staff",
  27275: "powered_staff",
  27277: "powered_staff",
  27662: "powered_staff",
  27665: "powered_staff",
  28547: "powered_staff",
  28549: "powered_staff",
  28583: "powered_staff",
  28585: "powered_staff",
  28796: "powered_staff",
  31113: "powered_staff",
  31115: "powered_staff",
  33314: "powered_staff",
  33318: "powered_staff",
  33322: "powered_staff",
  33323: "powered_staff",
  33326: "powered_staff",
  12926: "thrown",
  10033: "chinchompa",
  10034: "chinchompa",
  11959: "chinchompa",
  6914: "staff",
  4675: "staff",
  4170: "staff", // Slayer's staff
  21255: "staff", // Slayer's staff (e)
  11791: "staff",
  21006: "staff",
  22296: "staff",
  24422: "staff",
  24424: "staff",
  24425: "staff",
  27624: "staff",
  27676: "staff",
  27679: "staff",
  30070: "staff",
  26219: "stab_sword",
  13652: "claw",
  29577: "claw",
  23528: "spiked",
  24417: "spiked",
  28997: "spiked",
  29850: "spiked",
  30759: "spiked",
  11824: "spear",
  11889: "spear",
  22978: "spear",
  23987: "polearm",
  29796: "polearm",
  11920: "pickaxe",
  13243: "pickaxe",
  13263: "bludgeon",
  21015: "bulwark",
};
var defaultSpellNamesByStaffId = {
  4675: {
    ancient: "Blood Barrage",
  },
  6914: {
    ancient: "Blood Barrage",
  },
  21006: {
    ancient: "Blood Barrage",
    arceuus: "Dark Demonbane",
  },
  24422: {
    ancient: "Blood Barrage",
  },
  24424: {
    ancient: "Blood Barrage",
  },
  24425: {
    ancient: "Blood Barrage",
  },
  27624: {
    ancient: "Blood Barrage",
  },
  29594: {
    arceuus: "Dark Demonbane",
  },
  30070: {
    ancient: "Blood Barrage",
  },
};
function getDefaultStaffSpell(weaponId, spellbook) {
  if (weaponId === undefined) {
    return null;
  }
  const spellName = defaultSpellNamesByStaffId[getBaseItemId(weaponId)]?.[spellbook];
  if (spellName) {
    return getSpellDefinition(spellName);
  } else {
    return null;
  }
}
var defaultCombatStyleByCategory = {
  whip: "Accurate",
};
function getDefaultAttackStyleIndex(weaponId, spellbook = defaultSpellbook) {
  if (getWeaponCategory(weaponId) === undefined) {
    return 0;
  }
  const categoryDefinition = getWeaponCategoryDefinition(weaponId);
  if (getDefaultStaffSpell(weaponId, spellbook)) {
    const castingStyleIndex = categoryDefinition.styles.findIndex((style) => style.combatStyle === "Casting");
    if (castingStyleIndex >= 0) {
      return castingStyleIndex;
    }
  }
  const defaultCombatStyle = defaultCombatStyleByCategory[getWeaponCategoryOrUnarmed(weaponId)];
  const defaultStyleIndex = categoryDefinition.styles.findIndex((style) => style.combatStyle === defaultCombatStyle);
  if (defaultStyleIndex >= 0) {
    return defaultStyleIndex;
  }
  let bestStyleIndex = 0;
  let bestScore = -1;
  for (const [styleIndex, style] of categoryDefinition.styles.entries()) {
    const score =
      (style.combatStyle === "Rapid" ? 100 : 0) +
      (style.combatStyle === "Longrange" ? 10 : 0) +
      (style.combatStyle === "Aggressive"
        ? 3
        : style.combatStyle === "Controlled"
          ? 1
          : 0);
    if (score > bestScore) {
      bestStyleIndex = styleIndex;
      bestScore = score;
    }
  }
  return bestStyleIndex;
}
function isCastingStyleSelected(equippedWeaponId, styleIndex) {
  if (equippedWeaponId === undefined) {
    return false;
  }
  const style = getWeaponCategoryDefinition(equippedWeaponId).styles[styleIndex];
  return (
    !!style &&
    (style.combatStyle === "Casting" || style.combatStyle === "Defensive Casting")
  );
}
function getActiveSpell({
  weaponId: weaponId,
  selectedStyleIndex: selectedStyleIndex,
  selectedSpell: selectedSpell,
  spellbook: spellbook,
}) {
  if (
    !isCastingStyleSelected(weaponId, selectedStyleIndex)
  ) {
    return null;
  }
  if (selectedSpell) {
    const spellDefinition = getSpellDefinition(selectedSpell);
    if (spellDefinition) {
      return {
        name: spellDefinition.name,
        icon: spellDefinition.icon,
        spellbook: spellDefinition.spellbook,
        attackRange: spellDefinition.attackRange,
        ...(spellDefinition.fixedHitDelay === undefined
          ? {}
          : {
              fixedHitDelay: spellDefinition.fixedHitDelay,
            }),
      };
    }
  }
  return getDefaultStaffSpell(weaponId, spellbook);
}
function getWeaponCategory(weaponId) {
  if (weaponId === undefined) {
    return undefined;
  } else {
    return weaponCategoryByItemId[getBaseItemId(weaponId)];
  }
}
function getWeaponCategoryOrUnarmed(weaponId) {
  return getWeaponCategory(weaponId) ?? "unarmed";
}
function getWeaponCategoryDefinition(weaponId) {
  if (weaponId === undefined) {
    return weaponCategoryDefinitions.unarmed;
  }
  const category = getWeaponCategory(weaponId);
  if (category && weaponCategoryDefinitions[category]) {
    return weaponCategoryDefinitions[category];
  } else {
    return weaponCategoryDefinitions.unarmed;
  }
}
export {
  weaponCategoryDefinitions,
  getDefaultAttackStyleIndex,
  getActiveSpell,
  getWeaponCategory,
  getWeaponCategoryOrUnarmed,
  getWeaponCategoryDefinition,
};
