import { getCanonicalEquipmentId } from "../data/equipment.js";
import { getBaseItemId } from "../data/itemVariants.js";
import { getSpecialAttackDefinition } from "../data/specialAttackDefinitions.js";
import { maxRunEnergy, createPoisonState } from "./playerState.js";
import { setNpcDefenceDrain, isNpcBindImmuneAtTick } from "./npcState.js";
function isSoulreaperAxe(weaponId) {
  return undefined !== weaponId && 28338 === getBaseItemId(weaponId);
}
function getSoulreaperStackCount(soulreaper) {
  return soulreaper?.stacks ?? 0;
}
function getSoulreaperStacksForWeapon(weaponId, soulreaperStacks) {
  if (isSoulreaperAxe(weaponId)) {
    return soulreaperStacks ?? 0;
  } else {
    return undefined;
  }
}
var BURN_SEVERITY_RANK = {
  weak: 0,
  normal: 1,
  strong: 2,
  incendiary: 3,
};
var BURN_IMMUNITY_RANK = {
  Weak: 0,
  Normal: 1,
  Strong: 2,
};
function isImmuneToBurn(burnTarget, burnSeverity) {
  if ("incendiary" === burnSeverity) {
    return false;
  }
  const burnImmunity = burnTarget.formulaStats?.burnImmunity;
  return null != burnImmunity && BURN_SEVERITY_RANK[burnSeverity] <= BURN_IMMUNITY_RANK[burnImmunity];
}
function canApplyBurn(target, severity) {
  return (
    !!target.alive &&
    !isImmuneToBurn(target, severity) &&
    (target.burnStacks?.length ?? 0) < 5
  );
}
function applyBurnStack(burnRequest) {
  const { target: target, severity: severity, tick: tick } = burnRequest;
  if (!canApplyBurn(target, severity)) {
    return false;
  }
  const burnStacks = target.burnStacks ?? [];
  if (0 === burnStacks.length) {
    target.burnNextPulseTick = tick + (burnRequest.firstPulseDelayTicks ?? 4);
  }
  target.burnStacks = [
    ...burnStacks,
    {
      origin: burnRequest.origin,
      sourceId: burnRequest.sourceId,
      pulsesRemaining: burnRequest.pulses,
    },
  ];
  return true;
}
var MAX_SPECIAL_ATTACK_ENERGY = 100;
function decrementTickCounter(ticksRemaining) {
  return Math.max(0, ticksRemaining - 1);
}
function getBaseRunEnergyDrain(weight, agility) {
  const weightDrain = Math.floor(60 + (67 * Math.max(0, Math.min(64, weight))) / 64);
  return Math.floor((weightDrain * (300 - agility)) / 300);
}
function getRunEnergyRecovery(agility, gracefulBonusPercent = 0) {
  const baseRecovery = Math.floor(agility / 10) + 15;
  return Math.floor((baseRecovery * (100 + gracefulBonusPercent)) / 100);
}
function updateRunEnergy(runEnergy, runFactors) {
  if (runFactors.isRunning) {
    const baseEnergyDrain = getBaseRunEnergyDrain(runFactors.weight, runFactors.agility);
    const drainPercent = runFactors.staminaActive ? 30 : runFactors.ringOfEnduranceEquipped ? 85 : 100;
    const energyDrain = Math.floor((baseEnergyDrain * drainPercent) / 100);
    return {
      energy: Math.max(0, runEnergy.energy - energyDrain),
    };
  }
  {
    const energyRecovery = getRunEnergyRecovery(runFactors.agility, runFactors.gracefulBonusPercent);
    return {
      energy: Math.min(maxRunEnergy, runEnergy.energy + energyRecovery),
    };
  }
}
function getPoisonDamage(poisonSeverity) {
  return Math.ceil(poisonSeverity / 5);
}
function tickDeathChargeTimers(combatTimers) {
  const deathChargeActiveTicks = decrementTickCounter(combatTimers.deathChargeActiveTicks);
  return {
    deathChargeActiveTicks: deathChargeActiveTicks,
    deathChargeProcsRemaining: 0 === deathChargeActiveTicks ? 0 : combatTimers.deathChargeProcsRemaining,
  };
}
function activateMarkOfDarkness(magicLevel, hasPurgingStaff, combatTimers) {
  if (combatTimers.markOfDarknessCooldownTicks > 0) {
    return null;
  }
  const baseActiveTicks = 3 * magicLevel;
  const markOfDarknessActiveTicks = hasPurgingStaff ? baseActiveTicks * 5 : baseActiveTicks;
  return {
    ...combatTimers,
    markOfDarknessCooldownTicks: 10,
    markOfDarknessActiveTicks: markOfDarknessActiveTicks,
  };
}
function spendSpecialAttackEnergy(specialAttack, energyCost) {
  if (specialAttack.energy < energyCost) {
    return null;
  } else {
    return {
      ...specialAttack,
      energy: specialAttack.energy - energyCost,
    };
  }
}
function isImmuneToPoison(actor) {
  return (actor.formulaStats?.poisonResistance ?? 0) >= 100;
}
function canBePoisoned(poisonTarget) {
  return (
    poisonTarget.alive &&
    !isImmuneToPoison(poisonTarget)
  );
}
function applyPoisonToTarget(poisonRequest) {
  const { target: target, severity: severity, tick: tick } = poisonRequest;
  if (
    severity <= 0 ||
    !canBePoisoned(target)
  ) {
    return false;
  }
  const poison = target.poison;
  target.poison = {
    sourceId: poisonRequest.sourceId,
    severity: Math.max(poison?.severity ?? 0, severity),
    nextPulseTick: poison?.nextPulseTick ?? tick + 30,
  };
  return true;
}
var ECLIPSE_BURN_SEVERITY = "strong";
function normalizeOptionalItemId(itemId) {
  if (undefined === itemId) {
    return undefined;
  } else {
    return getCanonicalEquipmentId(itemId);
  }
}
function previewInstantSpecial(weapon, specialAttack, multiplier, encounter, prayerState) {
  const spec = weapon === undefined ? undefined : getSpecialAttackDefinition(weapon);
  const effect = spec?.instantEffect;
  if (effect !== "powerOfDeath" && effect !== "tumekensLight") return null;
  const costsPrayer = effect === "tumekensLight";
  const cost = Math.max(0, (spec.energyCost ?? 100) * multiplier);
  let message;
  if (costsPrayer && !encounter.getEngineRules?.()?.isTombsOfAmascut) {
    message = "This special attack can only be used within the Tombs of Amascut.";
  } else if (costsPrayer && prayerState.points < 50) {
    message = "You need at least 50 Prayer points to use this special attack.";
  }
  const remaining = message ? null : spendSpecialAttackEnergy(specialAttack, costsPrayer ? cost : Math.floor(cost));
  if (!remaining && costsPrayer && !message) message = "You don't have enough power left.";
  return {
    effect,
    activated: remaining !== null,
    specialAttack: remaining ?? specialAttack,
    prayerState: remaining && costsPrayer ? {...prayerState, points: prayerState.points - 50} : prayerState,
    message,
  };
}
function activateInstantSpecial(engine, player, tick, multiplier) {
  const result = previewInstantSpecial(player.equipment.weapon, player.specialAttack, multiplier, engine.encounter, player.prayerState);
  if (!result) return false;
  player.isSpecialAttackActive = false;
  engine.tickEvents.setCurrentTick(tick);
  if (!result.activated) {
    if (result.message) engine.tickEvents.emit({type: "game_message", kind: "game", segments: [{text: result.message}]});
    return true;
  }
  player.specialAttack = result.specialAttack;
  if (result.effect === "powerOfDeath") {
    player.powerOfDeathUntilTick = tick + 100;
    return true;
  }
  player.prayerState = result.prayerState;
  if (player.prayerState.points === 0) engine.depletePrayer(tick);
  player.vitals.hp = Math.max(player.vitals.hp, Math.floor(player.vitals.maxHp * 1.2));
  player.runEnergy = {...player.runEnergy, energy: maxRunEnergy};
  if (player.poisonState.poisonVarp > 0) player.poisonState = createPoisonState();
  for (const [name, level] of Object.entries(player.stats)) {
    if (name !== "prayer" && name !== "hitpoints" && level.current < level.max) {
      player.stats[name] = {...level, current: level.max};
    }
  }
  engine.syncVitalsToStats();
  engine.tickEvents.emit({type: "player_special_animation", sequenceId: 9544});
  engine.tickEvents.emit({type: "player_graphic_applied", spotAnimId: 2128});
  return true;
}
function hasPowerOfDeathWeapon(player) {
  return (
    undefined !== player.equipment.weapon &&
    "powerOfDeath" === getSpecialAttackDefinition(player.equipment.weapon)?.instantEffect
  );
}
function getPowerOfDeathDamageMultiplier(player, tick) {
  if (tick < (player.powerOfDeathUntilTick ?? 0) && hasPowerOfDeathWeapon(player)) {
    return 0.5;
  } else {
    return 1;
  }
}
function clearPowerOfDeathIfWeaponRemoved(player, damageTaken) {
  if (damageTaken > 0 && !hasPowerOfDeathWeapon(player)) {
    player.powerOfDeathUntilTick = undefined;
  }
}
// `damage` is what the hit took off the target; `rolledDamage` what it
// rolled before the target's remaining hitpoints cut it short.
function applyOnHitSpecialEffects(attacker, target, damage, specialEffects, tick, rolledDamage = damage) {
  applySpecialAttackEffects(attacker, target, damage, specialEffects, tick, "on-hit", rolledDamage);
}
function isDamageIndependentSpecialEffect(specialEffect) {
  return (
    specialEffect.effect === "drain_attack" ||
    "freeze" === specialEffect.effect ||
    specialEffect.effect === "weaken" ||
    specialEffect.effect === "condemn"
  );
}
function applySpecialAttackEffects(attacker, target, damage, specialEffects, tick, trigger, rolledDamage = damage) {
  target.debuffs ||= {};
  for (const specialEffect of specialEffects) {
    switch (specialEffect.effect) {
      case "weaken": {
        const weakenPercent = target.formulaStats?.attributes?.includes("demon") ? 15 : 5;
        const targetLevels = target.formulaStats?.levels;
        target.debuffs.attackDrain =
          (target.debuffs.attackDrain ?? 0) +
          Math.floor(((targetLevels?.attack ?? 1) * weakenPercent) / 100) +
          1;
        target.debuffs.strengthDrain =
          (target.debuffs.strengthDrain ?? 0) +
          Math.floor(((targetLevels?.strength ?? 1) * weakenPercent) / 100) +
          1;
        setNpcDefenceDrain(
          target,
          (target.debuffs.defenceDrain ?? 0) +
            Math.floor(((targetLevels?.defence ?? 1) * weakenPercent) / 100) +
            1,
        );
        break;
      }
      case "condemn":
        setNpcDefenceDrain(
          target,
          Math.max(
            target.debuffs.defenceDrain ?? 0,
            Math.floor(((target.formulaStats?.levels.defence ?? 1) * 15) / 100),
          ),
        );
        target.debuffs.magicDrain = Math.max(
          target.debuffs.magicDrain ?? 0,
          Math.floor((15 * (target.formulaStats?.levels.magic ?? 1)) / 100),
        );
        break;
      case "heal_hp": {
        const healAmount = Math.max(
          specialEffect.minimumHeal ?? 10,
          Math.floor((damage * specialEffect.percentOfDamage) / 100),
        );
        attacker.vitals.hp = Math.min(attacker.vitals.maxHp, attacker.vitals.hp + healAmount);
        attacker.stats.hitpoints.current = attacker.vitals.hp;
        break;
      }
      case "restore_prayer": {
        // `ofRolledDamage`: a share of the damage as rolled, not as dealt.
        // `minimumRestore`: the least it restores, 5 when not given.
        // `maximumPoints`: how far it may raise the points, the player's
        // level when not given. Points already above that are left alone.
        // `points`: a fixed amount instead (Clear Mind).
        const prayerRestoreAmount = specialEffect.points ?? Math.max(
          specialEffect.minimumRestore ?? 5,
          Math.floor(((specialEffect.ofRolledDamage ? rolledDamage : damage) * specialEffect.percentOfDamage) / 100),
        );
        attacker.prayerState.points = Math.max(
          attacker.prayerState.points,
          Math.min(specialEffect.maximumPoints ?? attacker.prayerState.maxPoints, attacker.prayerState.points + prayerRestoreAmount),
        );
        attacker.stats.prayer.current = attacker.prayerState.points;
        break;
      }
      case "drain_defence":
        if (specialEffect.flat) {
          setNpcDefenceDrain(target, (target.debuffs.defenceDrain ?? 0) + damage);
        } else if (specialEffect.percent) {
          const extraDefenceDrain = computePercentLevelDrain(
            target.formulaStats?.levels.defence ?? 1,
            target.debuffs.defenceDrain ?? 0,
            specialEffect.percent,
          );
          setNpcDefenceDrain(target, (target.debuffs.defenceDrain ?? 0) + extraDefenceDrain);
        }
        break;
      case "drain_magic": {
        // `onlyIfUndrained`: nothing while the Magic is already under its level (Seercull's Soulshot).
        if (specialEffect.onlyIfUndrained && (target.debuffs.magicDrain ?? 0) > 0) {
          break;
        }
        const extraMagicDrain = specialEffect.base + Math.floor((damage * specialEffect.percentOfDamage) / 100);
        target.debuffs.magicDrain = (target.debuffs.magicDrain ?? 0) + extraMagicDrain;
        break;
      }
      case "drain_attack":
        if (target.debuffs.attackDrain) {
          break;
        }
        target.debuffs.attackDrain = computePercentLevelDrain(
          target.formulaStats?.levels.attack ?? 1,
          0,
          specialEffect.percent,
        );
        break;
      case "poison":
        applyPoisonToTarget({
          target: target,
          sourceId: attacker.id,
          severity: specialEffect.severity,
          tick: tick,
        });
        break;
      case "freeze": {
        if (isNpcBindImmuneAtTick(target, tick)) {
          break;
        }
        const freezeResistance = target.formulaStats?.freezeResistance ?? 0;
        const freezeTicks = Math.floor((specialEffect.durationTicks * Math.max(0, 100 - freezeResistance)) / 100);
        if (freezeTicks <= 0) {
          break;
        }
        target.debuffs.boundFromTick = tick + 1;
        target.debuffs.boundUntilTick = tick + 1 + freezeTicks;
        break;
      }
      case "bind": {
        if ("on-hit" === trigger && isNpcBindImmuneAtTick(target, tick)) {
          break;
        }
        // A bind is a freeze: its length scales with the target's freeze resistance as the freeze's does above
        // (inferred: no source gives a bind's length under a partial resistance), and a target immune to freezes
        // (TABLE: 100) isn't bound. The Doom's burrowed form is immune in the table, but in his fight he keeps the
        // standing form's formula stats while burrowed, so his burrow drops a bind itself (burrow.js, #156).
        const bindTicks = Math.floor((specialEffect.durationTicks * Math.max(0, 100 - (target.formulaStats?.freezeResistance ?? 0))) / 100);
        if (bindTicks <= 0) {
          break;
        }
        const bindFromTick = tick + (specialEffect.delayTicks ?? 0);
        const bindUntilTick = bindFromTick + bindTicks;
        const boundFromTick = target.debuffs.boundFromTick;
        const boundUntilTick = target.debuffs.boundUntilTick;
        const overlapsExistingBind =
          boundUntilTick !== undefined &&
          (boundFromTick ?? 0) <= bindUntilTick &&
          bindFromTick <= boundUntilTick;
        target.debuffs.boundFromTick = overlapsExistingBind
          ? Math.min(boundFromTick ?? 0, bindFromTick)
          : bindFromTick;
        target.debuffs.boundUntilTick = overlapsExistingBind ? Math.max(boundUntilTick, bindUntilTick) : bindUntilTick;
        break;
      }
      case "burn":
        applyBurnStack({
          target: target,
          sourceId: attacker.id,
          origin: "special-attack",
          severity: specialEffect.severity,
          pulses: specialEffect.pulses,
          tick: tick,
          firstPulseDelayTicks: specialEffect.firstPulseDelayTicks,
        });
        break;
      default:
        throwUnhandledSpecialAttackEffect(specialEffect);
    }
  }
}
function computePercentLevelDrain(baseLevel, currentDrain, percent) {
  return Math.floor((Math.max(0, baseLevel - currentDrain) * percent) / 100);
}
function throwUnhandledSpecialAttackEffect(effect) {
  throw new Error("Unhandled special attack effect: " + JSON.stringify(effect));
}
export {
  isSoulreaperAxe,
  getSoulreaperStackCount,
  getSoulreaperStacksForWeapon,
  canApplyBurn,
  applyBurnStack,
  MAX_SPECIAL_ATTACK_ENERGY,
  decrementTickCounter,
  updateRunEnergy,
  getPoisonDamage,
  tickDeathChargeTimers,
  activateMarkOfDarkness,
  spendSpecialAttackEnergy,
  ECLIPSE_BURN_SEVERITY,
  normalizeOptionalItemId,
  previewInstantSpecial,
  activateInstantSpecial,
  getPowerOfDeathDamageMultiplier,
  clearPowerOfDeathIfWeaponRemoved,
  applyOnHitSpecialEffects,
  isDamageIndependentSpecialEffect,
  applySpecialAttackEffects,
};
