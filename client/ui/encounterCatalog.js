// The list behind the encounter picker (encounterPicker.js): one entry per
// encounter, built from what the registry, the kinds and the catalog say of
// it, and the search and the sections over those entries. Nothing here draws
// or imports anything, so it runs in Node (test/test-encounter-picker.mjs).

// The entries of the picker.
//   descriptors      the descriptors of the registered encounters
//                    (encounters/registry.js), in the order to list them
//   kinds            encounterDefinitions of engine/encounterKinds.js; a kind
//                    there that is not registered is listed as coming soon
//   catalog          encounterCatalog of encounters/catalog.js
//   getPresentation  (kind) => { title, tagline, blurb, thumb, thumbFit,
//                    heroArt, heroArtFull } or nothing
//   hasTutorial      (kind) => whether a tutorial exists for the kind
//   hiddenKinds      kinds that are no fight to set up (the lobby, the nexus)
// An entry: { kind, title, tagline, description, category, aliases, status
// ("playable", "beta" or "soon"), available, hasTutorial, variantLabel,
// variants, presentation }. `variants` is never empty: an encounter without
// variants of its own has one, the fight itself.
export function buildEncounterEntries({ descriptors, kinds = [], catalog = {}, getPresentation = () => undefined, hasTutorial = () => false, hiddenKinds = [] }) {
  const hidden = new Set(hiddenKinds);
  const entries = [];
  for (const descriptor of descriptors) {
    if (!descriptor || hidden.has(descriptor.kind)) continue;
    const presentation = getPresentation(descriptor.kind) ?? {};
    const listed = catalog[descriptor.kind] ?? {};
    const own = descriptor.variants ?? [];
    entries.push({
      kind: descriptor.kind,
      title: presentation.title ?? descriptor.displayName,
      tagline: presentation.tagline ?? "",
      description: presentation.blurb ?? descriptor.description ?? "",
      category: listed.category ?? "other",
      aliases: [...(listed.aliases ?? []), ...(presentation.title && presentation.title !== descriptor.displayName ? [descriptor.displayName] : [])],
      status: descriptor.isWorkInProgress ? "beta" : "playable",
      available: true,
      hasTutorial: hasTutorial(descriptor.kind) === true,
      variantLabel: descriptor.variantLabel ?? "Mode",
      variants:
        own.length > 0
          ? own
          : [{ id: descriptor.kind, encounterKind: descriptor.kind, name: "Standard fight", subtitle: descriptor.description ?? "", available: true }],
      presentation,
    });
  }
  const listedKinds = new Set(entries.map((entry) => entry.kind));
  for (const { kind, registered } of kinds) {
    if (registered || hidden.has(kind) || listedKinds.has(kind)) continue;
    const listed = catalog[kind] ?? {};
    entries.push({
      kind,
      title: listed.title ?? kind,
      tagline: "",
      description: listed.description ?? "",
      category: listed.category ?? "other",
      aliases: listed.aliases ?? [],
      status: "soon",
      available: false,
      hasTutorial: false,
      variantLabel: "Mode",
      variants: [],
      presentation: listed.portrait ? { portrait: listed.portrait } : {},
    });
  }
  return entries;
}

// How well `text` answers one word of a search: 0 when it does not. A whole
// match beats the start of the text, that the start of a word, that a match
// inside a word, and that the word's letters in order with others between.
export function matchScore(text, word) {
  const haystack = text.toLowerCase();
  if (!word || !haystack) return 0;
  if (haystack === word) return 100;
  if (haystack.startsWith(word)) return 85;
  const at = haystack.indexOf(word);
  if (at > 0) return /[^a-z0-9]/.test(haystack[at - 1]) ? 70 : 50;
  if (word.length < 3) return 0;
  let from = 0;
  for (const letter of word) {
    from = haystack.indexOf(letter, from) + 1;
    if (from === 0) return 0;
  }
  return 20;
}

// The entries a search finds, best first, each as { entry, variantId }:
// `variantId` is the variant the search named, when it named one better than
// it named the encounter. Every word of the search has to be found somewhere
// in an entry. An empty search finds every entry, in the order given.
export function searchEncounters(entries, query, categories = []) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.map((entry) => ({ entry, variantId: undefined }));
  const labels = new Map(categories.map(({ id, label }) => [id, label]));
  const found = [];
  for (const entry of entries) {
    // What an entry can be found by, each with its weight.
    const fields = [
      [entry.title, 1],
      ...entry.aliases.map((alias) => [alias, 0.9]),
      [entry.tagline, 0.5],
      [labels.get(entry.category) ?? "", 0.5],
      [entry.description, 0.25],
    ];
    let total = 0, variantId, variantBest = 0, everyWord = true;
    for (const word of words) {
      let best = 0;
      for (const [text, weight] of fields) best = Math.max(best, matchScore(text, word) * weight);
      for (const variant of entry.variants) {
        const score = Math.max(matchScore(variant.name ?? "", word) * 0.8, matchScore(variant.subtitle ?? "", word) * 0.2);
        if (score > best && score > variantBest && variant.available !== false) {
          variantBest = score;
          variantId = variant.id;
        }
        best = Math.max(best, score);
      }
      if (best === 0) {
        everyWord = false;
        break;
      }
      total += best;
    }
    // An encounter that can be fought comes before one that cannot.
    if (everyWord) found.push({ entry, variantId, score: total + (entry.available ? 5 : 0) });
  }
  return found.sort((a, b) => b.score - a.score).map(({ entry, variantId }) => ({ entry, variantId }));
}

// The entries in sections: one per category that has entries, in the order of
// `categories`, with what can be fought ahead of what is coming soon.
export function groupEncounters(entries, categories) {
  const known = new Set(categories.map(({ id }) => id));
  return categories
    .map(({ id, label }) => {
      const own = entries.filter((entry) => (known.has(entry.category) ? entry.category : "other") === id);
      return { id, label, entries: [...own.filter((entry) => entry.available), ...own.filter((entry) => !entry.available)] };
    })
    .filter((section) => section.entries.length > 0);
}

// Variants that follow each other with the same `group`, together.
export function groupVariants(variants) {
  const groups = [];
  for (const variant of variants) {
    const group = variant.group ?? null;
    if (groups.length === 0 || groups[groups.length - 1].group !== group) groups.push({ group, variants: [] });
    groups[groups.length - 1].variants.push(variant);
  }
  return groups;
}
