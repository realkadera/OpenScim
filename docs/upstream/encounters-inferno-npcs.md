# Encounters: Inferno (incl. Zuk) and the shared NPC framework vs upstream

Scope: OURS `client/encounters/inferno/*`, `client/encounters/shared/*` (O = `C:\_Development\openscim\client\encounters\`)
vs UPSTREAM `src/encounters/inferno/*`, `src/encounters/zuk/*`, `src/npcs/inferno/*`, `src/npcs/projectileCue.ts`,
`src/core/npcs/*`, plus the core pursuit/route/attack files they rely on (U = `...\upstream\scimgg\src\`).

Method: read both sides, then compared files by hand and with a literal-diff script
(`scratchpad/mapping/tools/numdiff.py`, which compares the numeric literals and string literals of file pairs with comments stripped).
I also compared the wave table field by field (all 68 waves are identical), compared every decision `site:` label
(identical: 13 inferno/zuk labels + `npc.attack.*`), compared every seed salt (all 5 match; ours are in decimal, upstream's in hex),
and diffed the Jad healer, meleer dig, Zuk set clock, pillar collapse, bat drain, NPC definition framework,
pursuit, route search and attack roll code line by line.

## 1. Summary verdict

- **Same lineage, effectively the same revision.** For the simulation code in this area, upstream is the
  TypeScript source our bundle was built from. Every behaviour-bearing constant, branch, RNG draw order and
  decision label I checked matches. The differences are names, file layout and inlined constants.
- **Wave 69 / Zuk:** upstream does **not** split Zuk off as a separate encounter. `zuk` is a *retired kind*
  (wave 69 of `inferno`). `src/encounters/zuk/` only holds wave 69's director (`ZukWaveDirector`), set scheduler,
  sparks, intro and controls. Our `inferno/` contains the same thing (`zukFight.js`, `zukSetClock.js`, `zukHealers.js`,
  `zuk.js`). Splitting ours is a directory move, not a behaviour change.
- **Shared framework:** `shared/npcDefinitions.js`, `npcMovement.js`, `npcRoutes.js` and `npcAttack.js` are verbatim
  reconstructions of `core/npcs/NpcDefinition(.ts|Collection.ts)`, `core/npcCombatMovement.ts`,
  `core/npcRouteFinding.ts`, `core/npcPursuit.ts` and `core/combat/npcAttack(Request|Resolution).ts`.
- **One real behavioural divergence** sits next to this area, in `engine/npcState.js` (the red-X hold). Upstream
  has a broader rule. See D1.
- **What upstream has and we do not:** core helpers we lack (sticky pursuit, the tile route with a straight-line
  shortcut, linear patrol as a shared module), typed constants and comments that cite evidence, and per-species
  files. **What is ours only:** `inferno/sandbox.js`, `inferno/encounter.js` (our self-registering contract),
  and `shared/viewLayer.js`. The setup-link, spawn-layout editor and wave-info code are still inside the
  `Grid.js`/`rendering.js` chunks on our side.

## 2. Mapping table

Confidence H = code is line-for-line equivalent; M = same role, partial reading.

### Encounter class and wave director
| Ours (O) | Upstream (U) | Conf | Notes |
|---|---|---|---|
| inferno/InfernoEncounter.js:243 `InfernoEncounter` | encounters/inferno/InfernoEncounter.ts:167 | H | Hooks are identical in order and content. Renames: `beginWave`:979→`spawnWave`:777, `completeWaveIfCleared`:1040→`checkWaveCompletion`:818, `requireZukFight`:810→`requireZuk`:659, `refreshArenaConfig`:726→`installArena`:597, `getCombatSeed`:731→`npcSeed`:601, `allocateActorId`→`allocateId`, `buildNpcDefinitionContext`→`npcContext`, `getSetupFromMechanics`→`resolveSetup`, `getStartPlayerTile`→`runStartTile`, `getPlayerStartForSetup`→`openingStart`, `getRestartStartPosition`→`restartStart`, `getIntactPillarKeys`→`intactPillarKeys`, `spawnCombatant`→`INFERNO_WAVE_SPAWNERS` (spawners.ts) |
| InfernoEncounter.js:60 `getInfernoStage` / :68 `createRandomInfernoSeed` / :71 `isInfernoTileOpen` | InfernoEncounter.ts:138 `stageOf` / :148 `newSeed` / :152 `isTileOpen` | H | |
| InfernoEncounter.js:77 `getBatHitDrains` | npcs/inferno/bat.ts:95 `jalMejRahDrainEffect` | H | -300 run energy and -1 to each combat stat; skipped when prayed correctly |
| InfernoEncounter.js:100,109 `isNpcAtPillar`,`buildPillarCollapseHits` | encounters/inferno/pillars.ts:125 `touchesFootprint`, :141 `pillarCollapseHits` | H | |
| InfernoEncounter.js:129 `pickWaveNibblerPillar` | layout.ts:72 `pickWaveNibblerTarget` | H | salt 1313423956 = `NIBBLER_TARGET_STREAM` 0x4e494254 |
| InfernoEncounter.js:142 `findJadHealerSpawnTiles` | layout.ts:208 `pickJadHealerTiles` | H | radius 4–8, ring fallback 8 |
| InfernoEncounter.js:184/199/221 `registerWaveMonsters`/`registerWaveNpcs`/`registerZukNpcs` | spawners.ts `infernoWaveRegistrations`; zuk/ZukWaveDirector.ts:91 `zukWaveRegistrations` | H | Jad healer heals 10 with an 18 crush max hit (spawners.ts:120-122); Zuk healers heal 15+⌊r·10⌋ (ZukWaveDirector.ts:97) |
| inferno/encounter.js (`definition`, `order`) | encounters/modules.ts:195-233 (inferno entry), catalog.ts:63-69 | H | **Ours (3d419de)**: our self-registering registry contract. Upstream keeps a hand-written manifest |
| inferno/constants.js | encounters/inferno/constants.ts, zuk/constants.ts, npcs/inferno/constants.ts | H | `infernoPlayerStart`→`INFERNO_LANDING_TILE`, `infernoDefaultStartTile`→`INFERNO_PRACTICE_START_TILE` [34,44], `zukIntro*TickOffset`→`ZUK_INTRO.{busyFrom,teleport,add}`, `jadHealerSpawnDistanceRange`→`JAD_HEALER_SPAWN_DISTANCE`, `infernoWaveMessageColor`→`WAVE_MESSAGE_COLOR`. Ours inlines `11`/`1`, which upstream names `FIRST_WAVE_DELAY_TICKS`/`PRACTICE_START_WAVE_DELAY_TICKS` via `startWaveDelayTicks()` (constants.ts:54); ours at InfernoEncounter.js:355 |
| inferno/collisionFlags.js | constants local to pillars.ts:47 `PILLAR_FLAGS`, waveCombat.ts:16 / InfernoEncounter.ts:146 `BLOCKING_FLAGS` | H | |
| inferno/controls.js (`getInfernoSetup`:90, keys :74-82) | encounters/inferno/controls.ts (`resolveInfernoRunSetup`, `INFERNO_*_KEY`), zuk/controls.ts (`buildZukControls`) | H | default start wave 69 on both sides |
| inferno/spawnCommandType.js | encounters/inferno/commands.ts, zuk/commands.ts | M | Upstream also keeps the Zuk command schemas (`ZUK_DEBUG_ACTIONS`); ours are still in Grid.js:9601-9646 / rendering.js:32497 |
| inferno/waves.js:7 `infernoWaveCompositions`, :376/:382 | encounters/inferno/waves.ts:26 `WAVES`, `waveComposition`, `waveSpawnKinds` | H | All 68 rows identical |
| waves.js:435 `mixInfernoWaveSeed`, :438 `createWaveNpcRandom`, :457 `createWaveLayoutRandom`, :441 `shuffleWithDecisions`, :484 `buildInfernoWaveSpawns` | layout.ts:36 `waveStreamSeed`, :63 `waveNpcRandom`, :55 `waveLayoutRandom`, :86 `shuffled`, :134 `planWaveSpawns` | H | salts 0x4c41594f/0x4e504353/0x41545054/0x9e3779b1 match |
| waves.js:423 `infernoJadWaveConfigs` | npcs/inferno/jad.ts:153 `INFERNO_WAVE_JAD_SCHEDULE` | H | 67: [4], period 8, 5 healers; 68: [4,7,10], period 9, 3 per Jad |
| inferno/waveMonsters.js (`waveMonsterFactories`, `removeWaveMonsterIfDue`, `corpseSpeciesByNpcTypeId`) | spawners.ts `INFERNO_WAVE_SPAWNERS`; npcs/inferno/waveNpcs.ts `removeInfernoNpcIfDue`, `INFERNO_REMOVAL_DELAY_TICKS`; resurrection.ts:31 `resurrectableSpecies` | H | Meleer creation (49/50 first dig check) sits here in ours and in meleer.ts:218 upstream |
| inferno/pillars.js | encounters/inferno/pillars.ts | H | `infernoPillarNpcDefinition`→`pillarProxyDefinition`, `infernoPillarCollapseNpcDefinition`→`pillarCollapseDefinition`, `buildArenaConfigWithPillars`→`composePillarArena`, `getInfernoPillarTiles`→`pillarFootprint`, `pillarCollapseRemovalTicks`/`scripted…`→`PILLAR_COLLAPSE_REMOVAL_TICKS.natural/.scripted`, `createInfernoPillarActor`→`createPillarProxy` |
| inferno/startTile.js, spawnLayout.js | encounters/inferno/startTile.ts, spawnLayout.ts | H/M | Upstream spawnLayout.ts also has the setup-link parser. Ours is still in rendering.js:32748-32799 |
| inferno/events.js, monsterHelpers.js | npcs/inferno/events.ts, visualEvents.ts, presentation.ts, waveCombat.ts, targetResolution.ts, demonstrations.ts | H | **Name collision:** our `emitZukHit` (monsterHelpers.js:55, the `onDamageResolved` handler) is upstream's `presentInfernoDamage` (presentation.ts:9). Upstream's `emitZukHit` is the low-level emitter inside it. Also `canNpcAttackWithPlan`→`canNpcAttack` (npcAttackRequest.ts:151), `isCombatActionDue`→`isNpcActionReady`, `buildLabelledDecisions`→`contextAttackDecisions`, `chooseDistinctValues`→(layout.ts `chosenSlots`/healer pick), `resolveMonsterTarget`→`resolveReadyTarget` |
| inferno/actors.js | npcs/inferno/actors.ts (`createInfernoActor`, `infernoIdentity`, `RANGER_PROFILES`, `GLYPH_FORMULA_STATS`) | H | error text `Missing Inferno monster data for` on both sides |

### Species
| Ours | Upstream | Conf | Notes |
|---|---|---|---|
| inferno/nibbler.js | npcs/inferno/nibbler.ts | H | No literal differences |
| inferno/bat.js | npcs/inferno/bat.ts | H | `batNpcDefinition`→`batDefinition`. Upstream names `BAT_ATTACK_SPEED/RANGE/RUN_ENERGY_DRAIN` |
| inferno/blob.js | npcs/inferno/blob.ts | H | `blobChildNpcDefinition`→`splitBlobDefinition`. Sites `inferno.blob.style`/`.melee` match |
| inferno/meleer.js | npcs/inferno/meleer.ts | H | `findMeleerDigUpTile`→`meleerResurfacePosition`, `advanceMeleerDig`→`advanceDig`, `rollMeleerDigInterval`→`rollDigInterval`. 19 = `MELEER_ATTACK_SPEED+DIG_ATTACK_DELAY_WINDOW_TICKS`; int(0,20) = int(0,`DIG_RECHECK_SPAN_TICKS`-1); `clearNpcTargetableFromTick`→`surfaceNpc` |
| inferno/mager.js, ranger.js | npcs/inferno/setMonsters.ts (`magerDefinition`, `rangerDefinition`), resurrection.ts (`tryMagerResurrection`) | H | Resurrection chance 0.1, box 31-37 × 28-34, still for 7 ticks, max 70, message text all identical. Ours inlines `npc.attack.select` (mager.js:235). Upstream calls `selectNpcAttack` (npcAttackRequest.ts:169), same draw |
| inferno/jad.js (Jad + Yt-HurKot) | npcs/inferno/jad.ts + jadHealer.ts | H | `jadExecution`→`LIVE_JAD_EXECUTION`, `waveJadExecution`→`ORDINARY_JAD_EXECUTION`. The healer's tick/move logic is line-for-line identical (jad.js:107-243 vs jadHealer.ts:69-151). `faceActorToward`→`faceInfernoAction`, `isActorInMeleeRange`→`isNpcInMeleeRange`, `createRetaliationState`→`createNpcRetaliation` |
| inferno/zuk.js (Zuk + glyph + linear patrol) | npcs/inferno/zuk.ts, glyph.ts, core/npcs/linearPatrol.ts | H | `zukShieldNpcDefinition`→`glyphDefinition`, `enragedZukCastIntervalTicks`→`ZUK_ENRAGED_CAST_INTERVAL_TICKS` (7), thresholds 480/240. Ours has the patrol inline (zuk.js:~25-43); upstream has it as `calculateLinearPatrolMove` |
| inferno/zukHealers.js | npcs/inferno/healer.ts + encounters/zuk/sparks.ts | H | `zukHealerNpcDefinition`→`healerDefinition` |
| inferno/zukSetClock.js `ZukSetClock` | encounters/zuk/setScheduler.ts `ZukSetScheduler` | H | Identical state machine. 278 = `OPENING_SKIP_CARRY` (350-72) |
| inferno/zukFight.js `ZukFight`, `zukShieldPatrol` | encounters/zuk/ZukWaveDirector.ts `ZukWaveDirector`, `GLYPH_PATROL` | H | `createNpcs`→`createOpeningActors`, `setShieldStart`→`configureShieldStart`, `bossAndGlyphIds`→`openingActorIds`. Salt 1246252114 = `JAD_HEALER_STREAM`. Command cases match (emit-spark-volley, replace-set, spawn-jad-healers, demonstrate-jad, inspect-ranged-graphic) |

### Shared framework
| Ours | Upstream | Conf | Notes |
|---|---|---|---|
| shared/npcDefinitions.js:3 `defineNpc` | core/npcs/NpcDefinition.ts:13 `createNpcDefinition` | H | Identical, including error strings. Default move: ours `getNpcPursuitMoves`, upstream `standardNpcCombatMove` (same function) |
| npcDefinitions.js:169 `NpcDefinitionRegistry` (+ errors :257,:265) | core/npcs/NpcDefinitionCollection.ts:14,:88,:95 | H | |
| engine/npcState.js `markNpcDeathAnimationNotified` | core/npcDeath.ts:160 `claimNpcDeathAnimation` | H | |
| shared/npcMovement.js:248 `getNpcPursuitMoves` | core/npcCombatMovement.ts:86 `standardNpcCombatMove` | H | Body identical apart from the hold predicate (D1) |
| npcMovement.js:199 `getPursuitDestinationTile` | npcCombatMovement.ts:32 `naiveCombatDestination` | H | **Our half-plane names are wrong.** `inNorthWestHalf` is upstream `southWestClockwise`, `inNorthEastHalf`→`northWestClockwise`, `inSouthEastHalf`→`northEastClockwise`, `inSouthWestHalf`→`southEastClockwise` |
| npcMovement.js:8-188 step masks, `canFootprintStepInArena` | core/npcMovementCollision.ts:176 `canNpcTakeStep` | H | |
| npcMovement.js:189 `isArenaFootprintWalkable` | (inferno-local) waveCombat.ts:75 `isInfernoFootprintLegal` / npcOccupancy | M | |
| shared/npcRoutes.js:107 `findNpcRoute`, :70 `findNpcRouteToMeleeRange` | core/npcRouteFinding.ts:176 `searchNpcRoute`, :130 `findNpcMeleeRoute` | H | Constants 128/64/10/100 match (`SEARCH_MAP_SIZE`, `SOURCE_LOCAL_COORDINATE`, `ALTERNATIVE_ROUTE_RANGE/MAX_DISTANCE`). `findNearestReachedIndex`→`findAlternativeIndex`, `getDistanceToInterval`→`axisDistance`, `isTileCardinallyAdjacentToFootprint`→`isExactMeleeArrival`, `getRouteGridIndex`→`localIndex`, `buildRouteSteps`→`reconstructSteps`, `isTileInFootprint`→`isCoordinateInsideFootprint` |
| npcRoutes.js:202 `findBossPursuitPath`, :260 `getBossPursuitMoves`, :196 `isTileUnderFootprint` | core/npcPursuit.ts:42 `npcPursuitPath`, :82 `pursuePlayer`, :34 `isPlayerUnderFootprint` | H | |
| shared/npcAttack.js:94 `rollNpcAttack` | core/combat/npcAttackRequest.ts:103 `resolveAttackRequest` | H | |
| npcAttack.js:11 `rollNpcAccuracyAndDamage` | core/combat/npcAttackResolution.ts:50 `resolveNpcAttack` | H | same accuracy then damage draw order |
| npcAttack.js:71 `rollNpcAttackAgainstNpc`, :63 `getDistanceFromNpcCentre`, :68 `getNpcProjectileFlightTicks`, :167 `isNpcInAttackRange` | npcAttackRequest.ts:213 `resolveNpcTarget`, :34 `projectileDistance`, :52 `npcProjectileHitDelay`, :191 `hasNpcAttackReach` | H | |
| shared/npcHelpers.js `scheduleNextActionTick`, `healNpc`, `activeOutcome`, `buildNpcProjectileVisual` | core/combat/npcActionClock.ts:7 `scheduleNpcAction`, npcHealing.ts:5 `applyNpcHealing`, core/encounters/outcome.ts `ACTIVE_ENCOUNTER_OUTCOME`, npcs/projectileCue.ts | H/M | |
| engine helpers used here: `canNpcActAtTick`, `isActorAlive`, `isNpcAlive`, `canNpcBeHealed`, `weightEqually`, `getContextDecisions`, `createRandomDecisions`, `scheduleNpcHitpointRegen` | core/npcDeath.ts:54 `canNpcActThisTurn`, :61 `canReceiveNewAttack`, :79 `isNpcLiving`, :84 `canReceiveHealing`; decisionRandom.ts:59 `uniformOptions`, :87 `contextDecisions`, :39 `generatorDecisionRandom`; npcRegeneration.ts:15 `enableNpcHitpointRegen` | H | |
| shared/buildScene.js | inlined in upstream presentationModules / SceneCompositor setters | M | Ours (a seam for module presentations) |
| shared/viewLayer.js | — | — | Ours (8c4bf6b, f69b819) |

## 3. Behavioural divergences

| # | What | Ours | Upstream | Class | Determinism impact |
|---|---|---|---|---|---|
| D1 | **Red-X movement hold.** When does an NPC not step while the player stands under it? | engine/npcState.js:200-208 `isNpcHeldInPlace`: bound, **or** `player.attackTarget === npc.id && attackInteractionActive` and the player is under the NPC | core/npcCombatMovement.ts:20-29 `isNpcMovementSuppressed`: bound, **or** player under NPC && **`npc.combat.targetId === player.id`** && (**an attack on *any* NPC** still active **or `pendingItemPickup !== null`**). Documented in docs/architecture/npc-combat-movement.md:22-26 with a wiki oldid | **Upstream change since the beta** (medium-high confidence). Our line has not changed since 7ea8730, and upstream documents the newer rule with a cited source. It is not one of our fixes | **Yes.** It changes NPC steps, and therefore RNG consumption through `npc.movement.overlap_escape`, whenever the player stands under an NPC while attacking something else or picking up an item. Sandbox/brawler, Inferno and every definition using the default move are affected. Determinism digests would need re-recording. The fix is in the engine area: hand it to the engine mapper |
| D2 | Upstream-only route helpers: `findNpcTileRoute` (diagonal-first straight-line shortcut, then search; npcRouteFinding.ts:154), `findNpcExactTileRoute` (:149, validates the request and requires `canOccupy(destination)`), `npcStickyPursuit.ts` | ours: `findNpcRoute(req,"tile")` = plain BFS, no validation (npcRoutes.js:107; used at sol-heredit/minions.js:20,392) | used by colosseum/modifiers/bees.ts:92 and npcs/colosseum/warband.ts (sticky) | **Probably upstream change** (the warband/bees reworks are newer). Not in Inferno | Affects Sol minions/bees only. Flag for the Sol/Colosseum mapper |
| — | Everything else checked: wave table, spawn order, seeds/salts, decision labels, meleer dig (50/49, 40-60, ≤19, +3/+3/+9), Jad (windup 3, period 8/9, max 113, release-judged prayer), Jad healer (heal 10 every 4 untagged and adjacent; tagged pursues and melees with max 18), Zuk healers (15-24), Zuk thresholds 480/240 and cast 10/7, set clock 72/350/+175/carry 278, mager resurrection, bat drain, pillar collapse, NPC definition hooks, pursuit, BFS, attack roll | identical | identical | — | none |

No reconstruction errors were found in this area.

## 4. Ours-only and upstream-only pieces

**Ours only (keep):**
- `inferno/encounter.js` (3d419de): our self-registering definition. It carries the same fields as upstream's `modules.ts` entry.
- `inferno/sandbox.js` (c3dbc21, 6173e47): Inferno monsters as sandbox participants.
- `shared/viewLayer.js` (8c4bf6b, f69b819): the overlay mount point; the cache added in f69b819 avoids a per-frame page search.
- `shared/buildScene.js`: lets module presentations build scenes without importing rendering.js.
- `jad.js` comments (6744b56): sources for Jad's timings. The fix itself lives in the sandbox/engine `prayerCheckAt`, and `test/test-jad-prayer-window.mjs` pins it.

**Upstream only:**
- *Code we have but still inside the chunks:* the Zuk command schemas and the `ZUK_DEBUG_ACTIONS` controls (Grid.js:9601-9646), the setup-link parser (rendering.js:32748-32799), and the arena map image (Grid.js:5398).
- *Not present on our side at all (UI/tooling):* `waveInfo.ts`, `replayChapters.ts`, `practiceChrome.ts`, `setupLinkNotice.ts`, the `InfernoSetup`/`InfernoSpawnSetup`/`SpawnLayoutMap`/`InfernoLayoutTool` TSX, and `introCutscene.ts`/`alcoveScenery.ts`/`sceneObjects.ts`/`renderConfig.ts`. Our counterparts of these live in rendering.js.
- *Core helpers:* `linearPatrol.ts`, `npcStickyPursuit.ts`, `findNpcTileRoute`/`findNpcExactTileRoute`, and `npcs/inferno/demonstrations.ts`. Our demonstrations are inside zukFight.js.
- *Evidence docs:* `docs/encounters/inferno-*.md`, `zuk-*.md`, `docs/architecture/npc-*.md`. Upstream's comments cite capture lines (P:/Q:/W69:) for almost every constant.
- *Tests:* capture conformance, decision parity golden files, and replay fixtures for waves 1-68.

## 5. Readability wins (prioritised)

1. **Adopt upstream names for the shared framework.** These are verbatim equivalents, so the change is pure renaming:
   `defineNpc`→`createNpcDefinition`, `NpcDefinitionRegistry`→`NpcDefinitionCollection`, `getNpcPursuitMoves`→`standardNpcCombatMove`,
   `getBossPursuitMoves`→`pursuePlayer`, `findNpcRouteToMeleeRange`→`findNpcMeleeRoute`, `rollNpcAttack`→`resolveAttackRequest`,
   `isNpcInAttackRange`→`hasNpcAttackReach`, `canFootprintStepInArena`→`canNpcTakeStep`, `isNpcHeldInPlace`→`isNpcMovementSuppressed`,
   `canNpcActAtTick`→`canNpcActThisTurn`, `scheduleNextActionTick`→`scheduleNpcAction`, `healNpc`→`applyNpcHealing`.
   The callers outside inferno (yama, sol-heredit, colosseum/minotaur, sandbox/brawler, araxxor, zebak) only need import renames.
2. **Fix the misleading names:**
   - Our `emitZukHit` (the damage presenter) should become `presentInfernoDamage`. If we later port upstream's `emitZukHit`, the two names would collide.
   - Our half-plane names in `getPursuitDestinationTile` are geometrically wrong: they should be `southWestClockwise`, etc.
   - `isActorAlive` actually tests whether the actor can receive a new attack: rename it `canReceiveNewAttack`.
   - `isNpcAlive` should become `isNpcLiving`.
3. **Re-introduce the named constants and evidence comments.** Ours inlines them:
   - meleer: `FIRST_DIG_CHECK_TICKS`, `DIG_SUPPRESSED_AFTER_ATTACK_TICKS`, `ATTACK_AFTER_UP_TICKS`
   - start delay: `startWaveDelayTicks`
   - pillars: `PILLAR_SIZE`, `PILLAR_COLLAPSE_REMOVAL_TICKS`
   - seed salts: `*_STREAM` in hex
   - set clock: `ZUK_SET_*`, `OPENING_SKIP_CARRY`
   - Zuk intro: `ZUK_INTRO`
4. **Class and method names:** `ZukFight`→`ZukWaveDirector`, `ZukSetClock`→`ZukSetScheduler`, plus the `InfernoEncounter` method renames in §2.
5. **File split:** move wave 69 into `encounters/zuk/`, species into `npcs/inferno/*` and the shared framework into `core/npcs` + `core/*`. Do this last, because it changes import paths widely.

`tools/names` renames that upstream contradicts or improves on (all marked "inferred" except where noted):

| Our rename | Upstream name |
|---|---|
| `isActorAlive` | `canReceiveNewAttack` |
| `isNpcAlive` | `isNpcLiving` |
| `isNpcInAttackRange` | `hasNpcAttackReach` |
| `weightEqually` | `uniformOptions` |
| `getDistanceFromNpcCentre` | `projectileDistance` |
| `getNpcProjectileFlightTicks` | `npcProjectileHitDelay` |
| `rollNpcAttackAgainstNpc` | `resolveNpcTarget` |
| `canNpcAttackWithPlan` | `canNpcAttack` |
| `isCombatActionDue` | `isNpcActionReady` |
| `resolveMonsterTarget` | `resolveReadyTarget` |
| `isActorInMeleeRange` | `isNpcInMeleeRange` |
| `waveJadExecution` | `ORDINARY_JAD_EXECUTION` |
| `isInfernoTileOpen` | `isTileOpen` |
| `buildArenaConfigWithPillars` | `composePillarArena` |
| `getInfernoPillarTiles` | `pillarFootprint` |
| `mixInfernoWaveSeed` | `waveStreamSeed` |
| `shuffleWithDecisions` | `shuffled` |
| `buildPillarCollapseHits` | `pillarCollapseHits` |
| `isNpcAtPillar` | `touchesFootprint` |
| `pickWaveNibblerPillar` | `pickWaveNibblerTarget` |
| `enragedZukCastIntervalTicks` | `ZUK_ENRAGED_CAST_INTERVAL_TICKS` |
| `getIntactPillarKeys` | `intactPillarKeys` |
| `refreshArenaConfig` | `installArena` |
| `getCombatSeed` | `npcSeed` |
| `bossAndGlyphIds` | `openingActorIds` |
| `findBossPursuitPath` | `npcPursuitPath` |
| `findNearestReachedIndex` | `findAlternativeIndex` |
| `getDistanceToInterval` | `axisDistance` |
| `isTileCardinallyAdjacentToFootprint` | `isExactMeleeArrival` |
| `getRouteGridIndex` | `localIndex` |
| `routeGridSize` | `SEARCH_MAP_SIZE` |
| `isOpenFloorFootprint` / `isMagerResurrectionTileFree` | `isInfernoFootprintLegal` / `canReviveAt` |

The ones recorded as "evidence" are still not upstream's names:

| Our "evidence" name | Upstream name |
|---|---|
| `getNpcPursuitMoves` | `standardNpcCombatMove` |
| `emitZukHit` | `presentInfernoDamage` |
| `ZukFight` | `ZukWaveDirector` |
| `ZukSetClock` | `ZukSetScheduler` |
| `beginWave` | `spawnWave` |
| `completeWaveIfCleared` | `checkWaveCompletion` |
| `getInfernoSetup` | `resolveInfernoRunSetup` |
| `defineNpc` | `createNpcDefinition` |
| `NpcDefinitionRegistry` | `NpcDefinitionCollection` |
| `markNpcDeathAnimationNotified` | `claimNpcDeathAnimation` |

The "evidence" in those records proves what the symbol does, not what upstream called it.

## 6. Recommendation per component

| Component | Verdict | Effort | Risk |
|---|---|---|---|
| shared/npcDefinitions.js | rename-from-upstream (names + JSDoc). Replacing the file is also safe: no commits of ours touch it | S | low; covered by determinism digests |
| shared/npcMovement.js, npcRoutes.js, npcAttack.js | rename-from-upstream. Port `findNpcTileRoute`/sticky pursuit only when the Sol/Colosseum mapper confirms they are needed | S-M | low for renames. D1 is a separate decision |
| engine `isNpcHeldInPlace` (D1) | adopt upstream's rule, gated by re-recording the digests. Decide with the engine owner | S | medium: changes sandbox and Inferno digests |
| inferno/* simulation (encounter, waves, species, Zuk) | rename-from-upstream in place, then optionally split into zuk/ + npcs/inferno/ following upstream's layout. Wholesale replacement would also be behaviour-neutral, but it would drop `inferno/sandbox.js` hooks/exports and the 6744b56 comments, and our callers (sandbox, registry contract) would need adapting | M | low |
| inferno/encounter.js | keep (our registry contract) and align field names with `EncounterCoreModule` | S | low |
| inferno/sandbox.js, shared/viewLayer.js, shared/buildScene.js | keep | — | — |
| UI/tools still in chunks (setup link, spawn-layout editor, wave info, Zuk command schemas) | extract them using upstream's files as the template (spawnLayout.ts, setupLink.ts, zuk/commands.ts, waveInfo.ts) | M | low |

## 7. Our progress to preserve

`git log -- client/encounters/inferno client/encounters/shared` lists only these commits:

| Commit | Touches | What | Upstream equivalent? |
|---|---|---|---|
| 7ea8730 | everything | the reconstruction | — |
| 3d419de | inferno/encounter.js | the directory registers itself (`definition`, `order`) | No. Upstream uses a hand-maintained `modules.ts` + `catalog.ts` |
| c3dbc21, 6173e47 | inferno/sandbox.js | Inferno species in the sandbox, their mechanics, a boss on a team | No (the sandbox is ours) |
| 6744b56 | inferno/jad.js (comments only) | sources for Jad's timings. The behaviour fix (prayer judged on release for windup attacks in the sandbox) is in sandbox/engine code, plus `test/test-jad-prayer-window.mjs` | Upstream's Jad already uses `prayerCheckAtRelease: 'launch'` (jad.ts:103), so no change is needed in jad.js. Keep the test |
| 8c4bf6b, f69b819 | shared/viewLayer.js | the overlay layer under the interface (Vardorvis strangle) and caching the view lookup instead of a per-frame page search | No |

Commits mentioned in the brief that do **not** touch this area: 8c0af2f, 210ade8, 3bd61a5.

Any rename or port must keep:
- the exports `inferno/sandbox.js` imports from the inferno modules (species definitions, `createJad`, etc.)
- `getBossPursuitMoves`/`findNpcRouteToMeleeRange`/`findNpcRoute` for yama, sol-heredit (boss.js, minions.js), colosseum/minotaur.js and sandbox/brawler.js
- `defineNpc` for every project-written encounter (zebak, vardorvis, duke, leviathan, doom, araxxor, hydra)
- the determinism harness digests: they must stay bit-identical for a pure rename, and be re-recorded only for D1
