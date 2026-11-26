# Mapping report: data tables, naming ledger and project tooling (AREA = data-tooling)

- O = `C:\_Development\openscim` (read-only, HEAD `3b0484d`, branch `feat/encounter-book`)
- U = `...\scratchpad\upstream\scimgg` (5 commits; the code is one squashed release `3639203`, 2026-11-24, so there is no history of the beta era)
- Comparison scripts (read-only, rerunnable): `scratchpad\mapping\tools\compare-data.mjs`, `compare-equip2.mjs`, `compare-tables.mjs`, `compare-weapons.mjs`, `ledger-stats.mjs`. Their output is in `compare-data.out.txt` and `ledger-stats.out.txt` next to them.

## 1. Summary verdict

**It is the same lineage, and upstream's data is slightly newer than our beta scrape.** All seven of our `client/data` modules and both `client/util` modules are upstream code. The minifier renamed their identifiers. Their statements, schemas and literals are unchanged.

- **Matching tables:** every value checked numerically is identical for the 23 monsters, 48 spells, 54 spot anims, 101 special attacks, 23 weapon-category definitions, 100 item→category entries, 9 staff autocasts and 189 combat families. The lookups are the same code in both trees: `monsterStats.js` vs `monsterData.ts`, `equipment.js` vs `equipmentCatalog.ts`, `combatSpells.js` vs `spellCatalog.ts`, `getSpecialAttackDefinition` vs `getSpecialAttackDef`, and `packHsl` in both trees.
- **Where upstream is newer:** upstream regenerated the equipment metadata after the beta. It adds a `version` to 492 ids and drops 531 ids that cannot be worn. It also removed 6 combat families keyed on items that cannot be worn.
- **Where upstream is stripped:** upstream's `Logger.ts` has no breadcrumbs and no error sink. The beta had them, so the open-source release probably removed its error reporting.
- **What is ours:** 5 special attacks, 13 weapon→category rows, the corrupted Gauntlet weapons (`41bfc6e`), the full 3,136-row monster table, and the whole tooling and test stack. Upstream keeps only 23 monsters, filtered to the NPCs it can spawn, so its `monsters.json` cannot replace ours.
- **Tooling is wholly different:**
  - Upstream: TypeScript, Vitest, Biome, `tsx` scripts, a licence gate and a lockfile gate, and a setup pipeline that fetches a pinned openrs2 cache.
  - Ours: plain JS; Playwright tests under `node --test`; a determinism digest harness; checks of the import graph and test markers; and AST rename and split tools.
- **Licensing:** handled separately; not part of this report.

## 2. Mapping table

Confidence for the data rows is **high**: the values are identical (script-verified) and the code is the same statement for statement.

| Ours (file:line / symbol) | Upstream (file:line / symbol) | Conf. | Notes |
|---|---|---|---|
| `client/data/monsters.js:1` `monsters` (3,136 rows) | `src/data/osrs/monsters.json` (23 rows) via `src/data/monsterData.ts:44` `monsters` | high | All 23 upstream rows are byte-identical in ours. Upstream filters with `collectCacheRoots(discoverCacheUsage())` (`scripts/sync-osrs-data.ts:546`). |
| `monsters.js:138896` `monsterByNpcTypeId` / `monsterByNpcTypeIdAndVersion` | `monsterData.ts:46-47` `monsterById` / `monsterByIdAndVersion` | high | same loop |
| `monsters.js:138908` `getMonsterName` | `monsterData.ts:55` `getMonsterName` | high | exact |
| `client/engine/monsterStats.js:2` `getMonsterHitpoints` | `monsterData.ts:59` `getMonsterHp` | high | |
| `monsterStats.js:5` `getMonsterFormulaStats` | `monsterData.ts:63` `getMonsterFormulaStats` | high | exact; same body |
| `monsterStats.js:40` `applyMonsterStatOverride` | `monsterData.ts:107` `applyMonsterStatOverrideToFormulaStats` | high | upstream's JSDoc: flat_armour and hp are dropped |
| `client/data/equipment.js:2` `syncedEquipmentEntries` | `src/data/osrs/equipment.json` imported as `generatedEquipment` (`equipmentCatalog.ts:2`) | high | the data differs, see §3 |
| `equipment.js:32117-32152` (6 manual entries with `_why`) | `src/data/osrs/manualEquipment.json` | high | same 6 entries |
| `equipment.js:32154` `canonicalEquipmentIdByVariantId` | `src/data/osrs/itemAliases.json` → `aliases` (`equipmentCatalog.ts:44`) | high | 1,089 identical; ours has 331 extra (the dropped ids) and 1 different |
| `equipment.js:32092` `equipmentSlotSchema` | `equipmentCatalog.ts:6` `equipmentSlotSchema` | high | exact |
| `equipmentEntrySchema` / `equipmentEntriesSchema` / `canonicalIdByVariantIdSchema` | `equipmentRowSchema` / `equipmentRowsSchema` / `itemAliasesSchema` | high | |
| `equipmentEntries` / `equipmentDefinitionById` / `variantIdsByCanonicalEquipmentId` / `equipmentDefinitions` | `rows` / `equipmentById` / `aliasIdsByCanonicalId` / `equipmentCatalog` (`equipmentCatalog.ts:43-73`) | high | |
| `getEquipmentDefinitions` / `getEquipmentDefinition` / `getItemName` / `getInventoryActions` | `getEquipmentCatalog` / `findEquipmentCatalogItem` / `resolveEquipmentItemName` / `resolveInventoryActions` (`:77-102`) | high | upstream also has `resolveDefaultInventoryAction` (`:109`), which our bundle lacks or inlined |
| `getCanonicalEquipmentId` / `getEquipmentVariantIds` | `getCanonicalEquipmentItemId` / `getEquipmentAliasIds` (`:119,123`) | high | upstream JSDoc: "Generated metadata identity only; use equipmentCombatFamilies for curated same-state combat identity" |
| `client/data/itemVariants.js:3` the anonymous `for … of [...]` list | `src/data/equipmentCombatFamilies.ts:8` `EQUIPMENT_COMBAT_FAMILIES` | high | upstream has a Wiki URL per group; ours has 6 extra groups |
| `itemVariants.js:1-2` `baseItemIdByVariantId` / `variantIdsByBaseItemId` | `equipmentCombatFamilies.ts:251-252` `baseIdByVariantId` / `variantIdsByBaseId` | high | |
| `itemVariants.js:838` `getBaseItemId` | `equipmentCombatFamilies.ts:261` `getEquipmentCombatBaseId` | high | upstream also exports `getEquipmentCombatVariantIds` (`:266`) |
| `client/data/spotAnimIds.js:1` `spotAnimIds` | `src/rs/config/spotanimtype/SpotAnimID.ts:6` `SpotAnimID` | high | 54/54 identical; upstream header cites RuneLite `SpotanimID.java` |
| `client/data/specialAttackDefinitions.js:51` `specialAttackDefinitionByWeaponId` | `src/core/combat/player/specialAttacks/registry.ts:50` `SPECIAL_ATTACK_REGISTRY` | high | 101/101 shared entries identical; upstream carries a Wiki citation per entry |
| `elderMaulSpecial` / `accursedSceptreSpecial` / `abyssalTentacleSpecial` | `ELDER_MAUL_SPECIAL_ATTACK` / `CONDEMN` / `BINDING_TENTACLE` (`registry.ts:5,14,26`) | high | upstream also has `VOIDWAKER_SPECIAL` (`:36`), inlined in ours |
| `zaryteCrossbowSpecial` (`:47`) | none | high | ours |
| `getSpecialAttackDefinition` / `hasSpecialAttack` (`:632,643`) | `getSpecialAttackDef` / `hasSpecialAttack` (`registry.ts:409,414`) | high | same 28688 animation override |
| `client/data/weaponCategories.js:4` `weaponCategoryDefinitions` | `src/types/attackStyles.ts:42` `WEAPON_CATEGORIES` | high | 22/23 identical; see the staff icon in §3 |
| `weaponCategories.js:601` `weaponCategoryByItemId` | `attackStyles.ts:244` `ITEM_WEAPON_CATEGORY` | high | 100 shared, 13 ours |
| `weaponCategories.js:710` `defaultSpellNamesByStaffId` / `:740` `getDefaultStaffSpell` | `attackStyles.ts:383` `WEAPON_DEFAULT_AUTOCAST` / `:397` `getDefaultAutocastSpell` | high | both names marked "inferred" in the ledger |
| `defaultCombatStyleByCategory` / `getDefaultAttackStyleIndex` / `isCastingStyleSelected` / `getActiveSpell` | `CATEGORY_DEFAULT_COMBAT_STYLE` / `getDefaultAttackStyleIndex` / `isCastingStyle` / `resolveActiveSpell` (`:404-469`) | high | |
| `getWeaponCategory` (returns the **key**) / `getWeaponCategoryOrUnarmed` / `getWeaponCategoryDefinition` | `findWeaponCategoryKey` / `getWeaponCategoryKey` / **`getWeaponCategory`** (returns the **definition**) (`:493-501`) | high | **trap:** `getWeaponCategory` means different things in the two trees |
| `client/data/combatSpells.js:2` `combatSpells` | `src/data/osrs/spells.json` → `generatedSpells` | high | 48/48 identical |
| `spellSecondaryEffectSchema` / `parsedCombatSpells` | `secondaryEffectSchema` / `spells` (`spellCatalog.ts:44,51`) | high | |
| `unsupportedSpellNames` / `fixedHitDelayBySpellName` / `multiTargetSpellNames` | `NON_AUTOCAST_SPELLS` / `FIXED_HIT_DELAY_SPELLS` / `MULTI_TARGET_ANCIENT_SPELLS` (`:79,99,105`) | high | our name "unsupported" is wrong: the list is of spells that cannot be autocast |
| `getSpellIconName` / `getCombatSpellsOfSpellbook` / `isCombatSpellName` / `isSupportedCombatSpell` / `getSpellDefinition` | `spellIconName` / `getAutocastableSpells` / `isCastableSpell` / `isAutocastableSpell` / `getSpellCastInfo` (`:127-161`) | high | upstream names constants `DEFAULT_SPELL_ATTACK_RANGE`=10 and `SPELL_CAST_SPEED`=5; ours inlines `attackRange: 10` |
| `client/util/logger.js` `logger`, `LogLevel`, `logLevelByName`, `logLevelLabels` | `src/util/Logger.ts` `log`, `enum LogLevel`, `LEVEL_NAMES`, `LEVEL_LABELS`, `type LogCategory` | high | upstream has no breadcrumbs or error sink (§3) |
| `client/util/packHsl.js` `packHsl` | `src/rs/util/ColorUtil.ts:110` `packHsl` | high | identical; upstream comment: "RS reduces saturation at high lightness values" |
| `package.json` scripts `dev/build/test/assets` | `package.json` `setup/predev/dev/build/test/test:unit/test:integration/typecheck/format/lint/check/check:licenses/check:lockfile/check:cache-runtime` | — | §4 and §6 |
| `vite.config.js` (`trimmedCacheIsCurrent`, `missingMediaIs404`, `copyRuntimeFiles`) | `vite.config.ts` (`dev-server-access`, `vitestJsonFromDiskPlugin`, `contentTypeFix`, `assetCache`, `react()`, `glsl`, `licenseNoticesPlugin`, Vitest block) | — | same purpose, no shared code |
| `tools/fetch-assets.mjs` + `tools/assets/*` | `scripts/setup.ts`, `fetch-cache.ts`, `pinnedCache.ts`, `trim-cache.ts`, `discoverCacheUsage.ts`, `cacheRoots.ts`, `fetch-item-icons.ts`, `scripts/assets/sprite-manifest.json` | — | same idea (fetch + verify + trim); the implementations are independent |
| (none) | `scripts/sync-osrs-data.ts` (608 lines), `sync-osrs-spells.ts` (456 lines) | — | the generators of our tables (§4) |

## 3. Behavioural divergences

| # | What differs | Ours | Upstream | Classification | Determinism impact |
|---|---|---|---|---|---|
| D1 | Equipment metadata: 492 ids lack the `version` upstream gives them (title qualifiers such as "Castle Wars", "red platebody", "ogre bowman") | `equipment.js` rows, e.g. ids 426, 2978-2995, 4068-4072 | `equipment.json` | **Upstream changed since the beta**: the qualifier rule in `docs/legal/data-provenance.md` "Version pairing" | None. `version` is only shown in the UI and used as a lookup key; no rule reads equipment `version`. |
| D2 | 531 ids that cannot be worn are in our catalog and missing upstream: broken pickaxes and axes (466-506), Barrows `0` pieces (4860-4998), "Sled (Unwaxed)" 4083, and others. 331 aliases go with them, and alias `25282` points to 4083 in ours and 4084 upstream. | `equipment.js` | `equipment.json`, `itemAliases.json` | **Upstream changed**: "Unequippable ids dropped" in data-provenance | Effectively none: the items cannot be worn. `getEquipmentDefinition(id)` now returns `undefined` for them, which changes the Wield/Wear fallback in `getInventoryActions` and the item-name fallback. Rerun the harness to confirm. |
| D3 | 6 combat families for items that cannot be worn (`4860→30543`, `4866→30574`, `4872→30545`, `4878→30547`, `12924→28687` (empty blowpipe ← blazing blowpipe), `12929→13196,13198` (uncharged serpentine)) | `itemVariants.js:441,489,513,537,561,745` | absent; `docs/architecture/equipment-combat-families.md:45,51`: empty and broken forms "cannot be worn and are not in the catalog" | **Upstream changed** (a cleanup) | Small. In ours, `getBaseItemId(28687)` returns 12924 (empty blowpipe); upstream returns 28687 itself. Both have no special or category entry under either id, so the result is the same unless one is added later. |
| D4 | Staff "Defensive Casting" style: ours has `icon: "staff_spell_defensive.png"`, upstream has no icon | `weaponCategories.js` (staff styles) | `attackStyles.ts` `staff` | ours or beta: it is in the import commit `7ea8730`, and the squash leaves no earlier history to say which | None (UI only) |
| D5 | Special attacks only in ours: 27291 Keris partisan of the sun (`instantEffect: "tumekensLight"`), 26374/27186 Zaryte crossbow (`zaryteCrossbowSpecial`), 30955 Arkan blade, 24425 Eldritch nightmare staff (Invocate) | `specialAttackDefinitions.js:66,285-286,346,368` | absent; upstream `equipmentVerification.ts:350`: `24425: ['Special attack unavailable.']` | **Ours**, in `7ea8730`. Covered by `test/test-keris-special.mjs`, `test/test-zaryte-crossbow.mjs` and determinism `tools/determinism/scenarios/engine.mjs:971,993,1016` | Replacing them would change digests and break those tests |
| D6 | 13 weapon→category rows only in ours: 23849-23857 corrupted Gauntlet halberds, staves and bows; 4170/21255 Slayer's staff; 27291 partisan; 30955 slash_sword | `weaponCategories.js:602-616,680-681` | absent | **Ours**: `41bfc6e` (Gauntlet, #50); the others are in `7ea8730` | Would break `test-corrupted-gauntlet-weapons.mjs`, the Hunllef and engine scenarios |
| D7 | Logger: ours keeps the last 30 lines as breadcrumbs (`addBreadcrumb`, `formatBreadcrumbMessage`, `describeLogValue`) and has an error sink (`setErrorSink`, `getBreadcrumbs`, `clearBreadcrumbs`) | `client/util/logger.js:31-63,131-187` | `src/util/Logger.ts`: neither | **Beta feature that upstream stripped** (probably error reporting removed for the open-source release). The beta is not newer in general, but this piece is. | Our determinism scenario `shared/logger-and-colour` calls those methods. Keep them. |
| D8 | Logger export name: `logger` (ours) vs `log` (upstream); `LogLevel` is a frozen object in ours and a TS `enum` upstream | `logger.js:64,230` | `Logger.ts:1,207` | the bundle's name | none |
| D9 | Monster table scope: ours has 3,136 rows, the whole Wiki bucket. Upstream keeps 23 rows, those reachable from its NPC roots. | `monsters.js` | `monsters.json` | **Upstream changed** (a filtering step was added to sync, or the beta shipped the unfiltered table) | Replacing ours would remove the stats of every one of our own encounters (Zebak, DT2 bosses, Araxxor, Hydra, Hunllef, Doom, Colosseum, sandbox), which CONTRIBUTING calls `TABLE` |
| D10 | Spells data | `combatSpells.js` | `spells.json` (rebuilt 2026-11-24, revision ids recorded) | **identical** (48/48) | none |

No reconstruction errors were found in the data tables. Every difference is either an upstream change or one of ours.

## 4. Pieces only in ours, and only in upstream

**Only in ours, in this area:**
- The other 3,113 monster rows: needed by our encounters and the sandbox.
- Specials 24425, 26374/27186, 27291, 30955, and 13 category rows (D5, D6).
- The logger's breadcrumbs (D7).
- Tooling:
  - `tools/determinism/` harness and digests, one file per scenario (`a1bda56`, #23).
  - `tools/check-import-graph.mjs`, `tools/check-test-markers.mjs`, `tools/run-tests.mjs`.
  - `tools/rename-bindings.mjs`, `rename-members.mjs`, `name-called-functions.mjs`, `split-chunk.mjs` (with `--verify` for character-for-character equality), `replace-static-defines.mjs`, `replace-define-field.mjs`, `repoint-imports.mjs`, `inline-string-tables.mjs`.
  - `tools/fetch-assets.mjs`, `tools/assets/*` (sha256 or pixel-hash verified, stand-ins, cache groups per encounter `1ab3ba5`, stale trimmed-cache refusal `ddb08aa`).
  - `tools/cache-objects.mjs` (`66bb246`), `tools/time-startup.mjs`, the Zebak packers.
- `tools/names/` (51 files).
- Docs: `docs/ARCHITECTURE.md`, `ADDING-AN-ENCOUNTER.md`, `COLOSSEUM.md`, `SANDBOX.md`.

**Only in upstream (worth knowing):**
- **Generators:**
  - `scripts/sync-osrs-data.ts`: the Wiki Bucket API (`infobox_bonuses` ⋈ `infobox_item`, `infobox_monster`). It pairs versions, drops ids the cache cannot equip, derives aliases mechanically and filters monsters to the NPC roots.
  - `scripts/sync-osrs-spells.ts`: wikitext with revision ids, and `--check`.
  - `scripts/verify-equipment-params.ts`: cache param ids checked against Wiki witnesses.
  - `scripts/equipmentParamWitnesses.ts`.
- **Answer to deliverable (a):** the tables are generated, not hand-written. The exceptions are `manualEquipment.json` (6 entries, each with a `_why`) and the hand-curated families, specials and categories in TS, each with a Wiki citation. Equipment bonuses come from cache opcode 249 params (`src/types/equipmentStats.ts`), not from the Wiki.
- **Gates:** `scripts/check-licenses.ts` + `licensePolicy.ts` + `licenseNotices.ts` (emits `dist/licenses.txt`), `vendoredNotices.ts` (1,295 lines of verbatim notices), `check-lockfile.mjs` (lockfile source allow-list), `check-trimmed-cache.ts`, `cache-runtime.check.ts`.
- **Data modules we lack entirely** (they belong to other areas, but sit in `src/data`): `equipmentSupport`, `equipmentVerification`, `itemRequirements`, `weaponAnimations`, `weaponCombatVisuals.generated`, `spellRunes`, `spellVisuals`, `playerPresets`, `itemEffects`, `tips`, `shortcuts`, `pluginKeybinds`, `customEquipmentPresets`, and others. Their bundle equivalents (weapon animations, projectile tables) still sit in `rendering.js`.
- **Docs:** `docs/legal/data-provenance.md`, `THIRD_PARTY_NOTICES.md`, `docs/agent-reference.md`, `docs/architecture/equipment-combat-families.md`, plus a facts-spec and open-questions pair per encounter.
- **`src/types`:** Zod or TS types for `monsterStatOverride`, `encounterLoadout`, `player`, `playerState`, and others.

## 5. Readability wins and the naming ledger

### 5a. Names to take, in priority order

1. **The weapon-category trio.** Rename it as one atomic cycle, because `getWeaponCategory` swaps meaning: ours `getWeaponCategory`→`findWeaponCategoryKey`, `getWeaponCategoryOrUnarmed`→`getWeaponCategoryKey`, `getWeaponCategoryDefinition`→`getWeaponCategory`. If someone renames one at a time, behaviour will break silently. One option is to keep our three names and document the mapping; that is safer and gains almost nothing in readability by changing.
2. **Spell catalog.** Our ledger names are semantically wrong here:
   - `unsupportedSpellNames`→`NON_AUTOCAST_SPELLS`
   - `isSupportedCombatSpell`→`isAutocastableSpell`
   - `getCombatSpellsOfSpellbook`→`getAutocastableSpells`
   - `isCombatSpellName`→`isCastableSpell`
   - `getSpellDefinition`→`getSpellCastInfo`
   - plus the constants `DEFAULT_SPELL_ATTACK_RANGE` and `SPELL_CAST_SPEED`.
3. `getBaseItemId`→`getEquipmentCombatBaseId` and `itemVariants.js`→`equipmentCombatFamilies.js`, with upstream's JSDoc ("identity only, never a support whitelist"). Bring the per-group Wiki citations too (MIT code; the citations are facts).
4. The `specialAttackDefinitions.js` per-entry Wiki citations and capture notes (`registry.ts:13-60…`). Take the comments, not only the names: they document `defenceStyle` sourcing (`/w/Special_attacks` rev 15350782).
5. Equipment lookups: `findEquipmentCatalogItem`, `resolveEquipmentItemName`, `resolveInventoryActions`, `getEquipmentAliasIds`, and upstream's JSDoc on `resolveInventoryActions` (why the Wield/Wear fallback exists).
6. `spotAnimIds`→`SpotAnimID`, with the RuneLite source header. `monsterByNpcTypeId` is a fine name; the upstream `monsterById` is not better.
7. Logger: keep the file. Optionally rename `logger`→`log` and add the `LogCategory` list as JSDoc.

### 5b. Ledger audit: deliverable (b), and where upstream contradicts our "inferred" names

**Ledger size** (`ledger-stats.mjs`): 51 files, **6,685 entries**, of which **2,189 are marked inferred (33%)**. That is 345 inferred in the bindings, members and called-functions files, and about 1,844 in the locals files (`engine-locals.json` alone: 878 of 2,290).

**Sample audit**, 25 inferred entries from bindings and members, checked against upstream definitions:

| Our inferred name | Upstream real name | Verdict |
|---|---|---|
| `setCombatSupplies`, `getNpcs`, `consumeInventoryItem`, `getAttackStylePerCategory`, `hasActivePrayer` | same | exact (5) |
| `applyFreezeOnLaunch` | `applyFreezeAtLaunch` (`CombatSystem.ts:613`) | near |
| `removePendingHit` | `removeQueuedHit` (`:846`) | near |
| `toNonNegativeInteger` | `normalizeNonNegativeInt` (`:1232`) | near |
| `findNextNpcByProcessingOrder` | `nextNpcInProcessingOrder` (`SimulationEngine.ts:1640`) | near |
| `emitOnKillTargetGraphic` | `emitSpecOnKillGraphic` (`:2105`) | near |
| `deactivateProtectionPrayer` | `removeProtectionPrayer` (`:2809`) | near |
| `executeEquipmentOp` | `applyEquipmentOp` (`:3017`) | near |
| `tickPoison` | `processPoison` (`:3411`) | near |
| `applyBootstrap` | `applyRunBootstrap` (`:3619`) | near |
| `canExecuteEncounterCommand` | `acceptsEncounterCommand` (`:3901`) | near |
| `getDefaultStaffSpell` | `getDefaultAutocastSpell` | near |
| `defaultSpellNamesByStaffId` | `WEAPON_DEFAULT_AUTOCAST` | near |
| `computeUnequipResult` | `previewUnequipState` (`:1197`) | near |
| `isPendingHitValid` | `isStillDeliverable` (`:796`) | miss |
| `applyBlockedHit` | `applyZeroImpact` (`:1144`) | miss |
| `tryAttack` | `processAttack` / `canAttack` (restructured) | miss |
| `advanceNextEventIdPast` | `continueEventIdsAfter` (`:1275`) | miss |
| `getEnabledIntroConfig` | `setupIntro` (`:1017`) | miss |
| `isCombatSpellName` | `isCastableSpell` | miss |

Tally: **exact 5/25 (20%), near 13/25 (52%), miss 7/25 (28%).** In "near" cases the concept is right and the wording differs. In "miss" cases the concept or framing differs.

**Names backed by evidence (not "inferred")**, from the data-tables ledger checked against §2: about 6 of 50 are exact (12%), for example `getMonsterName`, `getMonsterFormulaStats`, `equipmentSlotSchema`, `getDefaultAttackStyleIndex`, `hasSpecialAttack`, `packHsl`. The rest are descriptive synonyms. Two are misleading (`unsupportedSpellNames`, `isSupportedCombatSpell`) and one is a semantic trap (`getWeaponCategory`).

**Overall:** our names agree with upstream's meaning about 70% of the time, and match it exactly only about 15–20% of the time. An oracle would therefore *change* roughly 80% of the names it can align, but would *correct a real error* in only about 25–30% of them.

**How much an oracle could auto-correct:**
- Bindings, members and called functions (about 1,450 entries): most of the data, util, shared and encounter top-level functions align with high confidence (same statements). The engine classes are partly restructured upstream: CombatSystem has `processAttackRequest` and `PrevalidatedAttackRequest`, so methods we split or merged do not align. **Estimate: 75–85% alignable.**
- Locals (about 5,200 entries): alignable only inside aligned functions whose bodies are unchanged. **Estimate: 50–65%.**
- **Net estimate: about 3,700–4,300 of the 6,685 entries can be auto-mapped to an upstream name, of which about 1,000–1,300 are inferred entries whose meaning upstream corrects.**

**Oracle tool sketch** (`tools/upstream-names.mjs`, read-only proposer):
1. **Parse upstream.** Run `@babel/parser` with `plugins: ["typescript","jsx"]` over `U/src/**/*.ts{,x}`. Strip types in the AST: drop annotations and `satisfies`, and turn `enum` into an object literal, matching what our bundle contains. There is no need to compile.
2. **Fingerprint every function, method, class and top-level `const`.** Use:
   - the multiset of property names (they survive minification: `nextActionTick`, `postHitEffects`);
   - string and number literals (log tags, error messages, ids);
   - callee property names;
   - the AST node-type sequence with identifiers erased;
   - the parameter count.
3. **Fingerprint ours the same way.** Take our current names, plus the minified names recorded as keys in `tools/names/*.json`.
4. **Match in rounds.**
   1. Exact fingerprint.
   2. Unique literal or property-set anchor (best-match with a Jaccard threshold).
   3. Propagate: for the callees and callers of an aligned pair, align by call position.
   4. Inside an aligned pair whose bodies are equal after identifier erasure, map params and locals by binding order (declaration order and scope path, the same keys as `rename-bindings --locals`, `name#2`).
5. **Emit proposals in our ledger format:** `{ file: { currentName: [upstreamName, "upstream: src/…/X.ts:LINE (fingerprint=exact|anchor|propagated, score)"] } }`. Write them to `tools/names/upstream-*.json`, and keep a diff report listing the inferred names that change.
6. **Apply** with our existing `rename-bindings.mjs`, `--locals` and `rename-members.mjs`, which already refuse collisions and follow scope. Guard rails:
   - Never rename object keys that digests or snapshots see (ARCHITECTURE's rule about Yama and Sol state fields).
   - Handle swap chains (the weapon-category trio) with a temporary-name pass.
7. **Verify:**
   - `node tools/determinism/harness.mjs`: digests must not change, since renames are names only.
   - `tools/check-test-markers.mjs`: a test patches served source by exact line, so a rename that touches a marker line must update the test as well.
   - `tools/check-import-graph.mjs`.
   - `npm test`.

**Caveat:** upstream exists only as a squashed snapshot from after the beta. Code changed since the beta will not align. Treat fingerprint misses as "diverged" (a good input for the behaviour-divergence reports), not as unmatched names.

## 6. Recommendation per component

| Component | Recommendation | Effort | Risk | Our commits or fixes lost if replaced wholesale | Does upstream have an equivalent? |
|---|---|---|---|---|---|
| `monsters.js` | **Keep ours.** Optionally convert it to JSON later, with upstream's `sync-osrs-data.ts` extended by our NPC roots. | S (keep) / M (generator) | High if replaced | Every encounter's `TABLE` stats (Zebak, DT2, Araxxor, Hydra, Hunllef, Maggot King, Doom, Colosseum, sandbox: `#15 #19 #22 #39 #40 #47 #49 #60 #75`, …) | No: upstream has 23 rows |
| `equipment.js` data | **Port the upstream data in**: regenerate, or apply upstream's `equipment.json` + `itemAliases.json` into our module, keeping the JS-module format and the 6 manual entries | S | Low (D1/D2 are UI-only); rerun the harness | None (we have no commits on equipment.js after the import) | Yes |
| `equipment.js` lookups | Rename from upstream (§5a.5) and add upstream's JSDoc | S | Low | none | — |
| `itemVariants.js` | Rename to `equipmentCombatFamilies.js` with upstream citations, and **decide on D3** (dropping the 6 groups is harmless) | S | Low | none (no later commits) | Yes |
| `specialAttackDefinitions.js` | **Rename and port from upstream** (names and citation comments); **keep our 5 extra entries** | S–M | Low | D5 entries (`7ea8730`), tests `test-keris-*`, `test-zaryte-crossbow`, `engine.mjs` scenarios | Partial: upstream marks Eldritch "unavailable" and lacks the others |
| `weaponCategories.js` | Rename from upstream (watch the trio), **keep our 13 rows** and the staff icon | S | Medium (the name swap) | `41bfc6e` (Gauntlet rows, `test-corrupted-gauntlet-weapons.mjs`), Slayer's staff, Keris, Arkan | No |
| `combatSpells.js` | Rename from upstream (fixes misleading names); the data is identical | S | Low | none | Yes |
| `spotAnimIds.js` | Rename to `SpotAnimID`, or keep the name and add the RuneLite header | S | Low | none | Yes |
| `client/util/logger.js` | **Keep ours** (breadcrumbs, used by the `shared/logger-and-colour` scenario); optionally add the `LogCategory` JSDoc | S | Low | the breadcrumbs and the determinism scenario | No (stripped) |
| `client/util/packHsl.js` | Keep; add upstream's one-line comment | S | none | — | identical |
| `tools/names/` | Keep as the ledger; **add an upstream oracle pass** (§5b) that writes proposals; mark entries `upstream:` once adopted | M–L | Low (names only; digests guard it) | — | — |
| Determinism harness, digests, `check-import-graph`, `check-test-markers`, `run-tests`, rename and split tools, `fetch-assets` | **Keep, non-negotiable** | — | — | everything in §7 | No |
| Licence and provenance | Handled separately | | | | |
| `check-lockfile.mjs` + `lockfileSources.mjs` | Adopt (plain `.mjs`, no TS needed) | S | Low | — | Yes |
| Wiki sync scripts | Adopt as tools (run them with `tsx`, or port to `.mjs`); **do not run them against the Wiki without Weird Gloop's consent** (data-provenance §Automated access) | M | Low | — | Yes |
| TypeScript / Vitest / Biome | See §6d: **no wholesale switch now** | L | High | — | — |

### 6c. Licensing and attribution

Handled separately; not part of this report.

### 6d. Tooling deltas: deliverable (d)

- **TypeScript.** Adopting it file by file is possible (`allowJs`, `.ts` beside `.js`), but it touches our tooling:
  1. `tools/determinism/node-hooks.mjs` loads raw client files. `.ts` would need a loader, either `tsx`'s `register` or Node's type stripping (≥22.18). Upstream uses `enum`, which needs a transform, not just stripping.
  2. **`check-test-markers.mjs` plus the browser tests patch *served* source by exact line.** Vite would serve TS transformed by oxc, so a marker taken from the `.ts` text may not appear in what the browser receives. The markers would have to target the transformed output, or those modules would have to stay JS.
  3. `split-chunk --verify` and the rename tools need `@babel/parser` `typescript` (a plugin flag).
  - Recommendation: **JSDoc `// @ts-check` plus `tsc --noEmit --allowJs` on `client/engine`, `client/data` and `client/util`** as a first step. It costs nothing at runtime, serves byte-identical source, and keeps the digests and markers valid.
- **Vitest.** It fits as an *additional* unit runner for pure modules (`client/data`, `client/engine`, the encounters' rule modules). Vite already resolves `import.meta.glob` and web-root imports, which our node-hooks emulate.
  - Do **not** move the determinism harness into Vitest. It must run the unbundled modules on the real cache and stay independent of transforms (its `--dump`/`--trace` and second-tree comparison rely on plain Node).
  - Keep Playwright with `node --test` for the browser tests. Upstream's `test:unit` and `test:integration` split, and its 8-worker cap, are a good pattern.
- **Biome.**
  - Use **lint only** on modules we own (`client/encounters/**` except chunk-derived ones, `client/engine/**`, `client/plugins/**`, `tools/**`, `test/**`).
  - **Never format** `client/assets/*.js` or `client/data/*`. Reformatting would break `split-chunk --verify` character-equality, test markers and blame.
  - Upstream's config uses single quotes and a 120-column width; ours is Prettier-like with double quotes. Adopting its formatter would churn every file.
- **Package and config.**
  - Upstream pins `@biomejs/biome 2.4.8` and `typescript ^7.0.2` (the Go compiler), with `vitest ^4.1.12`, `happy-dom`/`jsdom` and `tsx`. Our deps are newer for `vite` (8.3.8 vs 8.2.2) and `zod` (4.6.6 vs 4.4.3, `168865a`).
  - Worth taking into `vite.config.js`: upstream's `dev-server-access` hardening (loopback, `cors:false`, `allowedHosts`), and `licenseNoticesPlugin` once notices exist.
  - Our `trimmedCacheIsCurrent` (`ddb08aa`), `missingMediaIs404` and the `mode === "test"` production-React switch must stay.

## 7. Our progress to preserve

Only one commit after the import touched `client/data` or `client/util`: `41bfc6e`. Everything else in this area is tooling and tests. The import commit `7ea8730` (2026-11-23) squashes all earlier history, so "ours" below also means "already in the import" where noted.

| What | Where | Commit(s) | Guard |
|---|---|---|---|
| Corrupted Gauntlet weapon categories (9 rows) and staff hits | `client/data/weaponCategories.js:602-604`, `client/engine/weapons.js` | `41bfc6e` (#50) | `test/test-corrupted-gauntlet-weapons.mjs`, the Hunllef scenario |
| Keris partisan of the sun special (`tumekensLight`) and partisan category | `specialAttackDefinitions.js:66`, `weaponCategories.js:605`, `engine/specialAttacks.js:159-160` | `7ea8730` | `test/test-keris-special.mjs`, `test-keris-passives.mjs` |
| Zaryte crossbow special and LMS copy | `specialAttackDefinitions.js:47-50,285-286`, `profiles.js:23` | `7ea8730` | `test/test-zaryte-crossbow.mjs` |
| Arkan blade special and category; Eldritch nightmare staff Invocate | `specialAttackDefinitions.js:346,368`, `weaponCategories.js:616`, `weapons.js:38`, `profiles.js:502,535` | `7ea8730` | determinism `engine.mjs:971,993,1016` |
| Slayer's staff and (e) categories | `weaponCategories.js:680-681` | `7ea8730` | — |
| Full monster table, used by every new encounter | `client/data/monsters.js` | used by `#15 #19 #22 #39 #40 #47 #49 #60 #75` | each encounter's tests and scenarios |
| Logger breadcrumbs and error sink | `client/util/logger.js` | `7ea8730` | determinism `shared/logger-and-colour` |
| Determinism harness, one digest per scenario, scenario discovery | `tools/determinism/*`, `test/determinism-digests/*` | `a1bda56` (#23) and every encounter commit since | `test/test-determinism.mjs` |
| Encounter self-registration and glob expansion for Node | `tools/determinism/import-glob.mjs`, `node-hooks.mjs` | `3d419de` (#26), `3bd61a5` (#34) | `check-import-graph.mjs` |
| Assets: per-encounter cache groups; stale trimmed cache refused at build | `tools/assets/cache-groups/`, `trimmed-cache.mjs`, `vite.config.js:29-39` | `1ab3ba5` (#24), `ddb08aa` (#41) | `test/test-trimmed-cache.mjs`, `test-cache-groups.mjs` |
| Manifest fetched from the server, not the HTTP cache | (cache loader) | `a0973bb` (#58) | — |
| cache-objects NPC opcode 130 | `tools/cache-objects.mjs` | `66bb246` (#45) | — |
| Test runner keep-alive fix for flaky tests | `tools/run-tests.mjs:13-16` | `2afd57f` (#38) | — |
| Test-marker guard | `tools/check-test-markers.mjs` | `7ea8730` | its own `--self-test` |
| zod 4.6.7 | `package.json` | `168865a` (#6) | — |

**Rules for any adoption:**
1. Run `node tools/determinism/harness.mjs` before and after every data or rename change; a rename must leave every digest unchanged.
2. Run `node tools/check-import-graph.mjs` and `node tools/check-test-markers.mjs`.
3. Run `npm test`.
4. Data swaps (equipment metadata) go in a commit of their own, with digests re-recorded only if a scenario provably reads a changed row.
