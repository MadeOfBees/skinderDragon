// Turnkey local smoke test — run this on demand when you've touched the WebGL /
// GIF / panorama code:
//
//   npm run smoke
//
// It builds the app, serves the production build, runs the headless browser
// smoke (scripts/smoke.mjs) against it, then tears the server down. No need to
// have a dev server already running. (CI only runs the fast checks; the browser
// smoke lives here because it needs live skin lookups + software WebGL.)

import { spawn } from "node:child_process";

const PORT = process.env.SMOKE_PORT ?? "4173";
const URL = `http://127.0.0.1:${PORT}/`;

/** Run a command to completion, inheriting stdio; reject on non-zero exit. */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → exit ${code}`))
    );
  });
}

/** Poll until the preview server answers, or give up. */
async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Preview server at ${url} never came up`);
}

let server;
const stopServer = () => {
  if (server && !server.killed) server.kill();
};
process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

try {
  await run("npm", ["run", "assets:refresh"]);
  await run("npm", ["run", "build"]);

  server = spawn("npx", ["vite", "preview", "--port", PORT, "--host", "127.0.0.1"], {
    stdio: "ignore",
  });
  server.on("error", (e) => {
    console.error("Failed to start preview server:", e.message);
    process.exit(1);
  });

  await waitForServer(URL);
  await run("node", ["scripts/smoke.mjs"], {
    env: { ...process.env, SMOKE_URL: URL },
  });
} catch (err) {
  console.error("\n❌", err.message);
  process.exitCode = 1;
} finally {
  stopServer();
}
