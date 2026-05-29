// Persists user-level app settings (the kind exposed in the Settings panel) to
// localStorage, mirroring the best-effort try/catch style of favicon.ts so a
// disabled storage (private mode) just falls back to defaults.

import type { PanoramaSource } from "../components/Panorama";

const KEY_PANORAMA = "skinderdragon:panoramaSource";

/** The stored title-screen panorama channel, defaulting to the release build. */
export function loadPanoramaSource(): PanoramaSource {
  try {
    return localStorage.getItem(KEY_PANORAMA) === "snapshot"
      ? "snapshot"
      : "release";
  } catch {
    return "release"; // storage disabled — use the default
  }
}

/** Remembers the chosen panorama channel for next visit. */
export function savePanoramaSource(source: PanoramaSource): void {
  try {
    localStorage.setItem(KEY_PANORAMA, source);
  } catch {
    /* best-effort */
  }
}
