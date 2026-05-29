// One-time asset optimization: the panorama is blurred + dimmed behind the UI,
// so full 1080² PNGs are wasteful. Downscale to 720² WebP. Re-run if the
// source faces are ever replaced.
//
//   npm i -D sharp && node scripts/optimize-panorama.mjs
import sharp from "sharp";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const dir = "src/assets/panorama";
const pngs = (await readdir(dir)).filter((f) => f.endsWith(".png"));

for (const file of pngs) {
  const src = join(dir, file);
  const out = src.replace(/\.png$/, ".webp");
  await sharp(src).resize(720, 720).webp({ quality: 80 }).toFile(out);
  await unlink(src);
  console.log(`${file} → ${out.split(/[\\/]/).pop()}`);
}
