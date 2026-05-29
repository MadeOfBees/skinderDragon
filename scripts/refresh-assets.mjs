// Downloads all gitignored public/ assets from Mojang's CDN:
//   • public/panorama/<channel>/panorama_{0-5}.webp  — title-screen background
//   • public/favicon.png                             — Steve's face, default tab icon
//
// Panorama pipeline: version manifest → version JSON → asset index → object hashes.
// Two channels are kept side by side:
//   • release/   — the latest full release (app default)
//   • snapshot/  — the latest snapshot     (opt-in toggle in the UI)
//
// Usage:
//   node scripts/refresh-assets.mjs              # refresh everything
//   node scripts/refresh-assets.mjs --release    # release panorama only
//   node scripts/refresh-assets.mjs --snapshot   # snapshot panorama only
//   node scripts/refresh-assets.mjs 1.21.4 release  # pin a version → release/
//   node scripts/refresh-assets.mjs --ensure     # skip if all files already present
//
// Panorama faces are heavily blurred/darkened behind the UI, so we downscale
// to keep the bundle small. Bump EDGE if you ever want crisper faces.

import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const PANORAMA_DIR = join(PUBLIC, "panorama");
const FAVICON_PATH = join(PUBLIC, "favicon.png");

const MANIFEST =
  "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const PLAYERDB = "https://playerdb.co/api/player/minecraft/MHF_Steve";
const ASSET_PREFIX = "minecraft/textures/gui/title/background/panorama_";
const FACE_COUNT = 6; // 0-3 sides, 4 top, 5 bottom
const EDGE = 512; // px per face after downscale
const WEBP_QUALITY = 82;
const FAVICON_SIZE = 32; // px — renders crisp at 16×16 browser display size

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return res.json();
}

/** Returns true if all six face files already exist for the given channel. */
async function channelComplete(channel) {
  for (let i = 0; i < FACE_COUNT; i++) {
    try {
      await access(join(PANORAMA_DIR, channel, `panorama_${i}.webp`));
    } catch {
      return false;
    }
  }
  return true;
}

/** Returns true if the default favicon already exists. */
async function faviconPresent() {
  try {
    await access(FAVICON_PATH);
    return true;
  } catch {
    return false;
  }
}

/** Resolves a CLI version token to a concrete version entry from the manifest. */
function resolveVersion(manifest, token) {
  if (token === "release" || token === "--release") {
    const id = manifest.latest.release;
    return manifest.versions.find((v) => v.id === id);
  }
  if (token === "snapshot" || token === "--snapshot") {
    const id = manifest.latest.snapshot;
    return manifest.versions.find((v) => v.id === id);
  }
  const found = manifest.versions.find((v) => v.id === token);
  if (!found) throw new Error(`Version "${token}" not found in manifest.`);
  return found;
}

/** Downloads the six faces for one version and writes them into one channel dir. */
async function refreshChannel(manifest, channel, versionToken) {
  const version = resolveVersion(manifest, versionToken);
  console.log(`→ ${channel}: ${version.id} (${version.type})`);

  const versionMeta = await getJson(version.url);
  const assetIndex = await getJson(versionMeta.assetIndex.url);
  const { objects } = assetIndex;

  const outDir = join(PANORAMA_DIR, channel);
  await mkdir(outDir, { recursive: true });

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

    const out = join(outDir, `panorama_${i}.webp`);
    await writeFile(out, webp);
    const kb = (webp.length / 1024).toFixed(0);
    console.log(`  ✓ ${channel}/panorama_${i}.webp  (${kb} KB)`);
  }
  return version.id;
}

/**
 * Downloads MHF_Steve's face (face layer + hat overlay) and writes it as
 * public/favicon.png. Uses the same playerdb pipeline the app uses so the
 * result matches exactly what appears in the viewer when you load "Steve".
 */
async function refreshFavicon() {
  console.log("→ Fetching Steve's face for default favicon…");

  const body = await getJson(PLAYERDB);
  if (!body.success || !body.data?.player) {
    throw new Error("playerdb: could not resolve MHF_Steve");
  }

  const texturesProp = body.data.player.properties?.find(
    (p) => p.name === "textures"
  );
  if (!texturesProp) throw new Error("MHF_Steve has no textures property");

  const textures = JSON.parse(
    Buffer.from(texturesProp.value, "base64").toString("utf8")
  );
  const skinUrl = textures.textures?.SKIN?.url;
  if (!skinUrl) throw new Error("Could not find MHF_Steve's skin URL");

  const skinRes = await fetch(skinUrl);
  if (!skinRes.ok) throw new Error(`Skin download → HTTP ${skinRes.status}`);
  const skinBuffer = Buffer.from(await skinRes.arrayBuffer());

  // The skin sheet is 64×64. Face is at (8,8), hat overlay at (40,8), both 8×8.
  // We scale both to FAVICON_SIZE with nearest-neighbour, then composite hat over face.
  const faceBuffer = await sharp(skinBuffer)
    .extract({ left: 8, top: 8, width: 8, height: 8 })
    .resize(FAVICON_SIZE, FAVICON_SIZE, { kernel: "nearest" })
    .png()
    .toBuffer();

  const hatBuffer = await sharp(skinBuffer)
    .extract({ left: 40, top: 8, width: 8, height: 8 })
    .resize(FAVICON_SIZE, FAVICON_SIZE, { kernel: "nearest" })
    .png()
    .toBuffer();

  await mkdir(PUBLIC, { recursive: true });

  const favicon = await sharp(faceBuffer)
    .composite([{ input: hatBuffer, blend: "over" }])
    .png()
    .toBuffer();

  await writeFile(FAVICON_PATH, favicon);
  console.log(`  ✓ favicon.png  (${favicon.length} B)`);
}

async function main() {
  const args = process.argv.slice(2);
  const ensure = args.includes("--ensure");
  const rest = args.filter((a) => a !== "--ensure");

  if (ensure) {
    const panoramaOk =
      (await channelComplete("release")) && (await channelComplete("snapshot"));
    const faviconOk = await faviconPresent();

    if (panoramaOk && faviconOk) {
      console.log("→ All assets already present, skipping download.");
      return;
    }

    // Some files are missing — try to download, but don't block startup on CDN failures.
    try {
      if (!panoramaOk) {
        console.log("→ Fetching version manifest…");
        const manifest = await getJson(MANIFEST);
        if (!(await channelComplete("release")))
          await refreshChannel(manifest, "release", "release");
        if (!(await channelComplete("snapshot")))
          await refreshChannel(manifest, "snapshot", "snapshot");
      }
      if (!faviconOk) await refreshFavicon();
      console.log("\n✅ Assets ready.");
    } catch (err) {
      console.warn(
        "⚠️  Asset ensure failed (CDN unavailable?) — starting without some assets.\n  ",
        err.message
      );
    }
    return;
  }

  // Full refresh: panoramas (with optional channel filter) + favicon.
  // `node refresh-assets.mjs 1.21.4 release` pins a version to a channel.
  console.log("→ Fetching version manifest…");
  const manifest = await getJson(MANIFEST);

  if (rest.length === 2 && (rest[1] === "release" || rest[1] === "snapshot")) {
    await refreshChannel(manifest, rest[1], rest[0]);
  } else if (rest[0] === "--release") {
    await refreshChannel(manifest, "release", "release");
  } else if (rest[0] === "--snapshot") {
    await refreshChannel(manifest, "snapshot", "snapshot");
  } else {
    await refreshChannel(manifest, "release", "release");
    await refreshChannel(manifest, "snapshot", "snapshot");
  }

  await refreshFavicon();

  console.log("\n✅ Assets updated.");
}

main().catch((err) => {
  console.error("\n❌ Asset refresh failed:", err.message);
  process.exit(1);
});
