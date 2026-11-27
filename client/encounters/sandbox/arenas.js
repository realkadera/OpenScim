// The arenas a sandbox scenario can be played in: the rooms of the other
// encounters, without their fights. Each is a variant kind of the sandbox
// (registry.js: variantFactories, variantDescriptors), with a descriptor of
// its own (its map square and how its collision is built) and a
// presentation of its own (presentation.js), as the Doom of Mokhaiotl's
// deeper room is.
//
// Every entry:
//   id            the name a scenario file uses, and the route's second part
//                 (/sandbox/<id>); never change one
//   name          what the menus show
//   mapSquare, mapSquareOffsets?, playerStart, collision   as in the
//                 encounter's own descriptor, from its module
//   locRender     the levels of map objects the scene draws
//   camera        { yaw, pitch, zoom } on entering, from the encounter's
//                 presentation
//   hostKind      the encounter whose boss can be fought here with all its
//                 mechanics (encounter.js); the scene is then that encounter's
//   hostHealers?  the definition ids of the host's NPCs that heal its boss:
//                 every enemy of the boss goes for them first (encounter.js,
//                 healerOf), and the boss is never one of them
//   hostRulesForMonsters?  true: a monster's hit on the host's NPCs goes
//                 through the host's rule for the player's hits (encounter.js,
//                 hostTakes): a shield, a totem's charge
//   hostObjectives?(host, world)  the host's NPCs its enemies go for first,
//                 while the fight is to be won through them (encounter.js,
//                 nearestObjective)
//   refineArena?  what the encounter makes of the arena the map gives
//                 (Duke's asylum adds its ice), with or without its boss
//   arenaConfig?  with collision "custom": the arena itself, not read from
//                 the map (the Leviathan's bridge, the open arena)
//   sceneObjects? what the scene draws besides the map (the open arena's wall)
// The arena of the lobby is left out: its floor and walls are drawn by its
// own scene (in client/assets/rendering.js), which the sandbox cannot use.
import { solMapSquare, solPlayerStart } from "../sol-heredit/constants.js";
import { solBoundaryLocs } from "../sol-heredit/boundaryLocs.js";
import { colosseumPlayerStart } from "../colosseum/constants.js";
import { infernoMapSquare, infernoMapSquareOffsets, infernoPlayerStart, infernoExcludedStaticLocIds } from "../inferno/constants.js";
import { vardorvisMapSquare } from "../vardorvis/encounter.js";
import { arenaSeed as dukeArenaSeed, dukeMapSquare, dukeRoomArena, playerStart as dukePlayerStart } from "../duke-sucellus/encounter.js";
import { leviathanFloorArena, leviathanMapSquare, playerStart as leviathanPlayerStart } from "../leviathan/encounter.js";
import { openArenaFloor, openArenaMapSquare, openArenaPlayerStart, openArenaSceneObjects } from "./openArena.js";
import { araxxorMapSquare, araxxorMapSquareOffsets, playerStart as araxxorPlayerStart } from "../araxxor/encounter.js";
import { maggotKingMapSquare } from "../maggot-king/encounter.js";
import { playerStart as maggotKingPlayerStart } from "../maggot-king/ids.js";
import { hunllefFloorArena, mapSquare as hunllefMapSquare, playerStart as hunllefPlayerStart } from "../corrupted-hunllef/encounter.js";
import { alchemicalHydraMapSquare } from "../alchemical-hydra/encounter.js";
import { playerStart as hydraPlayerStart } from "../alchemical-hydra/ids.js";
import { buildArena as nightmareDreamArena, phosanisNightmareMapSquare } from "../phosanis-nightmare/encounter.js";
import { playerStart as nightmarePlayerStart } from "../phosanis-nightmare/ids.js";

export const sandboxKind = "sandbox";
export const sandboxVariantKind = (arenaId) => (arenaId === sandboxArenas[0].id ? sandboxKind : `${sandboxKind}_${arenaId}`);

export const sandboxArenas = [
  {
    id: "colosseum",
    name: "Fortis Colosseum",
    mapSquare: solMapSquare,
    playerStart: [...colosseumPlayerStart],
    collision: { mode: "auto", seed: [...colosseumPlayerStart] },
    locRender: { bounds: null, levels: [0, 1, 2] },
    camera: { yaw: 270, pitch: -60, zoom: 300 }, // inferred: looking along the arena from the player's start
  },
  {
    id: "sol_heredit",
    hostKind: "sol_heredit",
    name: "Sol Heredit's arena",
    mapSquare: solMapSquare,
    playerStart: [...solPlayerStart],
    collision: { mode: "auto", seed: [...solPlayerStart], dynamicLocs: solBoundaryLocs },
    locRender: { bounds: null, levels: [0, 1, 2] },
    camera: { yaw: 180, pitch: -55, zoom: 320 }, // inferred: Sol's own scene takes over with his boss
  },
  {
    id: "inferno",
    name: "The Inferno (no pillars)",
    mapSquare: infernoMapSquare,
    mapSquareOffsets: infernoMapSquareOffsets,
    playerStart: [...infernoPlayerStart],
    // The pillars are the Inferno's NPCs; without them the floor is open.
    collision: { mode: "auto", seed: [...infernoPlayerStart], excludedStaticLocIds: infernoExcludedStaticLocIds },
    locRender: { bounds: null, levels: [0] },
    camera: { yaw: 180, pitch: -55, zoom: 360 }, // inferred: the whole open floor in view
  },
  {
    id: "yama",
    hostKind: "yama_p3",
    hostHealers: ["yama-void-flare"], // yama/voidFlares.js: an exploding flare heals him
    name: "Yama's room",
    mapSquare: { x: 23, y: 157 }, // registry.js
    // inferred: the middle of Yama's own start square (yama/constants.js,
    // yamaPlayerStartMin/Max [29, 35] to [33, 39]), which he picks at random.
    playerStart: [31, 37],
    // inferred: a floor tile in front of Yama, from which the room's floor is reached.
    collision: { mode: "auto", seed: [32, 30] },
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 180, pitch: -55, zoom: 300 }, // the fixture's (test/fixtures/training-ground)
  },
  {
    id: "zebak",
    hostKind: "zebak",
    name: "Zebak's room (ToA)",
    mapSquare: { x: 61, y: 84 }, // toa/zebak/native.js
    playerStart: [29, 32], // toa/zebak/native.js (start)
    collision: { mode: "auto", seed: [29, 32] }, // as toa/zebak/native.js seeds it
    locRender: { bounds: null, levels: [0, 1, 2] },
    camera: { yaw: 90, pitch: -40, zoom: 240 }, // toa/zebak/native.js (defaultCamera)
  },
  {
    id: "vardorvis",
    hostKind: "vardorvis",
    name: "Vardorvis' clearing",
    mapSquare: vardorvisMapSquare,
    playerStart: [40, 24], // vardorvis/encounter.js (playerStart)
    collision: { mode: "auto", seed: [40, 24] }, // as vardorvis/encounter.js seeds it
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 180, pitch: -45, zoom: 320 }, // vardorvis/presentation.js (defaultCamera)
  },
  {
    id: "doom",
    hostKind: "doom_of_mokhaiotl",
    hostHealers: ["doom-larva"], // doom-of-mokhaiotl/hazards.js: a larva that reaches him heals him
    name: "Doom of Mokhaiotl, delve 1",
    mapSquare: { x: 20, y: 149 }, // doom-of-mokhaiotl/encounter.js
    playerStart: [31, 28], // doom-of-mokhaiotl/encounter.js (playerStart)
    collision: { mode: "auto", seed: [31, 28] }, // as doom-of-mokhaiotl/encounter.js seeds it
    locRender: { bounds: null, levels: [0] },
    camera: { yaw: 0, pitch: -45, zoom: 330 }, // doom-of-mokhaiotl/presentation.js (defaultCamera)
  },
  {
    id: "doom_deep",
    hostKind: "doom_of_mokhaiotl_deep",
    hostHealers: ["doom-larva"], // as delve 1
    name: "Doom of Mokhaiotl, deeper room",
    mapSquare: { x: 53, y: 100 }, // doom-of-mokhaiotl/encounter.js
    playerStart: [31, 28], // doom-of-mokhaiotl/encounter.js (playerStart, both rooms)
    collision: { mode: "auto", seed: [31, 28] }, // as doom-of-mokhaiotl/encounter.js seeds it
    locRender: { bounds: null, levels: [0] },
    camera: { yaw: 0, pitch: -45, zoom: 330 }, // doom-of-mokhaiotl/presentation.js (defaultCamera)
  },
  {
    id: "duke",
    hostKind: "duke_sucellus",
    name: "Duke Sucellus' asylum",
    mapSquare: dukeMapSquare,
    playerStart: [...dukePlayerStart], // duke-sucellus/encounter.js
    collision: { mode: "auto", seed: [...dukeArenaSeed] }, // as duke-sucellus/encounter.js seeds it
    refineArena: dukeRoomArena,
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 0, pitch: -40, zoom: 240 }, // duke-sucellus/presentation.js (defaultCamera)
  },
  {
    id: "leviathan",
    hostKind: "leviathan",
    name: "The Leviathan's Scar",
    mapSquare: leviathanMapSquare,
    playerStart: [...leviathanPlayerStart], // leviathan/encounter.js
    collision: { mode: "custom" }, // leviathan/encounter.js: the bridge is not level 0
    arenaConfig: leviathanFloorArena,
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 270, pitch: -45, zoom: 330 }, // leviathan/presentation.js (defaultCamera)
  },
  {
    id: "araxxor",
    hostKind: "araxxor",
    name: "Araxxor's lair",
    mapSquare: araxxorMapSquare,
    mapSquareOffsets: araxxorMapSquareOffsets,
    playerStart: [...araxxorPlayerStart], // araxxor/encounter.js
    collision: { mode: "auto", seed: [...araxxorPlayerStart] }, // as araxxor/encounter.js seeds it
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 90, pitch: -70, zoom: 330 }, // araxxor/presentation.js (defaultCamera)
  },
  {
    id: "maggot_king",
    hostKind: "maggot_king",
    hostHealers: ["maggot-king-larva"], // maggot-king/larvae.js: a larva heals him as it eats and leeches
    name: "The Maggot King's lair",
    mapSquare: maggotKingMapSquare,
    playerStart: [...maggotKingPlayerStart], // maggot-king/ids.js
    collision: { mode: "auto", seed: [...maggotKingPlayerStart] }, // as maggot-king/encounter.js seeds it
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 0, pitch: -40, zoom: 380 }, // maggot-king/presentation.js (defaultCamera)
  },
  {
    id: "corrupted_hunllef",
    hostKind: "corrupted_hunllef",
    name: "The Corrupted Hunllef's room",
    mapSquare: hunllefMapSquare,
    playerStart: [...hunllefPlayerStart], // corrupted-hunllef/encounter.js
    collision: { mode: "custom" }, // corrupted-hunllef/encounter.js: its 12 x 12 floor
    arenaConfig: hunllefFloorArena,
    locRender: { bounds: null, levels: [0, 1, 2, 3] }, // corrupted-hunllef/presentation.js
    camera: { yaw: 180, pitch: -55, zoom: 260 }, // corrupted-hunllef/presentation.js (defaultCamera)
  },
  {
    id: "alchemical_hydra",
    hostKind: "alchemical_hydra",
    name: "The Alchemical Hydra's chamber",
    mapSquare: alchemicalHydraMapSquare,
    playerStart: [...hydraPlayerStart], // alchemical-hydra/ids.js
    collision: { mode: "auto", seed: [...hydraPlayerStart] }, // as alchemical-hydra/encounter.js seeds it
    hostRulesForMonsters: true, // its shield takes three quarters off a monster's hit too
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 0, pitch: -55, zoom: 340 }, // alchemical-hydra/presentation.js (defaultCamera)
  },
  {
    id: "phosanis_nightmare",
    hostKind: "phosanis_nightmare",
    name: "Phosani's dream",
    mapSquare: phosanisNightmareMapSquare,
    playerStart: [...nightmarePlayerStart], // phosanis-nightmare/ids.js
    collision: { mode: "custom" }, // phosanis-nightmare/encounter.js: the floor of plane 3
    arenaConfig: nightmareDreamArena,
    hostHealers: ["phosanis-nightmare-parasite"], // phosanis-nightmare/minions.js: a parasite heals her shield
    hostRulesForMonsters: true, // a monster's hit goes to her shield and charges her totems, as the player's
    // phosanis-nightmare/minions.js: while her shield is down she takes no
    // hit; the totems not yet charged are what her enemies go for.
    hostObjectives: (host, world) =>
      host.stage === "totems" ? world.getNpcs().filter((npc) => host.minions.totemIndex(npc) >= 0 && !host.minions.charged[host.minions.totemIndex(npc)]) : [],
    locRender: { bounds: null, levels: [0, 1, 2, 3] }, // phosanis-nightmare/presentation.js
    camera: { yaw: 0, pitch: -50, zoom: 420 }, // phosanis-nightmare/presentation.js (defaultCamera)
  },
  {
    id: "open",
    name: "Open arena (50 x 50)",
    mapSquare: openArenaMapSquare,
    playerStart: [...openArenaPlayerStart],
    collision: { mode: "custom" }, // openArena.js: the middle 50 x 50 of the square
    arenaConfig: openArenaFloor,
    sceneObjects: openArenaSceneObjects,
    locRender: { bounds: null, levels: [0] },
    camera: { yaw: 0, pitch: -60, zoom: 460 }, // inferred: the whole floor in view from the south
  },
  {
    id: "toa_nexus",
    name: "Tombs of Amascut nexus",
    mapSquare: { x: 55, y: 80 }, // toa/nexus.js
    playerStart: [31, 26], // toa/nexus.js (start)
    collision: { mode: "auto", seed: [31, 26] }, // as toa/nexus.js seeds it
    locRender: { bounds: null, levels: [0, 1] },
    camera: { yaw: 0, pitch: -50, zoom: 330 }, // toa/nexus.js (defaultCamera)
  },
];

const arenaById = new Map(sandboxArenas.map((arena) => [arena.id, arena]));
export const getSandboxArena = (id) => arenaById.get(id) ?? sandboxArenas[0];
export const isSandboxArenaId = (id) => arenaById.has(id);
export const getSandboxArenaOfKind = (kind) => sandboxArenas.find((arena) => sandboxVariantKind(arena.id) === kind) ?? sandboxArenas[0];
