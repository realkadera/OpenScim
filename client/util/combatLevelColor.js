// The colour of another's "(level-N)" in a menu, by its difference to your
// own combat level: shades of green when lower, yellow when equal, orange to
// red when higher. WIKI: https://oldschool.runescape.wiki/w/Combat_level
// (the table of colours: +10 or more #ff0000, +9 #ff3000, +6 #ff7000,
// +3 #ffb000, 0 #ffff00, -1 #c0ff00, -4 #80ff00, -7 #40ff00, -10 or less
// #00ff00). The page gives sample differences only; the bands between them,
// three levels wide, are inferred from those samples.
export function combatLevelColor(ownLevel, otherLevel) {
  const diff = otherLevel - ownLevel;
  if (!Number.isFinite(diff)) return "#ffff00";
  if (diff >= 10) return "#ff0000";
  if (diff >= 7) return "#ff3000";
  if (diff >= 4) return "#ff7000";
  if (diff >= 1) return "#ffb000";
  if (diff === 0) return "#ffff00";
  if (diff >= -3) return "#c0ff00";
  if (diff >= -6) return "#80ff00";
  if (diff >= -9) return "#40ff00";
  return "#00ff00";
}
