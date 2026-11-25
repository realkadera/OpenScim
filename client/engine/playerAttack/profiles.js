import { getCanonicalEquipmentId, getEquipmentDefinition } from "../../data/equipment.js";
import { getBaseItemId } from "../../data/itemVariants.js";
import { hasSpecialAttack, getSpecialAttackDefinition } from "../../data/specialAttackDefinitions.js";
import {
  ECLIPSE_SPECIAL_FORMULA_GAP,
  ANIMATION_ONLY_SPECIAL_GAP,
  getChinchompaAreaConfig,
  CHINCHOMPA_ACCURACY_PERCENT_BY_STYLE,
  crystalBowIdSet,
  percentToRatio,
  computeFormulaStages,
} from "./formula.js";
var scytheOfViturIdSet = new Set([22325, 22486, 25736, 25738, 25739, 25741, 28543, 28545]);
var dualMacuahuitlIdSet = new Set([28997, 29850]);
var dragonClawsIdSet = new Set([13652, 20784]);
var purgingStaffSpecialIdSet = new Set([29594]);
var scorchingBowIdSet = new Set([29591]);
var burningClawsIdSet = new Set([29577]);
var abyssalBludgeonIdSet = new Set([13263]);
var dragonHunterWeaponIdSet = new Set([21012, 22978, 25916, 25918, 30070]);
var eclipseAtlatlIdSet = new Set([29000, 29851]);
var zaryteCrossbowIdSet = new Set([26374, 27186]); // Zaryte crossbow, and its Last Man Standing copy
// Enchanted bolts against monsters (WIKI: Enchanted bolts, and each bolt's
// page; the Wiki DPS calculator, osrs-dps-calc src/lib/dists/bolts.ts).
// `chancePercent` is the PvM chance without the Hard Kandarin Diary.
// `ignoresAccuracy`: the effect is rolled on a miss too. `spotAnimId`: the
// graphic on the target (CACHE, as tsps server/plugins/combat/data/enchanted-bolts.json).
// Jade and topaz work on players only (WIKI), so they have no entry.
var enchantedBoltByGem = {
  opal: { chancePercent: 5, ignoresAccuracy: true, spotAnimId: 749 },
  pearl: { chancePercent: 6, ignoresAccuracy: true, spotAnimId: 750 },
  sapphire: { chancePercent: 25, ignoresAccuracy: false, spotAnimId: 751 },
  emerald: { chancePercent: 55, ignoresAccuracy: false, spotAnimId: 752 },
  ruby: { chancePercent: 6, ignoresAccuracy: true, spotAnimId: 754 },
  diamond: { chancePercent: 10, ignoresAccuracy: true, spotAnimId: 758 },
  dragonstone: { chancePercent: 6, ignoresAccuracy: false, spotAnimId: 756 },
  onyx: { chancePercent: 11, ignoresAccuracy: false, spotAnimId: 753 },
};
function getEnchantedBoltGem(ammoId) {
  const name = getEquipmentDefinition(ammoId)?.name ?? getEquipmentDefinition(getCanonicalEquipmentId(ammoId))?.name;
  return /^(\w+) (?:dragon )?bolts \(e\)$/i.exec(name ?? "")?.[1]?.toLowerCase();
}
var RATIO_ONE = {
  numerator: 1,
  denominator: 1,
};
var SLAYER_HELM_MELEE_RATIO = {
  numerator: 7,
  denominator: 6,
};
var SLAYER_HELM_IMBUED_RATIO = {
  numerator: 23,
  denominator: 20,
};
var RATIO_HALF = {
  numerator: 1,
  denominator: 2,
};
var RATIO_QUARTER = {
  numerator: 1,
  denominator: 4,
};
var RATIO_ZERO = {
  numerator: 0,
  denominator: 1,
};
var RATIO_23_OVER_20 = {
  numerator: 23,
  denominator: 20,
};
var RATIO_5_OVER_4 = {
  numerator: 5,
  denominator: 4,
};
var RATIO_3_OVER_2 = {
  numerator: 3,
  denominator: 2,
};
var RATIO_DOUBLE = {
  numerator: 2,
  denominator: 1,
};
var slayerHelmetIdSet = new Set([
  11864, 19639, 19643, 19647, 21264, 21888, 23073, 24370, 25898, 25904, 25910,
  29816, 33066, 33338, 33340,
]);
var slayerHelmetImbuedIdSet = new Set([11865, 25177, 26674]);
var defaultSingleHitProfile = {
  kind: "singleHit",
  maxHit: {
    kind: "base",
  },
  hit: {
    accuracy: {
      kind: "standard",
    },
    damage: {
      kind: "uniformToMaxHit",
    },
  },
};
var dualMacuahuitlProfile = {
  kind: "secondHitIfFirstAccurate",
  maxHit: {
    kind: "base",
  },
  first: {
    accuracy: {
      kind: "standard",
    },
    damage: {
      kind: "uniformMaxHitFractionBounds",
      minimum: {
        ratio: {
          numerator: 0,
          denominator: 1,
        },
        rounding: "floor",
      },
      maximum: {
        ratio: RATIO_HALF,
        rounding: "floor",
      },
    },
  },
  second: {
    impactDelayOffsetTicks: 1,
    accuracy: {
      kind: "standard",
    },
    damage: {
      kind: "uniformMaxHitFractionBounds",
      minimum: {
        ratio: {
          numerator: 0,
          denominator: 1,
        },
        rounding: "ceiling",
      },
      maximum: {
        ratio: RATIO_HALF,
        rounding: "ceiling",
      },
    },
  },
};
var dragonDaggerSpecialProfile = buildDoubleHitSpecialProfile(RATIO_23_OVER_20, RATIO_23_OVER_20);
var abyssalDaggerSpecialProfile = buildDoubleHitSpecialProfile(RATIO_5_OVER_4, {
  numerator: 17,
  denominator: 20,
});
var dragonWarhammerSpecialProfile = {
  kind: "singleHit",
  maxHit: {
    kind: "staged",
    stages: [RATIO_3_OVER_2],
  },
  hit: {
    accuracy: {
      kind: "standard",
    },
    damage: {
      kind: "uniformToMaxHit",
    },
  },
};
var bandosGodswordSpecialProfile = buildBoostedSingleHitProfile(RATIO_DOUBLE, {
  numerator: 121,
  denominator: 100,
});
var armadylGodswordSpecialProfile = buildBoostedSingleHitProfile(RATIO_5_OVER_4, {
  numerator: 11,
  denominator: 8,
});
var toxicBlowpipeSpecialProfile = buildBoostedSingleHitProfile(RATIO_DOUBLE, RATIO_3_OVER_2);
var elderMaulSpecialProfile = buildBoostedSingleHitProfile(RATIO_5_OVER_4);
var weapon31113SpecialProfile = buildBoostedSingleHitProfile(RATIO_DOUBLE, {
  numerator: 13,
  denominator: 10,
});
var zamorakSaradominGodswordSpecialProfile = buildBoostedSingleHitProfile(RATIO_DOUBLE, {
  numerator: 11,
  denominator: 10,
});
var OSMUMTENS_FANG_ID = 26219;
var FANG_DAMAGE_TRIM_RATIO = {
  numerator: 15,
  denominator: 100,
};
var osmumtensFangSpecialProfile = {
  kind: "singleHit",
  maxHit: {
    kind: "base",
  },
  hit: {
    accuracy: {
      kind: "doubleRoll",
      attackRollStages: [RATIO_3_OVER_2],
    },
    damage: {
      kind: "uniformMaxHitFractionBounds",
      minimum: {
        ratio: FANG_DAMAGE_TRIM_RATIO,
        rounding: "floor",
      },
      maximum: {
        ratio: RATIO_ONE,
        rounding: "floor",
      },
    },
  },
};
var accursedSceptreSpecialProfile = buildBoostedSingleHitProfile(RATIO_3_OVER_2, RATIO_3_OVER_2);
var accuracyBoostedSpecialProfile = buildBoostedSingleHitProfile(RATIO_5_OVER_4);
var arkanBladeSpecialProfile = buildBoostedSingleHitProfile(RATIO_3_OVER_2, RATIO_3_OVER_2);
var burningClawsSpecialBranches = [
  {
    totalMinimum: {
      ratio: {
        numerator: 3,
        denominator: 4,
      },
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 7,
        denominator: 4,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: {
          numerator: 1,
          denominator: 4,
        },
        offset: 0,
      },
      {
        fraction: {
          numerator: 1,
          denominator: 4,
        },
        offset: 0,
      },
      {
        fraction: {
          numerator: 1,
          denominator: 2,
        },
        offset: 0,
      },
    ],
  },
  {
    totalMinimum: {
      ratio: {
        numerator: 1,
        denominator: 2,
      },
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 3,
        denominator: 2,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: {
          numerator: 1,
          denominator: 2,
        },
        offset: -1,
      },
      {
        fraction: {
          numerator: 1,
          denominator: 2,
        },
        offset: -1,
      },
      {
        fraction: {
          numerator: 0,
          denominator: 1,
        },
        offset: 2,
      },
    ],
  },
  {
    totalMinimum: {
      ratio: {
        numerator: 1,
        denominator: 4,
      },
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 5,
        denominator: 4,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: {
          numerator: 0,
          denominator: 1,
        },
        offset: 1,
      },
      {
        fraction: {
          numerator: 0,
          denominator: 1,
        },
        offset: 1,
      },
      {
        fraction: {
          numerator: 1,
          denominator: 1,
        },
        offset: -2,
      },
    ],
  },
];
var burningClawsAllMissOutcomes = [
  {
    weight: 20,
    damages: [0, 0, 0],
  },
  {
    weight: 40,
    damages: [0, 0, 1],
  },
  {
    weight: 40,
    damages: [0, 0, 2],
  },
];
var dragonClawsSpecialBranches = [
  {
    totalMinimum: {
      ratio: RATIO_HALF,
      rounding: "floor",
    },
    totalMaximum: {
      ratio: RATIO_ONE,
      rounding: "floor",
      offset: -1,
    },
    shares: [
      {
        fraction: RATIO_ONE,
        offset: 0,
      },
      {
        fraction: RATIO_HALF,
        offset: 0,
      },
      {
        fraction: RATIO_QUARTER,
        offset: 0,
      },
      {
        fraction: RATIO_QUARTER,
        offset: 1,
      },
    ],
  },
  {
    totalMinimum: {
      ratio: {
        numerator: 3,
        denominator: 8,
      },
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 7,
        denominator: 8,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ONE,
        offset: 0,
      },
      {
        fraction: RATIO_HALF,
        offset: 0,
      },
      {
        fraction: RATIO_HALF,
        offset: 1,
      },
    ],
  },
  {
    totalMinimum: {
      ratio: RATIO_QUARTER,
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 3,
        denominator: 4,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ONE,
        offset: 0,
      },
      {
        fraction: RATIO_ONE,
        offset: 1,
      },
    ],
  },
  {
    totalMinimum: {
      ratio: RATIO_QUARTER,
      rounding: "floor",
    },
    totalMaximum: {
      ratio: {
        numerator: 5,
        denominator: 4,
      },
      rounding: "floor",
    },
    shares: [
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ZERO,
        offset: 0,
      },
      {
        fraction: RATIO_ONE,
        offset: 0,
      },
    ],
  },
];
var dragonClawsAllMissOutcomes = [
  {
    weight: 2,
    damages: [0, 0, 0, 0],
  },
  {
    weight: 1,
    damages: [1, 1, 0, 0],
  },
  {
    weight: 1,
    damages: [0, 0, 1, 1],
  },
  {
    weight: 1,
    damages: [1, 0, 1, 0],
  },
  {
    weight: 1,
    damages: [0, 1, 0, 1],
  },
];
var specialAttackProfileByWeaponId = new Map([
  [27665, accursedSceptreSpecialProfile], // Accursed sceptre
  [27679, accursedSceptreSpecialProfile], // Accursed sceptre (a)
  [27676, accursedSceptreSpecialProfile], // Accursed sceptre (au)
  [24425, defaultSingleHitProfile], // Eldritch nightmare staff: one magic hit, nothing raised
  [
    27690, // Voidwaker
    {
      kind: "singleHit",
      maxHit: {
        kind: "base",
      },
      hit: {
        accuracy: {
          kind: "guaranteed",
        },
        damage: {
          kind: "uniformMaxHitFractionBounds",
          minimum: {
            ratio: RATIO_HALF,
            rounding: "floor",
          },
          maximum: {
            ratio: RATIO_3_OVER_2,
            rounding: "floor",
          },
        },
      },
    },
  ],
  [11808, zamorakSaradominGodswordSpecialProfile], // Zamorak godsword
  [20374, zamorakSaradominGodswordSpecialProfile], // Zamorak godsword (or)
  [4151, accuracyBoostedSpecialProfile], // Abyssal whip
  [12773, accuracyBoostedSpecialProfile], // Volcanic abyssal whip
  [12774, accuracyBoostedSpecialProfile], // Frozen abyssal whip
  [26482, accuracyBoostedSpecialProfile], // Abyssal whip (or)
  [4587, accuracyBoostedSpecialProfile], // Dragon scimitar
  [30955, arkanBladeSpecialProfile], // Arkan blade
  [12006, defaultSingleHitProfile], // Abyssal tentacle
  [26484, defaultSingleHitProfile], // Abyssal tentacle (or)
  [1215, dragonDaggerSpecialProfile], // Dragon dagger
  [1231, dragonDaggerSpecialProfile], // Dragon dagger(p)
  [5680, dragonDaggerSpecialProfile], // Dragon dagger(p+)
  [5698, dragonDaggerSpecialProfile], // Dragon dagger(p++)
  [13265, abyssalDaggerSpecialProfile], // Abyssal dagger
  [13267, abyssalDaggerSpecialProfile], // Abyssal dagger (p)
  [13269, abyssalDaggerSpecialProfile], // Abyssal dagger (p+)
  [13271, abyssalDaggerSpecialProfile], // Abyssal dagger (p++)
  [13576, dragonWarhammerSpecialProfile], // Dragon warhammer
  [11804, bandosGodswordSpecialProfile], // Bandos godsword
  [20370, bandosGodswordSpecialProfile], // Bandos godsword (or)
  [11802, armadylGodswordSpecialProfile], // Armadyl godsword
  [20368, armadylGodswordSpecialProfile], // Armadyl godsword (or)
  [11806, zamorakSaradominGodswordSpecialProfile], // Saradomin godsword
  [20372, zamorakSaradominGodswordSpecialProfile], // Saradomin godsword (or)
  [12926, toxicBlowpipeSpecialProfile], // Toxic blowpipe
  [21003, elderMaulSpecialProfile], // Elder maul
  [27100, elderMaulSpecialProfile], // Elder maul (or)
  [31113, weapon31113SpecialProfile], // Eye of Ayak
  [26219, osmumtensFangSpecialProfile], // Osmumten's fang
]);
function buildSoulreaperProfile(soulreaperStacks) {
  const cappedStacks = Math.min(5, Math.max(0, Math.floor(soulreaperStacks)));
  if (0 === cappedStacks) {
    return defaultSingleHitProfile;
  } else {
    return {
      kind: "singleHit",
      maxHit: {
        kind: "staged",
        stages: [
          {
            numerator: 100 + cappedStacks * 6,
            denominator: 100,
          },
        ],
      },
      hit: {
        accuracy: {
          kind: "standard",
          attackRollStages: [
            {
              numerator: 100 + cappedStacks * 12,
              denominator: 100,
            },
          ],
        },
        damage: {
          kind: "uniformMaxHitFractionBounds",
          minimum: {
            ratio: {
              numerator: cappedStacks * 6,
              denominator: 100,
            },
            rounding: "floor",
          },
          maximum: {
            ratio: RATIO_ONE,
            rounding: "floor",
          },
        },
      },
    };
  }
}
function isDragonHunterWeaponAgainstDragon(canonicalInput) {
  const targetAttributes = canonicalInput.targetAttributes ?? [];
  return (
    canonicalInput.weaponId !== undefined &&
    targetAttributes.includes("dragon") &&
    dragonHunterWeaponIdSet.has(canonicalInput.weaponId)
  );
}
function buildOsmumtensFangProfile(canonicalInput) {
  const formulaStages = computeFormulaStages(toFormulaStageInput(canonicalInput));
  const attackRollStages = formulaStages.attackRollStages;
  return {
    kind: "singleHit",
    maxHit: maxHitSpecFromStages(formulaStages.maxHitStages),
    hit: {
      accuracy:
        "melee_stab" === canonicalInput.formulaStyle
          ? 0 === attackRollStages.length
            ? {
                kind: "doubleRoll",
              }
            : {
                kind: "doubleRoll",
                attackRollStages: attackRollStages,
              }
          : standardAccuracyFromStages(attackRollStages),
      damage: {
        kind: "uniformTrimmedMaxHit",
        trim: FANG_DAMAGE_TRIM_RATIO,
      },
    },
  };
}
function selectBaseProfile(canonicalInput) {
  if (canonicalInput.isSpecialAttack) {
    if (canonicalInput.weaponId === undefined) {
      return null;
    }
    if (getSpecialAttackDefinition(canonicalInput.weaponId)?.instantEffect !== undefined) {
      return null;
    }
    if (eclipseAtlatlIdSet.has(canonicalInput.weaponId)) {
      return {
        kind: "unsupported",
        gaps: [ECLIPSE_SPECIAL_FORMULA_GAP],
      };
    }
    if (canonicalInput.weaponId === 29589) { // Emberlight
      return buildStandardSingleHitProfile(canonicalInput);
    }
    if (purgingStaffSpecialIdSet.has(canonicalInput.weaponId)) {
      return buildStandardSingleHitProfile(canonicalInput);
    }
    if (scorchingBowIdSet.has(canonicalInput.weaponId)) {
      return defaultSingleHitProfile;
    }
    if (burningClawsIdSet.has(canonicalInput.weaponId)) {
      return buildBranchedSplitProfile(canonicalInput, burningClawsSpecialBranches, burningClawsAllMissOutcomes);
    }
    if (dragonClawsIdSet.has(canonicalInput.weaponId)) {
      return buildBranchedSplitProfile(canonicalInput, dragonClawsSpecialBranches, dragonClawsAllMissOutcomes);
    }
    if (abyssalBludgeonIdSet.has(canonicalInput.weaponId)) {
      const missingPrayerPoints = canonicalInput.playerMissingPrayerPoints ?? 0;
      return {
        kind: "singleHit",
        maxHit: {
          kind: "staged",
          stages: [
            {
              numerator: 200 + Math.max(0, Math.floor(missingPrayerPoints)),
              denominator: 200,
            },
          ],
        },
        hit: {
          accuracy: {
            kind: "standard",
          },
          damage: {
            kind: "uniformToMaxHit",
          },
        },
      };
    }
    if (28338 === canonicalInput.weaponId) { // Soulreaper axe
      return buildSoulreaperProfile(canonicalInput.soulreaperStacks ?? 0);
    }
    if (zaryteCrossbowIdSet.has(canonicalInput.weaponId)) {
      return buildZaryteEvokeProfile(canonicalInput);
    }
    if (canonicalInput.weaponId === SEERCULL_ID) {
      return buildSeercullSoulshotProfile(canonicalInput);
    }
    const specialAttackProfile = specialAttackProfileByWeaponId.get(canonicalInput.weaponId);
    if (undefined !== specialAttackProfile) {
      return specialAttackProfile;
    } else if (hasSpecialAttack(canonicalInput.weaponId)) {
      return {
        kind: "unsupported",
        gaps: [ANIMATION_ONLY_SPECIAL_GAP],
      };
    } else {
      return null;
    }
  }
  if ("spell" === canonicalInput.resources?.kind) {
    return buildStandardSingleHitProfile(canonicalInput);
  } else if (
    isDragonHunterWeaponAgainstDragon(canonicalInput)
  ) {
    return null;
  } else if (canonicalInput.weaponId === OSMUMTENS_FANG_ID) {
    return buildOsmumtensFangProfile(canonicalInput);
  } else if (canonicalInput.weaponId === undefined) {
    return defaultSingleHitProfile;
  } else if (scytheOfViturIdSet.has(canonicalInput.weaponId) || dualMacuahuitlIdSet.has(canonicalInput.weaponId)) {
    if (scytheOfViturIdSet.has(canonicalInput.weaponId)) {
      return {
        kind: "independentMultiHit",
        maxHit: {
          kind: "base",
        },
        accuracy: {
          kind: "standard",
        },
        maximumFractions: scytheHitFractionsForTargetSize(canonicalInput.targetSize),
      };
    } else if (dualMacuahuitlIdSet.has(canonicalInput.weaponId)) {
      return dualMacuahuitlProfile;
    } else {
      return defaultSingleHitProfile;
    }
  } else {
    return buildStandardSingleHitProfile(canonicalInput);
  }
}
function getSlayerHelmRatio(headId, formulaStyle, weaponId) {
  if (headId === undefined || undefined === formulaStyle) {
    return null;
  }
  const canonicalHeadId = getBaseItemId(headId);
  if (formulaStyle.startsWith("melee_") || (undefined !== weaponId && eclipseAtlatlIdSet.has(weaponId))) {
    if (slayerHelmetIdSet.has(canonicalHeadId) || slayerHelmetImbuedIdSet.has(canonicalHeadId)) {
      return SLAYER_HELM_MELEE_RATIO;
    } else {
      return null;
    }
  } else if (slayerHelmetImbuedIdSet.has(canonicalHeadId)) {
    return SLAYER_HELM_IMBUED_RATIO;
  } else {
    return null;
  }
}
function getGreatestCommonDivisor(numerator, denominator) {
  let divisor = Math.abs(numerator);
  let remainder = Math.abs(denominator);
  while (0 !== remainder) {
    [divisor, remainder] = [remainder, divisor % remainder];
  }
  return divisor;
}
function getAdditiveMaxHitRatio(existingRatio, addedRatio) {
  const commonDenominator = existingRatio.denominator * addedRatio.denominator;
  const combinedNumerator =
    existingRatio.numerator * addedRatio.denominator + addedRatio.numerator * existingRatio.denominator - commonDenominator;
  const greatestCommonDivisor = getGreatestCommonDivisor(combinedNumerator, commonDenominator);
  return {
    numerator: combinedNumerator / greatestCommonDivisor,
    denominator: commonDenominator / greatestCommonDivisor,
  };
}
function applyScorchingBowSlayerHelm(profile, slayerHelmRatio) {
  if (
    profile.kind !== "singleHit" ||
    "staged" !== profile.maxHit.kind ||
    profile.maxHit.stages.length !== 1 ||
    "standard" !== profile.hit.accuracy.kind ||
    1 !== profile.hit.accuracy.attackRollStages?.length
  ) {
    return prependProfileMultiplierStage(profile, slayerHelmRatio);
  }
  const additiveMaxHitRatio = getAdditiveMaxHitRatio(profile.maxHit.stages[0], slayerHelmRatio);
  return {
    ...profile,
    maxHit: {
      kind: "staged",
      stages: [additiveMaxHitRatio],
    },
    hit: {
      ...profile.hit,
      accuracy: prependAttackRollStage(profile.hit.accuracy, slayerHelmRatio),
    },
  };
}
function adjustProfileForSlayerHelm(profile, canonicalInput) {
  const slayerHelmRatio = getSlayerHelmRatio(canonicalInput.headId, canonicalInput.formulaStyle, canonicalInput.weaponId);
  if (slayerHelmRatio === null) {
    return profile;
  } else if (
    canonicalInput.weaponId !== undefined &&
    scorchingBowIdSet.has(canonicalInput.weaponId) &&
    true === canonicalInput.targetAttributes?.includes("demon")
  ) {
    return applyScorchingBowSlayerHelm(profile, slayerHelmRatio);
  } else if (undefined !== canonicalInput.weaponId && crystalBowIdSet.has(getBaseItemId(canonicalInput.weaponId))) {
    return appendProfileMultiplierStage(profile, slayerHelmRatio);
  } else {
    return prependProfileMultiplierStage(profile, slayerHelmRatio);
  }
}
function getInquisitorCrushRatio(canonicalInput) {
  if ("melee_crush" !== canonicalInput.formulaStyle) {
    return null;
  }
  const inquisitorCrushBonus = [canonicalInput.headId, canonicalInput.bodyId, canonicalInput.legsId].reduce(
    (total, itemId) => total + (itemId === undefined ? 0 : (inquisitorCrushBonusByItemId.get(itemId) ?? 0)),
    0,
  );
  if (inquisitorCrushBonus === 0) {
    return null;
  } else {
    return {
      numerator: 1000 + inquisitorCrushBonus,
      denominator: 1000,
    };
  }
}
function getChinchompaAccuracyRatio(weaponId, combatStyle, targetDistance) {
  if (undefined === getChinchompaAreaConfig(weaponId) || combatStyle === undefined) {
    return null;
  }
  const accuracyPercentByDistance = CHINCHOMPA_ACCURACY_PERCENT_BY_STYLE[combatStyle];
  if (undefined === accuracyPercentByDistance) {
    return null;
  }
  const accuracyPercent = targetDistance <= 3 ? accuracyPercentByDistance[0] : targetDistance <= 6 ? accuracyPercentByDistance[1] : accuracyPercentByDistance[2];
  if (accuracyPercent === 100) {
    return null;
  } else {
    return {
      numerator: accuracyPercent,
      denominator: 100,
    };
  }
}
function applyChinchompaAccuracy(profile, canonicalInput) {
  if ("ranged" !== canonicalInput.formulaStyle || canonicalInput.targetDistance === undefined) {
    return profile;
  }
  const chinchompaAccuracyRatio = getChinchompaAccuracyRatio(canonicalInput.weaponId, canonicalInput.combatStyle, canonicalInput.targetDistance);
  if (chinchompaAccuracyRatio === null) {
    return profile;
  }
  if ("singleHit" !== profile.kind) {
    throw new TypeError("A chinchompa throw is a single hit, not " + profile.kind);
  }
  return {
    ...profile,
    hit: {
      ...profile.hit,
      accuracy: appendAttackRollStage(profile.hit.accuracy, chinchompaAccuracyRatio),
    },
  };
}
function selectPlayerAttackProfile(profileInput) {
  const canonicalInput = {
    ...profileInput,
    weaponId: profileInput.weaponId === undefined ? undefined : getBaseItemId(profileInput.weaponId),
  };
  const baseProfile = selectBaseProfile(canonicalInput);
  if (baseProfile === null || "unsupported" === baseProfile.kind) {
    return baseProfile;
  }
  const slayerAdjustedProfile = adjustProfileForSlayerHelm(baseProfile, canonicalInput);
  const inquisitorCrushRatio = getInquisitorCrushRatio(canonicalInput);
  return applyChinchompaAccuracy(inquisitorCrushRatio === null ? slayerAdjustedProfile : appendProfileMultiplierStage(slayerAdjustedProfile, inquisitorCrushRatio), canonicalInput);
}
var inquisitorCrushBonusByItemId = new Map([
  [24419, 5], // Inquisitor's great helm
  [24420, 10], // Inquisitor's hauberk
  [24421, 10], // Inquisitor's plateskirt
]);
function prependProfileMultiplierStage(profile, stageRatio) {
  switch (profile.kind) {
    case "singleHit":
      return {
        ...profile,
        maxHit: prependMaxHitStage(profile.maxHit, stageRatio),
        hit: {
          ...profile.hit,
          accuracy: prependAttackRollStage(profile.hit.accuracy, stageRatio),
        },
      };
    case "independentMultiHit":
    case "accuracyBranchedSplit":
      return {
        ...profile,
        maxHit: prependMaxHitStage(profile.maxHit, stageRatio),
        accuracy: prependAttackRollStage(profile.accuracy, stageRatio),
      };
    case "secondHitIfFirstAccurate":
      return {
        ...profile,
        maxHit: prependMaxHitStage(profile.maxHit, stageRatio),
        first: {
          ...profile.first,
          accuracy: prependAttackRollStage(profile.first.accuracy, stageRatio),
        },
        second: {
          ...profile.second,
          accuracy: prependAttackRollStage(profile.second.accuracy, stageRatio),
        },
      };
    case "priorDamageHits":
      return {
        ...profile,
        maxHit: prependMaxHitStage(profile.maxHit, stageRatio),
        first: {
          ...profile.first,
          accuracy: prependAttackRollStage(profile.first.accuracy, stageRatio),
        },
      };
    case "unsupported":
      return profile;
    default:
      return throwUnhandledAttackProfile(profile);
  }
}
function appendProfileMultiplierStage(profile, stageRatio) {
  switch (profile.kind) {
    case "singleHit":
      return {
        ...profile,
        maxHit: appendMaxHitStage(profile.maxHit, stageRatio),
        hit: {
          ...profile.hit,
          accuracy: appendAttackRollStage(profile.hit.accuracy, stageRatio),
        },
      };
    case "independentMultiHit":
    case "accuracyBranchedSplit":
      return {
        ...profile,
        maxHit: appendMaxHitStage(profile.maxHit, stageRatio),
        accuracy: appendAttackRollStage(profile.accuracy, stageRatio),
      };
    case "secondHitIfFirstAccurate":
      return {
        ...profile,
        maxHit: appendMaxHitStage(profile.maxHit, stageRatio),
        first: {
          ...profile.first,
          accuracy: appendAttackRollStage(profile.first.accuracy, stageRatio),
        },
        second: {
          ...profile.second,
          accuracy: appendAttackRollStage(profile.second.accuracy, stageRatio),
        },
      };
    case "priorDamageHits":
      return {
        ...profile,
        maxHit: appendMaxHitStage(profile.maxHit, stageRatio),
        first: {
          ...profile.first,
          accuracy: appendAttackRollStage(profile.first.accuracy, stageRatio),
        },
      };
    case "unsupported":
      return profile;
    default:
      return throwUnhandledAttackProfile(profile);
  }
}
function prependMaxHitStage(maxHitSpec, stageRatio) {
  if (maxHitSpec.kind === "fixed") {
    return maxHitSpec;
  }
  if (maxHitSpec.kind === "base") {
    return {
      kind: "staged",
      stages: [stageRatio],
    };
  } else {
    return {
      kind: "staged",
      stages: [stageRatio, ...maxHitSpec.stages],
    };
  }
}
function appendMaxHitStage(maxHitSpec, stageRatio) {
  if (maxHitSpec.kind === "fixed") {
    return maxHitSpec;
  }
  if ("base" === maxHitSpec.kind) {
    return {
      kind: "staged",
      stages: [stageRatio],
    };
  } else {
    return {
      kind: "staged",
      stages: [...maxHitSpec.stages, stageRatio],
    };
  }
}
function prependAttackRollStage(accuracySpec, stageRatio) {
  switch (accuracySpec.kind) {
    case "standard":
    case "doubleRoll":
      return {
        ...accuracySpec,
        attackRollStages: [stageRatio, ...(accuracySpec.attackRollStages ?? [])],
      };
    case "guaranteed":
      return accuracySpec;
    default:
      return throwUnhandledAttackProfile(accuracySpec);
  }
}
function appendAttackRollStage(accuracySpec, stageRatio) {
  switch (accuracySpec.kind) {
    case "standard":
    case "doubleRoll":
      return {
        ...accuracySpec,
        attackRollStages: [...(accuracySpec.attackRollStages ?? []), stageRatio],
      };
    case "guaranteed":
      return accuracySpec;
    default:
      return throwUnhandledAttackProfile(accuracySpec);
  }
}
function toFormulaStageInput(profileInput) {
  return {
    weaponId: profileInput.weaponId,
    headId: profileInput.headId,
    bodyId: profileInput.bodyId,
    legsId: profileInput.legsId,
    resources: profileInput.resources,
    targetAttributes: profileInput.targetAttributes ?? [],
    targetMagicLevel: profileInput.targetMagicLevel ?? 0,
    targetMagicAttackBonus: profileInput.targetMagicAttackBonus ?? 0,
    markOfDarknessActive: profileInput.markOfDarknessActive ?? false,
    demonbaneVulnerability: profileInput.demonbaneVulnerability ?? 1,
  };
}
function buildStandardSingleHitProfile(profileInput) {
  const formulaStages = computeFormulaStages(toFormulaStageInput(profileInput));
  if (profileInput.weaponId === 27291 && profileInput.formulaStyle?.startsWith("melee_")) { // Keris partisan of the sun
    const chitin = profileInput.targetAttributes?.includes("kalphite") || profileInput.targetAttributes?.includes("scabarite");
    const lowHp = profileInput.isTombsOfAmascut && profileInput.targetCurrentHp < Math.floor(profileInput.targetMaxHp / 4);
    return {
      kind: "singleHit",
      maxHit: maxHitSpecFromStages(chitin ? [...formulaStages.maxHitStages, percentToRatio(133)] : formulaStages.maxHitStages),
      hit: {
        accuracy: standardAccuracyFromStages(lowHp ? [...formulaStages.attackRollStages, percentToRatio(125)] : formulaStages.attackRollStages),
        damage: {kind: "uniformToMaxHit"},
        ...(chitin ? {proc: {kind: "kerisCritical", chance: 1 / 51}} : {}),
      },
    };
  }
  return {
    kind: "singleHit",
    maxHit: maxHitSpecFromStages(formulaStages.maxHitStages),
    hit: {
      accuracy: standardAccuracyFromStages(formulaStages.attackRollStages),
      damage: {
        kind: "uniformToMaxHit",
      },
      ...getEnchantedBoltProc(profileInput),
    },
  };
}
// The enchanted bolt effect a shot can carry. `guaranteed`: the Zaryte
// crossbow's Evoke, which makes the effect certain on an accurate hit (WIKI:
// Zaryte crossbow). The Zaryte crossbow also strengthens every effect by
// about 10% (WIKI), in the numbers below as zaryte ? x : y.
function getEnchantedBoltProc(profileInput, guaranteed = false) {
  const gem = "ammo" === profileInput.resources?.kind ? getEnchantedBoltGem(profileInput.resources.ammoId) : undefined;
  const bolt = gem === undefined ? undefined : enchantedBoltByGem[gem];
  if (bolt === undefined) {
    return {};
  }
  const zaryte = profileInput.weaponId !== undefined && zaryteCrossbowIdSet.has(profileInput.weaponId);
  const attributes = profileInput.targetAttributes ?? [];
  const rangedLevel = profileInput.playerRangedLevel ?? 0;
  const common = {
    chancePercent: bolt.chancePercent,
    ignoresAccuracy: bolt.ignoresAccuracy,
    guaranteed: guaranteed,
    spotAnimId: bolt.spotAnimId,
  };
  const bonus = (extraDamage, effects) => ({
    proc: { kind: "bonusBolt", ...common, bonus: extraDamage, ...(effects ? { effects } : {}) },
  });
  switch (gem) {
    case "opal": // Lucky Lightning: + visible Ranged / 10 (/ 9 Zaryte)
      return bonus(Math.trunc(rangedLevel / (zaryte ? 9 : 10)));
    case "pearl": { // Sea Curse: + Ranged / 20, / 15 on fiery targets (2 less Zaryte)
      const divisor = attributes.includes("fiery") ? 15 : 20;
      return bonus(Math.trunc(rangedLevel / (zaryte ? divisor - 2 : divisor)));
    }
    // Clear Mind: drains a tenth of the target's Ranged level from its prayer; the shooter gets an eighth of that.
    // The Zaryte page both lists a sapphire bonus and says rounding cancels it; left without one.
    case "sapphire": {
      const restored = Math.floor(Math.floor((profileInput.targetRangedLevel ?? 0) / 10) / 8);
      return restored > 0 ? bonus(0, [{ effect: "restore_prayer", points: restored }]) : {};
    }
    case "emerald": // Magical Poison: poison of 5 (6 Zaryte); severity 25 and 27 (getPoisonDamage)
      return bonus(0, [{ effect: "poison", severity: zaryte ? 27 : 25 }]);
    case "dragonstone": // Dragon's Breath: + 20% of visible Ranged (22% Zaryte); fiery and dragon monsters are immune
      return attributes.includes("fiery") || attributes.includes("dragon")
        ? {}
        : bonus(Math.trunc((rangedLevel * (zaryte ? 22 : 20)) / 100));
    case "ruby": // Blood Forfeit: 20% of the target's hitpoints, at most 100 (22% and 110 Zaryte); costs 10% of the shooter's
      if (undefined === profileInput.targetCurrentHp || profileInput.playerCurrentHp === undefined || profileInput.playerCurrentHp < 10) {
        return {};
      }
      return {
        proc: {
          kind: "rubyBolt",
          ...common,
          targetCurrentHp: profileInput.targetCurrentHp,
          percent: zaryte ? 22 : 20,
          cap: zaryte ? 110 : 100,
        },
      };
    case "diamond": // Armour Piercing: 0 to 115% of the max hit (126% Zaryte)
      return { proc: { kind: "maxHitBolt", ...common, maxHitPercent: zaryte ? 126 : 115 } };
    case "onyx": // Life Leech: 0 to 120% of the max hit (132% Zaryte), heals a quarter of the damage; not on the undead
      return attributes.includes("undead")
        ? {}
        : {
            proc: {
              kind: "maxHitBolt",
              ...common,
              maxHitPercent: zaryte ? 132 : 120,
              effects: [{ effect: "heal_hp", percentOfDamage: 25, minimumHeal: 0 }],
            },
          };
    default:
      return {};
  }
}
// Zaryte crossbow's Evoke: doubled accuracy, and the bolt's effect certain on
// an accurate hit (WIKI: Zaryte crossbow, Special attacks).
// Seercull's Soulshot. WIKI: "guaranteed to hit", and its damage "only
// boosted strictly through ammunition and visible range level": Maximum Hit =
// floor(0.5 + (Visible Ranged Level + 10) * (Ammo Ranged Strength + 64) / 640),
// "a stance bonus of 10 ... regardless of attack style used". Prayers, Void,
// the Slayer helmet and every other Ranged strength have no part in it, so
// the maximum is the profile's own and no stage is put on it.
var SEERCULL_ID = 6724;
function getSeercullSoulshotMaxHit(visibleRangedLevel, ammoRangedStrength) {
  return Math.floor((320 + (visibleRangedLevel + 10) * (ammoRangedStrength + 64)) / 640);
}
function buildSeercullSoulshotProfile(profileInput) {
  return {
    kind: "singleHit",
    maxHit: {
      kind: "fixed",
      maxHit: getSeercullSoulshotMaxHit(profileInput.playerRangedLevel ?? 1, profileInput.ammoRangedStrength ?? 0),
    },
    hit: {
      accuracy: {
        kind: "guaranteed",
      },
      damage: {
        kind: "uniformToMaxHit",
      },
    },
  };
}
function buildZaryteEvokeProfile(profileInput) {
  const formulaStages = computeFormulaStages(toFormulaStageInput(profileInput));
  return {
    kind: "singleHit",
    maxHit: maxHitSpecFromStages(formulaStages.maxHitStages),
    hit: {
      accuracy: standardAccuracyFromStages([...formulaStages.attackRollStages, RATIO_DOUBLE]),
      damage: {
        kind: "uniformToMaxHit",
      },
      ...getEnchantedBoltProc(profileInput, true),
    },
  };
}
function maxHitSpecFromStages(maxHitStages) {
  const [firstStage, ...otherStages] = maxHitStages;
  if (firstStage === undefined) {
    return {
      kind: "base",
    };
  } else {
    return {
      kind: "staged",
      stages: [firstStage, ...otherStages],
    };
  }
}
function standardAccuracyFromStages(attackRollStages) {
  if (attackRollStages.length === 0) {
    return {
      kind: "standard",
    };
  } else {
    return {
      kind: "standard",
      attackRollStages: attackRollStages,
    };
  }
}
function buildBranchedSplitProfile(profileInput, branches, allMissOutcomes) {
  const formulaStages = computeFormulaStages(toFormulaStageInput(profileInput));
  return {
    kind: "accuracyBranchedSplit",
    maxHit: maxHitSpecFromStages(formulaStages.maxHitStages),
    accuracy: standardAccuracyFromStages(formulaStages.attackRollStages),
    branches: branches,
    allMiss: allMissOutcomes,
  };
}
function buildDoubleHitSpecialProfile(attackRollRatio, maxHitRatio) {
  return {
    kind: "independentMultiHit",
    maxHit: {
      kind: "staged",
      stages: [maxHitRatio],
    },
    accuracy: {
      kind: "standard",
      attackRollStages: [attackRollRatio],
    },
    maximumFractions: [RATIO_ONE, RATIO_ONE],
  };
}
function buildBoostedSingleHitProfile(attackRollRatio, maxHitRatio) {
  return {
    kind: "singleHit",
    maxHit:
      undefined === maxHitRatio
        ? {
            kind: "base",
          }
        : {
            kind: "staged",
            stages: [maxHitRatio],
          },
    hit: {
      accuracy: {
        kind: "standard",
        attackRollStages: [attackRollRatio],
      },
      damage: {
        kind: "uniformToMaxHit",
      },
    },
  };
}
function throwUnhandledAttackProfile(unhandledProfile) {
  throw new TypeError("Unhandled player attack profile: " + JSON.stringify(unhandledProfile));
}
function scytheHitFractionsForTargetSize(targetSize) {
  if (targetSize === 1) {
    return [RATIO_ONE];
  } else if (targetSize === 2) {
    return [RATIO_ONE, RATIO_HALF];
  } else {
    return [RATIO_ONE, RATIO_HALF, RATIO_QUARTER];
  }
}
export { selectPlayerAttackProfile };
