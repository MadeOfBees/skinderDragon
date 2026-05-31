import { useCallback, useEffect, useRef } from "react";
import type { SkinViewer } from "skinview3d";
import { loadSkinview3d } from "../lib/skinview";
import {
  createModeAnimation,
  applyLoopFrame,
  settleHeldPose,
  captureViewerGif,
  isAnimated,
  LOOP_SECONDS,
  type AnimationMode,
  type CaptureOptions,
  type ModeAnimation,
} from "../lib/exportGif";
import type { MinecraftProfile } from "../lib/profile";

// Pulled back from the old 0.85 so the floating name tag has headroom above the
// player instead of being cropped by the top of the canvas.
const PREVIEW_ZOOM = 0.6;

// Fixed world Y for the nametag. The model tops out at y≈16 in both the normal
// orientation (head hat) and the upside-down orientation (feet, which become the
// visual top when rotation.z=π). Placing the tag at 20 gives 4 units of clearance
// either way, matching what viewer.render() sees in the GIF capture path.
const NAMETAG_Y = 20;

/** The bits of a capture the preview can't infer from its own live state. */
export type CaptureRequest = Pick<
  CaptureOptions,
  "background" | "size" | "frames" | "fps" | "onProgress"
>;

/**
 * Wires the viewer to the selected animation + orbit toggle and returns the
 * {@link ModeAnimation} so the GIF capture can step the same frames by hand.
 */
async function applyMode(
  viewer: SkinViewer,
  mode: AnimationMode,
  orbit: boolean,
  upsideDown: boolean
): Promise<ModeAnimation> {
  const sv = await loadSkinview3d();
  const modeAnim = createModeAnimation(sv, mode);
  const animated = isAnimated(modeAnim, orbit);

  if (animated) {
    // FunctionAnimation.progress advances in real seconds; map to loop phase t ∈ [0,1).
    const driver = new sv.FunctionAnimation((_player, progress) => {
      applyLoopFrame(viewer, modeAnim, (progress / LOOP_SECONDS) % 1, { orbit, upsideDown });
    });
    viewer.animation = driver; // resets pose/progress
  } else if (modeAnim.held) {
    // A held pose with no orbit is a still image (the GIF emits a single frame).
    viewer.animation = modeAnim.held.anim; // resets pose/progress
  }

  // Settle a held pose AFTER assigning the animation (the assignment resets the
  // joints) but BEFORE pausing it — PlayerAnimation.update() early-returns while
  // paused, so settling a paused animation would be a silent no-op. This also
  // covers a held pose WITH orbit: that runs through the driver above, whose
  // per-frame applyLoopFrame only spins the wrapper and never re-poses the limbs,
  // so without this the crouch/fly would be lost and the player would orbit
  // standing upright. A no-op for cyclic modes.
  settleHeldPose(modeAnim, viewer.playerObject);

  // Fly sets a non-zero x rotation; negate it so Rz(π) flips belly-up, not belly-down.
  // No-op for run/sneak where rotation.x is 0.
  if (upsideDown) viewer.playerObject.rotation.x = -viewer.playerObject.rotation.x;

  // Freeze the settled pose so the live preview doesn't keep advancing it (an
  // un-paused CrouchAnimation would oscillate in and out of the crouch).
  if (!animated && modeAnim.held) modeAnim.held.anim.paused = true;

  // Orbit leaves the wrapper turned; clear it when orbit is off so a held pose
  // faces front again.
  if (!orbit) viewer.playerWrapper.rotation.y = 0;

  // Dinnerbone/Grumm easter egg — flip the model. Set last because the animation
  // setter resets rotation.z to 0. For animated+upsideDown, applyLoopFrame also
  // re-asserts Math.PI each frame; the reset-to-0 branch is all that's needed for
  // non-flipped players, since nothing else in the animation pipeline touches rotation.z.
  viewer.playerObject.rotation.z = upsideDown ? Math.PI : 0;
  return modeAnim;
}

/**
 * Drives a live, draggable skinview3d preview with an optional floating nametag,
 * and exposes a `captureGif` that renders the GIF straight from this same viewer
 * (see {@link captureViewerGif}) — what you see is exactly what you download.
 *
 * Returns a ref for the target canvas plus `captureGif`; the viewer is rebuilt
 * when the profile changes and retargeted when the mode / orbit / nametag
 * toggles change.
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
  const modeAnimRef = useRef<ModeAnimation | null>(null);
  // Resolves when the nametag's custom font is painted; reset to Promise.resolve() when off.
  const fontReadyRef = useRef<Promise<void>>(Promise.resolve());
  // Tracks the NameTagObject added directly to viewer.scene (bypassing viewer.nameTag
  // so draw()'s head-tracking never moves it).
  const nameTagObjRef = useRef<NonNullable<SkinViewer["nameTag"]> | null>(null);

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
        // The GIF is captured from this canvas, so its buffer must survive the
        // read-back (see captureViewerGif).
        preserveDrawingBuffer: true,
      });
      viewer.controls.enablePan = false;
      viewerRef.current = viewer;

      await viewer.loadSkin(profile.skinUrl, {
        model: profile.slim ? "slim" : "default",
      });
      if (profile.capeUrl) await viewer.loadCape(profile.capeUrl);
      if (!cancelled) modeAnimRef.current = await applyMode(viewer, mode, orbit, upsideDown);
    })();

    return () => {
      cancelled = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
      nameTagObjRef.current = null; // scene is gone; nametag effect will re-add on rebuild
    };
    // Rebuild on profile change only; mode/orbit/flip are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;
    void applyMode(viewer, mode, orbit, upsideDown).then((ma) => {
      if (!cancelled) modeAnimRef.current = ma;
    });
    return () => {
      cancelled = true;
    };
  }, [mode, orbit, upsideDown]);

  // Render the GIF from the live viewer itself. orbit/flip come from the hook's
  // current state; everything else (skin, cape, nametag, camera) is whatever the
  // preview is showing right now.
  const captureGif = useCallback(
    async (req: CaptureRequest): Promise<Blob> => {
      const viewer = viewerRef.current;
      const modeAnim = modeAnimRef.current;
      if (!viewer || !modeAnim) {
        throw new Error("Preview is not ready yet.");
      }
      await fontReadyRef.current; // ensure nametag font is painted before first frame
      return captureViewerGif(viewer, modeAnim, { ...req, orbit, upsideDown });
    },
    [orbit, upsideDown]
  );

  // Pause the live render loop during GIF export so the capture drives frames exclusively.
  useEffect(() => {
    if (viewerRef.current) viewerRef.current.renderPaused = paused;
  }, [paused]);

  // Toggle the floating nametag without rebuilding the viewer. Add the tag
  // directly to viewer.scene (bypassing the viewer.nameTag setter) so draw()'s
  // head-tracking formula never fires on it — the tag stays at NAMETAG_Y every
  // frame, both in the live preview and in the GIF (which calls viewer.render()
  // directly, never draw()).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sv = await loadSkinview3d();
      const viewer = viewerRef.current;
      if (cancelled || !viewer || !profile) return;
      if (nameTagObjRef.current) {
        viewer.scene.remove(nameTagObjRef.current);
        nameTagObjRef.current = null;
        fontReadyRef.current = Promise.resolve();
      }
      if (showNametag) {
        const tag = new sv.NameTagObject(profile.username, {
          font: "48px Monocraft",
          repaintAfterLoaded: true,
        });
        // Upside-down: the visual top is the feet (world y≈16), which have no
        // hat-layer extension. Bring the tag down slightly to match the clearance
        // of the normal case (head hat at y≈16.5, nametag at NAMETAG_Y=20).
        tag.position.y = upsideDown ? NAMETAG_Y - 2 : NAMETAG_Y;
        viewer.scene.add(tag);
        nameTagObjRef.current = tag;
        fontReadyRef.current = tag.painted.then(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showNametag, profile, upsideDown]);

  return { canvasRef, captureGif };
}
