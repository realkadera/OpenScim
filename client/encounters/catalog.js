// What the encounter picker (client/ui/encounterPicker.js) knows of an
// encounter beyond its descriptor: the section it is listed under and the
// other names players search it by. One line per kind of
// engine/encounterKinds.js; a kind without a line is listed under "Other".
// A kind that is not registered yet has no descriptor and no presentation,
// so its line gives its `title` and `description` too, and may give the
// `portrait` its picture is drawn from.
//
// This module imports nothing and holds no rule of the game.

// The sections, in the order the picker shows them.
export const encounterCategories = [
  { id: "raid", label: "Raids" },
  { id: "wave", label: "Waves" },
  { id: "dt2", label: "Desert Treasure II" },
  { id: "slayer", label: "Slayer" },
  { id: "boss", label: "Bosses" },
  { id: "gwd", label: "God Wars" },
  { id: "wilderness", label: "Wilderness" },
  { id: "minigame", label: "Minigames" },
  { id: "other", label: "Other" },
];

export const encounterCatalog = {
  zebak: { category: "raid", aliases: ["toa", "tombs of amascut", "crocodile", "crondis"] },
  inferno: { category: "wave", aliases: ["zuk", "tzkal-zuk", "infernal cape", "jad"] },
  colosseum: { category: "wave", aliases: ["fortis", "colo", "waves", "minimus"] },
  sol_heredit: { category: "wave", aliases: ["fortis colosseum", "colo", "sol", "quiver"] },
  vardorvis: { category: "dt2", aliases: ["dt2", "vard", "awakened", "strangler", "forgotten four"] },
  duke_sucellus: { category: "dt2", aliases: ["dt2", "duke", "awakened", "forgotten four"] },
  leviathan: { category: "dt2", aliases: ["dt2", "levi", "awakened", "forgotten four"] },
  whisperer: {
    category: "dt2",
    aliases: ["dt2", "whisperer", "awakened", "forgotten four"],
    title: "The Whisperer",
    description: "The Lassar Undercity. Not playable yet.",
    // CACHE: NPC 12204, The Whisperer.
    portrait: { npcTypeId: 12204, framing: { yaw: -20, pitch: -10, focusHeight: 0.55, span: 0.8 } },
  },
  alchemical_hydra: { category: "slayer", aliases: ["hydra", "karuulm", "konar"] },
  araxxor: { category: "slayer", aliases: ["rax", "spider", "araxyte", "morytania"] },
  yama_p3: { category: "boss", aliases: ["yama", "contracts", "oathplate", "chasm of fire"] },
  doom_of_mokhaiotl: { category: "boss", aliases: ["doom", "delve", "mokhaiotl", "delves"] },
  maggot_king: { category: "boss", aliases: ["maggot"] },
  vorkath: { category: "boss", aliases: ["vork", "dragon", "zombified spawn", "dragon slayer ii", "ungael"] },
  brutus: { category: "boss", aliases: ["cow", "bull", "ides of milk", "lumbridge", "demonic brutus", "abyssal potato"] },
  corrupted_hunllef: { category: "minigame", aliases: ["gauntlet", "cg", "hunllef", "corrupted gauntlet", "prifddinas"] },
  sandbox: { category: "other", aliases: ["editor", "custom", "scenario", "build"] },
};
