// Refreshes the title-screen panorama from the latest Minecraft snapshot.
//
// Walks Mojang's official asset pipeline — version manifest → version JSON →
// asset index → object hashes — then downloads the six panorama cube faces and
// writes optimized WebP into src/assets/panorama/. Run with `npm run
// panorama:refresh`; CI runs it on a schedule (see .github/workflows).
//
// Usage:
//   node scripts/refresh-panorama.mjs            # latest snapshot
//   node scripts/refresh-panorama.mjs --release  # latest full release
//   node scripts/refresh-panorama.mjs 1.21.4     # a specific version id
//
// The faces are heavily blurred/darkened behind the UI, so we downscale to keep
// the bundle small. Bump EDGE if you ever want crisper faces.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const MANIFEST =
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const PANORAMA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "assets",
  "panorama"
);
const ASSET_PREFIX = "minecraft/textures/gui/title/background/panorama_";
const FACE_COUNT = 6; // 0-3 sides, 4 top, 5 bottom
const EDGE = 512; // px per face after downscale
const WEBP_QUALITY = 82;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

/** Resolves the CLI target to a concrete version entry from the manifest. */
function pickVersion(manifest, arg) {
  if (arg && arg !== "--release" && arg !== "--snapshot") {
    const found = manifest.versions.find((v) => v.id === arg);
    if (!found) throw new Error(`Version "${arg}" not found in manifest.`);
    return found;
  }
  const id =
    arg === "--release" ? manifest.latest.release : manifest.latest.snapshot;
  return manifest.versions.find((v) => v.id === id);
}

async function main() {
  const arg = process.argv[2];

  console.log("→ Fetching version manifest…");
  const manifest = await getJson(MANIFEST);
  const version = pickVersion(manifest, arg);
  console.log(`→ Version: ${version.id} (${version.type})`);

  const versionMeta = await getJson(version.url);
  const assetIndex = await getJson(versionMeta.assetIndex.url);
  const { objects } = assetIndex;

  await mkdir(PANORAMA_DIR, { recursive: true });

  for (let i = 0; i < FACE_COUNT; i++) {
    const key = `${ASSET_PREFIX}${i}.png`;
    const entry = objects[key];
    if (!entry) throw new Error(`Asset index is missing ${key}.`);

    const { hash } = entry;
    const url = `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download ${key} → HTTP ${res.status}`);
    const png = Buffer.from(await res.arrayBuffer());

    const webp = await sharp(png)
      .resize(EDGE, EDGE, { fit: "cover" })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const out = join(PANORAMA_DIR, `panorama_${i}.webp`);
    await writeFile(out, webp);
    const kb = (webp.length / 1024).toFixed(0);
    console.log(`  ✓ panorama_${i}.webp  (${kb} KB)`);
  }

  console.log(`\n✅ Panorama updated from ${version.id} → ${PANORAMA_DIR}`);
}

main().catch((err) => {
  console.error("\n❌ Panorama refresh failed:", err.message);
  process.exit(1);
});
