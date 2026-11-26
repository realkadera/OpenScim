# Area: encounters — framework, NPCs, original encounters

O = C:\_Development\openscim. U = scratchpad\upstream\scimgg.
This file is the summary. The citations are in the detail files in the same folder:
- `encounters-framework.draft.md`: registry, catalog, presentations and the Encounter contract (mapping table)
- `encounters-inferno-npcs.md`: Inferno, Zuk and the shared NPC framework
- `encounters-yama-lobby.md`: Yama and the lobby
- `encounters-sol-colosseum.md`: Sol Heredit and our Colosseum waves

## 1. Summary verdict
- **Same lineage.** Upstream is effectively the source revision our bundles were built from.
  - Inferno, Zuk and the shared NPC framework match line for line in behaviour: wave table, seed salts, decision-site labels, hook order.
  - Sol Heredit likewise shows no behavioural difference.
  - Yama has two small changes that are newer upstream (see D1 and D2).
- **No reconstruction errors** were found in the four reconstructed encounters.
- **The differences are names and layout:**
  - Upstream splits each species into `src/npcs/<encounter>/` and keeps the encounter director in `src/encounters/<encounter>/`.
  - Upstream's evidence comments (P:line capture citations) are richer than ours.
- **Zuk is not split out as an encounter upstream.** `zuk` is a retired kind meaning "Inferno wave 69", in both upstream and ours. U/src/encounters/zuk/ holds only `ZukWaveDirector`, which is our inferno/zukFight.js `ZukFight`. Our inferno/ directory therefore contains Zuk, as upstream's design intends.
- **Upstream has no Colosseum waves encounter.** Its src/encounters/colosseum holds only the shared modifiers. Its facts spec, though, contains recordings of wave runs (Runs A/B/C) that contradict four of our wiki-based wave rules (D3–D6).
- **Our framework has grown past upstream's** in four ways:
  - self-registering directories with `order` (3d419de)
  - a catalog derived from the registry (3bd61a5)
  - menu data on the descriptor: loadouts, seo, tileMarkerPresets (2db8f11)
  - the `variantDescriptors` and `slug` keys, plus two extra engine hooks

## 2. Mapping table (headline; full tables in the detail files)
| Ours | Upstream | Conf. |
|---|---|---|
| encounters/registry.js definitions, `registeredEncounterDefinitions`, `getDefinitionKinds`, `getEncounterControls`, `isIntroEnabledForKind`, `hasCountdownMovement`, `resolveKindOrRetiredEntry` | encounters/modules.ts `EncounterCoreModule`, `ENCOUNTER_CORE_MODULES`, `encounterKindsOf`, `encounterControlsForKind`, `encounterEnablesIntro`, `encounterOffersCountdownMovement`, `resolveEncounterEntry` (modules.ts:46-313) | high |
| registry.js anonymous registry class; `.isRegistered`; `.getDescriptorOfKindOrVariant` | core/encounters/encounterFactory.ts `EncounterRegistry`; `.hasKind`; `.getDescriptorForKind`; singleton in encounters/registry.ts | high |
| engine/encounterKinds.js `encounterDefinitions`, `resolveRetiredEncounterKind`, `resolveBaseEncounterKind`, `retiredEncounterKindEntries` | encounters/catalog.ts `ENCOUNTER_CATALOG`, `canonicalEncounterKind`, `baseEncounterKind`, `RETIRED_ENCOUNTER_KINDS`; slugs.ts | high |
| encounters/presentations.js presentation objects | encounters/presentationModules.ts `EncounterPresentationModule` (same keys) | high |
| encounters/catalog.js (picker categories) | none. Name collision with upstream catalog.ts, which has a different meaning | high |
| Encounter object (engine/SimulationEngine.js calls) | core/encounters/types.ts `interface Encounter` (types.ts:543-727), same hook names | high |
| shared/npcDefinitions.js `NpcDefinitionRegistry`, `defineNpc` | core/npcs/NpcDefinitionCollection.ts, NpcDefinition.ts | high |
| shared/npcMovement.js, npcRoutes.js, npcAttack.js | core pursuit/route/attack modules (see the inferno-npcs report) | high |
| inferno/InfernoEncounter.js: `beginWave`, `completeWaveIfCleared`, `requireZukFight`, `refreshArenaConfig`, `getCombatSeed`, `getSetupFromMechanics`, `getPlayerStartForSetup`, `getRestartStartPosition`, `allocateActorId`, `buildNpcDefinitionContext` | InfernoEncounter.ts: `spawnWave`, `checkWaveCompletion`, `requireZuk`, `installArena`, `npcSeed`, `resolveSetup`, `openingStart`, `restartStart`, `allocateId`, `npcContext` | high |
| inferno/zukFight.js `ZukFight` (`createNpcs`, `setShieldStart`, `bossAndGlyphIds`) | zuk/ZukWaveDirector.ts (`createOpeningActors`, `configureShieldStart`, `openingActorIds`) | high |
| inferno/controls.js `getInfernoSetup`, `infernoStartWaveKey`… | inferno/controls.ts `resolveInfernoRunSetup`, `INFERNO_START_WAVE_KEY`… | high |
| inferno/{bat,blob,meleer,mager,ranger,nibbler,jad,zuk,zukHealers}.js | npcs/inferno/*.ts | high |
| yama/* | encounters/yamaP3/* + npcs/yama/* | high |
| sol-heredit/* (boss, bossAttacks, minions, grapple, modifiers, solarflare, modifierEffects) | encounters/solHeredit/* + npcs/colosseum/{sol,solAttacks,warband,grapple,crystal} + encounters/colosseum/modifiers/* | high |
| lobby/LobbyEncounter.js | encounters/lobby/LobbyEncounter.ts + metadata.ts | high |

## 3. Behavioural divergences
| # | What | Ours vs upstream | Class | Determinism |
|---|---|---|---|---|
| D1 | Base Yama's beat 3 | Ours snaps on beat 3 every cycle (O yama/contracts.js:6-13). Upstream snaps only in the first cycle and afterwards adds a normal attack (U npcs/yama/timing.ts:41-49,76). | Upstream change since beta | Yama digests change from tick ~95 |
| D2 | Void flare after a melee swing explodes after | 25 ticks in ours (yama/voidFlares.js:175), 17 upstream (yamaP3/contractConfig.ts:31-37). Upstream also keeps a list of per-flare spawns instead of a pending counter. | Upstream change | Yama digests |
| D3 | Colosseum Solarflare hit rule | Ours hits on contact or on the orb's second tick. Run A shows a hit only when the orb leaves the player's tile. | Our deliberate wiki-based choice (981176e) contradicted by upstream evidence | Colosseum digests |
| D4 | Solarflare damage by tier | Ours scales to 15–25 / 20–30. Run A's tier III stays within 10–20 and upstream finds no difference between tiers. | Ours (981176e) vs evidence | Colosseum |
| D5 | Colosseum totems | Ours allows one at a time with a 200-tick wait after a kill. Run A spawned one per wounded monster at half HP, 55 in the run. | Our wiki-based authoring | Colosseum |
| D6 | Colosseum bees | Upstream recorded them 5 ticks after the wave message. Ours spawn with the wave. | Our authoring | Colosseum |
| D7 | NPC red-X hold (in engine/npcState.js:200; reported here because NPC pursuit depends on it) | Ours holds while the player attacks that NPC. Upstream (core/npcCombatMovement.ts:20, npc-combat-movement.md:22) holds when the NPC targets the player and the player has any attack in progress or is picking up an item. | Probably an upstream change since beta | Every encounter's digests; hand to the engine area |
| D8 | Lobby | Ours has an encounter book and gateways, no statues or portals (715be9b). Upstream has statues of Zuk, Yama and Sol plus a Yama portal. | Our deliberate change | none (lobby) |
| D9 | `getDescriptorForKind` | Ours also consults `variantDescriptors` (registry.js:209). | Ours (Doom deep room) | none |
No divergence found: Inferno 1–68 and Zuk, Sol Heredit, and the NPC framework (pursuit, route search, attack roll, defineNpc).

## 4. Ours-only and upstream-only
**Ours only:**
- Framework:
  - glob self-registration with `order` and `definitions[]` (3d419de)
  - `slug` and `variantDescriptors` on a definition
  - `loadouts`, `seo` and `tileMarkerPresets` on a descriptor (2db8f11)
  - a catalog derived from the registry, with the DT2 announced kinds (3bd61a5)
  - the picker catalog encounters/catalog.js (3b0484d)
  - presentations.js discovery
  - the engine hooks `approachRange` and `moveDisplacedPlayer` (SimulationEngine.js:1778,1791; present since 7ea8730)
  - `isEncounterKind`
  - shared/viewLayer.js (8c4bf6b, f69b819)
- Encounters:
  - sandbox entries `<enc>/sandbox.js` (c3dbc21, 6173e47, 210ade8)
  - the whole Colosseum waves encounter
  - project encounters: zebak (client/toa via tombs-of-amascut/encounter.js), vardorvis, duke-sucellus, leviathan, doom-of-mokhaiotl, araxxor, alchemical-hydra, maggot-king, corrupted-hunllef
  - Yama accuracy against monsters in the sandbox (6173e47)
  - Volatility III sand pool

**Upstream only:**
- catalog.ts (hand-written identity table), pinned to modules, presentation modules, slugs and lobby by `encounterModules.test.ts`
- slugs.ts using Maps to guard against `/toString` lookups
- descriptor `modifiers`, `setupNotes` and `defaultModifierSelection` with `filterModifierSelection` (our sol-heredit/encounter.js already carries the first two)
- core/encounters/snapshot.ts, outcome.ts and variantTypes.ts as typed modules
- `linearPatrol.ts`
- `npcStickyPursuit` and `findNpcTileRoute` (our sol-heredit/minions.js inlines them)
- Inferno UI: setupLink, spawn-layout editor, arena map image, practiceChrome, replayChapters, waveInfo
- capture-conformance tests with replay fixtures for Inferno and Sol, the bees and totem captures, and the decision-parity golden file
- docs/encounters/*-facts-spec.md, *-policy.md and *-open-questions.md

**What adopting upstream's encounter contract would break for our project encounters:**
- Every project encounter is found by glob and exports `definition`/`definitions` plus `order`. An upstream-style hand-written `ENCOUNTER_CORE_MODULES` would need an entry each, and an `ENCOUNTER_CATALOG` entry pinned by test.
- Doom relies on `variantDescriptors`.
- Vardorvis, Duke and Leviathan rely on the derived awakened kinds (dt2/bosses.js).
- ToA registers two definitions from one directory.
- Colosseum, Vardorvis, Hydra and Zebak call `moveDisplacedPlayer`/`approachRange`, which upstream's `Encounter` interface does not have.
- Menus read `descriptor.loadouts`, `seo` and `tileMarkerPresets`.
- The sandbox wraps every host by hook name (sandbox/encounter.js:88-97), so a rename of a hook must also update that list.
- The renames themselves (definition→module, `isRegistered`→`hasKind`, …) touch application.js, Grid.js, the determinism harness and the tests.

## 5. Readability wins (prioritised)
1. **Registry API names from upstream.** Each of these contradicts one of our renames in tools/names/registry-bindings.json and registry-members.json, most of them marked "inferred":
   - `getDefinitionKinds`→`encounterKindsOf`
   - `getDefinitionOfKind`→`encounterModuleForKind`
   - `getEncounterControls`→`encounterControlsForKind`
   - `isIntroEnabledForKind`→`encounterEnablesIntro`
   - `hasCountdownMovement`→`encounterOffersCountdownMovement`
   - `resolveKindOrRetiredEntry`→`resolveEncounterEntry`
   - `isRegistered`→`hasKind`
   - `getDescriptorOfKindOrVariant`→`getDescriptorForKind`
   - encounterKinds.js: `resolveRetiredEncounterKind`→`canonicalEncounterKind`, `resolveBaseEncounterKind`→`baseEncounterKind`

   Keep "definition" as our word, or adopt "module"; either way, document the mapping.
2. **Rename our picker `encounters/catalog.js`** (e.g. `pickerCatalog.js`) before introducing upstream's identity meaning of "catalog".
3. **Inferno/Zuk method and constant names** (table above), plus about 30 contradicted inferred names listed in encounters-inferno-npcs.md:
   - Our `emitZukHit` is upstream's `presentInfernoDamage`. Upstream's own `emitZukHit` is a different function.
   - The half-plane names in `getPursuitDestinationTile` are geometrically wrong.
   - `isActorAlive` should be `canReceiveNewAttack`.
   - Use named constants instead of our decimal seed salts, e.g. 1313423956 = 0x4e494254 "NIBT".
4. **Yama: about 20 contradicted inferred names:**
   - `contractEncounterDefaults`→`SIGIL_ENCOUNTER_BASE`
   - `isYamaSealedRow`→`isSouthOfArenaEntrance`
   - `hashInteger`→`fmix32`
   - `clearFireballs`/`clearFlares`→`clearForDefeat`
   - Revert `getActiveFireballs`/`getActiveManualFireballs` to `activePhases`/`activeManualPhases`.
5. **Sol:**
   - `beamCooldownTickRange`→`BEAM_READY_DELAY_TICKS`
   - `solBoundaryLocs`→`SOL_BOUNDARY_WARRIORS`
   - Move the shared Colosseum modifier code into a common module, as upstream does in encounters/colosseum/modifiers/.
6. **Copy upstream's evidence comments** (P:line, facts-spec references) and its README code maps for inferno, zuk and solHeredit.
7. **Split species files into an `npcs/<encounter>/` layout:** optional, M effort.

## 6. Recommendation per component
| Component | Action | Effort | Risk |
|---|---|---|---|
| registry.js / encounterKinds.js / presentations.js | Keep our discovery and derived-catalog design; rename API from upstream with aliases for one release. Optionally adopt the catalog-pinning test idea. | S | low (many call sites in chunks) |
| Encounter contract | Keep ours; it is upstream's plus 2 hooks. Write it down as a JSDoc typedef modelled on types.ts. | S | none |
| shared/ NPC framework | Rename from upstream, port `npcStickyPursuit` and `findNpcTileRoute` as named helpers. Do not replace. | S–M | low; digests unchanged |
| inferno/ (incl. Zuk) | Rename and port comments from upstream. Replacement is possible in principle (same behaviour), but it would lose sandbox.js, encounter.js and the Jad test comments, and it needs a TS→JS port. | M | low |
| yama/ | Rename from upstream. Port D1 and D2 as a deliberate "upstream since beta" change and re-record the digests. | S (+M rename) | medium (digests) |
| sol-heredit/ | Port and rename from upstream (no behavioural change). None of our commits touched its 15 reconstructed files. | M | low |
| colosseum/ (ours) | Keep. Use upstream's Run A/B/C evidence as conformance tests. Decide D3–D6 with the user, since this partly reverts 981176e. Reuse upstream's bees.ts and totemic.ts logic. | M | medium (behaviour + digests) |
| lobby/ | Keep ours (encounter book). Take names for the remaining minified symbols. | S | low |
| project encounters | Keep. Any contract rename must update them and the sandbox hook list. | — | — |

## 7. Our progress to preserve (encounter area)
| Commit | What | Would a wholesale replacement lose it? | Upstream equivalent? |
|---|---|---|---|
| 7ea8730 | The `approachRange`/`moveDisplacedPlayer` hooks; project encounters | yes (the hooks) | no |
| 8c0af2f / c3dbc21 / 210ade8 / 6173e47 / 6744b56 | Sandbox: `<enc>/sandbox.js` for inferno, yama, sol, colosseum; Yama accuracy against monsters; Jad prayer judged on release, plus its test | yes | no |
| 3d419de | Self-registering `encounter.js` with `order`, `slug`, `definitions[]`; presentations discovery | yes | no (manual list) |
| 2db8f11 | Descriptor `loadouts`/`seo`/`tileMarkerPresets` read by the menus | yes | no |
| 3bd61a5 | encounterKinds.js derived from the registry; DT2 announced kinds | yes | inverse design |
| 5246aff | Leviathan registered | yes | no |
| 715be9b / 3b0484d / 12e8785 | Lobby encounter book; picker module and catalog.js; Sol and Colosseum no longer marked beta | yes | no |
| 981176e / 7cc06cd / f69b819 / 8c4bf6b | Colosseum Solarflare fixes, True Tile overlay, practice tools, south spawn choices; overlays without per-frame page search; viewLayer | yes, if colosseum/shared were replaced | Partly contradicted by evidence (D3/D4); keep the rest |

**Rule:** rename or port from upstream into our files. Never overwrite a directory wholesale. The detail reports each have their own "commits to preserve" list.
