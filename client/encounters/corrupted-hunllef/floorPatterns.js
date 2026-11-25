// Near-Reality-derived shapes and timing from ../tsps Hunllef.Gauntlet.js.
// These are provisional simulator patterns, pending live tile/tick captures.
const square = (size, x, y) => Array.from({ length: size * size }, (_, i) => [x + i % size, y + Math.floor(i / size)]);
const rectangle = (width, height, x, y) => Array.from({ length: width * height }, (_, i) => [x + i % width, y + Math.floor(i / width)]);

const easy = [
  square(6, 0, 0), square(6, 6, 0), square(6, 0, 6), square(6, 6, 6),
  square(6, 2, 2), square(6, 4, 2), square(6, 2, 4), square(6, 4, 4),
  rectangle(4, 12, 0, 0), rectangle(4, 12, 8, 0), rectangle(12, 4, 0, 0), rectangle(12, 4, 0, 8),
];
const medium = [
  ...easy,
  [...rectangle(4, 12, 0, 0), ...rectangle(4, 12, 8, 0)],
  [...rectangle(12, 4, 0, 0), ...rectangle(12, 4, 0, 8)],
];
const hard = [
  [...square(3, 0, 0), ...square(3, 9, 0), ...square(3, 0, 9), ...square(3, 9, 9), ...square(4, 4, 4)],
  [...rectangle(2, 12, 0, 0), ...rectangle(2, 12, 10, 0), ...rectangle(8, 2, 2, 0), ...rectangle(8, 2, 2, 10)],
  [...square(4, 1, 1), ...square(4, 7, 1), ...square(4, 1, 7), ...square(4, 7, 7)],
  [...square(4, 0, 0), ...square(4, 8, 0), ...square(4, 0, 8), ...square(4, 8, 8)],
];

// Preserve source and rule fields so captured patterns can replace these records.
export const floorPatterns = [easy, medium, hard].map((pool, phase) => pool.map((tiles, index) => ({
  source: "Near-Reality-derived; capture-required",
  arenaSize: [12, 12],
  phase,
  patternId: `${["easy", "medium", "hard"][phase]}-${String(index + 1).padStart(2, "0")}`,
  tiles,
  warningTicks: [5, 4, 3][phase], // Near-Reality-derived
  damageTicks: 6, // Near-Reality-derived
  repeatRule: "uniform seeded choice every 30 ticks", // Near-Reality-derived
  rotationRule: "none in source controller", // Near-Reality-derived
})));

export const floorPhase = (hp, maxHp) => hp / maxHp > 2 / 3 ? 0 : hp / maxHp > 1 / 3 ? 1 : 2; // tsps controller
