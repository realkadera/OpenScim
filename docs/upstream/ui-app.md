# UI and application shell: OpenScim against upstream scimgg

Area: `client/assets/Grid.js`, `client/assets/application.js`, `fullscreen.js`, `inventoryDrag.js`, `packThemes.js`, `deployment.js`, `*.css`, `client/plugins/`, `client/ui/`, `client/lobby/`.
Upstream (U) = `scratchpad/upstream/scimgg`, the squashed commit `3639203` "open-source release", dated 2026-11-24, plus 4 small CI/README commits on 2026-11-25.

How the map was made: `scratchpad/mapping/uiapp-tools/map.mjs` (read-only, uses OpenScim's `@babel/parser`) parses every top-level binding of our six chunks and every top-level declaration of U/src. It then votes on matches using string literals that occur in only one upstream file: class names, log tags, error text, storage keys, SVG paths and labels. The raw results are in `uiapp-tools/ours.json`, `uiapp-tools/upstream.json` and `uiapp-tools/summary.txt` (966 lines, one line per match with the evidence strings). `missing.mjs` / `missing.txt` lists the upstream UI strings that occur nowhere in our bundles. Scores: ≥5 means many unique strings agree; 1–2 means one or two unique anchors.

---

## 1. Summary verdict

- **It is the same lineage and almost the same build.** 2,253 top-level bindings were parsed in our six chunks. Every sizable UI component has a high-confidence upstream twin. Only **19 upstream UI files** contain any human-readable string (≥14 chars) that is absent from our bundles, and most of those absences are explained by things we did ourselves (see §3). Upstream is a **few days newer** than our scrape (2026-11-20 against 2026-11-24): a handful of small hardening changes, listed in §3-C.
- **Upstream is a sanitised "standalone" cut** (`package.json`: "Standalone OSRS combat practice simulator"). These are absent from upstream entirely, and our beta bundle has them all:
  - accounts (`AuthProvider`, `/api/auth/*`)
  - cloud profile sync (`/api/profile` in rendering.js)
  - replay sharing and the "My replays" dialog (`/api/replays*`)
  - hiscores import (`/api/osrs-stats`)
  - SEO route pages (`/disclaimer`, …)
  - What's New
  - the `isDebugUrlParam()` debug section and the dev UI harness (upstream has them; our production bundle dead-stripped them)
- **`U/src/services/` is not a backend contract.** It holds only `AssetPreloader.ts` and `ItemSpriteService.ts`. Upstream has **no `/api/` call at all**. Phase 5 therefore has to come from our own chunk; §4 gives the contract.
- **Divergence is low and mostly deliberate on our side.** All of our post-reconstruction UI commits are absent upstream: perf memo, the overlay scale, the Plugins-panel pause, the loading-screen fade, the plugins, sandbox, the encounter book and the picker. That is expected, since they were written after the beta and upstream never saw them.
- **No UI reconstruction bug was found.** The only differences in shared code are traceable to one of three causes: our commits, upstream's stripped features, or upstream's newer patches.
- **Structure.** Upstream's ~580 UI files (`components/` 230+, `hooks/` 60, `layout/` 15, `input/` 10, `contexts/` 8, `tutorial/` 35, `settingsSearch/` 5) are concatenated into our two chunks in **roughly upstream import order**, so each upstream file is a contiguous line range in Grid.js or application.js. That makes a split along upstream file boundaries mechanical.

## 2. Mapping table

Line numbers refer to the current HEAD (`12e8785`). Confidence is H (several unique anchors), M (one or two anchors plus structure) or L (structure only).

### 2a. Shell, root hooks, contexts

| Ours | Upstream | Conf | Evidence / notes |
|---|---|---|---|
| application.js `eCe` L48239–54274 | `App.tsx` `AppShell` (L214) | H | 167 pts: "tutorial:settings-opened", "minimapPosition"; the same state order, with `new _be("inventory")` = `new GamePanelTabStore('inventory')` (U App.tsx:242). |
| application.js `aCe`/`nCe` L54437/54288 | `util/PerfManager.ts`, `util/MemoryProfiler.ts` | H | "Profiling ENABLED", "===== MEMORY REPORT =====" |
| application.js `interfaceFonts` L54533 | `main.tsx` `REQUIRED_FONTS` | H | font list. **Our name is a guess; take `REQUIRED_FONTS`.** |
| application.js `(stmt)` L54542 | `main.tsx` font loading / boot | M | |
| Grid.js `un` L24663 + `nOe` L24662 | `components/snap/PanelSnapRegistry.tsx` `PanelSnapRegistryProvider` / `PanelSnapRegistryContext` (L448) | H | App wraps AppShell in it; `d8()` (app.js L48765) = `usePanelSnapRegistry()` (U App.tsx:215). |
| application.js `dU()` (used at L48843) | `hooks/usePersistedSettings.ts` `usePersistedSettings` | H | `[hR, hS] = dU()` ≙ `[settings, updateSetting]` |
| Grid.js `hie` L14456–14596 | `usePersistedSettings` (body) | H | "scimgg-settings:v1" = `SETTINGS_BROADCAST_CHANNEL` (U L87) |
| Grid.js `Yse` L13697–13839 | `PERSISTED_SETTINGS_DEFAULTS` (U L680) | H | `attackRangesEnabled: zBoolean().catch(Yse.…)` |
| Grid.js `kRe` L14009–14374 | `PersistedSettingsShape` (U L1126) | H | Zod shape |
| Grid.js `Rke` L13601, `poe` L13633, `Pie` L13617 | `STORAGE_KEY`, `RESOLUTION_PRESETS`, `infoboxPinTargetUnavailableReason` | H | |
| Grid.js `hRe` | `clampStoredInt` | M | `hRe(ez, 50, 400, default)` |
| Grid.js `mse` L19848–22733 | `hooks/useSimulationWiring.ts` `useSimulationWiring` | H | "tutorial:replay-exited", "applyBossHpPreset". **ARCHITECTURE.md calls this "the hook that owns the engine and runs the tick loop": confirmed.** |
| Grid.js `kIe` L18079–19782 | `hooks/useReplay.ts` `useReplay` | H | "Take Over could not rebuild this recording" |
| Grid.js `fIe`/`yIe` L18038/18054 | `useReplay.ts` `TAKE_OVER_UNAVAILABLE_TEXT` / `resolveRestoreBoundary` | H | |
| Grid.js `HAe` L16278–17415 (class) | `core/ReplayRecorder.ts` `ReplayRecorder` | H | aa96071 diff: `new HAe({}, dF.clock, …)` ≙ U useReplay.ts:299 `new ReplayRecorder({}, animationFrames.clock, {idleClock:'held'})` |
| Grid.js `$Ae` L16007, `jTe` L8149 | `core/ReplayCaptureBudget.ts` | H | "entry-limit", "byte-limit" |
| Grid.js `eae` L16161, `wX` L8676 | `core/replayMenu.ts` `buildReplayMenuTimeline`, `assertNever` | H | |
| Grid.js `rIe`/`uIe` L17777/17837 | `replay/resumableState.ts` `IGNORED_STATE_KEYS`, `collectDiffs` | H | |
| Grid.js `ONe` L8833 | `replay/format/presentationFormat.ts` `ReplayPresentationStateSchema` | H | |
| Grid.js `VTe` L8170 | `replay/format/parseArray.ts` `failFastReplayArray` | H | |
| Grid.js `yEe`/`pie` L23532/23554 | `replay/capturePresentation.ts` `CAPTURE_LABELS`, `replayCaptureNotice` | H | |
| application.js `qwe` L39689–40542 | `hooks/useEncounterManager.ts` `useEncounterManager` | H | log tag 'useEncounterManager' (U L430, 475, 721 ≙ ours L39988, 40036, 40324) |
| application.js `Ake` L42195; `xke` L42124; `Tke` L42131; `Mke` L42147; `Pke` L42151 | `hooks/useRouting.ts` `useRouting`, `getPathSegments`, `preservedQueryString`, `NO_ROUTE_QUERY`, `replaceRouteQuery` | H | Bodies identical in shape. **ARCHITECTURE.md's `xke` = `getPathSegments`.** |
| application.js `Bwe` L40543 | `hooks/useAppHotkeys.tsx` `useAppHotkeys` | H | |
| application.js `Cke`/`Nke` L42085/42112 (inlined in eCe L48771) | `hooks/usePlayerStats.ts` | H | Ours adds a `profile:applied` listener (cloud sync, stripped upstream). |
| application.js `Swe` L38855, `kwe` L38735 | `audio/AudioEngine.ts`, `audio/FrameSoundTracker.ts` | H | |
| application.js `yke` L41834 | `hooks/useMobileEntry.ts` (`useFullScreen` …) | M | |
| application.js `Eke` L42369 | `hooks/useTileMarkerClipboard.ts` | H | |
| application.js `lke` L41184 | `hooks/useLineMarkerActions.ts` | L | |
| application.js `Dbe` L37301 | `components/ZoomHintToast.tsx` `useZoomHintToast` | M | `disabledTypes`, toast list |
| application.js storage keys `jwe`, `Hue`, `yme`, `wme`, `$ue`, `Dwe`, `Wwe`, `bke`, `Ske`, `Rke`(app), `Cme` | `hooks/{lineMarkerState,tileMarkerState,useAntiDrag,useBossHealthBarSettings,useCustomEquipmentPresets,useEncounterEquipment,useInventoryTags,useNpcHighlights,usePlayerStats,useTileIndicators,useXpDropSettings}.ts` `STORAGE_KEY` | H | Exact "osrs-…" keys. The hooks themselves sit next to their keys. |
| Grid.js `yxe`,`vxe`,`wxe`,`kxe` L4798–4801 | `components/Tooltip/tooltipTypes.ts` `TooltipAPIContext`, `TooltipScaleContext`, `TooltipScaleLockedContext`, `TooltipDisplayContext` | H | same order and defaults (U L87–107) |
| Grid.js `xxe`/`Mxe` L4811/4813 | `components/panelContentScale.ts` context + `usePanelContentScale` | H | |
| Grid.js `S$e`/`Wae` L13117 | `contexts/GamePanelTabContext.tsx` (store provider) | M | provider of `store` |
| Grid.js `j$e`/`U$e` L13447/13452 | `contexts/ReplayPresentationContext.tsx` `ReplayPresentationContext`, `MobilePanelModesContext` | M | |
| Grid.js `Hae`/`Y$e` L13523 | `contexts/WorkspaceDockContext.tsx` | H | chromeHost / cursorHost / transportHost |
| Grid.js `vLe`/`hae`/`wLe` L30768–30790 | `contexts/DisplayTimelineContext.tsx` (context, provider, `useDisplayTimeline`) | H | |
| Grid.js `yLe` L30660 | `core/displayTimeline.ts` (store class) | M | getSnapshot over history/replay |
| Grid.js `xLe` L30794–30873 | `components/chatLog.ts` `ChatLogProjection` | H | Fields history, indexedFrames, indexedTail, eventIds are exact. **The script mis-scored this as GridChatbox; corrected here.** |
| Grid.js `UOe` L28260; `YOe` L28424 | `ContextMenu/contextMenuTypes.ts` `ContextMenuContext`; `useContextMenu.ts` | H | |
| Grid.js `NDe` L34508 | `components/TouchControls.tsx` `HotkeyCustomizationContext` | H | `{request:0, customize}` |
| rendering.js `iq`,`oq`,`pq`,`Hq` L59150–59484 | remaining contexts: `SimulationContext`, `SettingsContext`, `TickProgressContext`, `ReplayFrameContext` | L | They live in rendering.js; the rendering mapper should confirm. |
| application.js `Rye`/`Lye`/`AuthProvider` L32143–32249 | — (ours/beta only) | H | stripped upstream |
| application.js `Ewe` L39530 | — (profile sync, beta only) | H | |

### 2b. Grid.js components (upstream `components/…`)

| Ours (Grid.js) | Upstream | Conf |
|---|---|---|
| `mn` L53087–56001 | `components/Grid.tsx` `Grid` | H |
| `TBe` L52495 / `NBe` L52735 | `Grid.tsx` `ViewportContextMenuBridge` / `ViewportEntityBridge` | H |
| `yBe` L51158–52414 | `GamePanel/GamePanel.tsx` `GamePanel` | H |
| `rze` L46286–47995 (+ icons `Efe`,`Yqe`,`Kqe`,`Qqe`,`Zqe`, `zqe` isFormField) | `components/ReplayControls.tsx` `ReplayControls` | H (88) |
| `FHe` L41588–42574; `DHe` | `launcher/TopChrome.tsx` `TopChrome`, `LauncherButton` | H |
| `MHe`,`CHe`,`SHe`,`THe` L40687–41331 | `launcher/PracticePane.tsx` `PracticePane`, `SetupBody`, `PracticeStats`, `Bar` | H |
| `NHe` L41332 | `launcher/useEncounterTool.ts` | M |
| `yHe` L40625 | `launcher/EncounterWorkbench.tsx` | H |
| `ls` L1296, `zae` L1499 | `launcher/launcherIcons.tsx` `LAUNCHER_GLYPHS`, `LauncherIcon` | H |
| `dOe` L24795–26189; `pOe`; `iOe`,`sOe`,`lOe` | `DraggablePanel.tsx` `DraggablePanel`, `MoveAffordance`, `FLIP_ANIMATION_TIMING`, `PANEL_DRAG_*_EVENT` | H |
| `_Oe` L26282 | `BossHealthBarOverlay.tsx` | H |
| `UPe`/`VPe` L10891 | `BossHealthControl.tsx` `BossHealthControl`, `PresetButton` | H |
| `OOe` L26889–27555, `IOe`, `COe`, `NOe`, `POe`, `$Oe` | `Chatbox.tsx` `Chatbox`, `ChatLine`, `CHAT_TABS`, `OPAQUE_INK`, `TRANSPARENT_INK`, `textShadow` | H |
| `KOe` L28441–29772 | `ContextMenu/ContextMenuOverlay.tsx` | H |
| `QOe…fLe` L29773–30620 | `ContextMenu/contextMenuBuilders.ts` (`TARGET_COLORS`, `EDGE_LABELS`, `buildGroundItemEntries`, `assembleViewportContextMenu`, `buildNpcHighlightEntry`, `buildInventoryTagSubmenu`, `buildRunOrbContextMenu`, `buildSpecialOrbContextMenu`) | H/M |
| `HOe` L27613, `FOe`, `_se`, `qOe`, `oOe`, `rOe`, `WOe`, `Gse` | `Tooltip/TooltipContext.tsx` `TooltipProvider`, `clampAndApply`, `TooltipCard`, `useTooltipDisplay`, `useTooltip`, `useTooltipScale`, `buildToggleRunTooltip`, `TOOLTIP_COLORS` | H/M |
| `RLe` L30910, `SLe` | `DetailedDpsOverlay.tsx` | H |
| `ALe` L31246 | `NineSliceBg.tsx` | M |
| `LLe` L31416 | `GamePanel/AutocastSpellPicker.tsx` | H |
| `WLe` L31821, `Ef` | `GamePanel/CombatContent.tsx` | H |
| `ULe` L32361 | `GamePanel/panelKit.tsx` `SectionHeader` | H |
| `rDe` L32712, `eDe`,`tDe`,`nDe`,`oDe`,`iDe` | `GamePanel/EquipmentContent.tsx` (`EquipmentContent`, `StatRow`, `StatsBackButton`, `ConnectingLines`, `EquipmentActionButton`, `EquipmentSlot`) | H |
| `TDe` L33784–34507 | `GamePanel/InventoryContent.tsx` | H |
| `PDe`,`$De`,`Dse` L34533–34797 | `TouchControls.tsx` `TouchSlider`, `HintedCheckbox`, `TouchControls` | H |
| `IDe` L34835 | `GamePanel/MobileSideChrome.tsx` | M |
| `ODe` L35117 | `GamePanel/MobileHotkeys.tsx` | H |
| `FDe` L35366 | `GamePanel/FilterMenu.tsx` | M |
| `HDe` L35485 | `GamePanel/prayerFilterUtils.ts` `PRAYER_GRID` | H |
| `nFe` L35861–36583, `QDe`, `ZDe`, `hDe` | `GamePanel/PrayerContent.tsx` | H |
| `oFe` L36587 | `GamePanel/QuickPrayerSetup.tsx` | H |
| `rFe` L36725 | `GamePanel/AudioSlider.tsx` | H |
| `aFe` L36789 | `GamePanel/SettingsContent.tsx` | H |
| `uFe` L37022, `sFe`/`ITe`/`OTe` | `GamePanel/SidePanelColumn.tsx` (`SidePanelColumn`, `edgeSprite`) | M |
| `yFe` L37208 | `GamePanel/SkillsPanelCanvas.tsx` | H |
| `wFe` L37352, `pFe` | `GamePanel/SkillsContent.tsx`, `skillsPanelLayout.ts` `PANEL_CELLS` | H |
| `CFe` L37467–38406, `xFe`, `gDe` | `GamePanel/SpellbookContent.tsx` | H |
| `LPe`,`DPe`,`Iie`,`kae` L10214–10564 | `GamePanel/spellbookFilterUtils.ts` (`ARCEUUS_GRID`, `ANCIENT_GRID`, `SPELLBOOKS`, `getSpellIconPath`) | H |
| `use` L38520 | `GamePanel/StatusBars.tsx` | M |
| `xPe` L10055 | `GamePanel/UnlimitedMark.tsx` `GLYPH` | H |
| `l$e` L11573, `Mse` L11736–12265, `p$e`,`h$e`,`f$e` | `GamePanel/KeybindingEditor.tsx`, `KeybindingsContent.tsx` | H |
| `Uie` L12616–13000, `k$e`, `x$e` | `MechanicsSettings.tsx` (`MechanicsSettings`, `MechanicsChoiceRow`, `MechanicsToggleRow`) | H — **carries our 7cc06cd `wrap`/`isOffered`** |
| `_$e` L12278 | `MechanicsChoiceGlyph.tsx` | H |
| `Coe` L12325 | `ui/SettingRow.tsx` | H |
| `T$e` L13125 | `layout/osmHotkeys.ts` `OSM_HOTKEY_TYPES` | H |
| `Zie` L13008 | `FpsOverlay.tsx` | H |
| `fn` L50474, `tBe`, `nBe` | `ViewportStatusOverlay.tsx` | H |
| `Mqe` L43699–44845 | `Minimap.tsx` | H |
| `QHe`,`KHe` L42706; `ZHe` L42993 (unscored) | `MinimapOrbs.tsx` (`Orb`, `getOrbNumberColor`, `MinimapOrbs`) | H/M |
| `XHe`,`YHe` | `PrayerOrbFlickSweep.tsx` | H |
| `iHe`,`rHe`,`nHe` L39384–39795 | `InfoBox/InfoBoxOverlay.tsx` | H |
| `mHe` L40133 | `InfoBox/InfoBoxPanel.tsx` | M |
| `eHe`,`JFe` L39161–39361 | `InfoBox/selectInfoboxes.ts` | H — **carries our 0419d3e/e6f2213 encounter infoboxes + Defence Tracker** |
| `ZFe`,`QFe` L39013–39155 | `HintBar/HintBar.tsx` `HintBar`, `HINTS` | H |
| `lHe`, `dHe` | `snap/OverlapGuideOverlay.tsx`, `snap/SnapGuideOverlay.tsx` | H |
| `fHe` L40389 | `PracticeSessionBar.tsx` | H |
| `bHe` L40460 | `useLayoutMeasure.ts` | L |
| `$qe` L44903–45384 | `MobilePracticeControls.tsx` | H |
| `Cqe`, `Yoe` | `MobileLayoutEditBar.tsx` | H |
| `Eqe` L45488 | `LoadingScreen.tsx` (Grid copy?) | L — application.js `zpe` is the real one |
| `Fqe`,`Hqe`,`qqe` L45911–46006 | `ReplayWaves.tsx` | H |
| `Lqe` | `replayChapterNav.ts` | M |
| `aze` L48001–48613 | `MobileToolWindow.tsx` | H |
| `hze`,`pze` L48658–48982 | `PrayerFlickOverlay.tsx` | H |
| `Sse` | `cursors/PointerCursor.tsx` | M |
| `sse`, `_ze` | `replayClickVisuals.ts` | H |
| `Nze`,`Pze`,`$ze`,`Rze` L49119–49294 | `ReplayClickMarker.tsx` | H |
| `roe` | `replayCursorProjection.ts` | L |
| `Uze`,`jze` L49447–49691 | `ReplayCursorLayer.tsx` | H |
| `Zze` L49765–50263 | `TileMarkerColorPicker.tsx` | H |
| `Jze` L50264–50461 | `TileMarkerLabelEditor.tsx` | H |
| `gBe`,`pBe`,`uBe` L50708–50923 | `XpDropOverlay.tsx` | H |
| `_Be`,`fBe`,`bBe` L50933–51156 | `ZukSetTimerOverlay.tsx` | H |
| `f_e`,`dae` L1691–1924 | `ReplayPractice.tsx` (`PracticeRetryBar`, `OutcomePracticeActions`) | H |
| `jie` L765–1171 | `ui/HoverCard.tsx` `useHoverCard` | H |
| `eoe` L560–758 | `hooks/useRafDrag.ts` | M |
| `gie` L2018, `sie` L2177, `vie`/`o_e` L417–552, `nae` L385, `fse`, `Aoe`, `vse`, `WPe`, `Dae` | `ui/InfoHint`, `ui/OsrsNumberInput`, `ui/SystemNotice`, `ui/DisclosureChevron`, `ui/CloseButton`, `ui/OsrsCheckbox`, `ui/ResetButton`, `ui/StatusBadge`, `ui/mobileSheet` | H |
| `ioe`,`jxe` L5312 | `ResetToDefaults.tsx` | H |
| `aY`,`$oe` L326 | `BrowserSuggestions.tsx` | H |
| `Tse`,`Soe`,`n_e`,`ase` L366–384 | `noWebgl2Guidance.ts` | H |
| `v_e` L2433–3323 and `C_e…Aie` L3328–4531 | `resourcePack.ts` (`MINIMAP`, `PANEL`, `MOBILE`, `PRAYER`, `BUTTON`, `SCROLLBAR`, `CHATBOX`, …) | H |
| `txe`,`nxe`,`foe` | `skillsPanelLayout.ts`, `layout/osmClientLayout.ts` `OSM_TAB_SLOTS` | H |
| `bie`, `XFe` | `layout/osrsClientLayout.ts` | H |
| `bEe` L23387 | `layout/topChromeLayout.ts` `placePane` | M |
| `Fie` L23244 | `layout/osmToolWindowState.ts` `toolWindowReducer` | H |
| `IEe`,`EEe`,`OEe` L23770 | `chromeZoom.ts` | H |
| `GPe…Rse` L11073–11530 | `settingsReveal.ts` | H |
| `Ioe`,`Eoe`,`aoe`,`ese`; `BNe` L9034 | `settingsSearch/ids.ts`; `settingsSearch/entries.ts` `SETTINGS_ENTRIES` | H/M |
| `Bae`,`Yie`,`Kie`,`Qie` L7996 | `tutorial/events.ts` | H |
| `sMe`,`lMe`,`pMe`,`tMe`,`gMe`,`kMe`,`xMe`,`MMe`,`bMe`,`_Me` L5404–7208 | `encounters/inferno/*` UI (`SpawnLayoutMap`, `InfernoSpawnSetup`, `InfernoSetup`, `practiceChrome`, `replayChapters`), `encounters/practiceChrome.tsx` | H — **these are the inferno agent's, noted here** |
| `UNe` L9580 | `encounters/zuk/ZukWaveDirector.ts` | H (engine area) |
| `communityLinks`/`CommunityLinks` L40440 | — (ours, 369caf0) | |
| `remoteItemIconBase`, `talkToColosseumMinimus`, `interactWithZebakJug`, `inventoryInset` | — (ours or hand-named) | |

### 2c. application.js components

| Ours (application.js) | Upstream | Conf |
|---|---|---|
| `ele` L475 | `BrowserSupportScreen.tsx` | H |
| `dle` L967 | `ModelPreview.tsx` | H |
| `ule` L1311 | `audio/soundNames.ts` `SOUND_NAMES` | H |
| `gle` L1742–3635, `mle`, `ple` | `CacheExplorer.tsx` (`CacheExplorer`, `NpcAnimationBrowser`, `SeqRow`) | H — ours adds `zebakSoundSearch` (L16) |
| `fle` L3636, `ble` L3830 | `Credits/contributors.ts`, `Credits/CreditsModal.tsx` | H |
| `yle` L3761 | `ui/useCenteredModalSnap.ts` | H |
| `Nle`,`vle`,`wle`,`Cle` L3902–4148 | `DeathModal.tsx` | H |
| `$le`,`_le`,`qle` L4674–7144 | `data/playerPresets.ts` | H |
| `Tce`…`qce` L7512–7880 | `data/equipmentVerification.ts`, `data/equipmentSupport.ts` | H |
| `ude`, `xde`, `nde`/`sde` | `data/inventoryItemCatalog.ts`, `data/inventorySetupIO.ts`, `data/runePouch.ts` | H |
| `Ode`…`Wde`, `jde`, `Jde`, `iue`…`Sue`, `Tue` L8601–10481 | `tutorial/content/*` (plugins, onboarding-advanced, onboarding-main, yama-*, courses) | H |
| `Fue` L10522 | `BossPortrait.tsx` | L |
| `ope` L14305–16218, `_ue`, `Yhe`, `ipe`, `Qhe` | `EncounterLoadoutSection.tsx` | H |
| `Xue` | `EncounterPanel.helpers.ts` `CUSTOM_PRESET_KEY` | M |
| `mhe`,`dhe` | `EquipmentSettings.tsx` | H |
| `che`,`she`,`rhe`,`ohe`,`ihe`,`nhe` | `LoadoutUnverifiedBadge.tsx` | H |
| `khe`,`whe`,`vhe`,`yhe` L11617–12293 | `LoadoutPicker.tsx` | H |
| `ghe` | `inventorySlotDrag.ts` `SLOT_INDEX_ATTRIBUTE` | M (see also `inventoryDrag.js`) |
| `Che` | `loadoutGridNavigation.ts` `useGridRovingFocus` | H |
| `Ahe` L12399–12821 | `PlayerSettings.tsx` | H — **ours has the hiscores import (`/api/osrs-stats`, `xhe`, `Nhe`, `Phe`): stripped upstream** |
| `$he`,`Rhe`,`Ehe`,`Ohe` | `RunePouchRow.tsx` | H |
| `Whe`,`Bhe`,`Hhe`,`zhe` L13246–14105 | `SlotPickerPopover.tsx` | H |
| `rpe`,`spe`,`cpe`,`hpe`,`ppe` | `EncounterSetupNotes`, `WikiLink`, `EncounterSetupSelection`, `ModifierSelector` (`ModifierGrid`), `StartingHitpointsField` | H |
| `gpe` L16652–17277 | `EncounterPanel.tsx` | H |
| `bpe` L17289 | `ui/backdropDismiss.ts` | M |
| `wpe` L17306 | `EncounterPicker.tsx` `RewardGlyph` | M — **the rest of the original picker was removed from the bundle by 3b0484d** |
| `Cpe`,`Npe`,`Tpe` | `CountdownBeats`, `FightStartCountdown`, `EncounterTitleCard` | H |
| `Ppe` L17747–18387 | `GridProviders.tsx` (probably) | L — demoDisplayEvents/settings providers; upstream has no strings |
| `Lpe`,`Rpe`,`Ipe` | `HardwareAccelWarning.tsx` | H |
| `Fpe`,`$pe`,`Ope` | `ui/RevealLinks.tsx` | H |
| `_pe` L18644 | `data/shortcuts.ts` `getShortcutCategories` (+ `KeyboardShortcutsModal`) | H |
| `Hpe` | `data/tips.ts` `TIPS` | H |
| `zpe` L19018, `qpe` | `LoadingScreen.tsx` | H — **carries our 65814d9** |
| `Xpe`…`eme` L19371–19678 | `MobileEntry.tsx` | H |
| `ime`, `ome` | `MobileFullscreenStone.tsx`, `MobileRestartStone.tsx` | H |
| `dme`,`cme`,`lme` | `ModifierKeysOverlay.tsx` | H |
| `hme` | `ModifiersModal.tsx` | H |
| `pme` | `data/encounterPlugins.ts` | H |
| `Ime` | `FixedLayoutScaleField.tsx` | H |
| `Ame` | `useAppHotkeys.tsx` `isZoomKey` | H |
| `$me…Yme` L20563–22538 | `settingsSearch/entries.ts` (`PLUGIN_ENTRIES` etc.) | H — **ours adds entries for our plugins** |
| `ege…uge`, `fge`, `bge`, `Cge` L22549–23174 | `settingsSearch/match.ts` | H/M |
| `xge`,`Pge`,`Ige`,`Age` | `searchResults.tsx` | H |
| `_ge…Kge` L23429–23805 | `SidebarSearch.tsx` | H |
| `Uge`,`Vge`,`Yge`, `Jge`, `Zge` | `TickColorChips.tsx`, `TileIndicatorColorInput.tsx`, `ui/OsrsToggle.tsx` | H |
| `cfe` L24712–28447, `efe`, `nfe`, `afe`, `ife` | `PluginsPanel.tsx` (`PluginsPanelContent`, `PluginRow`, `OverheadNumberPlacementRows`, `AutoOverlaySizeSetting`, `PillarAdditionsSettings`) | H — **ours adds `sceneOverlayScaleSetting`, `AttackRangesSettings`, `PluginStoreEntry` and the rows of Projectile Override, Blindfold, Skybox, Defence Tracker** |
| `hfe…vfe` L28455–29006 | `QuickSearch.tsx` `QuickSearchDialog` | H |
| `wfe` L29008 | `RendererErrorBoundary.tsx` | H |
| `kfe`,`Sfe`,`Cfe`,`Nfe`,`xfe`,`Tfe`,`$fe` L29139–29863 | — "My replays" dialog / share codes (beta only) | H |
| `Wfe`, `Qfe`, `buildDescriptorSeoEntry`, `sye`, `lye`, `hye` L29867–30591 | — SEO route pages (beta only; `Qfe` has our zebak / toa_nexus entries) | H |
| `iye` | `encounters/yamaP3/contracts.ts` | M |
| `fye` | `CollapsibleSection.tsx` | H |
| `bye`,`vye`,`wye`,`kye`,`xye`,`Nye`,`yye`,`Sye` L30692–31902 | `Controls.tsx` (`SimulationControls`, `DisplayControls`, `InterfaceControls`, `DeviceModeControl`, `ViewportPopoutControl`, `DeviceModeGlyph`, `FPS_CAP_OPTIONS`) | H |
| `Iye`,`Aye` | `InfoboxAppearanceSettings.tsx` | H |
| `Dye`,`Oye` L32250–32492 | — account / login panels (beta only) | H |
| `_ye`,`$ye`,`Fye` L32493–33008 | `SettingsSidebar.tsx` `SettingsSidebarContent` | H |
| `Hye`,`Bye`,`Gye` L33009–34244 | — replay export / share dialog (beta only; POST `/api/replays`) | H |
| `jye` | `SoundDebugOverlay.tsx` | H |
| `Zye`,`Vye`,`Jye` | `TickTimingOverlay.tsx` | H |
| `Xye` | `TransitionOverlay.tsx` | H |
| `fbe…Nbe`, `hbe` L34763–35717 | `TutorialPickerModal.tsx` (all subcomponents named) | H |
| `ibe`/`obe` | `tutorial/persistence.ts` | M |
| `Tbe`,`xbe` | `VictoryModal.tsx` | H |
| `Mbe` | `ViewportSizeWarning.tsx` | H |
| `Ibe` L35920–37141 | `encounters/yamaP3/controls.ts` `buildYamaControls` | M |
| `Lbe` L37176, `whatsNewFiles` L37145 | — What's New (beta, kept by us; ad11f72, 2db8f11) | H |
| `Obe`,`$be` | `ZoomHintToast.tsx` | H |
| `jbe…Jbe` | `data/tilePackPresets.ts` | H |
| `ove`,`eve` | `encounters/inferno/setupLink.ts` | H |
| `Iwe` | `services/AssetPreloader.ts` | M |
| `Xke` L43113 | `tutorial/components/DemoCursorLayer.tsx` | H |
| `eSe`,`tSe` | `tutorial/components/TutorialMarkup.tsx` | H |
| `iSe…OSe` L43805–45519 | `tutorial/components/TutorialOverlay.tsx` (`TutorialBeam`, `BeamMenu`, `TutorialCodex`, `StepsList`, `TutorialPauseOverlay`, `TutorialCompletionModal`, …) | H |
| `FSe` | `tutorial/runtime/stepNavPanel.ts` `mountStepNav` | H |
| `$Se`,`_Se`,`HSe`,`BSe`,`zSe` L45673–46447 | `tutorial/runtime/SpotlightRunner.ts` | H |
| `WSe`,`GSe` | `tutorial/encounterCommands.ts` | H |
| `VSe` L46508–47869 | `tutorial/runtime/TutorialDirector.ts` | H |
| `YSe` L47870–48218 | `tutorial/runtime/useTutorialDirector.ts` (probably) | L |
| `packThemes.js` `packThemeColors`, `OsrsButton` | `theme.ts` `THEME`, `ui/OsrsButton.tsx` | H |
| `fullscreen.js` | `util/fullscreen.ts` | H |
| `deployment.js` | `util/deviceMode` / deployment config (no direct twin) | L |

**Upstream UI files with no match in our bundles:** these files contain no distinctive strings (the type-only ones and the pure-math helpers: `layout/osmHud.ts`, `layout/overlayScale.ts`, `panelPlacement.ts`, `prayerFlick*.ts`, `minimapTerrain.ts`, …). Finding them takes structural matching, which the split itself will force. A few are real absences:
- `MobileMenu.tsx` (51 strings, none in ours): **probably newer upstream**
- `LobbyEffectsControls.tsx`: probably newer, or debug-only
- `harness/ui/*`: dev only

## 3. Behavioural divergences

Legend: **OURS** = one of our deliberate commits; **STRIP** = beta feature that upstream removed from the open release; **UP** = upstream changed after our 2026-11-20 scrape; **RECON** = reconstruction error. **No RECON divergence was found in this area.**

### A. Our deliberate changes (upstream lacks every one)

1. **The fight pauses while the Plugins panel is open.** OURS, 8629243 and 578baa1. Ours: app.js L50737 `modalPaused: (oF || oG > 0 || kY) && "lobby" !== sceneState.kind`, where `kY` = the Plugins panel's open state, plus the `showPluginsPausedHint` effect at L52133 and `client/plugins/pluginsPausedHint.js`. Upstream: App.tsx:1228 `(modalCoversFight || openEncounterTools > 0)`, and `modalCoversFight` (L1141–1149) does not include the Plugins panel. Determinism: no digest effect (it holds wall-clock ticking only). Test: `test/test-plugins-panel-pause.mjs`.
2. **The loading screen fades on scene-ready.** OURS, 65814d9. Ours: app.js L19193–19209 (`isSceneReady ? 0 : 1800`, unmount after the CSS fade). Upstream: `LoadingScreen.tsx:200–221` still uses fixed 1800 ms and 3300 ms timers and does not take `isSceneReady`.
3. **Scene overlays scale with the UI, or set their own scale.** OURS, 39669b4 and 0443116. Ours: Grid.js `overlayGameScale: sceneOverlayScale ?? (jO ? jP : k0)`; settings `sceneOverlaysFollowUiScale` and `sceneOverlayScalePercent` (50–400, in `Yse`/`kRe`); app.js `sceneOverlayScaleSetting` L24289. Upstream has no `overlayGameScale` anywhere in `src/render`, so it still draws health bars, hitsplats and prayers at a fixed 3 device px per game px, and Fixed mode double-scales them. Upstream's `layout/overlayScale.ts` and `useAutoOverlayScale` size the *UI overlays*, not the scene.
4. **Less per-tick work.** OURS, aa96071. Ours: `useState(Sfe)` lazy (app.js L29330); recorder made once (Grid.js `HAe` in `kIe`); sound-rule chain and `FrameSoundTracker` made once (app.js); `memo` on `zae` LauncherIcon, `pOe` MoveAffordance, `ZFe` HintBar, `gBe` XpDropOverlay, `hye`, `CommunityLinks`; quick-prayer deps keyed on four levels. Upstream still does all of this every render:
   - `useReplay.ts:299` `useRef(new ReplayRecorder(...))`
   - `useAudioManager.ts:60` `useRef(new FrameSoundTracker(audioEngine))`
   - no memo on those components

   Plus `client/plugins/attackRanges.js` caching.
5. **Mechanics choice `wrap` and `isOffered`.** OURS, 7cc06cd. In `MechanicsChoiceRow` (`k$e`); upstream has neither option.
6. **Encounter infoboxes from the snapshot, NPC `menuColor`, floor graphics.** OURS, 0419d3e. In `selectInfoboxes` (`eHe`) and the context-menu builders.
7. **Plugins: Attack Ranges, Projectile Override, Blindfold, Skybox, Defence Tracker.** OURS (attackRanges.js is in the 7ea8730 baseline; the others are b2ca7d4, 4ac2664 and e6f2213). They add rows in `cfe`, settings in `Yse`/`kRe`, search entries in `Yme`, and Grid.js imports (Grid.js L3–5). None of these exist upstream.
8. **Sandbox editor and its promise bridge.** OURS: 8c0af2f, c3dbc21, 210ade8 (hooks in app.js / Grid.js).
9. **Encounters supply loadouts, SEO and tile-marker presets; What's New from `client/whats-new/`.** OURS: 2db8f11, ad11f72.
10. **Lobby encounter book.** OURS: 715be9b (`pickLobbyObject`, Grid.js L6, `client/lobby/*`). Upstream's lobby uses NPCs and selectedLobbyEncounter.
11. **Encounter picker.** OURS: 3b0484d. The upstream rail+detail `EncounterPicker.tsx` (444 lines; its strings "Search encounters...", "picker-rail" and so on were in the 7ea8730 bundle) was **replaced** by `client/ui/encounterPicker.js`, a tile grid driven by the catalog. Only `wpe` (RewardGlyph) of the original is still in the bundle.
12. **Branding and links.** OURS: 369caf0, 9788779. "Scim.GG" became "OpenScim"; the repo link sits beside Discord. This accounts for `missing.txt` entries such as "OSRS Combat Simulator", "Try Scim.GG on another device", and the Jagex disclaimer wording.

### B. Beta features upstream stripped (STRIP: ours is the more complete one)

- **Accounts:** `AuthProvider`/`Rye`/`Lye` (app.js L32143–32249), and `Dye`/`Oye` (account and login panels).
- **Cloud profile sync:** rendering.js L12926–13058 (`$k` key map, `/api/profile`) and `Ewe` profileReady. AppShell waits for `profileReady`; upstream has no such gate.
- **Hiscores import in PlayerSettings:** `Ahe`, `xhe`.
- **Replay sharing:** POST, GET and DELETE on `/api/replays`, the `osrs-replay-index` local index, `/r/<code>` share URLs. This adds three extra entries to `modalCoversFight` in ours (`h8`, `hb`, `hK`; `oF` at app.js L50658 has 11 terms against upstream's 8).
- **SEO static routes:** `Wfe` (/disclaimer …), `buildDescriptorSeoEntry`, `hye`.
- **What's New** (`Lbe`): absent upstream.
- **Onboarding text** was rewritten upstream to match the stripping. Upstream (`onboarding-main.ts:245`) says "Your settings are saved locally in this browser." Ours (app.js L9364) says "…You can also <b>create an account</b> to save your settings…". Keep ours while accounts exist; switch to upstream's wording if phase 5 drops accounts.

### C. Upstream newer than our bundle (UP: candidates to port)

- `pixelSpriteStore.ts:91` `configurePixelSpriteStore({budgetBytes})` with a RangeError guard: a sprite raster memory budget. Ours (`Bxe` region) has no budget.
- `services/AssetPreloader.ts:270–280`: a "late-asset observer" (a PerformanceObserver on resources, debug log).
- `replay/format/presentationFormat.ts`: "Workspace must match the game frame" validation. `replay/replayCapture.ts`: "Projected overlays still do not satisfy the replay schema" guard. Both are stricter replay-presentation validation and matter for replay robustness.
- `MobileMenu.tsx` (234 lines) and `LobbyEffectsControls.tsx` (107): none of their strings are in ours. Either new upstream or debug-gated; check before porting.
- `components/SettingsSidebar.tsx:294–306`: the debug section (Basic and Advanced tutorial buttons, the "Skip Transparent Sort" PerfToggle). It sits behind `isDebugUrlParam()` and was dead-stripped from our production build. The flag itself exists in ours (rendering.js L13831).
- Tutorial text tweaks: yama-basics' "Fire attack\nProtect from Magic" labels; onboarding-main's local-settings sentence.

None of these touch engine digests. The replay-validation guards could make upstream **reject** some recordings that ours accepts. That is a compatibility note, not a determinism one.

## 4. Ours-only and upstream-only

**Only in ours** (keep all):
- The Plugins listed in §3-A.7 and `pluginStore.js`
- `pluginsPausedHint.js`
- Sandbox UI
- Encounter book (`client/lobby/book.js`, `shader.js`, `gateway(s).js` with the ToA/DT2/sandbox gateways registered no longer but kept)
- Catalog-driven picker (`client/ui/encounterPicker.js`, `encounterCatalog.js`, `portraits.js`)
- `whats-new/`
- Community/GitHub links
- The overlay-scale settings
- `zebakSoundSearch` in the Cache Explorer
- `Qfe` SEO entries for our encounters
- The beta backend client (auth, profile, replays, osrs-stats)

**Working-tree note:** `client/ui` and `client/lobby` are **committed** on `feat/encounter-book` (715be9b, 3b0484d). They are not on `main`. `git status` shows only `.claude/` untracked: there is **no uncommitted overlay-scale or picker work** in the tree today. The overlay-scale work is merged (39669b4, 0443116).

**Only in upstream:**
- TypeScript types and JSDoc for every component, hook and layout module
- ~150 `__tests__` UI test files (Vitest + RTL)
- `harness/ui` (UI harness app, fixtures)
- `docs/architecture/{modal-family, workspace-docking, mobile-chrome-scale, fixed-mode-chrome-seams, replay-recording, encounter-configurer}.md`
- `DESIGN.md`
- §3-C patches
- The full `EncounterPicker.tsx` (superseded by ours)

**Backend API contract: what upstream does NOT have, extracted from our chunk.** This is the input for ROADMAP phase 5. All calls use `credentials: same-origin` cookies.

| Route | Method | Request | Response (Zod / handling) | Ours |
|---|---|---|---|---|
| `/api/auth/me` | GET | – | `{ user }` (user or null) | app.js L32158 |
| `/api/auth/login` | POST json | `{ username, password }` | ok → `{ user }`; error → `{ error }` (default "Login failed") | L32167 |
| `/api/auth/register` | POST json | `{ username, password }` | as login ("Registration failed") | L32189 |
| `/api/auth/logout` | POST | – | ignored | L32211 |
| `/api/auth/account` | DELETE json | `{ password }` | ok, or `{ error }` | L32218 |
| `/api/osrs-stats?username=` | GET, `accept: application/json` | – | `xhe` (L12361) = discriminated union on `ok`: `{ok:true, data:{username, skills:{attack,strength,defence,ranged,magic,prayer,hitpoints,agility: {rank,level,xp}}}}` or `{ok:false, error:{code,message}}` | L12515; username kept in localStorage `osrs-hiscores-username` |
| `/api/replays` | POST, `Content-Type: application/gzip` | gzipped replay file bytes | `Nfe` = `{ code: string }` | L33840 |
| `/api/replays/mine` | GET | – | `xfe[]` = `{code, title\|null, description\|null, encounterKind, durationTicks, outcome: 'victory'\|'death'\|'other'\|null, createdAt, sizeBytes}`; 401 = "unauthorized" (treated as an empty list) | L29352 |
| `/api/replays/:code` | GET | – | raw gzip bytes (decoded by `g4`) | L51463 |
| `/api/replays/:code` | DELETE | – | ok / error ("offline" vs other) | L29451 |
| `/api/profile` | GET | – | object of the keys settings, keybinds, cameraKeybinds, tileMarkers, panelFilters, tutorialProgress, playerStats (each value or null); all null = "empty" | rendering.js L12938 |
| `/api/profile/:key` | PUT json | `{ value }` | ok; retried up to 3× every 5 s | rendering.js L12976 |
| `/api/profile` | PUT json | the full profile | ok, else throws | rendering.js L13036 |

Share codes match `/^[0-9A-HJKMNP-TV-Z]{10}$/` (Crockford base32, `Mfe` L29225). The share URL is `https://<first deployment host>/r/<code>` (`Ife`, from `deployment.js`). The local index is `osrs-replay-index`: newest first, at most 200 entries.

## 5. Readability wins (prioritised)

1. **Name the shell's hubs first.** These names are referenced by ARCHITECTURE.md and by every other chunk:
   - Grid.js: `mse`→`useSimulationWiring`, `kIe`→`useReplay`, `HAe`→`ReplayRecorder`, `mn`→`Grid`, `yBe`→`GamePanel`, `rze`→`ReplayControls`, `FHe`→`TopChrome`, `dOe`→`DraggablePanel`, `un`→`PanelSnapRegistryProvider`, `hie`→`usePersistedSettings`, `Yse`→`PERSISTED_SETTINGS_DEFAULTS`, `kRe`→`PersistedSettingsShape`
   - application.js: `eCe`→`AppShell`, `qwe`→`useEncounterManager`, `Ake`→`useRouting`, `xke`→`getPathSegments`, `cfe`→`PluginsPanelContent`, `dU`→`usePersistedSettings`, `d8`→`usePanelSnapRegistry`, `_be`→`GamePanelTabStore`, `Lye`→`useAuth`, `Rye`→`AuthContext`, `Ewe`→`useProfileSync`

   `tools/rename-bindings.mjs` can apply them as "evidence" renames citing the §2 anchors.
2. **Rename every §2 H-row binding** (≈400 bindings) in bulk from a generated JSON (`tools/names/ui-bindings.json`), with the evidence string per entry.
3. **Split the chunks along upstream file boundaries.** Each upstream file is a contiguous range. Start with leaf modules that have no hooks into the engine: `ui/*`, `Tooltip/*`, `ContextMenu/*`, `resourcePack`, `settingsSearch/*`, `tutorial/content/*`, `data/*`. Then `GamePanel/*`, then `launcher/*`, `Replay*`. Leave `mse`, `eCe` and `mn` for last.
4. **Take upstream's JSDoc** on `modalCoversFight`, `openEncounterTools`, `useSimulationWiring`'s `modalPaused` and `playbackHeld`, `GamePanelTabStore`, `ChatLogProjection`, and `DisplayTimeline`. They document invariants (for example "every modal belongs on modalCoversFight and on one of quick search's two lists") that our comments don't capture.
5. **Bring over upstream's `docs/architecture/modal-family.md`, `workspace-docking.md` and `replay-recording.md`** (MIT, with the notice kept) into our docs, with notes on our deviations (Plugins pause, overlay scale).
6. **Contradicted names.**
   - `interfaceFonts` → upstream `REQUIRED_FONTS`.
   - `sceneOverlayScaleSetting`, `AttackRangesSettings`, `PluginStoreEntry`, `CommunityLinks`, `whatsNewFiles` and `buildDescriptorSeoEntry` are ours and have no upstream counterpart, so nothing contradicts them.
   - The tools/names files hold almost no UI-chunk renames: only 18 non-minified top-level names exist in Grid.js and application.js. **No "inferred" UI rename is contradicted**, apart from `interfaceFonts`.
7. **Correct ARCHITECTURE.md's wording.** `mse` is upstream's `useSimulationWiring`; it delegates the tick loop and the engine to the engine area. `Grid.js` is "components + useSimulationWiring + useReplay + ReplayRecorder + the persisted-settings module".

## 6. Recommendation per component

Default: **rename or port from upstream into ours.** Wholesale replacement is not advised. Upstream's UI imports upstream's TS engine, encounter registry and `encounters/slugs`, which conflict with our client/engine split and our encounters. It also drops the backend client and every commit in §3-A.

| Component | Action | Effort | Risk | Our commits it must keep |
|---|---|---|---|---|
| `ui/*`, Tooltip, ContextMenu, HoverCard, InfoHint, SystemNotice, OsrsNumberInput, etc. | Rename from upstream, then split into modules | S | low | none (untouched since 7ea8730) |
| `resourcePack`, `theme`/`packThemes.js`, `layout/*`, `chromeZoom` | Rename and split | S | low | none |
| `settingsSearch/*` (`Yme` and friends) | Rename and split; keep our extra entries | M | low | 4ac2664, b2ca7d4, e6f2213, 0443116 |
| `tutorial/*` (content, overlay, director, spotlight) | Rename and split; could be **replaced** by upstream's TS content after transpiling, if desired | M | low–med | none of ours; but upstream text differs where accounts were stripped |
| GamePanel family, Minimap, Orbs, Chatbox, InfoBox | Rename and split | M | low | `selectInfoboxes`: 0419d3e, e6f2213; SidePanel quick prayers: aa96071 |
| `MechanicsSettings` | Rename; keep ours | S | low | 7cc06cd (`wrap`, `isOffered`) |
| `LoadingScreen` | Rename; keep ours | S | low | 65814d9 (upstream lacks it) |
| `PluginsPanel` (`cfe`) | Rename from upstream; keep ours | M | med (3.7k lines, many of ours) | 4ac2664, b2ca7d4, e6f2213, 0443116, aa96071, 8629243, 578baa1 |
| `PlayerSettings` (`Ahe`) | Rename; keep the hiscores import | S | low | backend features (phase 5) |
| `EncounterPicker` | **Keep ours** (`client/ui/encounterPicker.js`); do not re-adopt upstream's | – | – | 3b0484d |
| Lobby (book, gateways) | Keep ours | – | – | 715be9b |
| `AppShell` (`eCe`, 6k lines) | Rename locals from upstream's App.tsx (same order of state) and add upstream's JSDoc; split last | L | med–high (all features meet here) | 8629243, 578baa1, 65814d9, aa96071, ad11f72, 2db8f11, 9788779, 369caf0, sandbox (8c0af2f, c3dbc21, 210ade8), 3b0484d, and the backend client |
| `useSimulationWiring` (`mse`), `useReplay` (`kIe`), `ReplayRecorder` (`HAe`) | Rename from upstream; port §3-C replay validation guards selectively | L | high (replay determinism, takeover) | aa96071 (recorder made once); coordinate with the engine/replay mappers |
| `usePersistedSettings` (`hie`, `Yse`, `kRe`) | Rename; keep our settings keys | S | low | 7ea8730 (`attackRanges*`), 0443116, b2ca7d4 |
| `useEncounterManager` (`qwe`), `useRouting` (`Ake`) | Rename; keep our registry and descriptor lookups (`Ike`) | M | med | 2db8f11, sandbox |
| Backend client (auth, profile, replays, osrs-stats) | Keep; name it (`AuthProvider` …); it is the phase-5 contract (§4) | S | low | – |
| §3-C upstream patches (sprite budget, late-asset observer, replay presentation guards) | Port individually after the split | S each | low; replay guards need test-replay coverage | – |

## 7. Our progress to preserve

UI commits since the reconstruction (7ea8730, 2026-11-23), from `git log -- client/assets/{Grid,application}.js client/plugins client/ui client/lobby …`:

| Commit | What | Where in the chunks | Upstream equivalent? |
|---|---|---|---|
| 369caf0, 9788779 | OpenScim repo link, shared links in Settings header | Grid.js `CommunityLinks` L40445; `_ye` | no |
| 39669b4, 0443116 | Scene overlay scale, and Stretched Mode's own scale setting | Grid.js `overlayGameScale`; `Yse`/`kRe`; app.js `sceneOverlayScaleSetting` | **no** (upstream still fixed 3 px) |
| ad11f72, 2db8f11 | What's New entries and icon; encounters supply loadouts, SEO and tile presets | app.js `Lbe`, `whatsNewFiles`, `Qfe`, preset tables | no (What's New stripped) |
| 8c0af2f, c3dbc21, 210ade8 | Sandbox mode, editor, promise bridge | app.js and Grid.js hooks | no |
| b2ca7d4 | Projectile Override plugin | Grid.js import L4, settings; app.js panel and search | no |
| 0419d3e | Encounter infoboxes, NPC menuColor, floor graphics | Grid.js `eHe`, context menu | no |
| 4ac2664 | Blindfold, Skybox | app.js panel, `pluginStore.js` | no |
| 8629243, 578baa1 | Fight held while Plugins panel open; label over scene | app.js L50737, L52133; `pluginsPausedHint.js` | **no** |
| 65814d9 | Loading screen fades on scene-ready | app.js `zpe` L19193 | **no** (upstream 1800/3300 ms) |
| aa96071 | Per-tick perf: Attack Ranges cache, lazy state, single recorder and tracker, memo | listed in §3-A.4 | **no** (upstream still `useRef(new …)`) |
| e6f2213 | Defence Tracker | Grid.js import L5, `eHe`; app.js panel | no |
| 7cc06cd | Mechanics choices `wrap` / `isOffered` | Grid.js `k$e`; Grid.css | no |
| 715be9b | Lobby encounter book (branch only) | Grid.js `pickLobbyObject`; `client/lobby/*` | no (upstream lobby uses NPCs) |
| 3b0484d | Catalog picker as a module (branch only) | `client/ui/*`; app.js shim | upstream has a different `EncounterPicker.tsx` |
| 7ea8730 baseline | Attack Ranges plugin, zebak/toa SEO entries, `zebakSoundSearch` | Grid.js L3, `Yse`; app.js `Qfe`, L16 | no |

Tests that guard these: `test/test-plugins-panel-pause.mjs`, `test-attack-ranges.mjs`, `test-encounter-picker*.mjs`, `test-lobby-book.mjs`, `test-fixture-encounter.mjs`, `test-projectile-override-scene.mjs`, the sandbox tests, and the determinism harness. They must still pass after any rename or split. Renames done with `tools/rename-bindings.mjs` are scope-checked; a split must keep the chunk's import order.
