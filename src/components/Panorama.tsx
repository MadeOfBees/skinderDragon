import { useEffect, useRef } from "react";

export type PanoramaSource = "release" | "snapshot";

// Panorama faces live in public/panorama/<channel>/ — served as static files,
// not bundled. Run `npm run assets:refresh` to download them from Mojang's CDN.
// `npm run dev` (via assets:ensure), `npm run smoke`, and the Pages deploy all
// fetch them automatically; without the files the panorama silently 404s.
// BASE_URL is "/" in dev and "/skinderdragon/" in production (see vite.config.ts).
const base = import.meta.env.BASE_URL;
// The six faces of Minecraft's title panorama, in the game's own numbering:
//   0 → ahead   1 → right   2 → behind   3 → left   4 → up (sky)   5 → down (ground)
const FACES: Record<PanoramaSource, string[]> = {
  release: Array.from({ length: 6 }, (_, i) => `${base}panorama/release/panorama_${i}.webp`),
  snapshot: Array.from({ length: 6 }, (_, i) => `${base}panorama/snapshot/panorama_${i}.webp`),
};

const ROTATE_SPEED = 0.018; // radians/sec — a slow, menu-like drift
const PITCH = -0.06; // tilt the horizon down a touch, like the real menu

/**
 * How Minecraft's title panorama is authored — and how we reproduce it.
 *
 * The six PNGs are the faces of a cube the game views from the inside. Per the
 * Minecraft Wiki's "Making custom panoramas" the authoring convention is:
 *   • 0,1,2,3 are the horizontal ring, left→right — i.e. as you turn *right*,
 *     face N's RIGHT edge continues into face N+1's LEFT edge (…3 wraps to 0);
 *   • 4 is the top (sky): its BOTTOM edge borders the TOP of face 0;
 *   • 5 is the bottom (ground): its TOP edge borders the BOTTOM of face 0.
 *
 * We render it with six inward-facing planes, one per face. A three.js plane
 * faces +Z, so a plane pushed to local z = -1 sits one unit *ahead* of the
 * camera (which looks down -Z) and shows its front to us — that's face 0, with
 * its texture upright and un-mirrored (we view the plane's front, so there's no
 * BackSide UV mirroring to undo, unlike the old single-box skybox). Each face's
 * plane is parented to a pivot Group whose rotation swings it onto a cube wall.
 *
 * Choosing the pivot rotations: a *positive* Y rotation in three.js turns the
 * view LEFT, but the faces are authored for turning RIGHT, so faces 1 and 3 get
 * NEGATIVE/positive 90° (the mirror image of the angles you'd transcribe from
 * Minecraft's own matrix code, whose camera handedness differs). The exact signs
 * here were nailed down empirically by pixel-matching adjacent face edges on the
 * real textures: with these values every neighbour matches (edge MSE ~3–270),
 * and the +90°/-90° X pivots land the sky/ground caps in the orientation the
 * Wiki describes (face 4 bottom→face 0 top, etc.). Get the horizon signs wrong
 * and adjacent edges mismatch by MSE ~6000+, which is the hard vertical seam
 * between panels this code originally shipped with.
 *
 * three.js is imported lazily (it's the bulk of the bundle, shared with the
 * skin viewer) so the title and form paint before the background spins up. The
 * canvas is blurred/darkened via CSS so it reads as ambient background.
 */
export function Panorama({
  paused = false,
  source = "release",
}: {
  paused?: boolean;
  source?: PanoramaSource;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Kept in refs so the running render loop sees changes without re-running the
  // setup effect. We pause the background during GIF export so it doesn't
  // contend with the (offscreen) export renderer for the GPU.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sourceRef = useRef(source);

  // Swapping channels without tearing down the whole renderer: when `source`
  // changes we re-point the six face textures (see the loadFaces ref below).
  const reloadFacesRef = useRef<((src: PanoramaSource) => void) | null>(null);
  useEffect(() => {
    sourceRef.current = source;
    reloadFacesRef.current?.(source);
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed || !canvas) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      } catch {
        return; // No WebGL — the CSS background colour shows through.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(78, 1, 0.1, 100);
      camera.rotation.order = "YXZ";
      camera.rotation.x = PITCH;

      const loader = new THREE.TextureLoader();

      // Per-face pivot rotations. Each face's plane sits one unit ahead (local
      // z = -1) of its pivot; the pivot rotation swings it onto a cube wall.
      //
      // The horizon faces 0→1→2→3 form a continuous ring, and the captures are
      // authored so that face N's RIGHT edge continues into face N+1's LEFT
      // edge (the camera turns *right* as N increases). In three.js's frame a
      // positive Y rotation turns the view left, so to keep that right-turning
      // order we rotate faces 1 and 3 by NEGATIVE/positive-90 respectively —
      // i.e. the opposite sign you'd naively copy from Minecraft's matrix code.
      // This was verified by pixel-matching adjacent face edges: with these
      // signs neighbouring edges match (MSE ~200); with them flipped they don't
      // (MSE ~6000+), which showed up as a hard seam at every panel boundary.
      const HALF = Math.PI / 2;
      const PIVOTS: Array<{ x: number; y: number }> = [
        { x: 0, y: 0 }, // 0 ahead  (-Z wall)
        { x: 0, y: -HALF }, // 1 right  (+X wall)
        { x: 0, y: Math.PI }, // 2 behind (+Z wall)
        { x: 0, y: HALF }, // 3 left   (-X wall)
        { x: HALF, y: 0 }, // 4 up (sky)
        { x: -HALF, y: 0 }, // 5 down (ground)
      ];

      // One shared plane geometry for all six faces. Sized 2×2 to exactly span a
      // face of the unit cube (z = -1, edges at ±1); scaled up a hair so the
      // quads overlap slightly at the cube edges and never show a hairline seam.
      const geometry = new THREE.PlaneGeometry(2, 2);
      const materials: import("three").MeshBasicMaterial[] = [];
      const textures: import("three").Texture[] = [];

      /** Loads the six faces for a channel into the (re-usable) materials. */
      function loadFaces(src: PanoramaSource) {
        FACES[src].forEach((url, i) => {
          const tex = loader.load(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          // Clamp so the slight oversize at the edges samples the edge pixel
          // rather than wrapping the opposite side of the face in.
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          if (materials[i]) {
            const old = materials[i].map;
            materials[i].map = tex;
            materials[i].needsUpdate = true;
            old?.dispose();
            textures[i] = tex;
          } else {
            materials[i] = new THREE.MeshBasicMaterial({ map: tex });
            textures[i] = tex;
          }
        });
      }
      loadFaces(sourceRef.current);
      reloadFacesRef.current = loadFaces;

      // Build the six pivots, each holding one inward-facing plane at z = -1.
      PIVOTS.forEach((rot, i) => {
        const pivot = new THREE.Group();
        pivot.rotation.set(rot.x, rot.y, 0);
        const plane = new THREE.Mesh(geometry, materials[i]);
        plane.position.z = -1;
        plane.scale.set(1.01, 1.01, 1.01); // kill hairline edge seams
        pivot.add(plane);
        scene.add(pivot);
      });

      function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener("resize", resize);

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      let raf = 0;
      let last = performance.now();
      let yaw = 0;

      function frame(now: number) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        // While paused (e.g. during GIF export) keep the loop alive but skip the
        // GPU work, so the offscreen export renderer isn't starved.
        if (!pausedRef.current) {
          yaw += dt * ROTATE_SPEED;
          camera.rotation.y = yaw;
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(frame);
      }

      if (reduceMotion) {
        renderer.render(scene, camera); // paint a single static frame
      } else {
        raf = requestAnimationFrame(frame);
      }

      // Pause the loop when the tab is hidden to save battery.
      function onVisibility() {
        if (document.hidden) {
          cancelAnimationFrame(raf);
          raf = 0;
        } else if (!raf && !reduceMotion) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      }
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibility);
        reloadFacesRef.current = null;
        geometry.dispose();
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className="panorama" aria-hidden="true">
      <canvas ref={canvasRef} className="panorama-canvas" />
    </div>
  );
}
