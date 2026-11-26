# OpenScim × upstream Scim.GG source — combined mapping and plan

Upstream: https://github.com/scimgg/scimgg @ f1cab1f (squashed release 2026-11-24, TypeScript).
Ours: the bundles scraped 2026-11-20, reconstructed, then ~80 PRs of our own.
Area reports beside this file: engine-core.md, combat-rules.md, encounters.md
(+ encounters-*.md), renderer-cache.md (+ 3 .tsv maps), ui-app.md, data-tooling.md.
Licensing is handled separately and is out of scope here.

## 1. Verdict

- Upstream is the source our bundles were compiled from, about four days newer.
  It has been cut down for standalone use: no accounts, replay sharing, hiscores,
  SEO pages, What's New or `/api/` calls.
- No reconstruction errors were found in any of the six areas. The engine's tick
  order, RNG (mulberry32/fmix32), combat maths and the order of its random draws,
  replay format (bootstrap v14), wave tables, seed salts and data values all match.
- Almost every difference is our own work. Three behaviour changes upstream made
  after the beta, plus a few small fixes, are listed in §3.
- **Strategy: keep our tree; use upstream to supply names, structure, comments and
  tests.** Do not replace any component wholesale. Every area has our fixes,
  performance work or encounter hooks that upstream lacks (§5).

## 2. Workstreams: readability only, no behaviour change

Rule for every PR in this section: renames and moves only, and **every determinism
digest stays identical**. This is the same proof standard phase 6 already uses.

| # | Work | Source map | Effort | Notes |
|---|---|---|---|---|
| W0 | **Upstream name oracle tool**: feed the mapping TSVs into `tools/rename-bindings.mjs` / `rename-members.mjs`; correct `tools/names/` (about 28% of inferred entries are wrong; 3.7–4.3k of 6,685 entries can be mapped) | data-tooling.md §5, all *.tsv | M | Do first; it drives W1–W6 |
| W1 | **rendering.js**: all 89 lettered `SceneCompositor` methods, `NpcInstanceManager`, the scenes and `CacheManager` (55/55) get their upstream names; matching subclass overrides follow automatically | renderer-cache-methods.tsv, -classes.tsv, -toplevel.tsv | S | Biggest readability gain per hour |
| W2 | **Grid.js / application.js hubs**: `mse`→`useSimulationWiring`, `kIe`→`useReplay`, `HAe`→`ReplayRecorder`, `eCe`→`AppShell`, `qwe`→`useEncounterManager`, `Ake`→`useRouting`, `mn`→`Grid`, `cfe`→`PluginsPanelContent`; then about 400 more high-confidence names | ui-app.md §2 | S then M | Then split the chunks along upstream file boundaries (each upstream file is one contiguous range), leaf modules first (L) |
| W3 | **Engine**: about 130 of 138 inferred members have upstream names (e.g. `applyBlockedHit`→`applyZeroImpact`, `isActorInWorld`→`isCurrentActorInstance`); upstream's band comments; split `SimulationEngine.js` along upstream modules (timers, statLevels, inputOps, itemActions…) | engine-core.md §2, §5 | M | Upstream's `simulationEngineFactory` is our `createSimulationEngine.js`. Retire our shim name first to avoid the clash. Seven pure modules (random, decisions, TickEventBuffer, WorldState, occupancy, attackRange, projectiles) could be replaced by upstream outright; renaming is equivalent and safer. |
| W4 | **Combat**: `isNpcBindImmuneAtTick`→`isNpcFreezeImmune`, `tryLaunchContinuationAttack`→`processSupplementalHitRequest`; named constants; "do not change" comments; optionally split `launch.js` / `specialAttacks.js` | combat-rules.md §5 | S–M | Our `planPlayerAttack` ≠ upstream's `planPlayerAttack`, so both renames go in one commit |
| W5 | **Encounters**: registry API, Inferno, Yama and Sol Heredit names and evidence comments; Yama magic numbers named | encounters*.md §5 | S–M | Rename our picker `encounters/catalog.js` first: upstream's `catalog` means something else |
| W6 | **Data**: two wrong names in `combatSpells.js`, item-family names | data-tooling.md §5 | S | `getWeaponCategory` means different things in the two trees, so do it as one atomic swap |
| W7 | **Port upstream's unit tests** as rule tests (formulas, prayer drain, poison, pursuit, occupancy, replay timeline…) into our harness or `node:test` | engine-core / combat-rules §4 | M | Closes the open ROADMAP phase 4 item "engine tests that assert game rules" |

Tooling (data-tooling.md §6): no wholesale move to TypeScript, Vitest or Biome.
TypeScript would break our test markers and harness loader, and the Biome
formatter would break `split-chunk --verify`. Adopt `// @ts-check`, Biome
lint-only, and upstream's `check-lockfile`.

## 3. Behaviour decisions: one PR each, digests re-recorded in that PR only

| # | Change | Evidence | Digests | Recommendation |
|---|---|---|---|---|
| B1 | **Red-X hold** (`client/engine/npcState.js:200`): ours holds an NPC only while the player attacks *that* NPC. Upstream (`src/core/npcCombatMovement.ts:15-28`) holds it when the NPC targets the player, the player stands under it, and the player has **any** active attack **or a pending Take**. | Upstream: wiki oldid, a doc and tests. Verified by me. | Every encounter's, where the player stands under an NPC | Adopt, as an engine PR of its own (AGENTS.md: engine change first) |
| B2 | **Base Yama beat 3**: snap only in cycle 0, then cast alongside the fireball | `src/npcs/yama/timing.ts:36-47`, capture-backed. Verified by me. | Yama, from tick ~95 | Adopt |
| B3 | **Yama void flare** after a melee swing: 17 ticks upstream, 25 ours | `yamaP3/contractConfig.ts:31-37` | Yama | Adopt with B2 |
| B4 | **Colosseum Solarflare**: upstream's Run A capture shows a hit only when the orb *leaves* the player's tile, for 10–20 at every tier. Ours (981176e, #43, from the wiki) hits on contact and scales damage by tier. | Capture is solid for tier III, medium for I/II | Colosseum | **Your call.** Partly reverts #43; keep the four orbs per pillar, True Tile overlay and practice tools. |
| B5 | **Colosseum totems and bees**: Run A shows one totem per monster at half HP, and bees 5 ticks after the wave message | encounters-sol-colosseum.md | Colosseum | Your call, with B4 |
| B6 | **Idle turn animation**: upstream uses `turn180`, we use the table's `standTurn`; they differ for 119 of 476 weapons | renderer-cache.md §3 | none (render) | Adopt |
| B7 | **OpenRS2 download retry** on sha256 mismatch | renderer-cache.md §3 | none | Adopt |
| B8 | Small UI ports: sprite memory budget, late-asset observer, stricter replay-presentation checks | ui-app.md §3 | none | Adopt opportunistically |
| — | **Dizana's quiver**: upstream gives the bonus only when the ammo is in the quiver; ours gives it from either slot | not verified against the wiki | combat | **Do not adopt until checked** |
| — | **Cache 2772** (upstream) vs our 2762 | — | ids may move | Separate decision; not needed for anything above |
| — | Six damage/gate/accuracy kinds with no producer (ROADMAP) | upstream has none either; only its tests use them | — | Port those tests (W7) or delete the kinds |

## 4. Order

1. W0 (oracle tool + ledger fix). In parallel: B1 as its own engine PR.
2. W1 (rendering.js names) and W2 hubs, which give the most readability.
3. W3–W6 renames, area by area; each PR keeps digests identical.
4. B2+B3 (Yama), B6, B7; decide B4/B5.
5. W2 split of Grid/application along upstream files; W7 tests.
6. Licensing, handled separately.

## 5. Our progress that must survive (consolidated from each report's §7)

Upstream has none of these; any "replace with upstream" would lose them:

- **Engine seams**: `isPlayerAttackProtected` / `deactivateAllPrayers` (#51), `attackOnCooldown` (#22), `playerAttackKeepsReady` (#48), `delayNextAttack` (#47), `hit.sourceId` (#49); pre-release hooks `approachRange`, `moveDisplacedPlayer`, `playerDamageOnNpc`, `playerAlwaysAccurate`, `isTombsOfAmascut`, `attackObject`; thralls; equip level gates; enchanted-bolt graphics; replay share limits.
- **Combat**: all eight enchanted bolts + Zaryte crossbow, Keris partisan of the sun crit, ToA rules, Magic Dart on a Slayer's staff (e), spec prayer-restore cap, corrupted Gauntlet staffs (#50).
- **Encounter framework**: self-registering directories (#26), descriptor menu data (#33), kinds table from the registry (#34), every encounter we added, Sandbox (#2, #13, #20, #37, #49).
- **Renderer/cache**: v3 model face bias (#46), mesh eviction (#63), mesh upload stamps + spot-anim visibility cache (#76), tile overlays as one mesh (#62), `manifest.json` no-cache (#58), `weaponVisuals` seam (#52), widget model poses (#32), overlay scaling (#3, #5).
- **UI**: per-tick memos (#67), Plugins panel pause (#68/#79), loading screen faded on scene ready, plugins, encounter book/picker (feat/encounter-book), What's New, backend client + API contract (ui-app.md §4).
- **Data**: our 3,136-monster table (upstream keeps 23), extra specials and category rows.
- **Tooling**: determinism harness and digests, import-graph check, test markers, asset pipeline + stale-cache guard (#41), per-encounter cache groups (#24).
