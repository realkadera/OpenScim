// A beat that goes on while the page is hidden or covered. A browser stops
// the frame callbacks of such a page and slows its timers to one a second; a
// worker's timer is not slowed. The lobby uses it so that a player in a window
// behind another still walks (Follow) and is still seen by the others.
//
//   const stop = startBackgroundBeat(fn, ms)   fn() about every ms; stop() ends it
//
// Without workers (or where one cannot start) it is a plain interval.
const SOURCE = "let t=null;onmessage=(e)=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}";

export function startBackgroundBeat(fn, ms = 100) {
  let worker = null;
  let url = null;
  let timer = null;
  try {
    url = URL.createObjectURL(new Blob([SOURCE], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = () => fn();
    worker.onerror = () => {
      timer ??= setInterval(fn, ms);
    };
    worker.postMessage(ms);
  } catch {
    worker = null;
    timer = setInterval(fn, ms);
  }
  return () => {
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
    if (timer !== null) clearInterval(timer);
    worker = url = timer = null;
  };
}
