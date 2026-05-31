import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { fetchProfile, ProfileError, type MinecraftProfile } from "./lib/profile";
import { type AnimationMode, DEFAULT_GIF_SIZE } from "./lib/exportGif";
import { Panorama, type PanoramaSource } from "./components/Panorama";
import { Settings } from "./components/Settings";
import { GifModal } from "./components/GifModal";
import { Toast } from "./components/Toast";
import { SearchBar } from "./components/SearchBar";
import { Switch } from "./components/Switch";
import { Slider } from "./components/Slider";
import { Multibutton } from "./components/Multibutton";
import { usePreview } from "./hooks/usePreview";
import { renderHead, renderCape } from "./lib/head";
import { loadLastSearch, rememberLastSearch, setFavicon } from "./lib/favicon";
import { loadPanoramaSource, savePanoramaSource } from "./lib/settings";
import { randomSplash } from "./data/splashes";

const MODE_ORDER: AnimationMode[] = ["sneak", "run", "fly"];
const MODE_LABELS: Record<AnimationMode, string> = {
  sneak: "Crouch",
  run: "Run",
  fly: "Fly",
};

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
  const [gifModalOpen, setGifModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [splash] = useState(randomSplash);

  const upsideDown = !!profile && FLIP_NAMES.test(profile.username);
  const { canvasRef, captureGif } = usePreview(
    profile,
    mode,
    orbit,
    showNametag,
    upsideDown,
    generating
  );

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

  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeGifModal = useCallback(() => setGifModalOpen(false), []);
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
    setGifModalOpen(false);
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
    setGifModalOpen(true);
    try {
      // The GIF is captured from the live preview viewer — WYSIWYG.
      const blob = await captureGif({
        background: bgKind === "color" ? { kind: "color", color: bgColor } : { kind: "transparent" },
        onProgress: setProgress,
        ...GIF_OVERRIDES,
      });
      setGifUrl(URL.createObjectURL(blob));
      setToast("Picture Perfect");
    } catch (err) {
      console.error(err);
      setError("Failed to generate the GIF. See the console for details.");
      setGifModalOpen(false);
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
        onClose={closeSettings}
        panoramaSource={panoramaSource}
        onPanoramaSource={changePanoramaSource}
      />
      {profile && (
        <GifModal
          open={gifModalOpen}
          generating={generating}
          progress={progress}
          gifUrl={gifUrl}
          username={profile.username}
          modeLabel={MODE_LABELS[mode]}
          orbit={orbit}
          size={GIF_OVERRIDES.size ?? DEFAULT_GIF_SIZE}
          downloadName={`${profile.username}-${mode}${orbit ? "-orbit" : ""}.gif`}
          onClose={closeGifModal}
        />
      )}

      <div className="relative z-0 mx-auto w-full max-w-3xl px-5 pt-10 pb-24">
        <header className="mb-8 text-center">
          <span className="relative inline-block">
            <h1 className="mc-title text-[1.5rem] sm:text-[2.1rem]">skinderdragon</h1>
            <span className="mc-splash absolute -right-4 -bottom-2 text-[0.5rem] sm:text-[0.58rem]">
              {splash}
            </span>
          </span>
        </header>

        <SearchBar
          value={username}
          onChange={setUsername}
          onSubmit={onSubmit}
          disabled={loading}
          placeholder="Minecraft username"
          error={error}
          className="mx-auto w-full max-w-md"
        />

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
                  className="mc-btn mc-btn-stone text-[0.7rem]"
                >
                  ⬇ Skin PNG
                </a>
                {headUrl && (
                  <a
                    data-testid="download-head"
                    href={headUrl}
                    download={`${profile.username}-head.png`}
                    className="mc-btn mc-btn-stone text-[0.7rem]"
                  >
                    ⬇ Head PNG
                  </a>
                )}
              </div>
            </div>

            <div className="flex w-full max-w-90 flex-col gap-4">
              <div role="group" aria-label="Animation" className="mc-panel m-0 p-3.5">
                <p className="mc-section-label">Animation</p>
                <Slider
                  label="Mode"
                  value={MODE_ORDER.indexOf(mode)}
                  min={0}
                  max={2}
                  valueLabel={MODE_LABELS[mode]}
                  onChange={(i: number) => setMode(MODE_ORDER[i])}
                  ariaLabel="Animation mode"
                />
                <div className="mt-2 flex flex-col">
                  <Switch label="Orbit" checked={orbit} onChange={() => setOrbit((o) => !o)} />
                  <Switch label="Nametag" checked={showNametag} onChange={() => setShowNametag((n) => !n)} />
                </div>
              </div>

              <div role="group" aria-label="Background" className="mc-panel m-0 p-3.5">
                <p className="mc-section-label">Background</p>
                <Multibutton
                  options={[
                    { label: "Solid", value: "color" },
                    { label: "Transparent", value: "transparent" },
                  ]}
                  value={bgKind}
                  onChange={(v: "color" | "transparent") => setBgKind(v)}
                />
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
              </div>

              <button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="mc-btn mc-btn-green mc-btn-hero w-full"
              >
                {generating ? `Generating… ${Math.round(progress * 100)}%` : "Generate GIF"}
              </button>
            </div>
          </main>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-3 py-2 text-[0.7rem] text-muted">
        <span>skinderdragon 1.0 — not affiliated with Mojang</span>
        <span className="text-right">
          lookup via{" "}
          <a href="https://playerdb.co">
            playerdb
          </a>{" "}
          · skins from Mojang&apos;s CDN
        </span>
      </footer>
    </>
  );
}
