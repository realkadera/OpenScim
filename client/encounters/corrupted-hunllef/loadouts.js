// WIKI: Corrupted Gauntlet equipment uses the three tiers of corrupted armour,
// staff, bow, halberd, Egniol potion (3), Paddlefish, and Corrupted paddlefish.
// The practice inventory arrangement and four combo foods are user specified.
export const corruptedHunllefLoadouts = Object.fromEntries([1, 2, 3].map(tier => {
  const offset = tier - 1;
  const bow = 23855 + offset; // TABLE: corrupted bow
  const halberd = 23849 + offset; // TABLE: corrupted halberd
  const staff = 23852 + offset; // TABLE: corrupted staff
  const egniol3 = 23884; // CACHE: Egniol potion (3)
  const paddlefish = 23874; // WIKI: Paddlefish
  const corruptedPaddlefish = 25958; // WIKI: Corrupted paddlefish, combo food
  return [`tier_${tier}`, {
    name: `Tier ${tier} corrupted armour`,
    equipment: { head: 23840 + offset, body: 23843 + offset, legs: 23846 + offset, weapon: staff }, // TABLE
    inventory: [
      bow, egniol3, egniol3, egniol3,
      halberd, paddlefish, corruptedPaddlefish, corruptedPaddlefish,
      paddlefish, paddlefish, corruptedPaddlefish, corruptedPaddlefish,
      ...Array(16).fill(paddlefish),
    ],
  }];
}));
