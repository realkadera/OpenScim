// The plugin Blindfold: stops drawing what you choose of the scene (the
// terrain, the scenery, the NPCs and what flies) and of the interface; you are
// always drawn. With the terrain off, the floor is the sky's colour, which
// the plugin Skybox (skybox.js) sets: a floor of a colour of your own.
// Rebuilt from the RuneLite Plugin Hub plugin of that name
// (github.com/stevenwaterman/runelite-plugins, BSD 2-Clause, "Copyright (c)
// 2020, Trevor", "Copyright (c) 2022, Steven Waterman"), from its options,
// their defaults and what it hides; no code of it is here. PLUGIN below is
// that.
//
// What it hides, as the plugin sorts what the game draws:
//   - Show Terrain: the ground of the map square.
//   - Show Scenery: the map's objects and those an encounter places (the Doom
//     of Mokhaiotl's rocks and acid, Zebak's acid).
//   - Show Entities: NPCs, projectiles and ground items. The player is drawn
//     whatever the options say.
//   - Show UI: the interface over the scene (the game's panels, the chat,
//     the minimap and orbs, hitsplats, health bars and overheads); the bar
//     at the top, with the Plugins panel, stays, as RuneLite's side panel does.
// The hotkey switches all of it off and on again. Not here: what the plugin
// lists as broken (RuneLite's own objects, pausing when unfocused), and the
// tile graphics, which the plugin counts as scenery and the scenes draw with
// the spot animations of actors.
import { createPluginStore } from "./pluginStore.js";
import { describeHotkey } from "./attackRanges.js";

// PLUGIN: its options, in its order, with its defaults and descriptions.
export const blindfoldOptions = [
  { key: "hotkey", label: "Toggle hotkey", section: "Options", type: "hotkey", default: "", info: "Toggle plugin functionality" },
  { key: "enableUi", label: "Show UI", section: "Options", type: "boolean", default: true, info: "Disable this to remove ALL interface elements from the screen. Useful as a greenscreen for content creation." },
  { key: "enableTerrain", label: "Show Terrain", section: "Options", type: "boolean", default: false, info: "Disable this to hide the terrain / landscape." },
  { key: "enableScenery", label: "Show Scenery", section: "Options", type: "boolean", default: false, info: "Disable this to hide the static scenery." },
  { key: "enableEntities", label: "Show Entities", section: "Options", type: "boolean", default: false, info: "Disable this to hide NPCs, Players, projectiles, and ground items." },
];
export const blindfoldStore = createPluginStore("blindfold", blindfoldOptions);

// Switched off by the hotkey until it is pressed again (not kept).
let hotkeyOff = false;
const noUiClass = "blindfold-no-ui";
let styleAdded = false;

/** What the scene leaves out this frame, or null when the plugin is off. */
export function getBlindfold() {
  const { enabled, settings } = blindfoldStore.getState();
  return enabled && !hotkeyOff ? settings : null;
}

// The interface is the page's: a class on the body hides it.
function syncInterface() {
  if (typeof document === "undefined") return;
  if (!styleAdded) {
    styleAdded = true;
    const style = document.createElement("style");
    // The game's panels are the viewport frame's own layer, beside the scene and its presentation.
    style.textContent = `body.${noUiClass} .game-viewport-frame > div > div:not(.scene-viewport):not(.scene-presentation) { visibility: hidden; }`;
    document.head.append(style);
  }
  const blindfold = getBlindfold();
  document.body.classList.toggle(noUiClass, Boolean(blindfold && !blindfold.enableUi));
}

/** The hotkey, and the interface kept in step with the options; returns the function that stops both. */
export function listenForBlindfold(target = globalThis.window) {
  syncInterface();
  const unsubscribe = blindfoldStore.subscribe(syncInterface);
  // Not while typing, as Attack Ranges' hotkey (attackRanges.js).
  const typing = (event) => typeof HTMLElement !== "undefined" && event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
  const onKeyDown = (event) => {
    const hotkey = blindfoldStore.getState().settings.hotkey;
    if (event.repeat || typing(event) || !hotkey || !blindfoldStore.getState().enabled || describeHotkey(event) !== hotkey) return;
    hotkeyOff = !hotkeyOff;
    syncInterface();
  };
  target?.addEventListener("keydown", onKeyDown);
  return () => {
    unsubscribe();
    target?.removeEventListener("keydown", onKeyDown);
  };
}
