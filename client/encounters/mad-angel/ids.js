// The Mad Angel's ids and her nave's tiles. The ids are the game cache's, named
// as RuneLite's gameval lists name them (AnimationID, SpotanimID: NPC_MAD_ANGEL_*,
// VFX_MAD_ANGEL_*), each checked against the cache and against one recorded
// kill (OBS: an Encounter Recorder session of 2026-11-26, the boss dead on its
// tick 248). Tiles are local to map square 39,34 (region 10018), the nave of
// Ardeaglais; a local tile is the world one minus (2496, 2176).
export const npcTypeIds = {
  // CACHE, TABLE: the post-quest Mad Angel awake (755 hitpoints, 3x3). OBS: 16305 is the form she fights in;
  // 16307 is her form for the few ticks of her waking, 16306 asleep.
  madAngel: 16305,
};

export const seqIds = {
  idle: 4588, // CACHE: NPC_MAD_ANGEL_IDLE, the stand of 16305
  wake: 3321, // CACHE: NPC_MAD_ANGEL_SPAWN; OBS: on her second tick
  melee: 4589, // CACHE: NPC_MAD_ANGEL_ATTACK_MELEE; OBS: her standard attack
  smite: 4590, // CACHE: NPC_MAD_ANGEL_ATTACK_SMITE
  smiteEnraged: 8543, // CACHE: NPC_MAD_ANGEL_ATTACK_SMITE_ENRAGED
  blast: 14443, // CACHE: NPC_MAD_ANGEL_ATTACK_BOMB_THROW; OBS: each throw of the ball of light
  death: 14448, // CACHE: NPC_MAD_ANGEL_ATTACK_DEATH
  // CACHE: NPC_MAD_ANGEL_ATTACK_SWEEP_*. OBS: the draw (01), the cleaves (02), the cleave across to the other side,
  // and the reset; enraged the same with their own sequences.
  sweep: {
    right: { draw: 14429, cleave: 14430, across: 14431, reset: 14432 },
    left: { draw: 14433, cleave: 14434, across: 14435, reset: 14436 },
    rightEnraged: { draw: 14437, cleave: 14438, across: 14439 },
    leftEnraged: { draw: 14440, cleave: 14441, across: 14442 },
  },
};

export const spotAnims = {
  wake: 4010, // CACHE: VFX_MAD_ANGEL_SPAWN; OBS: with her waking
  smite: 4011, // CACHE: VFX_MAD_ANGEL_ATTACK_SMITE
  smiteEnraged: 4012, // CACHE: VFX_MAD_ANGEL_ATTACK_SMITE_ENRAGED
  smiteImpact: 4013, // CACHE: VFX_MAD_ANGEL_ATTACK_SMITE_IMPACT; OBS: on the player, the tick before the strike's hit
  blastThrow: 4014, // CACHE: VFX_MAD_ANGEL_ATTACK_BOMB_THROW
  ball: 4015, // CACHE: VFX_MAD_ANGEL_ATTACK_BOMB_THROW_PROJECTILE; OBS: thrown to a tile, and bounced back to her
  explosion: 4016, // CACHE: VFX_MAD_ANGEL_ATTACK_BOMB_THROW_IMPACT_01; OBS: on every tile of the nave when it lands
  bounce: 4017, // CACHE: VFX_MAD_ANGEL_ATTACK_BOMB_THROW_IMPACT_02; OBS: on her when the ball comes back
  shadow: 1448, // OBS: the shadow on the ball's tile, from the throw
  cleave: 2184, // OBS: on each tile a cleave sweeps
};

// OBS: the sounds of the fight that are in no animation, each heard to 20 tiles: the ball bounced off its tile, her hit
// by it two ticks on (her hitsplat's tick), and its explosion on its tile. Her others (the wake, the swing, the throw,
// the sweeps, the smite's crackle and strikes, the death) are in her animations' frames (CACHE), and the scene plays them.
// CACHE: the pinned cache (OpenRS2 2762) lists 12054 and 12056 but lacks their data (`npm run assets` names them
// missing): silent until a cache that has them is pinned; 12055 plays.
export const soundIds = {
  bounce: 12056,
  bounceHit: 12055,
  explosion: 12054,
  range: 20,
};

export const mapSquare = { x: 39, y: 34 }; // CACHE, WIKI (Mad Angel, Location: 2532, 2215)
export const bossSize = 3; // CACHE, TABLE
// OBS: her south-west tile as she wakes (world 2532, 2215), and where the player came in (world 2537, 2215).
export const bossStart = [36, 39];
export const playerStart = [41, 39];

export const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
// Edge to edge, Chebyshev: 0 under her, 1 beside her (diagonally too).
export const edgeDistance = (position, size, [x, y]) =>
  Math.max(Math.max(position[0] - x, 0, x - (position[0] + size - 1)), Math.max(position[1] - y, 0, y - (position[1] + size - 1)));
