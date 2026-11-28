// The Whisperer's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy
// guide (The Whisperer/Strategies): magic, as it recommends, in its best set of each slot. The Blackstone fragment is
// the one item she cannot be fought without; the Venator bow and its arrows are for the souls, Zorya's tome is the
// guide's special attack weapon, and the rest of the inventory is its supplies. The Book of the Dead and the rune
// pouch cast the Arceuus thralls and Death Charge. Ids are the cache's.
const supplies = {
  equippedAmmo: { id: 21326, quantity: 500 }, // Amethyst arrows, for the Venator bow
  quiverAmmo: null,
  runePouch: { kind: "divine", slots: [{ id: 560 }, { id: 566 }, { id: 565 }, { id: 30843 }] }, // Death, soul, blood, aether
  blowpipe: null,
  selectedSpell: null,
  spellbook: "arceuus",
};
export const whispererLoadouts = {
  max: {
    name: "Max (Shadow)",
    equipment: {
      head: 26241, // Virtus mask
      cape: 21795, // Imbued zamorak cape
      amulet: 12002, // Occult necklace
      weapon: 27275, // Tumeken's shadow
      body: 26243, // Virtus robe top
      shield: 27251, // Elidinis' ward (f)
      legs: 26245, // Virtus robe bottom
      hands: 31106, // Confliction gauntlets
      boots: 31097, // Avernic treads (max)
      ring: 28313, // Magus ring
    },
    inventory: [
      28357, 27610, 34725, 25818, // The Blackstone fragment, the Venator bow, Zorya's tome, the Book of the Dead
      27281, 27641, 3024, 3024, // The divine rune pouch, a saturated heart, two super restores
      3024, 3024, 2434, 2434, // Two more super restores, two prayer potions
      6685, 6685, 391, 391, // Two Saradomin brews, manta rays
      391, 391, 391, 391,
      391, 391, 391, 391,
      391, 391, 391, 391,
    ],
    supplies,
  },
};
