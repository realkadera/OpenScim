// CACHE: OpenRS2 2762, sequence definitions (index 2/group 12).
// Durations are the sum of frameLengths, in 20 ms client cycles.
export const zulrahAnimations = {
  shoot: { seqId: 5069, cycles: 60 },
  submerge: { seqId: 5072, cycles: 60 },
  emerge: { seqId: 5073, cycles: 60 },
  initialRise: { seqId: 5071, cycles: 105 },
  meleeFocus: { seqId: 5806, cycles: 210 },
  meleeAttack: { seqId: 5807, cycles: 200 },
};

export const clientCyclesPerTick = 30; // CACHE: 600 ms game tick / 20 ms client cycle.
export const animationTicks = (clipId) =>
  Math.ceil(zulrahAnimations[clipId].cycles / clientCyclesPerTick);

// Restore from the encounter clock, including after a form change or a seek.
// The outgoing dive must hold its last pose until the submerged stage hides it.
export function sampleBossAnimation(animation, cycle) {
  if (!animation) return null;
  const definition = zulrahAnimations[animation.clipId];
  const elapsed = Math.max(0, cycle - animation.startedTick * clientCyclesPerTick);
  if (elapsed >= definition.cycles && animation.clipId !== "submerge") return null;
  return {
    clipId: animation.clipId,
    elapsed: Math.min(elapsed, definition.cycles - 1),
    duration: definition.cycles,
  };
}
