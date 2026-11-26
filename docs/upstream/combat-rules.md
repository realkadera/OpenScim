# Area: COMBAT RULES & PLAYER (combat-rules)

U = `...\scratchpad\upstream\scimgg` (snapshot commit 3639203, "open-source release", dated 2026-11-24).
O = `C:\_Development\openscim` (read-only; HEAD 12e8785 on feat/encounter-book).

Diff evidence for our post-reconstruction commits:
`...\scratchpad\mapping\combat-rules-ourdiffs.txt`.

---

## 1. Summary verdict

**Same lineage, about the same date, very little drift.** Every rule module I compared
line by line matches upstream: the formulas, the constants and the order of RNG draws.
Only the names differ, and where our code is still a 1:1 transcription, the structure
(`switch` defaults that return the scrutinee, the order of `Math.floor` calls) is upstream's.

Evidence that this is the same snapshot or very close to it:

- `combatFormulas.js` matches `accuracy.ts`, `maxHit.ts`, `effectiveLevels.ts`, `formulaInputs.ts`
  and `playerStance.ts`. The only difference is our ToA roll scaling.
- `playerAttack/formula.js` matches `player/ordinaryAttackModifiers.ts` exactly. That includes
  `PURGING_STAFF_IDS {29594, 33184}`, the twisted bow curve and the 250 magic cap.
- `equipmentStats.js` `equipmentStatOverridesByItemId` and `getItemEquipmentStats` match
  `types/equipmentStats.ts` `EQUIPMENT_STAT_OVERRIDES` and `loadItemStats`. Both have the same
  18 items, and both fall back to the family base for param-less variants.
- `launch.js` ricochet code matches `player/ricochet.ts` (2 hops, 2-tile radius, 2/3 max hit,
  15 cycles, latest-spawn pick, the same primaryKilled rule).
- The whole planner, roll and projection pipeline matches `playerAttackPlanning.ts`,
  `playerAttackResolution.ts`, `playerAttackProjection.ts`, `playerAttackPlanTransforms.ts`,
  `damageSpec.ts` and `damageSplit.ts`.

**Our bundles (2026-11-20) and upstream (2026-11-24) do not differ in any rule of this area
that I could attribute to a time gap.** Every behavioural difference I found is either
(a) an OpenScim addition, or (b) one upstream-side difference that cannot be dated:
the Dizana quiver source check (D3).

There are **no reconstruction errors** in the formulas. The reconstruction is faithful.

**Git caveat (important for §7).** `git log` on this area's files shows only six commits after
the root `7ea8730 "OpenScim"`: #19, #22, #47, #48, #50 and #51. Our pre-public additions are
squashed into the root commit, so git cannot separate them from the bundle code. These include
the enchanted bolts, the Zaryte Evoke, Keris partisan of the sun, Arkan blade, Eldritch
nightmare staff Invocate, Tumeken's light, thralls, ToA scaling, Magic Dart on a Slayer's
staff (e) and the restore_prayer extensions. I attribute them to OpenScim on content
evidence: they are absent from upstream and carry our comment style
(`WIKI:`, `CACHE`, `inferred`, `ponytail:`).

---

## 2. Mapping table

Confidence: H = verified line by line; M = verified structure and key lines; L = name or role only.

### Formulas (`O/client/engine/combatFormulas.js` → U `src/core/combat/*`)

| Ours (file:line) | Upstream (file:line) | Conf | Notes |
|---|---|---|---|
| `prayerMultipliersByPrayer` combatFormulas.js:3 | `PRAYER_STAT_MULTIPLIERS` types/simulation.ts:540 | H | identical values |
| `neutralPrayerMultipliers` :58 | `DEFAULT_PRAYER_MULTIPLIERS` formulaTypes.ts:82 | H | |
| `getEffectiveMeleeAttackLevel` :43 | `meleeAttackEffectiveLevel` effectiveLevels.ts:3 | H | |
| `getEffectiveMeleeStrengthLevel` :302 | `meleeStrengthEffectiveLevel` effectiveLevels.ts:10 | H | the Soulreaper whole-percent sum is identical |
| `getEffectiveRangedAttackLevel` :88 | `rangedAttackEffectiveLevel` :23 | H | |
| `getEffectiveRangedStrengthLevel` :321 | `rangedStrengthEffectiveLevel` :30 | H | elite void 1.125 |
| `getEffectiveMagicAttackLevel` :95 | `magicAttackEffectiveLevel` :37 | H | void 1.45 applies before the stance bonus |
| `getEffectiveMeleeOrRangedDefenceLevel` :171 | `playerDefenceEffectiveLevel` :44 | H | |
| `getEffectiveMagicDefenceLevel` :166 | `playerMagicDefenceEffectiveLevel` :49 | H | 7/10 magic + 3/10 defence |
| `getStanceDefenceBonus` :49 | `defenceStyleBonus` :55 | H | |
| `getSingleRollHitChance` :67 | `hitChance` accuracy.ts:20 | H | |
| `getDoubleRollHitChance` :74 | `doubleRollHitChance` :26 | H | |
| `getSteadyStateHitChance` :81 | `steadyStateHitChance` :32 | H | |
| `getPlayerAttackRoll` :110 | `playerAttackRoll` :81 | H | |
| `getPlayerAccuracyRolls` :132 | `calculatePlayerNpcRollDetails` :44 | H | |
| `getNpcAttackAccuracy` :141 | `calculateAccuracy` :62 | H | ours wraps the roll in `scaleToaAccuracyRoll` (ours, Zebak/ToA) |
| `getNpcAttackRoll` :152 | `npcAttackRoll` :103 | H | |
| `getPlayerDefenceRoll` :190 | `playerDefenceRoll` :118 | H | |
| `getEquipmentDefenceBonus` :174 | `playerDefenceBonus` :163 | H | |
| `getNpcDefenceRoll` :239 | `npcDefenceRoll` :141 | H | ours adds `scaleToaAccuracyRoll(roll, target.toaRaidLevel)` |
| `getNpcDefensiveBonus` / `getRangedDefensiveBonus` :223/:211 | `npcDefenceBonus` / `npcRangedDefenceBonus` :180/:201 | H | |
| `combinePrayerMultipliers` / `getPrayerMultipliers` :261/:285 | `lookupPrayerMultipliers` / `lookupPrayerMultipliersFromState` formulaInputs.ts:4/:25 | H | |
| `getNpcMaxHit` / `getPlayerMaxHit` / `getFormulaMaxHit` :288/:334/:359 | `npcMaxHit` / `playerMaxHit` / `calculateMaxHit` maxHit.ts:28/:43/:12 | H | |
| `getMaxHitFromEffectiveLevel` :369 | `maxHitFromStrength` maxHit.ts:68 | H | |
| `getStanceForCombatStyle` + `throwUnhandledCombatStyle` :375/:372 | `toFormulaStance` + `assertNever` playerStance.ts:23/:42 | H | |
| `getPlayerStance` :393 | `selectedCombatStance` playerStance.ts:14 | H | |
| `getDrainedNpcFormulaStats`, `getPlayerFormulaStats` :405/:423 | (inline in callers / NpcActor) | L | |

### Player attack pipeline (`O/client/engine/playerAttack/*`)

| Ours | Upstream | Conf | Notes |
|---|---|---|---|
| `formula.js` `computeFormulaStages` :159 | `player/ordinaryAttackModifiers.ts` `ordinaryModifierStages` :70 | H | identical |
| `formula.js` `getDemonbaneSpellStages` / `getTwistedBowStages` / `getCrystalBowStages` / `getDemonbaneWeaponStages` / `twistedBowScalingPercent` / `scalePercentByDemonbaneVulnerability` | `demonbaneSpellStages` / `twistedBowStages` / `crystalArmourStages` / `demonbaneWeaponStages` / `twistedBowBonusPercent` / `demonbanePercent` | H | |
| `formula.js` `crystalBowIdSet` :44 | `CRYSTAL_ARMOUR_BOW_IDS` ordinaryAttackModifiers.ts:31 | H | |
| `formula.js` `ECLIPSE_SPECIAL_FORMULA_GAP`, `ANIMATION_ONLY_SPECIAL_GAP` | `CALC_GAPS.*` combatGaps.ts | H | |
| `formula.js` `getChinchompaAreaConfig`, `CHINCHOMPA_ACCURACY_PERCENT_BY_STYLE` | `player/chinchompa.ts` `getChinchompaArea`, `FUSE_ACCURACY_PERCENT` | H | |
| `formula.js` `isDemonbaneAttack` :64 | — | H | ours (#22, Doom) |
| `profiles.js` `selectPlayerAttackProfile` :865 | `player/playerAttackProfileSelection.ts` `selectPlayerAttackProfile` :320 | H | |
| `profiles.js` `selectBaseProfile` :636 | `selectBasePlayerAttackProfile` :384 | H | ours adds the Zaryte Evoke; the Soulreaper branch is equal |
| `profiles.js` `buildStandardSingleHitProfile` :1043 | `ordinaryProfileWithModifiers` :620 | H | ours adds the Keris partisan of the sun branch |
| `profiles.js` `getEnchantedBoltProc` :1074 | `enchantedBoltProc` :634 | H | upstream has ruby and diamond only; ours covers 8 gems plus Zaryte |
| `profiles.js` `adjustProfileForSlayerHelm` / `getSlayerHelmRatio` / `applyScorchingBowSlayerHelm` / `getAdditiveMaxHitRatio` / `getGreatestCommonDivisor` | `withSlayerTaskBonus` / `slayerTaskBonus` / `addScorchingBowSlayerBonus` / `addPercentageBonuses` / `greatestCommonDivisor` | H | |
| `profiles.js` `getInquisitorCrushRatio`, `inquisitorCrushBonusByItemId` | `inquisitorCrushBonus`, `INQUISITOR_CRUSH_PER_MILLE` | H | |
| `profiles.js` `applyChinchompaAccuracy` / `getChinchompaAccuracyRatio` | `withChinchompaFuse` / `chinchompaFuseAccuracy` | H | |
| `profiles.js` `prepend/appendProfileMultiplierStage`, `prepend/appendMaxHitStage`, `prepend/appendAttackRollStage` | `prepend/appendGearBonus`, `prepend/appendMaxHitStage`, `prepend/appendAccuracyStage` | H | |
| `profiles.js` `buildBranchedSplitProfile` | `clawSpecialProfile` | H | |
| `profiles.js` `buildOsmumtensFangProfile` | `fangOrdinaryProfile` | H | |
| `profiles.js` `buildSoulreaperProfile` | `beheadProfile` | H | |
| `profiles.js` `buildDoubleHitSpecialProfile` / `buildBoostedSingleHitProfile` | `independentSpecialProfile` / `singleHitSpecialProfile` | H | |
| `profiles.js` `scytheHitFractionsForTargetSize` | `selectScytheMaximumFractions` | H | |
| `profiles.js` `defaultSingleHitProfile`, `dualMacuahuitlProfile`, `dragonDaggerSpecialProfile`, `weapon31113SpecialProfile`, `zamorakSaradominGodswordSpecialProfile`, `accursedSceptreSpecialProfile`, `accuracyBoostedSpecialProfile`, `osmumtensFangSpecialProfile`, `burningClawsSpecialBranches` / `AllMissOutcomes`, `dragonClawsSpecialBranches` / `AllMissOutcomes`, `specialAttackProfileByWeaponId` | `ORDINARY_ATTACK_PROFILE`, `DUAL_MACUAHUITL_PROFILE`, `DRAGON_DAGGER_PROFILE`, `EYE_OF_AYAK_PROFILE`, `SARADOMIN_GODSWORD_PROFILE`, `CONDEMN_PROFILE`, `QUARTER_ACCURACY_PROFILE`, `EVISCERATE_PROFILE`, `BURNING_BARRAGE_BRANCHES` / `_ALL_MISS`, `SLICE_AND_DICE_BRANCHES` / `_ALL_MISS`, `SPECIAL_ATTACK_PROFILES` | H | ours adds Arkan blade 30955 and Eldritch nightmare staff 24425 |
| `profiles.js` `RATIO_23_OVER_20`, `RATIO_5_OVER_4`, `RATIO_3_OVER_2`, `RATIO_DOUBLE`, `SLAYER_HELM_*_RATIO` | `DRAGON_DAGGER_MODIFIER`, `ABYSSAL_DAGGER_ACCURACY`, `THREE_HALVES`, `DOUBLE`, `SLAYER_MELEE_BONUS` / `SLAYER_IMBUED_BONUS` | H | |
| `plan.js` `buildReadyAttackPlan` :15 | `playerAttackPlanning.ts` `compileReadyPlan` :77 | H | |
| `plan.js` `buildAttackPlanFromProfile` :61 | `planPlayerAttack` :62 | H | |
| `plan.js` `buildAccuracyBranchSelection` / `getBranchSelectionHitChance` | `compileBranchSelection` / `accuracySpecChance` | H | |
| `plan.js` `buildPlannedHitsForProfile` / `buildPlannedHit` / `buildBranchedSplitHitsplat` / `buildMaxHitFractionHit` / `buildPriorDamageFollowUpHit` / `addImpactDelayOffset` | `compileHits` / `compileHit` / `compileSplitHit` / `compileIndependentHit` / `compilePriorDamageHit` / `compileDelivery` | H | |
| `plan.js` `resolveBoltProcSpec` :235 | `compileProc` :239 | H | ours carries `ignoresAccuracy`, `guaranteed`, `spotAnimId`, `effects`, plus the `bonusBolt` kind |
| `plan.js` `resolveAccuracySpec` / `hitChanceForAccuracyMode` / `resolveDamageSpecForMaxHit` / `resolveProfileMaxHit` / `applyRatioStages` / `floorMultiplyByRatio` / `resolveMaxHitFractionBound` / `roundMaxHitBound` | `compileAccuracy` / `standardAccuracyChance` / `compileDamage` / `applyMaxHitProfile` / `applyStages` / `applyRatio` / `roundFraction` / `roundBound` | H | |
| `plan.js` `buildPlayerAttackPlan` :545 | `playerAttackRuntime.ts` `planPlayerAttackFromRuntime` :63 | H | see D3 and D4 |
| `plan.js` `buildFormulaTarget` / `getAttackEquipmentStats` / `adjustEquipmentStatsForAttack` / `addAmmoStats` / `getMagicBaseMaxHit` / `detectVoidSetKind` / `isStrengthScaledRangedWeapon` / `voidTopIdSet`… / `dizanasQuiverIdSet` | `resolveTarget` / `resolveEquipmentStats` / `applyWeaponStatEffects` / `addAmmoStats` / `resolveMagicBaseMaxHit` / `resolveVoidSet` / `isEclipseAtlatl` / `VOID_TOP_IDS`… / `CHARGED_DIZANA_QUIVER_IDS` | H | |
| `roll.js` `rollAttackPlan` :193 | `playerAttackResolution.ts` `resolvePlayerAttack` :22 | H | |
| `roll.js` `rollSelectedBranch` / `pickWeightedIndex` / `resolvePlannedHitRoll` / `isHitGatePassed` / `rollAccuracySpec` / `requireResolvedPriorHit` / `throwUnhandledAttackVariant` | `selectBranch` / `selectWeightedIndex` / `resolvePlannedHit` / `resolveGate` / `resolveAccuracy` / `getPriorHit` / `assertNever` | H | see D1 for the proc branch |
| `roll.js` `rollDamageSpec` / `floorScaleDamageByRatio` | `damageSpec.ts` `sampleDamageSpec` / `floorScale` | H | |
| `roll.js` `applyGuaranteedHitOverrides` / `lowerDamageSpecMaximum` / `mapAttackPlanHits` / `withMinimumDamage` | `playerAttackPlanTransforms.ts` `transformPlayerAttackPlan` / `scaleMaximum` (+ `scalePlayerAttackMaximum`) / `mapHits` / `minimumDamage` | H | |
| `projection.js` `projectPlayerAttack` + step function | `playerAttackProjection.ts` `projectPlayerAttack` | M | ours adds the bolt and keris branches at :406-486 |
| `projection.js` `forEachDamageOutcome` | `damageSpecMass.ts` `visitDamageSpecOutcomes` | M | |
| `projection.js` `forEachProcDamageOutcome` / `isHitGatePassedForPriorAccuracy` / `projectedAccuracyChance` / `requirePriorAccuracyResult` | `visitProcDamageOutcomes` / `gatePasses` / `accuracySuccessChance` / `getPriorAccuracy` | H | |
| `projection.js` `resolveBranchedSplatDamage`, `sumOutcomeWeights` | `damageSplit.ts` `selectedBranchDamage`, `totalWeight` | M | |
| `projection.js` dependency-key helpers | `playerAttackProjectionDependencies.ts` | M | |
| `projection.js` `isConflictionGauntletsAttack` / `isSameConflictionAttack` | `player/confliction.ts` `isConflictionAttackEligible` / `identitiesMatch` | M | |
| `planPlayerAttack.js` `planPlayerAttack` :15 | `player/firstPartyPlayerAttack.ts` `planFirstPartyPlayerAttackInternal` :158 | H | ours adds the #19 `playerAlwaysAccurate` rule and ToA fields |
| `planPlayerAttack.js` `summarizePrimaryHitAccuracy` :119 | `sharedAccuracyOf` :245 | H | |
| `planPlayerAttack.js` `rollAttackPlanOutcome` :126 | `resolveFirstPartyPlayerAttack` + `resolveWithSharedAccuracy` :261/:285 | H | ours passes the bolt `procSpotAnimId` / `procEffects` through |
| `planPlayerAttack.js` `scaleAttackPlanMaximumHit` | `scalePlayerAttackMaximum` | H | |
| `planPlayerAttack.js` `getSelectedCombatStyle` / `getSpecialDefenceStyleOverride` | `selectedCombatStyle` / `specialDefenceStyle` | H | |
| `SimulationEngine.js:461` `computeTheoreticalDps` | `projectFirstPartyPlayerAttack` :122 | H | |
| `launch.js` `launchPlayerAttack` :368 | `player/playerAttackLaunch.ts` `launchPlayerAttack` :77 | H | ours adds keris, `playerDamageOnNpc` (#22), `attackOnCooldown` (#22), `keepsReady` (#48), `protectedByNpcPrayer` (#51) and `procEffects` |
| `launch.js` `filterPostHitEffectsByChance` :146 | `rollBranchedEffects` :62 | H | |
| `launch.js` `rollSpellSecondaryEffects` / `getSpellSecondaryEffect` / `getSpellLaunchHeal` / `applyAncientSceptreBonus` / `isAncientSceptreEquipped` / `ancientSceptreIdSet` | `player/spellHitEffects.ts` `resolveSpellHitEffects` / `secondaryEffectOf` / `resolveSpellLaunchHeal` / `boosted` / `hasAncientSceptre` / `ANCIENT_SCEPTRE_CANONICAL_IDS` | H | the literal `0.125` maps to `SMOKE_POISON_CHANCE` |
| `launch.js` `rollBloodFuryHeal` / `applyBloodFuryHeal` / `BLOOD_FURY_HEAL_GRAPHIC` | `player/onHitPassives.ts` `rollBloodFury` + `playerAttackLaunch.ts` `rollBloodFuryAtLaunch` / `BLOOD_FURY_SPOTANIM` | H | |
| `launch.js` `applyOutgoingDamageMultipliers` / `healPlayerFromDamageDealt` / `isAttackRejectedByEncounter` | `scaledOutgoingDamage` / `healAtLaunch` / `isForcedMiss` | H | |
| `launch.js` `awardAttackXp` / `computeXpGains` / `applyXpGains` / `SHARED_XP_PER_DAMAGE` | `emitPlayerAttackXp` / `xp.ts` `computeXpGains` / `accumulateXpDeltas` / `FOUR_THIRDS` | H | |
| `launch.js` `resolvePendingConflictionAttack` / `getConflictionAttack` | `confliction.ts` `updatePendingConflictionAttack` / `resolveConflictionAttackIdentity` | M | |
| `launch.js` `canPlayerTargetActor` / `clearPlayerAttackTarget` / `setPlayerAttackTarget` / `clearInvalidPlayerAttackTarget` | `player/playerAttackIntent.ts` `canPlayerStartAttackOn` / `clearPlayerAttackIntent` / `registerPlayerAttackIntent` / `cancelBlockedPlayerAttack` | M | |
| `launch.js` ricochet: `venatorBowIdSet` / `isVenatorBow` / `RICOCHET_MAX_HIT_RATIO` / `getActorCenterTile` / `getActorCenterTiles` / `canRicochetBetweenActors` / `pickLatestSpawnedActor` / `ricochetHopStartCycles` / `findRicochetHopTargets` / `buildVenatorRicochet` | `player/ricochet.ts` `RICOCHET_WEAPON_BASE_IDS` / `hasRicochet` / `RICOCHET_MAX_HIT_SCALE` / `ricochetOrigin` / `ricochetSearchTiles` / `isRicochetReachable` / `latestAllocated` / `ricochetStartCycles` / `selectRicochetTargets` / `PlayerAutoAttackSystem.ts` `resolveRicochet` :445 | H | the literals 2, 2 and 15 map to `RICOCHET_MAX_HOPS`, `RICOCHET_RADIUS_TILES` and `RICOCHET_FLIGHT_CYCLES` |
| `launch.js` `collectAreaTargetsAround` :666 | `player/spellAreaTargets.ts` `selectSecondarySpellTargets` | H | |
| `launch.js` `facePlayerTowardTarget` :701 | `player/playerFacing.ts` `facePlayerTowardNpc` | M | |
| `launch.js` `getSoulreaperAfterAttack` :800 | `player/soulreaper.ts` `afterSoulreaperAttack` | M | |
| `launch.js` `resolvePlayerCombatParams` :684 | `PlayerAutoAttackSystem.ts` `resolvePlayerAttackParams` :73 | M | |
| `launch.js` `performPlayerAutoAttack` :811 | `PlayerAutoAttackSystem.ts` `processPlayerAutoAttack` :91 | M | not diffed line by line (about 360 lines); spot checks only |
| `launch.js` `isPrimaryTargetKilledByHits` :1174 | `PlayerAutoAttackSystem.ts` `isLethalAtLaunch` :490 | L | |

### Effects, timers, player state

| Ours | Upstream | Conf | Notes |
|---|---|---|---|
| `damage.js` `resolveRolledDamage` | `damageCalculation.ts` `resolveDamage` :9 | H | |
| `damage.js` `isCorrectProtectionPrayer` | `didPrayCorrectly` :20 | H | |
| `damage.js` `applyPrayerReduction` | `calculatePrayerDamage` :32 | H | upstream carries the long "do NOT restore subtract-blocked form" comment; ours has none |
| — | `BYPASS_PROTECTION_PRAYER` :81 | H | upstream only; ours inlines `{type:"bypass"}` |
| `specialAttacks.js` `applySpecialAttackEffects` / `applyOnHitSpecialEffects` :238/:227 | `player/specialAttacks/postHitEffects.ts` `applyEffects` / `applySpecialAttackEffects` / `applyOnFireSpecialAttackEffects` | H | see D6 for restore_prayer |
| `specialAttacks.js` `isDamageIndependentSpecialEffect` :230 | `appliesOnAccurateHit` postHitEffects.ts:35 | H | |
| `specialAttacks.js` `computePercentLevelDrain` | `drainOfCurrentLevel` | H | |
| `specialAttacks.js` `canApplyBurn` / `applyBurnStack` / `isImmuneToBurn` / `BURN_SEVERITY_RANK` / `BURN_IMMUNITY_RANK` | `burnStacks.ts` `canLayBurnStack` / `layBurnStack` / `isImmuneToBurn` / `SEVERITY_RANK` / `IMMUNITY_RANK` | H | literals 4 and 5 map to `BURN_PERIOD_TICKS` and `MAX_ACTIVE_BURN_STACKS` |
| `specialAttacks.js` `applyPoisonToTarget` / `canBePoisoned` / `isImmuneToPoison` | `npcPoison.ts` `applyNpcPoison` / `canPoisonNpc` / `isImmuneToPoison` | H | the literal 30 maps to `POISON_PERIOD_TICKS` |
| `specialAttacks.js` `getPoisonDamage` | `timers.ts` `ordinaryPoisonDamage` | H | |
| `specialAttacks.js` `updateRunEnergy` / `getBaseRunEnergyDrain` / `getRunEnergyRecovery` | `timers.ts` `tickRunEnergy` / `calculateRunEnergyDrain` / `calculateRunEnergyRegen` | H | |
| `specialAttacks.js` `tickDeathChargeTimers` / `activateMarkOfDarkness` / `spendSpecialAttackEnergy` / `decrementTickCounter` / `MAX_SPECIAL_ATTACK_ENERGY` | `timers.ts` `expireDeathCharge` / `castMarkOfDarkness` / `useSpecialAttack` / `decrementTimer` / `SPECIAL_ATTACK_MAX_ENERGY` | H | |
| `specialAttacks.js` `previewInstantSpecial` / `activateInstantSpecial` / `getPowerOfDeathDamageMultiplier` / `clearPowerOfDeathIfWeaponRemoved` / `hasPowerOfDeathWeapon` | `specialAttacks/instantSpecial.ts` `resolveInstantSpecialActivation` / `activateInstantSpecial` / `powerOfDeathMeleeMultiplier` / `endPowerOfDeathOnDamage` / `hasPowerOfDeathStaff` | H | ours adds `tumekensLight` |
| `specialAttacks.js` `isSoulreaperAxe` / `getSoulreaperStackCount` / `getSoulreaperStacksForWeapon` | `soulreaper.ts` `isSoulreaperAxe` / `soulreaperStackCount` / `soulreaperDisplayedStacks` (?) | M | |
| `SimulationEngine.js:188` `decaySoulreaperStacks` | `soulreaper.ts` `tickSoulreaperDecay` | M | |
| `SimulationEngine.js:218` `drainPrayerPoints` | `timers.ts` `tickPrayerDrain` :315 | H | identical, including the activation-tick skip |
| `SimulationEngine.js:276/294/301` `applyLightbearerEquipped` / `getSpecialAttackRegenIntervalTicks` / `regenerateSpecialAttackEnergy` | `timers.ts` `syncLightbearer` / `getSpecialRegenTicks` / `tickSpecialAttack` | H | |
| `SimulationEngine.js:327/371` `tickStatDecayLocks` / `applyStatDecayAndRecovery` | `statLevels.ts` `expireStatDecayLocks` / `tickNaturalStatChange` | H | `statBoostDecayExtended` logic is equivalent |
| `SimulationEngine.js:411/418` `isPreserveActive` / `isRapidRestoreDue` | `timers.ts` `isPreserveQualified` / `isRapidRestoreDue` | H | |
| `SimulationEngine.js:429/449` `consumeDeathChargeProc` / `activateDeathChargeTimers` | `timers.ts` `consumeDeathCharge` / `castDeathCharge` | H | |
| `SimulationEngine.js:541` `computePlayerPoisonPulse` + `VENOM_VARP_THRESHOLD` | `timers.ts` `tickPoisonState` + `VENOM_THRESHOLD` | H | |
| `npcRetaliation.js` `scheduleNpcRetaliation` / `resolvePendingRetaliations` / `applyNpcRetaliation` | `retaliation.ts` `notifyNpcOfPlayerAttack` / `processNpcRetaliations` / `retaliate` | H | |
| `npcRetaliation.js` `isAlreadyFightingSource` / `delayNextActionForRetaliation` / `getStandardRetaliationTick` | `flinch.ts` `isInCombat` (`!isFlinchable`) / `applyFlinch` / `flinchWindowStartTick` | H | the literal 8 maps to `NPC_COMBAT_TIMEOUT_TICKS` |
| `npcState.js` `isNpcBindImmuneAtTick` | `NpcActor.ts:41` `isNpcFreezeImmune` (+ `FREEZE_IMMUNITY_TICKS`) | H | |
| `npcState.js` `isActorAlive` | `npcDeath.ts:61` `canReceiveNewAttack` | H | |
| `npcState.js` `setNpcDefenceDrain` | `NpcActor.ts:245` `setNpcDefenceDrain` | H | same name |
| `consumables.js` `consumableDefinitionByItemId` / `getConsumableDefinition` / `STAT_RESTORE_FORMULAS` / `ATTACK_DELAY_TICKS_BY_CONSUMABLE_TRACK` | `data/itemEffects.ts` | M | the tables were not diffed item by item |
| `consumables.js` `applyItemConsumption` / `isCooldownTrackReady` / `withCooldownTrackDelay` / `consumableTrackBlockers` / `isSurgeEffectBlocked` | `itemActions.ts` `consumeItem` / `canUseAction` / `applyCooldown` / `BLOCKED_BY_RIGHT` / `isItemActionRefused` | H | |
| `consumables.js` `applyConsumableEffect` / `applyConsumableEffects` / `syncHitpointsStat` | `itemActions.ts` `applyEffectOp` / `applyEffects` / `syncVitalsToStats` | H | |
| `consumables.js` `applyHeal` / `applyHealFormula` / `addPlayerHpCapped` / `applyDelayedHeal` / `applyBoostFormula` / `applyDrainFormula` / `applyRestorePrayerFormula` / `applyRestoreAllStats` / `applyRestoreRun` / `applyCurePoison` / `applyReducePoison` / `applySaturatedHeart` / `applyTimedEffect` / `applyNonLethalSelfDamage` / `scalePercentPlusFlat` / `scaleByOptionalMultiplier` / `venomVarpToPoisonVarp` | `handleHeal` / `handleHealFormula` / `handleOverheal` / `handleDelayedHeal` / `handleBoost` / `handleDrain` / `handleRestorePrayer` / `handleRestoreAllStats` / `handleRestoreRun` / `handleCurePoison` / `handleReducePoison` / `handleSaturatedHeart` / `handleApplyTimedEffect` / `handleSelfDamage` / `scaledStatAmount` / `scaleAmount` / `downgradeVenomToPoisonVarp` | H | see D6 |
| `consumables.js` `boostStatLevel` / `drainStatLevel` / `restoreStatLevel` / `withStatCurrentLevel` / `withStatDecayLocks` / `getHpRegenIntervalTicks` | `statLevels.ts` `boostStat` / `drainStat` / `restoreStat` / `withStatCurrent` / `lockStatDecay` / `hpRegenInterval` | H | |
| `prayers.js` `applyPrayerActionEntries` / `applyPrayerActions` / `groupPrayersBySlot` | `prayerInput.ts` `resolvePrayerActionSteps` :85 / `resolvePrayerActions` :225 | M | |
| `prayers.js` `PRAYER_RESTORE_FORMULAS` / `computePrayerRestoreAmount` / `hasEnhancedPrayerRestoration` | `data/prayerRestoration.ts` | H | same coefficients |
| `prayerTables.js` `Prayer` / `prayerDrainEffects` / `redemptionHealFraction` / `createPrayerState` | `types/simulation.ts` `PrayerType` / `PRAYER_DRAIN_EFFECTS` :499 / `REDEMPTION_HEAL_FRACTION` / `createDefaultPrayerState` | H | identical drain values |
| `prayerProjection.js` `projectPendingPrayerOps` / `buildPrayerProjectionInput` | `inputOps.ts` `projectPendingPrayerInput` :77 / `buildPendingPrayerProjection` :139 | M | |
| `playerState.js` `createSpecialAttackState` / `createCombatTimers` / `createPoisonState` / `maxRunEnergy` / `decayingStatNames` / `combatStatNames` / … | `types/playerState.ts` (`RESTORABLE_STATS`, `COMBAT_SKILLS`, `RUN_ENERGY_MAX`, `SPEC_REGEN_TICKS` and so on) | H | upstream names every literal (50, 25, 500, 100, 101, 30) |
| `equipmentStats.js` `equipmentStatOverridesByItemId` / `applyEquipmentStatOverrides` / `readEquipmentStats` / `getItemEquipmentStats` / `computeEquipmentStats` / `createEmptyEquipmentStats` / `getCarriedWeight` / `equipmentStatParamIds` | `types/equipmentStats.ts` `EQUIPMENT_STAT_OVERRIDES` / `applyEquipmentStatOverrides` / `getItemStats` / `loadItemStats` / `computeTotalEquipmentStats` / `createEmptyStats` / `computeTotalWeight` / `COMBAT_PARAMS` + `PARAM_*` | H | |
| `equipmentStats.js` `getGracefulBonusPercent` | `data/weightReducingClothing.ts` `gracefulRegenBonusPercent` | M | |
| `monsterStats.js` `getMonsterFormulaStats` / `applyMonsterStatOverride` | `data/monsterData.ts` `getMonsterFormulaStats` :63 / `applyMonsterStatOverrideToFormulaStats` :107 | M | |
| `ammunition.js` `getAmmoKind` / `isArrowOrBolt` / `weaponRequiresAmmo` / `isAmmoCompatibleWithWeapon` / `variantArrowsByItemId` | `ammoCompatibility.ts` `classifyAmmo` / `isQuiverStorableAmmo` / `weaponRequiresExternalAmmo` / `isAmmoCompatible`; `data/seekingArrows.ts` `SEEKING_ARROWS` | H | |
| `attackResources.js` `resolveAttackResources` / `NO_ATTACK_RESOURCES` / `isAmmoUsableWithWeapon` | `attackResources.ts` same / same / `isCompatible` | H | |
| `spells.js` `checkSpellRequirements` / `canCastSpell` / `hasMagicLevelForSpell` / `hasRuneAvailable` / `getAcceptedRuneIds` / `isRuneProvidedByStaff` / `RUNES_PROVIDED_BY_STAFF` / `SPELL_RUNE_REQUIREMENTS` / `SPELL_MAGIC_LEVEL_REQUIREMENTS` | `runeAvailability.ts` `checkSpellCast` / `canCastSpell` / `meetsSpellLevel` / `hasRune` / `acceptedRunes` / `hasUnlimitedSupply`; `data/spellRunes.ts` `UNLIMITED_RUNE_SOURCES` / `getSpellRuneRequirement` / `getSpellLevelRequirement` | M | |
| `weapons.js` `getPoweredStaffBaseMaxHit` :5 | `poweredStaffData.ts` :3 | H | ours adds corrupted staffs (#50) and Eldritch nightmare staff |
| `weapons.js` `getRangedDefenceType`, `getHitDelayWeaponKind`, `getWeaponFormulaStyle`, `computePlayerCombatParams` … | `weaponCombatData.ts` | L | |
| `CombatSystem.js` `applyDamage` :1009 | `CombatSystem.ts` `applyDamage` :1248 | H | identical order: Power of Death, incoming multiplier, prayer, cap, Elysian, NPC HP clamp |
| `CombatSystem.js` inline Elysian at :1020 | `elysian.ts` `applyElysianDamageMitigation` | H | one draw, 0.7 / 0.75 |
| `CombatSystem.js` `tryAttack` / `tryLaunchContinuationAttack` | `processAttack` / `processSupplementalHitRequest` | M | |
| `CombatSystem.js` `applyPrayerReduction` / `toNonNegativeInteger` / `recordNpcDeath` | `calculateDamage` / `normalizeNonNegativeInt` / `recordNpcLethalTransition` | H | |
| `thralls.js` (all) | — | H | ours only |

---

## 3. Behavioural divergences

Origin key: **OURS** (an OpenScim feature or fix), **RECON** (a reconstruction error), **UPSTREAM**
(upstream differs, and it cannot be told whether it changed after 11-20 or the beta branch differed).

**D1. Enchanted bolt effects (OURS, pre-public, root commit).**
- Ours: `profiles.js:23-41` and `:1074-1156`, `plan.js:232-270`, `roll.js:287-363`, `projection.js:406-453`.
  It models all 8 PvM gems: opal, pearl and dragonstone add bonus damage; sapphire restores
  prayer; emerald poisons; ruby and diamond as upstream; onyx adds 120% and leech. It also has
  Zaryte strengthening, the Zaryte Evoke (`guaranteed`) and the proc spot-anims.
- Upstream: `playerAttackProfileSelection.ts:634-655` has **ruby and diamond only**, with no graphic.
  `playerAttackResolution.ts:93-101` has one proc path.
- Ruby and diamond draw RNG in the same order as upstream (the proc draw, then accuracy only
  on no-proc; `roll.js:306-311`), and their damage is identical outside Zaryte.
- Determinism: only fights that carry the other gems or a Zaryte draw different numbers.
- Keep ours. It is a strict superset.

**D2. Keris partisan of the sun critical (OURS).**
- Ours: `profiles.js:1045-1057` (+33% max hit and a 1/51 triple vs kalphite or scabarite; +25%
  accuracy below 25% HP in ToA), `roll.js:293,320`, `projection.js:455-485`,
  `launch.js:384-386,435-441` (`sunKerisHeal`, chitin message).
- Upstream has no keris logic at all.
- The ROADMAP notes it is unreachable: no encounter has kalphite or scabarite targets.
  Upstream gives no producer for it either.
- Determinism: one extra draw per keris hit, against those targets only.

**D3. Dizana's quiver bonus source (UPSTREAM; date unknown).**
- Ours (`plan.js:634-644`) gives +10 attack and +1 ranged strength whenever the cape is a
  charged quiver and the ammo is an arrow or bolt, **from either slot**.
- Upstream (`playerAttackRuntime.ts:167-174`) also requires `resources.source === 'quiver'`,
  so ammo in the ammo slot gets no bonus.
- I recall the wiki describing the bonus for ammo in either the quiver or the ammo slot. That
  is unverified here, and it would make ours correct. Check `/w/Dizana's_quiver` before adopting.
- Determinism: it changes the ranged accuracy roll for players with the quiver and ammo in the
  ammo slot.
- Do not port blindly.

**D4. Tumeken's shadow multiplier in ToA (OURS).**
- Ours: `plan.js:650-658`, ×4 when `isTombsOfAmascut`.
- Upstream: `playerAttackRuntime.ts:176-181`, always ×3.
- Ours is the wiki rule. Keep.

**D5. Magic Dart on a Slayer's staff (e) (OURS).**
- Ours: `plan.js:522-528`, `floor(magic/6)+13` with weapon 21255.
- Upstream: `playerAttackRuntime.ts:217`, always `floor(magic/10)+10`.
- Keep.

**D6. Prayer restore from a special attack or consumable (OURS).**
- Ours, `specialAttacks.js:283-298`: `restore_prayer` supports `points`, `ofRolledDamage`,
  `minimumRestore` and `maximumPoints`, and **never lowers** points already above the cap
  (`Math.max(points, …)`).
- Ours, `consumables.js:758-771` (`applyRestorePrayerFormula`): also never lowers.
- Upstream: `postHitEffects.ts:102-107` and `itemActions.ts:242-252` clamp to `maxPoints`, which
  **lowers** above-cap points.
- These were added for Eldritch nightmare staff Invocate (`specialAttackDefinitions.js:368-388`,
  up to 120 points) and Sapphire Clear Mind.
- No numeric difference unless points are above the level.

**D7. Instant special "Tumeken's light" (OURS).**
- Ours: `specialAttacks.js:156-206`, Keris partisan of the sun 27291: ToA only, 50 prayer, a 75%
  spec, heals to 120% and restores stats. Upstream `instantSpecial.ts` handles `powerOfDeath` only.
- Also ours: `previewInstantSpecial` emits game messages, while upstream's
  `resolveInstantSpecialActivation` floors cost × multiplier. Both floor for Power of Death.
  Tumeken's light uses the unfloored cost.

**D8. Encounter hooks in the attack pipeline (OURS, post-public).**
- #19 `5246aff`, `planPlayerAttack.js:103-117`: `playerAlwaysAccurate(ctx, attack)`, and
  `playerMinimumHit` receives `attack`.
- #22 `0419d3e`: `CombatSystem.js:680-688` and `launch.js` `attackOnCooldown` /
  `playerAttackOnCooldown`; `playerDamageOnNpc` passthrough (`launch.js:403,520,548`);
  `formula.js` `isDemonbaneAttack`.
- #48 `9a5cd35`: `keepsReady` / `playerAttackKeepsReady`.
- #47 `6a7a503`: `CombatSystem.delayNextAttack`.
- #51 `bab0d90`: `isPlayerAttackProtected` makes `hit.protectedByNpcPrayer` a forced miss
  (`launch.js:602-618`, plus 3 passthroughs in CombatSystem).
- Upstream has none of these. Each is opt-in per encounter, so there is no determinism impact
  without the rule.

**D9. ToA accuracy scaling (OURS).**
- `combatFormulas.js:1,142,259`: `scaleToaAccuracyRoll` on NPC attack and defence rolls.
- It is a no-op when `toaRaidLevel` is undefined. Upstream has none.

**D10. Weapons and specials missing upstream (OURS).**
- Arkan blade 30955 (`profiles.js:215,535`), Eldritch nightmare staff 24425 (`profiles.js:502`,
  `weapons.js:38-39`), corrupted staff tiers 23852-23854 (#50 `41bfc6e`, `weapons.js`), thralls
  (`thralls.js`, root commit).

**D11. Equipment canonicalisation (UPSTREAM naming, possible data drift).**
- Ours uses `getBaseItemId` (data/itemVariants.js) everywhere.
- Upstream uses `getEquipmentCombatBaseId` (`data/equipmentCombatFamilies.ts`, with a doc
  `docs/architecture/equipment-combat-families.md`) and sometimes `getCanonicalEquipmentItemId`.
- The code paths are identical. Whether the two family tables agree is a **data-area** question
  I did not verify. Every set-membership test in this area (void, slayer helm, crystal, scythe,
  bolts) goes through it.

**No divergence** in: accuracy, max hit, prayer multipliers, prayer drain (`drainPrayerPoints` =
`tickPrayerDrain`), prayer protection reduction (including the `reduce` rounding), burn and
poison stacking, venom, NPC poison, retaliation and flinch, special-attack effects other than
restore_prayer, the claw and burning barrage branch models, the fang, Behead, Penance, the
chinchompa fuse, ricochet, blood fury, XP, Elysian, stat decay and Preserve, Lightbearer, spec
regen and Death Charge.

**ROADMAP question: the six unreachable kinds.** Upstream also has **no producer** for
`floorScale`, `floorScaleOnProc`, `addFloorScaledCopy`, `weighted` (DamageSpec),
`ifPriorInaccurate` (HitGate) or `rollUnlessAnyPriorAccurate` (AccuracySpec). They appear only in
`playerAttackTypes.ts`, the resolver and projection, and the upstream `__tests__`
(`playerAttackResolution.test.ts`, `playerAttackProjection.test.ts`,
`playerAttackPlanTransforms.test.ts`). So they are **upstream dead-but-tested scaffolding**,
not something our reconstruction lost. Port upstream's tests to cover them, or delete all six
in both places. The keris critical is ours (D2), and upstream does not help reach it.

---

## 4. Ours-only and upstream-only pieces

**Ours only:**
- the bolt effects beyond ruby and diamond, and the Zaryte Evoke (D1)
- the keris critical and sun keris heal (D2)
- Tumeken's light (D7)
- ToA scaling (D9), Shadow ×4 (D4), the Magic Dart (e) rule (D5)
- the restore_prayer extensions (D6)
- Arkan blade, Eldritch nightmare staff, corrupted staves (D10)
- `thralls.js`
- `isDemonbaneAttack`
- the encounter hooks `playerAlwaysAccurate`, `playerAttackOnCooldown`, `playerAttackKeepsReady`,
  `isPlayerAttackProtected`, `playerDamageOnNpc` and `delayNextAttack` (D8)
- the `prayerTables.js` `isPrayerUnlockedByMechanics` (mechanics config)

**Upstream only:**
- named constants modules: `flinch.ts`, `elysian.ts`, `onHitPassives.ts`, `xp.ts`, `ricochet.ts`,
  `soulreaper.ts`, `chinchompa.ts`, `spellAreaTargets.ts`, `playerFacing.ts`, `playerAttackIntent.ts`
- TypeScript types: `formulaTypes.ts`, `playerAttackTypes.ts`, `playerAttackProfiles.ts`
- `BYPASS_PROTECTION_PRAYER`
- `npcHealing.ts`, `npcRegeneration.ts`, `npcActionClock.ts`, `hitDelay.ts`, `distance.ts`
  (other areas)
- the test suite (about 60 files under `src/core/combat/**/__tests__`)
- extensive rule comments citing wiki revisions and captures
- `docs/architecture/combat.md`, `damage-model.md`, `npc-retaliation.md`
- `docs/encounters/yama-facts-spec.md` §5, which explains the `reduce` rounding

---

## 5. Readability wins (prioritised)

1. **Constants with provenance.**
   - `RICOCHET_*` (ricochet.ts:27-53) has 116-hop capture evidence.
   - `BLOOD_FURY_*` (onHitPassives.ts); `FREEZE_IMMUNITY_TICKS`; `BURN_PERIOD_TICKS` and
     `MAX_ACTIVE_BURN_STACKS` (burnStacks.ts:7,12); `POISON_PERIOD_TICKS`; `NPC_COMBAT_TIMEOUT_TICKS`.
   - `SMOKE_POISON_CHANCE`; `ELYSIAN_*`; `SPEC_REGEN_*`; `SATURATED_HEART_*`; `PRESERVE_QUALIFY_TICKS`.
   - Ours has bare `2`, `15`, `0.2`, `0.125`, `5`, `4`, `30`, `8`, `50`, `25`, `500`.
   - Effort: S. Risk: none.
2. **Comments that guard invariants.** Copy the comments only, with the MIT notice.
   - `damageCalculation.ts:51-62` (do not change the `reduce` rounding)
   - `playerAttackTypes.ts:26-33, 80-90, 111-119` (whenDamagePositive and minimumWhenSelected;
     why the branch total is rolled once)
   - `playerAttackPlanTransforms.ts:16-18`
   - `spellHitEffects.ts:44-58, 91-120` (per-target roll and launch-tick heal)
   - `postHitEffects.ts:26-53, 139-145` (freeze and bind immunity)
   - `burnStacks.ts:41-44` (check eligibility before rolling, or replay RNG shifts)
   - `playerAttackLaunch.ts:56-61`
   - `firstPartyPlayerAttack.ts:238-260`
   - `timers.ts:55-66` (the spec regen ordering, evidenced by capture)
3. **Renames where ours is vaguer or wrong.**
   - `isNpcBindImmuneAtTick` → `isNpcFreezeImmune`. Recorded as *inferred* in
     `tools/names/shared-bindings.json:27`; the semantics are the shared freeze immunity, not
     "bind".
   - `isActorAlive` → `canReceiveNewAttack`. Ours misleads: it is false for a death-pending NPC
     whose `alive` is still true.
   - `scheduleNpcRetaliation` → `notifyNpcOfPlayerAttack`; `delayNextActionForRetaliation` →
     `applyFlinch`; `isAlreadyFightingSource` → `isInCombat`.
   - `isAttackRejectedByEncounter` → `isForcedMiss`. Keep our #51 body.
   - `filterPostHitEffectsByChance` → `rollBranchedEffects`. It rolls RNG; it does not just
     filter.
   - `rollSpellSecondaryEffects` → `resolveSpellHitEffects`.
   - `applyXpGains` → `accumulateXpDeltas`; `awardAttackXp` → `emitPlayerAttackXp`.
   - `getPlayerAccuracyRolls` → `calculatePlayerNpcRollDetails`; `getFormulaMaxHit` →
     `calculateMaxHit`; `getSingleRollHitChance` → `hitChance`.
   - `computeFormulaStages` → `ordinaryModifierStages`; `getEnchantedBoltProc` →
     `enchantedBoltProc`; `buildPlayerAttackPlan` → `planPlayerAttackFromRuntime`.
   - `planPlayerAttack` (ours) → `planFirstPartyPlayerAttack`. **Name clash:** upstream's
     `planPlayerAttack` is our `plan.js` `buildAttackPlanFromProfile`. Rename both in one step.
   - `rollAttackPlan` → `resolvePlayerAttack`; `applyGuaranteedHitOverrides` →
     `transformPlayerAttackPlan`; `lowerDamageSpecMaximum` → `scaleMaximum`.
   - `applyPrayerReduction` → `calculatePrayerDamage`; `isCorrectProtectionPrayer` →
     `didPrayCorrectly`; `resolveRolledDamage` → `resolveDamage`.
   - `drainPrayerPoints` → `tickPrayerDrain`; `regenerateSpecialAttackEnergy` → `tickSpecialAttack`.
   - `applyConsumableEffects` → `applyEffects`, or keep ours: it is clearer in a JS file without types.
   - `tryAttack` → `processAttack`; `tryLaunchContinuationAttack` → `processSupplementalHitRequest`.
     Both *inferred* in `tools/names/engine-members.json:9,11`. Upstream contradicts the
     "continuation" framing: it is a supplemental (area) hit.
   - `weaponRequiresAmmo` → `weaponRequiresExternalAmmo`; `variantArrowsByItemId` →
     `SEEKING_ARROWS`. Both inferred; upstream says these are *seeking* arrows specifically.
   - `isArrowOrBolt` → `isQuiverStorableAmmo`.
   - `weapon31113SpecialProfile` → `EYE_OF_AYAK_PROFILE`; `zamorakSaradominGodswordSpecialProfile`
     → `SARADOMIN_GODSWORD_PROFILE`.
   - Effort: M, mechanical. Risk: low with the determinism harness.
4. **Module split of `launch.js` (1,199 lines).** Upstream's split is `PlayerAutoAttackSystem`,
   `playerAttackLaunch`, `ricochet`, `spellHitEffects`, `onHitPassives`, `xp`, `confliction`,
   `soulreaper`, `playerAttackIntent` and `playerFacing`. Move ours into the same files, keeping
   our hooks. Effort: M. Risk: low.
5. **Port upstream's tests** (`formulas.test.ts`, `damageSpec.test.ts`,
   `playerAttackResolution/Projection/PlanTransforms.test.ts`, `postHitEffects.test.ts`,
   `specialAttacks.test.ts`, `retaliation.test.ts`, `npcPoison.test.ts`, `xp.test.ts`,
   `ricochet.test.ts`). They assert game rules, which fills ROADMAP's "Engine tests that assert
   game rules", and they exercise the six unreachable kinds. They need translating from TS and
   vitest to our harness. Effort: M. Risk: none.

Inferred renames contradicted by upstream: `tryLaunchContinuationAttack` (it is a supplemental
hit), `isNpcBindImmuneAtTick` (it is freeze immunity), `variantArrowsByItemId` (these are seeking
arrows), `weaponRequiresAmmo` (it means *external* ammo).

Inferred renames upstream confirms in meaning: `tryAttack`, `applyPrayerReduction`,
`isCorrectProtectionPrayer`, `getPlayerDefenceRoll`, `getPlayerFormulaStats`.

---

## 6. Recommendation per component

| Component | Verdict | Effort | Risk | Notes |
|---|---|---|---|---|
| combatFormulas.js | **rename from upstream**, keep the ToA hook | S | low | the math is identical |
| damage.js | rename and add comments | S | none | |
| playerAttack/formula.js | rename (`ordinaryAttackModifiers`) | S | none | keep `isDemonbaneAttack` |
| playerAttack/profiles.js | **keep ours, rename from upstream** | M | low | a superset: bolts, keris, Zaryte, Arkan, ENS |
| playerAttack/plan.js | keep ours and rename; split into planning and runtime as upstream | M | low | **do not take** upstream's quiver `source==='quiver'` check without verifying the wiki (D3); keep the Shadow ×4 and Magic Dart (e) rules |
| playerAttack/roll.js | keep ours and rename | S | low | the proc branch is a superset |
| playerAttack/projection.js | keep ours and rename | S | low | |
| playerAttack/planPlayerAttack.js | keep ours and rename (`firstPartyPlayerAttack`) | S | low | keep #19 |
| playerAttack/launch.js | keep ours; split into upstream's modules and rename | M | low-med | keep #22, #48 and #51; check `performPlayerAutoAttack` line by line before splitting |
| specialAttacks.js | keep ours; split into burnStacks, npcPoison, timers, instantSpecial and postHitEffects | M | low | keep D6 and D7 |
| prayers.js / prayerTables.js / prayerProjection.js | rename | S | none | |
| consumables.js | keep ours and rename; optionally split into itemEffects, itemActions and statLevels | M | low | keep D6 |
| equipmentStats.js / monsterStats.js / ammunition.js / attackResources.js / spells.js / weapons.js | rename | S | none | weapons.js: keep #50 and ENS |
| npcRetaliation.js | rename (`retaliation.ts` + `flinch.ts` names) | S | none | |
| playerState.js | adopt upstream's named constants | S | none | |
| SimulationEngine.js timer helpers | move to `timers.ts` / `statLevels.ts`-shaped modules | M | low | identical logic |
| CombatSystem.js (formula parts) | rename and extract `elysian` | S | none | keep #22, #47, #48 and #51 |
| Six unreachable kinds | port upstream's tests, or delete them in both places | S | none | |

**Wholesale "replace with upstream" is recommended for nothing in this area.** Every component
carries OpenScim features that upstream lacks, and upstream's math is already ours. The value is
names, comments, constants, module boundaries and tests.

---

## 7. Our progress to preserve

Commits after the root that touch this area (`git log` on the area paths):

| Commit | What | Where | Upstream equivalent? |
|---|---|---|---|
| `5246aff` #19 Leviathan | `playerAlwaysAccurate(ctx, attack)` rule; `playerMinimumHit(max, ctx, attack)` gets the attack | planPlayerAttack.js:103-117 | none: upstream has only `alwaysAccuratePlayerHit` and a 2-arg `playerMinimumHit` (firstPartyPlayerAttack.ts:229-235) |
| `0419d3e` #22 Doom | `playerAttackOnCooldown` / `attackOnCooldown` (keepCooldown) in performPlayerAutoAttack and CombatSystem.tryAttack; `playerDamageOnNpc` carries weapon and spell to impact | launch.js:403,407,520,548,833-838; CombatSystem.js:680-688 | none |
| `9a5cd35` #48 | `playerAttackKeepsReady` / `keepsReady` | launch.js:408,842-844; CombatSystem.js:689-690 | none |
| `6a7a503` #47 Maggot King | `CombatSystem.delayNextAttack` | CombatSystem.js:186-193 | none |
| `41bfc6e` #50 | Corrupted staff (basic/attuned/perfected) max hits | weapons.js:28,31,34 (approx.) | none: upstream poweredStaffData.ts lists the crystal staves only |
| `bab0d90` #51 | `isPlayerAttackProtected` → `hit.protectedByNpcPrayer` = forced miss, carried through pending hits | launch.js:422,509,549,602-618; CombatSystem.js:372,519,738 | none |

The following are squashed into the root `7ea8730`. Content evidence marks them as OpenScim work
(§1 caveat), and they must also be preserved:

- the enchanted bolts (8 gems) and the Zaryte crossbow, including the LMS id 27186, the Evoke and
  the boosts
- Keris partisan of the sun: the critical, ToA accuracy, the heal on kill, Tumeken's light and
  the chitin message
- Arkan blade spec, Eldritch nightmare staff Invocate (including the restore_prayer extensions and
  the never-lower rule)
- Magic Dart on a Slayer's staff (e)
- Tumeken's shadow ×4 in ToA
- ToA accuracy scaling (`scaleToaAccuracyRoll`)
- thralls (`thralls.js`)
- `isDemonbaneAttack`
- the extra special-attack defs in `data/specialAttackDefinitions.js`

Upstream has an equivalent for none of these except ruby and diamond bolts, which give the same
numbers outside Zaryte.

**If any component were replaced wholesale, every row above in that file would be lost.** None
is trivially re-applicable to a different module shape, especially launch.js and profiles.js.
So: **port upstream names, comments, constants and tests into our files**, then optionally
re-split modules along upstream's boundaries, carrying our hooks along. Run the determinism
harness after each rename batch. Renames do not change RNG order; module moves must not reorder
draws.
