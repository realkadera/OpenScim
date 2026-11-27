var baseItemIdByVariantId = new Map();
var variantIdsByBaseItemId = new Map();
for (const { baseId: baseId, variantIds: variantIds } of [
  {
    baseId: 1333,
    variantIds: [23330, 23332, 23334],
  },
  {
    baseId: 8850,
    variantIds: [23230],
  },
  {
    // Crystal halberd: 24125 is listed with 23987 on its wiki page (WIKI: Crystal halberd); the same weapon to the
    // rules, Sweep special included.
    baseId: 23987,
    variantIds: [24125],
  },
  {
    baseId: 12954,
    variantIds: [19722],
  },
  {
    baseId: 11335,
    variantIds: [12417],
  },
  {
    baseId: 3140,
    variantIds: [12414, 28065],
  },
  {
    baseId: 21892,
    variantIds: [22242],
  },
  {
    baseId: 4087,
    variantIds: [12415, 28061],
  },
  {
    baseId: 4585,
    variantIds: [12416, 28063],
  },
  {
    baseId: 11840,
    variantIds: [22234, 28055],
  },
  {
    baseId: 1187,
    variantIds: [12418, 28059],
  },
  {
    baseId: 21895,
    variantIds: [22244],
  },
  {
    baseId: 4587,
    variantIds: [20000, 28031],
  },
  {
    baseId: 11802,
    variantIds: [20368, 29605],
  },
  {
    baseId: 11804,
    variantIds: [20370],
  },
  {
    baseId: 11806,
    variantIds: [20372],
  },
  {
    baseId: 11808,
    variantIds: [20374],
  },
  {
    baseId: 6528,
    variantIds: [23235],
  },
  {
    baseId: 11128,
    variantIds: [23240],
  },
  {
    baseId: 6585,
    variantIds: [12436],
  },
  {
    baseId: 19553,
    variantIds: [20366],
  },
  {
    baseId: 19547,
    variantIds: [22249],
  },
  {
    baseId: 19544,
    variantIds: [23444],
  },
  {
    baseId: 12002,
    variantIds: [19720],
  },
  {
    baseId: 6918,
    variantIds: [12419, 12457],
  },
  {
    baseId: 6916,
    variantIds: [12420, 12458],
  },
  {
    baseId: 6924,
    variantIds: [12421, 12459],
  },
  {
    baseId: 21018,
    variantIds: [24664],
  },
  {
    baseId: 21021,
    variantIds: [24666],
  },
  {
    baseId: 21024,
    variantIds: [24668],
  },
  {
    baseId: 22324,
    variantIds: [25734],
  },
  {
    baseId: 22323,
    variantIds: [25731],
  },
  {
    baseId: 22481,
    variantIds: [25733],
  },
  {
    baseId: 22325,
    variantIds: [25736, 25739],
  },
  {
    baseId: 22486,
    variantIds: [25738, 25741],
  },
  {
    baseId: 26219,
    variantIds: [27246],
  },
  {
    baseId: 27251,
    variantIds: [27253],
  },
  {
    // 30302 to 30304 are the Torva pieces the cache gives no bonuses and no "Wear" (CACHE: items 30302 to 30304);
    // the item list offers them under the same names, so they count as the restored pieces.
    baseId: 26382,
    variantIds: [28254, 30302],
  },
  {
    baseId: 26384,
    variantIds: [28256, 30303],
  },
  {
    baseId: 26386,
    variantIds: [28258, 30304],
  },
  {
    baseId: 21012,
    variantIds: [25916, 25918],
  },
  {
    baseId: 30750,
    variantIds: [30777],
  },
  {
    baseId: 30753,
    variantIds: [30779],
  },
  {
    baseId: 30756,
    variantIds: [30781],
  },
  {
    baseId: 29801,
    variantIds: [29804],
  },
  {
    baseId: 22109,
    variantIds: [27374],
  },
  {
    baseId: 24222,
    variantIds: [27376],
  },
  {
    baseId: 21898,
    variantIds: [27363],
  },
  {
    baseId: 24135,
    variantIds: [27365],
  },
  {
    baseId: 21900,
    variantIds: [27366],
  },
  {
    baseId: 25867,
    variantIds: [25884, 25886, 25888, 25890, 25892, 25894, 25896, 33021],
  },
  {
    baseId: 24551,
    variantIds: [25870, 25872, 25874, 25876, 25878, 25880, 25882],
  },
  {
    baseId: 23911,
    variantIds: [23913, 23915, 23917, 23919, 23921, 23923, 23925],
  },
  {
    baseId: 23971,
    variantIds: [27705, 27717, 27729, 27741, 27753, 27765, 27777, 33031],
  },
  {
    baseId: 23973,
    variantIds: [27707, 27719, 27731, 27743, 27755, 27767, 27779, 33033],
  },
  {
    baseId: 23975,
    variantIds: [27697, 27709, 27721, 27733, 27745, 27757, 27769, 33023],
  },
  {
    baseId: 23977,
    variantIds: [27699, 27711, 27723, 27735, 27747, 27759, 27771, 33025],
  },
  {
    baseId: 23979,
    variantIds: [27701, 27713, 27725, 27737, 27749, 27761, 27773, 33027],
  },
  {
    baseId: 23981,
    variantIds: [27703, 27715, 27727, 27739, 27751, 27763, 27775, 33029],
  },
  {
    baseId: 11920,
    variantIds: [12797, 23677, 25376, 30351],
  },
  {
    baseId: 11787,
    variantIds: [12795],
  },
  {
    baseId: 11789,
    variantIds: [12796],
  },
  {
    baseId: 3053,
    variantIds: [21198],
  },
  {
    baseId: 3054,
    variantIds: [21200],
  },
  {
    baseId: 11924,
    variantIds: [12806],
  },
  {
    baseId: 11926,
    variantIds: [12807],
  },
  {
    baseId: 11235,
    variantIds: [12765, 12766, 12767, 12768, 29611],
  },
  {
    baseId: 4151,
    variantIds: [12773, 12774, 26482],
  },
  {
    baseId: 4153,
    variantIds: [12848],
  },
  {
    baseId: 24225,
    variantIds: [24227],
  },
  {
    baseId: 13243,
    variantIds: [25063, 30345],
  },
  {
    baseId: 13244,
    variantIds: [25369, 30346],
  },
  {
    baseId: 13241,
    variantIds: [25066, 30347],
  },
  {
    baseId: 13242,
    variantIds: [25371, 30348],
  },
  {
    baseId: 21031,
    variantIds: [25059, 30342],
  },
  {
    baseId: 21033,
    variantIds: [25367, 30343],
  },
  {
    baseId: 6739,
    variantIds: [25378, 30352],
  },
  {
    baseId: 21028,
    variantIds: [25373, 30349],
  },
  {
    baseId: 8839,
    variantIds: [26463],
  },
  {
    baseId: 8840,
    variantIds: [26465],
  },
  {
    baseId: 8842,
    variantIds: [26467],
  },
  {
    baseId: 13072,
    variantIds: [26469],
  },
  {
    baseId: 13073,
    variantIds: [26471],
  },
  {
    baseId: 11663,
    variantIds: [26473],
  },
  {
    baseId: 11664,
    variantIds: [26475],
  },
  {
    baseId: 11665,
    variantIds: [26477],
  },
  {
    baseId: 24177,
    variantIds: [27000],
  },
  {
    baseId: 24179,
    variantIds: [27001],
  },
  {
    baseId: 24182,
    variantIds: [27002],
  },
  {
    baseId: 24178,
    variantIds: [27003],
  },
  {
    baseId: 24180,
    variantIds: [27004],
  },
  {
    baseId: 24183,
    variantIds: [27005],
  },
  {
    baseId: 24184,
    variantIds: [27006],
  },
  {
    baseId: 24185,
    variantIds: [27007],
  },
  {
    baseId: 24143,
    variantIds: [27008],
  },
  {
    baseId: 24142,
    variantIds: [27009],
  },
  {
    baseId: 12006,
    variantIds: [26484],
  },
  {
    baseId: 9185,
    variantIds: [26486],
  },
  {
    baseId: 3844,
    variantIds: [26488],
  },
  {
    baseId: 12612,
    variantIds: [26490],
  },
  {
    baseId: 12610,
    variantIds: [26492],
  },
  {
    baseId: 12608,
    variantIds: [26494],
  },
  {
    baseId: 3840,
    variantIds: [26496],
  },
  {
    baseId: 3842,
    variantIds: [26498],
  },
  {
    baseId: 4089,
    variantIds: [4099, 4109, 23047, 26531],
  },
  {
    baseId: 4091,
    variantIds: [4101, 4111, 23050, 26533],
  },
  {
    baseId: 4093,
    variantIds: [4103, 4113, 23053, 26535],
  },
  {
    baseId: 4095,
    variantIds: [4105, 4115, 23056, 26537],
  },
  {
    baseId: 4097,
    variantIds: [4107, 4117, 23059, 26539],
  },
  {
    baseId: 12926,
    variantIds: [28688],
  },
  {
    baseId: 12924,
    variantIds: [28687],
  },
  {
    baseId: 21015,
    variantIds: [28682],
  },
  {
    baseId: 26241,
    variantIds: [30437],
  },
  {
    baseId: 26243,
    variantIds: [30439],
  },
  {
    baseId: 26245,
    variantIds: [30441],
  },
  {
    baseId: 27610,
    variantIds: [30434],
  },
  {
    baseId: 27612,
    variantIds: [30436],
  },
  {
    baseId: 4708,
    variantIds: [30445],
  },
  {
    baseId: 4856,
    variantIds: [30519],
  },
  {
    baseId: 4857,
    variantIds: [30525],
  },
  {
    baseId: 4858,
    variantIds: [30531],
  },
  {
    baseId: 4859,
    variantIds: [30537],
  },
  {
    baseId: 4860,
    variantIds: [30543],
  },
  {
    baseId: 4712,
    variantIds: [30447],
  },
  {
    baseId: 4868,
    variantIds: [30521],
  },
  {
    baseId: 4869,
    variantIds: [30527],
  },
  {
    baseId: 4870,
    variantIds: [30533],
  },
  {
    baseId: 4871,
    variantIds: [30539],
  },
  {
    baseId: 4872,
    variantIds: [30545],
  },
  {
    baseId: 4714,
    variantIds: [30449],
  },
  {
    baseId: 4874,
    variantIds: [30523],
  },
  {
    baseId: 4875,
    variantIds: [30529],
  },
  {
    baseId: 4876,
    variantIds: [30535],
  },
  {
    baseId: 4877,
    variantIds: [30541],
  },
  {
    baseId: 4878,
    variantIds: [30547],
  },
  {
    baseId: 4710,
    variantIds: [30568],
  },
  {
    baseId: 4862,
    variantIds: [30570],
  },
  {
    baseId: 4863,
    variantIds: [30571],
  },
  {
    baseId: 4864,
    variantIds: [30572],
  },
  {
    baseId: 4865,
    variantIds: [30573],
  },
  {
    baseId: 4866,
    variantIds: [30574],
  },
  {
    baseId: 11907,
    variantIds: [33322],
  },
  {
    baseId: 11905,
    variantIds: [33323],
  },
  {
    baseId: 11908,
    variantIds: [33434],
  },
  {
    baseId: 12899,
    variantIds: [33314],
  },
  {
    baseId: 12900,
    variantIds: [33316],
  },
  {
    baseId: 22292,
    variantIds: [33318],
  },
  {
    baseId: 22294,
    variantIds: [33320],
  },
  {
    baseId: 22288,
    variantIds: [33326],
  },
  {
    baseId: 22290,
    variantIds: [33328],
  },
  {
    baseId: 1409,
    variantIds: [33330],
  },
  {
    baseId: 12658,
    variantIds: [33332],
  },
  {
    baseId: 28338,
    variantIds: [33335],
  },
  {
    baseId: 20517,
    variantIds: [27115],
  },
  {
    baseId: 20520,
    variantIds: [27117],
  },
  {
    baseId: 20595,
    variantIds: [27119],
  },
  {
    baseId: 21003,
    variantIds: [27100],
  },
  {
    baseId: 19481,
    variantIds: [26712],
  },
  {
    baseId: 1149,
    variantIds: [28057],
  },
  {
    baseId: 10551,
    variantIds: [28067],
  },
  {
    baseId: 24175,
    variantIds: [28069],
  },
  {
    baseId: 10828,
    variantIds: [28070],
  },
  {
    baseId: 13652,
    variantIds: [26708, 28039],
  },
  {
    baseId: 13576,
    variantIds: [26710, 28035],
  },
  {
    baseId: 11826,
    variantIds: [26714],
  },
  {
    baseId: 11830,
    variantIds: [26716],
  },
  {
    baseId: 11834,
    variantIds: [26719],
  },
  {
    baseId: 11836,
    variantIds: [26720],
  },
  {
    baseId: 24288,
    variantIds: [27123],
  },
  {
    baseId: 24291,
    variantIds: [27125],
  },
  {
    baseId: 24294,
    variantIds: [27127],
  },
  {
    baseId: 27690,
    variantIds: [29607],
  },
  {
    baseId: 24424,
    variantIds: [29609],
  },
  {
    baseId: 21795,
    variantIds: [29613],
  },
  {
    baseId: 21793,
    variantIds: [29615],
  },
  {
    baseId: 21791,
    variantIds: [29617],
  },
  {
    baseId: 12904,
    variantIds: [33036],
  },
  {
    baseId: 12902,
    variantIds: [33035],
  },
  {
    baseId: 11864,
    variantIds: [
      19639, 19643, 19647, 21264, 21888, 23073, 24370, 25898, 25904, 25910,
      29816, 33066, 33338, 33340,
    ],
  },
  {
    baseId: 11865,
    variantIds: [
      19641, 19645, 19649, 21266, 21890, 23075, 24444, 25900, 25906, 25912,
      29818, 33068, 33439, 33445,
    ],
  },
  {
    baseId: 25177,
    variantIds: [
      25179, 25181, 25183, 25185, 25187, 25189, 25191, 25902, 25908, 25914,
      29820, 33070, 33441, 33447,
    ],
  },
  {
    baseId: 26674,
    variantIds: [
      26675, 26676, 26677, 26678, 26679, 26680, 26681, 26682, 26683, 26684,
      29822, 33072, 33443, 33449,
    ],
  },
  {
    baseId: 12931,
    variantIds: [13197, 13199],
  },
  {
    baseId: 12929,
    variantIds: [13196, 13198],
  },
  {
    baseId: 11850,
    variantIds: [
      13579, 13591, 13603, 13615, 13627, 13667, 21061, 24743, 25069, 27444,
      30045,
    ],
  },
  {
    baseId: 11851,
    variantIds: [
      13580, 13592, 13604, 13616, 13628, 13668, 21063, 24745, 25071, 27446,
      30047,
    ],
  },
  {
    baseId: 11852,
    variantIds: [
      13581, 13593, 13605, 13617, 13629, 13669, 21064, 24746, 25072, 27447,
      30048,
    ],
  },
  {
    baseId: 11853,
    variantIds: [
      13582, 13594, 13606, 13618, 13630, 13670, 21066, 24748, 25074, 27449,
      30050,
    ],
  },
  {
    baseId: 11854,
    variantIds: [
      13583, 13595, 13607, 13619, 13631, 13671, 21067, 24749, 25075, 27450,
      30051,
    ],
  },
  {
    baseId: 11855,
    variantIds: [
      13584, 13596, 13608, 13620, 13632, 13672, 21069, 24751, 25077, 27452,
      30053,
    ],
  },
  {
    baseId: 11856,
    variantIds: [
      13585, 13597, 13609, 13621, 13633, 13673, 21070, 24752, 25078, 27453,
      30054,
    ],
  },
  {
    baseId: 11857,
    variantIds: [
      13586, 13598, 13610, 13622, 13634, 13674, 21072, 24754, 25080, 27455,
      30056,
    ],
  },
  {
    baseId: 11858,
    variantIds: [
      13587, 13599, 13611, 13623, 13635, 13675, 21073, 24755, 25081, 27456,
      30057,
    ],
  },
  {
    baseId: 11859,
    variantIds: [
      13588, 13600, 13612, 13624, 13636, 13676, 21075, 24757, 25083, 27458,
      30059,
    ],
  },
  {
    baseId: 11860,
    variantIds: [
      13589, 13601, 13613, 13625, 13637, 13677, 21076, 24758, 25084, 27459,
      30060,
    ],
  },
  {
    baseId: 11861,
    variantIds: [
      13590, 13602, 13614, 13626, 13638, 13678, 21078, 24760, 25086, 27461,
      30062,
    ],
  },
]) {
  variantIdsByBaseItemId.set(baseId, variantIds);
  for (const variantId of variantIds) {
    baseItemIdByVariantId.set(variantId, baseId);
  }
}
function getBaseItemId(itemId) {
  return baseItemIdByVariantId.get(itemId) ?? itemId;
}
export { getBaseItemId };
