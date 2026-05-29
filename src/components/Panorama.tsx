import { useEffect, useRef } from "react";
import p0 from "../assets/panorama/panorama_0.webp";
import p1 from "../assets/panorama/panorama_1.webp";
import p2 from "../assets/panorama/panorama_2.webp";
import p3 from "../assets/panorama/panorama_3.webp";
import p4 from "../assets/panorama/panorama_4.webp";
import p5 from "../assets/panorama/panorama_5.webp";

// The six cube faces of Minecraft's title panorama: 0-3 wrap around the horizon
// (left→right), 4 is the sky (up) and 5 is the ground (down).
const PANORAMA = [p0, p1, p2, p3, p4, p5];

// three.js BoxGeometry material slots are ordered [+X, -X, +Y, -Y, +Z, -Z].
// We sit the camera inside the box and map each slot to the matching panorama
// face so the four horizon images stay adjacent (no seams) and 4/5 cap the
// top/bottom — exactly how the game projects it.
const SLOT_TO_FACE = [1, 3, 4, 5, 0, 2];

const ROTATE_SPEED = 0.018; // radians/sec — a slow, menu-like drift
const PITCH = -0.06; // tilt the horizon down a touch, like the real menu

/**
 * The rotating title-screen panorama, rendered the way Minecraft does it: a
 * cubemap skybox viewed from the inside with the camera slowly panning. Replaces
 * the old flat-strip hack (which warped the cube faces and showed seams).
 *
 * three.js is imported lazily (it's the bulk of the bundle and shared with the
 * skin viewer) so the title and form paint before the background spins up. The
 * canvas is blurred/darkened via CSS so it reads as ambient background.
 */
export function Panorama({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Kept in a ref so the running render loop sees changes without re-running the
  // setup effect. We pause the background during GIF export so it doesn't
  // contend with the (offscreen) export renderer for the GPU.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

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
      const textures: import("three").Texture[] = [];
      const materials = SLOT_TO_FACE.map((faceIndex) => {
        const tex = loader.load(PANORAMA[faceIndex]);
        tex.colorSpace = THREE.SRGBColorSpace;
        // Viewing the box from inside mirrors the texture horizontally; flip it
        // back so any text/detail in the panorama reads the right way round.
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.x = -1;
        textures.push(tex);
        return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
      });

      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const skybox = new THREE.Mesh(geometry, materials);
      scene.add(skybox);

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
