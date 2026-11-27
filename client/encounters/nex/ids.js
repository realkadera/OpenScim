// Nex: the game's ids and the chamber's tiles.
//
// CACHE: the Ancient Prison's chamber is map square 45,81 (region 11601); the
// game copies it, with its neighbours 44,81 and 46,81, into an instance
// unturned (OBS: the scene's templates). Tiles here are local to the map
// square, [x, y] from its south-west corner: a world tile (x, y) is
// (x - 2880, y - 5184).
//
// OBS: thirteen Outside recordings of 2026-11-26 (format 6, revision 243),
// seven kills of one team seen from two of its players, SendTherapy (seven
// recordings) and Vaerric (six), with one or two others: three or four
// players a kill. Six of the kills are in both players' recordings. They hold
// every animation, graphic, projectile, hitsplat, overhead text and object of
// the fight, a tick at a time, and both recorders' own prayers, hitpoints and
// prayer points; the other players' tiles and overhead prayers.
//
// OBS also: twenty-two recordings of 2026-11-27 by the same two (twelve by
// SendTherapy, ten by Vaerric), eleven kills of the same team of three or
// four, each seen by both but one. With them the game's own messages of each
// special, both recorders' combat stats tick by tick (Turmoil, Umbra's drain),
// her heals under Soul Split, and the MVP of each kill. "OBS (27th)" marks a
// number taken from these.
export const regionOrigin = [2880, 5184];
export const local = ([x, y]) => [x - regionOrigin[0], y - regionOrigin[1]];

export const mapSquare = { x: 45, y: 81 };

export const bossSize = 3;
// OBS (13 of 13): she rises on 44,18 (south-west of her 3 x 3), the middle of the chamber, and she comes back to it.
export const bossStart = [44, 18];
export const centre = [45, 19]; // the middle tile of her body there
// OBS: the four of them stand around her as she rises, a tile from her (45,21 north, 45,17 south, 43,19 west, 47,19
// or 48,19 east); the recorder stood on 43,19 in four of six. The local player takes 42,19, a step back from her.
export const playerStart = [42, 19];
export const teammateStarts = [[45, 21], [45, 17], [47, 19], [43, 17]];

// CACHE: the floor of the chamber (cache-objects map 11601): x 31 to 59, y 5 to 33, its corners and pillars blocked.
// The arena is built from the map (collision "auto"); this is the box the encounter keeps it in (encounter.js,
// refineArenaConfig), which leaves out the lobby west of the barrier (x 29).
export const chamberBounds = { minX: 31, maxX: 59, minY: 5, maxY: 33 };

// OBS: the four mages, each on its corner's tile, from her intro to its death.
export const mageTiles = {
  fumus: [33, 31], // north-west
  umbra: [57, 31], // north-east
  cruor: [57, 7], // south-east
  glacies: [33, 7], // south-west
};

// OBS (9 smoke dashes): she shows at the far end of one aisle for a tick, five ticks after "There is...", her
// south-west tile 10 from the middle: north 44,28, west 34,18, east 54,18 (and, by symmetry, south 44,8).
export const aisles = {
  north: { end: [44, 28], step: [0, 1] },
  south: { end: [44, 8], step: [0, -1] },
  east: { end: [54, 18], step: [1, 0] },
  west: { end: [34, 18], step: [-1, 0] },
};

// OBS: where she jumps to when no one has fought her for a while: the middle 44,18 in 17 of 23, else the tile of
// the bridge she was nearest (41,18, 40,18, 42,18; 54,26, 55,26; 34,8, 36,7). The middle is used here; a bridge when
// she is far from it (inferred).
export const jumpSpots = [[44, 18], [54, 26], [34, 8], [54, 9], [34, 27]];

export const npcTypeIds = {
  nex: 11278, // CACHE, OBS: her five phases are one NPC, and her Zaros phase without a curse
  nexRising: 11279, // OBS: until "Fill my soul with smoke!"
  // OBS (27th): in her Zaros phase she turns into these as her curse changes (the same model; the game draws each
  // form's curse over her). 11280 heals her (279 heal splats, all under it); under 11281 "Nex deflects your damage
  // back at you!" (5 of 5). 11282 from "Taste my wrath!" to her death.
  nexSoulSplit: 11280,
  nexDeflect: 11281,
  nexDying: 11282,
  fumus: 11283,
  umbra: 11284,
  cruor: 11285,
  glacies: 11286,
  reaver: 11294,
  // Stand-ins of the cache for what the game draws otherwise (inferred):
  // the stalagmites of her ice prison are objects in the game (42944), which the client cannot click; here they are
  // NPCs drawn as the cache's "Icicles" (14153).
  stalagmite: 14153,
  // A teammate the encounter plays (party.js) until the fight is played by people (CACHE: NPCs on the player's
  // skeleton, so the player's animations play on them): a ranger and a meleer.
  rangerMate: 8636, // Third Age Ranger
  meleeMate: 2214, // Knight of Saradomin
};

export const seqIds = {
  // CACHE (NPC 11278): she stands with 9177 and walks with 9175; OBS: the same.
  idle: 9177,
  walk: 9175,
  // OBS: her animations, each with what it was in the recordings.
  melee: 9180, // every phase
  magic: 9189, // her smoke and Zaros spells at everyone, her shadow shots, her call to Fumus and Cruor
  cast: 9188, // her virus, blood and ice barrages, her ice prison, her call to Umbra and Glacies
  dash: 9178, // "There is..." (her smoke dash)
  jump: 9187, // she leaps back to the middle (or a bridge)
  darkness: 9182, // "AT LAST!" and "Embrace darkness!"
  smash: 9186, // "Fear the shadow!" and "Contain this!"
  siphon: 9183, // "A siphon will solve this!"
  zaros: 9179, // "NOW, THE POWER OF ZAROS!"
  death: 9184, // a tick after "Taste my wrath!"
  // OBS: her mages.
  mageIdle: 808,
  mageCast: 1979,
  mageDeath: 836,
  // CACHE (NPC 11294): stands with 9195, walks with 9193; OBS: attacks with 9194, dies with 9192.
  reaverIdle: 9195,
  reaverWalk: 9193,
  reaverCast: 9194,
  reaverDeath: 9192,
  // CACHE: the player's own: stand, walk, run, death, and a crossbow shot (rune crossbow) and a stab, for teammates.
  mateIdle: 808,
  mateWalk: 819,
  mateRun: 824,
  mateCrossbow: 4230,
  mateStab: 386,
  mateDeath: 836,
};

export const spotAnims = {
  // OBS: her projectiles (all leave 46 cycles after her animation, slope 5, offset 84; heights as given) and the
  // graphic each lands with.
  smoke: 1997, // 100 -> 96
  smokeImpact: 1998,
  shadow: 1999, // 140 -> 130
  blood: 2000, // 50 -> 40
  bloodImpact: 2001,
  sacrifice: 2002, // 50 -> 40
  sacrificeImpact: 2003,
  ice: 2004, // 60 -> 50
  iceImpact: 2005,
  prison: 2006, // 30 -> 20
  zaros: 2007, // 100 -> 96
  zarosImpact: 2008,
  virus: 754, // on her as she casts her virus
  siphon: 2015, // on her as she kneels
  power: 2016, // on her at "NOW, THE POWER OF ZAROS!"
  wrathCentre: 2013, // her wrath, on her middle
  wrath: 2014, // ... and on tiles about her
  wrathThrow: 2012, // from her middle to those tiles
  shadowBurst: 383, // her shadows as they strike
  // OBS: her mages and reavers.
  empower: 2010, // a mage's beam into her (her intro, a phase's start)
  smokeBarrage: 390,
  smokeBarrageImpact: 391,
  shadowBarrageImpact: 383,
  bloodBarrageImpact: 377,
  iceBarrage: 368,
  iceBarrageImpact: 369,
  reaverBolt: 372,
  reaverImpact: 373,
  // CACHE: a teammate's bolt.
  bolt: 27,
};

// OBS: the flight of her projectiles: they leave 46 cycles after her animation and arrive 56 cycles plus 10 a tile
// of distance from her middle, at least 60 (60 to 146 seen); a hit lands on the tick the projectile arrives, rounded
// (60 -> 2 ticks, 76 to 96 -> 3, 106 to 126 -> 4, 136 and 146 -> 5). Her Zaros spells land a tick later (3 at 60).
export const flight = { leaves: 46, base: 56, perTile: 10, least: 60, slope: 5, offset: 84 };
export const heights = {
  smoke: [100, 96], shadow: [140, 130], blood: [50, 40], sacrifice: [50, 40], ice: [60, 50], prison: [30, 20], zaros: [100, 96],
};

// OBS: the objects on the floor.
export const locIds = {
  shadow: 42942, // her shadows, under each player at "Fear the shadow!"
  shadowSpent: 29733, // ... as they strike
  icicle: 26209, // her containment's inner ring and an ice prison's middle
  icicleOuter: 42943, // her containment's outer ring
  prisonWall: 42944, // an ice prison's stalagmites (drawn here as NPCs: npcTypeIds.stalagmite)
};

// OBS: the sounds the server sends, each with the tick after her animation it comes on.
export const sounds = {
  rise: 5303, // "AT LAST!"
  call: 5286, // a mage called ("Fumus!") and a phase's start
  melee: 5183, // +1
  smoke: 5256,
  shadow: 5200,
  blood: 5302,
  bloodImpact: 5281,
  ice: 171,
  zaros: 5285,
  virus: 5211,
  cough: 5304,
  dash: 5227, // "NO ESCAPE!"
  smash: 5230, // "Fear the shadow!" and "Contain this!", +1
  smashSecond: 5212, // +1
  darkness: 5240,
  siphon: 4497,
  siphonKneel: 5252, // +1
  sacrifice: 5223,
  prison: 5244,
  jump: 5291, // +1
  power: 5202, // "NOW, THE POWER OF ZAROS!", +1
  death: 5180, // +1
};

// OBS (27th): the game's messages come in its highlight colours (the tags mes_hl_red, mes_hl_gre, mes_hl_mag and
// mes_hl_pur); the colours drawn for the last two are inferred.
export const colors = { red: "#ff3045", green: "#0dc10d", magenta: "#ff40ff", purple: "#a64dff" };

// Tile helpers.
export const key = ([x, y]) => x + "," + y;
export const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
// From a tile to the nearest tile of a footprint (0 under it).
export function gapTo(tile, position, size = bossSize) {
  const dx = Math.max(position[0] - tile[0], 0, tile[0] - (position[0] + size - 1));
  const dy = Math.max(position[1] - tile[1], 0, tile[1] - (position[1] + size - 1));
  return Math.max(dx, dy);
}
export function middleOf(position, size = bossSize) {
  return [position[0] + Math.floor(size / 2), position[1] + Math.floor(size / 2)];
}
export function footprintTiles(position, size = bossSize) {
  const tiles = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) tiles.push([position[0] + dx, position[1] + dy]);
  return tiles;
}
export function inChamber([x, y]) {
  return x >= chamberBounds.minX && x <= chamberBounds.maxX && y >= chamberBounds.minY && y <= chamberBounds.maxY;
}
