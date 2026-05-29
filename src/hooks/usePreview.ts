import { useEffect, useRef } from "react";
import type { SkinViewer } from "skinview3d";
import { loadSkinview3d } from "../lib/skinview";
import { createModeAnimation, type AnimationMode } from "../lib/exportGif";
import type { MinecraftProfile } from "../lib/profile";

// Pulled back from the old 0.85 so the floating name tag has headroom above the
// player instead of being cropped by the top of the canvas.
const PREVIEW_ZOOM = 0.6;

/**
 * Point the preview viewer at the selected animation + orbit toggle.
 *
 * Orbit is independent of the mode: it just spins the player (autoRotate), so it
 * can be mixed with the walk cycle or layered onto a held sneak/fly pose.
 */
async function applyMode(
  viewer: SkinViewer,
  mode: AnimationMode,
  orbit: boolean,
  upsideDown: boolean
) {
  const sv = await loadSkinview3d();
  viewer.autoRotate = orbit;

  // Same mode→animation mapping as the GIF exporter (single source of truth).
  const { anim, cyclic, pose } = createModeAnimation(sv, mode, { headBobbing: true });
  viewer.animation = anim; // assignment resets pose/progress
  if (!cyclic) {
    // Settle a held pose (sneak/fly) and freeze it; cyclic run just plays live.
    anim.progress = pose;
    anim.update(viewer.playerObject, 0);
    anim.paused = true;
  }

  // Dinnerbone/Grumm easter egg — flip the model. The animation setter resets
  // rotation to 0, so this must come last. None of the animations above touch
  // rotation.z, so setting it once holds across the animation loop.
  viewer.playerObject.rotation.z = upsideDown ? Math.PI : 0;
}

/**
 * Drives a live, draggable skinview3d preview with an optional floating nametag.
 * Returns a ref for the target canvas; the viewer is rebuilt when the profile
 * changes and retargeted when the mode / orbit / nametag toggles change.
 */
export function usePreview(
  profile: MinecraftProfile | null,
  mode: AnimationMode,
  orbit: boolean,
  showNametag: boolean,
  upsideDown: boolean,
  paused: boolean
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!profile || !canvas) return;

    let cancelled = false;
    (async () => {
      const sv = await loadSkinview3d();
      if (cancelled) return;
      const viewer = new sv.SkinViewer({
        canvas,
        width: 340,
        height: 340,
        zoom: PREVIEW_ZOOM,
        fov: 45,
      });
      viewer.controls.enablePan = false;
      viewerRef.current = viewer;

      await viewer.loadSkin(profile.skinUrl, {
        model: profile.slim ? "slim" : "default",
      });
      if (profile.capeUrl) await viewer.loadCape(profile.capeUrl);
      if (!cancelled) await applyMode(viewer, mode, orbit, upsideDown);
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
    // Rebuild on profile change only; mode/orbit/flip are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (viewerRef.current) void applyMode(viewerRef.current, mode, orbit, upsideDown);
  }, [mode, orbit, upsideDown]);

  // Pause the live preview's render loop during GIF export, so it doesn't
  // contend with the (offscreen) export renderer for the GPU — same reason the
  // panorama pauses. skinview3d's `renderPaused` stops its requestAnimationFrame.
  useEffect(() => {
    if (viewerRef.current) viewerRef.current.renderPaused = paused;
  }, [paused]);

  // Toggle the floating nametag without rebuilding the viewer. The string
  // setter would use skinview3d's bundled font; we build the object explicitly
  // so it matches the app's Monocraft pixel font.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sv = await loadSkinview3d();
      const viewer = viewerRef.current;
      if (cancelled || !viewer || !profile) return;
      viewer.nameTag = showNametag
        ? new sv.NameTagObject(profile.username, {
            font: "48px Monocraft",
            repaintAfterLoaded: true,
          })
        : null;
    })();
    return () => {
      cancelled = true;
    };
  }, [showNametag, profile]);

  return canvasRef;
}
