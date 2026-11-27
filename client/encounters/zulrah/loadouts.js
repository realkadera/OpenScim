// TABLE: item IDs from client/data/equipment.js and engine/consumables.js.
// WIKI Zulrah/Strategies: ranged-only and hybrid training presets; these are
// practical preset choices, not an assertion that one set is optimal for every phase.
const inventory = (switches, supplies = [22461, 5952, 2434, 2434, 2434]) => {
  const ids = [...switches, ...supplies];
  while (ids.length < 28) ids.push(ids.length % 4 === 3 ? 3144 : 13441);
  return ids;
};

const ranged = {
  head: 27235, cape: 28951, amulet: 33639, weapon: 20997,
  body: 27238, legs: 27241, hands: 26235, boots: 31097, ring: 28310,
};

const mage = {
  head: 21018, cape: 21791, amulet: 12002, weapon: 27275,
  body: 21021, legs: 21024, hands: 31106, boots: 31097, ring: 28313,
};

const rangedSupplies = { equippedAmmo: { id: 11212 }, quiverAmmo: { id: 11212 }, blowpipe: { id: 11230 }, spellbook: "standard" };

export const zulrahLoadouts = {
  max_tbow: {
    name: "Max Ranged (Twisted Bow + Masori)",
    equipment: { ...ranged },
    inventory: inventory([12926, 20657]),
    supplies: { ...rangedSupplies },
  },
  max_hybrid: {
    name: "Max Mage / Ranged (Shadow + Twisted Bow)",
    equipment: { ...mage },
    inventory: inventory([27235, 27238, 27241, 20997, 28951, 33639, 26235, 28310, 12926, 20657], [27641, 22461, 5952, 2434, 2434]),
    supplies: { ...rangedSupplies },
  },
  void_hybrid: {
    name: "Elite Void Mage / Ranged (Shadow + Twisted Bow)",
    equipment: {
      head: 11663, cape: 21791, amulet: 12002, weapon: 27275,
      body: 13072, legs: 13073, hands: 8842, boots: 31097, ring: 28313,
    },
    inventory: inventory([11664, 20997, 28951, 33639, 28310, 12926, 20657], [27641, 22461, 5952, 2434, 2434]),
    supplies: { ...rangedSupplies },
  },
  bowfa: {
    name: "Crystal + Bowfa",
    equipment: {
      head: 23971, cape: 22109, amulet: 19547, weapon: 25865,
      body: 23975, legs: 23979, hands: 7462, boots: 22954, ring: 20657,
    },
    inventory: inventory([], [2444, 5952, 2434, 2434, 2434, 2434]),
    supplies: { equippedAmmo: { id: 22947 }, spellbook: "standard" },
  },
};
