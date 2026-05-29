import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { fetchProfile, ProfileError, type MinecraftProfile } from "./lib/profile";
import { generateGif, type AnimationMode, type Background } from "./lib/exportGif";
import { Panorama, type PanoramaSource } from "./components/Panorama";
import { Settings } from "./components/Settings";
import { Toast } from "./components/Toast";
import { usePreview } from "./hooks/usePreview";
import { renderHead, renderCape } from "./lib/head";
import { loadLastSearch, rememberLastSearch, setFavicon } from "./lib/favicon";
import { loadPanoramaSource, savePanoramaSource } from "./lib/settings";
import { seg } from "./lib/ui";
import { randomSplash } from "./data/splashes";

const MODES: { id: AnimationMode; label: string }[] = [
  { id: "run", label: "Run" },
  { id: "sneak", label: "Sneak" },
  { id: "fly", label: "Fly" },
];

const modeLabel = (id: AnimationMode) =>
  MODES.find((m) => m.id === id)?.label ?? id;

// The classic "render me upside-down" usernames.
const FLIP_NAMES = /^(dinnerbone|grumm)$/i;

// Optional GIF size/frame-count overrides via URL query (`?gifSize=256&gifFrames=8`).
// Production defaults (512px, 30 frames) apply when absent; the headless smoke
// test uses this to render tiny GIFs so CI stays fast. Clamped to sane bounds.
const GIF_OVERRIDES: { size?: number; frames?: number } = (() => {
  const out: { size?: number; frames?: number } = {};
  if (typeof location === "undefined") return out;
  const p = new URLSearchParams(location.search);
  const size = Number(p.get("gifSize"));
  if (Number.isFinite(size) && size >= 64 && size <= 512) out.size = size;
  const frames = Number(p.get("gifFrames"));
  if (Number.isFinite(frames) && frames >= 1 && frames <= 60) out.frames = frames;
  return out;
})();

export function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<MinecraftProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headUrl, setHeadUrl] = useState<string | null>(null);
  const [capeUrl, setCapeUrl] = useState<string | null>(null);

  const [mode, setMode] = useState<AnimationMode>("run");
  const [orbit, setOrbit] = useState(false);
  const [showNametag, setShowNametag] = useState(false);
  const [bgKind, setBgKind] = useState<"transparent" | "color">("color");
  const [bgColor, setBgColor] = useState("#1d2030");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panoramaSource, setPanoramaSource] = useState<PanoramaSource>(loadPanoramaSource);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [splash] = useState(randomSplash);

  const upsideDown = !!profile && FLIP_NAMES.test(profile.username);
  const canvasRef = usePreview(profile, mode, orbit, showNametag, upsideDown, generating);

  // On first load, restore the last-searched player: favicon + prefilled name.
  useEffect(() => {
    const last = loadLastSearch();
    if (last) {
      setFavicon(last.head);
      setUsername(last.username);
    }
  }, []);

  // Render the player-head avatar; once ready, make it the tab favicon and
  // remember this player for next visit.
  useEffect(() => {
    setHeadUrl(null);
    if (!profile) return;
    let active = true;
    renderHead(profile.skinUrl).then((url) => {
      if (!active || !url) return;
      setHeadUrl(url);
      rememberLastSearch(profile.username, url);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  // Render a preview of the cape's front face, if the player has one.
  useEffect(() => {
    setCapeUrl(null);
    if (!profile?.capeUrl) return;
    let active = true;
    renderCape(profile.capeUrl).then((url) => active && setCapeUrl(url));
    return () => {
      active = false;
    };
  }, [profile]);

  // Revoke object URLs when they're replaced or on unmount.
  useEffect(() => {
    return () => {
      if (profile?.capeUrl) URL.revokeObjectURL(profile.capeUrl);
      if (profile?.skinUrl) URL.revokeObjectURL(profile.skinUrl);
    };
  }, [profile]);
  useEffect(() => {
    return () => {
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, [gifUrl]);

  const dismissToast = useCallback(() => setToast(null), []);

  const changePanoramaSource = useCallback((source: PanoramaSource) => {
    setPanoramaSource(source);
    savePanoramaSource(source);
  }, []);

  async function onSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    setGifUrl(null);
    try {
      setProfile(await fetchProfile(username));
    } catch (err) {
      setProfile(null);
      setError(
        err instanceof ProfileError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function onGenerate() {
    if (!profile || generating) return;
    setGenerating(true);
    setProgress(0);
    setGifUrl(null);
    const background: Background =
      bgKind === "color"
        ? { kind: "color", color: bgColor }
        : { kind: "transparent" };
    try {
      const blob = await generateGif({
        skinUrl: profile.skinUrl,
        capeUrl: profile.capeUrl,
        slim: profile.slim,
        mode,
        orbit,
        showNametag,
        username: profile.username,
        background,
        upsideDown,
        onProgress: setProgress,
        ...GIF_OVERRIDES,
      });
      setGifUrl(URL.createObjectURL(blob));
      setToast("Picture Perfect");
    } catch (err) {
      console.error(err);
      setError("Failed to generate the GIF. See the console for details.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <Panorama paused={generating} source={panoramaSource} />
      <Toast message={toast} headUrl={headUrl} onDismiss={dismissToast} />

      <button
        type="button"
        data-testid="open-settings"
        aria-label="Settings"
        title="Settings"
        onClick={() => setSettingsOpen(true)}
        className="mc-btn mc-btn-stone mc-btn-icon mc-btn-gear fixed top-3 right-3 z-50"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>
      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        panoramaSource={panoramaSource}
        onPanoramaSource={changePanoramaSource}
      />

      <div className="relative z-0 mx-auto w-full max-w-3xl px-5 pt-10 pb-24">
        <header className="mb-8 text-center">
          <span className="relative inline-block">
            <h1 className="mc-title text-[1.5rem] sm:text-[2.1rem]">skinderdragon</h1>
            <span className="mc-splash absolute -right-4 -bottom-2 text-[0.5rem] sm:text-[0.58rem]">
              {splash}
            </span>
          </span>
        </header>

        <form className="mx-auto flex max-w-md gap-2.5" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Minecraft username"
            value={username}
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value)}
            className="mc-input flex-1 text-base"
          />
          <button type="submit" disabled={loading} className="mc-btn mc-btn-green">
            {loading ? "Locating…" : "Load skin"}
          </button>
        </form>

        {error && (
          <p data-testid="error" className="mc-panel mx-auto mt-4 max-w-md p-3 text-center text-red-300">
            {error}
          </p>
        )}

        {profile && (
          <main className="mt-8 grid items-start gap-6 justify-items-center md:grid-cols-[340px_1fr] md:justify-items-stretch">
            <div className="flex flex-col items-center gap-3">
              <div className="mc-slot p-2">
                <div className="checkerboard overflow-hidden leading-none">
                  <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />
                </div>
              </div>
              <span className="inline-flex items-center gap-2">
                {headUrl && (
                  <img src={headUrl} alt="" className="pixelated h-6 w-6 border-2 border-black" />
                )}
                <span data-testid="player-name" className="text-sm">
                  {profile.username}
                </span>
                {profile.capeUrl && (
                  <span data-testid="cape-badge" title="Cape" className="inline-flex">
                    {capeUrl ? (
                      <img
                        src={capeUrl}
                        alt={`${profile.username}'s cape`}
                        // Scale with the username text rather than towering over
                        // it: ~1.25em tall, keeping the cape's 10:16 aspect.
                        className="pixelated h-[1.25em] w-auto border border-black"
                      />
                    ) : (
                      <span className="mc-tag">cape</span>
                    )}
                  </span>
                )}
              </span>

              <div className="flex gap-2">
                <a
                  data-testid="download-skin"
                  href={profile.skinUrl}
                  download={`${profile.username}-skin.png`}
                  className="mc-btn mc-btn-stone text-[0.7rem] no-underline"
                >
                  ⬇ Skin PNG
                </a>
                {headUrl && (
                  <a
                    data-testid="download-head"
                    href={headUrl}
                    download={`${profile.username}-head.png`}
                    className="mc-btn mc-btn-stone text-[0.7rem] no-underline"
                  >
                    ⬇ Head PNG
                  </a>
                )}
              </div>
            </div>

            <div className="flex w-full max-w-90 flex-col gap-4">
              <fieldset className="mc-panel m-0 p-3.5">
                <legend className="px-1.5 text-[0.7rem] uppercase text-muted">Animation</legend>
                <div className="grid grid-cols-3 gap-2.5">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={seg(mode === m.id)}
                      onClick={() => setMode(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {/* Orbit and nametag are modifiers, not modes — they layer on
                    top of whichever animation is selected. */}
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={orbit}
                    className={seg(orbit)}
                    onClick={() => setOrbit((o) => !o)}
                  >
                    Orbit{orbit ? " ✓" : ""}
                  </button>
                  <button
                    type="button"
                    aria-pressed={showNametag}
                    className={seg(showNametag)}
                    onClick={() => setShowNametag((n) => !n)}
                  >
                    Nametag{showNametag ? " ✓" : ""}
                  </button>
                </div>
              </fieldset>

              <fieldset className="mc-panel m-0 p-3.5">
                <legend className="px-1.5 text-[0.7rem] uppercase text-muted">Background</legend>
                <div className="flex gap-2.5">
                  <button type="button" className={`${seg(bgKind === "color")} flex-1`} onClick={() => setBgKind("color")}>
                    Solid
                  </button>
                  <button
                    type="button"
                    className={`${seg(bgKind === "transparent")} flex-1`}
                    onClick={() => setBgKind("transparent")}
                  >
                    Transparent
                  </button>
                </div>
                {bgKind === "color" && (
                  <label className="mt-3 flex items-center gap-2.5 text-sm text-muted">
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer border-2 border-black bg-transparent p-0"
                    />
                    <span>{bgColor}</span>
                  </label>
                )}
              </fieldset>

              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="mc-btn mc-btn-green mc-btn-hero w-full"
              >
                {generating ? `Generating… ${Math.round(progress * 100)}%` : "Generate GIF"}
              </button>

              {generating && (
                <div className="mc-xp">
                  <div className="mc-xp-fill" style={{ width: `${progress * 100}%` }} />
                </div>
              )}

              {gifUrl && !generating && (
                <div className="flex flex-col items-center gap-3">
                  <div className="mc-tooltip-host mc-slot mc-slot-hover relative p-2">
                    <div className="checkerboard overflow-hidden leading-none">
                      <img
                        data-testid="result-gif"
                        src={gifUrl}
                        alt={`${profile.username} ${mode} animation`}
                        className="pixelated block h-64 w-64"
                      />
                    </div>
                    <span className="mc-tooltip">
                      {profile.username} · {modeLabel(mode)}
                      {orbit ? " + Orbit" : ""} · 512×512
                    </span>
                  </div>
                  <a
                    data-testid="download"
                    href={gifUrl}
                    download={`${profile.username}-${mode}${orbit ? "-orbit" : ""}.gif`}
                    className="mc-btn mc-btn-stone block w-full text-center no-underline"
                  >
                    ⬇ Download GIF
                  </a>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-3 py-2 text-[0.7rem] text-muted">
        <span>skinderdragon 1.0 — not affiliated with Mojang</span>
        <span className="text-right">
          lookup via{" "}
          <a className="underline" href="https://playerdb.co">
            playerdb
          </a>{" "}
          · skins from Mojang&apos;s CDN
        </span>
      </footer>
    </>
  );
}
