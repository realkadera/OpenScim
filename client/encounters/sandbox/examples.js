// The example scenarios the editor offers, each with the gear it is meant to
// be played with. Each is a scenario of the format of scenario.js, checked
// when the module loads (normalizeScenario throws on a mistake). Every
// footprint stands on walkable tiles of its arena, clear of the others and
// of the host boss's NPCs: test/test-sandbox-examples.mjs checks it.
//
// Twenty-six: thirteen against the player and thirteen free-for-alls,
// mixing the catalog's monsters, boulders (obstacles.js) and, in seven, the
// arena's own boss with all its mechanics (the host).
import { normalizeScenario } from "./scenario.js";

// Item ids (the game's object ids, as tools/determinism/scenarios/common.mjs has them).
const item = {
  twistedBow: 20997, dragonArrow: 11212, masoriMask: 27235, masoriBody: 27238, masoriChaps: 27241, zaryteVambraces: 26235,
  pegasianBoots: 13237, necklaceOfAnguish: 19547, avasAssembler: 22109, venatorRing: 28310, toxicBlowpipe: 12926,
  osmumtensFang: 26219, avernicDefender: 22322, torvaHelm: 26382, torvaBody: 26384, torvaLegs: 26386,
  infernalCape: 21295, amuletOfRancour: 29801, ferociousGloves: 22981, primordialBoots: 13239, ultorRing: 28307, dragonClaws: 13652,
  tumekensShadow: 27275, ancestralHat: 21018, ancestralTop: 21021, ancestralBottom: 21024, occultNecklace: 12002,
  tormentedBracelet: 19544, eternalBoots: 13235, imbuedSaradominCape: 21791, lightbearer: 25975, kodaiWand: 21006,
  saradominBrew: 6685, superRestore: 3024, anglerfish: 13441, divineSuperCombat: 23685, rangingPotion: 2444,
};
const slots = (...ids) => ids.map((id) => ({ id }));
const repeat = (id, count) => Array.from({ length: count }, () => id);

const rangedGear = {
  name: "Max ranged",
  equipment: {
    weapon: item.twistedBow, head: item.masoriMask, body: item.masoriBody, legs: item.masoriChaps, hands: item.zaryteVambraces,
    boots: item.pegasianBoots, amulet: item.necklaceOfAnguish, cape: item.avasAssembler, ring: item.venatorRing,
  },
  inventory: slots(item.toxicBlowpipe, item.rangingPotion, ...repeat(item.saradominBrew, 10), ...repeat(item.superRestore, 8), ...repeat(item.anglerfish, 8)),
  supplies: { equippedAmmo: { id: item.dragonArrow } },
};
const meleeGear = {
  name: "Max melee",
  equipment: {
    weapon: item.osmumtensFang, shield: item.avernicDefender, head: item.torvaHelm, body: item.torvaBody, legs: item.torvaLegs,
    hands: item.ferociousGloves, boots: item.primordialBoots, amulet: item.amuletOfRancour, cape: item.infernalCape, ring: item.ultorRing,
  },
  inventory: slots(item.dragonClaws, item.divineSuperCombat, ...repeat(item.saradominBrew, 10), ...repeat(item.superRestore, 8), ...repeat(item.anglerfish, 8)),
  supplies: {},
};
const mageGear = {
  name: "Max magic",
  equipment: {
    weapon: item.tumekensShadow, head: item.ancestralHat, body: item.ancestralTop, legs: item.ancestralBottom, hands: item.tormentedBracelet,
    boots: item.eternalBoots, amulet: item.occultNecklace, cape: item.imbuedSaradominCape, ring: item.lightbearer,
  },
  inventory: slots(item.kodaiWand, ...repeat(item.saradominBrew, 11), ...repeat(item.superRestore, 8), ...repeat(item.anglerfish, 8)),
  supplies: {},
};

const npc = (id, type, x, y, extra = {}) => ({ id, npc: type, position: [x, y], ...extra });
const example = (key, meta, arena, mode, gear, npcs, options = {}, obstacles = []) => ({
  key,
  scenario: normalizeScenario({
    format: "openscim-sandbox", version: 1, meta: { author: "OpenScim", ...meta }, arena, mode, options, gear, npcs,
    ...(obstacles.length > 0 ? { obstacles } : {}),
  }),
});
// Boulders (obstacles.js) in a line from [x, y], `length` of them, a step of [dx, dy].
const wall = (x, y, length, dx, dy) => Array.from({ length }, (_, index) => [x + index * dx, y + index * dy]);
// The same of jugs: low obstacles, walked around but shot over.
const lowWall = (x, y, length, dx, dy) => wall(x, y, length, dx, dy).map((tile) => [...tile, "low"]);
const team = (name) => ({ team: name });

// Ten against the player, then ten free-for-alls (the editor shows the ones
// of the mode chosen). Few of them use Sol Heredit or Yama, whose hitpoints
// make long fights; most mix the Inferno's, the Colosseum's and the
// Stranglewood's monsters, several put boulders in the way, and four fight
// the arena's own boss with all its mechanics.
export const sandboxExamples = [
  // --- all against you --------------------------------------------------------
  example("inferno-rush", { name: "Inferno Rush", description: "A late Inferno wave without pillars: a meleer, a ranger, a mager, two blobs and two bats. Two short walls of boulders are all the cover you get." }, "inferno", "versus", rangedGear, [
    npc("meleer", "inferno.meleer", 21, 38),
    npc("ranger", "inferno.ranger", 37, 39),
    npc("mager", "inferno.mager", 28, 42),
    npc("blob-west", "inferno.blob", 19, 24),
    npc("blob-east", "inferno.blob", 39, 24),
    npc("bat-west", "inferno.bat", 24, 44),
    npc("bat-east", "inferno.bat", 34, 44),
  ], {}, [...wall(26, 36, 3, 1, 0), ...wall(33, 36, 3, 1, 0)]),
  example("colosseum-gauntlet", { name: "Colosseum Gauntlet", description: "Every wave of the Colosseum at once: a shaman, two jaguars, a javelin colossus, a manticore, a shockwave colossus and a minotaur." }, "colosseum", "versus", meleeGear, [
    npc("shaman", "colosseum.shaman", 42, 40),
    npc("jaguar-north", "colosseum.jaguar", 36, 42),
    npc("jaguar-south", "colosseum.jaguar", 36, 29),
    npc("javelin", "colosseum.javelin", 44, 34),
    npc("manticore", "colosseum.manticore", 30, 46),
    npc("shockwave", "colosseum.shockwave", 30, 21),
    npc("minotaur", "colosseum.minotaur", 41, 23),
  ]),
  example("jad-pincer", { name: "Jad Pincer", description: "Two JalTok-Jads on either side of the nexus, each on his own timer, and a manticore throwing its orbs from the south." }, "toa_nexus", "versus", rangedGear, [
    npc("jad-west", "inferno.jad", 24, 25),
    npc("jad-east", "inferno.jad", 34, 25),
    npc("manticore", "colosseum.manticore", 30, 19),
  ]),
  example("stranglewood-ambush", { name: "Stranglewood Ambush", description: "Vardorvis with all his mechanics, and Sol Heredit's warband coming out of the trees: three berserkers, two archers and two seers." }, "vardorvis", "versus", meleeGear, [
    npc("berserker-1", "warband.berserker", 33, 30),
    npc("berserker-2", "warband.berserker", 48, 30),
    npc("berserker-3", "warband.berserker", 40, 33),
    npc("archer-1", "warband.archer", 33, 19),
    npc("archer-2", "warband.archer", 48, 19),
    npc("seer-1", "warband.seer", 36, 17),
    npc("seer-2", "warband.seer", 45, 17),
  ], { bossMechanics: true }),
  example("doom-and-company", { name: "Doom and Company", description: "The Doom of Mokhaiotl with all his mechanics, while an Inferno mager and ranger and a javelin colossus close in from behind." }, "doom", "versus", mageGear, [
    npc("mager", "inferno.mager", 20, 43),
    npc("ranger", "inferno.ranger", 40, 43),
    npc("javelin", "colosseum.javelin", 31, 46),
  ], { bossMechanics: true }),
  example("boulder-maze", { name: "Boulder Maze", description: "Walls of boulders across the Colosseum, two manticores, two javelin colossi and two shamans behind them. Use the walls to break their line of sight." }, "colosseum", "versus", rangedGear, [
    npc("manticore-north", "colosseum.manticore", 38, 44),
    npc("manticore-south", "colosseum.manticore", 37, 23),
    npc("javelin-north", "colosseum.javelin", 44, 40),
    npc("javelin-south", "colosseum.javelin", 44, 28),
    npc("shaman-north", "colosseum.shaman", 32, 47),
    npc("shaman-south", "colosseum.shaman", 32, 21),
  ], { playerStart: [21, 34] }, [...wall(28, 29, 4, 0, 1), ...wall(28, 37, 4, 0, 1), ...wall(33, 33, 5, 0, 1), ...wall(38, 31, 3, 1, 0), ...wall(38, 38, 3, 1, 0)]),
  example("zuks-court", { name: "Zuk's Court", description: "TzKal-Zuk casting from the far end of the Inferno, two jaguars and a minotaur running at you, and two blobs." }, "inferno", "versus", rangedGear, [
    npc("zuk", "inferno.zuk", 27, 40),
    npc("jaguar-west", "colosseum.jaguar", 19, 30),
    npc("jaguar-east", "colosseum.jaguar", 41, 30),
    npc("minotaur", "colosseum.minotaur", 30, 20),
    npc("blob-west", "inferno.blob", 19, 41),
    npc("blob-east", "inferno.blob", 39, 41),
  ]),
  example("jaws-and-claws", { name: "Jaws and Claws", description: "Zebak with all his mechanics, and a shaman, a javelin colossus and a jaguar at the water's edge." }, "zebak", "versus", rangedGear, [
    npc("shaman", "colosseum.shaman", 25, 38),
    npc("javelin", "colosseum.javelin", 34, 37),
    npc("jaguar", "colosseum.jaguar", 30, 26),
  ], { bossMechanics: true }),
  example("suns-last-stand", { name: "Sol's Last Stand", description: "Sol Heredit in his arena without his phases, guarded by three berserkers and two archers of his warband." }, "sol_heredit", "versus", meleeGear, [
    npc("sol", "sol_heredit", 31, 36),
    npc("berserker-1", "warband.berserker", 27, 39),
    npc("berserker-2", "warband.berserker", 38, 39),
    npc("berserker-3", "warband.berserker", 27, 29),
    npc("archer-1", "warband.archer", 38, 29),
    npc("archer-2", "warband.archer", 32, 41),
  ]),
  example("the-hunt", { name: "The Hunt", description: "The Doom, Vardorvis and a manticore hunt you through the nexus. Pillars of boulders give you something to run around." }, "toa_nexus", "versus", mageGear, [
    npc("doom", "doom", 29, 18),
    npc("vardorvis", "vardorvis", 31, 37),
    npc("manticore", "colosseum.manticore", 24, 33),
  ], {}, [...wall(26, 25, 2, 0, 1), ...wall(36, 25, 2, 0, 1), ...wall(28, 30, 2, 1, 0), ...wall(33, 30, 2, 1, 0)]),
  example("spiders-nest", { name: "Spider's Nest", description: "Araxxor in his lair with all his mechanics, and a Mirrorback and a Ruptura Araxyte already out of their eggs." }, "araxxor", "versus", meleeGear, [
    npc("mirrorback", "araxxor.mirrorback", 56, 20),
    npc("ruptura", "araxxor.ruptura", 58, 26),
  ], { bossMechanics: true }),
  example("corrupted-storm", { name: "Corrupted Storm", description: "The Corrupted Hunllef in the Colosseum: four of a style and a switch, a prayer you have to hit around, and its tornadoes; two shamans on the flanks." }, "colosseum", "versus", mageGear, [
    npc("hunllef", "corrupted_hunllef", 30, 42),
    npc("shaman-1", "colosseum.shaman", 18, 32),
    npc("shaman-2", "colosseum.shaman", 45, 32),
  ]),
  example("maggot-feast", { name: "Maggot Feast", description: "The Maggot King in his lair with all his mechanics, and two of his larvae already on the floor." }, "maggot_king", "versus", rangedGear, [
    npc("larva-1", "maggot_king.larva", 26, 34),
    npc("larva-2", "maggot_king.larva", 36, 34),
  ], { bossMechanics: true }),

  // --- free for all ----------------------------------------------------------
  example("inferno-vs-colosseum", { name: "Inferno vs Colosseum", description: "The Inferno's monsters (team 1) against the Colosseum's (team 2). You watch." }, "colosseum", "ffa", rangedGear, [
    npc("meleer", "inferno.meleer", 20, 40, team("1")),
    npc("ranger", "inferno.ranger", 19, 30, team("1")),
    npc("mager", "inferno.mager", 21, 22, team("1")),
    npc("blob", "inferno.blob", 26, 46, team("1")),
    npc("jaguar", "colosseum.jaguar", 42, 40, team("2")),
    npc("javelin", "colosseum.javelin", 43, 30, team("2")),
    npc("manticore", "colosseum.manticore", 40, 22, team("2")),
    npc("minotaur", "colosseum.minotaur", 38, 46, team("2")),
  ], { ffaIncludesPlayer: false }),
  example("battle-royale", { name: "Battle Royale", description: "JalTok-Jad, Vardorvis, the Doom, a manticore, a minotaur and an Inferno mager in the nexus, every one for itself, and you among them." }, "toa_nexus", "ffa", meleeGear, [
    npc("jad", "inferno.jad", 24, 25),
    npc("vardorvis", "vardorvis", 38, 27),
    npc("doom", "doom", 29, 18),
    npc("manticore", "colosseum.manticore", 24, 33),
    npc("minotaur", "colosseum.minotaur", 35, 32),
    npc("mager", "inferno.mager", 29, 33),
  ]),
  example("three-kingdoms", { name: "Three Kingdoms", description: "JalTok-Jad and an Inferno meleer (team 1), Vardorvis and the warband (team 2), the Doom and a manticore (team 3). You watch." }, "colosseum", "ffa", mageGear, [
    npc("jad", "inferno.jad", 19, 38, team("1")),
    npc("meleer", "inferno.meleer", 20, 30, team("1")),
    npc("vardorvis", "vardorvis", 40, 44, team("2")),
    npc("berserker-1", "warband.berserker", 37, 46, team("2")),
    npc("berserker-2", "warband.berserker", 43, 46, team("2")),
    npc("seer", "warband.seer", 40, 48, team("2")),
    npc("doom", "doom", 37, 21, team("3")),
    npc("manticore", "colosseum.manticore", 44, 26, team("3")),
  ], { ffaIncludesPlayer: false }),
  example("bodyguards", { name: "Bodyguards", description: "Two jaguars and a minotaur fight on your side (A) against an Inferno wave led by JalTok-Jad (team 1)." }, "inferno", "ffa", meleeGear, [
    npc("jaguar-west", "colosseum.jaguar", 26, 30, team("player")),
    npc("jaguar-east", "colosseum.jaguar", 33, 30, team("player")),
    npc("minotaur", "colosseum.minotaur", 29, 27, team("player")),
    npc("jad", "inferno.jad", 28, 41, team("1")),
    npc("meleer", "inferno.meleer", 19, 40, team("1")),
    npc("ranger", "inferno.ranger", 39, 40, team("1")),
    npc("mager", "inferno.mager", 20, 20, team("1")),
    npc("blob", "inferno.blob", 39, 20, team("1")),
  ]),
  example("spells-vs-arrows", { name: "Spells vs Arrows", description: "Every caster (team 1: an Inferno mager, two seers, two shamans) against every archer (team 2: an Inferno ranger, two archers, two javelin colossi) in Yama's room, without Yama, across a line of jugs they shoot over. You watch." }, "yama", "ffa", mageGear, [
    npc("mager", "inferno.mager", 20, 30, team("1")),
    npc("seer-1", "warband.seer", 20, 25, team("1")),
    npc("seer-2", "warband.seer", 22, 35, team("1")),
    npc("shaman-1", "colosseum.shaman", 24, 23, team("1")),
    npc("shaman-2", "colosseum.shaman", 24, 33, team("1")),
    npc("ranger", "inferno.ranger", 39, 30, team("2")),
    npc("archer-1", "warband.archer", 42, 26, team("2")),
    npc("archer-2", "warband.archer", 42, 34, team("2")),
    npc("javelin-1", "colosseum.javelin", 36, 23, team("2")),
    npc("javelin-2", "colosseum.javelin", 36, 33, team("2")),
  ], { ffaIncludesPlayer: false, playerStart: [31, 39] }, lowWall(31, 24, 9, 0, 1)),
  example("king-of-the-hill", { name: "King of the Hill", description: "A ring of boulders in the middle of Sol Heredit's arena, and a jaguar, a minotaur, Vardorvis, an Inferno meleer and a manticore, every one for itself. You are in the ring." }, "sol_heredit", "ffa", meleeGear, [
    npc("jaguar", "colosseum.jaguar", 27, 39),
    npc("minotaur", "colosseum.minotaur", 36, 38),
    npc("vardorvis", "vardorvis", 27, 29),
    npc("meleer", "inferno.meleer", 35, 28),
    npc("manticore", "colosseum.manticore", 31, 39),
  ], { playerStart: [32, 34] }, [...wall(30, 32, 5, 1, 0), ...wall(30, 36, 5, 1, 0), [30, 33], [30, 35], [34, 33], [34, 35]]),
  example("titan-clash", { name: "Titan Clash", description: "TzKal-Zuk in the middle of the Colosseum, and JalTok-Jad, Vardorvis, the Doom and Yama around him, every one for himself. You watch." }, "colosseum", "ffa", mageGear, [
    npc("zuk", "inferno.zuk", 29, 32),
    npc("jad", "inferno.jad", 19, 30),
    npc("vardorvis", "vardorvis", 42, 34),
    npc("doom", "doom", 30, 43),
    npc("yama", "yama", 30, 21),
  ], { ffaIncludesPlayer: false }),
  example("allies-against-the-doom", { name: "Allies Against the Doom", description: "The Doom of Mokhaiotl's deeper room with all his mechanics, and a jaguar, a minotaur, Vardorvis and a javelin colossus fighting on your side." }, "doom_deep", "ffa", rangedGear, [
    npc("jaguar", "colosseum.jaguar", 26, 29, team("player")),
    npc("minotaur", "colosseum.minotaur", 35, 29, team("player")),
    npc("vardorvis", "vardorvis", 30, 26, team("player")),
    npc("javelin", "colosseum.javelin", 37, 26, team("player")),
  ], { bossMechanics: true }),
  example("warband-civil-war", { name: "Warband Civil War", description: "Sol Heredit's warband split in two: berserkers, archers and a seer on each side of a wall of boulders. You watch." }, "colosseum", "ffa", meleeGear, [
    npc("red-berserker-1", "warband.berserker", 22, 38, team("1")),
    npc("red-berserker-2", "warband.berserker", 22, 30, team("1")),
    npc("red-berserker-3", "warband.berserker", 24, 34, team("1")),
    npc("red-archer-1", "warband.archer", 19, 40, team("1")),
    npc("red-archer-2", "warband.archer", 19, 28, team("1")),
    npc("red-seer", "warband.seer", 18, 34, team("1")),
    npc("blue-berserker-1", "warband.berserker", 42, 38, team("2")),
    npc("blue-berserker-2", "warband.berserker", 42, 30, team("2")),
    npc("blue-berserker-3", "warband.berserker", 40, 34, team("2")),
    npc("blue-archer-1", "warband.archer", 45, 40, team("2")),
    npc("blue-archer-2", "warband.archer", 45, 28, team("2")),
    npc("blue-seer", "warband.seer", 46, 34, team("2")),
  ], { ffaIncludesPlayer: false, playerStart: [32, 47] }, [...wall(32, 31, 3, 0, 1), ...wall(32, 36, 3, 0, 1)]),
  example("four-corners", { name: "Four Corners", description: "Four teams in the corners of the Inferno: JalTok-Jad (1), TzKal-Zuk (2), the Doom (3), Vardorvis and a manticore (4), and a cross of boulders in the middle. You watch." }, "inferno", "ffa", rangedGear, [
    npc("jad", "inferno.jad", 18, 40, team("1")),
    npc("zuk", "inferno.zuk", 37, 38, team("2")),
    npc("doom", "doom", 18, 18, team("3")),
    npc("vardorvis", "vardorvis", 40, 19, team("4")),
    npc("manticore", "colosseum.manticore", 37, 22, team("4")),
  ], { ffaIncludesPlayer: false, playerStart: [30, 26] }, [...wall(27, 31, 7, 1, 0), ...wall(30, 28, 3, 0, 1), ...wall(30, 32, 3, 0, 1)]),
  example("immovable-titans", { name: "Immovable Titans", description: "The Leviathan (1), Zebak with his tail (2) and Duke Sucellus (3) never move from where they stand; the Corrupted Hunllef (4) walks among them with its tornadoes. You watch." }, "colosseum", "ffa", mageGear, [
    npc("leviathan", "leviathan", 18, 30, team("1")),
    npc("zebak", "zebak", 37, 30, team("2")),
    npc("duke", "duke_sucellus", 29, 44, team("3")),
    npc("hunllef", "corrupted_hunllef", 29, 20, team("4")),
  ], { ffaIncludesPlayer: false, playerStart: [32, 27] }),
  example("brood-war", { name: "Brood War", description: "Araxxor and his araxytes (team 1) against the Maggot King and his larvae (team 2). You watch." }, "colosseum", "ffa", rangedGear, [
    npc("araxxor", "araxxor", 19, 30, team("1")),
    npc("acidic", "araxxor.acidic", 21, 39, team("1")),
    npc("maggot-king", "maggot_king", 39, 31, team("2")),
    npc("larva-1", "maggot_king.larva", 37, 38, team("2")),
    npc("larva-2", "maggot_king.larva", 38, 26, team("2")),
  ], { ffaIncludesPlayer: false, playerStart: [32, 22] }),
  example("hunllef-hunting-party", { name: "Hunllef Hunting Party", description: "The Corrupted Hunllef in its room with all its mechanics, and a jaguar and a minotaur fighting on your side." }, "corrupted_hunllef", "ffa", rangedGear, [
    npc("jaguar", "colosseum.jaguar", 52, 52, team("player")),
    npc("minotaur", "colosseum.minotaur", 59, 51, team("player")),
  ], { bossMechanics: true }),
];

export const getSandboxExample = (key) => sandboxExamples.find((entry) => entry.key === key);
