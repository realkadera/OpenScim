// The boot packs: for a route, the cache groups it reads on the way to its
// first frame, as { "<cache index>": [group ids] } in
// tools/assets/boot-packs/<name>.json. tools/boot-packs.mjs records the lists;
// tools/fetch-assets.mjs builds client/osrs-cache/boot/<name>.zip from each: a
// cache in the layout of disk.zip that holds those groups alone, and names it
// in client/osrs-cache/manifest.json ("bootPacks"), where the client finds it.
import fs from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { packCache, unzipCache } from "./cache.mjs";

export const bootPacksDirectory = path.join(import.meta.dirname, "boot-packs");

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

/** The pack of a route: its first path segment, "lobby" for "/". The client picks the same way (CacheManager.bootFromPack). */
export const bootPackName = (route) => route.split("/").filter(Boolean)[0]?.toLowerCase() ?? "lobby";

/** Every list by name, each with the text of its file. */
export function readBootPacks() {
  if (!existsSync(bootPacksDirectory)) return {};
  return Object.fromEntries(
    readdirSync(bootPacksDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => {
        const text = readFileSync(path.join(bootPacksDirectory, file), "utf8");
        return [file.slice(0, -5), { text, groups: JSON.parse(text) }];
      }),
  );
}

/** "ok" when the packs in `dir` (client/osrs-cache) are the ones its manifest names and the lists describe, else "stale". */
export async function bootPacksStatus(dir) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8").catch(() => "{}"));
  const lists = readBootPacks();
  const built = manifest.bootPacks ?? {};
  const current =
    Object.keys(built).join() === Object.keys(lists).join() &&
    Object.entries(lists).every(([name, list]) => built[name].groupsSha256 === sha256(list.text) && existsSync(path.join(dir, "boot", name + ".zip")));
  return current ? "ok" : "stale";
}

/**
 * Builds every pack from the trimmed cache in `dir`, whose groups are
 * `wholeGroups` (readCacheGroups()). A pack has all of index 255, the tables
 * of what each index holds, and of the others what its list names.
 */
export async function buildBootPacks(dir, wholeGroups) {
  const whole = await unzipCache(await fs.readFile(path.join(dir, "disk.zip")));
  const manifestFile = path.join(dir, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  manifest.bootPacks = {};
  await fs.rm(path.join(dir, "boot"), { recursive: true, force: true });
  await fs.mkdir(path.join(dir, "boot"), { recursive: true });
  const built = [];
  for (const [name, list] of Object.entries(readBootPacks())) {
    const groups = {};
    const pending = {};
    for (const [index, ids] of Object.entries(wholeGroups)) {
      // A recording also lists what it read and the cache does not have.
      const wanted = new Set(index === "255" ? ids : list.groups[index] ?? []);
      groups[index] = ids.filter((id) => wanted.has(id));
      pending[index] = ids.filter((id) => !wanted.has(id));
    }
    const { bytes } = await packCache(whole, groups, pending);
    await fs.writeFile(path.join(dir, "boot", name + ".zip"), bytes);
    manifest.bootPacks[name] = { sha256: sha256(bytes), bytes: bytes.length, groupsSha256: sha256(list.text) };
    built.push(name + " " + (bytes.length / 1048576).toFixed(1) + " MB");
  }
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  return built.join(", ") || "none listed";
}
