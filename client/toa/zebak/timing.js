export const cyclesPerTick = 30;
// The first visible pot/rock and arrival are frame estimates. Cache sound matches
// place redirects and impacts at ticks 4/7 on paths 0 and 3, and 3/5 on path 4.
// Baseline https://youtu.be/93wKYCaXfmo?t=196, path 3 https://youtu.be/0-T2gOVfTkI?t=1265,
// path 4 https://youtu.be/mwKeq1tP05Y?t=544.
// Each mouth is sampled from the animated head at release. X/Y are relative
// to the southwest tile; height is above terrain in cache units (128 per tile).
const standardSpit = {
  clipId: "standardSpit", releaseFrame: 66,
  release: 42, split: 93, arrival: 180, impactTicks: 7,
  mouth: {x: 8.58, y: 4.54, height: 309},
};
const fastSpit = {
  clipId: "fastSpit", releaseFrame: 66,
  release: 56, split: 85, arrival: 142, impactTicks: 5,
  mouth: standardSpit.mouth,
};
const standardEnragedSpit = {...standardSpit, clipId: "standardEnragedSpit", releaseFrame: 32,
  split: 95, mouth: {x: 8.49, y: 4.54, height: 315}};
const fastEnragedSpit = {...fastSpit, clipId: "fastEnragedSpit", releaseFrame: 32,
  release: 32, mouth: standardEnragedSpit.mouth};
export function spitClips(normalSequence, enragedSequence) {
  const clip = (seqId, timing) => ({seqId, releaseFrame: timing.releaseFrame, releaseCycle: timing.release});
  return {
    standardSpit: clip(normalSequence, standardSpit),
    fastSpit: clip(normalSequence, fastSpit),
    standardEnragedSpit: clip(enragedSequence, standardEnragedSpit),
    fastEnragedSpit: clip(enragedSequence, fastEnragedSpit),
  };
}
export function spitTiming(path, enraged = false) {
  if (path >= 4) return enraged ? fastEnragedSpit : fastSpit;
  return enraged ? standardEnragedSpit : standardSpit;
}

// OBS (20261125-160410-Tombs-of-Amascut.jsonl.gz, the specials that start on ticks 299 and 543): the spit is animated one tick
// after the special starts and the vomit is heard then; the rocks, jugs and acid leave his mouth a tick later
// and all land together, 6 ticks after the start. A blood spell cast as the special starts puts the sound,
// the flight and the landing one tick later (the specials of ticks 147, 360 and 419: `delayedByBlood`).
export const specialThrow = { animation: 30, sound: 30, release: 60, acidLandingTick: 6, solidLandingTick: 6, delayedByBlood: 1 };
// OBS (20261125-160410-Tombs-of-Amascut.jsonl.gz, every throw, e.g. tick 150): thrown from 250 high to the ground on slope 35.
export const specialThrowArc = { startHeight: 250, endHeight: 0, slope: 35 };

// OBS (20261125-160410-Tombs-of-Amascut.jsonl.gz, the roars of ticks 394 and 572, their specials starting on 360 and 543): the
// roar is animated 34 ticks after a first roar's special starts and 29 after a second's, as below. Then:
// dust on its 3rd, 5th and 7th tick, each tile 1 cycle later per tile of distance from the tile before his
// jaw; 50 on every boulder and the jugs broken on its 4th, 6th and 8th; his next spit on its 11th.
export const roarTicks = { dust: [3, 5, 7], damage: [4, 6, 8], over: 11, dustOrigin: [22, 32] };
// OBS (same roars; spits at ticks 371 and 554): his first spit after a roar's special is 11 ticks after its start.
export const roarSpecialRecovery = 11;
// Ticks from the start of the special spit to the start of the roar animation.
// Measured from 5908 (+30 cycles) and 5836 (+20 cycles) in the recordings above.
// The second baseline roar is inferred from the five-tick difference on paths 3 and 4.
const firstRoarByAttackPeriod = {7: 34, 6: 31, 5: 29};
export function roarWindupTick(attackPeriod = 7, secondRoar = false) {
  const firstRoar = firstRoarByAttackPeriod[attackPeriod];
  return firstRoar - (secondRoar ? 5 : 0);
}
