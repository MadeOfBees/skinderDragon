import { useCallback, useEffect, useRef, useState } from "react";
import type { SkinViewer } from "skinview3d";
import { loadSkinview3d } from "../lib/skinview";
import {
  createPoseAnimation,
  applyLoopFrame,
  settleHeldPose,
  captureViewerGif,
  captureViewerPng,
  isAnimated,
  LOOP_SECONDS,
  type Pose,
  type CaptureOptions,
  type PoseAnimation,
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
  "background" | "size" | "frames" | "fps" | "onProgress" | "signal"
>;

/**
 * Wires the viewer to the selected pose + orbit toggle and returns the
 * {@link PoseAnimation} so the GIF capture can step the same frames by hand.
 */
async function applyPose(
  viewer: SkinViewer,
  pose: Pose,
  orbit: boolean,
  upsideDown: boolean
): Promise<PoseAnimation> {
  const sv = await loadSkinview3d();
  const poseAnim = createPoseAnimation(sv, pose);
  const animated = isAnimated(poseAnim, orbit);

  if (animated) {
    // Capture current wrapper angle so the orbit continues from where it was
    // instead of snapping back to the front on every toggle.
    const startY = viewer.playerWrapper.rotation.y;
    // FunctionAnimation.progress advances in real seconds; map to loop phase t ∈ [0,1).
    const driver = new sv.FunctionAnimation((_player, progress) => {
      applyLoopFrame(viewer, poseAnim, (progress / LOOP_SECONDS) % 1, { orbit, upsideDown });
      if (orbit) viewer.playerWrapper.rotation.y += startY;
    });
    viewer.animation = driver; // resets pose/progress
  } else if (poseAnim.held) {
    // A held pose with no orbit is a still image (the GIF emits a single frame).
    viewer.animation = poseAnim.held.anim; // resets pose/progress
  }

  // Settle a held pose AFTER assigning the animation (the assignment resets the
  // joints) but BEFORE pausing it — PlayerAnimation.update() early-returns while
  // paused, so settling a paused animation would be a silent no-op. This also
  // covers a held pose WITH orbit: that runs through the driver above, whose
  // per-frame applyLoopFrame only spins the wrapper and never re-poses the limbs,
  // so without this the crouch/fly would be lost and the player would orbit
  // standing upright. A no-op for cyclic poses.
  settleHeldPose(poseAnim, viewer.playerObject);

  // RunningAnimation sets basicCapeRotationX = π*0.3 (dramatic wind-blown effect).
  // Walk is a slow stride — pull the cape back down to near idle (π*0.06).
  if (pose === "walk") viewer.playerObject.cape.rotation.x = Math.PI * 0.18;
  if (pose === "fly") viewer.playerObject.position.y = 10;

  // Fly sets a non-zero x rotation; negate it so Rz(π) flips belly-up, not belly-down.
  // No-op for run/sneak/stand where rotation.x is 0.
  if (upsideDown) viewer.playerObject.rotation.x = -viewer.playerObject.rotation.x;

  // Freeze the settled pose so the live preview doesn't keep advancing it (an
  // un-paused CrouchAnimation would oscillate in and out of the crouch).
  if (!animated && poseAnim.held) poseAnim.held.anim.paused = true;

  // Dinnerbone/Grumm easter egg — flip the model. Set last because the animation
  // setter resets rotation.z to 0. For animated+upsideDown, applyLoopFrame also
  // re-asserts Math.PI each frame; the reset-to-0 branch is all that's needed for
  // non-flipped players, since nothing else in the animation pipeline touches rotation.z.
  viewer.playerObject.rotation.z = upsideDown ? Math.PI : 0;
  return poseAnim;
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
  pose: Pose,
  orbit: boolean,
  showNametag: boolean,
  upsideDown: boolean,
  paused: boolean
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const poseAnimRef = useRef<PoseAnimation | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resolves when the nametag's custom font is painted; reset to Promise.resolve() when off.
  const fontReadyRef = useRef<Promise<void>>(Promise.resolve());
  // Tracks the NameTagObject added directly to viewer.scene (bypassing viewer.nameTag
  // so draw()'s head-tracking never moves it).
  const nameTagObjRef = useRef<NonNullable<SkinViewer["nameTag"]> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    setReady(false);
    setError(null);
    poseAnimRef.current = null;
    fontReadyRef.current = Promise.resolve();
    if (!profile || !canvas) return;

    let cancelled = false;
    let activeViewer: SkinViewer | null = null;
    (async () => {
      try {
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
        activeViewer = viewer;
        viewer.controls.enablePan = false;
        viewerRef.current = viewer;

        await viewer.loadSkin(profile.skinUrl, {
          model: profile.slim ? "slim" : "default",
        });
        if (cancelled) return;

        if (profile.capeUrl) await viewer.loadCape(profile.capeUrl);
        if (cancelled) return;

        poseAnimRef.current = await applyPose(viewer, pose, orbit, upsideDown);
        if (!cancelled) setReady(true);
      } catch {
        activeViewer?.dispose();
        if (viewerRef.current === activeViewer) viewerRef.current = null;
        if (!cancelled) {
          setError("3D preview failed to load. Check that WebGL is enabled and try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      activeViewer?.dispose();
      if (viewerRef.current === activeViewer) viewerRef.current = null;
      nameTagObjRef.current = null; // scene is gone; nametag effect will re-add on rebuild
    };
    // Rebuild on profile change only; mode/orbit/flip are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cancelled = false;
    setReady(false);
    setError(null);
    poseAnimRef.current = null;
    void applyPose(viewer, pose, orbit, upsideDown)
      .then((ma) => {
        if (!cancelled) {
          poseAnimRef.current = ma;
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("3D preview failed to update. Try reloading the player.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pose, orbit, upsideDown]);

  // Render the GIF from the live viewer itself. orbit/flip come from the hook's
  // current state; everything else (skin, cape, nametag, camera) is whatever the
  // preview is showing right now.
  const captureRender = useCallback(
    async (req: CaptureRequest): Promise<Blob> => {
      const viewer = viewerRef.current;
      const poseAnim = poseAnimRef.current;
      if (!viewer || !poseAnim || !ready) {
        throw new Error("Preview is not ready yet.");
      }
      await fontReadyRef.current; // ensure nametag font is painted before first frame
      const capture = orbit ? captureViewerGif : captureViewerPng;
      return capture(viewer, poseAnim, { ...req, orbit, upsideDown });
    },
    [orbit, ready, upsideDown]
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

  return { canvasRef, captureRender, ready, error };
}
