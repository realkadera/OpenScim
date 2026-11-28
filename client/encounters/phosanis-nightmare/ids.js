// Phosani's Nightmare: the game's ids and the dream's tiles.
//
// CACHE: the dream is map square 60,155 (region 15515), on plane 3; the
// game copies it unturned (tsps: rebuild_region from chunk 480,1240). Tiles
// here are local to the map square, [x, y] from its south-west corner: a
// world tile (x, y) is (x - 3840, y - 9920). The tiles below that come from
// RSPSApp/tsps (server/plugins/bosses/data/nightmare.json, "as captured" from
// rsprox recordings) are kept in world coordinates, as tsps gives them, and
// turned local by `local`.
//
// OBS (runelogs): the positions of fourteen runelogs.com combat logs of
// Phosani's Nightmare (RuneLite's combat logger: tiles, hitsplats, prayers,
// boosted levels, NPC changes; no animations, graphics or messages). Their
// totems and her lanes are on the tiles tsps gives.
//
// OBS (Outside): one Outside recording of a kill (Don Danz, 2026-11-25, kill
// count 80: the pool, the countdown, three phases and her desperation, with
// animations, graphics, NPC tiles and messages a tick at a time). Its tiles
// are the world tiles tsps gives.
export const regionOrigin = [3840, 9920];
export const local = ([x, y]) => [x - regionOrigin[0], y - regionOrigin[1]];

export const mapSquare = { x: 60, y: 155 };
export const plane = 3; // CACHE

// CACHE: the floor of plane 3 the player can stand on (its tiles' render
// flags; 1 is blocked): x 23 to 41 and y 21 to 41, the corners cut for the
// totems (x 26 to 38 only on y 22 to 24 and 38 to 40) and for the barriers'
// gaps (x 30 to 34 only on y 21 and 41).
export function isFloor([x, y]) {
  if (x < 23 || x > 41 || y < 21 || y > 41) return false;
  if (y === 21 || y === 41) return x >= 30 && x <= 34;
  if (y <= 24 || y >= 38) return x >= 26 && x <= 38;
  return true;
}
export const floorBounds = { minX: 23, maxX: 41, minY: 21, maxY: 41 };

export const bossSize = 5;
// tsps: "centre" [3870, 9949], where she stands at the start, after her
// flowers and in her blast form; OBS (runelogs): she comes back to 30,29 every time.
export const bossStart = local([3870, 9949]);
// tsps: "arrival" [3873, 9948], where the dream puts the player.
export const playerStart = local([3873, 9948]);
// The middle tile of her body at the start: the flowers' cross (tsps [3872, 9951]).
export const flowerCross = local([3872, 9951]);

export const npcTypeIds = {
  asleep: 9423, // OBS (Outside): as the player arrives, until she wakes into her first form
  // CACHE, tsps: her four phase forms, each with its weakened form (shield down, totems up).
  forms: { 9416: 9419, 11153: 11155, 9418: 9421, 9417: 9420 },
  blast: 9422, // tsps: her blast form, at the centre while the sleepwalkers come
  desperation: 11154, // tsps, OBS (runelogs): her last 150 hitpoints
  dying: 9424, // tsps, OBS (runelogs)
  totems: { sw: [9434, 9435, 9436], se: [9437, 9438, 9439], nw: [9440, 9441, 9442], ne: [9443, 9444, 9445] }, // dormant, ready, charged
  husks: { magic: 9466, range: 9467 },
  parasite: 9468,
  parasiteWeak: 9469,
  sleepwalker: 9470,
};
// tsps, OBS (runelogs, every kill): her forms come one after another round this
// cycle, from a random start, one a phase: 9416 -> 11153 -> 9418 -> 9417.
export const formCycle = [9416, 11153, 9418, 9417];

// The totems (CACHE: 3 x 3, south-west tiles on loc 37634's; tsps names and tiles; OBS (runelogs): the same tiles).
export const totems = [
  { corner: "sw", name: "south west", tile: local([3863, 9942]) },
  { corner: "se", name: "south east", tile: local([3879, 9942]) },
  { corner: "nw", name: "north west", tile: local([3863, 9958]) },
  { corner: "ne", name: "north east", tile: local([3879, 9958]) },
];
export const totemSize = 3;

// tsps: the eight tiles the sleepwalkers rise on, by the totems.
export const sleepwalkerTiles = [
  [3863, 9945], [3863, 9957], [3866, 9942], [3866, 9960], [3878, 9942], [3878, 9960], [3881, 9945], [3881, 9957],
].map(local);
// OBS (Outside, five recordings of 2026-11-25 and 26, 15 blasts, 45 sleepwalkers): never two at one totem, and
// every blast's on one of two rings of these tiles, each a quarter turn of the last round her centre (3872, 9951):
// after her first phase two across from each other (5 of 5), after her second three of a ring (5 of 5), after her
// last all four (5 of 5). Each ring here goes round anticlockwise.
export const sleepwalkerRings = [
  [[3881, 9945], [3878, 9960], [3863, 9957], [3866, 9942]],
  [[3881, 9957], [3866, 9960], [3863, 9945], [3878, 9942]],
].map((ring) => ring.map(local));
// Where a blast's sleepwalkers rise (sleepwalkerRings): one ring, turned at random; two across from each
// other, or the first `count` of it.
export function walkerTiles(count, random) {
  const ring = sleepwalkerRings[Math.floor(random() * sleepwalkerRings.length)];
  const turn = Math.floor(random() * ring.length);
  const steps = count === 2 ? [0, 2] : ring.map((_, n) => n).slice(0, count);
  return steps.map((step) => ring[(turn + step) % ring.length]);
}

// tsps, OBS (runelogs: 10 surges, every one on these lanes, 4 ticks from start to end): the tiles her body
// starts from and ends on, three lanes each way across the dream, either way along.
export const surgeLanes = [
  [[3866, 9942], [3866, 9956]],
  [[3870, 9941], [3870, 9957]],
  [[3874, 9942], [3874, 9956]],
  [[3863, 9945], [3877, 9945]],
  [[3863, 9949], [3877, 9949]],
  [[3863, 9953], [3877, 9953]],
].map((lane) => lane.map(local));

// tsps: the four layouts of her spores, "as captured".
export const sporeLayouts = [
  [[3863, 9951], [3866, 9948], [3866, 9954], [3869, 9945], [3869, 9957], [3870, 9949], [3870, 9953], [3872, 9942], [3872, 9960], [3874, 9949], [3874, 9953], [3875, 9945], [3875, 9957], [3878, 9948], [3878, 9954], [3881, 9951]],
  [[3864, 9951], [3867, 9946], [3867, 9956], [3869, 9951], [3872, 9943], [3872, 9948], [3872, 9954], [3872, 9959], [3875, 9951], [3877, 9946], [3877, 9956], [3880, 9951]],
  [[3864, 9946], [3864, 9956], [3866, 9951], [3867, 9943], [3867, 9959], [3868, 9947], [3868, 9955], [3872, 9945], [3872, 9951], [3872, 9957], [3876, 9947], [3876, 9955], [3877, 9943], [3877, 9959], [3878, 9951], [3880, 9946], [3880, 9956]],
  [[3864, 9947], [3864, 9955], [3866, 9951], [3868, 9943], [3868, 9959], [3869, 9948], [3869, 9954], [3872, 9945], [3872, 9951], [3872, 9957], [3875, 9948], [3875, 9954], [3876, 9943], [3876, 9959], [3878, 9951], [3880, 9947], [3880, 9955]],
].map((layout) => layout.map(local));

// Sequences (tsps, as captured; CACHE: each in the cache). Her stand and walk are
// her NPC types' own. OBS (Outside): every form stands with 8593 and walks with
// 8592, her blast form stands with 8603; asleep and dying she stands with 8613.
export const seqIds = {
  idle: 8593,
  walk: 8592,
  blastIdle: 8603,
  asleep: 8613,
  wake: 8611, // OBS (Outside): as "The Nightmare has awoken!" shows
  magic: 8595,
  range: 8596,
  melee: 8594,
  claws: 8598,
  clawRunStart: 9102,
  clawRun: 9103,
  clawRunEnd: 9104,
  husks: 8605,
  parasite: 8606,
  curse: 8599,
  spores: 8600,
  flowers: 8601,
  leave: 8607,
  back: 8609,
  surge: 8597,
  blastForm: 8610,
  blast: 8604,
  death: 8612,
  dying: 8613, // CACHE, OBS (Outside): the stand of her dying form (9424)
  totemCharged: 8589, // CACHE: the charged totems' stand
  husk: { idle: 8562, walk: 8563, spawn: 8567, magic: 8565, range: 8564, death: 8566 },
  parasite_: { idle: 8553, spawn: 8561, cast: 8555, range: 8554, death: 8559 },
  // OBS (Outside): they stand with 8569 and walk with 8534.
  sleepwalker: { idle: 8569, walk: 8534, spawn: 8572, death: 8570, absorb: 8571 },
  playerBurst: 8557, // the player as the parasite bursts out
};

// Spot animations (tsps, as captured).
export const spotAnims = {
  magic: 1764,
  magicImpact: 1765,
  range: 1766,
  claw: 1767,
  totemBolt: 1768,
  totemImpact: 1769,
  parasiteFlight: 1770,
  parasiteMagic: 1771,
  parasiteMagicImpact: 1772,
  parasiteDrain: 1773,
  parasiteHeal: 1774,
  parasiteRange: 1775,
  huskMagic: 1776,
  huskMagicImpact: 1777,
  huskRange: 1778,
  vomit: 1779,
  vomitWeak: 1780,
  huskFlight: 1781,
  blastImpact: 1782,
  flies: 1783,
};

// Map objects she places (tsps, as captured; CACHE: "Spore", 37738 growing and 37739 armed).
export const locIds = {
  spore: 37738,
  sporeArmed: 37739,
  flowerSafe: [37743, 37744, 37745], // planted, ready, open
  flowerBerry: [37740, 37741, 37742],
};
export const locSeqIds = {
  sporeGrow: 8630,
  sporeBurst: 8632,
  flowerSafe: { spawn: 8617, active: 8619, despawn: 8621 },
  flowerBerry: { spawn: 8623, active: 8625, despawn: 8627 },
};

// Sounds the server sends (tsps, as captured): [id, delay in cycles].
export const sounds = {
  magicImpact: 223,
  rangeImpact: 4219,
  meleeHit: 4319,
  claws: 4238,
  surge: 4301,
  sporeBurst: 4273,
  sleepwalkers: 4248,
  blastImpact: 4026,
  shieldFails: 4320,
  cursed: 4232,
  curseEnds: 4260,
  totems: 4254,
  flowersOpen: 4321,
  huskRise: 4312,
  huskDies: 4278, // OBS (Outside): as one dies (6 of 6), not as it attacks (tsps)
  parasiteBurst: 4314,
};

export const key = ([x, y]) => x + "," + y;
export const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const chebyshev = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
// Tiles between a tile and a footprint of `size` from its south-west tile: 0 under it, 1 beside it.
export function gapTo([x, y], [fx, fy], size = bossSize) {
  const dx = x < fx ? fx - x : x > fx + size - 1 ? x - (fx + size - 1) : 0;
  const dy = y < fy ? fy - y : y > fy + size - 1 ? y - (fy + size - 1) : 0;
  return Math.max(dx, dy);
}
export function footprintTiles([x, y], size = bossSize) {
  const tiles = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) tiles.push([x + dx, y + dy]);
  return tiles;
}
export const isTotemTile = (tile) => totems.some(({ tile: at }) => gapTo(tile, at, totemSize) === 0);
// Every tile of the dream's floor.
export const floorTiles = (() => {
  const tiles = [];
  for (let x = floorBounds.minX; x <= floorBounds.maxX; x++) for (let y = floorBounds.minY; y <= floorBounds.maxY; y++) if (isFloor([x, y])) tiles.push([x, y]);
  return tiles;
})();
