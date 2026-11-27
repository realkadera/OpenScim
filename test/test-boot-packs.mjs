// tools/assets/cache.mjs packCache and tools/assets/boot-packs.mjs: a boot
// pack holds the groups of its list, reads the others as empty, and marks the
// ones the whole cache has. A three-group cache made here, so no game data is
// needed.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { SECTOR, packCache, unzipCache } from "../tools/assets/cache.mjs";
import { bootPackName, bootPacksStatus, buildBootPacks, readBootPacks } from "../tools/assets/boot-packs.mjs";

// Archive 7 with groups 0, 2 and 3: 2 spans two sectors, the others are one byte.
const payload = { 0: Buffer.from([0x42]), 2: crypto.randomBytes(700), 3: Buffer.from([0x43]) };
const stored = (group) => Buffer.concat([Buffer.from([0, 0, 0, payload[group].length >> 8, payload[group].length & 255]), payload[group]]);
const sectors = [Buffer.alloc(SECTOR)];
const idx = Buffer.alloc(5 * 6); // room for group 4, which the cache does not have
for (const group of [0, 2, 3]) {
  const data = stored(group);
  idx.writeUIntBE(data.length, group * 6, 3);
  idx.writeUIntBE(sectors.length, group * 6 + 3, 3);
  for (let at = 0, chunk = 0; at < data.length; at += SECTOR - 8, chunk++) {
    const sector = Buffer.alloc(SECTOR);
    sector.writeUInt16BE(group);
    sector.writeUInt16BE(chunk, 2);
    sector.writeUIntBE(at + SECTOR - 8 < data.length ? sectors.length + 1 : 0, 4, 3);
    sector[7] = 7;
    data.copy(sector, 8, at, at + SECTOR - 8);
    sectors.push(sector);
  }
}
const zip = new JSZip();
zip.file("main_file_cache.idx7", idx);
zip.file("main_file_cache.dat2", Buffer.concat(sectors));
const whole = await zip.generateAsync({ type: "nodebuffer" });

// A pack of group 2, out of a cache that also has 0 and 3.
const { bytes, count } = await packCache(await unzipCache(whole), { 7: [2] }, { 7: [0, 3] });
assert.equal(count, 1);
const pack = await unzipCache(bytes);
assert.deepEqual(await pack.group(7, 2), stored(2), "the group of the list, as the whole cache has it");
assert.equal(await pack.group(7, 0), null, "a group left out reads as absent");
const packIdx = await pack.load("idx7");
assert.equal(packIdx.length, idx.length, "the idx file is as long as the whole cache's, so no group is out of range");
const entry = (group) => [packIdx.readUIntBE(group * 6, 3), packIdx.readUIntBE(group * 6 + 3, 3)];
assert.deepEqual(entry(0), [0, 1], "left out, in the whole cache: size 0, sector 1");
assert.deepEqual(entry(3), [0, 1]);
assert.deepEqual(entry(4), [0, 0], "in neither: unmarked");
assert.deepEqual(entry(1), [0, 0]);

assert.equal(bootPackName("/"), "lobby");
assert.equal(bootPackName("/Yama/"), "yama");
assert.equal(bootPackName("/yama/replay/abc"), "yama");

// The packs of the lists in tools/assets/boot-packs/, cut from this cache:
// each holds what its list and the cache share.
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openscim-boot-packs-"));
try {
  await fs.writeFile(path.join(dir, "disk.zip"), whole);
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ diskZipSha256: crypto.createHash("sha256").update(whole).digest("hex") }));
  const lists = Object.keys(readBootPacks());
  if (lists.length) assert.equal(await bootPacksStatus(dir), "stale", "lists and no packs");
  await buildBootPacks(dir, { 7: [0, 2, 3] });
  assert.equal(await bootPacksStatus(dir), "ok");
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.bootPacks), lists, "the manifest names every pack");
  for (const name of lists) {
    const built = await fs.readFile(path.join(dir, "boot", name + ".zip"));
    assert.equal(manifest.bootPacks[name].sha256, crypto.createHash("sha256").update(built).digest("hex"));
    assert.equal(manifest.bootPacks[name].bytes, built.length);
  }
  if (lists.length) {
    await fs.rm(path.join(dir, "boot", lists[0] + ".zip"));
    assert.equal(await bootPacksStatus(dir), "stale", "a pack the manifest names is gone");
  }
} finally {
  await fs.rm(dir, { recursive: true, force: true });
}
console.log("boot packs: a pack holds its list, marks what the whole cache has, and is named in the manifest");
