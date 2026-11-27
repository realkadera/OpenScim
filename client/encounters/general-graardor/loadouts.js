// General Graardor (client/encounters/general-graardor/): solo gear setups from the OSRS Wiki
// strategy guide (General Graardor/Strategies). Defaults to the Crystal (Bow of faerdhinen) setup
// with Ring of suffering (ri) (charged) and Toxic blowpipe for Altar-Door and 6:0 kiting, and minion tanking/healing.

const ancientRunePouch = {
  kind: "divine",
  slots: [
    { id: 565 }, // Blood rune
    { id: 560 }, // Death rune
    { id: 566 }, // Soul rune
    { id: 555 }, // Water rune
  ],
};

const arceuusRunePouch = {
  kind: "divine",
  slots: [
    { id: 560 }, // Death rune
    { id: 554 }, // Fire rune
    { id: 565 }, // Blood rune
    { id: 30843 }, // Aether rune
  ],
};

export const generalGraardorLoadouts = {
  crystal: {
    name: "Crystal (Bowfa)",
    equipment: {
      head: 23971, // Crystal helm
      cape: 22109, // Ava's assembler
      amulet: 19547, // Necklace of anguish
      weapon: 25865, // Bow of Faerdhinen
      body: 23975, // Crystal body
      legs: 23979, // Crystal legs
      hands: 7462, // Barrows gloves
      boots: 13237, // Pegasian boots
      ring: 20657, // Ring of suffering (ri)
    },
    inventory: [
      12926, 27624, 12002, 19544, // Toxic blowpipe, Ancient sceptre, Occult necklace, Tormented bracelet
      22461, 22461, 12625, 12625, // Two bastion potions, two stamina potions
      6685, 6685, 6685, 6685, // Four Saradomin brews
      3024, 3024, 3024, 3024, // Four super restores
      3024, 3024, 13441, 13441, // Two super restores, two anglerfish
      13441, 13441, 13441, 13441, // Four anglerfish
      13441, 13441, 13441, 27281, // Three anglerfish, divine rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 22947 }, // Rada's blessing 4
      quiverAmmo: null,
      runePouch: ancientRunePouch,
      blowpipe: { id: 11230 }, // Dragon dart
      selectedSpell: "Blood Barrage",
      spellbook: "ancient",
    },
  },
  max_ranged: {
    name: "Max Ranged (Zaryte crossbow)",
    equipment: {
      head: 27235, // Masori mask (f)
      cape: 28951, // Dizana's quiver
      amulet: 19547, // Necklace of anguish
      weapon: 26374, // Zaryte crossbow
      body: 27238, // Masori body (f)
      shield: 21000, // Twisted buckler
      legs: 27241, // Masori chaps (f)
      hands: 26235, // Zaryte vambraces
      boots: 13237, // Pegasian boots
      ring: 20657, // Ring of suffering (ri)
    },
    inventory: [
      12926, 21946, 21006, 12002, // Toxic blowpipe, Diamond dragon bolts (e), Kodai wand, Occult necklace
      22461, 22461, 12625, 12625, // Two bastion potions, two stamina potions
      6685, 6685, 6685, 6685, // Four Saradomin brews
      3024, 3024, 3024, 3024, // Four super restores
      3024, 3024, 13441, 13441, // Two super restores, two anglerfish
      13441, 13441, 13441, 13441, // Four anglerfish
      13441, 13441, 13441, 27281, // Three anglerfish, divine rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 21944 }, // Ruby dragon bolts (e)
      quiverAmmo: { id: 22947 }, // Rada's blessing 4
      runePouch: ancientRunePouch,
      blowpipe: { id: 11230 }, // Dragon dart
      selectedSpell: "Blood Barrage",
      spellbook: "ancient",
    },
  },
  max_mage: {
    name: "Max Magic (Tumeken's shadow)",
    equipment: {
      head: 21018, // Ancestral hat
      cape: 21791, // Imbued saradomin cape
      amulet: 12002, // Occult necklace
      weapon: 27275, // Tumeken's shadow
      body: 21021, // Ancestral robe top
      legs: 21024, // Ancestral robe bottom
      hands: 19544, // Tormented bracelet
      boots: 13235, // Eternal boots
      ring: 20657, // Ring of suffering (ri)
    },
    inventory: [
      12926, 27641, 12625, 12625, // Toxic blowpipe, saturated heart, two stamina potions
      6685, 6685, 6685, 6685, // Four Saradomin brews
      3024, 3024, 3024, 3024, // Four super restores
      3024, 3024, 13441, 13441, // Two super restores, two anglerfish
      13441, 13441, 13441, 13441, // Four anglerfish
      13441, 13441, 13441, 13441, // Four anglerfish
      13441, 13441, 13441, 27281, // Three anglerfish, divine rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 22947 }, // Rada's blessing 4
      quiverAmmo: null,
      runePouch: ancientRunePouch,
      blowpipe: { id: 11230 }, // Dragon dart
      selectedSpell: "Blood Barrage",
      spellbook: "ancient",
    },
  },
  max_melee: {
    name: "Max Melee (Osmumten's fang)",
    equipment: {
      head: 26382, // Torva full helm
      cape: 21295, // Infernal cape
      amulet: 19553, // Amulet of torture
      weapon: 26219, // Osmumten's fang
      body: 26384, // Torva platebody
      shield: 22322, // Avernic defender
      legs: 26386, // Torva platelegs
      hands: 22981, // Ferocious gloves
      boots: 13239, // Primordial boots
      ring: 20657, // Ring of suffering (ri)
    },
    inventory: [
      13576, 11804, 12926, 12695, // Dragon warhammer, Bandos godsword, Toxic blowpipe, super combat potion
      12695, 12625, 6685, 6685, // Super combat potion, stamina potion, two Saradomin brews
      6685, 6685, 3024, 3024, // Two Saradomin brews, two super restores
      3024, 3024, 13441, 13441, // Two super restores, two anglerfish
      13441, 13441, 13441, 13441, // Four anglerfish
      13441, 13441, 3144, 3144, // Two anglerfish, two cooked karambwans
      3144, 3144, 25818, 27281, // Two cooked karambwans, Book of the Dead, divine rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 22947 }, // Rada's blessing 4
      quiverAmmo: null,
      runePouch: arceuusRunePouch,
      blowpipe: { id: 11230 }, // Dragon dart
      selectedSpell: null,
      spellbook: "arceuus",
    },
  },
};
