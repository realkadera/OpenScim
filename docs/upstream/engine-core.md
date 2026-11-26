# Area: ENGINE CORE (engine-core)

- U = `...\scratchpad\upstream\scimgg` (snapshot `3639203`, "open-source release", 2026-11-24, plus four commits that only touch dependencies and docs)
- O = `C:\_Development\openscim` (read-only; HEAD `12e8785`, branch feat/encounter-book)

Supporting evidence in the same folder:

- `engine-core-units.txt`: an automated match of every function and method. 522 of our units were compared against 1,429 upstream units, by bags of property names, string literals and numeric literals. Each pair lists the tokens only ours has (`OURS+`) and only upstream has (`UP+`). Of the 440 matched pairs, 259 have identical bags (1.00).
- `engine-core-recorder.txt`: the same match for the Grid.js replay recorder (`HAe`) against `ReplayRecorder.ts`.
- `engine-core-mse-bag.txt`: a token diff of the Grid.js tick-loop hook `mse` against `useSimulationWiring.ts`.
- `engine-core-ourcommits.diff`: `git log -p 7ea8730..HEAD -- client/engine client/assets/simulationEngineFactory.js`.

Scripts: `...\scratchpad\scripts\compare2.mjs` and `bagdiff.mjs`. Small-bag pairs at 1.00 can be false positives (for example `decisions.js createRandomDecisions` ⇒ `elysian.ts`). The table below corrects those by hand.

---

## 1. Summary verdict

**This is the same code. Upstream is the TypeScript source our bundle was built from, a few days newer at most.** The engine core of our reconstruction is a faithful transcription.

- **Tick order matches line by line.** Our `runTick` (O `client/engine/SimulationEngine.js:1693-1864`) and upstream `advanceTickUnchecked` (U `src/core/SimulationEngine.ts:1279-1478`) run the same statements in the same order:
  1. tick advance, `TICK_START`, landing message
  2. `runPendingEncounterCommands`
  3. `onTickStart`, then the `playerInputLocked` drop
  4. input band, then Redemption
  5. `resolveHazards`
  6. NPC band, then the player queue band, then the timer band, then `cancelBlockedPlayerAttack`
  7. pickup, then step, then auto-attack
  8. soulreaper decay, `processPostTick`, run energy
  9. defeats, then protection expiry, then prune, then flush

  `runNpcBand`/`runNpcTurn` (O :1961-2103) equal `processNpcBand`/`runNpcTurn` (U :1604-1730), including every `isCurrentActorInstance` re-check. The only additions in ours are our own hooks, listed in §3.
- **RNG is bit-identical.** `random.js createSeededRandom` is mulberry32 (`0x6d2b79f5` = 1831565813) and `hashInteger` is `fmix32` (`0x45d9f3b` = 73244475): O `random.js:1-15` = U `core/rng.ts:25-55`. `decisions.js` equals `decisionRandom.ts` `generatorDecisionRandom`/`chooseWeighted`/`uniformOptions`/`contextDecisions`. `SimulationEngine.rollCombat` uses the same indirection, `resolveCombatSeed` = `normalizeCombatSeed`.
- **The replay bootstrap is compatible.** Both use version **14** (O `bootstrap.js:63` = U `engineRunConfig.ts:56 ENGINE_RUN_BOOTSTRAP_VERSION`). The Zod keys are the same and so are the take-over limits (28 inventory slots, 256 attack styles; `replay.js:6` = `replayTakeover.ts:3`). The action union is the same: our `injectAction` (O :2691) handles every case of upstream `EngineAction` (U :346-375) and adds `castThrall`. The recorder export (`F$`, Grid.js:17289) equals `exportData` (U `ReplayRecorder.ts:1029`), plus our optional `clip` key.
- **Little has drifted.** Upstream has **one real behavioural change** that we lack: the Red-X hold, D1 below. Everything else that differs is an OpenScim addition or a renamed or relocated helper.
- **Structure.** Our `SimulationEngine.js` (4,718 lines) still holds what upstream spreads over several modules:
  - `WorldState.ts` `toSimulationState`
  - `timers.ts`, `statLevels.ts`, `inputOps.ts`, `itemActions.ts`, `coordinates.ts` and `constants.ts`
  - `combat/player/soulreaper.ts`
  - `types/inventory.ts`

  Our `CombatSystem.js` inlines `burnStacks.ts`, `npcPoison.ts`, `elysian.ts` and `equipmentHitEffects.ts`.
- **Git caveat for §7.** Only nine commits after the root `7ea8730 "OpenScim"` touch this area. Everything OpenScim did before going public is squashed into the root. That includes thralls, Zebak hooks, the Doom/Leviathan/ToA rules, enchanted-bolt graphics, equip level requirements and the plugin `getPlayerAttackRange`. I attribute those by content: they are absent upstream, use our comment style, and are documented as ours in `docs/ARCHITECTURE.md`.

---

## 2. Mapping table

Confidence: H = verified line by line; M = verified structure and key tokens; L = role only.

### Files

| Ours | Upstream | Conf | Notes |
|---|---|---|---|
| `client/engine/SimulationEngine.js` | `src/core/SimulationEngine.ts` | H | Same class. Upstream moved the free functions out (rows below). |
| `client/engine/WorldState.js` | `src/core/WorldState.ts` (class, `countPendingOps`, `toSimulationState`) | H | Our `buildEngineState` lives in SimulationEngine.js:602. |
| `client/engine/TickEventBuffer.js` | `src/core/events/TickEvents.ts` | H | |
| `client/engine/CombatSystem.js` | `src/core/combat/CombatSystem.ts` (+ `burnStacks.ts`, `npcPoison.ts`, `elysian.ts`, `player/equipmentHitEffects.ts`) | H | |
| `client/engine/createSimulationEngine.js` `buildSimulationEngine` | `src/encounters/simulationEngineFactory.ts:52` `instantiate` | H | |
| `client/engine/replay.js` (`ReplayTakeoverWorkTracker`, `buildEngineFromBootstrap`, `rebuildEngineAtReplayFrame`) | `src/core/replayTakeover.ts` (`ReplayTakeoverWork`) + `simulationEngineFactory.ts:120 rebuild`, :160 | H | |
| `client/engine/bootstrap.js` | `src/core/engineRunConfig.ts` | H | |
| `client/engine/replayLimits.js` | `src/core/replaySafety.ts` (+ `replay/format/limits.ts`) | H | Ours has more limits (§4). |
| `client/engine/random.js` | `src/core/rng.ts` | H | |
| `client/engine/decisions.js` | `src/core/decisionRandom.ts` | H | Upstream also has `chooseDistinct`/`contextAttackDecisions`; ours inlines them in Inferno. |
| `client/engine/occupancy.js` `OccupancyMap` | `src/core/npcOccupancy.ts` `TileOccupancy` | H | |
| `client/engine/playerMovement.js` | `src/core/pathfinder.ts` + `src/core/movement.ts` | M | Same constants (`CARDINAL_BLOCK_FLAGS`, `nextPow2`, 16384, 99). |
| `client/engine/npcState.js` | `src/core/npcDeath.ts`, `src/core/actors/NpcActor.ts`, `src/core/npcCombatMovement.ts`, `combat/npcRegeneration.ts` | H | |
| `client/engine/arena.js` | `src/core/constants.ts` (arena state) + `src/core/tileKeySet.ts` | H | |
| `client/engine/collision.js` | `src/rs/collision/CollisionFlag.ts` + `WalkabilityAnalyzer.ts:253 createCollisionMap` | H | |
| `client/engine/attackRange.js` | `src/core/combat/distance.ts`, `chebyshevDistance.ts`, `npcOccupancy.ts:106` | H | |
| `client/engine/projectiles.js` | `src/core/combat/hitDelay.ts` | H | |
| `client/engine/npcRetaliation.js` | `src/core/combat/retaliation.ts` + `flinch.ts` | H | |
| `client/engine/damage.js` | `src/core/combat/damageCalculation.ts` | H | |
| `client/engine/prayerProjection.js` | `src/core/inputOps.ts` | H | |
| `client/engine/supplies.js` | `src/types/encounterLoadout.ts` + `src/types/inventory.ts` | H | |
| `client/engine/logEventTypes.js` `LogEventType` | `src/types/simulation.ts` `EventType` | M | |
| `client/engine/mechanicsConfig.js` | `src/types/simulation.ts` `mergeMechanicsConfig` | M | |
| `client/engine/encounterKinds.js` | `src/encounters/catalog.ts` + `slugs.ts` | M | Ours is read off the registry (#34). |
| `client/engine/thralls.js` | — | — | Ours only. |
| `client/assets/simulationEngineFactory.js` (re-export shim) | — | — | **Name clash:** upstream's `simulationEngineFactory.ts` is our `createSimulationEngine.js` + `replay.js` rebuild. |
| Grid.js `mse` (:19848-22733) | `src/hooks/useSimulationWiring.ts:448` | M | Two `advanceTick` sites each: Grid.js:21654/22111 ⇒ U :1701/:1977. `AIe` = `anyPrayerLit` (U :310). The prayer-bit owner and `answeredAtTick` logic is the same (Grid.js:20516-20591 ⇒ U :285-305). |
| Grid.js `HAe` (:16278-17415) | `src/core/ReplayRecorder.ts` `ReplayRecorder` | H | Method map in `engine-core-recorder.txt`: `d$`=`forkAt`, `l$`=`finalizeUnadvancedStart`, `F$`=`exportData`, `h$`=`ancillaryData`, `_$`=`trackTimeAt`, `x$`=`storeCursorSample`, `P$`=`recordModifierSample`, `T$`=`recordMenuState`, … |
| Grid.js `$Ae` (:16007) | `src/core/ReplayCaptureBudget.ts` | H | `r$`=`fork`, `o$`=`isStopped` |
| Grid.js `zAe`/`BAe`/`WAe`/`jAe`/`UAe`/`GAe`/`QAe`/`Gie`/`Xie`/`Vie` | `ReplayRecorder.ts` `shareFrameMetadata`/`shareViewportMetadata`/`shareViewportTrack`/`reuseMetadata`/`snapshotStateForReplay`/`viewportStatesWithin`/`modifierSampleIndexAt`/`modifierMaskAt`/`mouseButtonMaskAt`; `replayCaptureCoverage.ts isReplayTrackAvailable` | H | |

### SimulationEngine members (ours ⇒ upstream)

All are H unless marked.

- **Context and helpers**
  - `getEncounterRules` ⇒ same
  - `buildRulesContext` ⇒ `buildEngineContext`
  - `buildTickContext` ⇒ `buildEncounterCtx`
  - `buildCombatContext` ⇒ `buildCombatBridge` (our "combatContext" is upstream's `CombatBridge`)
  - `buildNpcDefinitionContext` ⇒ same
  - `teleportPlayer` ⇒ same
  - `isLastTickInputLocked` ⇒ `wasLastTickInputLocked`
- **Spawning and run start**
  - `spawnNpc` ⇒ `spawnEncounterNpc`
  - `despawnNpc` ⇒ `despawnEncounterNpc`
  - `applyMonsterStatOverrides` ⇒ `applyEncounterMonsterStatOverride`
  - `applyRuleOutcome` ⇒ `processHookResult`
  - `applyArenaConfig` ⇒ `applyEncounterArenaConfig`
  - `getDefaultStartPosition` ⇒ `getEncounterDefaultPlayerStart`
  - `buildRunStartContext` ⇒ `runStartContext`
  - `spawnNpcAtRunStart` ⇒ `admitOpeningNpc`
  - `initializeRun` ⇒ `initializeWorld`
  - `setStats` ⇒ `setPlayerStats`
  - `recordPositionHistory` ⇒ `recordActorHistory`
  - `removeDeadNpcs` ⇒ `pruneDeadActors`
- **Mechanics and intro**
  - `getEnabledIntroConfig` ⇒ `setupIntro`
  - `syncOpeningIntro` ⇒ `reopenIntro`
  - `captureRunStartMechanics` ⇒ `keepRunStartSetup`
  - `rebuildMechanicsConfig` ⇒ `mergeMechanicsConfig`
  - `getDefaultMechanicsConfig` ⇒ `getEncounterDefaultMechanicsConfig`
  - `snapshotMechanicsConfig` ⇒ `getEncounterMechanics`
- **Inventory and equipment previews**
  - `previewInventoryAfterEquip` ⇒ `previewInventoryAfterEquipFromInventory`
  - `computeEquipResult` ⇒ `previewEquipFromInventoryState`
  - `computeUnequipResult` ⇒ `previewUnequipState`
  - `computeInventoryAfterEquipAmmo` ⇒ `previewEquipAmmoFromInventory`
  - `computeInventoryAfterUnequipAmmo` ⇒ `previewUnequipAmmo`
- **Tick and start position**
  - `canAdvanceTick` ⇒ `canAdvance`
  - `runTick` ⇒ `advanceTickUnchecked`
  - `clearReplayTakeoverWork` ⇒ `releaseReplayTakeoverLimits`
  - `advanceNextEventIdPast` ⇒ `continueEventIdsAfter`
  - `applyPlayerStep` ⇒ `applyPlayerMovement`
  - `assertUnstartedRunPastIntro` ⇒ `assertUnstartedRun`
  - `getStartFacing` ⇒ `openingFacing`
- **NPC band**
  - `runNpcBand` ⇒ `processNpcBand`
  - `findNextNpcByProcessingOrder` ⇒ `nextNpcInProcessingOrder`
  - `clearStaleCrawlMovement` ⇒ `reconcileNpcCrawlMovement`
  - `applyNpcMovementRequest` ⇒ `applyNpcMovement`
  - `launchNpcAttack` ⇒ `commitNpcAttack`
  - `releaseNpcDeathAttack` ⇒ `commitNpcDeathRelease`
  - `startPendingNpcDeath` ⇒ `startNpcDeath`
- **Player bands and damage**
  - `resolvePendingHitsOnPlayer` ⇒ `processPlayerQueueBand`
  - `runPlayerUpkeep` ⇒ `processPlayerTimerBand`
  - `handleDamageApplied` ⇒ `onCombatDamageApplied`
  - `flushPendingNpcDefeats` ⇒ `adjudicateNpcDefeats`
  - `emitOnKillTargetGraphic` ⇒ `emitSpecOnKillGraphic`
  - `applyOnKillEffect` ⇒ `applySpecOnKillEffect` (M)
- **Facing**
  - `computeFacingFromDelta` ⇒ `calculateAngleFromDelta`
  - `faceNpcTowardTarget` ⇒ `faceStationaryNpcTarget`
  - `computeFacingToward` ⇒ `calculateAngleTowardActor`
- **Spells and actions**
  - `canCastArceuusSpell` ⇒ `canCastSelfSpell`
  - `emitTeleportCastEvent` ⇒ `triggerHomeTeleport` (M)
  - `injectAction` ⇒ `applyAction`
  - `queueInputOp` ⇒ `queueInput`
  - `queueUseItem` ⇒ `queueItemAction`
  - `countPendingSpecialAttackToggles` ⇒ `getPendingSpecialAttackToggles`
  - `projectSpecialAttackActive` ⇒ `projectSpecialAttackState`
  - `acceptsInput` ⇒ `acceptsEncounterInput`
  - `setProtectionPrayer` ⇒ `forceSetProtectionPrayer`
  - `setAttackStyleIndex` ⇒ `setSelectedAttackStyleIndex`
  - `syncSelectedAttackStyle` ⇒ `syncAttackStyleForCurrentWeapon`
  - `countFreeSlotsAfterRemoving` ⇒ `countEmptySlotsInInventory`
- **Input band and prayers**
  - `processPendingInputOps` ⇒ `processInputBand`
  - `deactivateProtectionPrayer` ⇒ `removeProtectionPrayer`
  - `deactivateOffensivePrayer` ⇒ `removeOffensivePrayer`
  - `executePrayerOp` ⇒ `applyPrayerOp`
- **Equipment and item ops**
  - `computeEquipmentOpResult` ⇒ `previewEquipmentOp`
  - `executeEquipmentOp` ⇒ `applyEquipmentOp`
  - `findInventoryIndexForItem` ⇒ `resolveQueuedEquipInventoryIndex`
  - `getEquipSound` ⇒ `getEquipSoundKind`
  - `isMetalBodyArmour` ⇒ `isMetalBodyItem`
  - `buildConsumableState` ⇒ `getItemActionState`
  - `applyItemEffectsWithRestrictions` ⇒ `resolveItemEffects`
  - `executeUseItemOp` ⇒ `applyItemOp`
  - `executeDropItemOp` ⇒ `applyDropOp`
  - `processPendingItemPickup` ⇒ `processItemPickup`
- **Effects, poison and equipment stats**
  - `tickActiveEffects` ⇒ `processActiveEffects`
  - `tickPoison` ⇒ `processPoison`
  - `getEquipmentSlotForItem` ⇒ `getItemEquipSlot`
  - `isAmmoSlotItem` ⇒ `isAmmoItem`
- **Run config and prayer state**
  - `projectPendingPrayers` ⇒ `resolvePendingPrayerInput`
  - `getEngineRunConfig` ⇒ `getRunConfig`
  - `setCombatSeed` ⇒ `seedCombatRandom`
  - `applyBootstrap` ⇒ `applyRunBootstrap`
  - `syncActivePrayerList` ⇒ `rebuildActivePrayers`
  - `clearQuickPrayersActiveIfNoPrayers` ⇒ `enforceQuickPrayerInvariant`
  - `resetHpRegenTimer` ⇒ `restartHpRegen`
  - `depletePrayer` ⇒ `finalizePrayerDepletion`
  - `tryTriggerRedemption` ⇒ `tryRedemption`
  - `applyPrepot` ⇒ `applyPrepotEffects`
- **Restarts and commands**
  - `canExecuteEncounterCommand` ⇒ `acceptsEncounterCommand`
  - `getMechanicsConfigWithoutRunOverride` ⇒ `restartMechanics`
  - `buildRestartContext` ⇒ `restartContext`
  - `processPendingEncounterCommands` ⇒ `runPendingEncounterCommands`
- **Damage to the player**
  - `applyPlayerPrayerReduction` ⇒ `calculateDamage`
  - `applyDirectDamageToPlayer` ⇒ `applyDamage`
  - `notifyPlayerDamageTaken` ⇒ `notifyEncounterPlayerDamageTaken`
  - `isPlayerPrayingAgainst` ⇒ `didPrayCorrectly`
  - `failRun` ⇒ `applyFailCondition`

Ours only: `getPlayerAttackRange` (plugins), `castThrall`, `deactivateAllPrayers` (#51), and in the tick context `getPlayerWeaponState`, `attackObject`, `delayNextAttack` (#47) and `deactivateAllPrayers` (#51).

### Free functions in SimulationEngine.js ⇒ upstream homes (H)

- **Facing, seeds, coordinates**
  - `getVisibleCombatTargetId` ⇒ `WorldState.ts resolveFacingTargetId`
  - `resolveCombatSeed` ⇒ `normalizeCombatSeed`
  - `decaySoulreaperStacks` ⇒ `combat/player/soulreaper.ts tickSoulreaperDecay`
  - `isTileInsideMapSquare` + `isStepDestinationInsideArena` ⇒ `coordinates.ts isValidCoordinate`/`isValidArenaCoordinate`
- **Timers (`timers.ts`)**
  - `drainPrayerPoints` ⇒ `tickPrayerDrain`
  - `applyLightbearerEquipped` ⇒ `syncLightbearer`
  - `getSpecialAttackRegenIntervalTicks` ⇒ `getSpecialRegenTicks`
  - `regenerateSpecialAttackEnergy` ⇒ `tickSpecialAttack`
  - `isPreserveActive` ⇒ `isPreserveQualified`
  - `isRapidRestoreDue` ⇒ same
  - `consumeDeathChargeProc` ⇒ `consumeDeathCharge`
  - `activateDeathChargeTimers` ⇒ `castDeathCharge`
  - `computePlayerPoisonPulse` ⇒ `tickPoisonState`
- **Stat levels (`statLevels.ts`)**
  - `tickStatDecayLocks` ⇒ `expireStatDecayLocks`
  - `applyStatDecayAndRecovery` ⇒ `tickNaturalStatChange`
- **Elsewhere**
  - `computeTheoreticalDps` ⇒ `combat/player/firstPartyPlayerAttack.ts projectFirstPartyPlayerAttack`
  - `addItemToInventory` ⇒ `types/inventory.ts addItemToInventory`
  - `getAliveTargetId` ⇒ `WorldState.ts resolveCombatTargetId`
  - `resolveNpcAttackTimer` ⇒ `resolveAttackTimer`
  - `buildEngineState` ⇒ `WorldState.ts:270 toSimulationState`

### CombatSystem members (ours ⇒ upstream)

All are H, and all of ours are "inferred" names in `tools/names/engine-members.json`.

- **Attacks**
  - `grantNextAttackSpeedup` ⇒ `speedUpNextAttack`
  - `tryAttack` ⇒ `processAttack`
  - `tryLaunchAttack` ⇒ `processAttackRequest`
  - `tryLaunchContinuationAttack` ⇒ `processSupplementalHitRequest`
  - `tryLaunchDeathAnimationAttack` ⇒ `processDeathReleaseRequest`
  - `queueNpcHit` ⇒ `queueHitRequest`
  - `launchAttack` ⇒ `commitAttack`
  - `applyFreezeOnLaunch` ⇒ `applyFreezeAtLaunch`
- **Pending hits**
  - `resolvePendingHits` ⇒ `processPendingHits`
  - `resolvePendingHitsOnTarget` ⇒ `processPendingHitsForTarget`
  - `hasPendingHitOnTarget` ⇒ `hasAcceptedHitQueuedFor`
  - `getPendingHitRuntime` ⇒ `requirePendingHitRuntime`
  - `isPendingHitValid` ⇒ `isStillDeliverable`
  - `canTargetBeHit` ⇒ `canReceiveAcceptedHit`
  - `findNextPendingHitTarget` ⇒ `nextTargetToDrain`
  - `findNextPendingHit` ⇒ `nextQueuedHitForTarget`
  - `removePendingHit` ⇒ `removeQueuedHit`
  - `isPendingHitsEnabled` ⇒ `isPendingHitEnabled`
- **Pulses and timing**
  - `applyBurnPulse` ⇒ `processBurnStacks`
  - `applyPoisonPulse` ⇒ `processNpcPoison`
  - `getPrayerCheckTick` ⇒ `prayerCheckTick`
  - `tryStartAttackCooldown` ⇒ `canAttack`
- **Resolution and damage**
  - `applyHit` ⇒ `applyResolvedHit`
  - `applyBlockedHit` ⇒ `applyZeroImpact`
  - `getDefaultAttackStyle` ⇒ `defaultStyleForAttacker`
  - `getDefaultAttackKind` ⇒ `defaultAttackKindForStyle`
  - `toNonNegativeInteger` ⇒ `normalizeNonNegativeInt`
  - `isCorrectProtectionPrayer` ⇒ `didPrayCorrectly`
- **Actor tests**
  - `isNpc` ⇒ `isNpcActor`
  - `isPlayer` ⇒ `isPlayerActor`
- **Pulse helpers**
  - `takeBurnPulse` ⇒ `burnStacks.ts advanceBurnStacks`
  - `takePoisonPulse` ⇒ `npcPoison.ts advanceNpcPoison`

### npcState.js / occupancy.js / attackRange.js / projectiles.js / arena.js / npcRetaliation.js (H)

- **npcState.js**
  - `isNpcBoundAtTick` ⇒ `NpcActor.ts isNpcBound`
  - `isNpcBindImmuneAtTick` ⇒ `isNpcFreezeImmune` (5 = `FREEZE_IMMUNITY_TICKS`)
  - `isNpcTargetableAtTick` ⇒ `isNpcTargetable`
  - `canNpcShowHealthBarAtTick` ⇒ `canShowNpcHealthBar`
  - `isNpcAttackableAtTick` ⇒ `canInitiateAttackOnNpc`
  - `clearNpcBurn` ⇒ `clearBurnStacks`
  - `getNpcDeathPolicy` ⇒ `npcDeath.ts npcDeathPolicy`
  - `isActorInWorld` ⇒ `isCurrentActorInstance`
  - `canNpcActAtTick` ⇒ `canNpcActThisTurn`
  - `isActorAlive` ⇒ `canReceiveNewAttack`
  - `isActorAliveOrDeathPending` ⇒ `canReceiveKillTickSpell`
  - `isNpcAlive` ⇒ `isNpcLiving`
  - `getActorLifeGeneration` ⇒ `lifeGenerationOf`
  - `recordNpcDeath` ⇒ `recordNpcLethalTransition`
  - `expediteQueuedNpcDeath` ⇒ `promoteHitQueueDeath`
  - `isNpcDeathAnimationDueAtTick` ⇒ `isNpcDeathAnimationDue`
  - `markNpcDeathAnimationNotified` ⇒ `claimNpcDeathAnimation`
  - `isNpcDeathAnimationTick` ⇒ `isNpcDeathReleaseDue`
  - `isNpcDeathDueAtTick` ⇒ `isNpcDeathDue`
  - `markNpcDeathStarted` ⇒ `startNpcDeath`
  - `recordNpcStepTick` ⇒ `recordNpcStep`
  - `updateNpcDeathAnimationTick` ⇒ `refreshQueuedDeathAnimationTick` (3 = `DEATH_ANIMATION_AFTER_STEP_TICKS`)
  - `startScriptedNpcDeath` ⇒ `markNpcDead`
  - `getNpcDespawnTick` ⇒ `pruneGraceStartTick`
  - `isNpcHeldInPlace` ⇒ `npcCombatMovement.ts isNpcMovementSuppressed` (**behaviour differs: D1**)
  - `scheduleNpcHitpointRegen`/`applyNpcHitpointRegen` ⇒ `npcRegeneration.ts advanceNpcHitpointRegen` (100 = `NPC_HITPOINT_REGEN_INTERVAL_TICKS`)
- **occupancy.js**
  - `OccupancyMap.syncActors` ⇒ `TileOccupancy.reconcile`
  - `doesActorBlockNpcMovement` ⇒ `setsFlags`
  - `createOccupancyStepCheck` ⇒ `createNpcStepOccupancyPredicate`
- **attackRange.js**
  - `getDistanceToFootprint` ⇒ `chebyshevDistanceToRect`
  - `getProjectileBlockFlag` ⇒ `getProjectileEntryMask`
  - `areBoundsInAttackRange` ⇒ `hasAttackReachBetweenBounds`
  - `isInAttackRangeWithCollision` ⇒ `hasAttackReach`
  - `isInAttackRangeWithoutCollision` ⇒ `isInAttackRangeRaw`
  - `isTileInAttackRange` ⇒ `isInAttackRange`
  - `isWallBetweenAdjacentTiles` ⇒ `edgeHasWallBetween`
  - `areFootprintsOverlapping` ⇒ `npcFootprintsOverlap`
  - `isTileInsideFootprint` ⇒ `distance.ts isUnderNpc`
- **projectiles.js**
  - `getHitDelayTicks` ⇒ `calculateHitDelay`
  - `projectileTimings` ⇒ `PROJ_ANIM_TIMINGS`
  - `getProjectileFlightCycles` ⇒ `calculateProjectileEndTime`
  - `getHitDelayTicksFromCycles` ⇒ `hitDelayFromEndTime`
  - `getTicksFromCycles` ⇒ `npcHitDelayFromEndTime`
- **arena.js**
  - `isInsideArenaBounds` ⇒ `isInArena`
  - `isArenaTileWalkable` ⇒ `isWalkableTile`
  - `getArenaCollisionMap` ⇒ `getCollisionMap`
  - `registerArenaConfig`/`getRegisteredArenaConfig` ⇒ `setResolvedArenaConfig`/`getResolvedArenaConfig`
  - `arenaDefaultWalkable` ⇒ `_allowUnboundedFallback`
  - the packed tile set class ⇒ `tileKeySet.ts`
- **npcRetaliation.js**
  - `getStandardRetaliationTick` ⇒ `flinch.ts flinchWindowStartTick`
  - `delayNextActionForRetaliation` ⇒ `applyFlinch`
  - `isAlreadyFightingSource` ⇒ `isInCombat`
  - `scheduleNpcRetaliation` ⇒ `retaliation.ts notifyNpcOfPlayerAttack`
  - `resolvePendingRetaliations` ⇒ `processNpcRetaliations`
  - `applyNpcRetaliation` ⇒ `retaliate`

### Constants that are inlined in ours and named upstream (all equal)

| Our inline value | Upstream name |
|---|---|
| 50 | `ACTOR_HISTORY_WINDOW_TICKS` |
| 10 | `DEAD_ACTOR_PRUNE_GRACE_TICKS` |
| 64 | `GRID_SIZE` |
| 0 | `SIMULATION_START_TICK` |
| 1,000,000 | `VENOM_THRESHOLD` |
| 999,997 | `VENOM_OFFSET` |
| 30 | `POISON_TICK_INTERVAL` |
| 13 | `AMMO_WEAR_POSITION` |
| 8970 | `SELF_IMBUE_CAST_ANIM_ID` |
| 1852 | `MARK_OF_DARKNESS_SPOTANIM_ID` |
| 12817 / 0.7 / 0.75 | `elysian.ts` |
| 28 | `INVENTORY_SIZE` |
| 256 | `MAX_REPLAY_BOOTSTRAP_ATTACK_STYLES` |

---

## 3. Behavioural divergences

| # | What differs | Ours | Upstream | Cause | Determinism impact |
|---|---|---|---|---|---|
| **D1** | **Red-X hold on NPC movement.** Ours holds an NPC only when *the player is attacking that NPC* (`player.attackTarget === npc.id && attackInteractionActive`). Upstream holds it when *the NPC targets the player* and the player has *any* active red-X interaction: an uncancelled attack on any NPC, **or a pending Take** (`pendingItemPickup`). | `npcState.js:200-209`, used at `SimulationEngine.js:2128` | `core/npcCombatMovement.ts:14-28`; doc `docs/architecture/npc-combat-movement.md:22-26`; tests `__tests__/npcCombatMovement.test.ts:442-534` | **An upstream change since the beta (M).** Our version is a 1:1 transcription with no edit in git, and upstream's cites a wiki oldid and has dedicated tests. | **Yes.** It changes NPC paths whenever the player stands under a multi-tile NPC (Take under an NPC; attacking NPC A while under NPC B, which targets him). Path changes move later RNG draws, so digests in `tools/determinism` may shift. |
| D2 | `isPlayerAttackProtected`, `playerAttackOnCooldown`/`keepCooldown`, `playerAttackKeepsReady`, `delayNextAttack`, `deactivateAllPrayers`, `hit.sourceId` to `onPlayerDamageTaken`, `npc.menuColor` in the snapshot | CombatSystem.js:189, :691-713; SimulationEngine.js:915, :948, :2967-3044, :3084; launch.js | absent (`CombatSystem.ts:932 canAttack` has no cooldown bypass) | **Ours**: bab0d90 #51, 0419d3e #22, 9a5cd35 #48, 6a7a503 #47, 6173e47 #49 | Only when an encounter sets the rule. |
| D3 | Ours-only encounter hooks and rules: `approachRange`, `moveDisplacedPlayer` (runTick :1778, :1791), `playerDamageOnNpc` (CombatSystem.js:782), `playerAlwaysAccurate`, `isTombsOfAmascut`, `getPlayerWeaponState`, `attackObject` (:920-945) | — | — | **Ours, pre-squash** (Zebak, Doom, Leviathan, ToA; documented in `docs/ARCHITECTURE.md:304-325`) | Only for those encounters. |
| D4 | **Thralls.** `runThrallTurn` runs after `performPlayerAutoAttack`, before soulreaper decay (SimulationEngine.js:1834); there is a thrall snapshot and `castThrall` | `thralls.js`, SimulationEngine.js:734-737, :2667 | none | **Ours, pre-squash** | Draws from `rollCombat` only while a thrall lives. |
| D5 | Enchanted-bolt impact graphic: `npc_graphic_applied` from `procSpotAnimId` | CombatSystem.js:826-833; launch.js | none (U emits `npc_graphic_applied` only for Blood Fury and on-kill) | **Ours, pre-squash** (the combat-rules report lists enchanted bolts as ours) | Event only, no RNG. |
| D6 | Equip level gates: Keris partisan of the sun (27291) needs 80 Attack and the Accursed sceptre (27665) needs 70 Magic | SimulationEngine.js:3452-3453 | U `previewEquipmentOp:2979` has none | **Ours, pre-squash** | Equip refused, so the run differs if the loadout breaks the rule. |
| D7 | `previewInstantSpecial(..., this.encounter, prayerState)` also projects prayer changes from instant specials | SimulationEngine.js:2877-2898 | U `resolveInstantSpecialActivation` (:2433) | **Ours**: our instant-special extensions (Zaryte/Eldritch etc., combat-rules area) | Projection only. |
| D8 | The bootstrap's `baseStats.agility` defaults to `{99,99}`; upstream has `passthrough` with no default | bootstrap.js:6-14 | engineRunConfig.ts:80 | Not datable (L). Probably ours, to keep old v14 replays without agility parseable. | Replays without agility take 99. |
| D9 | Replay limits: ours also has `projectileGeometryLimit`, `snapshotGroundItemLimit`, `snapshotFootprintLimit`, `totalSnapshotFootprintLimit`, `isSafeReplayPosition`, `isSafeReplaySize`. The recorder has `clip`, `graphicsThrough`/`getRetainedGraphics`, `maxFrameEvents`/`maxFrameActions` and `getShareEligibility`. | replayLimits.js:9-34; Grid.js `HAe` | absent | **Beta features upstream stripped**: replay sharing and share validation (the ui-app report shows upstream removed `/api/replays*`) (M) | None on the engine. Our recordings carry the extra optional `clip`. |
| D10 | The `mse` hook against `useSimulationWiring`: upstream calls the playback API `pausePlayback`/`resumePlayback`/`subscribeResume`/`setSuspended`/`setExpectedMs`/`finishReplay`/`recordTick(Window)`. Ours has `heartbeat`/`tickDone`/`replayDone`/`ownsCountdown` and the Plugins-panel hold. | Grid.js:19848-22733 | U hooks/useSimulationWiring.ts | Mixed (L): our commits 8629243 (#68 hold while Plugins open), aa96071 (#67), 715be9b, plus probably newer upstream playback plumbing. Needs a UI-area look. | No engine RNG impact. |

No reconstruction errors were found in this area: every non-ours difference is D1 or D9. Also verified equal:

- the Elysian proc (12817/0.7/0.75)
- the freeze immunity of 5
- prune grace 10 and history window 50
- the crawl reconcile rule (`startTick+2`)
- `addedOutsideNpcTurns`
- `infiniteStamina` suppressing `StaminaDepleted`
- run toggles and Ctrl in `prepareStartPosition`
- `finalizeStartPosition` eventLog patching

---

## 4. Ours-only and upstream-only pieces

**Ours only, in this area**

- `thralls.js`, with `castThrall` and the thrall snapshot
- `getPlayerAttackRange`, for the Attack Ranges plugin
- the tick-context members `getPlayerWeaponState`, `attackObject`, `delayNextAttack` and `deactivateAllPrayers`
- the rules `approachRange`, `moveDisplacedPlayer`, `playerDamageOnNpc`, `playerAlwaysAccurate`, `isTombsOfAmascut`, `isPlayerAttackProtected`, `playerAttackOnCooldown` and `playerAttackKeepsReady`
- the snapshot fields `overheadPrayers`, `menuColor`, `chargeBar`, `shieldBar` and `thrall`
- `procSpotAnimId` graphics
- the equip level gates
- the registry-driven `encounterKinds.js`, which includes the DT2 kinds
- the replay share-validation limits
- `tools/determinism` and its harness
- `client/assets/simulationEngineFactory.js`, a re-export shim

**Upstream only**

- TypeScript types for every contract: `core/encounters/types.ts` with 728 lines of documented `Encounter`, `EncounterEngineRules` and `EncounterContext`, and `core/events/types.ts` with the `GameEvent` union and `isCoreEvent`.
- `npcCombatMovement.ts` with the Red-X rule (D1) and its tests.
- About 36 unit tests in `src/core/__tests__` (SimulationEngine, ReplayRecorder, npcDeath, npcOccupancy, rng, …) and `src/test/capture/constrainedRandom.ts`, a constrained `DecisionRandom` for capture replays.
- `decisionRandom.ts chooseDistinct`/`contextAttackDecisions`. They are inlined in our Inferno, so the behaviour is the same.
- Architecture docs that match this code one to one:
  - `docs/architecture/npc-hit-queue-and-death.md`
  - `npc-combat-movement.md`
  - `movement-and-facing.md` (band order, countdown start positioning)
  - `replay-recording.md`
  - `replay-timeline-discontinuity.md`
  - `events.md`
  - `encounters.md#determinism-and-run-setup`

---

## 5. Readability wins (prioritised)

1. **Name the bands as upstream does, in `runTick`.** Upstream has "BAND 2 — INPUT", "BAND 3 — NPC", "BAND 4 — PLAYER pre/post-move" and "BAND 5 — POST", with the reasons: why pickup comes before the step, why soulreaper decay comes after the attack, and why run energy closes the band, as in rsmod. Take those comments and doc links over our numbered list. Do the same for the JSDoc above `processNpcBand`/`runNpcTurn`, which explains the live roster walk, re-registration and the W69 t877 evidence.
2. **Take the CombatSystem vocabulary.** Our names are all "inferred" in `tools/names/engine-members.json`, and some upstream names contradict them in *meaning*, not just wording:
   - `applyBlockedHit` ⇒ `applyZeroImpact`. Nothing is blocked: it is an accepted hit on an already-dead target. Our own comment says so.
   - `isPendingHitValid` ⇒ `isStillDeliverable`
   - `launchAttack` ⇒ `commitAttack`. Our "launch" collides with the `prayerCheckAt: "launch"` timing.
   - `tryLaunchContinuationAttack` ⇒ `processSupplementalHitRequest`
   - `hasPendingHitOnTarget` ⇒ `hasAcceptedHitQueuedFor`
   - `resolvePendingHitsOnPlayer` ⇒ `processPlayerQueueBand`
   - `runPlayerUpkeep` ⇒ `processPlayerTimerBand`
   - `flushPendingNpcDefeats` ⇒ `adjudicateNpcDefeats`
   - `faceNpcTowardTarget` ⇒ `faceStationaryNpcTarget`. It only turns a stationary NPC.
   - Exception: `tryStartAttackCooldown` ⇒ `canAttack`. Upstream's name hides the side effect (it starts the cooldown), and ours has gained the cooldown-bypass branches. Rename it, but keep a comment.
3. **Use upstream's death and liveness vocabulary in npcState.js.** Ours misleads here:
   - `isActorAlive` ⇒ `canReceiveNewAttack`
   - `isActorAliveOrDeathPending` ⇒ `canReceiveKillTickSpell`, the "Phantom barrage" rule
   - `isActorInWorld` ⇒ `isCurrentActorInstance`. It tests instance identity, not presence, which is the whole point of the same-id successor checks.
   - `isNpcDeathAnimationTick` ⇒ `isNpcDeathReleaseDue`
   - `getNpcDespawnTick` ⇒ `pruneGraceStartTick`
   - `expediteQueuedNpcDeath` ⇒ `promoteHitQueueDeath`

   Also bring in the upstream doc comments, with their OBSERVED capture citations.
4. **Retaliation is a "flinch".** Rename `delayNextActionForRetaliation` ⇒ `applyFlinch` and `getStandardRetaliationTick` ⇒ `flinchWindowStartTick`, to match the docs `npc-retaliation.md`.
5. **Split out the free functions as upstream does.** They are pure and the move is mechanical:
   - `buildEngineState` ⇒ `WorldState.js toSimulationState`
   - timers ⇒ `engine/timers.js`
   - stat decay ⇒ `engine/statLevels.js`
   - `isNpcHeldInPlace` ⇒ `engine/npcCombatMovement.js`
6. **Fix the file-name clash.** Rename our `client/assets/simulationEngineFactory.js` shim, or move `createSimulationEngine.js` + `replay.js` rebuild into a `simulationEngineFactory.js` with `instantiate`/`rebuild`, as upstream has it. Today the same name means two different things.
7. **Use the "Bridge" and "EngineContext" terms.** `combatContext` ⇒ `bridge` (`CombatBridge`), `buildRulesContext` ⇒ `buildEngineContext`, `buildTickContext` ⇒ `buildEncounterCtx`. These match the upstream docs that encounter authors will read.
8. **Name the inline constants** (table in §2), and call RNG primitives `mulberry32`/`fmix32` with upstream's provenance comment.
9. **Rename the Grid.js recorder** `HAe` ⇒ `ReplayRecorder` and `$Ae` ⇒ `ReplayCaptureBudget`, with all members from `engine-core-recorder.txt`. Upstream's file can serve as the template for extracting it to `client/replay/ReplayRecorder.js`.
10. **Public API names** (`injectAction` ⇒ `applyAction`, `queueUseItem` ⇒ `queueItemAction`, `canAdvanceTick` ⇒ `canAdvance`, …). These are cross-chunk: Grid.js and application.js call them, and so do encounter modules (`setProtectionPrayer` and friends via contexts). Rename them in one sweep, after the chunks are split.

About 130 of the 138 "inferred" member names in `tools/names/engine-members.json` have an upstream counterpart (list in §2). Record them with evidence `upstream:<file>:<line>` instead of "inferred".

---

## 6. Recommendation per component

Default: port names, comments and structure from upstream *into ours*. Do not replace files wholesale: nearly every engine file carries pre-squash OpenScim hooks.

| Component | Recommendation | Effort | Risk | Notes |
|---|---|---|---|---|
| `random.js`, `decisions.js`, `TickEventBuffer.js`, `WorldState.js`, `projectiles.js`, `collision.js`, `occupancy.js`, `attackRange.js` | **Replace with upstream (transpiled), or rename 1:1.** They are identical apart from names. | S | Very low | Lost: none (no commits). Keep the MIT notice and THIRD_PARTY attribution for mulberry32. |
| `npcState.js` | Rename from upstream and split along upstream lines (`npcDeath`, `NpcActor` helpers, `npcCombatMovement`) | M | Low | **Adopt the D1 Red-X rule as a separate, deliberate change** and re-baseline the determinism digests in the same PR. |
| `SimulationEngine.js` | **Rename and port from upstream into ours.** Take names, band comments, JSDoc and the free-function split. Keep our hooks. | L | Medium (cross-chunk callers) | Wholesale replacement would lose #49, #51, #47, #22 (snapshot `menuColor`), thralls, Zebak/Doom/Leviathan/ToA hooks, `getPlayerAttackRange`, equip gates and instant-special prayer projection. Upstream has no equivalent for any of them. |
| `CombatSystem.js` | Rename and port; extract `burnStacks`/`npcPoison`/`elysian`/`equipmentHitEffects` as upstream does | M | Low | Wholesale replacement would lose #51 `protectedByNpcPrayer`, #47 `delayNextAttack`, #48 `keepsReady`, #22 `attackOnCooldown`, `playerDamageOnNpc` and `procSpotAnimId`. None of these exist upstream. |
| `bootstrap.js`, `replay.js`, `replayLimits.js`, `createSimulationEngine.js` | Rename from upstream (`engineRunConfig`, `replayTakeover`, `replaySafety`, `simulationEngineFactory`); keep our extra limits | S | Low | Bootstrap v14 already matches, so do not bump it. |
| `arena.js`, `encounterKinds.js`, `supplies.js`, `mechanicsConfig.js`, `logEventTypes.js`, `prayerProjection.js`, `npcRetaliation.js`, `damage.js` | Rename from upstream | S | Low | `encounterKinds.js` must keep reading the registry (#34, #2, #19). |
| `thralls.js` | Keep ours | — | — | |
| Grid.js `mse` | Rename from `useSimulationWiring.ts`. Leave the extraction to the UI area. | L | Medium | Keep #68 (hold while Plugins open), #67 and the encounter-book changes. |
| Grid.js `HAe`/`$Ae` recorder | Rename from `ReplayRecorder.ts`/`ReplayCaptureBudget.ts`, then extract | M | Low | Keep `clip`/retained graphics/share eligibility unless sharing is dropped. |

---

## 7. Our progress to preserve

`git log 7ea8730..HEAD` on this area has nine commits. The full diff is in `engine-core-ourcommits.diff`. Upstream has **none** of them.

| Commit | What it adds in the engine core | Where | Upstream equivalent |
|---|---|---|---|
| 8c0af2f Sandbox (#2) | `encounterKinds.js` entries for sandbox kinds | encounterKinds.js | none |
| 3bd61a5 (#34) | the kinds table read off `client/encounters/registry.js` instead of a literal list | encounterKinds.js:1-59 | Upstream keeps a static `catalog.ts`. |
| 5246aff Leviathan (#19) | kinds; `planPlayerAttack` changes (`playerAlwaysAccurate` path) | encounterKinds.js, playerAttack/planPlayerAttack.js:100 | none |
| 0419d3e Doom (#22) | `playerAttackOnCooldown` → `attackOnCooldown`/`keepCooldown`; snapshot `menuColor` | CombatSystem.js:680-695, launch.js:833-840, SimulationEngine.js:684 | none (`canAttack` has no bypass) |
| 9a5cd35 (#48) | `playerAttackKeepsReady` → `keepsReady` | CombatSystem.js:710-711, launch.js:842-847 | none |
| 6a7a503 Maggot King (#47) | `CombatSystem.delayNextAttack`, tick-context `delayNextAttack` | CombatSystem.js:186-195, SimulationEngine.js:915 | none |
| 41bfc6e (#50) | corrupted staff base max hits 23852/3/4 | weapons.js:25-37 | none (combat-rules area) |
| bab0d90 (#51) | `isPlayerAttackProtected` (`protectedByNpcPrayer` threaded through launch → pending hit → resolve; DPS shows 0); `deactivateAllPrayers` | CombatSystem.js:369, :516, :735; SimulationEngine.js:948, :2999-3041, :3084; launch.js | none |
| 6173e47 (#49) | `sourceId` passed to `onPlayerDamageTaken` | SimulationEngine.js:2500 | none |

Pre-squash OpenScim work inside `7ea8730` that must survive any port. It is attributed by content (absent upstream; in our docs):

- **Thralls**: `thralls.js`; `runThrallTurn` in `runTick`; the `castThrall` action; the thrall snapshot.
- **Zebak hooks**: `approachRange`, `moveDisplacedPlayer`, and `getPlayerWeaponState`/`attackObject` in the tick context.
- **Other encounters' rules**: `playerDamageOnNpc` (Doom), `playerAlwaysAccurate` (Leviathan), `isTombsOfAmascut` (ToA scaling).
- **Snapshot and graphics**: snapshot `overheadPrayers`/`chargeBar`/`shieldBar`; the `procSpotAnimId` impact graphic.
- **Equipment**: the Keris partisan of the sun and Accursed sceptre equip gates; instant-special prayer projection in `projectSpecialAttackActive`.
- **Plugins**: `getPlayerAttackRange`, used by the Attack Ranges plugin.
- **Bootstrap**: the agility default in the bootstrap schema (D8, probably ours).
- **Determinism harness**: `tools/determinism/` and `test/test-determinism.mjs`. Any rename or port must keep every digest byte-identical. Run `node tools/determinism/harness.mjs` after each step. D1 is the only change in this area that is *meant* to move digests, so land it on its own.

UI-side commits that touch the tick loop or replay (Grid.js, outside `client/engine` but in scope for `mse`/recorder):

- 8629243 (#68), hold the fight while the Plugins panel is open
- aa96071 (#67), less work each tick
- 578baa1 (#79)
- 715be9b and 3b0484d, the encounter book and picker

These belong to OpenScim and have no upstream counterpart.
