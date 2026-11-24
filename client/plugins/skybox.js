// The plugin Skybox: the colour of the sky, which is what is drawn where the
// scene draws nothing (and, with Blindfold's terrain off, the floor). Rebuilt
// from RuneLite's own plugin of that name (runelite-client,
// net.runelite.client.plugins.skybox, BSD 2-Clause, "Copyright (c) 2019 Abex"),
// from its options and what it does; no code of it is here. PLUGIN below is
// that.
//
// PLUGIN: two colours, one for the overworld and one for everywhere else
// (caves, dungeons, and the instances copied from them), told apart by the
// map's y: under 4160 is the overworld. With no colour set it draws the
// game's own skies; here the scene's own background is that, and it is
// each colour's default.
import { createPluginStore, toHexColor } from "./pluginStore.js";

const sceneBackground = "FF0A0B10"; // the base scene's (rendering.js)
export const skyboxOptions = [
  { key: "customOverworldColor", label: "Overworld sky color", section: "Options", type: "color", default: sceneBackground, info: "Sets the color to use for the sky in overworld areas." },
  { key: "customOtherColor", label: "Cave sky color", section: "Options", type: "color", default: sceneBackground, info: "Sets the color to use for the sky in non-overworld areas." },
];
export const skyboxStore = createPluginStore("skybox", skyboxOptions);
const overworldMaxY = 4160; // PLUGIN: Constants.OVERWORLD_MAX_Y

/** The sky over a map square ({ x, y }), "#RRGGBB"; null when the plugin is off. */
export function getSkyboxColor(mapSquare) {
  const { enabled, settings } = skyboxStore.getState();
  if (!enabled) return null;
  const overworld = mapSquare ? mapSquare.y * 64 < overworldMaxY : false;
  return toHexColor(overworld ? settings.customOverworldColor : settings.customOtherColor);
}
