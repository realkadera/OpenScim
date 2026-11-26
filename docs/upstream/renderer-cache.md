# Renderer, scenes, cache loader, audio synth: OpenScim vs upstream scimgg

Paths:
- **Ours** is `C:\_Development\openscim` at `feat/encounter-book` 12e8785. I only read it.
- **U** is the upstream clone, `scratchpad\upstream\scimgg`. It has 5 commits, and its root is `3639203` "open-source release", 2026-11-24.
- **Machine-made appendices** sit next to this file:
  - `renderer-cache-classes.tsv`: each of the 151 classes of `rendering.js` with its best upstream class and a score.
  - `renderer-cache-methods.tsv`: about 1,100 method pairs for `rendering.js` and `player.js`.
  - `renderer-cache-toplevel.tsv`: 609 top-level functions and arrow constants of `rendering.js` with a candidate upstream symbol.
- **Scripts** are in `scratchpad\rc\` and are all read-only:
  - `map.mjs` matches classes and aligns their methods.
  - `fnmap.mjs` matches top-level functions by TF-IDF over literals, property names and calls.
  - `constdiff.mjs` compares the numeric and string literals of each aligned pair of methods.
  - `seams.mjs` lists the base-scene members our module presentations use.
  - Their raw outputs are `align.txt`, `constdiff.txt`, `seams.tsv`, `regions.txt` and `comments.tsv`.

## 1. Summary verdict

- **Same lineage, near-identical vintage.** Our beta bundles were scraped on 2026-11-20 and upstream was released on 2026-11-24. The classes of `rendering.js` line up with upstream 1:1, in the same order, and so do the methods inside them.
  - SceneCompositor: 124 members. Every one aligns to `src/render/scene/SceneCompositor.ts`, apart from 5 that are ours or misaligned.
  - NpcInstanceManager: 76 members, all aligned to `src/render/npc/NpcInstanceManager.ts`.
  - CacheManager in `player.js`: 55 members, all aligned to `src/cache/CacheManager.ts`.
  - The minifier kept the declaration order. So positional alignment between same-name anchors, checked by arity, is reliable. I spot-checked bodies, e.g. `setTerrainHeightsAndBounds` against `prepareCenterTerrain`, and `aM` / `getNpcRenderInstanceId` / `wH` against `npcRenderIdOf` / `actorRenderIdOf` / `renderNpcModels`. They are identical apart from names.
- **Upstream is the same code base, with few changes after the beta.** Where the code differs, it is almost always one of these:
  - our own edits: performance fixes, plugin hooks, presentation seams and new encounters;
  - the bundle's packaging: inlined constants, merged modules, and the string-array obfuscation still left in `player.js`.
  
  Upstream changes after the beta are rare. The likely ones are listed in section 3.
- **The renderer has no effect on determinism.** The simulation imports nothing from `rendering.js`. The one cache-side path that feeds the simulation is `CacheManager.buildArenaConfig`, which builds collision from the map. It is structurally the same as upstream `CacheManager.ts:1047`, plus our hook for Zebak's ground.
- **Cache format.** It is the same mirror format: `manifest.json` with `diskZipSha256`, `disk.zip` and `keys.json`, in the OpenRS2 disk layout.
  - We pin OpenRS2 cache **2762** (`tools/fetch-assets.mjs:43`). Upstream pins **2772** (`U/scripts/pinnedCache.ts:40`).
  - Upstream's `OpenRS2Client` only has the mirror mode. Ours still carries the `openrs2` mode.
- **Our biggest readability gap is the names.** About 570 top-level functions and 870 vars in `rendering.js` still have minified names of 1 to 3 letters, as do most class members. Upstream has a real name for each class and method. The class and method maps below cover about 95% of the class members mechanically.

## 2. Mapping tables

### 2.1 Region map of `rendering.js`

The full listing is `rc/regions.txt`. Each region was built from the class matches (score 10 or more) and the high or medium function matches.

| our lines | upstream |
|---|---|
| 118–2561 | `src/rs/io/ByteBuffer`, `src/rs/config/{Type,TypeLoader,seqtype}`, `src/rs/model/skeletal/*`, `src/rs/model/seq/*`, `src/render/backends/picogl/AnimationSystem` (`tg`) |
| 2747–4136 | `src/cache/networkRetry` (`ge` NetworkError, `gg` UnsupportedBrowserError, `mg` toNetworkError, `ug` fetchJson, `vg` retryTransient), `src/rs/compression/Bzip2`, `src/rs/cache/*` (`Bg` Archive, `Pg` Container, `Eg` ArchiveReference, `Ng` ReferenceTable, `Gg/Ug/Og/Kg` CacheIndex family, `qg` Sector, `Jg` MemoryStore, `Qg` CacheSystem), `src/rs/crypto/Xtea` (`Rg`) |
| 4137–4235 | `src/rs/collision/WalkabilityAnalyzer` (`em`, `rm`), `src/core/pathfinder.canMoveInDirection` (`im`) |
| 4593–9229 | `src/rs/config/*`: `cm` EnumType, `hm` UnderlayType, `fm` OverlayType, `pm` IdentKit, `Im` LocType, `Rm` LocModelLoader, `Pm` NpcType, `Em` ObjType, `Gm` SpotAnimType. Each of the small `extends ud` classes between them is that type's ArchiveTypeLoader. `src/rs/model/ModelData` is `wm` (4932–7393; `Sm` is its base) and `Am` is IndexModelLoader |
| 9230–11170 | `src/rs/util/HeightCalc` (`$m`,`Vm`,`Zm`), `src/rs/map/MapLoader` (`Xm`), `mapSquareBlock` (`Qm`,`ah`), `src/rs/model/{NpcModelLoader (Ih), PlayerModelLoader (Rh), SpotAnimModelLoader (Fh)}`, `src/rs/sprite/{IndexedSprite (Eh), SpriteLoader (Gh)}`, `src/rs/util/ColorUtil`, `src/rs/texture/SpriteTextureLoader` (`Yh`) |
| 11500–13600 | UI helpers outside this area: `util/storage`, `mobileDetection`, `input/touchHold`, `imageCache` |
| 13590–17400 | `src/audio/EventAudioPlayer` (`KS`), `render/core/meshSource` (`QS`,`fe`), `FacePrioritySorter`, `splitMeshByAlpha`, `render/effects/{spotAnimMeshParts, SkeletalSpotAnimPoser (Qb), SpotAnimRenderer (gy 15178–16613)}`, `util/gpuDetection`, `render/core/{commands, renderer (ra), soupIndexing (Vy,Ky,qy,Zy)}` |
| 17391–20998 | `render/backends/picogl/{instanceAtlas, PicoTexture (az), TextureArrayManager (nz), PicoGLAssetManager (iz), PicoGLRenderer (ea 17977–20125)}`, `render/projections/Projection3D` (`Mz`) |
| 21000–32300 | UI outside this area: keybinds (`input/keyState`, `util/hotkey`, `hooks/keybindStore`), settings and menus. Also the **weapon animation table** `KL` (≈22750–31900) = `src/data/weaponAnimations.ts`, with `lD` = `toWeaponAnimationSet` |
| 32300–34700 | weapon and projectile visual tables, the Inferno setup menu helpers (`encounters/inferno/spawnLayout`), `audio/EventAudioPlayer` (`bx`), zuk audio rules, plugin option parsers (`types/pillarAdditions`, `types/tzhaarHpTracker`) |
| 34795–35810 | `render/backends/picogl/TerrainBuilder` (`kW`), `render/core/interpolation` (`AW` PlayerVisualTracker, `LW` NpcVisualTracker) |
| 35810–38270 | `render/effects/*`: `PW` OneShotSpotAnim, `VW` VoidFlareController, `ZW` YamaAttackController, `playerEffectDescriptors` (`SR`), replay indexes (`bR` ReplayCueStream, `wR` ReplayPrimaryIndex, `LR` ReplayDeferredPrimaryIndex, `DR` InfernoReplayIndex, `IR` ReplayActorHistory, `PR` ReplayEffectIndex), `jR` PlayerGraphicController, `sP` ProjectileFlight, `rP` ProjectileAim, `oP` ProjectileController, `dP` LocAnimated |
| 38282–40473 | `render/environment/*`: `locPlacement` (`MP`,`CP`), `locContour`, `locMeshBaker` (`WP`), `locRenderFilter`, `staticLocFinalizer`, `staticLocNormals`, `r_` LocRenderer. `render/graphics/SceneObjectRenderer` (`d_`) and `sceneObjectTypes` (`l_`) |
| 40473–45662 | `render/npc/{NpcAnimationController (A_), NpcFacingController (L_), NpcModelAdapter (R_), NpcInstanceManager}`, `render/overlay/UIOverlayRenderer` (`X_`), `render/player/PlayerAnimationController` (`Q_`), `render/scene/{GroundItemRenderer (rF), SceneSurfaceHeightResolver (hF), tileGridMesh}`, `PlayerModelAdapter` (`WF`, in SceneCompositor.ts) |
| 45663–49864 | `render/scene/SceneCompositor.ts` (the class) |
| 49865–50110 | **ours**: `mergeTileOverlayMeshes` (#62). Then `PF` = `buildTerrainUpload` |
| 50110–54500 | `render/scene/lobby/*`: `HE` LobbyArenaRenderer with all the lobby*.ts helpers inlined, `IE` LobbySceneCompositor, `CE` LobbySceneBuilder |
| 54498–57712 | `RE` SolHereditSceneObjectController, `EE` NpcProjectileFlights, `OE` ColosseumVisualController, **`iN` ColosseumSceneCompositor** (Sol Heredit), `mN` YamaSceneObjectController, `IN` FireballController, `jN` WaveController, **`qN` YamaSceneCompositor**, `ZN` YamaSceneBuilder, `aG` InfernoSceneObjectController, `cG` InfernoVisualController, **`InfernoScene` = InfernoSceneCompositor** |
| 57712–58000 | **ours**: plugin plumbing for Blindfold and Skybox, and how the presentations of the encounter modules are hooked in (`KV` list) |
| 58261–58700 | `render/preview/{bossPortraitPoser, bossPortraitView}`. `dK` = `createBossPortraitView`; our `widgetModelView` (58441) is **ours**, built from it |
| 58835–64179 | viewport and replay UI: `util/viewportBounds`, `projectionAdapter` (`fq`), `Canvas2DRenderer` (`uq`), `core/projection` (`Wq` TopDown, `Rq` Isometric), `replayPresentation` (`sZ`), `overheadTextContent` (`iZ`), `RenderViewport3D.createSceneRuntime` (`kZ`, 61251), `encounterRenderConfig.withDescriptorMapBlock` (`he`), `WorldState.toSimulationState` (`RZ`) |

### 2.2 The classes of `rendering.js` → upstream

Only the main ones are listed here; all 151 are in `renderer-cache-classes.tsv`.

**Confidence:** high means a score of 25 or more with a clear second-best gap, medium is 10–25, low is under 10.

| ours (line) | upstream file#class | conf |
|---|---|---|
| `rd` (118) | `src/rs/io/ByteBuffer.ts#ByteBuffer` (`jd` readByte, `Od` readUnsignedByte, `$d` readShort, `Vd` readUnsignedShort, …) | high |
| `fd`/`ud`/`vd` (313/343/387) | `src/rs/config/TypeLoader.ts#BaseTypeLoader/ArchiveTypeLoader/IndexTypeLoader` | high |
| `pd` (421) | `src/rs/config/Type.ts#Type` | high |
| `bd` (523), `Zh` (10943) | `seqtype/SeqType.ts#SeqType` (two copies in the bundle) | high/med |
| `wd`,`Ud`,`jd`,`eg`,`ag` | `rs/model/skeletal/{SkeletalBone, Curve, CurvePoint, SkeletalSeq, SkeletalSeqLoader}` | high |
| `tg` (2154) | `render/backends/picogl/AnimationSystem.ts#AnimationSystem` (20/27 same name) | high |
| `Bg`,`Pg`,`Ng`,`Gg`,`Ug`,`Og`,`Kg`,`qg`,`Jg`,`Qg` | `rs/cache/{Archive, Container, ReferenceTable, CacheIndex, CacheStoreIndex, CacheIndexDat, CacheIndexDat2, Sector, MemoryStore, CacheSystem}` | high/med |
| `Bzip2Decoder` (3182) | `rs/compression/Bzip2.ts#Bzip2` | med |
| `wm` (4932) | `rs/model/ModelData.ts#ModelData` (score 101) | high |
| `Im`,`Pm`,`Em`,`Gm`,`cm`,`hm`,`fm`,`pm` | `LocType, NpcType, ObjType, SpotAnimType, EnumType, UnderlayType, OverlayType, IdentKit` | high |
| `Rm` (8163) | `rs/config/loctype/LocModelLoader.ts` | high |
| `Xm` (9282) | `rs/map/MapLoader.ts` | med |
| `Ih`,`Rh`,`Fh` | `rs/model/{NpcModelLoader, PlayerModelLoader, SpotAnimModelLoader}` | high |
| `gy` (15178) | `render/effects/SpotAnimRenderer.ts` (score 123) | high |
| `ea` (17977) | `render/backends/picogl/PicoGLRenderer.ts#PicoGLRenderer` (score 240) | high |
| `iz`,`nz`,`az` | `PicoGLAssetManager`, `TextureArrayManager`, `PicoTexture` | high |
| `Mz` (20160) | `render/projections/Projection3D.ts` | high |
| `bx` (33379), `KS` (13590) | `audio/EventAudioPlayer.ts` (KS is probably `FrameSoundTracker`; check) | med |
| `kW` (34795) | `render/backends/picogl/TerrainBuilder.ts` | low (score 8, but the method shapes match) |
| `AW`,`LW` | `render/core/interpolation.ts#PlayerVisualTracker/NpcVisualTracker` | high |
| `VW`,`ZW`,`jR`,`oP`,`sP`,`IN`,`jN`,`cG`,`OE`,`EE` | `effects/controllers/{VoidFlare, YamaAttack, PlayerGraphic, Projectile}Controller`, `ProjectileFlight`, `Fireball/Wave/InfernoVisual/ColosseumVisual Controller`, `NpcProjectileFlights` | high |
| `r_` (39378) | `render/environment/LocRenderer.ts` | high |
| `d_` (39882) | `render/graphics/SceneObjectRenderer.ts` | high |
| `A_`,`L_`,`R_` | `render/npc/{NpcAnimationController, NpcFacingController, NpcModelAdapter}` | high |
| `NpcInstanceManager` (41170) | `render/npc/NpcInstanceManager.ts` | high |
| `X_` (43487) | `render/overlay/UIOverlayRenderer.ts`. Low below the class level: our methods diverge (section 3) | high (class) |
| `Q_` (44202) | `render/player/PlayerAnimationController.ts` | high |
| `rF`,`hF`,`WF` | `render/scene/{GroundItemRenderer, SceneSurfaceHeightResolver}`, `SceneCompositor.ts#PlayerModelAdapter` | high |
| `SceneCompositor` (45663) | `render/scene/SceneCompositor.ts#SceneCompositor` (score 325) | high |
| `HE`,`IE`,`CE` | `scene/lobby/{LobbyArenaRenderer, LobbySceneCompositor}`, `scene/lobbySceneBuilder#LobbySceneBuilder` | high |
| `iN` (55062) | `render/scene/ColosseumSceneCompositor.ts` (Sol Heredit; same constructor options `cullSolMeleeOutsideView` and `batchSolEffects`) | high |
| `qN`,`ZN` (55989/56517) | `render/scene/YamaSceneCompositor.ts`, `yamaSceneBuilder.ts#YamaSceneBuilder` | high |
| `InfernoScene` (57294) | `render/scene/InfernoSceneCompositor.ts` | high |
| `RE`,`mN`,`aG` | `encounters/solHeredit/SolHereditSceneObjectController`, `encounters/yamaP3/YamaSceneObjectController`, `encounters/inferno/sceneObjects#InfernoSceneObjectController` | high |
| `fq`,`uq`,`Wq`,`Rq` | `render/adapters/ProjectionAdapter`, `backends/canvas2d/Canvas2DRenderer`, `core/projection#TopDownProjection/IsometricProjection` | high |
| `dg` (2764), `Pq` (59723), `sd` (92), `Ig`, `_g` | no reliable match. `dg` is a cache-file-name helper, not the CacheManager | low |

### 2.3 `SceneCompositor`: every method

The scene subclasses (`iN`, `qN`, `IE`, `InfernoScene`, `ZebakScene`) override with the same letters, so this one table names their overrides too.

**Confidence:**
- **High** is a same-name match, or the same slot between same-name anchors with the same arity.
- **Gap rows** are high too: I checked their bodies or signatures by hand.

| ours | upstream (`SceneCompositor.ts` line) | note |
|---|---|---|
| `vD(e,a)` 45797 | `renderPrimaryNpcDeathSpotAnim` 498 | |
| `pD` 45869 | `loadPrimaryNpcDeathSpotAnim` 541 | |
| `kD` 45875 | `isPrimaryNpcDeathSpotAnimLoaded` 548 | |
| `SD` 45879 | `startNpcAnimationClock` 558 | |
| `bD` 45883 | `advanceNpcAnimationClock` 572 | |
| `fD` 45893 | `registerTransientReset` 590 | |
| `UA` 45899 | `resetTransientState` 600 | |
| `setEncounterRenderConfig` | same 606 | upstream confirms our name |
| `wD` 45909 | `setSceneObjectLocModelLoader` 612 | |
| `zD` 45913 | `setSceneObjectController` 617 | |
| `AD` 45916 | `getSceneObjectRenderer` 623 | |
| `loadTerrain` | same 627 | |
| `LD` 45931 | `buildTerrain` 652 | |
| `setSmoothTerrain`, `isTerrainLoaded`, `getTerrainHeights`, `loadNpc` | same | |
| `Bv` 46000 | `setAnimationSystem` 721 | |
| `isNpcLoaded`, `getAllNpcHitTestData`, `getAllGroundItemHitTestData`, `setGroundItemLoaderSource`, `loadNpcType`, `isNpcTypeLoaded` | same | |
| `CD` 46049 | `isNpcTypeLoadSettled` 780 | |
| `loadPlayer` | same 787 | see section 3: `standTurn` |
| `xD(e,a)` 46272 | `loadFrameBasedSeq(animSets, slot)` 929 | |
| `BD` 46288 | `loadFrameBasedSeqById` 946 | |
| `createFirstAvailableSequence` 46299 | **`loadFrameBasedSeqFromIds`** 953 | our "inferred" name is contradicted |
| `_D` 46308 | `flushPendingPlayerAttack` 961 | |
| `FD` 46321 | `getPlayerAnimationFrameState` 975 | |
| `getPrimaryAnimMovementBlock` | same 979 | |
| `ED` 46332 | `loadPlayerSeqType` 983 | |
| `getPlayingSequenceFrames` 46339 | **`collectActorFrameStates`** 996 | our "inferred" name is contradicted |
| `GD` 46370 | `getFrameSoundListenerPosition` 1037 | |
| `RD` 46373 | `applyPlayerAnimatedMesh` 1041 | stamps the upload counter (#76) |
| `isPlayerLoaded`, `loadSpotAnims`, `isSpotAnimsLoaded`, `getResidentMeshSources` | same | |
| `jD` 46412 | `loadPlayerGraphicSpotAnims` 1088 | |
| `$D` 46417 | `isPlayerGraphicSpotAnimsLoaded` 1095 | |
| `VD` 46423 | `onEncounterEvents` 1102 | hook |
| `KD` 46424 | `reconstructEncounterVisuals` 1104 | hook |
| `qD` 46425 | `restoreEncounterPrimaries` 1106 | hook |
| `ZD` 46428 | `restorePlayerPrimary` 1110 | |
| `YD` 46472 | `prepareReplaySpotAnim` 1139 | |
| `setEventAudioPlayer`, `syncNpcInstances` | same | confirmed |
| `aH` 46553 | `createActorVisualPositionResolver` 1219 | |
| `eH` 46556 | `getExtraNpcSnapshots` 1226 | hook |
| `tH` 46559 | `renderEncounterEffectsEarly` 1231 | hook |
| `nH` 46560 | `renderEncounterEffectsLate` 1239 | hook |
| `sH` 46561 | `renderEncounterDebugOverlays` 1250 | hook |
| `rH` 46562 | `renderEncounterNpc2D` 1259 | hook |
| `iH` 46563 | `updateEncounterNpcFacing` 1265 | hook |
| `lH` 46566 | `getEncounterAttackTriggers` 1269 | hook |
| `oH` 46569 | `renderEncounterAttackEffects` 1283 | hook |
| `UD` 46570 | `loadEncounterSpotAnims` 1294 | hook |
| `OD` 46576 | `isEncounterSpotAnimsLoaded` 1299 | hook |
| `HD` 46581 | `loadEncounterNpc` 1303 | hook |
| `dH` 46594 | `getPrimaryNpcDeathLoadConfig` 1315 | |
| `MD` 46609 | `isEncounterNpcLoaded` 1328 | |
| `gH` 46613 | `getEncounterNpcFacingAngle` 1333 | |
| `cH` 46616 | `getTerrainMapSquare` 1341 | |
| `mH` 46625 | `getGridBounds` 1356 | |
| `hH` 46628 | `getArenaWalkabilityChecker` 1360 | |
| `loadLocs` | same | |
| `fH` 46673 | `getLocRenderOptions` 1400 | |
| `isLocsLoaded`, `isIntroAnimationComplete`, `getIntroAnimationRemainingMs`, `resetIntroState` | same | |
| `uD` 46701 | `clearEncounterVisuals` 1437 | |
| `uH` 46726 | `clearSceneObjects` 1475 | |
| `vH` 46729 | `syncAndRenderSceneObjects` 1479 | |
| `dispose` | same | |
| `pH` 46797 | `getNpcVisualDeltaMs` 1560 | |
| `kH` 46813 | `getUnprocessedEvents` 1578 | |
| `SH` 46826 | `getUnplayedAudioEvents` 1594 | |
| `PD` 46839 | `buildPlayerMesh3D` 1610 | |
| `bH` 46911 | `createPlayerModelMatrix` 1679 | |
| `build`, `buildScene` | same | |
| `yH` 46988 | `isEncounterReplayPresentationReady` 1756 | |
| `EH` 47810 | `buildTerrainMesh3D` 2501 | |
| `setTerrainHeightsAndBounds` 47822 | **`prepareCenterTerrain`** 2525 | body identical; our name is contradicted |
| `DD` 47828 | `buildTerrainMeshes3D` 2532 | ours is longer: Skybox (#36) |
| `GH` 47993 | `getContextLocations` 2597 | |
| `UH` 48012 | `buildTerrainCommand` 2617 | |
| `AH` 48057 | `buildGridLines` 2649 | |
| `jH` 48124 | `getArenaBoundaryPairs` 2711 | |
| `LH` 48156 | `buildArenaBoundary` 2741 | |
| `OH` 48218 | `getTileSize` 2799 | |
| `BH` 48233 | `buildPlayer` 2811 | |
| `xH` 48355 | `getPlayerModelLift` 2960 | |
| `$H` 48359 | `createSphereMesh` 2965 | |
| `RH` 48399 | `buildTargetTile` 3021 | |
| `PH` 48428 | `buildHoveredTile` 3058 | |
| `static VH` 48460 | `static fillCornerGap` 3097 | |
| `KH` 48470 | `getTileOverlayBounds` 3119 | |
| `qH` 48480 | `createOutlineMesh3D` 3123 | |
| `ZH` 48564 | `createCornerOutlineMesh3D` 3236 | |
| `YH` 48641 | `hexToPackedHsl` 3397 | |
| `TH` 48680 | `buildPillarTileMarkers` 3451 | ours is batched (#62) |
| `drawAttackRangeOverlay` 48750 | — | **ours** (the Attack Ranges plugin) |
| `HH` 48814 | `buildTileMarkers` 3505 | ours is batched (#62) |
| `MH` 48915 | `buildLineMarkers` 3623 | |
| `JH` 49001 | `createJoinedEdgeCommands` 3700 | |
| `QH` 49111 | `createEdgeMesh3D` 3787 | |
| `IH` 49153 | `buildNpcHighlights` 3843 | |
| `CH` 49177 | `buildTzhaarHighlights` 3874 | |
| `eM` 49194 | `drawNpcHighlights` 3893 | |
| `zH` 49380 | `resolveHiddenNpcModels` 4076 | ours adds Blindfold (#36) |
| `aM` 49422 | `npcRenderIdOf` 4103 | |
| `getNpcRenderInstanceId` 49425 | **`actorRenderIdOf`** 4111 | our "inferred verb" name is contradicted |
| `wH` 49432 | `renderNpcModels` 4116 | |
| `_H` 49435 | `buildTileOutlines3D` 4120 | |
| `WH` 49579 | `buildNpcOverlayHeightsMap` 4286 | |
| `FH` 49590 | `buildNpcClickboxOverlay3D` 4296 | |
| `pushTileOverlayBatch` 49676 | — | **ours** (#62) |
| `XH` 49701 | `pushTileMesh3D` 4376 | |
| `DH` 49751 | `buildTileGrid3D` 4437 | |

**Fields.** Our constructor (45664–45796) creates the same fields as upstream's class body (322–471), in the same order and with the same names. Our field names are therefore already upstream's; upstream adds the TypeScript types.

**Constants and helpers referenced from the compositor:**
- `M_` = `PRIMARY_NPC_ACTOR_ID`
- `kF` = `markerWidthWorld`
- `Eb` = `getTerrainHeight`
- `hF` = `SceneSurfaceHeightResolver`
- `getArenaWalkableTiles` = `getWalkableTiles`
- `WalkableTileLookupCache` = `TileKeySetCache`
- `r_` = `LocRenderer`
- `rF` = `GroundItemRenderer`
- `gy` = `SpotAnimRenderer`
- `jR` = `PlayerGraphicController`
- `oP` = `ProjectileController`
- `Wh` = `DEFAULT_MALE_APPEARANCE`

### 2.4 The scene subclasses (methods of their own)

- **`InfernoScene` → `InfernoSceneCompositor.ts`:**
  - `WM` = `isReplayReconstructionSettled` (239)
  - `RM` = `presentedFromTick` (322)
  - `hM` = `setFrameSoundTracker` (confirmed)
- **`iN` → `ColosseumSceneCompositor.ts`:**
  - `uM` = `resolveGraphicActor` (282)
  - `vM` = `paintTiles` (324)
  - `pM` = `outlineTiles` (352)
- **`qN` → `YamaSceneCompositor.ts`:**

  | ours | upstream (line) |
  |---|---|
  | `DM` | `resolvePrimaryNpcCenter` (325) |
  | `MM` | `loadWaveSpotAnims` |
  | `HM` | `getPrimaryNpcRenderConfig` |
  | `BM` | `getEffectivePrimaryNpcRenderConfig` |
  | `CM` | `isWaveSpotAnimsLoaded` |
  | `TM` | `loadFireballSpotAnims` |
  | `IM` | `loadVoidFlareSpotAnims` |
  | `xM` | `loadAttackSpotAnims` |
  | `LM` | `buildYama` (413) |
  | `wM` | `buildDamageTileOverlays` |
  | `AM` | `buildFireballDangerTileOverlays` |

- **`IE` → `LobbySceneCompositor.ts`:**
  - `sM` = `setForcedTerrain` (48)
- **`OE` → `ColosseumVisualController`:**
  - `oM` = `removeActor`
  - `gM` = `takeAnimations`
  - `cM` = `syncReplay`
  - `mM` = `updateProjectiles`
  - `dM` = `createGraphic`
- **`cG` → `InfernoVisualController`:**
  - `kz` = `reconstruct`
  - `cM` = `syncReplay`
  - `gM` = `takeAnimations`
- **`IN` → `FireballController`:**
  - `Sz` = `clearActive`
  - `kM` = `buildFallingFireballs2D`
  - `SM` = `buildExplosionTiles`
  - `yM` = `buildFallingFireballs3D`
  - `bM` = `buildExplosionSpotAnims`
- **`jN` → `WaveController`:**
  - `zM` = `pushTileHighlight`
- **`EE` → `NpcProjectileFlights`:**
  - `iM` = `flightFrame`
  - `lM` = `targetCentre`

### 2.5 `NpcInstanceManager`

All rows are matched by position and arity, high confidence; the full list is in the TSV.

| ours | upstream | ours | upstream |
|---|---|---|---|
| `eA` | `setPrimaryNpcRenderConfig` | `removeInstance` | **`removePresentation`** |
| `kA` | `removePresentationsByNpcType` | `SA` | `reconstructDyingInstance` |
| `setInstancePositionAndFacing` | **`setInstanceFacingAngle`** | `wA` | `updatePrimaryNpcVisualFacing` |
| `LA` | `updateNpcVisualFacing` | `AA` | `advanceInstanceFacing` |
| `HA` | `resolveFacingTarget` | `MA` | `resolveActorCenter` |
| `IA` | `resolveInstanceCenter` | `DA` | `resolveInstanceRenderPlacement` |
| `xA` | `getPrimaryNpcSmoothedFacingAngle` | `pA` | `clearPrimarySmoothedFacingIfPrimary` |
| `Cv` | `setSorterProjection` | `WA` | `updateTransparentSort` |
| `PA` | `updateAnimations` | `FA` | `restoreReplayPrimary` |
| `NA` | `restoreDeferredReplayAnimation` | `fA` | `settleSpawnClip` |
| `EA` | `sampleSpawnPrimary` | `_A` | `applyAttackTrigger` |
| `GA` | `resetAttackTriggerState` | `UA` | `resetTransientState` |
| `jA` | `renderAll` | `OA` | `getHitTestData` |
| `$A` | `getAllHitTestData` | `Gg` | `getModelMatrix` |
| `VA` | `getVisualPosition` | `KA`/`qA`/`ZA`/`YA` | `getNpcType{ModelData,ModelBounds,FaceSplitMap,OverlayHeights}` |
| `XA` | `getNpcOverlayHeights` | `JA`/`QA` | `get/setNpcTypeSplitBuffers` |
| `eL` | `getPrimaryNpcMeshCommands` | `aL` | `getDyingActorIds` |
| `tL` | `getInstanceFrameStates` | `nL` | `getMaximumLoadedDeathDurationMs` |
| `mA` | `markDyingActorIdsCacheDirty` | `sL` | `resolveDeath` |
| `uA` | `holdsDeathUntilRemoved` | `bA` | `getDeathDurationMs` |
| `cA` | `enterDyingState` | `rL` | `createDyingAnimController` |
| `iA` | `computeModelMatrixInto` | `yA` | `refreshAnimationHeightOffset` |
| `hA` | `createInstance` | `oA` | `isAnimationSetAlphaAnimated` |
| `iL` | `applySplitBuffersToCommands` | `lL` | `resolveTransparentFaceMap` |
| `sA` | `applyUpdatedMeshToInstance` | `oL` | `ensureSplitBuffersCapacity` |
| `lA` | `buildNpcMesh3D` | `rA` | `getInitialModelPlacement` |
| `dA` | `isPrimaryNpcType` | `aA` | `computeModelBounds` |
| `gA` | `seedSplitBuffers` | `nA` | `buildAnimatedMesh` |
| `tA` | `loadAnimationSet` | `gL`/`cL`/`dL` | `loadAttackClips`/`loadLifecycleClips`/`loadAnimClip` |
| `BA` | `markAllTransparentSortDirty` | `RA` | `sortTransparentForInstance` |

Two top-level helpers belong to the same upstream file: `T_` = `deathClipDurationsMs` and `P_` = `sameAnimationTrigger`.

### 2.6 `player.js` (the cache loader)

**`CacheDatabase` → `src/cache/CacheStorage.ts#CacheStorage`**, all high:

| ours | upstream |
|---|---|
| `eC` | `requestPersistentStorage` |
| `tC` | `storeCacheFile` |
| `vm` | `getCacheFile` |
| `aC` | `getCacheFilesParallel` |
| `Sm` | `hasCacheFile` |
| `sC` | `storeCacheMeta` |
| `iC` | `getCacheMeta` |
| `rC` | `storeParsed` |
| `nC` | `getParsed` |
| `oC` | `deleteCacheMeta` |
| `cC` | `deleteCache` |
| `hC` | `deleteOlderCaches` |

**`CacheDownloadClient` → `src/cache/OpenRS2Client.ts#OpenRS2Client`**, partly. Ours still has two modes (`mirror` and `openrs2`) and the obfuscator's proxy objects.

| ours | upstream |
|---|---|
| `dC` | `getDiskZipUrl` |
| `uC` | cache list or `getManifest` |
| `fC` | `downloadCache` |
| `yC` | `fetchDiskZip` |
| `wC` | `downloadKeys` |
| `lC` | `getMode` (gone upstream) |

`wrapErrorWithContext` = `withContext`. `matchesSha256` and `hasRequiredCacheFiles` have the same names upstream.

**`CacheManager` → `src/cache/CacheManager.ts#CacheManager`**, all high:

| ours | upstream | ours | upstream |
|---|---|---|---|
| `Ad` | `ensureCache` | `fC` | `downloadCache` |
| `mC` | `readStoredMeta` | `EC` | `storeFiles` |
| `LC` | `storeMeta` | `AC` | `pruneOlderCaches` |
| `bC` | `extractZip` | `DC` | `isCacheFile` |
| `MC` | `initializeCacheSystem` | `ud` | `loadMapLocs` |
| `vC` | `loadXteaKeys` | `XC` | `fetchAndCacheXteaKeys` |
| `OC` | `parseXteaKeysArray` | `xC` | `getXteaKey` |
| `kC` | `logYamaArenaContents` | `$C` | `readStoredFiles` |
| `hd` | `getMapLoader` | `pd` | `getSoundEffectIndex` |
| `gd` | `getUnderlayLoader` | `kd` | `getOverlayLoader` |
| `IC` | `getTextureLoader` | `PC` | `getMinimapNpcDotUrl` |
| `NC` | `getLocTypeLoader` | `_C` | `getNpcTypeLoader` |
| `wd` | `getSpotAnimTypeLoader` | `yd` | `getLocModelLoader` |
| `xd` | `getNpcModelLoader` | `bd` | `getPlayerModelLoader` |
| `vd` | `getSpotAnimModelLoader` | `zC` | `getAnimationSystem` |
| `rM` | `loadAdditionalMapSquare` | `RC` | `getAdditionalMapSquareData` |
| `KC` | `getEnumTypeLoader` | `BC` | `getStructTypeLoader` |
| `SC` | `loadLocationsWithTypes` | `FC` | `loadNpcSpawnsWithTypes` |
| `YC` | `getLocCollisionLoader` | `ld` | `buildArenaConfig` |
| `TC` | `analyzeArenaBounds` | `nC` | `getParsed` |
| `UC` | `setParsed` | `iC` | `getCacheMeta` |
| `cC` | `deleteCache` | `pC` | `setLoadingProgress` |
| `jC` | `notifyListeners` | `CC` | `waitForState` |

Other bindings in `player.js`:
- `toLocPlacement` ≈ `core/arena/collisionSpec.ts#toCollisionLocInput` (high).
- `REQUIRED_CACHE_INDEXES` and `defaultPlayerModelConfig` have the same names upstream.

### 2.7 Audio

| ours | upstream | relation |
|---|---|---|
| `client/audio/soundEffects.js` (449 lines; our own port of the Java client synthesizer, with integer and fround arithmetic, 8-bit PCM and RuneLite names) | `src/audio/synth/{patch.ts, render.ts}` (Float64, with `decodeSoundPatch`/`renderPatch`/`renderSoundEffect`) | **independent implementations** of the same format. Upstream's own doc says subtle filter and envelope differences from the native client remain (`docs/architecture/audio.md:75`) |
| `client/audio/soundEffectsWorker.js` + worker pool (#66) | `src/audio/cacheSoundBuffers.ts` (renders in time slices of `RENDER_SLICE_MS=8` on the main thread) | different scheduling |
| `bx` (rendering.js 33379), `KS` (13590) | `src/audio/EventAudioPlayer.ts`, `FrameSoundTracker.ts` | same lineage. Our `bx.Sy` = `onEvents` |

## 3. Behavioural divergences

**Determinism.** None of these touch the simulation, unless noted.

**The origin column** uses three labels:
- **OURS-FIX/FEAT** is a deliberate OpenScim change, with its commit.
- **OURS-7ea8730** is a hand edit inside the root commit "OpenScim". That commit squashes the whole reconstruction, so git cannot separate these edits from the bundle. The `//` comments mark them, because the bundle had no comments; see `rc/comments.tsv`.
- **UPSTREAM** is a change upstream made after the beta.

| # | what differs | ours | upstream | origin | impact |
|---|---|---|---|---|---|
| 1 | **Version 3 models' face bias.** Ours reads the optional per-face bias and its trailer correctly; all 35,846 version 3 models decode exactly. Upstream reads no bias and documents that as a "known limitation". | `rendering.js:5624-5633` (`wm` decode), `test/test-model-v3.mjs` | `ModelData.ts:973-976` (comment), `docs/architecture/rendering.md` | **OURS-FIX 7af0d1b (#46)**. The beta's read was buggy (Buffer overflow on Darkwood trees); upstream removed the read instead | render-only. Ours is more correct. Keep it |
| 2 | **Mesh VAO eviction.** Ours evicts a mesh only after it is unused for 120 frames *and* 10 s. Upstream evicts after 120 frames. | `rendering.js:18004-18008`, ~18615 (`ea`) | `PicoGLRenderer.ts:587-588,1111-1117` | **OURS-FIX 77147e7 (#63)**. Upstream lacks it | performance (fewer buffer rebuilds) |
| 3 | **Animated mesh upload stamps, and the spot anim visibility cache.** Producers stamp the commands they write; the renderer skips the element-wise compare for unchanged stamps; per-part visibility is cached in a WeakMap. | `rendering.js:17797-17810`, `gy.cachedVisibility`/`storeVisibility` (15208, 16436) | not present (no stamp, shadow or visibility cache in `src/render`) | **OURS-FIX c6ca8a7 (#76)** | performance (about 7% of the main thread on Yama) |
| 4 | **Tile overlays as one mesh per overlay.** `pushTileOverlayBatch`, `mergeTileOverlayMeshes`; pillars, markers, attack ranges and Sol's tiles are batched. | `rendering.js:49670-49700`, `49865-49937`, `55320` | `pushTileMesh3D` per tile (`SceneCompositor.ts:4376`) | **OURS-FIX e18a5a3 (#62)** | 520–780 fewer draw calls a frame; pixels unchanged |
| 5 | **`manifest.json`/`keys.json` are fetched with `cache:"no-cache"`.** | `rendering.js:2945-2951` (`ug`) | `networkRetry.ts:142` `fetchJson` with no cache option; `OpenRS2Client.getManifest` says "HTTP caching is all the caching it needs" | **OURS-FIX a0973bb (#58)** | fixes black screens after a deploy. Upstream relies on its own hosting headers |
| 6 | **Idle turn animation.** The player's `idleTurnLeft`/`idleTurnRight` use the weapon table's `standTurn` in ours and `turn180` upstream. They differ for 119 of 476 weapons, e.g. staff 772: ours 823 (the unarmed idle turn), upstream 1209 (the weapon's own turn). | `rendering.js` `loadPlayer` (`idleTurnLeft: this.xD(o,"standTurn")`); table `KL` ≈22750 | `SceneCompositor.ts:843-845,862-864`; `src/data/weaponAnimations.ts` (no `standTurn` field) | probably **UPSTREAM** changed it after the beta: the generated table in the bundle had the field, and nothing of ours names it. It could also be a reconstruction error | render-only. **Upstream looks right** (OSRS weapons have their own turn animation). Take upstream's `turn180` for the idle turns |
| 7 | **Cache download client.** Ours has two modes (`mirror` and `openrs2`, with a cache list in sessionStorage). Upstream has the mirror only, plus `retryTransient` and a single re-download from a cache-busting URL when the sha256 does not match. | `player.js:388-623` | `OpenRS2Client.ts:109-194` | **UPSTREAM** newer (retry on mismatch); our extra mode is beta residue | robustness. Port the re-download and keep our `no-cache` |
| 8 | **Pinned game cache:** OpenRS2 **2762** (ours) vs **2772** (upstream). | `tools/fetch-assets.mjs:43` | `scripts/pinnedCache.ts:40` | **UPSTREAM** newer cache | data (models, seq ids). Collision could differ if the maps changed, which would affect determinism through `buildArenaConfig`; verify with our determinism digests before bumping |
| 9 | **`UIOverlayRenderer` (`X_`).** Our overhead layer has its own structure: `playerOverheadBase`, `playerBarAnchor`, `npcOverheadsAndBars`, `npcDefenceTexts` (Defence Tracker), the Doom's NPC overhead prayers and charge bar, Interface Styles bars, and overlay sizing by the interface scale. Upstream split it differently: `buildPrayerOverheads`, `buildHitsplats`, `buildHealthBar`, `assignHitsplatSlot`, `buildNpcHealthBars`, `npcBarAnchor`, `hasDespawnTimer`… | `rendering.js:43487-44167`, `16980-17090` (Interface Styles, RuneLite stretched mode), `overlayCamera` | `src/render/overlay/UIOverlayRenderer.ts` (807 lines) | mostly **OURS**: 39669b4 (#3), e6f2213 (#72), 0419d3e (#22), plus OURS-7ea8730. Partly **UPSTREAM** refactor (`hasDespawnTimer`, `npcDespawnTimer.ts`) | render-only. Do not replace this class |
| 10 | **Sound synthesis.** Ours is the Java-faithful integer and fround port, in workers. Upstream is a Float64 approximation, in time slices on the main thread. | `client/audio/soundEffects.js` | `src/audio/synth/render.ts` | ours is **OURS** (7ea8730, e763239 #66) | audio output differs slightly; ours is likely closer to the game. Keep ours |
| 11 | **Arena collision build.** Ours adds Zebak's effective ground (`/toa/zebak/ground.js`) and installs Zebak's room groups at cache init (`/toa/zebak/native-cache.js`); otherwise it is the same algorithm. | `player.js:1016-1021,1709` | `CacheManager.ts:1047-1146` | **OURS** (a3611ae #60 / 7ea8730 Zebak) | **determinism-relevant**, but only for Zebak |
| 12 | **`Em.isWearable`** vs `ObjType.isEquippable`, and other naming-only differences. | | | our names | none |
| 13 | **Player stances.** The render config `playerStances` and state `playerStance` add other stances to `loadPlayer` and `Q_`; ours also handles the player animations `player_special_animation` and `player_jug_action` in `buildScene`. | `rendering.js:44254, 46116`, `buildScene` | absent | **OURS** (Zebak, Vardorvis) | render-only |
| 14 | **The Yama and Sol scenes animate other NPCs** (colosseum_visual animations, projectiles and graphics of the sandbox's monsters). | `rendering.js:55144, 55992-56298` | absent | **OURS 8c0af2f (#2, sandbox)** | render-only |
| 15 | **Skybox, Blindfold and Projectile Override hooks.** | `rendering.js:46996, 47280, 37627-37755, 57729` | absent | **OURS 4ac2664 (#36), b2ca7d4 (#30)** | render-only |
| 16 | **`widgetModelView`** (an interface model drawn the way the game does, e.g. Vardorvis' strangle) and the overlay canvas in `ea`. | `rendering.js:58397-58545`, `18116` | `render/preview/bossPortraitView.ts` is its origin (`dK` = `createBossPortraitView`) | **OURS 7ec5955 (#32), 8c4bf6b (#27)** | render-only |
| 17 | **Other hand edits:** the frame-rate cap at 63160–63180; the item icon fallback at 33148; ZCB's Evoke bolt, Magic Dart and Vardorvis' bleed hitsplat (32297, 34318, 60086); the facing of Inferno NPC graphics (57222-57236, 57694); the NPC health bar width set by the render config (41332); the release pose on the projectile clock (40881). | as cited | absent | **OURS-7ea8730** | render-only |

I found no upstream behavioural changes beyond rows 1, 6, 7 and 8, and a few small upstream-only methods:
- `SpotAnimRenderer.sharedBakedEntry`, which shares baked meshes across renderers;
- `PicoGLRenderer.createProgramEntry`, `instancedProgramEntry` and `buildPrograms`, which refactor the shader programs (our `instancedProgram` field does the same);
- `StreamingSoupIndexer.distinct` and `uploadIndices`.

Most `constdiff.txt` hits are packaging differences: upstream names its constants (`TICK_MS` is our `600`, `CLIENT_CYCLE_MS` is our `20`), and the bundle inlined them.

## 4. Pieces that exist on one side only

**Ours only** (keep them; in `rendering.js` unless noted):
- the presentation seam:
  - the `KV` list, extended from `client/encounters/presentations.js`;
  - `presentationBuilders(BaseScene, packHsl, tools)`;
  - `shared/buildScene.js`;
- the Attack Ranges overlay (`drawAttackRangeOverlay`, `test/test-attack-ranges.mjs`);
- tile overlay batching;
- upload stamps and the visibility cache;
- the 10 s eviction;
- the face-bias decode;
- `no-cache` for the manifest;
- `widgetModelView`;
- the Skybox, Blindfold, Projectile Override and Defence Tracker hooks;
- the Doom's overhead charge bar;
- Interface Styles health bars;
- overlays sized by the interface scale;
- player stances;
- Zebak's ground and cache groups (`player.js`);
- the other NPCs of the sandbox in the Yama and Sol scenes;
- the lobby's gateways and encounter book (715be9b);
- the frame-rate cap;
- the Java-faithful audio synth with its workers;
- tests: `test-model-v3`, `test-cache-manifest`, `test-projectile-override-scene`, `test-attack-ranges`, `test-trimmed-cache`, `test-sound-synth`, `test-cache-groups`.

**Upstream only:**
- TypeScript types and JSDoc on every class;
- vitest suites per module (e.g. `PicoGLRenderer.drawState.golden.json`, `SceneCompositor.authoritativeWalkability.test.ts`, `FacePrioritySorter` with a reference sorter);
- `docs/architecture/{rendering, scene-objects, audio, audio-synth, projectile-motion}.md`;
- the scripts `scripts/{setup, pinnedCache, gzipCacheContainers, check-trimmed-cache}.ts`;
- `SceneBuilderRegistry` in `sceneBuilderFactory.ts`, with `ENCOUNTER_PRESENTATION_MODULES` in `encounters/presentationModules.ts`. These are the typed counterparts of our `KV` and `presentationBuilders`, with the same entry shape `{kind, sceneBuilder, renderConfig, audio, defaultCamera, presentation}`;
- the scene builders `createZukSceneBuilder` and `createSolHereditSceneBuilder` as small functions of their own;
- the lobby scene split into 14 modules (`scene/lobby/*`); in ours it is the single class `HE` (50904–54029);
- a retry with re-download in `OpenRS2Client`;
- cache 2772.

## 5. Readability wins

These are ordered by the value they give for the effort.

1. **Apply the SceneCompositor map (2.3) as member renames.** That is 89 lettered methods, and the override in every subclass follows automatically. It uses our existing `tools/rename-members.mjs` with a new `scene-members` block, recording "evidence: upstream SceneCompositor.ts:<line>". This is the single biggest readability gain, and nothing changes at runtime. Effort S.
2. **Apply the NpcInstanceManager (2.5), scene subclass (2.4) and controller maps the same way.** That is about 200 more methods. Effort S.
3. **Rename the classes in `rendering.js` per 2.2, using upstream's names.** Examples: `ea` → `PicoGLRenderer`, `gy` → `SpotAnimRenderer`, `wm` → `ModelData`, `rd` → `ByteBuffer`, `iN` → `ColosseumSceneCompositor`, `qN` → `YamaSceneCompositor`, `InfernoScene` → `InfernoSceneCompositor`, `IE` → `LobbySceneCompositor`, `X_` → `UIOverlayRenderer`, `Q_` → `PlayerAnimationController`, `A_` → `NpcAnimationController`, and the `rs/cache` family. Effort S/M, because each binding needs a pass of `rename-bindings.mjs`.
4. **Rename the members of the `player.js` CacheManager and CacheStorage per 2.6, and fold away the obfuscator's proxy objects.** Effort M, because of the string-array and proxy de-obfuscation. Alternatively, port upstream `CacheManager.ts` and `CacheStorage.ts` (section 6).
5. **Copy the doc comments of the hooks into the base scene.** Upstream's comments on `renderEncounterEffectsEarly`/`Late`, `restoreEncounterPrimaries`, `actorRenderIdOf` and the others explain the contract our module scenes rely on. Effort S.
6. **Rename the top-level functions per `renderer-cache-toplevel.tsv`.** Apply only the rows marked high and not "dup" (about 105): `PF` → `buildTerrainUpload`, `sZ` → `getReplayPresentation`, `SR` → `describePlayerEffects`, `BR` → `describePlayerPrimaries`, `i_` → `stageStaticLocModels`, `MP` → `resolveLocPlacement`, `CP` → `buildLocModelMatrix`, `WP` → `bakeLocFrameGeometry`, `rz` → `detectWebGL2Features`, `Iy` → `resetQueue`, `FI` → `parseInfernoSetupParams`, and so on. Treat medium and low rows as candidates to check by hand: the matcher gave the same target to several bindings (e.g. `createTransparentSort` three times). Effort M.

**Where upstream contradicts our names in `tools/names`:**
- **"inferred" names** in `scene-members.json`:
  - `createFirstAvailableSequence` → `loadFrameBasedSeqFromIds`
  - `getPlayingSequenceFrames` → `collectActorFrameStates`
  - `getNpcRenderInstanceId` → `actorRenderIdOf`
  - `NpcInstanceManager.setInstancePositionAndFacing` → `setInstanceFacingAngle`
- **"evidence" names** in `scene-members.json`. They are not wrong, but upstream's names differ:
  - `setTerrainHeightsAndBounds` → `prepareCenterTerrain`
  - `NpcInstanceManager.removeInstance` → `removePresentation`
- **Class and binding names:**
  - `CacheDatabase` → `CacheStorage`
  - `CacheDownloadClient` → `OpenRS2Client`
  - `Bzip2Decoder` → `Bzip2`
  - `WalkableTileLookupCache` → `TileKeySetCache`
  - `getArenaWalkableTiles` → `getWalkableTiles`
  - `wrapErrorWithContext` → `withContext`
  - `Em.isWearable` → `isEquippable`
  - `InfernoScene` → `InfernoSceneCompositor`
- **Names upstream confirms:**
  - `setEncounterRenderConfig`, `setEventAudioPlayer`, `setGroundItemLoaderSource`, `syncNpcInstances`, `setFrameSoundTracker`;
  - `NpcInstanceManager.loadNpcType` and `syncInstances`;
  - `matchesSha256`, `hasRequiredCacheFiles`, `REQUIRED_CACHE_INDEXES`;
  - `SceneCompositor`, `NpcInstanceManager`, `isAppleTouchDevice`.
- **Renames that touch our module presentations.** These use six of the contradicted names: `getNpcRenderInstanceId`, `setTerrainHeightsAndBounds`, `getPlayingSequenceFrames` and `npcInstanceManager.removeInstance`, plus `syncNpcInstances` and `setEncounterRenderConfig`, which stay as they are. Rename them together with `client/encounters/*/presentation.js`, `toa/nexus.js` and `toa/zebak/native.js` (see `rc/seams.tsv`).

## 6. Recommendation per component

**Could `rendering.js` be replaced wholesale by upstream `src/render` + `src/rs` + `src/cache`?** Technically the classes are the same code, and Vite compiles TypeScript, so it is possible in principle. I recommend against it.

1. **The chunk is more than the renderer.** `rendering.js` also holds UI that belongs to other areas: keybinds, settings, menus, the Inferno setup, the weapon animation and projectile tables, and the viewport (`createSceneRuntime`). It also exports minified bindings that `Grid.js` and `application.js` import. Cutting the renderer out means rewiring those imports. That is effort L by itself.
2. **Upstream lacks about 25 of our changes.** It has no equivalent for rows 1–5 and 9–17 of section 3: the five performance and correctness fixes, and every plugin, encounter and presentation hook. Re-applying them by hand to TypeScript is effort L, and the risk is high, because the performance fixes have no pixel tests here.
3. **Upstream imports TypeScript modules (`src/core`, `src/types`, `src/npcs`) that our engine reimplements in plain JS.** Adopting `src/render` would drag in or duplicate the types and helpers of the simulation snapshot.

**What our module presentations would need, if we adopted upstream's scene classes anyway.** They use 16 members of the base scene, listed in `rc/seams.tsv`:
- `build`, `dispose`, `setEncounterRenderConfig`, `setEventAudioPlayer`, `setGroundItemLoaderSource`, `setFrameSoundTracker`;
- `loadNpcType`, `isNpcTypeLoaded`, `loadLocs`, `syncNpcInstances`;
- `getNpcRenderInstanceId` → `actorRenderIdOf`;
- `setTerrainHeightsAndBounds` → `prepareCenterTerrain`, which is *private* upstream: Leviathan and Zebak override it, so it would have to be made protected;
- `getPlayingSequenceFrames` → `collectActorFrameStates`;
- the fields `npcInstanceManager` (protected upstream), `primaryCycle`, `terrainHeights` (protected) and `npcInstanceManager.instanceRegistry` (**private** upstream: Hydra, Araxxor, Duke and Zebak read it);
- `npcInstanceManager.removeInstance` → `removePresentation`;
- our `weaponVisuals` render config hook (#52).

The function-injection seam (`presentationBuilders(BaseScene, packHsl, tools)`) could then become plain imports. Upstream's `ENCOUNTER_PRESENTATION_MODULES` has the same entry shape as ours, so converting our presentations is small. Effort S/M per encounter, once the base classes are importable.

**Per component.** "Rename" means renaming ours from upstream's names; "port" means porting a piece of upstream code into ours.

| component | recommendation | effort | risk | our commits that must survive / would be lost if replaced | upstream has an equivalent? |
|---|---|---|---|---|---|
| SceneCompositor + scene subclasses (`iN`,`qN`,`IE`,`InfernoScene`) | **Rename** (2.3/2.4), and copy the comments on the hooks | S | low | e18a5a3, 4ac2664, 8c0af2f, 002db25, a3611ae, 0419d3e, 715be9b, plus the 7ea8730 hooks | none of them |
| NpcInstanceManager, NpcAnimationController, PlayerAnimationController, controllers, replay indexes | **Rename** | S | low | c6ca8a7 (stamps in `iL`, `RA`), the health bar width from 7ea8730 | no |
| PicoGLRenderer (`ea`), AssetManager, PicoTexture, soup indexing | **Rename**; later, optionally port `createProgramEntry`/`buildPrograms` | S (rename), M (port) | low/med | 77147e7 (#63), c6ca8a7 (#76), widgetModelView's overlay canvas (7ec5955) | no |
| SpotAnimRenderer (`gy`) | **Rename**; port `sharedBakedEntry` if memory matters | S | low | c6ca8a7 (visibility cache), b2ca7d4 (override loading) | no |
| UIOverlayRenderer (`X_`), overheads, Interface Styles | **Keep ours**; rename only the methods with same-name anchors | S | low | 39669b4 (#3), e6f2213 (#72), 0419d3e (#22), 7ea8730 Interface Styles and stretched mode | no: upstream's design differs |
| `rs/*` cache and model decoders (`rd`, `Bg`…`Qg`, `wm`, the config types, the model loaders) | **Rename** from upstream. A one-to-one swap for upstream `src/rs` would be possible, but `wm` must keep the face-bias fix | M (rename); M/L to replace | med | 7af0d1b (#46), which upstream does not have (it drops the bias) | no |
| Weapon animation table `KL` | **Port the `turn180` idle-turn choice** (divergence 6), or regenerate from upstream `src/data/weaponAnimations.ts` | S | low (visual only) | our tables were not edited after the reconstruction, apart from 002db25 (weaponVisuals is a separate hook) | yes: this is the upstream fix |
| `player.js`: CacheStorage and CacheManager | **Rename or de-obfuscate in place**, or replace with upstream `CacheManager.ts`/`CacheStorage.ts` while re-applying the Zebak hooks (`player.js:1016-1021,1709`) | M | med (collision from the map affects determinism: run `test-determinism` and the digests) | 8c0af2f (sandbox arenas, through `buildArenaConfig` options), the Zebak hooks (a3611ae) | the Zebak hooks: no |
| `player.js`: CacheDownloadClient | **Port upstream `OpenRS2Client`** (mirror only, retryTransient, re-download on a sha256 mismatch) and keep `cache:"no-cache"` | S | low | a0973bb (#58) has to be re-applied to upstream's `fetchJson`/`getManifest` | no |
| `tools/fetch-assets.mjs`, cache version | **Keep** our trimming and groups. Consider moving to cache 2772 only after the determinism digests pass | S/M | med | 1ab3ba5 (#24), ddb08aa (#41), 8c0af2f | upstream has its own setup scripts |
| `client/audio/` synth | **Keep ours** (more faithful, and in workers). Use upstream's `docs/architecture/audio-synth.md` as documentation | – | – | e763239 (#66) | upstream's synth is an approximation |
| Presentation seam (`KV` + `encounters/presentations.js`) | **Keep**; rename `KV` → `ENCOUNTER_PRESENTATION_MODULES` and its builder registry → `SceneBuilderRegistry` | S | low | 002db25, 7ec5955, 8c4bf6b, all the encounter PRs | upstream has the same shape, without the class injection |

## 7. Our progress to preserve

These are the OpenScim commits after the reconstruction that touch this area. `git log` was run on `client/assets/rendering.js`, `player.js`, `client/audio`, `tools/fetch-assets.mjs`. Any port or replacement must carry all of them.

| commit | what | where | upstream equivalent |
|---|---|---|---|
| c6ca8a7 (#76) | animated mesh upload stamps (`iL`, `RA`, `RD`), and the spot anim visibility kept across frames | `rendering.js:17797`, `gy` 15208/16436, NpcInstanceManager, SceneCompositor `RD` | none |
| 77147e7 (#63) | VAO eviction after 120 frames **and** 10 s | `ea` 18004, ~18615 | none (120 frames only) |
| e18a5a3 (#62) | tile overlays as one mesh (`pushTileOverlayBatch`, `mergeTileOverlayMeshes`) | SceneCompositor 48705/48756/48851/49670, 49865; `iN` 55320 | none |
| 7af0d1b (#46) | the face bias of version 3 models, plus `test/test-model-v3.mjs` | `wm` 5624 | none (upstream skips the bias) |
| a0973bb (#58) | `no-cache` on manifest and keys, plus `test/test-cache-manifest.mjs` | `ug` 2945 | none |
| 002db25 (#52) | `weaponVisuals` that a presentation may supply | `rendering.js:32276` | none |
| 7ec5955 (#32), 8c4bf6b (#27) | `widgetModelView`, the strangle overlay canvas under the interface | 58397–58545, `ea` 18116 | partly (bossPortraitView, from which it was built) |
| 4ac2664 (#36) | the Blindfold and Skybox plugins | SceneCompositor 46996/47280, `DD`, 57729 | none |
| b2ca7d4 (#30) | Projectile Override, plus `test-projectile-override-scene` | `sP` 37627/37750 | none |
| 0419d3e (#22) | the Doom: NPC overhead prayers and charge bar | `X_` 43987 | none |
| e6f2213 (#72) | the Defence Tracker overlay texts, plus `test-defence-tracker` | `X_` 44027–44070, 60058 | none |
| a3611ae (#60) | Zebak: player stances, `player_jug_action`, cache groups and ground in `player.js` | 44254, 46116, `buildScene`; `player.js` 1016/1709 | none |
| 8c0af2f (#2) | the sandbox: other NPCs in the Sol and Yama scenes, arena options, fetch-assets | 55144, 55992–56298; `tools/fetch-assets.mjs` | none |
| 39669b4 (#3) | overlays sized by the interface's own scale (`overlayGameScale`) | ~17028, `overlayCamera` | upstream has a different mechanism (`docs/architecture/mobile-chrome-scale.md`) |
| 715be9b | the lobby's encounter book | `CE`/`HE` 50999, 54422 | none |
| e763239 (#66) | sound synthesis in Web Workers | `client/audio/` | different design |
| 1ab3ba5 (#24), ddb08aa (#41) | cache groups per encounter; rebuild of a stale trimmed cache | `tools/fetch-assets.mjs`, `soundEffects.js` | upstream has its own scripts |
| 7ea8730 (root) | the hand edits marked by `//` comments, 62 clusters in `rc/comments.tsv` (see below) | as cited | none |

The 7ea8730 hand edits are:
- the presentation seam (57980) and how the presentations of the encounter modules are hooked in;
- the Attack Ranges overlay (48742);
- Interface Styles and stretched-mode bars (16980–17090);
- the frame-rate cap (63160);
- the item icon fallback (33148);
- ZCB's Evoke bolt, Magic Dart and Vardorvis' bleed (32297, 34318, 60086);
- the facing of Inferno NPC graphics (57222–57236, 57694);
- the NPC health bar width (41332);
- the release pose on the projectile clock (40881);
- the vertex merge helpers of `ModelData` (5281, 5376);
- the lobby's gateways (54422);
- the Yama scene's other NPCs.

**The tests that pin this area must be ported with any change:** `test-model-v3`, `test-cache-manifest`, `test-attack-ranges`, `test-projectile-override(-scene)`, `test-defence-tracker`, `test-trimmed-cache`, `test-cache-groups`, `test-sound-synth`, `test-determinism` (+ `test/determinism-digests`).

**The default plan follows from this:** rename ours from upstream's names (sections 5 and 6), and port only the small upstream fixes:
- the `turn180` idle turn;
- the `OpenRS2Client` re-download;
- optionally `sharedBakedEntry` and the cache bump to 2772, after the determinism digests pass.

Replace nothing wholesale.
