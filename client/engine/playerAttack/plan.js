import { getRangedDefenceType, getPoweredStaffBaseMaxHit } from "../weapons.js";
import { getBaseItemId } from "../../data/itemVariants.js";
import { isArrowOrBolt, variantArrowsByItemId, isAmmoCompatibleWithWeapon } from "../ammunition.js";
import { combatSpells } from "../../data/combatSpells.js";
import {
  getSteadyStateHitChance,
  getSingleRollHitChance,
  getPlayerAccuracyRolls,
  getPlayerStance,
  getFormulaMaxHit,
  getDoubleRollHitChance,
  getPrayerMultipliers,
} from "../combatFormulas.js";
import { applyGuaranteedHitOverrides } from "./roll.js";
function buildReadyAttackPlan(attackSetup, profile) {
  const accuracyRolls = getPlayerAccuracyRolls(
    attackSetup.attacker,
    attackSetup.target,
    attackSetup.formulaStyle,
    attackSetup.equipmentStats,
    attackSetup.prayerMultipliers,
    attackSetup.defenceStyle,
    attackSetup.rangedDefenceType,
  );
  const baseMaxHit = getFormulaMaxHit(
    attackSetup.attacker,
    attackSetup.formulaStyle,
    attackSetup.equipmentStats,
    attackSetup.prayerMultipliers,
  );
  const attackContext = {
    formulaStyle: attackSetup.formulaStyle,
    delivery: attackSetup.delivery,
    // maxHitFlatBonus: damage added to the max hit, after its stages (profiles.js: the rat bone weapons against rats).
    maxHit: resolveProfileMaxHit(baseMaxHit, profile.maxHit) + (profile.maxHitFlatBonus ?? 0),
    accuracyRolls: accuracyRolls,
    standardAccuracyMode: attackSetup.standardAccuracyMode ?? "single_roll",
  };
  return {
    kind: "ready",
    attackSpeedTicks: attackSetup.attackSpeedTicks,
    application: attackSetup.application,
    diagnostics: {
      baseAttackRoll: accuracyRolls.attackRoll,
      baseDefenceRoll: accuracyRolls.defenceRoll,
      baseMaxHit: baseMaxHit,
      profileMaxHit: attackContext.maxHit,
    },
    hits: buildPlannedHitsForProfile(profile, attackContext),
    ...(profile.kind === "accuracyBranchedSplit"
      ? {
          branchSelection: buildAccuracyBranchSelection(profile.branches, profile.allMiss, profile.accuracy, attackContext),
        }
      : {}),
  };
}
// Eight switches of this module end in a `default:` that returns what was
// switched on (a mode, a rounding) or the profile or spec whose `kind` was:
// a value without a case comes back as it went in. Three others throw in
// the same place: two with throwUnhandledAttackRuntimeValue, and
// getBranchSelectionHitChance with a TypeError of its own.
function buildAttackPlanFromProfile(attackSetup) {
  switch (attackSetup.profile.kind) {
    case "unsupported":
      return {
        kind: "unsupported",
        gaps: attackSetup.profile.gaps,
      };
    case "singleHit":
    case "independentMultiHit":
    case "secondHitIfFirstAccurate":
    case "priorDamageHits":
    case "accuracyBranchedSplit":
      return buildReadyAttackPlan(attackSetup, attackSetup.profile);
    default:
      return attackSetup.profile;
  }
}
function getBranchSelectionHitChance(resolvedAccuracy) {
  switch (resolvedAccuracy.kind) {
    case "roll":
      return resolvedAccuracy.chance;
    case "guaranteed":
      return 1;
    default:
      throw new TypeError(
        "Accuracy " + resolvedAccuracy.kind + " cannot select a damage branch",
      );
  }
}
function buildAccuracyBranchSelection(branches, allMissOutcomes, accuracySpec, attackContext) {
  const hitChance = getBranchSelectionHitChance(resolveAccuracySpec(accuracySpec, attackContext.accuracyRolls, attackContext.standardAccuracyMode));
  const [firstBranch, ...otherBranches] = branches;
  if (firstBranch === undefined) {
    throw new RangeError("Expected at least one accuracy branch");
  }
  const buildAttempt = (branch) => ({
    chance: hitChance,
    total: {
      minimumInclusive: resolveMaxHitFractionBound(attackContext.maxHit, branch.totalMinimum),
      maximumInclusive: resolveMaxHitFractionBound(attackContext.maxHit, branch.totalMaximum),
    },
  });
  const [firstAllMissOutcome, ...otherAllMissOutcomes] = allMissOutcomes;
  return {
    attempts: [buildAttempt(firstBranch), ...otherBranches.map(buildAttempt)],
    allMissWeights: [firstAllMissOutcome.weight, ...otherAllMissOutcomes.map((allMissOutcome) => allMissOutcome.weight)],
  };
}
function buildPlannedHitsForProfile(profile, attackContext) {
  switch (profile.kind) {
    case "singleHit":
      return [
        buildPlannedHit(
          profile.hit,
          {
            kind: "always",
          },
          attackContext,
        ),
      ];
    case "independentMultiHit": {
      const [firstMaximumFraction, ...otherMaximumFractions] = profile.maximumFractions;
      // `hitAttackRollStages[i]`: stages applied to hit i's attack roll only
      // (the halberd's Sweep: the second hit at 25% less accuracy).
      const hitAccuracy = (index) => {
        const extraStages = profile.hitAttackRollStages?.[index];
        return extraStages === undefined || extraStages.length === 0 || profile.accuracy.kind === "guaranteed"
          ? profile.accuracy
          : { ...profile.accuracy, attackRollStages: [...(profile.accuracy.attackRollStages ?? []), ...extraStages] };
      };
      const floor = profile.minimumOnMiss === undefined ? undefined : { minimum: profile.minimumOnMiss, cap: profile.damageCap };
      return [
        buildMaxHitFractionHit(firstMaximumFraction, hitAccuracy(0), attackContext, floor),
        ...otherMaximumFractions.map((maximumFraction, index) => buildMaxHitFractionHit(maximumFraction, hitAccuracy(index + 1), attackContext, floor)),
      ];
    }
    case "secondHitIfFirstAccurate":
      return [
        buildPlannedHit(
          profile.first,
          {
            kind: "always",
          },
          attackContext,
        ),
        buildPlannedHit(
          profile.second,
          {
            kind: "ifPriorAccurate",
            priorHitIndex: 0,
          },
          attackContext,
        ),
      ];
    case "priorDamageHits": {
      const [firstFollowUp, ...otherFollowUps] = profile.followUps;
      return [
        buildPlannedHit(
          profile.first,
          {
            kind: "always",
          },
          attackContext,
        ),
        buildPriorDamageFollowUpHit(firstFollowUp, attackContext),
        ...otherFollowUps.map((followUp) => buildPriorDamageFollowUpHit(followUp, attackContext)),
      ];
    }
    case "accuracyBranchedSplit": {
      const [firstBranch, ...otherBranches] = profile.branches;
      const shareCount = firstBranch.shares.length;
      for (const branch of otherBranches) {
        if (branch.shares.length !== shareCount) {
          throw new RangeError(
            "Every accuracy branch must split the total across the same number of hitsplats",
          );
        }
      }
      if (profile.allMiss.some((allMissOutcome) => allMissOutcome.damages.length !== shareCount)) {
        throw new RangeError(
          "Every all-miss outcome must cover the same number of hitsplats as each accuracy branch",
        );
      }
      return [
        buildBranchedSplitHitsplat(profile, 0, attackContext),
        ...firstBranch.shares.slice(1).map((share, index) => buildBranchedSplitHitsplat(profile, index + 1, attackContext)),
      ];
    }
    default:
      return profile;
  }
}
function buildBranchedSplitHitsplat(profile, hitsplatIndex, attackContext) {
  const [firstBranch, ...otherBranches] = profile.branches;
  const getBranchShare = (branch) => {
    const share = branch.shares[hitsplatIndex];
    if (share === undefined) {
      throw new RangeError("Missing branch share for hitsplat " + hitsplatIndex);
    }
    return {
      fraction: share.fraction,
      offset: share.offset,
    };
  };
  const getAllMissDamage = (allMissOutcome) => {
    const damage = allMissOutcome.damages[hitsplatIndex];
    if (undefined === damage) {
      throw new RangeError("Missing all-miss damage for hitsplat " + hitsplatIndex);
    }
    return damage;
  };
  const [firstAllMissOutcome, ...otherAllMissOutcomes] = profile.allMiss;
  return {
    ...attackContext.delivery,
    gate: {
      kind: "always",
    },
    accuracy: {
      kind: "whenDamagePositive",
    },
    damage: {
      kind: "bySelectedBranch",
      branches: [getBranchShare(firstBranch), ...otherBranches.map(getBranchShare)],
      allMiss: [getAllMissDamage(firstAllMissOutcome), ...otherAllMissOutcomes.map(getAllMissDamage)],
    },
  };
}
function buildPlannedHit(hitSpec, gate, attackContext) {
  return {
    ...addImpactDelayOffset(attackContext.delivery, hitSpec.impactDelayOffsetTicks),
    gate: gate,
    accuracy: resolveAccuracySpec(hitSpec.accuracy, attackContext.accuracyRolls, attackContext.standardAccuracyMode),
    damage: resolveDamageSpecForMaxHit(hitSpec.damage, attackContext),
    ...(hitSpec.proc === undefined
      ? {}
      : {
          proc: resolveBoltProcSpec(hitSpec.proc, attackContext.maxHit),
        }),
  };
}
// An enchanted bolt's effect (profiles.js getEnchantedBoltProc) as rolled:
// `ignoresAccuracy`, `guaranteed`, `spotAnimId` and `effects` (applied to the
// target or the shooter when the hit lands) carry over.
function resolveBoltProcSpec(procSpec, maxHit) {
  const boltFields = (spec) => ({
    chance: spec.chancePercent / 100,
    ignoresAccuracy: spec.ignoresAccuracy,
    ...(spec.guaranteed ? { guaranteed: true } : {}),
    spotAnimId: spec.spotAnimId,
    ...(spec.effects ? { effects: spec.effects } : {}),
  });
  switch (procSpec.kind) {
    case "rubyBolt":
      return {
        kind: "fixedDamage",
        ...boltFields(procSpec),
        damage: Math.min(procSpec.cap, Math.floor((procSpec.targetCurrentHp * procSpec.percent) / 100)),
        selfDamageRatio: {
          numerator: 1,
          denominator: 10,
        },
      };
    case "maxHitBolt":
      return {
        kind: "uniformDamage",
        ...boltFields(procSpec),
        minimumInclusive: 0,
        maximumInclusive: Math.floor((maxHit * procSpec.maxHitPercent) / 100),
      };
    case "bonusBolt":
      return {
        kind: "bonusDamage",
        ...boltFields(procSpec),
        bonus: procSpec.bonus,
      };
    default:
      return procSpec;
  }
}
function buildMaxHitFractionHit(maximumFraction, accuracySpec, attackContext, floor) {
  const accuracy = resolveAccuracySpec(accuracySpec, attackContext.accuracyRolls, attackContext.standardAccuracyMode);
  const maximumInclusive = floorMultiplyByRatio(attackContext.maxHit, maximumFraction);
  if (floor !== undefined) {
    return {
      ...attackContext.delivery,
      gate: { kind: "always" },
      accuracy: { kind: "guaranteed" },
      damage: buildFloorOnMissDamage(accuracy, maximumInclusive, floor),
    };
  }
  return {
    ...attackContext.delivery,
    gate: {
      kind: "always",
    },
    accuracy: accuracy,
    damage: {
      kind: "uniform",
      minimumInclusive: 0,
      maximumInclusive: maximumInclusive,
    },
  };
}
// A hit that deals `floor.minimum` even when its accuracy roll fails, and on
// an accurate roll at least the minimum and at most `floor.cap` (the dark
// bow's special, WIKI: Dark bow). As weighted outcomes, so the hit is always
// "accurate" to the rest of the engine: the miss is folded into the damage.
function buildFloorOnMissDamage(accuracy, maximumInclusive, floor) {
  const chance = accuracy.kind === "roll" ? accuracy.chance : 1;
  const outcomes = [];
  if (chance < 1) outcomes.push({ damage: floor.minimum, weight: 1 - chance });
  for (let rolled = 0; rolled <= maximumInclusive; rolled += 1) {
    const damage = Math.min(floor.cap ?? Infinity, Math.max(floor.minimum, rolled));
    outcomes.push({ damage, weight: chance / (maximumInclusive + 1) });
  }
  return { kind: "weighted", outcomes };
}
function buildPriorDamageFollowUpHit(followUp, attackContext) {
  return {
    ...addImpactDelayOffset(attackContext.delivery, followUp.impactDelayOffsetTicks),
    gate: {
      kind: "ifPriorAccurate",
      priorHitIndex: followUp.referenceHitIndex,
    },
    accuracy: {
      kind: "guaranteed",
    },
    damage: {
      kind: "floorFractionOfPriorHit",
      priorHitIndex: followUp.referenceHitIndex,
      numerator: followUp.fraction.numerator,
      denominator: followUp.fraction.denominator,
    },
  };
}
function addImpactDelayOffset(delivery, impactDelayOffsetTicks = 0) {
  if (!Number.isInteger(impactDelayOffsetTicks) || impactDelayOffsetTicks < 0) {
    throw new RangeError(
      "impactDelayOffsetTicks must be a non-negative integer",
    );
  }
  return {
    ...delivery,
    impactDelayTicks: delivery.impactDelayTicks + impactDelayOffsetTicks,
  };
}
function resolveAccuracySpec(accuracySpec, accuracyRolls, standardAccuracyMode) {
  switch (accuracySpec.kind) {
    case "standard":
      return {
        kind: "roll",
        chance: hitChanceForAccuracyMode(
          applyRatioStages(accuracyRolls.attackRoll, accuracySpec.attackRollStages ?? []),
          accuracyRolls.defenceRoll,
          standardAccuracyMode,
        ),
      };
    case "doubleRoll":
      return {
        kind: "roll",
        chance: getDoubleRollHitChance(
          applyRatioStages(accuracyRolls.attackRoll, accuracySpec.attackRollStages ?? []),
          accuracyRolls.defenceRoll,
        ),
      };
    case "guaranteed":
      return {
        kind: "guaranteed",
      };
    default:
      return accuracySpec;
  }
}
function hitChanceForAccuracyMode(attackRoll, defenceRoll, standardAccuracyMode) {
  const singleRollChance = getSingleRollHitChance(attackRoll, defenceRoll);
  switch (standardAccuracyMode) {
    case "single_roll":
      return singleRollChance;
    case "double_roll":
      return getDoubleRollHitChance(attackRoll, defenceRoll);
    case "steady_state":
      return getSteadyStateHitChance(singleRollChance, getDoubleRollHitChance(attackRoll, defenceRoll));
    default:
      return standardAccuracyMode;
  }
}
function resolveDamageSpecForMaxHit(damageSpec, attackContext) {
  switch (damageSpec.kind) {
    case "uniformToMaxHit": {
      const uniformDamage = {
        kind: "uniform",
        minimumInclusive: 0,
        maximumInclusive: attackContext.maxHit,
      };
      if ("magic" === attackContext.formulaStyle) {
        return {
          kind: "minimum",
          base: uniformDamage,
          minimumDamage: 1,
        };
      } else {
        return uniformDamage;
      }
    }
    // The highest of `rolls` uniform rolls from 0 to the max hit, as the weights of each damage: k is the highest
    // in (k + 1)^n - k^n of the (max + 1)^n ways the rolls can fall (the charged Obligator's Thrust, profiles.js).
    case "highestOfUniformToMaxHit":
      return {
        kind: "weighted",
        outcomes: Array.from({ length: attackContext.maxHit + 1 }, (_, damage) => ({
          damage,
          weight: (damage + 1) ** damageSpec.rolls - damage ** damageSpec.rolls,
        })),
      };
    case "uniformMaxHitFractionBounds":
      return {
        kind: "uniform",
        minimumInclusive: resolveMaxHitFractionBound(attackContext.maxHit, damageSpec.minimum),
        maximumInclusive: resolveMaxHitFractionBound(attackContext.maxHit, damageSpec.maximum),
      };
    case "uniformTrimmedMaxHit": {
      const trimAmount = floorMultiplyByRatio(attackContext.maxHit, damageSpec.trim);
      return {
        kind: "uniform",
        minimumInclusive: trimAmount,
        maximumInclusive: attackContext.maxHit - trimAmount,
      };
    }
    default:
      return damageSpec;
  }
}
function resolveProfileMaxHit(baseMaxHit, maxHitSpec) {
  switch (maxHitSpec.kind) {
    case "base":
      return baseMaxHit;
    case "staged":
      return applyRatioStages(baseMaxHit, maxHitSpec.stages);
    // A maximum of the profile's own, which the formula's has no part in (Seercull's Soulshot).
    case "fixed":
      return maxHitSpec.maxHit;
    default:
      return maxHitSpec;
  }
}
function applyRatioStages(baseAmount, ratioStages) {
  return ratioStages.reduce((amount, ratio) => floorMultiplyByRatio(amount, ratio), baseAmount);
}
function floorMultiplyByRatio(amount, ratio) {
  return Math.floor((amount * ratio.numerator) / ratio.denominator);
}
function roundMaxHitBound(unroundedBound, rounding) {
  switch (rounding) {
    case "floor":
      return Math.floor(unroundedBound);
    case "ceiling":
      return Math.ceil(unroundedBound);
    default:
      return rounding;
  }
}
function resolveMaxHitFractionBound(maxHit, fractionBound) {
  const scaledMaxHit = (maxHit * fractionBound.ratio.numerator) / fractionBound.ratio.denominator;
  return Math.max(
    0,
    roundMaxHitBound(scaledMaxHit, fractionBound.rounding) + (fractionBound.offset ?? 0),
  );
}
var voidTopIdSet = new Set([
  8839, 20465, 24177, 33476, 33478, 26463, 27000, 13072, 20467, 24178, 33480,
  33482, 26469, 27003,
]);
var eliteVoidTopIdSet = new Set([13072, 20467, 24178, 33480, 33482, 26469, 27003]);
var voidRobeIdSet = new Set([
  8840, 20469, 24179, 33484, 33486, 26465, 27001, 13073, 20471, 24180, 33488,
  33490, 26471, 27004,
]);
var eliteVoidRobeIdSet = new Set([13073, 20471, 24180, 33488, 33490, 26471, 27004]);
var voidGlovesIdSet = new Set([8842, 20475, 24182, 33492, 33494, 26467, 27002]);
var voidMageHelmIdSet = new Set([11663, 20477, 24183, 33468, 33470, 26473, 27005]);
var voidRangerHelmIdSet = new Set([11664, 20479, 24184, 33472, 33474, 26475, 27006]);
var voidMeleeHelmIdSet = new Set([11665, 20481, 24185, 33464, 33466, 26477, 27007]);
var strengthScaledRangedWeaponIdSet = new Set([29000, 29851]);
var dizanasQuiverIdSet = new Set([28951, 28953, 28955, 28957, 28902, 28906]);
function buildFormulaTarget(target) {
  const formulaStats = target.formulaStats;
  if (undefined === formulaStats) {
    return null;
  } else {
    return {
      kind: "npc",
      id: target.npcTypeId,
      toaRaidLevel: formulaStats.toaRaidLevel,
      levels: {
        ...formulaStats.levels,
        defence: Math.max(
          0,
          formulaStats.levels.defence - (target.debuffs?.defenceDrain ?? 0),
        ),
        magic: Math.max(
          0,
          formulaStats.levels.magic - (target.debuffs?.magicDrain ?? 0),
        ),
      },
      offensive: {
        ...formulaStats.offensive,
      },
      defensive: {
        ...formulaStats.defensive,
      },
      ...(undefined === formulaStats.maxHit
        ? {}
        : {
            maxHit: formulaStats.maxHit,
          }),
    };
  }
}
function addAmmoStats(wornEquipmentStats, addedAmmoStats) {
  return {
    attackStab: wornEquipmentStats.attackStab + addedAmmoStats.attackStab,
    attackSlash: wornEquipmentStats.attackSlash + addedAmmoStats.attackSlash,
    attackCrush: wornEquipmentStats.attackCrush + addedAmmoStats.attackCrush,
    attackMagic: wornEquipmentStats.attackMagic + addedAmmoStats.attackMagic,
    attackRanged: wornEquipmentStats.attackRanged + addedAmmoStats.attackRanged,
    defenceStab: wornEquipmentStats.defenceStab + addedAmmoStats.defenceStab,
    defenceSlash: wornEquipmentStats.defenceSlash + addedAmmoStats.defenceSlash,
    defenceCrush: wornEquipmentStats.defenceCrush + addedAmmoStats.defenceCrush,
    defenceMagic: wornEquipmentStats.defenceMagic + addedAmmoStats.defenceMagic,
    defenceRanged: wornEquipmentStats.defenceRanged + addedAmmoStats.defenceRanged,
    meleeStrength: wornEquipmentStats.meleeStrength + addedAmmoStats.meleeStrength,
    rangedStrength: wornEquipmentStats.rangedStrength + addedAmmoStats.rangedStrength,
    magicDamage: wornEquipmentStats.magicDamage + addedAmmoStats.magicDamage,
    prayer: wornEquipmentStats.prayer + addedAmmoStats.prayer,
    attackSpeed: wornEquipmentStats.attackSpeed,
    attackRange: wornEquipmentStats.attackRange,
  };
}
function getAttackEquipmentStats(planInput) {
  switch (planInput.resources.kind) {
    case "ammo": {
      const ammoStats = planInput.lookupItemStats?.(planInput.resources.ammoId) ?? null;
      if (ammoStats === null) {
        return null;
      } else {
        return adjustEquipmentStatsForAttack(planInput, addAmmoStats(planInput.player.equipmentStats, ammoStats));
      }
    }
    case "spell":
    case "none":
      return adjustEquipmentStatsForAttack(planInput, planInput.player.equipmentStats);
    case "unavailable":
      return null;
    default:
      return throwUnhandledAttackRuntimeValue(planInput.resources);
  }
}
function getMagicBaseMaxHit(planInput) {
  if ("magic" !== planInput.formulaStyle) {
    return;
  }
  switch (planInput.resources.kind) {
    case "spell": {
      const spellId = planInput.resources.spellId;
      const selectedSpell = combatSpells.find((spell) => spell.name === spellId);
      if (undefined === selectedSpell) {
        return null;
      } else if ("Magic Dart" === selectedSpell.name) {
        // WIKI (Magic Dart, Slayer's staff (e)): floor(Magic / 10) + 10, or floor(Magic / 6) + 13 from a
        // Slayer's staff (e) on the player's Slayer task. Here every target counts as one, as for the Slayer helmet.
        const magicLevel = planInput.player.stats.magic.current;
        return getBaseItemId(planInput.player.equipment.weapon) === 21255
          ? Math.floor(magicLevel / 6) + 13
          : Math.floor(magicLevel / 10) + 10;
      } else {
        return selectedSpell.maxHit;
      }
    }
    case "none":
      return (
        getPoweredStaffBaseMaxHit(planInput.player.equipment.weapon, planInput.player.stats.magic.current) ??
        null
      );
    case "ammo":
    case "unavailable":
      return null;
    default:
      return throwUnhandledAttackRuntimeValue(planInput.resources);
  }
}
function buildPlayerAttackPlan(planInput) {
  if ("unsupported" === planInput.profile.kind) {
    return {
      kind: "unsupported",
      gaps: planInput.profile.gaps,
    };
  }
  const formulaTarget = buildFormulaTarget(planInput.target);
  if (formulaTarget === null) {
    return null;
  }
  const equipmentStats = getAttackEquipmentStats(planInput);
  if (equipmentStats === null) {
    return null;
  }
  const magicBaseMaxHit =
    planInput.magicBaseMaxHitOverride ??
    getMagicBaseMaxHit(planInput);
  if (magicBaseMaxHit === null) {
    return null;
  }
  const attackPlan = buildAttackPlanFromProfile({
    attacker: {
      kind: "player",
      levels: {
        attack: planInput.player.stats.attack.current,
        strength: planInput.player.stats.strength.current,
        defence: planInput.player.stats.defence.current,
        ranged: planInput.player.stats.ranged.current,
        magic: planInput.player.stats.magic.current,
      },
      stance: planInput.manualCast ? "Manual Cast" : getPlayerStance(planInput.player),
      voidSet: detectVoidSetKind(planInput.player.equipment),
      ...(isStrengthScaledRangedWeapon(planInput.player.equipment.weapon)
        ? {
            rangedStrengthLevel: planInput.player.stats.strength.current,
          }
        : {}),
      ...(magicBaseMaxHit === undefined
        ? {}
        : {
            magicBaseMaxHit: magicBaseMaxHit,
          }),
      ...(planInput.meleeStrengthBonusPercent
        ? {
            meleeStrengthBonusPercent: planInput.meleeStrengthBonusPercent,
          }
        : {}),
    },
    target: formulaTarget,
    formulaStyle: planInput.formulaStyle,
    equipmentStats: equipmentStats,
    prayerMultipliers: getPrayerMultipliers(planInput.player.activePrayer, planInput.player.offensivePrayer),
    attackSpeedTicks: planInput.attackSpeedTicks,
    delivery: planInput.delivery,
    application: planInput.application,
    profile: planInput.profile,
    ...(planInput.standardAccuracyMode === undefined
      ? {}
      : {
          standardAccuracyMode: planInput.standardAccuracyMode,
        }),
    ...(planInput.defenceStyle === undefined
      ? {}
      : {
          defenceStyle: planInput.defenceStyle,
        }),
    rangedDefenceType: getRangedDefenceType(planInput.player.equipment.weapon),
  });
  if (
    "ready" === attackPlan.kind &&
    "ranged" === planInput.formulaStyle &&
    "ammo" === planInput.resources.kind &&
    "blowpipe" !== planInput.resources.source &&
    variantArrowsByItemId[planInput.resources.ammoId] !== undefined &&
    planInput.player.equipment.weapon !== undefined &&
    isAmmoCompatibleWithWeapon(planInput.player.equipment.weapon, planInput.resources.ammoId)
  ) {
    return applyGuaranteedHitOverrides(attackPlan, {
      guaranteedAccuracy: false,
      guaranteedMaximum: false,
      minimumDamage: () => 3,
    });
  } else {
    return attackPlan;
  }
}
function adjustEquipmentStatsForAttack(planInput, unadjustedStats) {
  const weapon = planInput.player.equipment.weapon;
  const equipmentStats =
    planInput.addedAttackCrush === undefined ? unadjustedStats : { ...unadjustedStats, attackCrush: unadjustedStats.attackCrush + planInput.addedAttackCrush };
  const quiverAdjustedStats =
    "ammo" === planInput.resources.kind &&
    planInput.player.equipment.cape !== undefined &&
    dizanasQuiverIdSet.has(planInput.player.equipment.cape) &&
    isArrowOrBolt(planInput.resources.ammoId)
      ? {
          ...equipmentStats,
          attackRanged: equipmentStats.attackRanged + 10,
          rangedStrength: equipmentStats.rangedStrength + 1,
        }
      : equipmentStats;
  if (isStrengthScaledRangedWeapon(weapon)) {
    return {
      ...quiverAdjustedStats,
      rangedStrength: quiverAdjustedStats.meleeStrength,
    };
  } else if (weapon !== 27275 || planInput.resources.kind !== "none") { // Tumeken's shadow
    return quiverAdjustedStats;
  } else {
    const shadowMultiplier = planInput.isTombsOfAmascut ? 4 : 3;
    return {
      ...quiverAdjustedStats,
      attackMagic: quiverAdjustedStats.attackMagic * shadowMultiplier,
      magicDamage: Math.min(100, shadowMultiplier * quiverAdjustedStats.magicDamage),
    };
  }
}
function isStrengthScaledRangedWeapon(weaponId) {
  return weaponId !== undefined && strengthScaledRangedWeaponIdSet.has(weaponId);
}
function detectVoidSetKind(equipment) {
  const [headId, bodyId, legsId, handsId] = [equipment.head, equipment.body, equipment.legs, equipment.hands].map((itemId) =>
    itemId === undefined ? undefined : getBaseItemId(itemId),
  );
  if (
    bodyId === undefined ||
    undefined === legsId ||
    handsId === undefined ||
    !voidTopIdSet.has(bodyId) ||
    !voidRobeIdSet.has(legsId) ||
    !voidGlovesIdSet.has(handsId)
  ) {
    return "none";
  }
  const hasEliteVoid = eliteVoidTopIdSet.has(bodyId) && eliteVoidRobeIdSet.has(legsId);
  if (headId !== undefined && voidMageHelmIdSet.has(headId)) {
    if (hasEliteVoid) {
      return "elite_magic";
    } else {
      return "magic";
    }
  } else if (headId !== undefined && voidRangerHelmIdSet.has(headId)) {
    if (hasEliteVoid) {
      return "elite_ranged";
    } else {
      return "ranged";
    }
  } else if (headId !== undefined && voidMeleeHelmIdSet.has(headId)) {
    return "melee";
  } else {
    return "none";
  }
}
function throwUnhandledAttackRuntimeValue(runtimeValue) {
  throw new TypeError("Unhandled attack runtime value: " + JSON.stringify(runtimeValue));
}
export { buildPlayerAttackPlan, resolveBoltProcSpec };
