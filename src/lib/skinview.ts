// skinview3d pulls in three.js (~the bulk of the bundle). Load it lazily so the
// panorama + form paint immediately; the cached promise is shared by the live
// preview and the GIF exporter.
let modPromise: Promise<typeof import("skinview3d")> | null = null;

export function loadSkinview3d() {
  return (modPromise ??= import("skinview3d"));
}
