import cloudPlacements from "./cloud-placements.json" with { type: "json" };

// All 4 OSRS Zulrah rotations (WIKI: Zulrah/Strategies + while-loop/runelite-plugins zulrah-helper PatternTree).
// Coordinates are relative to zulrahMapSquare = { x: 35, y: 47 }.

// 5x5 SW corner spawn positions around Zulrah's Shrine.
export const zulrahSpots = {
  CENTER: [26, 65], // Center water inside the horseshoe
  SOUTH: [26, 54],  // South of the bridge
  WEST: [16, 65],   // West water
  EAST: [36, 65],   // East water
};

// Recommended player standing tiles on the walkable horseshoe (x: 22..34, y: 60..70).
export const zulrahSafeTiles = {
  EAST_TIP: [32, 70],
  EAST_PILLAR: [32, 64],
  WEST_PILLAR: [24, 64],
  NE_PILLAR: [32, 68],
  NE_OUTER: [33, 68],
  SE_PILLAR: [32, 63],
  SE_CORNER: [32, 61],
  SOUTH_MID: [28, 60],
  SW_PILLAR: [24, 62],
  SW_CORNER: [24, 61],
  NW_PILLAR: [24, 68],
  NW_OUTER: [23, 68],
};

const openerPhase = {
  form: "serpentine",
  spot: "CENTER",
  pattern: "opener",
  attacks: 0, // PatternTree/WIKI: Opener spits 4 toxic cloud volleys with no direct ranged/magic hits.
  safeTiles: [zulrahSafeTiles.EAST_TIP],
  hint: "Opener: no direct hits. Stand on East tip [32, 70] to remain safe from clouds.",
};

// WIKI Strategies / PatternTree RESET: this replaces the opener after a full
// rotation. The first appearance has no direct attacks; the returning one has five.
const returningGreenPhase = {
  ...openerPhase,
  pattern: "range",
  attacks: 5,
  hint: "Rotation restart: pray Ranged for five attacks, then dodge the clouds.",
};

/**
 * Each phase:
 * - form: "serpentine" | "magma" | "tanzanite"
 * - spot: key in zulrahSpots
 * - pattern: "opener" | "range" | "mage" | "melee" | "jad_range_first" | "jad_mage_first"
 * - attacks: number of direct attacks in the phase (0 = venom/snakeling-only phase)
 * - cloudVolleys: optional array of cloud pairs [[x, y], [x, y]] spat sequentially
 * - snakelings: optional array of { type: "melee"|"magic", position: [x, y] } spawned sequentially
 * - safeTiles: recommended standing tiles for this phase
 * - hint: short coach callout
 */
export const zulrahRotations = {
  1: [
    openerPhase,
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Magma: dodge targeted melee slams by stepping 2 tiles.",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 4,
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Pray Magic (watch for occasional Ranged hits).",
    },
    {
      form: "serpentine",
      spot: "SOUTH",
      pattern: "range",
      attacks: 5,
      snakelings: [
        { position: [23, 68] },
        { position: [23, 65] },
        { position: [33, 67] },
        { position: [33, 69] },
      ],
      safeTiles: [zulrahSafeTiles.SW_PILLAR, zulrahSafeTiles.SW_CORNER],
      hint: "Pray Ranged. Move to SW pillar.",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.SW_PILLAR, zulrahSafeTiles.SW_CORNER],
      hint: "Magma: dodge targeted melee slams.",
    },
    {
      form: "tanzanite",
      spot: "WEST",
      pattern: "mage",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SOUTH_MID, zulrahSafeTiles.NW_OUTER],
      hint: "Pray Magic. Move South/West.",
    },
    {
      form: "serpentine",
      spot: "SOUTH",
      pattern: "range",
      attacks: 0, // PatternTree (MAGMA A): venom(3) + snakelings(4), no direct attacks.
      snakelings: [
        { position: [32, 63] },
        { position: [33, 67] },
        { position: [33, 69] },
        { position: [33, 64] },
      ],
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.SE_PILLAR],
      hint: "No direct hits: Zulrah spits clouds & snakelings. Run SE.",
    },
    {
      form: "tanzanite",
      spot: "SOUTH",
      pattern: "mage",
      attacks: 5,
      snakelings: [
        { position: [23, 62] },
        { position: [23, 68] },
        { position: [23, 65] },
      ],
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.SW_PILLAR],
      hint: "Pray Magic. Prepare for Jad phase on West side.",
    },
    {
      form: "serpentine",
      spot: "WEST",
      pattern: "jad_range_first",
      attacks: 10,
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "JAD PHASE: Start Pray Ranged, alternate Range/Mage every attack!",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.NE_OUTER],
      hint: "Magma: dodge slams before rotation loops.",
    },
  ],
  2: [
    openerPhase,
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Magma: dodge targeted melee slams.",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 4,
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Pray Magic. Move West next.",
    },
    {
      form: "serpentine",
      spot: "WEST",
      pattern: "range",
      attacks: 0, // PatternTree (MAGMA B): venom(3) + snakelings(2), no direct attacks.
      snakelings: [
        { type: "melee", position: [24, 64] },
        { type: "magic", position: [26, 61] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "No direct hits: Zulrah spits clouds & snakelings. Stand SW corner.",
    },
    {
      form: "tanzanite",
      spot: "SOUTH",
      pattern: "mage",
      attacks: 5,
      snakelings: [
        { type: "magic", position: [31, 61] },
        { type: "melee", position: [27, 60] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Magic.",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.SW_PILLAR, zulrahSafeTiles.SE_CORNER],
      hint: "Magma: dodge slams and move East.",
    },
    {
      form: "serpentine",
      spot: "EAST",
      pattern: "range",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SOUTH_MID, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Ranged on East side.",
    },
    {
      form: "tanzanite",
      spot: "SOUTH",
      pattern: "mage",
      attacks: 5,
      snakelings: [
        { type: "magic", position: [25, 61] },
        { type: "melee", position: [29, 61] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Magic. Prepare for Jad phase.",
    },
    {
      form: "serpentine",
      spot: "WEST",
      pattern: "jad_range_first",
      attacks: 10,
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "JAD PHASE: Start Pray Ranged, alternate Range/Mage every attack!",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.NE_OUTER],
      hint: "Magma: dodge slams before rotation loops.",
    },
  ],
  3: [
    openerPhase,
    {
      form: "serpentine",
      spot: "EAST",
      pattern: "range",
      attacks: 5,
      snakelings: [
        { type: "melee", position: [32, 64] },
        { type: "magic", position: [31, 61] },
      ],
      safeTiles: [zulrahSafeTiles.EAST_TIP],
      hint: "Pray Ranged (East spawn).",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      interleaved: true,
      snakelings: [
        { position: [33, 64] },
        { position: [26, 61] },
        { position: [23, 68] },
      ],
      safeTiles: [zulrahSafeTiles.EAST_PILLAR],
      hint: "Magma: safe at East pillar [32, 64] while clouds spit, then dodge slams.",
    },
    {
      form: "tanzanite",
      spot: "WEST",
      pattern: "mage",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SOUTH_MID, zulrahSafeTiles.NW_OUTER],
      hint: "Pray Magic on West side.",
    },
    {
      form: "serpentine",
      spot: "SOUTH",
      pattern: "range",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SOUTH_MID, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Ranged.",
    },
    {
      form: "tanzanite",
      spot: "EAST",
      pattern: "mage",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SOUTH_MID, zulrahSafeTiles.NE_OUTER],
      hint: "Pray Magic on East side.",
    },
    {
      form: "serpentine",
      spot: "CENTER",
      pattern: "range",
      attacks: 0, // PatternTree (SERP): venom(3) + snakelings(3), no direct attacks.
      snakelings: [
        { position: [23, 62] },
        { position: [23, 68] },
        { position: [23, 65] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SE_CORNER],
      hint: "No direct hits: Zulrah spits clouds & snakelings. Stand SW corner.",
    },
    {
      form: "serpentine",
      spot: "WEST",
      pattern: "range",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.SW_PILLAR],
      hint: "Pray Ranged on West side.",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 5,
      snakelings: [
        { position: [29, 61] },
        { position: [32, 61] },
        { position: [33, 64] },
      ],
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.NE_OUTER],
      hint: "Pray Magic. Move SE corner for Jad phase!",
    },
    {
      form: "serpentine",
      spot: "EAST",
      pattern: "jad_mage_first",
      attacks: 10,
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.SE_PILLAR],
      hint: "JAD PHASE: Start Pray Magic, alternate Mage/Range every attack!",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 0, // PatternTree (SERP): snakelings(4) before reset.
      snakelings: [
        { position: [23, 68] },
        { position: [23, 62] },
        { position: [23, 64] },
        { position: [33, 70] },
      ],
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Spawning snakelings before rotation loops.",
    },
  ],
  4: [
    openerPhase,
    {
      form: "tanzanite",
      spot: "EAST",
      pattern: "mage",
      attacks: 6,
      snakelings: [
        { position: [32, 61] },
        { position: [33, 70] },
        { position: [33, 67] },
        { position: [33, 64] },
      ],
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Pray Magic (East spawn).",
    },
    {
      form: "serpentine",
      spot: "SOUTH",
      pattern: "range",
      attacks: 4,
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.NW_OUTER],
      hint: "Pray Ranged. Move SW corner.",
    },
    {
      form: "tanzanite",
      spot: "WEST",
      pattern: "mage",
      attacks: 4,
      snakelings: [
        { position: [23, 68] },
        { position: [23, 65] },
        { position: [26, 61] },
        { position: [29, 61] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.NW_OUTER],
      hint: "Pray Magic on West side.",
    },
    {
      form: "magma",
      spot: "CENTER",
      pattern: "melee",
      attacks: 2,
      safeTiles: [zulrahSafeTiles.SE_PILLAR, zulrahSafeTiles.SE_CORNER],
      hint: "Magma: dodge slams and move SE.",
    },
    {
      form: "serpentine",
      spot: "EAST",
      pattern: "range",
      attacks: 4,
      safeTiles: [zulrahSafeTiles.SE_PILLAR, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Ranged on East side.",
    },
    {
      form: "serpentine",
      spot: "SOUTH",
      pattern: "range",
      attacks: 0, // PatternTree (TANZ): snakelings(6) + venom(3), no direct attacks.
      snakelings: [
        { position: [23, 68] },
        { position: [23, 65] },
        { position: [23, 62] },
        { position: [33, 64] },
        { position: [33, 67] },
        { position: [33, 70] },
      ],
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.SW_CORNER],
      hint: "No direct hits: Zulrah spits clouds & snakelings.",
    },
    {
      form: "tanzanite",
      spot: "WEST",
      pattern: "mage",
      attacks: 5,
      snakelings: [
        { position: [23, 68] },
        { position: [23, 65] },
        { position: [23, 62] },
        { position: [26, 61] },
      ],
      safeTiles: [zulrahSafeTiles.SW_CORNER, zulrahSafeTiles.NW_OUTER],
      hint: "Pray Magic on West side.",
    },
    {
      form: "serpentine",
      spot: "CENTER",
      pattern: "range",
      attacks: 5,
      safeTiles: [zulrahSafeTiles.SE_CORNER, zulrahSafeTiles.NE_OUTER],
      hint: "Pray Ranged.",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 4,
      safeTiles: [zulrahSafeTiles.SE_PILLAR, zulrahSafeTiles.SE_CORNER],
      hint: "Pray Magic. Move SE for Jad phase!",
    },
    {
      form: "serpentine",
      spot: "EAST",
      pattern: "jad_mage_first",
      attacks: 8,
      safeTiles: [zulrahSafeTiles.SE_PILLAR, zulrahSafeTiles.SE_CORNER],
      hint: "JAD PHASE: Start Pray Magic, alternate Mage/Range every attack!",
    },
    {
      form: "tanzanite",
      spot: "CENTER",
      pattern: "mage",
      attacks: 0, // PatternTree (TANZ): snakelings(4) before reset.
      snakelings: [
        { position: [23, 68] },
        { position: [23, 65] },
        { position: [33, 67] },
        { position: [33, 70] },
      ],
      safeTiles: [zulrahSafeTiles.NE_OUTER, zulrahSafeTiles.NE_PILLAR],
      hint: "Spawning snakelings before rotation loops.",
    },
  ],
};

// Inferred cloud geometry is kept separately so it can be corrected from
// recorded landing tiles without editing the rotation or combat logic.
for (const [rotation, phases] of Object.entries(zulrahRotations)) {
  phases.push({ ...returningGreenPhase });
  phases.forEach((phase, index) => {
    phases[index] = { ...phase, cloudVolleys: cloudPlacements.rotations[rotation][index].volleys };
  });
}
