// Brutus's ids and his field's tiles. The ids are the game cache's, named as RuneLite's gameval lists name them
// (AnimationID COW_BOSS_*, SpotanimID VFX_COWBOSS_*), each checked against the cache and against six recorded kills
// (OBS: Outside recordings of 2026-11-27, one player, kill counts 212 to 217). Tiles are local to map square 50,51
// (region 12851), the north-east corner of the Lumbridge cow field; a local tile is the world one minus (3200, 3264).
// The field's east part is in map square 51,51 (local x from 64).
export const npcTypeIds = {
  // CACHE, TABLE: Brutus (58 hitpoints, 3x3). OBS: 15626 is the one fought, in every recording.
  brutus: 15626,
  // CACHE: COWBOSS_HARDMODE, Demonic Brutus (TABLE: 750 hitpoints), and COWBOSS_HARDMODE_GHOST, the ghosts that repeat
  // his specials (model 60116; the same walk and stand as his).
  demonic: 15628,
  demonicGhost: 15629,
};

// Demonic Brutus's sequences and graphics (CACHE: AnimationID COW_BOSS_*, SpotanimID VFX_COWBOSS_HM_*). Which plays
// when is inferred from their names: no recording of the fight has his ids yet (OBS: one video).
export const demonicSeqIds = {
  fadeOut: 13795, // COW_BOSS_CHARGE_START_FADE_OUT: as he fades at a special's start
  chargeFadeIn: 13793, // COW_BOSS_CHARGING_FADE_IN_FADE_OUT: as he reappears for a charge
  ghostChargeFadeIn: 13794, // COW_BOSS_GHOST_CHARGING_FADE_IN_FADE_OUT
  stompFadeIn: 13799, // COW_BOSS_STOMP_FADE_IN: as he reappears for a slam
  ghostStompFadeIn: 13800, // COW_BOSS_GHOST_STOMP_FADE_IN
  ghostFadeOut: 13796, // COW_BOSS_GHOST_CHARGE_START_FADE_OUT: as a ghost goes
  chargeEndFadeIn: 13797, // COW_BOSS_CHARGE_END_FADE_IN: as he comes back after his charge
};

// Phase 2's orbs, one of each style (CACHE: their sequences named MILK_ORB_*): spawned over the player (a tick long),
// held there (a loop a tick long), dropping onto him (a tick and a bit), and the splash on him as each lands.
export const orbSpotAnims = {
  spawn: { ranged: 3600, melee: 3601, magic: 3602 }, // VFX_COWBOSS_HM_SPAWN_*_01, MILK_ORB_SPAWN (30 cycles)
  held: { ranged: 3591, melee: 3592, magic: 3593 }, // VFX_COWBOSS_HM_*_01, MILK_ORB_STATIC (30 cycles, looping)
  drop: { ranged: 3597, melee: 3598, magic: 3599 }, // VFX_COWBOSS_HM_LAUNCH_*_01, MILK_ORB_DROP (35 cycles)
  impact: { ranged: 3594, melee: 3595, magic: 3596 }, // VFX_COWBOSS_HM_IMPACT_*_01, MILK_IMPACT (30 cycles)
};

export const seqIds = {
  idle: 13781, // CACHE: COW_BOSS_IDLE, the stand of 15626
  walk: 13782, // CACHE: COW_BOSS_WALK
  spawn: 13790, // CACHE: COW_BOSS_SPAWN; OBS: as he appears
  attack: 13783, // CACHE: COW_BOSS_ATTACK; OBS: his standard attack, every 5 ticks
  stomp: 13785, // CACHE: COW_BOSS_STOMP; OBS: with "*snorts*", each of his three stomps
  charge: 13778, // CACHE: COW_BOSS_CHARGE; OBS: with "*growls*"
  death: 13784, // CACHE: COW_BOSS_DEATH; OBS: with "m-moo..."
};

export const spotAnims = {
  stompTile: 3588, // CACHE: VFX_COWBOSS_STOMP_IMPACT01; OBS: on each stomped tile, as it lands
  stompBoss: 3589, // CACHE: VFX_COWBOSS_STOMP_IMPACT02; OBS: on him, as it lands
};

// OBS: the two sounds of the fight that are in no animation, each played to the player on the tick of its overhead
// text: the snort before a stomp, and the growl before a charge. His others (the attack, the stomp's thud, the charge's
// run and impact, the death) are in his animations' frames (CACHE), and the scene plays those.
export const soundIds = {
  snort: 11213,
  growl: 11210,
  range: 15, // OBS: his area sounds are heard to 15 tiles
};

export const mapSquare = { x: 50, y: 51 }; // CACHE; WIKI: "the north-east corner of the cow field"; OBS: world 3261, 3287
export const mapSquareOffsets = [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }]; // the field's east fence is in 51,51
export const bossSize = 3; // CACHE, TABLE
// OBS: his south-west tile as he appears (world 3261, 3287), in all six recordings. inferred: the player a few tiles
// west of him, where the recorded player walked in from.
export const bossStart = [61, 23];
export const playerStart = [57, 24];

// Scenery that isn't in the fight's copy of the field (local tiles of map square 50,51). OBS: the plant at 57,25, beside
// the player's start. The two others share its id, which collision leaves out by (encounter.js), on the field's west
// edge: they aren't drawn either, so nothing is drawn where the player can walk.
export const removedLocs = [
  { localX: 57, localY: 25, locId: 1393 }, // CACHE: "Plant"
  { localX: 49, localY: 14, locId: 1393 },
  { localX: 51, localY: 10, locId: 1393 },
];

export const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
// Edge to edge, Chebyshev: 0 under him, 1 beside him (diagonally too).
export const edgeDistance = (position, size, [x, y]) =>
  Math.max(Math.max(position[0] - x, 0, x - (position[0] + size - 1)), Math.max(position[1] - y, 0, y - (position[1] + size - 1)));
