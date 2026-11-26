// Yama, phase 3: what the registry has of him (encounters/registry.js says
// what a definition holds). Each contract is a variant kind with a factory
// and controls of its own.
import {
  divineSeveranceContract,
  forfeitBreathContract,
  sensoryCloudingContract,
  bloodiedBlowsContract,
  glyphicAttenuationContract,
  yamaContractVariants,
} from "./contracts.js";
import { buildYamaControls } from "./controls.js";
import { YamaEncounter } from "./YamaEncounter.js";

export const definition = {
  kind: "yama_p3",
  slug: "yama",
  factory: () => new YamaEncounter(),
  enableIntro: true,
  descriptor: {
    kind: "yama_p3",
    displayName: "Yama - Phase 3",
    description: "The Yama boss encounter",
    // The texts of the page for search engines (client/seo/routes.js).
    seo: {
      name: "Yama",
      summary: "Practice the Yama Phase 3 fight and its contracts.",
      breadcrumb: "Yama (P3)",
      title: "OSRS Yama Simulator",
      description: "Practice Yama in your browser, then take him on confidently in the real game. The base fight and five sigil contracts are live now.",
      h1: "OSRS Yama Boss Simulator",
      intro: "Yama is a demon boss in OSRS, found in his domain at the bottom of the Chasm of Fire. This sim covers the Phase 3 fight so you can learn it before doing it for real.",
      keywords: ["OSRS Yama", "Yama P3", "Yama Phase 3", "OSRS Yama simulator", "Yama solver", "Yama practice", "OSRS Yama strategy", "Yama contracts"],
    },
    mapSquare: {
      x: 23,
      y: 157,
    },
    playerStart: [31, 37],
    loadsMapLocs: true,
    variants: yamaContractVariants,
    variantLabel: "Contract",
    collision: {
      mode: "auto",
      seed: [32, 30],
    },
    victory: {
      eyebrow: "Triumphant",
      title: "VICTORY",
      narrative: "YAMA DEFEATED",
      accent: "blood",
    },
  },
  variantFactories: {
    yama_p3_divine: () => new YamaEncounter(divineSeveranceContract),
    yama_p3_forfeit_breath: () => new YamaEncounter(forfeitBreathContract),
    yama_p3_sensory: () => new YamaEncounter(sensoryCloudingContract),
    yama_p3_bloodied: () => new YamaEncounter(bloodiedBlowsContract),
    yama_p3_glyphic: () => new YamaEncounter(glyphicAttenuationContract),
  },
  controls: buildYamaControls(),
  variantControls: {
    yama_p3_divine: buildYamaControls(divineSeveranceContract),
    yama_p3_forfeit_breath: buildYamaControls(forfeitBreathContract),
    yama_p3_sensory: buildYamaControls(sensoryCloudingContract),
    yama_p3_bloodied: buildYamaControls(bloodiedBlowsContract),
    yama_p3_glyphic: buildYamaControls(glyphicAttenuationContract),
  },
};
export const order = 30;
