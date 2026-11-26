# Encounters: Sol Heredit and Fortis Colosseum against upstream

`U` = `C:\Users\Juic\AppData\Local\Temp\claude\78c9ff9be5b412a3\64a132bd-40de-4a8e-ab81-b85c7ba8169d\scratchpad\upstream\scimgg`
`O` = `C:\_Development\openscim\client\encounters`

## 1. Summary verdict

- **Sol Heredit (`O/sol-heredit`) and upstream share a lineage, and our copy matches upstream almost line for line.** The constants, timings, RNG draw order, damage formulas, modifier texts and modifier rules all agree. We found no behavioural divergence in Sol's own fight. The checks covered:
  - modifier rules
  - Solarflare
  - Volatility
  - Bees
  - warband
  - molten sand
  - beam damage
  - phases and victory taunt
  - special-attack chance ramp
  - triple timings
  - grapple window

  Upstream is therefore the same version as the 2026-11-20 beta, or a newer one that has not changed Sol's behaviour. The only differences are names and module boundaries:
  - Upstream moved the shared modifier code to `U/src/encounters/colosseum/modifiers/*`.
  - Upstream moved Sol and his NPCs to `U/src/npcs/colosseum/*`.
  - Upstream uses `core/npcStickyPursuit.ts`. Our `minions.js` has that code inlined.
- **Our commits on `O/sol-heredit` since the reconstruction:**
  - 3d419de added `encounter.js`, the registry definition.
  - c3dbc21 added `sandbox.js`.
  - 12e8785 removed `isWorkInProgress`.

  None of our commits touched the 15 reconstructed files (`git log --stat`, all from 7ea8730). Adopting upstream's names, or even its code, in those files loses no fix of ours.
- **Colosseum waves (`O/colosseum`) has no upstream counterpart.** Upstream has no waves encounter; its README says "Not simulated: … Colosseum waves 1–11" (`U/src/encounters/solHeredit/README.md:89`). However, upstream's facts spec holds evidence from three wave captures (`U/docs/encounters/sol-heredit-facts-spec.md:22-24`):
  - Run A: waves 1–11 with Solarflare III, Volatility III, Bees I, Totemic and Doom.
  - Run B: waves with Bees I–III.
  - Run C: waves 1–11 with no modifiers.

  **Three of our wiki-based wave rules contradict that capture evidence.** Two of them are our own commit 981176e. This is the most important finding in this area.

## 2. Mapping table

Confidence: **H** = same code text; **M** = same behaviour with a different structure.

### Framework and modifiers

| Ours (file:line) | Upstream | Conf | Notes |
|---|---|---|---|
| `sol-heredit/encounter.js` (definition; 3d419de) | `U/src/encounters/modules.ts:170-194` (`sol_heredit` entry) + `createSolHereditEncounter`/`solOptionsSchema` `:99-113` | H | Upstream's entry still has `isWorkInProgress: true` (`modules.ts:184`). We removed it in 12e8785. |
| `sol-heredit/modifiers.js:5-112` `solHereditModifierDefinitions` | `colosseum/modifiers/definitions.ts:23` `COLOSSEUM_MODIFIERS` | H | Texts are identical. Upstream makes the list shared. |
| `modifiers.js:113-124` `solHereditModifiers` | `solHeredit/modifiers.ts:9-23` `OFFERED` → `SOL_HEREDIT_MODIFIERS` | H | |
| `modifiers.js:125-143` `noxiousHalberdItemIds`, `solHereditSetupNotes` | `solHeredit/modifiers.ts:26-36` `NOXIOUS_HALBERD_IDS`, `SOL_HEREDIT_SETUP_NOTES` | H | Upstream uses `loadoutHasItem` from `core/encounters/setupNotes.ts`. |
| `modifiers.js:144` `buildDoomMessage` | `colosseum/modifiers/rules.ts:17` `doomMessage` | H | |
| `modifiers.js:162` `SolModifierState` | `rules.ts:27` `ColosseumModifierState` | H | Behaviour is identical: Frailty, Myopia (polearm diagonal), Doom (15/10/5), Blasphemy exclusions. |
| `modifiers.js:263` `solHereditOptionsSchema` | `modules.ts:104` `solOptionsSchema` | H | |
| `solarflare.js:3` `CornerRoute` / `getPositionAfterTicks` | `colosseum/modifiers/routeRunner.ts:10` `ColosseumRouteRunner` / `positionAt` | H | |
| `solarflare.js:55` `solarflareRouteTimingByTier` | `solarflare.ts:9` `SOLARFLARE_TIMING` | H | 2/7, 2/0, 1/2 |
| `solarflare.js:69` `solarflareNpcDefinition` | `solarflare.ts:22` `solarflareDefinition` | H | |
| `solarflare.js:93` `createSolarflareOrb` | `solarflare.ts:38` `createSolarflare` | H | |
| `solarflare.js:111` `SolarflareDamage` | `solarflare.ts:55` `SolarflareDamageState` | H | Departure hit at T+1, 10–20, tier III drops the overhead prayer. |
| `modifierEffects.js:10` `getVolatilityExplosionTiles` | `volatility.ts:11` `volatilityExplosionTiles` | H | |
| `modifierEffects.js:20` `getVolatilityGraphicDelayCycles` | `volatility.ts:25` `volatilityRingDelay` | H | |
| `modifierEffects.js:204` `getExplosionCenter` | `volatility.ts:5` `volatilityExplosionCentre` | H | |
| `modifierEffects.js:208` `getVolatilityExplosionDamages` | `volatility.ts:32` `volatilityExplosionDamage` | H | 16–24 |
| `modifierEffects.js:24` `healingTotemNpcDefinition` | `totemic.ts:49` `healingTotemDefinition` | H | |
| `modifierEffects.js:27` `findTotemSpawnTile` | `totemic.ts:60` `healingTotemSpawnTile` | H | |
| `modifierEffects.js:54` `updateHealingTotem` | `totemic.ts:109` `advanceHealingTotem` | M | |
| `modifierEffects.js:98` `createHealingTotemActor` | `totemic.ts:82` `createHealingTotem` | H | |
| `modifierEffects.js:114` `createBeeSwarmActors` | `bees.ts:158` `createBeeSwarms` | H | |
| `modifierEffects.js:144` `createWarbanderActor` | `npcs/colosseum/warband.ts:292` `createWarbander` | H | |
| `modifierEffects.js:222` `SolModifierEffects` | `solHeredit/modifierEffects.ts:47` `SolModifierEffects` | H | Methods are listed in the next row. |
| `SolModifierEffects` methods | `processTotems`→`advanceTotemic`, `resetTotems`→`resetTotemic`, `advanceBeeRespawns`→`advanceRespawns`, `despawnBeesAndWarbanders`→`cleanupNpcs`, `areOrbsActive`→`shouldMoveOrbs`, `scheduleBossDefeatEffects`→`onSolDefeated` | M | Pairs matched by position and signature. |

### Warband and bees

| Ours (file:line) | Upstream | Conf | Notes |
|---|---|---|---|
| `minions.js:9-83` route helpers (`findMinionSlotRoute`, `getUsableRemainingSteps`, `takeMinionRouteSteps`) | `U/src/core/npcStickyPursuit.ts` (`pursuePlayerSticky`, `NpcStickyPursuitState`) | M | The minifier inlined upstream's core helper into our `minions.js`. |
| `minions.js:84-147` `warbanderRoles`/`warbanderSlotOffsets`/`defaultWarbanderFallbackOffsets`/`warbanderRoleConfigs` | `warband.ts:40/52/63/82` `WARBANDER_ROLES`/`WARBAND_SLOT_OFFSETS`/`WARBAND_FALLBACK_OFFSETS`/`WARBANDER_PROFILES` | H | Identical, including phases 3/5/4 and max hits 29/14/12. |
| `minions.js:148,159` `applyRelentlessToPlan`, `applyRelentlessDefenceBypass` | `warband.ts:157,150` `withRelentlessPlan`, `withRelentlessDefence` | H | |
| `minions.js:184` `buildWarbanderRouteOptions` | `warband.ts:177` `warbandPursuitProfile` | H | |
| `minions.js:198` `isWarbanderInAttackSlot` | `warband.ts:198` `isWarbanderAttackPosition` | H | |
| `minions.js:221` `warbanderNpcDefinition` | `warband.ts:210` `warbanderDefinition` | H | |
| `minions.js:343` `beeSwarmSpawnTiles` | `bees.ts:26` `COLOSSEUM_BEE_SPAWN_TILES` | H | |
| `minions.js:355` `pickBeeSwarmDestination` | `bees.ts:52` `chooseDestination` | H | |
| `minions.js:371` `findDirectMinionPath` | `core/npcRouteFinding.ts` `findNpcTileRoute` | M | Ours tries a diagonal-first walk and then falls back to BFS. Upstream's facts table describes the same rule (line 147). |
| `minions.js:402` `beeSwarmNpcDefinition` | `bees.ts:64` `beesDefinition` | H | |
| `minions.js:495` `advanceBeeSwarmRespawn` | `bees.ts:135` `advanceBeeRespawn` | H | |

### Sol's fight

| Ours (file:line) | Upstream | Conf | Notes |
|---|---|---|---|
| `boss.js:48` `solNpcDefinition` | `npcs/colosseum/sol.ts:78` `solDefinition` | H | |
| `boss.js:15` `createSolPursuitMovement` | `sol.ts:200` `solPursuitProfile` | M | |
| `boss.js:164` `tryLaunchSolAttack` | `sol.ts:280` `launchSolIfReady` | M | |
| `boss.js:140` `canSolLaunchAttackFrom` | `sol.ts:264` `solLaunchesThisTick` | M | |
| `boss.js:240` `isInSolMeleeRange` | `sol.ts:347` `isSolAdjacent` | M | |
| `SolHereditEncounter.js:59` `consumeSolGuaranteedMaxHit` | `sol.ts:223` `consumeSolParryReward` | M | Ours is an inferred name. Upstream calls it the perfect-parry reward. |
| `bossAttacks.js` attack-scheduler functions | `npcs/colosseum/attackScheduler.ts` | M | Pairs:<br>`createSolAttackScheduler`→`createSolAttackState`<br>`isSolAttackDue`→`solAttackReady`<br>`getForcedSpecialAttack`→`readyForcedSpecial`<br>`getSpecialAttackChance`→`specialChance` (0.25 / 0.02+0.075g / cap 0.6, identical)<br>`areSpecialAttacksUnlocked`→`tripleUnlocked`<br>`isGrappleUnlocked`→`grappleUnlocked`<br>`isFasterAttackPhase`→`regularsAreFast`<br>`isLongTriplePhase`→`tripleIsLong`<br>`getRegularAttackIntervalTicks`→`cooldownAfter`<br>`scheduleSolAttack`→`launchSolAttack`<br>`scheduleSolSpecialAttack`→`launchSolSpecial` (11/12 cooldown identical)<br>`clearSolPendingAttacks`→`clearSolAttacks` / `cancelSolAttacks`<br>`buildGroundAttackArea`→`solGroundTiles` |
| `bossAttacks.js` tile and aim functions | `npcs/colosseum/solAttacks.ts` | M | Pairs:<br>`getSolCentreTile`→`solCentreTile`<br>`getChebyshevTileDistance`→`chebyshevDistance`<br>`getSpearAttackTiles`→`spearTiles`<br>`getDiagonalSpearAttackTiles`→`diagonalSpearTiles`<br>`getShieldSafeDistance`→`shieldSafeRadius`<br>`getShieldAttackTiles`→`shieldTiles`<br>`getGroundAttackTiles`→`solAttackTiles`<br>`getGroundAttackDelayCycles`→`telegraphDelayCycles`<br>`getNextAttackVariant`→`selectSolVariant`<br>`createSolAttackMemory`→`rememberSolAction`<br>`getDirectionFromCentre`→`octantToward`<br>`getSolAttackDirection`→`solAimToward` |
| `boss.js:35,43` `takeDueGroundAttack`, `takeDueTripleHit` | `attackScheduler.ts:240,247` `takeSolGroundLanding`, `takeSolTripleHit` | M | |
| `grapple.js` | `npcs/colosseum/grapple.ts` | M | Pairs:<br>`buildGrappleTauntSegments`→`grappleTauntSegments`<br>`buildGrappleTauntMessage`→`grappleWarningMessage`<br>`getGrappleOutcomeMessage`→`grappleOutcomeMessage`<br>`recordGrappleDefenceClick`→`registerSolParry`<br>`resolvePendingGrapple`→`resolveSolGrapple` (upstream `grapple.ts:142`)<br>`boss.js:153` `startGrapple`→`startSolGrapple`<br>our `grapple.js:152` `resolveSolGrapple` (the per-boss wrapper) → `sol.ts:237` `resolveSolParries`<br>`hasItemInEquipmentSlot`→`slotHoldsItem` (`sol.ts:231`) |
| `lightBeams.js:141` `LightBeamRuntime` | `solHeredit/beams.ts:43` `SolBeamRounds` | M | Methods:<br>`rollCooldownTicks`→`rollReadyDelay`<br>`cancelActiveRound`→`cancelRound`<br>`startRoundCharge`→`startChargeIfDue`<br>`capReadyTick`→`enrage`<br>`resolveBeamHit`→`takeHitIfDue`<br>Beam damage is identical: max of two rolls over 40..75+Relentless (`lightBeams.js:271-275` vs `beams.ts:202-206`). |
| `lightBeams.js:87,119,129,138` `beamCrystalNpcDefinition`, `getBeamCrystalEdgeTile`, `getBeamLineTiles`, `getBeamCrystalDirection` | `npcs/colosseum/crystal.ts:28,84,89,97` `crystalDefinition`, `crystalTile`, `beamLineTiles`, `crystalBeamDirection` | M | |
| `moltenSand.js:3` `MoltenSand` | `solHeredit/moltenSand.ts:29` `MoltenSand` | H | Methods `cancelPendingStrikes`→`stopForming`, `getPoolTiles`→`getActivePools`, `hasPoolAt`→`isCovered`. The logic is identical (E+3 burn, E+5 pool, 9×9 area, 6–8 damage). |
| `phases.js` `solPhases`, `solDefeatOverheadTexts`, `getSolPhaseForHp`, `isSolEnragePhase` | `phases.ts` `SOL_PHASE_TRANSITIONS`, `SOL_VICTORY_TAUNTS` + `solVictoryTaunt()`, `phaseForHp`, `isEnraged` | H | Upstream also names `SOL_OPENING_TAUNT`. Ours keeps that taunt inline. |
| `SolHereditEncounter.js:89` (class) | `solHeredit/SolHereditEncounter.ts:101` | H | The public hooks are the same set. Private methods:<br>`startPhaseTransition`→`advancePhase`<br>`resolvePendingTransitions`→`runTransitionSchedule`<br>`rollEnrageSandDelay`→`rollFirstEnrageSandDelay`<br>`strikeEnrageSand`→`runEnrageSand`<br>`emitSandStrikeVisual`→`strikeSand`/`sandVisualEvent`<br>`getAliveCrystals`→`crystals`<br>`isAttackLaunchExpected`/`processLightBeams`→`solAttacks`/`runBeams`<br>`spawnCrystal`→`addCrystal`<br>`buildOverheadTextEvent`→`tauntEvent`<br>`buildGrappleOverheadTextEvent`→`grappleTauntEvent`<br>`getSolStylePin`→`solHereditStylePin`<br>`throwUnknownSolHereditAction`→`assertNever` |
| `constants.js` | `solHeredit/constants.ts` + `npcs/colosseum/constants.ts` | H | Pairs:<br>`solArenaBounds`→`SOL_ARENA`<br>`solBasePosition`→`SOL_START_POSITION`<br>`enrageSandDelayTickRange`→`ENRAGE_SAND_FIRST_SINGLE_DELAY_TICKS`<br>`beamCooldownTickRange`→`BEAM_READY_DELAY_TICKS`<br>`quartetSpawnTiles`→`SOL_QUARTET_SPAWN_TILES`<br>`solarflareRouteCorners`→`SOL_SOLARFLARE_ROUTES`<br>`triple*`→`TRIPLE_HIT_OFFSETS_*`/`TRIPLE_DAMAGE_*`<br>`grappleWindowTicks`→`GRAPPLE_WINDOW_TICKS`<br>`relentless*`→`RELENTLESS_*`<br>`colosseumSeqIds`/`colosseumSpotAnimIds`→`COLOSSEUM_SEQS`/`COLOSSEUM_SPOTANIMS`<br>`totemProjectileFlight`→`HEALING_TOTEM_PROJECTILE`<br>`warbandProjectileFlights`→`WARBAND_PROJECTILES`<br>`isSolArenaTile`→`isInsideArena` (`solAttacks.ts:52`)<br>`emitColosseumVisual`→`npcs/colosseum/visualEvents.ts`<br>`solMessageColors`→`CHAT_HIGHLIGHT_COLORS` |
| Inlined literals in ours | Named constants upstream | H | `TRANSITION_*`, `SAND_*`, `BEAM_*`, `SOL_*_TICK`, `SPEAR_/SHIELD_COOLDOWN_TICKS`, `REGULAR_AOE_MAX_HIT`, `SPECIAL_*`, `GRAPPLE_SHARE_OF_SPECIALS`. The minifier inlined these. Upstream names them, each with a VERIFIED/MODEL note. |
| `actors.js:66` `createColosseumActor` | `npcs/colosseum/actors.ts:49` | H | |
| `boundaryLocs.js` `solBoundaryLocs` | `solHeredit/arenaBoundary.ts` `SOL_BOUNDARY_WARRIORS` | H | |
| `controls.js` | `solHeredit/controls.ts`, `commands.ts` | H | |
| Scene: `SolHereditSceneObjectController`, render config (in `assets/rendering.js`) | `solHeredit/SolHereditSceneObjectController.ts`, `renderConfig.ts` | M | Not in scope; noted for the renderer mapper. |

## 3. Behavioural divergences

### Sol's fight

None found. We compared the following directly:
- modifier rules (`modifiers.js:179-261` vs `rules.ts:44-111`)
- Solarflare (`solarflare.js` vs `solarflare.ts` + `routeRunner.ts`, identical)
- Bees (`minions.js:402-515` vs `bees.ts:64-156`, identical)
- warband (`minions.js:84-342` vs `warband.ts`, identical apart from the sticky-pursuit inlining)
- molten sand (identical)
- beam damage (identical)
- phases and victory taunt (identical)
- special ramp (`bossAttacks.js:220-228` vs `attackScheduler.ts:153`)
- Sol Solarflare routes (`constants.js:23-48` vs `constants.ts:210-235`, identical)

Determinism impact: none.

### Colosseum waves

Our code is wiki-based, written by us. Upstream's evidence comes from Runs A, B and C.

| # | What | Ours | Upstream evidence | Class | Conf |
|---|---|---|---|---|---|
| D1 | **Solarflare hit rule in waves** | `colosseum/modifierEffects.js:48-112` `WaveSolarflareDamage`:<br>• tiers I/II: hit on the orb's *second tick* on the player's tile<br>• tier III: hit on any contact, *arrival included*<br>Added by **981176e** ("Solarflare hits on contact", "I and II hit only on the orb's second tick"), from the wiki strategy page. | Facts spec `:136` VERIFIED from Run A waves:<br>• the hit comes on *departure* from the player's start-of-tick tile, landing at T+1<br>• 11 hits match this rule<br>• **arrival-only overlaps A:1854/1888 dealt no hit**, at tier III<br>Code: `solarflare.ts:65-88`. | Our deliberate change (981176e) that a capture contradicts. Run A is Solarflare III, so our tier-III contact rule is directly contradicted. Tiers I/II are not sampled in A, but upstream says Sol's M capture (tier I) fits the departure rule too. | H for III, M for I/II |
| D2 | **Solarflare damage by tier** | `modifierEffects.js:64`: 10–20 / 15–25 / 20–30 (inferred in 981176e) | `:140` MODEL: 10–20 at all tiers. Observed hits span 10–20 at tier III, "no observed tier difference" (`solarflare.ts:72-73`). | Our inference (981176e) that a capture contradicts | H for III |
| D3 | **Totemic cadence in waves** | `modifierEffects.js:121-123, 268-274, 331-362`:<br>• one totem at a time<br>• after a kill, or the target's death, no totem for 200 ticks | Run A has 55 wave totems: adds at 850, 889, 934, 1026, …, some 21–40 ticks apart (`__tests__/fixtures/healingTotemCapture.ts:1706+`). The rule is a trigger per target on its half-HP crossing (`facts-spec:260-262`). The 200-tick respawn is WIKI-ONLY and only Sol uses it (`constants.ts:190-195`). | Inference error in our initial colosseum code (7ea8730). Our waves spawn far fewer totems than the game does. | H |
| D4 | **Bees wave spawn tick** | `modifierEffects.js:201-217`: swarms spawn when the wave's monsters are placed | `:142` VERIFIED: wave-message +5 (B:2361→2366, …), simultaneous, tiers 1/2/3 | Our inference (7ea8730) | M (depends on our monsters being placed on the wave-message tick) |
| D5 | **Volatility damage range** | `modifierEffects.js:124-131`: 16–25. Ours cites our own OBS samples of 16 and **25**. | `volatility.ts:44` 16–24 (MODEL, observed max 24) | Disagreement in data. Our 25 is an observation, so keep ours and tell upstream. | M |
| D6 | **Volatility blast tiles** | `:286` filters the blast tiles to walkable ones | `volatility.ts:11-23` uses the unfiltered footprint ± radius | No damage effect, because the player cannot stand on an unwalkable tile. The only effect is fewer fireblast graphics. | H, harmless |
| D7 | **Volatility III sand pool** | Ours puts a sand pool on the centre tile (`:300-302`) | Not simulated (`definitions.ts:43`) | Ours-only feature | H |
| D8 | **Solarflare orb geometry in waves** | One orb per pillar on a 5×5 ring (`modifierEffects.js:35-47`, 981176e, "reported by players") | Upstream publishes only Sol's four rings around the Sol-arena quadrants (`constants.ts:210`). It says tier timings were verified in Run A waves 5–7 but publishes no wave routes. | Open question. We cannot confirm or refute ours from upstream's public material. | L |

Determinism impact: fixing D1–D4 changes Colosseum wave replays and any golden or harness fixtures for those waves. Sol is unaffected.

## 4. Ours-only and upstream-only

**Ours only:**
- the whole Colosseum waves encounter (`O/colosseum/*`, about 3,800 lines): waves 1–11, Minimus offers, the four wave-only modifiers (reentry, redflag, dynamicduo, …: `colosseum/modifiers.js:24-117`), manticore, minotaur, javelin, shaman, jaguar and shockwave monsters, intermission, overlays, audio, practice tools (981176e, 7cc06cd), sandbox (210ade8)
- `sol-heredit/sandbox.js` (c3dbc21)
- registration through `encounter.js` (3d419de)
- the non-beta flag (12e8785)

**Upstream only:**
- docs: the facts spec, capture analysis, unverified register and Sol README (evidence ledger for every constant)
- `setupNotes.ts`'s `loadoutHasItem`
- named constants with status labels
- `SOL_OPENING_TAUNT` and `solVictoryTaunt()`
- the shared `colosseum/modifiers/` package
- `npcStickyPursuit` as a core module
- capture-conformance tests and fixtures: `bees.test.ts`, `totemic.test.ts`, `modifierEffects.test.ts`, `rules.test.ts`, the warband capture test, beam timeline, and extracts from Runs A, B and C. These are the most valuable for our waves.
- `colosseum/modifiers/__tests__/fixtures/beeCapture.ts`, `healingTotemCapture.ts`: wave evidence we never had

## 5. Readability wins (priority order)

1. **Rename `sol-heredit` from upstream, and split out a shared `colosseum-modifiers` module.**
   - Our `colosseum/*` currently imports Sol internals: `SolModifierState`, `createWarbanderActor`, `beeSwarmNpcDefinition`, `createSolarflareOrb`, `getVolatility*` (`colosseum/ColosseumEncounter.js:37-40`, `modifierEffects.js:13-24`, `modifiers.js:14`, `waveMonster.js:9`).
   - Upstream's split (`encounters/colosseum/modifiers/*` shared, `npcs/colosseum/*` for Sol's NPCs) fits exactly the dependency we already have.
   - Do it as a mechanical rename (§2 table) plus file moves.
2. **Restore upstream's named constants and their evidence comments.** Today many are bare literals in our code: 0.075, 0.6, 11/12, 75, 40, 200 and others.
3. **Replace our inferred names that upstream contradicts or sharpens.** All of these sit in `tools/names/sol-heredit-bindings.json`:
   - `beamCooldownTickRange` (`_C`, "inferred: … cooldown") → `BEAM_READY_DELAY_TICKS`. Upstream: a post-fire *ready delay*, not a cooldown.
   - `solDefeatOverheadTexts` (`Fj`) → `SOL_VICTORY_TAUNTS`
   - `enrageSandDelayTickRange` (`RC`) → `ENRAGE_SAND_FIRST_SINGLE_DELAY_TICKS`. It is only the *first single's* delay.
   - `solBasePosition` (`xC`) → `SOL_START_POSITION`
   - `solHereditModifierDefinitions` (`Uj`, inferred) → `COLOSSEUM_MODIFIERS`, which is shared and not Sol's.
   - `SolModifierState` (`z$`) → `ColosseumModifierState`
   - `consumeSolGuaranteedMaxHit` → `consumeSolParryReward`
   - `MoltenSand.cancelPendingStrikes` → `stopForming`. Ours undersells it: it also drops pools that formed on or after the tick.
   - `LightBeamRuntime.capReadyTick` → `enrage`
   - `isSolArenaTile` → `isInsideArena`
4. **Bring across upstream's doc comments on the modifier code** (`bees.ts`, `totemic.ts`, `solarflare.ts`, `volatility.ts`, `warband.ts`). Each states its evidence status.
5. **Copy `docs/encounters/sol-heredit-facts-spec.md`, `-unverified.md` and `-capture-analysis.md` into our docs.** This is MIT, so keep the notice. Link them from the Sol and Colosseum modules.

## 6. Recommendations

| Component | Recommendation | Effort | Risk |
|---|---|---|---|
| `sol-heredit/*` (15 reconstructed files) | **Rename and restructure from upstream.** A line-by-line port of upstream's TypeScript as JS is also acceptable, since no commit of ours touched these files. Keep our `encounter.js` (registry contract), `sandbox.js` and the non-beta flag. Update the importers: `assets/rendering.js:57739-57742, 57961`, `colosseum/*`, `sandbox/arenas.js:25-26`, `sandbox/brawler.js:31`, `sandbox/encounter.js:62`, `sandbox/catalog.js:49`. | M | Low. Behaviour is identical. Check with the determinism harness: Sol replays must come out byte-identical. |
| Shared Colosseum modifiers | **Extract** `encounters/colosseum-modifiers/` (or adopt upstream's layout) holding `rules`, `solarflare`, `routeRunner`, `bees`, `totemic`, `volatility`, `definitions`, from the current Sol files. | S–M | Low |
| `colosseum/modifierEffects.js` Solarflare (D1, D2) | **Port upstream's `SolarflareDamageState` for the waves**: the departure rule and 10–20 damage. This means reverting part of 981176e. Keep from 981176e: the four orbs per pillar, the True Tile overlay (`getOrbTiles`) and the practice tools. Ask the user before reverting: 981176e was a deliberate wiki-based choice ("Solarflare skip"), and upstream's capture contradicts it at tier III. | S | Medium. Changes behaviour players have seen; replays shift. |
| `colosseum/modifierEffects.js` Totemic (D3) | **Port the shared `totemic.ts` rule set**: a trigger per target on its half-HP crossing, first launch +7, every 6 after, SW-then-NE spawn tile, heal floor(30%) capped. Drop the global 200-tick gate in the waves. | S–M | Medium. Replays shift. Upstream's `totemic.test.ts` can be adapted as a conformance test. |
| Bees wave spawn (D4) | Spawn at wave-message +5 (`facts-spec:142`). | S | Low–medium |
| Volatility (D5–D7) | Keep ours: 16–25 is our own observation, and the Volatility III sand pool is ours-only. | — | — |
| Solarflare wave routes (D8) | Keep ours and mark it UNVERIFIED. | — | — |
| Wave tests | Adopt upstream's capture fixtures from Runs A, B and C (bees, totems, warband) as conformance tests for our Colosseum waves. They are the only wave captures available to us. | M | Low |

## 7. Our progress to preserve

| Commit | What | Where | Affected by adoption? |
|---|---|---|---|
| 3d419de | Directory self-registration (`sol-heredit/encounter.js`, `colosseum/encounter.js`, `presentation.js`) | registry contract | Keep. Upstream uses a hand-maintained `modules.ts`. |
| 12e8785 | Sol and Colosseum no longer marked beta | `sol-heredit/encounter.js`, `colosseum/ColosseumEncounter.js` | Keep. Upstream still has `isWorkInProgress: true`. |
| c3dbc21 / 8c0af2f / 6173e47 | Sandbox entries for Sol (`sol-heredit/sandbox.js`, which imports `bossAttacks.js` `buildGroundAttackArea`/`getGroundAttackDelayCycles`) | sandbox | Keep. Re-point its imports after the rename (to `solGroundTiles`/`telegraphDelayCycles`). |
| 210ade8 | Colosseum sandbox mechanics | `colosseum/sandbox.js` | Keep. Re-point its imports. |
| 981176e | Four Solarflare orbs per pillar, True Tile overlay, Retry Wave / Random Spawns, south spawn presets, **and** the Solarflare contact/second-tick rule with tiered damage | `colosseum/*` | Keep everything **except** the hit rule and tiered damage. Upstream's capture contradicts those (D1, D2); revert them only with the user's agreement. |
| 7cc06cd | South spawn choices fit the practice panel | `colosseum/controls.js` | Keep |
| f69b819 | No per-frame page search for overlays | `colosseum/intermission.js`, `overlays.js` | Keep (performance) |
| 3b0484d | Encounter picker module | `colosseum/presentation.js` and others | Keep |
| 7ea8730 (ours, pre-history) | The whole Colosseum waves encounter | `colosseum/*` | Keep. Upstream has no equivalent. Apply only the targeted fixes D1–D4. |

The reconstructed Sol files carry no fix of ours, so nothing is lost by porting them from upstream. Upstream has no equivalent for any Colosseum waves change.
