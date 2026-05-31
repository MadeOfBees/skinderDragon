// Persists user-level app settings (the kind exposed in the Settings panel) to
// localStorage, mirroring the best-effort try/catch style of favicon.ts so a
// disabled storage (private mode) just falls back to defaults.

import type { PanoramaSource } from "../components/Panorama";
import type { Edition } from "./providers";

const KEY_PANORAMA = "skinderdragon:panoramaSource";
const KEY_EDITION = "skinderdragon:edition";

/** The stored title-screen panorama channel, defaulting to the release build. */
export function loadPanoramaSource(): PanoramaSource {
  try {
    return localStorage.getItem(KEY_PANORAMA) === "snapshot"
      ? "snapshot"
      : "release";
  } catch {
    return "release";
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

/** The stored Minecraft edition for player lookup, defaulting to Java. */
export function loadEdition(): Edition {
  try {
    return localStorage.getItem(KEY_EDITION) === "bedrock" ? "bedrock" : "java";
  } catch {
    return "java";
  }
}

/** Remembers the chosen edition for next visit. */
export function saveEdition(edition: Edition): void {
  try {
    localStorage.setItem(KEY_EDITION, edition);
  } catch {
    /* best-effort */
  }
}
