// Headless smoke test for skinderdragon.
// Drives the real UI, exercises the WebGL render + gifenc pipeline, and
// validates the emitted bytes are genuine looping GIFs.
import { chromium } from "playwright";

const URL = process.env.SMOKE_URL ?? "http://localhost:5173/";

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-sandbox",
  ],
});

const page = await browser.newPage({
  viewport: { width: 1120, height: 1040 },
});
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
};

// Inspect raw GIF bytes for validity, loop extension, and transparency flag.
function analyzeGif(bytes) {
  const b = Uint8Array.from(bytes);
  const header = String.fromCharCode(...b.slice(0, 6));
  const valid = header === "GIF89a" || header === "GIF87a";
  // NETSCAPE2.0 application extension = looping.
  const txt = String.fromCharCode(...b.slice(0, Math.min(b.length, 4000)));
  const looping = txt.includes("NETSCAPE2.0");
  // Scan for a Graphic Control Extension (0x21 0xF9 0x04) with the
  // transparency flag (bit 0 of the packed field) set.
  let transparent = false;
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04) {
      if (b[i + 3] & 0x01) transparent = true;
    }
  }
  return { valid, header, looping, transparent, size: b.length };
}

async function loadUser(name) {
  await page.fill('input[type="text"]', "");
  await page.fill('input[type="text"]', name);
  await page.click('button[type="submit"]');
  // Wait for either the player name to show or an error.
  await page
    .locator('[data-testid="player-name"], [data-testid="error"]')
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
  const err = await page.$('[data-testid="error"]');
  if (err) throw new Error("UI error: " + (await err.textContent()));
  // Give skinview3d time to fetch + upload the texture and render.
  await page.waitForTimeout(2000);
}

async function generate({ mode, transparent }) {
  await page.click(`button:has-text("${mode === "run" ? "Run" : "Orbit"}")`);
  await page.click(
    `button:has-text("${transparent ? "Transparent" : "Solid"}")`
  );
  await page.click('button:has-text("Generate GIF")');
  await page.waitForFunction(
    () => {
      const img = document.querySelector('[data-testid="result-gif"]');
      return img && img.src.startsWith("blob:");
    },
    { timeout: 60000 }
  );
  const src = await page.$eval('[data-testid="result-gif"]', (el) => el.src);
  const bytes = await page.evaluate(async (u) => {
    const buf = await (await fetch(u)).arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, src);
  return analyzeGif(bytes);
}

try {
  // Note: don't use networkidle on the dev server — Vite's HMR websocket
  // stays open and prevents it from ever settling.
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  check("page loads", true, await page.title());

  // WebGL must actually be available, or skinview3d can't render.
  const webgl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
  check("WebGL available", webgl);

  // --- Skin without a cape ---
  await loadUser("Notch");
  check("loaded Notch", true);

  const runSolid = await generate({ mode: "run", transparent: false });
  check("run + solid → valid looping GIF", runSolid.valid && runSolid.looping, JSON.stringify(runSolid));

  const orbitSolid = await generate({ mode: "orbit", transparent: false });
  check("orbit + solid → valid looping GIF", orbitSolid.valid && orbitSolid.looping, JSON.stringify(orbitSolid));

  const runTransparent = await generate({ mode: "run", transparent: true });
  check(
    "run + transparent → valid GIF with transparency",
    runTransparent.valid && runTransparent.transparent,
    JSON.stringify(runTransparent)
  );

  // --- Skin with a cape (jeb_ owns the classic MineCon-era cape) ---
  await loadUser("jeb_");
  const hasCape = await page.$('[data-testid="cape-badge"]');
  check("jeb_ cape detected", !!hasCape);
  const capeOrbit = await generate({ mode: "orbit", transparent: false });
  check("cape orbit → valid GIF", capeOrbit.valid && capeOrbit.looping, JSON.stringify(capeOrbit));

  // Cap the implicit font wait so a slow webfont can't hang the capture.
  await page
    .evaluate(
      () =>
        Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 3000)),
        ])
    )
    .catch(() => {});
  await page.screenshot({
    path: "scripts/smoke-screenshot.png",
    animations: "disabled",
    timeout: 15000,
  });
  check("screenshot saved", true, "scripts/smoke-screenshot.png");

  check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | ").slice(0, 300));
} catch (e) {
  console.error("💥 smoke run threw:", e.message);
  failures++;
  if (consoleErrors.length) {
    console.error("   console errors:", consoleErrors.join(" | ").slice(0, 500));
  }
  try {
    await page.screenshot({
      path: "scripts/smoke-failure.png",
      animations: "disabled",
      timeout: 15000,
    });
    console.error("   saved scripts/smoke-failure.png");
  } catch {}
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
