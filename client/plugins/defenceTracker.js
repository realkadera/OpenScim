// The plugin Defence Tracker: the Defence level an NPC has left after the
// attacks that drain it, over its head and as an info box. Rebuilt from the
// RuneLite plugin Better Party Defence (github.com/Falsary/better-party-defence,
// BSD 2-Clause), from its options, their defaults and what it shows; no code
// of it is here. PLUGIN below is that description. Its party side (sharing
// drains with a party) is left out, and so are its Magic Defence display, its
// spell and special-weapon info boxes and its fonts and icons.
//
// What is the application's own: the level is the engine's. The plugin in the
// game has to work a drain out from hitsplats and a table of bosses; here the
// fight itself keeps it (`debuffs.defenceDrain`, `defenceDrainFloor` and
// `formulaStats.levels.defence` of an NPC, client/engine/npcState.js), so what
// is shown is what the next accuracy roll uses, for every NPC and every
// drain an encounter models. The Plugins panel lists it by its store
// (application.js, PluginStoreEntry), the info boxes are added in Grid.js and
// the overhead text is drawn by rendering.js (npcDefenceTexts).
import { createPluginStore, toHexColor } from "./pluginStore.js";

const choices = (...pairs) => pairs.map(([value, label]) => ({ value, label }));

/** The options, in the order and with the defaults of the plugin's panel. */
export const defenceTrackerOptions = [
  { key: "overhead", label: "Show defence tracker", section: "General", type: "boolean", default: true, info: "Shows the Defence level over the NPC" },
  { key: "alwaysShow", label: "Always show", section: "General", type: "boolean", default: false, info: "Shows a boss and the NPC you attack before anything has drained its Defence" },
  {
    key: "position",
    label: "Position",
    section: "Tracker Position",
    type: "select",
    choices: choices(["ABOVE_HP_BAR", "Above HP bar"], ["RIGHT_OF_HP_BAR", "Right of HP bar"], ["CENTRE_OF_NPC", "Centre of NPC"], ["AT_NPC_FEET", "At NPC feet"]),
    default: "ABOVE_HP_BAR",
    info: "Where the Defence level is drawn",
  },
  { key: "yOffset", label: "Y offset", section: "Tracker Position", type: "number", min: -200, max: 200, default: 0, info: "Moves the text up (positive) or down (negative), in pixels" },
  {
    key: "valueFormat",
    label: "Value format",
    section: "Tracker Position",
    type: "select",
    choices: choices(["CURRENT", "142"], ["CURRENT_OF_BASE", "142/200"], ["PERCENT", "71%"], ["CURRENT_AND_PERCENT", "142 (71%)"]),
    // The user's default: the level beside what it started at, so that it is not taken for the drain. The plugin's is the level alone.
    default: "CURRENT_OF_BASE",
    info: "How the Defence level is written",
  },
  {
    key: "drainFormat",
    label: "Drain format",
    section: "Tracker Position",
    type: "select",
    choices: choices(["AMOUNT", "Amount"], ["PERCENT", "Percent"], ["NONE", "None"]),
    default: "AMOUNT",
    info: "What is written after the level of how much was drained",
  },
  { key: "showIcon", label: "Show icon", section: "Text & Icons", type: "boolean", default: true, info: "Draws the Defence skill icon before the level over the NPC" },
  { key: "infoBox", label: "Defence info box", section: "Info Boxes", type: "boolean", default: true, info: "Shows an info box with the Defence of each tracked NPC" },
  {
    key: "infoBoxValue",
    label: "Info box value",
    section: "Info Boxes",
    type: "select",
    choices: choices(["CURRENT", "Current"], ["PERCENT", "Percent"], ["DRAINED", "Drained"]),
    default: "CURRENT",
    info: "The number in the info box",
  },
  { key: "lowThreshold", label: "Low threshold", section: "Colours", type: "number", min: 0, max: 500, default: 10, info: "Defence this close to the lowest it can be drained to is drawn in the low colour" },
  {
    key: "lowThresholdUnit",
    label: "Low threshold unit",
    section: "Colours",
    type: "select",
    choices: choices(["LEVELS", "Levels"], ["PERCENT", "Percent of drainable"]),
    default: "LEVELS",
    info: "Whether the threshold counts levels, or percent of what can be drained",
  },
  // PLUGIN: white, #C0AB46, #579549, #AD1459.
  { key: "highColor", label: "Normal colour", section: "Colours", type: "color", default: "FFFFFFFF", info: "The colour of Defence above the low threshold" },
  { key: "lowColor", label: "Low colour", section: "Colours", type: "color", default: "FFC0AB46", info: "The colour of Defence at or under the low threshold" },
  { key: "cappedColor", label: "Fully drained colour", section: "Colours", type: "color", default: "FF579549", info: "The colour of Defence that cannot be drained further" },
  { key: "drainColor", label: "Drain colour", section: "Colours", type: "color", default: "FFAD1459", info: "The colour of the amount drained" },
];
export const defenceTrackerStore = createPluginStore("defenceTracker", defenceTrackerOptions);

/**
 * The Defence of an engine NPC: { base, current, floor, drained }, or null for
 * what has none (a thrall, an NPC that is talked to). `floor` is the lowest a
 * drain takes it (Yama's 145, Araxxor's; 0 where the encounter sets none).
 */
export function readDefence(npc) {
  const base = npc?.formulaStats?.levels?.defence;
  if (npc?.kind !== "npc" || npc.role === "npc" || !Number.isFinite(base)) return null;
  const current = Math.max(0, base - (npc.debuffs?.defenceDrain ?? 0)); // as getActorCombatSnapshot (combatFormulas.js)
  return { base, current, floor: Math.min(base, Math.max(0, npc.defenceDrainFloor ?? 0)), drained: base - current };
}

const percentOf = (part, whole) => (whole > 0 ? Math.round((part * 100) / whole) : 0);

/** The colour of a Defence, "#RRGGBB": fully drained, low, or normal. */
export function defenceColor({ base, current, floor }, settings) {
  const left = current - floor;
  if (left <= 0) return toHexColor(settings.cappedColor);
  const measure = settings.lowThresholdUnit === "PERCENT" ? (left * 100) / (base - floor) : left;
  return toHexColor(measure <= settings.lowThreshold ? settings.lowColor : settings.highColor);
}

/**
 * The overhead text of a Defence: { text, textColor, segments }, the segments
 * being the skill's icon ({ icon }) where it is shown, the level and, where
 * something was drained, how much ({ text, color }).
 */
export function formatDefence(defence, settings) {
  const { base, current, drained } = defence;
  const percent = percentOf(current, base) + "%";
  const value = { CURRENT: `${current}`, CURRENT_OF_BASE: `${current}/${base}`, PERCENT: percent, CURRENT_AND_PERCENT: `${current} (${percent})` }[settings.valueFormat];
  const drain = drained <= 0 || settings.drainFormat === "NONE" ? "" : settings.drainFormat === "PERCENT" ? ` (-${percentOf(drained, base)}%)` : ` (-${drained})`;
  const textColor = defenceColor(defence, settings);
  // A segment with `icon` is drawn as that picture, in the line of the text (rendering.js).
  const segments = [...(settings.showIcon ? [{ icon: defenceIcon, text: "" }] : []), { text: value, color: textColor }];
  if (drain) segments.push({ text: drain, color: toHexColor(settings.drainColor) });
  return { text: value + drain, textColor, segments };
}

const defenceIcon = "/assets/ui/skill-defence.png";

// The engine whose NPCs are read: the application's (application.js).
let getEngine = () => null;
export function setDefenceTrackerEngine(source) {
  getEngine = source;
}

// The Defence the plugin shows for the NPC `id`, or null: one that was
// drained, or with "Always show" a boss and the NPC the player attacks.
function trackedDefence(id, settings) {
  const engine = getEngine();
  const npc = engine?.worldState?.actors.get(id);
  const defence = readDefence(npc);
  if (!defence) return null;
  const shown = defence.drained > 0 || (settings.alwaysShow && (npc.role === "boss" || engine.worldState.getPlayer()?.attackTarget === id));
  return shown ? { ...defence, name: npc.name } : null; // few actors carry a name; the tooltip does without
}

/** What the scene writes over the NPC `id`: { text, textColor, segments, position, yOffset }, or null. */
export function getDefenceOverhead(id) {
  const { enabled, settings } = defenceTrackerStore.getState();
  if (!enabled || !settings.overhead) return null;
  const defence = trackedDefence(id, settings);
  return defence && { ...formatDefence(defence, settings), position: settings.position, yOffset: settings.yOffset };
}

/** The info boxes (Grid.js) of the published NPCs `npcs` ({ id, alive }): one for each that is tracked. */
export function getDefenceTrackerInfoboxes(npcs) {
  const { enabled, settings } = defenceTrackerStore.getState();
  if (!enabled || !settings.infoBox) return [];
  const boxes = [];
  for (const { id, alive } of npcs ?? []) {
    const defence = alive === false ? null : trackedDefence(id, settings);
    if (!defence) continue;
    const { name, base, current, drained } = defence;
    boxes.push({
      id: "defence-tracker-" + id,
      spriteUrl: defenceIcon,
      text: { CURRENT: `${current}`, PERCENT: percentOf(current, base) + "%", DRAINED: `${drained}` }[settings.infoBoxValue],
      textColor: defenceColor(defence, settings),
      tooltipTitle: "Defence Tracker",
      tooltipDetail: (name ? name + ": " : "") + `${current}/${base} Defence` + (drained > 0 ? ` (-${drained})` : ""),
    });
  }
  return boxes;
}
