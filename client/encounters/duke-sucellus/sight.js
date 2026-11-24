// The Freezing Gaze's overlay: interface 829 (CACHE: duke_sight), whose one
// visible component (duke_eye_model) is a great eye among tendrils and rays,
// over the whole game view and under the interface.
//
// CACHE: model 48318, orthographic, zoom 1399, reference size 512 x 512. It
// fades in over 120 cycles (10216) and out over 64 by the same frames in
// reverse (10215), so the fade in is drawn both ways here: as far in as
// encounter.js, `sightStrength`, says.
// CACHE: the model is 1400 wide and its zoom 1399, so an orthographic model is
// drawn at 512 / zoom pixels to a unit: the 512 of the fixed layout's view,
// which is 334 high. That a larger view scales it by its height is inferred.
export const sightModelId = 48318;
export const sightSeqId = 10216;
const sightCycleMs = 20;
const zoom = 1399;
const fixedViewHeight = 334;

let tools = null; // { widgetModelView, npcModelLoader, animationSystem }
let shown = null; // { canvas, view, viewport, width, height }

/** What the overlay needs from the application: handed over by the presentation and the scene. */
export function setSightTools(next) {
  tools = { ...tools, ...next };
}

function open() {
  const viewport = document.querySelector(".scene-viewport");
  if (!viewport || !tools?.widgetModelView || !tools.npcModelLoader || !tools.animationSystem) return null;
  const { clientWidth: width, clientHeight: height } = viewport;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.className = "duke-sight";
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  viewport.append(canvas);
  // widgetModelView draws an orthographic model at zoom / 256 pixels to a
  // unit, times the height over baseHeight.
  const pixelsPerUnit = (512 / zoom) * (height / fixedViewHeight);
  const view = tools.widgetModelView({
    canvas, width, height, dpr: window.devicePixelRatio || 1, npcModelLoader: tools.npcModelLoader, animationSystem: tools.animationSystem,
    modelId: sightModelId, seqId: sightSeqId, zoom: 256 * pixelsPerUnit, orthographic: true, baseHeight: height,
  });
  return { canvas, view, viewport, width, height };
}

function close() {
  shown?.view.dispose();
  shown?.canvas.remove();
  shown = null;
}

/**
 * Brings the overlay in step with the fight, every frame: `strength` is how
 * many cycles of its fade in it has come (0 to sightAppearCycles).
 */
export function syncSight(strength) {
  if (!(strength > 0)) return close();
  // A view of another size, or one that is gone, has it drawn anew.
  if (shown && (!shown.canvas.isConnected || shown.viewport.clientWidth !== shown.width || shown.viewport.clientHeight !== shown.height)) close();
  shown ??= open();
  // Its last frame, held: the animation starts over at its end.
  shown?.view.draw(Math.min(strength * sightCycleMs, shown.view.cycleMs - sightCycleMs));
}
