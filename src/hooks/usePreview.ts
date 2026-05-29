import { useEffect, useRef } from "react";
import type { SkinViewer } from "skinview3d";
import { loadSkinview3d } from "../lib/skinview";
import { FROZEN_PROGRESS, type AnimationMode } from "../lib/exportGif";
import type { MinecraftProfile } from "../lib/profile";

/** Point the preview viewer at the selected animation mode. */
async function applyMode(viewer: SkinViewer, mode: AnimationMode) {
  const { WalkingAnimation } = await loadSkinview3d();
  viewer.autoRotate = mode === "orbit";
  const anim = new WalkingAnimation();
  anim.headBobbing = mode === "run";
  viewer.animation = anim;
  if (mode === "orbit") {
    // Freeze mid-stride, then let autoRotate spin the frozen pose.
    anim.progress = FROZEN_PROGRESS;
    anim.update(viewer.playerObject, 0);
    anim.paused = true;
  }
}

/**
 * Drives a live, draggable skinview3d preview. Returns a ref for the target
 * canvas; the viewer is rebuilt when the profile changes and retargeted when
 * the mode changes.
 */
export function usePreview(profile: MinecraftProfile | null, mode: AnimationMode) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!profile || !canvas) return;

    let cancelled = false;
    (async () => {
      const { SkinViewer } = await loadSkinview3d();
      if (cancelled) return;
      const viewer = new SkinViewer({ canvas, width: 340, height: 340, zoom: 0.85, fov: 45 });
      viewer.controls.enablePan = false;
      viewerRef.current = viewer;

      await viewer.loadSkin(profile.skinUrl, {
        model: profile.slim ? "slim" : "default",
      });
      if (profile.capeUrl) await viewer.loadCape(profile.capeUrl);
      if (!cancelled) await applyMode(viewer, mode);
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
    // Rebuild on profile change only; mode is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (viewerRef.current) void applyMode(viewerRef.current, mode);
  }, [mode]);

  return canvasRef;
}
