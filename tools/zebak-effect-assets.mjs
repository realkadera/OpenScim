import { chromium } from "playwright-core";
import { browserOptions } from "./browser.mjs";
import fs from "node:fs/promises";
const b = await chromium.launch(browserOptions);
try {
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:5173/zebak/");
  const { missing, sounds } = await p.evaluate(async () => {
    const c = new (await import("/assets/player.js")).CacheManager();
    await c.ensureCache();
    const models = new Set(Array.from({length: 7}, (_, i) => c.locTypeLoader.load(45570 + i).models.flat()).flat());
    const sequences = new Set(Array.from({ length: 18 }, (_, i) => 9618 + i));
    for (const id of [
      2176, 2177, 2178, 2179, 2181, 2182, 2185, 2186, 2187, 2188, 2189, 2190,
      2172, 2173, 2194, 2184, 2191, 2192, 2193, 2195, 2174, 1556, 68, 95, 2449, 377,
    ]) {
      const d = c.spotAnimTypeLoader.load(id);
      models.add(d.modelId);
      if (d.sequenceId >= 0) sequences.add(d.sequenceId);
    }
    const sounds = new Set();
    for (const seq of sequences)
      for (const list of c.animationSystem
        .loadSeqType(seq)
        ?.frameSounds?.values() ?? [])
        for (const s of list) sounds.add(s.id);
    return {
      sounds: [...sounds],
      missing: [...models].filter(
        (id) => !c.cacheSystem.getIndex(7).read(id)?.length,
      ),
    };
  });
  console.log("sounds", sounds.join(","));
  for (const id of missing) {
    const r = await fetch(
      "https://archive.openrs2.org/caches/runescape/2762/archives/7/groups/" +
        id +
        ".dat",
    );
    if (!r.ok) throw Error(r.status);
    await fs.writeFile(
      "evidence/zebak-groups/7-" + id + ".dat",
      Buffer.from(await r.arrayBuffer()),
    );
  }
  if (missing.length) await import("./pack-zebak-cache.mjs");
} finally {
  await b.close();
}
