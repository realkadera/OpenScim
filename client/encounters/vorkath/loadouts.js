// Vorkath's setups (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide (WIKI:
// Vorkath/Strategies, read 2026-11-27). The first two are the first column of its Ranged and Melee equipment tables
// with the inventories of its "Ranged (crossbow)" and "Melee" setups; the third is the dragon hunter crossbow a
// mid-level account brings.
//
// What differs from the guide, and why:
// - Its food is "sharks or better". Sharks are not edible in the client: anglerfish.
// - Its three prayer potions are super restores, which it allows ("3-4 super restores or prayer potions").
// - Its heavy bonesack does nothing in a simulator: one more food.
// - Ranged: the Ascension crossbows are two-handed, so there is no dragonfire ward: pray Protect from Magic, with the
//   super antifire. Their one ammunition is the diamond ascension bolt (e), so the guide's bolt switch is left out.
//   The Zaryte crossbow's special fires the quiver's second ammunition, ruby dragon bolts (e).
// - Melee: off a Slayer task the guide's amulet is the Salve amulet(ei) with the Torva full helm. Its inventory lists
//   22 of its 28 slots; the rest is food here. The Slayer's staff autocasts Crumble Undead on the spawn.
// Crumble Undead takes earth, air and chaos: dust runes are the first two.
const anglerfish = 13441;
const karambwan = 3144; // Cooked karambwan
const superRestore = 3024;
const crumbleRunes = [{ id: 563 }, { id: 4696 }, { id: 562 }]; // Law, dust and chaos runes, as the guide's pouch

export const vorkathLoadouts = {
  ranged: {
    name: "Ranged (Ascension crossbows)",
    equipment: {
      head: 27235, // Masori mask (f)
      cape: 28951, // Dizana's quiver
      amulet: 12018, // Salve amulet(ei)
      weapon: 34681, // Ascension crossbows
      body: 27238, // Masori body (f)
      legs: 27241, // Masori chaps (f)
      hands: 26235, // Zaryte vambraces
      boots: 31097, // Avernic treads (max)
      ring: 28310, // Venator ring
    },
    inventory: [
      23733, 22209, 29824, 26374, // Divine ranging potion(4), extended super antifire(4), extended anti-venom+(4), Zaryte crossbow
      superRestore, superRestore, superRestore, karambwan,
      ...Array(6).fill(anglerfish),
      ...Array(9).fill(karambwan),
      anglerfish, // the guide's bonesack
      4417, 4417, 4417, // Guthix rest(4)
      27281, // Divine rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 34696 }, // Diamond ascension bolts (e)
      quiverAmmo: { id: 21944 }, // Ruby dragon bolts (e), for the Zaryte crossbow
      runePouch: { kind: "divine", slots: [...crumbleRunes, null] },
      selectedSpell: null,
      spellbook: "standard",
    },
  },
  melee: {
    name: "Melee (Dragon hunter lance)",
    equipment: {
      head: 26382, // Torva full helm
      cape: 21295, // Infernal cape
      amulet: 12018, // Salve amulet(ei)
      weapon: 22978, // Dragon hunter lance
      body: 26384, // Torva platebody
      shield: 22322, // Avernic defender
      legs: 26386, // Torva platelegs
      hands: 22981, // Ferocious gloves
      boots: 31097, // Avernic treads (max)
      ring: 28307, // Ultor ring
    },
    inventory: [
      4170, 23685, 22209, 29824, // Slayer's staff, divine super combat potion(4), extended super antifire(4), extended anti-venom+(4)
      27690, superRestore, superRestore, superRestore, // Voidwaker
      anglerfish, 30881, // Surge potion(2)
      ...Array(17).fill(anglerfish),
      12791, // Rune pouch
    ],
    supplies: {
      equippedAmmo: { id: 22947 }, // Rada's blessing 4
      runePouch: { kind: "standard", slots: crumbleRunes },
      selectedSpell: "Crumble Undead",
      spellbook: "standard",
    },
  },
  dragon_hunter_crossbow: {
    name: "Ranged (Dragon hunter crossbow)",
    equipment: {
      head: 23971, // Crystal helm
      cape: 22109, // Ava's assembler
      amulet: 19547, // Necklace of anguish
      weapon: 21012, // Dragon hunter crossbow
      body: 23975, // Crystal body
      shield: 22002, // Dragonfire ward
      legs: 23979, // Crystal legs
      hands: 7462, // Barrows gloves
      boots: 13237, // Pegasian boots
      ring: 11771, // Archers ring (i)
    },
    inventory: [
      22209, // Extended super antifire(4)
      23733, // Divine ranging potion(4)
      3024, 3024, 3024, // Super restore(4)
      29824, // Extended anti-venom+(4)
      21946, // Diamond dragon bolts (e), for below a third
      12791, // Rune pouch: earth, air, chaos for Crumble Undead
      ...Array(20).fill(anglerfish),
    ],
    supplies: {
      equippedAmmo: { id: 21944 }, // Ruby dragon bolts (e)
      runePouch: { kind: "standard", slots: [{ id: 557 }, { id: 556 }, { id: 562 }] }, // Earth, air, chaos runes
      selectedSpell: null,
      spellbook: "standard",
    },
  },
};
