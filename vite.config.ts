/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// For GitHub Pages project sites the app is served from /<repo>/.
// Override at build time with: VITE_BASE=/your-repo/ npm run build
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base:
    process.env.VITE_BASE ??
    (mode === "production" ? "/skinderdragon/" : "/"),
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
