// The list behind the encounter picker: its entries, its search and its
// sections (client/ui/encounterCatalog.js), over the real kinds and catalog
// and descriptors shaped like the registry's.
import assert from "node:assert/strict";
import { encounterCatalog, encounterCategories } from "../client/encounters/catalog.js";
import { buildEncounterEntries, groupEncounters, groupVariants, matchScore, searchEncounters } from "../client/ui/encounterCatalog.js";

// Every line of the catalog is listed in a section that exists.
const categoryIds = new Set(encounterCategories.map(({ id }) => id));
for (const [kind, listed] of Object.entries(encounterCatalog)) assert.ok(categoryIds.has(listed.category), kind + " is listed in a section that exists");

// The kinds as engine/encounterKinds.js gives them: the registered ones, and
// after them the fights that are announced and not built.
const encounterDefinitions = [
  ...["lobby", "toa_nexus", "yama_p3", "inferno", "vardorvis", "training_ground"].map((kind) => ({ kind, registered: true })),
  { kind: "announced_boss", registered: false },
  { kind: "unlisted_boss", registered: false },
];

const descriptors = [
  { kind: "lobby", displayName: "Lobby", description: "Prifddinas lobby area" },
  {
    kind: "yama_p3",
    displayName: "Yama - Phase 3",
    description: "The Yama boss encounter",
    variantLabel: "Contract",
    variants: [
      { id: "none", encounterKind: "yama_p3", name: "No Contract", subtitle: "The fight as it is", available: true },
      { id: "glyphic_attenuation", encounterKind: "yama_p3_glyphic", name: "Glyphic Attenuation", subtitle: "Glyphs fade", available: true, group: "Purifying" },
      { id: "bloodied_blows", encounterKind: "yama_p3_bloodied", name: "Bloodied Blows", subtitle: "Hits bleed", available: true, group: "Purifying" },
    ],
  },
  { kind: "inferno", displayName: "The Inferno", description: "Start from any wave.", isWorkInProgress: true },
  { kind: "vardorvis", displayName: "Vardorvis", description: "The Stranglewood.", isWorkInProgress: true },
  { kind: "training_ground", displayName: "Training Ground", description: "A fixture." },
];
const entries = buildEncounterEntries({
  descriptors,
  kinds: encounterDefinitions,
  // A fight that is announced and not built gives its name, text and portrait in its catalog line.
  catalog: {
    ...encounterCatalog,
    announced_boss: { category: "dt2", aliases: ["dt2", "announced"], title: "The Announced Boss", description: "Announced, not built.", portrait: { npcTypeId: 12204, framing: { yaw: -20, pitch: -10, focusHeight: 0.55, span: 0.8 } } },
  },
  getPresentation: (kind) => (kind === "yama_p3" ? { title: "Yama", tagline: "Chasm of Fire", thumb: "/yama.png" } : undefined),
  hasTutorial: (kind) => kind === "yama_p3",
  hiddenKinds: ["lobby", "toa_nexus"],
});
const byKind = Object.fromEntries(entries.map((entry) => [entry.kind, entry]));

// The lobby is no fight; a presentation's title wins and the descriptor's
// name stays a name to search by; an encounter without variants has one.
assert.equal(byKind.lobby, undefined);
assert.equal(byKind.toa_nexus, undefined);
assert.equal(byKind.yama_p3.title, "Yama");
assert.ok(byKind.yama_p3.aliases.includes("Yama - Phase 3"));
assert.equal(byKind.yama_p3.variantLabel, "Contract");
assert.equal(byKind.yama_p3.hasTutorial, true);
assert.equal(byKind.yama_p3.status, "playable");
assert.equal(byKind.inferno.status, "beta");
assert.deepEqual(byKind.inferno.variants.map((variant) => variant.encounterKind), ["inferno"]);
assert.equal(byKind.inferno.variantLabel, "Mode");
// A kind the catalog does not know is listed all the same.
assert.equal(byKind.training_ground.category, "other");
// The kinds the engine knows and no one has written are coming soon, once,
// with the name and the portrait the catalog gives them, or their kind.
assert.deepEqual(entries.filter((entry) => entry.status === "soon").map((entry) => entry.title), ["The Announced Boss", "unlisted_boss"]);
assert.equal(byKind.announced_boss.available, false);
assert.equal(byKind.announced_boss.presentation.portrait.npcTypeId, 12204);
assert.deepEqual(byKind.announced_boss.variants, []);
assert.equal(entries.filter((entry) => entry.kind === "vardorvis").length, 1);

// The sections follow the catalog's order, and what cannot be fought comes last.
const sections = groupEncounters(entries, encounterCategories);
assert.deepEqual(sections.map((section) => section.id), ["wave", "dt2", "boss", "other"]);
assert.deepEqual(sections[1].entries.map((entry) => entry.kind), ["vardorvis", "announced_boss"]);
assert.deepEqual(sections[3].entries.map((entry) => entry.kind), ["training_ground", "unlisted_boss"]);
assert.equal(sections.reduce((count, section) => count + section.entries.length, 0), entries.length);

// The search: a whole name beats its start, the start of a word a match
// inside one, and letters in order come last; two letters are not enough for that.
assert.ok(matchScore("Yama", "yama") > matchScore("Yama - Phase 3", "yama"));
assert.ok(matchScore("The Inferno", "inf") > matchScore("Reinforcements", "inf"));
assert.ok(matchScore("Vardorvis", "vdv") > 0);
assert.equal(matchScore("Vardorvis", "vx"), 0);
assert.equal(matchScore("Yama", ""), 0);
const kindsFound = (query) => searchEncounters(entries, query, encounterCategories).map(({ entry }) => entry.kind);
assert.deepEqual(kindsFound(""), entries.map((entry) => entry.kind));
// By an alias, and by the name of a section.
assert.equal(kindsFound("zuk")[0], "inferno");
assert.deepEqual(kindsFound("dt2"), ["vardorvis", "announced_boss"]);
assert.deepEqual(kindsFound("desert treasure"), ["vardorvis", "announced_boss"]);
// Every word has to be found.
assert.deepEqual(kindsFound("yama zzz"), []);
// A search that names a mode says which.
assert.deepEqual(searchEncounters(entries, "glyphic", encounterCategories).map(({ entry, variantId }) => [entry.kind, variantId]), [["yama_p3", "glyphic_attenuation"]]);
assert.equal(searchEncounters(entries, "yama", encounterCategories)[0].variantId, undefined);

// Variants that follow each other in a group stay together, in order.
assert.deepEqual(
  groupVariants(byKind.yama_p3.variants).map(({ group, variants }) => [group, variants.map((variant) => variant.id)]),
  [[null, ["none"]], ["Purifying", ["glyphic_attenuation", "bloodied_blows"]]],
);
console.log("Encounter picker list passed");
