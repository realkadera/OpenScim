// The Mad Angel's default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy
// guide (Mad Angel/Strategies, "Melee" and "Melee (Low level)"): melee is the way, Protect from Melee for her standard
// attacks and Protect from Magic for her smite. The guide's first weapon is the Obligator, two-handed (WIKI: Obligator),
// so it is worn without a shield: the guide's shields go with its one-handed weapons. The granite hammer is its
// golembane weapon (+30% against her, client/engine/playerAttack/formula.js) and the low-level tab's first. Its
// inventory: a special attack weapon, a divine super combat potion, prayer potions, food and the Book of the Dead.
// Sharks are not edible in the client: anglerfish, as the other bosses' setups.
const anglerfish = 13441;
const prayerPotion = 2434; // Prayer potion(4)
const divineSuperCombat = 23685; // Divine super combat potion(4)
// WIKI: a divine rune pouch with blood, fire, aether and death runes, for thralls and Death Charge from the Book of the
// Dead (as Araxxor's setups carry it).
const runePouch = { kind: "divine", slots: [{ id: 565 }, { id: 554 }, { id: 30843 }, { id: 560 }] };
const supplies = { equippedAmmo: { id: 22947 }, quiverAmmo: null, runePouch, blowpipe: null, selectedSpell: null, spellbook: "arceuus" }; // Rada's blessing 4

export const madAngelLoadouts = {
  max: {
    name: "Melee (Obligator)",
    equipment: {
      head: 24419, // Inquisitor's great helm
      cape: 21295, // Infernal cape
      amulet: 29801, // Amulet of rancour
      weapon: 34715, // Obligator (two-handed: no shield)
      body: 24420, // Inquisitor's hauberk
      legs: 24421, // Inquisitor's plateskirt
      hands: 22981, // Ferocious gloves
      boots: 31097, // Avernic treads (max)
      ring: 28307, // Ultor ring
    },
    inventory: [
      33631, // Crimson kisten, its special weapon
      ...Array(7).fill(prayerPotion),
      divineSuperCombat,
      25818, // Book of the Dead
      ...Array(17).fill(anglerfish),
      27281, // Divine rune pouch
    ],
    supplies,
  },
  granite_hammer: {
    name: "Melee (Granite hammer)",
    equipment: {
      head: 29028, // Blood Moon helm
      cape: 6570, // Fire cape
      amulet: 6585, // Amulet of fury
      weapon: 21742, // Granite hammer
      body: 29022, // Blood Moon chestplate
      shield: 12954, // Dragon defender
      legs: 29025, // Blood Moon tassets
      hands: 7462, // Barrows gloves
      boots: 11840, // Dragon boots
      ring: 11773, // Berserker ring (i)
    },
    inventory: [
      11804, // Bandos godsword, its special weapon
      1434, // Dragon mace
      ...Array(8).fill(prayerPotion),
      divineSuperCombat,
      25818, // Book of the Dead
      ...Array(15).fill(anglerfish),
      27281, // Divine rune pouch
    ],
    supplies,
  },
};
