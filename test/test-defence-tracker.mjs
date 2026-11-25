// The plugin Defence Tracker (client/plugins/defenceTracker.js) without a
// scene: the Defence it reads off an engine NPC, how it writes and colours
// it, which NPCs it tracks, and that a real drain of the engine's reaches it.
import assert from "node:assert/strict";
import { defenceTrackerStore, readDefence, defenceColor, formatDefence, setDefenceTrackerEngine, getDefenceOverhead, getDefenceTrackerInfoboxes } from "../client/plugins/defenceTracker.js";
import { setNpcDefenceDrain } from "../client/engine/npcState.js";

const defaults = defenceTrackerStore.defaults;
const npc = (id, role, defence, extra = {}) => ({ id, kind: "npc", role, alive: true, formulaStats: { levels: { defence } }, ...extra });

// Off until switched on; the plugin's own defaults.
assert.equal(defenceTrackerStore.getState().enabled, false);
assert.deepEqual(
  [defaults.overhead, defaults.alwaysShow, defaults.position, defaults.valueFormat, defaults.drainFormat, defaults.infoBox, defaults.infoBoxValue, defaults.lowThreshold],
  [true, false, "ABOVE_HP_BAR", "CURRENT_OF_BASE", "AMOUNT", true, "CURRENT", 10],
);

// The level is the base less the drain, never under 0; the floor is the encounter's, 0 without one.
assert.deepEqual(readDefence(npc("a", "boss", 200)), { base: 200, current: 200, floor: 0, drained: 0 });
assert.deepEqual(readDefence(npc("a", "boss", 200, { debuffs: { defenceDrain: 60 } })), { base: 200, current: 140, floor: 0, drained: 60 });
assert.deepEqual(readDefence(npc("a", "boss", 50, { debuffs: { defenceDrain: 80 } })), { base: 50, current: 0, floor: 0, drained: 50 });
assert.equal(readDefence(npc("a", "boss", 225, { defenceDrainFloor: 145 })).floor, 145);
// Nothing for an NPC that is talked to, one with no stats, or the player.
assert.equal(readDefence(npc("a", "npc", 1)), null);
assert.equal(readDefence({ id: "a", kind: "npc", role: "boss" }), null);
assert.equal(readDefence({ id: "player", kind: "player" }), null);

// Written in each format; the drain follows in its own colour, and only when there is one.
const drained = { base: 200, current: 142, floor: 0, drained: 58 };
const format = (settings, defence = drained) => formatDefence(defence, { ...defaults, ...settings }).text;
assert.equal(format({}), "142/200 (-58)");
assert.equal(format({ valueFormat: "CURRENT" }), "142 (-58)");
assert.equal(format({ valueFormat: "PERCENT", drainFormat: "PERCENT" }), "71% (-29%)");
assert.equal(format({ valueFormat: "CURRENT_AND_PERCENT", drainFormat: "NONE" }), "142 (71%)");
assert.equal(format({}, { base: 200, current: 200, floor: 0, drained: 0 }), "200/200");
assert.equal(format({ valueFormat: "PERCENT" }, { base: 0, current: 0, floor: 0, drained: 0 }), "0%");
assert.deepEqual(formatDefence(drained, defaults).segments, [
  { icon: "/assets/ui/skill-defence.png", text: "" },
  { text: "142/200", color: "#FFFFFF" },
  { text: " (-58)", color: "#AD1459" },
]);

// Normal, low within the threshold of the floor, fully drained at it.
const colour = (current, floor = 0, settings = {}) => defenceColor({ base: 200, current, floor }, { ...defaults, ...settings });
assert.equal(colour(142), "#FFFFFF");
assert.equal(colour(10), "#C0AB46");
assert.equal(colour(0), "#579549");
assert.equal(colour(155, 145), "#C0AB46");
assert.equal(colour(145, 145), "#579549");
assert.equal(colour(30, 0, { lowThresholdUnit: "PERCENT", lowThreshold: 20 }), "#C0AB46"); // 15% of what can be drained
assert.equal(colour(50, 0, { lowThresholdUnit: "PERCENT", lowThreshold: 20 }), "#FFFFFF");

// An engine: a boss with a floor, a minion the player attacks, a minion left alone, and an NPC that is talked to.
const boss = npc("boss", "boss", 225, { name: "Yama", defenceDrainFloor: 145 });
const actors = new Map([boss, npc("target", "minion", 100), npc("other", "minion", 100), npc("talker", "npc", 1)].map((each) => [each.id, each]));
const published = [...actors.values()].map(({ id, alive }) => ({ id, alive }));
setDefenceTrackerEngine(() => ({ worldState: { actors, getPlayer: () => ({ attackTarget: "target" }) } }));
const ids = () => getDefenceTrackerInfoboxes(published).map((box) => box.id);

// Nothing while the plugin is off.
assert.deepEqual(ids(), []);
assert.equal(getDefenceOverhead("boss"), null);

// On: nothing until something is drained; with "Always show" the boss and the NPC attacked.
defenceTrackerStore.setEnabled(true);
assert.deepEqual(ids(), []);
defenceTrackerStore.setSettings({ ...defaults, alwaysShow: true });
assert.deepEqual(ids(), ["defence-tracker-boss", "defence-tracker-target"]);
assert.equal(getDefenceOverhead("boss").text, "225/225");
assert.equal(getDefenceOverhead("other"), null);
defenceTrackerStore.setSettings(defaults);

// A drain of the engine's is shown at once, and stops at the encounter's floor.
setNpcDefenceDrain(boss, 67); // as a Dragon warhammer's 30% of 225
assert.deepEqual(getDefenceTrackerInfoboxes(published), [
  { id: "defence-tracker-boss", spriteUrl: "/assets/ui/skill-defence.png", text: "158", textColor: "#FFFFFF", tooltipTitle: "Defence Tracker", tooltipDetail: "Yama: 158/225 Defence (-67)" },
]);
assert.deepEqual({ ...getDefenceOverhead("boss"), segments: undefined }, { text: "158/225 (-67)", textColor: "#FFFFFF", segments: undefined, position: "ABOVE_HP_BAR", yOffset: 0 });
defenceTrackerStore.setSettings({ ...defaults, showIcon: false });
assert.deepEqual(getDefenceOverhead("boss").segments.map((segment) => segment.text), ["158/225", " (-67)"]);
defenceTrackerStore.setSettings(defaults);
setNpcDefenceDrain(boss, 67 + 47 + 33);
assert.equal(getDefenceOverhead("boss").text, "145/225 (-80)");
assert.equal(getDefenceOverhead("boss").textColor, "#579549");

// The info box's other numbers; each display on its own switch; a dead NPC has no box.
defenceTrackerStore.setSettings({ ...defaults, infoBoxValue: "DRAINED", overhead: false });
assert.equal(getDefenceTrackerInfoboxes(published)[0].text, "80");
assert.equal(getDefenceOverhead("boss"), null);
defenceTrackerStore.setSettings({ ...defaults, infoBoxValue: "PERCENT", infoBox: false });
assert.deepEqual(ids(), []);
defenceTrackerStore.setSettings({ ...defaults, infoBoxValue: "PERCENT" });
assert.equal(getDefenceTrackerInfoboxes(published)[0].text, "64%");
assert.deepEqual(getDefenceTrackerInfoboxes([{ id: "boss", alive: false }]), []);

// A drain the encounter takes back (the Maggot King's) is gone from the display.
boss.debuffs.defenceDrain = 0;
assert.deepEqual(ids(), []);

// The roll an NPC defends a spell with: shown beside the Defence once it is lowered, and not before.
const { readMagicDefenceRoll, formatMagic } = await import("../client/plugins/defenceTracker.js");
defenceTrackerStore.setSettings(defaults);
// Zebak as gearscape has him: Magic 100, magic defence +200 (WIKI: (9 + 100) x (200 + 64) = 28776).
const zebak = npc("zebak", "boss", 70, { formulaStats: { levels: { defence: 70, magic: 100 }, defensive: { magic: 200 } }, debuffs: {} });
actors.set("zebak", zebak);
published.push({ id: "zebak", alive: true });
assert.deepEqual(readMagicDefenceRoll(zebak), { base: 28776, current: 28776, drained: 0 });
assert.deepEqual(ids(), []);
// The Accursed sceptre's special (WIKI: Condemn drains Defence and Magic by 15%): Magic 85, and the bonus as it was.
zebak.debuffs.magicDrain = 15;
zebak.debuffs.defenceDrain = 10;
assert.deepEqual(readMagicDefenceRoll(zebak), { base: 28776, current: 24816, drained: 3960 }); // 94 x 264
assert.deepEqual(ids(), ["defence-tracker-zebak", "magic-tracker-zebak"]);
assert.equal(getDefenceOverhead("zebak").text, "60/70 (-10)  24816/28776 (-3960)");
const roll = formatMagic(readMagicDefenceRoll(zebak), defaults);
assert.equal(roll.textColor, "#5AA0FF");
assert.deepEqual(roll.segments.map((segment) => segment.icon ?? segment.text), ["/assets/ui/skill-defence.png", "/assets/ui/skill-magic.png", "24816/28776", " (-3960)"]);
assert.deepEqual([getDefenceTrackerInfoboxes(published)[1].text, getDefenceTrackerInfoboxes(published)[1].tooltipDetail], ["86%", "24816/28776 defence roll against spells (-3960)"]);
// In the Tombs the roll is scaled by the raid level, as the engine's.
zebak.formulaStats.toaRaidLevel = 300;
assert.equal(readMagicDefenceRoll(zebak).base, Math.floor((28776 * 550) / 250));
zebak.formulaStats.toaRaidLevel = undefined;
// A roll lowered alone has the NPC tracked.
zebak.debuffs.defenceDrain = 0;
assert.equal(getDefenceOverhead("zebak").text, "70/70  24816/28776 (-3960)");
// Switched off, it is not shown and does not make an NPC tracked.
defenceTrackerStore.setSettings({ ...defaults, magic: false });
assert.deepEqual(ids(), []);

console.log("defence tracker ok");
