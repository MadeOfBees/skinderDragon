// Headless smoke test for skinderdragon.
//
// Drives the REAL UI end-to-end — real skin lookup (playerdb → Mojang CDN) plus
// the browser WebGL render + gifenc encode pipeline — and validates the emitted
// bytes are genuine looping GIFs. This is the one path that can't run in jsdom,
// and it deliberately exercises the live network so a broken provider/CDN/CORS
// path is caught (the pure decoding logic is also unit-tested in providers.test).
//
// It's kept fast by: rendering tiny GIFs (the size/frames URL knobs below),
// emulating reduced-motion so the decorative panorama paints one static frame
// instead of an endless software-WebGL loop, and a trimmed set of scenarios.
import { chromium } from "playwright";
import { analyzeGif } from "./analyze-gif.mjs";

const BASE_URL = process.env.SMOKE_URL ?? "http://localhost:5173/";
// Render tiny GIFs (8 frames @ 256px) instead of the 30×512 default so the
// software-WebGL render — the run's bottleneck — finishes quickly. The encode/
// validity paths are identical; only the pixel/frame counts shrink.
const URL = `${BASE_URL}${BASE_URL.includes("?") ? "&" : "?"}gifSize=256&gifFrames=8`;

// Renderer selection. We prefer the real GPU (fast — e.g. ANGLE/Metal on macOS)
// but fall back to CPU software rendering (SwiftShader) when no usable GPU is
// present, e.g. on headless CI runners. Override with SMOKE_RENDERER=gpu|cpu;
// the default is `auto` (use the GPU only if a hardware renderer actually
// engages). CPU is always the safe fallback.
const CPU_ARGS = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--no-sandbox",
];
const GPU_ARGS = ["--use-gl=angle", "--ignore-gpu-blocklist", "--no-sandbox"];
// Renderer strings that mean "this is actually software, not a GPU".
const SOFTWARE_RE = /swiftshader|llvmpipe|software|mesa offscreen|disabled/i;

/** Read the live WebGL renderer string from a throwaway page, or null. */
async function readRenderer(b) {
  const p = await b.newPage();
  const r = await p.evaluate(() => {
    try {
      const gl =
        document.createElement("canvas").getContext("webgl2") ||
        document.createElement("canvas").getContext("webgl");
      if (!gl) return null;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return String(
        ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      );
    } catch {
      return null;
    }
  });
  await p.close();
  return r;
}

/** Launch Chromium with the GPU when it can, else CPU. Returns {browser, label}. */
async function launchBrowser() {
  const mode = (process.env.SMOKE_RENDERER || "auto").toLowerCase();
  if (mode === "cpu") {
    return { browser: await chromium.launch({ args: CPU_ARGS }), label: "CPU (SwiftShader, forced)" };
  }
  if (mode === "gpu") {
    const browser = await chromium.launch({ args: GPU_ARGS });
    return { browser, label: `GPU (forced): ${await readRenderer(browser)}` };
  }
  // auto: try the GPU and keep it only if a real hardware renderer engaged.
  const gpu = await chromium.launch({ args: GPU_ARGS });
  const renderer = await readRenderer(gpu);
  if (renderer && !SOFTWARE_RE.test(renderer)) {
    return { browser: gpu, label: `GPU: ${renderer}` };
  }
  await gpu.close();
  return { browser: await chromium.launch({ args: CPU_ARGS }), label: "CPU (SwiftShader, fallback)" };
}

const { browser, label: rendererLabel } = await launchBrowser();
console.log(`🖥  renderer: ${rendererLabel}`);

const page = await browser.newPage({
  viewport: { width: 1120, height: 1040 },
  // The panorama honors prefers-reduced-motion by painting one static frame
  // instead of an endless full-viewport software-WebGL loop — which otherwise
  // pegs every core and starves the actual test work.
  reducedMotion: "reduce",
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

async function loadUser(name) {
  await page.fill('input[type="text"]', "");
  await page.fill('input[type="text"]', name);
  await page.click('button[type="submit"]');
  // Wait for either the player name to show or an error.
  await page
    .locator('[data-testid="player-name"], [data-testid="error"]')
    .first()
    .waitFor({ state: "visible", timeout: 25000 });
  const err = await page.$('[data-testid="error"]');
  if (err) throw new Error("UI error: " + (await err.textContent()));
  // Give skinview3d time to fetch the real texture from Mojang's CDN, upload it,
  // and render before we start capturing frames.
  await page.waitForTimeout(2000);
}

// Orbit / Nametag are toggle buttons (aria-pressed); set them deterministically.
async function setToggle(name, on) {
  const btn = page.locator(`button[aria-pressed]:has-text("${name}")`).first();
  const pressed = (await btn.getAttribute("aria-pressed")) === "true";
  if (pressed !== on) await btn.click();
}

async function generate({ mode = "run", orbit = false, transparent }) {
  // Animation modes are mutually exclusive buttons (Run / Sneak / Fly).
  const label = { run: "Run", sneak: "Sneak", fly: "Fly" }[mode];
  await page.click(`button:has-text("${label}")`);
  await setToggle("Orbit", orbit);
  await page.click(`button:has-text("${transparent ? "Transparent" : "Solid"}")`);
  await page.click('button:has-text("Generate GIF")');
  await page.waitForFunction(
    () => {
      const img = document.querySelector('[data-testid="result-gif"]');
      return img && img.src.startsWith("blob:");
    },
    { timeout: 45000 }
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

  // --- Skin without a cape: cover the cyclic, transparent, and held-pose paths.
  await loadUser("EthosLab");
  check("loaded EthosLab", true);

  const runSolid = await generate({ mode: "run", transparent: false });
  check("run + solid → valid looping GIF", runSolid.valid && runSolid.looping, JSON.stringify(runSolid));

  const runTransparent = await generate({ mode: "run", transparent: true });
  check(
    "run + transparent → valid GIF with transparency",
    runTransparent.valid && runTransparent.transparent,
    JSON.stringify(runTransparent)
  );

  // Sneak is a held pose → a cheap single-frame GIF (exercises the non-cyclic path).
  const sneak = await generate({ mode: "sneak", orbit: false, transparent: false });
  check("sneak (held pose) → valid GIF", sneak.valid, JSON.stringify(sneak));

  // --- Skin with a cape: cover cape load + orbit.
  await loadUser("jeb_");
  check("jeb_ cape detected", !!(await page.$('[data-testid="cape-badge"]')));

  const capeOrbit = await generate({ mode: "run", orbit: true, transparent: false });
  check("cape + orbit → valid looping GIF", capeOrbit.valid && capeOrbit.looping, JSON.stringify(capeOrbit));

  // Cap the implicit font wait so a slow webfont can't hang the capture.
  await page
    .evaluate(() =>
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2000))])
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
    await page.screenshot({ path: "scripts/smoke-failure.png", animations: "disabled", timeout: 15000 });
    console.error("   saved scripts/smoke-failure.png");
  } catch {}
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
