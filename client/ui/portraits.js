// Pictures of bosses for the encounter picker, drawn from the game cache as
// they are needed: an encounter's presentation names the NPC and how to frame
// it (`portrait: { npcTypeId, framing }`), and no picture is kept in the
// repository.
//
// A browser allows a page only a handful of WebGL contexts, and the bundle's
// portrait view (`createView`, rendering.js) takes one for each canvas. So a
// picture is drawn once, alone, read back as an image and its view let go;
// the next waits for it. The images are kept for as long as the page lives.
// What a picture is drawn on: the dark of the frame the picker gives it (#0a0805).
const portraitBackground = { r: 10 / 255, g: 8 / 255, b: 5 / 255, a: 1 };
const drawn = new Map();
let last = Promise.resolve();

const idle = (work) => (typeof requestIdleCallback === "function" ? requestIdleCallback(work, { timeout: 1500 }) : setTimeout(work, 0));

// The picture of a portrait as the URL of an image, or null when it cannot be
// drawn (its model is not in the cache, or the page has lost its graphics).
//   createView({ canvas, width, height, dpr, background, config,
//                npcModelLoader, animationSystem }) -> { draw(ms), dispose() }
export function drawPortrait({ createView, npcModelLoader, animationSystem }, portrait, size = 192) {
  const key = JSON.stringify(portrait) + "@" + size;
  if (!drawn.has(key)) {
    const picture = (last = last.then(
      () =>
        new Promise((resolve) =>
          idle(() => {
            const canvas = document.createElement("canvas");
            let view;
            try {
              view = createView({ canvas, width: size, height: size, dpr: 1, background: portraitBackground, config: portrait, npcModelLoader, animationSystem });
              view.draw(0);
              // Read in the task that drew it: the browser may clear the
              // drawing afterwards.
              resolve(canvas.toDataURL("image/png"));
            } catch {
              resolve(null);
            } finally {
              view?.dispose();
            }
          }),
        ),
    ));
    drawn.set(key, picture);
    // A picture that failed is tried again the next time it is asked for.
    picture.then((url) => url === null && drawn.get(key) === picture && drawn.delete(key));
  }
  return drawn.get(key);
}
