// What the RuneLite plugin Larva Tracker shows, rebuilt for the Doom of
// Mokhaiotl by his own module, as the Colosseum's module rebuilds Fortis
// Colosseum (client/encounters/colosseum/overlays.js): each part is a
// mechanics toggle of the group "aid", which the game panel lists under its
// assists and keeps from run to run.
//
// Larva Tracker (Demonic Larva Tracker, github.com/marknewan/newan-plugins,
// BSD 2-Clause, "Copyright (c) 2025, marknewan"), from its options, their
// defaults and what it does; no code of it is here. PLUGIN below is that.
//   - Death Prediction (on): a larva the player's hits will kill is hidden at
//     once, its overheads and bars with it. The plugin works the damage out
//     from the experience drop; here it is the hits already queued, through
//     the Doom's own rules for larvae (hazards.js), so nothing has to be
//     undone if a guess was wrong (the plugin's lag protection and tick
//     timeout have nothing to do).
//   - Hide Larva Overheads (on): no overhead prayers on the coloured larvae,
//     whose colour already says what they take.
//   - Recolor Larva Menu Entries (on): a larva's name in the menu in its
//     colour.
//   - Infobox Larva Counter (on): the demonic charge, the larvae he has taken
//     in, once there is one.
//   - Remove Spawn Animation (off).
//   - Highlight Tile Outline and Highlight Tile Fill (off), on the larva's
//     true tile.
// Not here: the outline, hull, clickbox and minimap highlights and the name
// labels (the scenes draw no NPC outlines and no names over NPCs), and the
// loot extras (there is no loot).
import { npcTypeIds } from "./delves.js";

export const larvaTrackerKeys = {
  deathPrediction: "doomLarvaDeathPrediction",
  hideOverheads: "doomLarvaHideOverheads",
  recolorMenu: "doomLarvaRecolorMenu",
  counter: "doomLarvaCounter",
  removeSpawnAnimation: "doomLarvaRemoveSpawnAnimation",
  tileHighlight: "doomLarvaTileHighlight",
};
const source = "(RuneLite plugin Larva Tracker.)";
export const larvaTrackerToggles = [
  { key: larvaTrackerKeys.deathPrediction, label: "Larva Death Prediction", default: true, info: `Hides a larva as soon as your hits on their way will kill it. ${source}` },
  { key: larvaTrackerKeys.hideOverheads, label: "Hide Larva Overheads", default: true, info: `No overhead prayers on the coloured larvae. ${source}` },
  { key: larvaTrackerKeys.recolorMenu, label: "Recolor Larva Menu Entries", default: true, info: `A larva's name in the right-click menu in its colour. ${source}` },
  { key: larvaTrackerKeys.counter, label: "Infobox Larva Counter", default: true, info: `The demonic charge: how many larvae he has taken in. ${source}` },
  { key: larvaTrackerKeys.removeSpawnAnimation, label: "Remove Larva Spawn Animation", default: false, info: `Larvae appear without their landing animation. ${source}` },
  {
    key: larvaTrackerKeys.tileHighlight,
    label: "Larva Tile Highlight",
    default: "off",
    choices: [
      { value: "off", label: "Off" },
      { value: "outline", label: "Outline" },
      { value: "fill", label: "Fill" },
      { value: "both", label: "Both" },
    ],
    info: `Marks each larva's true tile in its colour. ${source}`,
  },
].map((toggle) => ({ ...toggle, group: "aid" }));

/** What a toggle is set to; a set of mechanics saved before it existed has its default. */
export function larvaTrackerSetting(mechanics, key) {
  return mechanics?.[key] ?? larvaTrackerToggles.find((toggle) => toggle.key === key).default;
}

// PLUGIN: its colours, white for the plain larvae and red, green and blue for melee, ranged and magic.
const colors = { base: "#FFFFFF", melee: "#FF0000", range: "#00FF00", magic: "#0000FF" };
const colorByType = new Map([
  [npcTypeIds.larva, colors.base],
  [npcTypeIds.meleeLarva, colors.melee],
  [npcTypeIds.rangedLarva, colors.range],
  [npcTypeIds.giantRangedLarva, colors.range],
  [npcTypeIds.magicLarva, colors.magic],
  [npcTypeIds.giantMagicLarva, colors.magic],
]);
export const larvaColor = (npcTypeId) => colorByType.get(npcTypeId);
const isColoured = (npcTypeId) => colorByType.has(npcTypeId) && npcTypeId !== npcTypeIds.larva;
// PLUGIN: the tile fill's alpha, 32 of 255.
const fillOpacity = 32 / 255;

// The scene's input, with what the plugin hides taken out and its tiles marked.
export function withLarvaTracker(input) {
  const state = input.simulationState?.encounter?.state;
  const mechanics = input.simulationState?.mechanicsConfig;
  const npcs = input.simulationState?.npcs;
  if (!state || !npcs) return input;
  const hidden = new Set(larvaTrackerSetting(mechanics, larvaTrackerKeys.deathPrediction) ? (state.doomedLarvae ?? []) : []);
  const hideOverheads = larvaTrackerSetting(mechanics, larvaTrackerKeys.hideOverheads);
  const highlight = larvaTrackerSetting(mechanics, larvaTrackerKeys.tileHighlight);
  if (hidden.size === 0 && !hideOverheads && highlight === "off") return input;
  const shown = npcs
    .filter((npc) => !hidden.has(npc.id))
    .map((npc) => (hideOverheads && npc.overheadPrayers && isColoured(npc.npcTypeId) ? { ...npc, overheadPrayers: undefined } : npc));
  let next = { ...input, simulationState: { ...input.simulationState, npcs: shown } };
  if (highlight === "off") return next;
  const marks = shown
    .filter((npc) => npc.alive && larvaColor(npc.npcTypeId))
    .flatMap((npc) => {
      const size = npc.size ?? 1;
      return Array.from({ length: size * size }, (unusedElement, index) => ({
        x: npc.position[0] + (index % size),
        y: npc.position[1] + Math.floor(index / size),
        color: larvaColor(npc.npcTypeId),
        opacity: highlight === "fill" ? 0 : 1,
        fillOpacity: highlight === "outline" ? 0 : fillOpacity,
      }));
    });
  if (marks.length === 0) return next;
  const options = input.options ?? {};
  // The player's own markers stay as he has them: shown only if he shows them.
  next = { ...next, options: { ...options, showTileMarkers: true }, tileMarkers: [...(options.showTileMarkers ? (input.tileMarkers ?? []) : []), ...marks] };
  return next;
}

// The infobox of the counter, for the encounter's snapshot (Grid.js lists an
// encounter's infoboxes with the application's own).
export function larvaCounterInfobox(mechanics, charge) {
  if (!larvaTrackerSetting(mechanics, larvaTrackerKeys.counter) || charge < 1) return [];
  return [{ id: "doom-larva-counter", spriteUrl: "", text: String(charge), tooltipTitle: "Demonic Charge", tooltipDetail: `${charge} larva${charge === 1 ? "" : "e"} taken in` }];
}
