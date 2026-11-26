# Yama (phase 3) and Lobby: ours vs upstream

O = C:\_Development\openscim\client\encounters
U = upstream scimgg\src

## 1. Verdict

These are the same lineage, and upstream is **newer** than our bundle. Every seed salt, hash, constant, contract number, wave formula, fireball table and control key matches. The structure matches method for method too: our reconstruction is a faithful 1:1 of a slightly older upstream.

Since the beta, upstream has:
- made two behavioural changes (D1, D2),
- refactored the void-flare pending queue to carry per-flare fuse length,
- removed the dead `yamaAttackPolicy` layer,
- moved the boss and flare NPC definitions into `U/src/npcs/yama/`,
- added a large body of evidence comments (capture citations) that we lack.

The lobby is identical in logic. Our differences there are all deliberate project changes.

## 2. Mapping table (our -> upstream). Confidence is high unless marked.

Files:
| Ours | Upstream | Notes |
|---|---|---|
| O/yama/YamaEncounter.js | U/encounters/yamaP3/YamaEncounter.ts + state.ts | `createYamaEncounterState` (ours :51) moves into state.ts:104 |
| O/yama/boss.js | U/npcs/yama/yama.ts | Ours still has the beta's policy object |
| O/yama/voidFlares.js | U/npcs/yama/voidFlare.ts (definition, actor) + U/encounters/yamaP3/voidFlareCoordinator.ts | |
| O/yama/beatClock.js | U/npcs/yama/timing.ts:60-92 | |
| O/yama/constants.js | U/npcs/yama/timing.ts:3-5,94-101 + U/encounters/yamaP3/constants.ts:17-56 | |
| O/yama/contracts.js | U/encounters/yamaP3/contractConfig.ts + contracts.ts + U/npcs/yama/wretchedStrength.ts | |
| O/yama/controls.js | U/encounters/yamaP3/controls.ts | Keys, labels and groups diffed: identical |
| O/yama/fireballs.js | U/encounters/yamaP3/fireballRuntime.ts + fireballHazards.ts | Logic identical line for line |
| O/yama/fireballBursts.js | U/encounters/yamaP3/constants.ts:84-164 + fireball.ts:253-375 | |
| O/yama/fireballGeometry.js | U/encounters/yamaP3/fireball.ts | 146 tile literals in both explosion tables; spot-checked identical (medium-high) |
| O/yama/shadowWaves.js + `isPlayerOnYamaWave` (YamaEncounter.js:281) | U/encounters/yamaP3/waves.ts (`getWaveTiles`, `isWaveTile`) | Identical math |
| O/yama/sceneConstants.js | U/encounters/yamaP3/constants.ts:56-68 + commands.ts:22-30 | |
| O/yama/cacheArena.js (`arenaConfigFromCache`) | U/core/constants `getDefaultArenaConfig()` | Our shim |
| O/yama/voidFlareSpotAnim.js | voidFlareCoordinator.ts:17 | |
| O/yama/encounter.js | U/encounters/modules.ts:116-152 + catalog.ts:60 | Ours adds `slug`/`order` (3d419de) |
| O/lobby/LobbyEncounter.js | U/encounters/lobby/LobbyEncounter.ts | |
| O/lobby/lobbyNpcs.js | U/encounters/lobby/metadata.ts:25 `LOBBY_BOSS_NPCS` | |
| rendering.js:50007 `FF`, :50016 `EF` (still minified) | metadata.ts:50 `LOBBY_PORTALS`, :59 `LOBBY_NPC_ENCOUNTERS` | |
| O/lobby/encounter.js | modules.ts:153-169 | |
| rendering.js:55405 (glyph loc ids 56335/56338/56336) | U/encounters/yamaP3/YamaSceneObjectController.ts:16-51 | Medium; outside this scope |

Symbols (ours -> upstream). **I** marks an *inferred* rename in tools/names that upstream contradicts.
- YamaEncounter.js
  - `createYamaEncounterState` -> `createYamaSimulationState` (state.ts:104)
  - `deriveFireballSeed` -> `randomFireballSeed` (state.ts:99)
  - getSeeds body -> `toYamaSeedPayload` (state.ts:163)
  - `isValidSeed` (fireballs.js:340) -> `isValidUint32` (state.ts:90)
  - `yamaActorId` -> `YAMA_ACTOR_ID`
  - `yamaPursuitMovement` (I) -> `YAMA_PURSUIT` (YamaEncounter.ts:67)
  - `fallbackYamaArenaBounds` -> `YAMA_WAVE_FALLBACK_BOUNDS`
  - `getNearestPosition` (I) -> `getNearestWavePosition`
  - `resolveEncounterConfig` -> same name (contractConfig.ts:273)
  - `createYamaActor` -> same name (npcs/yama/yama.ts:150)
  - `recordFireballAsLatestAttack` -> `markYamaFireballAttack` (yama.ts:203)
  - `setYamaOpeningStyle(actor, style, pattern)` -> `setYamaOpeningStyle(actor, style)` (yama.ts:196)
  - `updateAttackMechanics` -> `setAttackMechanics`
  - `buildNpcDefinitionContext` -> `toNpcDefinitionContext`
  - `isPlayerOnYamaWave` -> `isWaveTile` (waves.ts:134)
- boss.js
  - `yamaNpcDefinition` -> `yamaDefinition`
  - `clearYamaAttackState` (I) -> `resetYamaAttackState`
  - `buildYamaAttack` -> `resolveYamaAttack`
  - `rollYamaAccuracy` -> `rollAccuracy`
  - `yamaMeleePoisonSeverity` -> `YAMA_MELEE_POISON_VARP`. Ours calls it a "severity"; upstream calls it a varp. Same value, 100.
  - `createYamaAttackPolicyState`, `yamaAttackPolicy`, `getStyleForBeat`, `getAlternatingStyle`: **gone upstream** (dead in ours too; see D4)
- beatClock / constants
  - `getNextYamaBeatTick` -> `nextYamaBeatTick`
  - `getYamaAttackKind` -> `getAttackKindForStyle`
  - `mixSeed` -> `voidFlareHash` (timing.ts:99)
  - `yamaNpcTypeId` / `voidFlareNpcTypeId` / `yamaSize` -> `YAMA_NPC_ID` / `VOID_FLARE_NPC_ID` / `YAMA_SIZE`
  - `voidFlareSpawnTiles` -> `VOID_FLARE_SPAWN_POSITIONS`
  - `yamaDefeatOverheadTexts` -> `YAMA_VICTORY_QUOTES`
  - `yamaPlayerStartMin/Max` -> `PLAYER_LANDING_MIN/MAX` (+ `randomLandingPosition`)
  - `yamaBasePosition` -> `YAMA_START_POS`
  - `isYamaSealedRow` (I) -> `isSouthOfArenaEntrance` / `ARENA_ENTRANCE_Y = 19`
  - `detonatedDeathCause` -> `VOID_FLARE_DETONATED_DEATH_CAUSE`
  - `yamaSpawnFireballCommand` / `yamaSpawnVoidFlareCommand` -> `YAMA_SPAWN_FIREBALL_COMMAND` / `YAMA_SPAWN_VOID_FLARE_COMMAND`
  - literal 7 -> `YAMA_VICTORY_COMPLETION_DELAY_TICKS`
  - 12152 / 0 -> `PLAYER_INTRO_ANIM_SEQ_ID` / `PLAYER_INTRO_FACING`
- contracts.js
  - `scaleBossHp` (I) -> `phase3StartHp`
  - `defaultYamaBossHp` / `contractYamaBossHp` / `bloodiedBlowsBossHp` / `glyphicAttenuationBossHp` -> `YAMA_P3_START_HP` / `YAMA_CONTRACT_P3_START_HP` / `BLOODIED_BLOWS_P3_START_HP` / `GLYPHIC_ATTENUATION_P3_START_HP`
  - literals 2500/3000/2875 -> `*_FULL_FIGHT_HP`
  - `contractEncounterDefaults` (I) -> `SIGIL_ENCOUNTER_BASE`
  - `mergeEncounterConfig` -> `defineContract`
  - `noContract` -> `BASE_YAMA_CONFIG`
  - `divineSeveranceContract` etc. -> `DIVINE_SEVERANCE_CONFIG`, `FORFEIT_BREATH_CONFIG`, `SENSORY_CLOUDING_CONFIG`, `BLOODIED_BLOWS_CONFIG`, `GLYPHIC_ATTENUATION_CONFIG`
  - `contractLevelOverrides` -> `CONTRACT_COMBAT_LEVELS`
  - `yamaContractVariants` -> `YAMA_CONTRACTS`
  - `getMissingHpPercent` (I) -> `missingHealthPercent` / `wretchedDamageBonusPercent`
  - `getWretchedStrengthMinimumHit` -> `wretchedMinimumHit`
  - `defaultRangedMagicPrayerReduction` / `defaultMeleePrayerReduction` / `defaultWaveDamage` / `defaultFireballDamage` -> `BASE_PRAYER_PENETRATION` / `MELEE_PRAYER_PENETRATION` / `BASE_WAVE_DAMAGE` / `BASE_FIREBALL_DAMAGE`
  - `staminaDepletedFailure` -> `FORFEIT_BREATH_FAIL`
  - 4 / 100 -> `FORFEIT_BREATH_DRAIN_INTERVAL` / `FORFEIT_BREATH_DRAIN_AMOUNT`
  - 40 / 0.0155 -> `GLYPHIC_MIN_DRAIN_RESISTANCE` / `GLYPHIC_DAMAGE_PER_PRAYER_BONUS`
  - inline 0.12 / 0.17 / [28,35] -> `SIGIL_PRAYER_PENETRATION` / `INCREASED_PRAYER_PENETRATION` / `SIGIL_WAVE_DAMAGE`
- fireballs.js
  - `FireballRuntime` -> `YamaFireballRuntime`
  - `clearFireballs` (I) -> `clearForDefeat`
  - `getBurstShapeFromMechanics` (I) -> `resolveShape`
  - `createBurstShapeLookup` -> `shapeResolver`
  - `getActiveFireballs` -> `activePhases`. This is a readability rename (yama-readability-members.json) away from the bundle's own surviving name `activePhases`, which is upstream's real name. **Revert it.**
  - `getActiveManualFireballs` -> `activeManualPhases` (same story)
  - `registerScheduledBurst` -> `registerBurst`
  - `recordStartPositions` -> `capturePositions`
  - `emitPendingSpawnEvents` -> `emitDueSpawnEvents`
  - `removeExpiredManualFireballs` (I) -> `expireManual`
  - `buildInactiveVisuals` (I) -> `inactiveVisuals`
  - literal 2 / 6 -> `MANUAL_FIREBALL_LEAD_TICKS` / `FIREBALL_LATCH_RETAINED_BURSTS`
  - option `didPlanMelee` -> `didMeleeThisTick`
- fireballBursts.js / fireballGeometry.js
  - `fireballBurstTickOffsets` (I) -> `FIREBALL_SET_OFFSETS`
  - `fireballLifetimeTicks` -> `FIREBALL_SET_DURATION`
  - `fireballAnglesByDuoSide` (I) -> `BURST_SEQUENCES`
  - `isDuoSide` -> `isYamaDuoSide`
  - `isFireballBurstVertical` -> `getFireballBurstStartsVertical`
  - `getScheduledFireballs` -> `getFireballPhasesForTick` (fireball.ts:278). The readability rename again moved away from upstream.
  - `getFireballBurstStartTicks` (I) -> `getFireballBurstCycleTicks`
  - literal 3 -> `YAMA_FIREBALL_DELAY`
  - `getCycleTicks` -> `getCycleLength`
  - `getFireballPhase` -> `getFireballFallProgress`
  - `getFireballImpactLineOffset` -> `getFireballLineOffsets`
  - `getFireballImpactLine` -> `getThreeFireballPositions`
  - `getFireballOuter/InnerExplosionTiles` -> `getExplosionOuter/InnerTiles`
  - `getFireballExplosionTiles` -> `getExplosionTiles`
  - `isFireballPerfectDodgeTile` -> `isFireballPerfectDodgePosition`
  - local names: `indexInBurst` -> `setIndex`; `beatSlot` -> `burstIndex`; `burstIndex` -> `globalBurstIndex`; `cycleIndex` -> `cycleNumber`
  - `hashInteger` (I, engine/random.js) -> `fmix32` (U/core/rng)
- shadowWaves.js
  - `getYamaWaveCyclePosition` (I) -> `wavePhase`
  - `isYamaWaveActiveInCycle` -> `isWaveActiveInCycle`
  - `isInsideYamaWaveDiamond` (I) -> `isInWaveBand` (+ `WAVE_DIFF_MIN/MAX`, `WAVE_SUM_MIN/MAX`)
  - `yamaWaveRandomOffsets` -> `WAVE_OFFSET_VARIANTS`
  - `hashYamaWaveOffset` -> `waveOffsetHash`
  - `getYamaWaveRandomOffset` (I) -> `getWaveSetOffset`
  - `getYamaWaveTiles` -> `getWaveTiles`
  - `defaultYamaWaveDeltas` / `defaultYamaFirstCycleWaveDeltas` -> `DEFAULT_WAVE_DELTAS` / `DEFAULT_FIRST_CYCLE_DELTAS`
  - -40 / 20 / 2 / 70 / 7 -> `L_BASE` / `R_BASE` / `DEFAULT_WAVE_SPEED` / `DEFAULT_WAVE_PERIOD` / `DEFAULT_WAVE_START_DELAY`
- voidFlares.js
  - `voidFlareNpcDefinition` -> `voidFlareDefinition`
  - `getExplosionDamageRange` -> `voidFlareExplosionBand`
  - `getExplosionHeal` -> `voidFlareExplosionHeal`
  - `VoidFlareCoordinator` -> `YamaVoidFlareCoordinator`
  - `spawnPendingFlares` -> `processPendingSpawns`
  - `resolvePendingImpacts` -> `drainPendingImpacts`
  - `spawnManualFlare` -> `spawnDebug`
  - `clearFlares` (I) -> `clearForDefeat`
  - `spawnFlareAt` -> `spawnFlare`
  - `pickSpawnTile` (I) -> `pickSpawnPosition`
  - `getActiveFlares` -> `getActiveActors`
  - `isOverlappingFlare` (I) -> `overlapsExisting`
  - 3 / 2 / 1 -> `VOID_FLARE_UNTARGETABLE_TICKS` / `VOID_FLARE_FUSE_BAR_LEAD_TICKS` / `VOID_FLARE_IMPACT_DELAY_TICKS`
  - 25 -> `VOID_FLARE_CHARGE_TICKS`
  - 20 -> `DIVINE_CONTINUOUS_FLARE_INTERVAL`
  - state key `pendingSpawnCount` -> `pendingSpawns: VoidFlareSpawn[]` (see D2)
- Shared helpers seen here (for the shared/engine mappers)
  - `defineNpc` -> `createNpcDefinition`
  - `NpcDefinitionRegistry` -> `NpcDefinitionCollection`
  - `healNpc` -> `applyNpcHealing`
  - `startScriptedNpcDeath` -> `markNpcDead`
  - `canNpcActAtTick` -> `canNpcActThisTurn`
  - `getBossPursuitMoves` (I) -> `pursuePlayer` (core/npcPursuit), with `NpcPursuitProfile`
  - `getNpcAttackAccuracy` -> `calculateAccuracy`
  - `getPrayerMultipliers` -> `lookupPrayerMultipliersFromState`
  - `getDistanceToFootprint` -> `chebyshevDistanceToRect`
  - `getPlayerFormulaStats` / `getDrainedNpcFormulaStats` -> `playerFormulaActor` / `npcFormulaActor` (medium)
  - `activeOutcome` -> `ACTIVE_ENCOUNTER_OUTCOME`
  - `removePendingHitsFromSource` -> `removePendingHitsBySource` (world method)
- Lobby
  - `lobbyCenterX/Y` (I) -> `ARENA_CENTER_X/Y`
  - `lobbyRadius` (I) -> `ARENA_RADIUS`
  - `lobbyGridSize` -> `LOBBY_GRID_SIZE`
  - `lobbyArenaCache` (I) -> `_cachedLobbyArenaConfig`
  - inline in getArenaConfig -> `buildLobbyArenaConfig()`
  - `blockDisc` -> `blockCircle`
  - `lobbyNpcs` -> `LOBBY_BOSS_NPCS`
  - `FF` -> `LOBBY_PORTALS`
  - `EF` -> `LOBBY_NPC_ENCOUNTERS`

Verified identical (high confidence):
- every seed salt: 0xa5a5a5a5=2779096485, 0xc3ef3720=3287234336, 0x9e3779b9, 0x57415645, 0x50555253, 0x41434355, 0x59414d41=1497451841 (ours YamaEncounter.js:48-82,584; U state.ts:94-134, YamaEncounter.ts:338)
- the wave hash constants (shadowWaves.js:22-33 vs waves.ts:109-122)
- all contract numbers (contracts.js vs contractConfig.ts:227-597)
- the `YAMA_CONTRACTS` texts
- the hook order inside each method: resolveHazards = wave, then flare impacts, then local effects, then fireballs
- the void-flare round-robin and overlap test
- the perfect-dodge rule
- the lobby collision build

## 3. Behavioural divergences

**D1. Base Yama beat 3 (upstream changed since the beta; high)**
- Ours: `defaultYamaAttackPattern.snapFireballBeats = [0,3,7]` for every cycle (contracts.js:6-13; beatClock.js:7,22).
- Upstream: `snapFireballBeats: [0,7]` plus a new field `firstCycleSnapFireballBeats: [0,3,7]` (U/npcs/yama/timing.ts:41-49,76). Beat 3 snaps only in cycle 0, and from cycle 1 on Yama also casts an alternating auto alongside the beat-3 fireball. The cited evidence is capture yama-packet-data.txt ticks 906/976 and captureConformance.test.ts.
- Contracts are unaffected. Ours `[0,7]`; upstream `SIGIL_ENCOUNTER_BASE` sets both to `[0,7]` (contractConfig.ts:367).
- The field is absent from the whole client (grep `firstCycleSnapFireballBeats`: no hits), so this is not a reconstruction error.
- None of our commits touched it.
- Determinism: base-Yama digests change from the first beat 3 of cycle 1 (tick 4+7·13 = 95) on: an extra accuracyRng draw and an extra hit per cycle. Our base Yama is easier than upstream's by one auto per 70 ticks.

**D2. Melee void flare fuse (upstream changed since the beta; high)**
- Ours: a melee swing owes a flare with `config.chargeTicks` = 25 (voidFlares.js:153-182, `pendingSpawnCount += 1`).
- Upstream: `MELEE_VOID_FLARE_CHARGE_TICKS = 17`, with evidence that three melee flares exploded at add+17 in yama-normal-contract-long-p3 (contractConfig.ts:31-37). `pendingSpawns` becomes a list of `{chargeTicks, hp}` (state.ts:57-66; voidFlareCoordinator.ts:38-57,106-119).
- Spawn order and position draws are the same (the melee flare is queued first in both), so only fuse length and explode tick differ.
- Not in our code at all, so this is an upstream change. None of our commits touched it.
- Determinism: it changes any run in which Yama melees with flares on. Harness yama scenarios: check whether tools/determinism/scenarios/yama.mjs has the player in melee range.

**D3. Sandbox free-for-all accuracy branch (our deliberate change; 6173e47)**
- boss.js:325-335 rolls against a monster's own stats when `player.kind !== "player"`. Upstream yama.ts:267-285 has only the player path.
- Keep it when porting.

**D4. Attack-policy layer (upstream refactor since the beta; no behaviour change; high)**
- Ours routes postTick through `yamaAttackPolicy.onTick` (boss.js:40-102,198-242) and keeps `attackPolicy` state. `setYamaOpeningStyle` rebuilds that state (YamaEncounter.js:325-332,653).
- Upstream inlines `melee if in range, else alternate if not snap` (yama.ts:120-137).
- I checked case by case and they are equivalent. `getStyleForBeat` is computed but never used (boss.js:14-16 says so).
- Determinism: none. It is safe to delete with the upstream shape.

**D5. Arena source (adaptation; no behaviour change)**
- Ours: `arenaConfigFromCache` shim (cacheArena.js; YamaEncounter.js:615).
- Upstream: `getDefaultArenaConfig()` (YamaEncounter.ts:377).
- Same sealing rule: y <= 19.

**D6. Lobby (our deliberate changes)**
- 715be9b empties `lobbyNpcs` (upstream `LOBBY_BOSS_NPCS` keeps three statues: Zuk, Yama, Sol; metadata.ts:25-48), so no pedestal discs are blocked.
- `extendLobbyArena` from /lobby/gateways.js (LobbyEncounter.js:1,92) is ours only: ToA, DT2 and sandbox gateways.
- Before 715be9b our list had a fourth NPC, the Doom (14707), plus `EF["lobby-npc-3"]` (rendering.js:50033). Both are our additions.
- Upstream `getSnapshot` returns a fresh object per call. Ours does too (LobbyEncounter.js:29).

No reconstruction errors found in yama/ or lobby/.

## 4. Ours-only and upstream-only

Ours only:
- O/yama/sandbox.js (`yamaSandboxEntries`, c3dbc21)
- the sandbox ffa branch in boss.js (6173e47)
- the self-registering `encounter.js` with `slug`/`order` (3d419de). Upstream uses modules.ts + catalog.ts.
- lobby gateways via `extendLobbyArena`
- the empty `lobbyNpcs` and the encounter book (715be9b)
- the Doom lobby card (rendering.js:50033)

Upstream only:
- `MELEE_VOID_FLARE_CHARGE_TICKS`, `firstCycleSnapFireballBeats`
- `getFireballDangerTiles` (fireball.ts:379). Ours draws danger tiles in rendering.js:56183.
- YamaSceneObjectController.ts as a module (ours is in rendering.js:55405)
- renderConfig.ts, snapshot.ts types, commands.ts types (`YAMA_SET_OPENING_MAGIC/RANGE_COMMAND`; ours rendering.js:57715)
- metadata.ts as a module (ours is minified `FF`/`EF` in rendering.js)
- tests: captureConformance, contracts, waves, npcFactory, SceneObjectController, voidFlare, yama, LobbyEncounter
- docs/encounters/yama-facts-spec.md, sensory-clouding-open-questions.md

## 5. Readability wins, by priority

1. Take upstream's evidence comments wholesale: contractConfig.ts:20-62,163-271,327-597; timing.ts:8-49; voidFlareCoordinator.ts:12-17,59-70; yama.ts:221-263; waves.ts:30-131. These are the "why" behind every number, and our reconstruction has none of it.
2. Revert the two readability renames that moved away from names the bundle had and upstream keeps: `getActiveFireballs` -> `activePhases`, `getActiveManualFireballs` -> `activeManualPhases`. Also `getScheduledFireballs` -> `getFireballPhasesForTick`.
3. Replace these inferred names: `contractEncounterDefaults` -> `SIGIL_ENCOUNTER_BASE`, `isYamaSealedRow` -> `isSouthOfArenaEntrance`, `scaleBossHp` -> `phase3StartHp`, `getMissingHpPercent` -> `wretchedDamageBonusPercent`, `mixSeed` -> `voidFlareHash`, `hashInteger` -> `fmix32`, `fireballBurstTickOffsets` -> `FIREBALL_SET_OFFSETS`, `fireballAnglesByDuoSide` -> `BURST_SEQUENCES`, `clearFireballs`/`clearFlares` -> `clearForDefeat`.
4. Name the magic numbers: 7 completion delay, 2 manual lead, 6 latch, 17/25 fuses, 3 untargetable, 2 fuse-bar lead, 19 entrance row.
5. Fix `yamaMeleePoisonSeverity`: upstream calls the 100 a varp. Ours says "severity", which is inferred.
6. Delete the dead `yamaAttackPolicy`/`getStyleForBeat` (D4).
7. Split the file layout the way upstream does: npcs/yama/{timing,yama,voidFlare,wretchedStrength} and encounters/yamaP3/{state,contractConfig,contracts,waves,fireball,...}. Optional; renames alone give most of the value.
8. Name the lobby `FF`/`EF` as `LOBBY_PORTALS`/`LOBBY_NPC_ENCOUNTERS` and move them into lobby/.

## 6. Recommendations

| Component | Action | Effort | Risk |
|---|---|---|---|
| Yama behaviour D1, D2 | Port into ours: add `firstCycleSnapFireballBeats` to the pattern and beatClock; make the flare queue a list with a 17-tick melee fuse | S | Medium: changes yama digests; re-record and note in the commit |
| Yama code | Rename and port from upstream in place (names, comments, drop the policy layer). Keep the sandbox branch | M | Low |
| Yama file split to upstream layout | Optional, after the renames | M | Low; registry imports change |
| Lobby | Keep ours; rename constants and add the comment from upstream; move FF/EF out of rendering.js | S | Low |
| Wholesale replace with upstream TS | **Not recommended** | — | It would drop 6173e47 (ffa accuracy), c3dbc21 (sandbox entries), 3d419de (self-registration/order/slug) and 715be9b (book lobby, gateways), and needs our engine API names. Upstream has no equivalent of any of these. |

## 7. Our progress to preserve

Commits touching client/encounters/yama or client/encounters/lobby:
- **7ea8730** OpenScim: the initial reconstruction.
- **3d419de** "An encounter's directory registers itself": yama/encounter.js and lobby/encounter.js, with `slug` (yama) and `order` (30 / 40). Upstream's equivalent is modules.ts + catalog.ts, a different mechanism; keep ours.
- **c3dbc21** sandbox follow-ups: yama/sandbox.js (`yamaSandboxEntries`). Upstream has none.
- **6173e47** sandbox boss-on-a-team: boss.js `rollYamaAccuracy` NPC-target branch. Upstream has none. It must survive any port of `rollAccuracy`.
- **715be9b** lobby encounter book: `lobbyNpcs = []`, lobby digest re-recorded. Upstream still has its statues. Keep ours.

Outside this directory: `extendLobbyArena` in client/lobby/gateways.js and the gateway portals spread into `FF` (rendering.js:50014). Both ours only.

Tests and harness to keep green or re-record: tools/determinism/scenarios/yama.mjs, sandbox.mjs and the lobby digest. D1 and D2 will deliberately change the yama digests.
