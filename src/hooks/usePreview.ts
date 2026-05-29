import { useEffect, useRef } from "react";
import type { SkinViewer } from "skinview3d";
import { loadSkinview3d } from "../lib/skinview";
import { FROZEN_PROGRESS, type AnimationMode } from "../lib/exportGif";
import type { MinecraftProfile } from "../lib/profile";

/** Point the preview viewer at the selected animation mode. */
async function applyMode(
  viewer: SkinViewer,
  mode: AnimationMode,
  upsideDown: boolean
) {
  const sv = await loadSkinview3d();
  viewer.autoRotate = mode === "orbit";

  switch (mode) {
    case "wave":
      viewer.animation = new sv.WaveAnimation();
      break;
    case "sneak":
      viewer.animation = new sv.CrouchAnimation();
      break;
    case "fly":
      viewer.animation = new sv.FlyingAnimation();
      break;
    case "orbit":
    case "run":
    default: {
      const anim = new sv.WalkingAnimation();
      anim.headBobbing = mode === "run";
      viewer.animation = anim;
      if (mode === "orbit") {
        // Freeze mid-stride, then let autoRotate spin the frozen pose.
        anim.progress = FROZEN_PROGRESS;
        anim.update(viewer.playerObject, 0);
        anim.paused = true;
      }
    }
  }

  // Dinnerbone/Grumm easter egg — flip the model. None of the animations above
  // touch rotation.z, so setting it once holds across the animation loop.
  viewer.playerObject.rotation.z = upsideDown ? Math.PI : 0;
}

/**
 * Drives a live, draggable skinview3d preview with a floating nametag. Returns a
 * ref for the target canvas; the viewer is rebuilt when the profile changes and
 * retargeted when the mode changes.
 */
export function usePreview(
  profile: MinecraftProfile | null,
  mode: AnimationMode,
  upsideDown: boolean
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
      const viewer = new sv.SkinViewer({ canvas, width: 340, height: 340, zoom: 0.85, fov: 45 });
      viewer.controls.enablePan = false;
      viewerRef.current = viewer;

      await viewer.loadSkin(profile.skinUrl, {
        model: profile.slim ? "slim" : "default",
      });
      if (profile.capeUrl) await viewer.loadCape(profile.capeUrl);
      // Floating nametag above the player, in the app's pixel font.
      viewer.nameTag = new sv.NameTagObject(profile.username, {
        font: "48px Monocraft",
        repaintAfterLoaded: true,
      });
      if (!cancelled) await applyMode(viewer, mode, upsideDown);
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
    // Rebuild on profile change only; mode/flip are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (viewerRef.current) void applyMode(viewerRef.current, mode, upsideDown);
  }, [mode, upsideDown]);

  return canvasRef;
}
