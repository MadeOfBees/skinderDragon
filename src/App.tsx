import { useCallback, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { fetchProfile, ProfileError, type MinecraftProfile } from "./lib/profile";
import { type Pose, DEFAULT_GIF_SIZE } from "./lib/exportGif";
import { Panorama, type PanoramaSource } from "./components/Panorama";
import { Settings } from "./components/Settings";
import { RenderModal } from "./components/RenderModal";
import { SearchBar } from "./components/SearchBar";
import { PreviewSlot } from "./components/PreviewSlot";
import { Switch } from "./components/Switch";
import { Slider } from "./components/Slider";
import { Multibutton } from "./components/Multibutton";
import { usePreview } from "./hooks/usePreview";
import { renderHead, renderCape } from "./lib/head";
import { loadLastSearch, rememberLastSearch, setFavicon } from "./lib/favicon";
import { loadPanoramaSource, savePanoramaSource, loadEdition, saveEdition } from "./lib/settings";
import type { Edition } from "./lib/providers";
import { randomSplash } from "./data/splashes";
import { Button } from "./components/Button";
import { SettingsIcon } from "./icons/SettingsIcon";
import { DownloadIcon } from "./icons/DownloadIcon";

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mc-panel m-0 p-3.5">
      <p className="mc-section-label">{label}</p>
      {children}
    </div>
  );
}

const POSE_ORDER: Pose[] = ["sneak", "stand", "walk", "run", "fly"];
const POSE_LABELS: Record<Pose, string> = {
  sneak: "Crouch",
  stand: "Stand",
  walk: "Walk",
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

  const [pose, setPose] = useState<Pose>("stand");
  const [orbit, setOrbit] = useState(true);
  const [showNametag, setShowNametag] = useState(false);
  const [bgKind, setBgKind] = useState<"transparent" | "color">("color");
  const [bgColor, setBgColor] = useState("#1d2030");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panoramaSource, setPanoramaSource] = useState<PanoramaSource>(loadPanoramaSource);
  const [edition, setEdition] = useState<Edition>(loadEdition);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [renderModalOpen, setRenderModalOpen] = useState(false);
const generationAbortRef = useRef<AbortController | null>(null);

  const [splash] = useState(randomSplash);

  const upsideDown = !!profile && FLIP_NAMES.test(profile.username);
  const { canvasRef, captureRender, ready: previewReady, error: previewError } = usePreview(
    profile,
    pose,
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
  const closeRenderModal = useCallback(() => setRenderModalOpen(false), []);
const cancelGeneration = useCallback(() => {
    generationAbortRef.current?.abort();
  }, []);

  const changePanoramaSource = useCallback((source: PanoramaSource) => {
    setPanoramaSource(source);
    savePanoramaSource(source);
  }, []);

  const changeEdition = useCallback((ed: Edition) => {
    setEdition(ed);
    saveEdition(ed);
    setProfile(null);
    setError(null);
  }, []);

  async function onSubmit(e: SyntheticEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    setGifUrl(null);
    setRenderModalOpen(false);
    try {
      setProfile(await fetchProfile(username, edition));
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
    if (!profile || generating || !previewReady || previewError) return;
    setGenerating(true);
    setProgress(0);
    setGifUrl(null);
    setRenderModalOpen(true);
    const abort = new AbortController();
    generationAbortRef.current = abort;
    try {
      // The GIF is captured from the live preview viewer — WYSIWYG.
      const blob = await captureRender({
        background: bgKind === "color" ? { kind: "color", color: bgColor } : { kind: "transparent" },
        onProgress: setProgress,
        signal: abort.signal,
        ...GIF_OVERRIDES,
      });
      setGifUrl(URL.createObjectURL(blob));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setRenderModalOpen(false);
        return;
      }
      console.error(err);
      setError("Failed to generate the GIF. See the console for details.");
      setRenderModalOpen(false);
    } finally {
      generationAbortRef.current = null;
      setGenerating(false);
    }
  }

  const renderFormat = orbit ? "gif" : "png";

  let generateLabel = "Loading preview…";
  if (generating) generateLabel = `Rendering… ${Math.round(progress * 100)}%`;
  else if (previewError) generateLabel = "Preview unavailable";
  else if (previewReady) generateLabel = "Generate Render";

  return (
    <>
      <Panorama paused={generating} source={panoramaSource} />
<Button
        data-testid="open-settings"
        aria-label="Settings"
        title="Settings"
        onClick={() => setSettingsOpen(true)}
        className="mc-btn-gear fixed top-3 right-3 z-50"
      >
        <SettingsIcon />
      </Button>
      <Settings
        open={settingsOpen}
        onClose={closeSettings}
        panoramaSource={panoramaSource}
        onPanoramaSource={changePanoramaSource}
        edition={edition}
        onEdition={changeEdition}
      />
      {profile && (
        <RenderModal
          open={renderModalOpen}
          generating={generating}
          progress={progress}
          gifUrl={gifUrl}
          username={profile.username}
          poseLabel={POSE_LABELS[pose]}
          orbit={orbit}
          size={GIF_OVERRIDES.size ?? DEFAULT_GIF_SIZE}
          format={renderFormat}
          downloadName={`${profile.username}-${pose}${orbit ? "-orbit" : ""}.${renderFormat}`}
          onClose={closeRenderModal}
          onCancel={cancelGeneration}
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
          placeholder={edition === "bedrock" ? "Bedrock gamertag…" : "Java username…"}
          error={error}
          className="mx-auto w-full max-w-md"
        />

        {profile && (
          <main className="mt-8 grid items-start gap-6 justify-items-center md:grid-cols-[340px_1fr] md:justify-items-stretch">
            <div className="flex flex-col items-center gap-3">
              <PreviewSlot>
                <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />
              </PreviewSlot>
              {previewError && (
                <p data-testid="preview-error" className="max-w-80 text-center text-sm text-red-300">
                  {previewError}
                </p>
              )}
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
                  <DownloadIcon /> Skin PNG
                </a>
                {headUrl && (
                  <a
                    data-testid="download-head"
                    href={headUrl}
                    download={`${profile.username}-head.png`}
                    className="mc-btn mc-btn-stone text-[0.7rem]"
                  >
                    <DownloadIcon /> Head PNG
                  </a>
                )}
              </div>
            </div>

            <div className="flex w-full max-w-90 flex-col gap-4">
              <ControlGroup label="Animation">
                <div className="flex flex-col gap-2">
                  <Slider
                    label="Pose"
                    value={POSE_ORDER.indexOf(pose)}
                    min={0}
                    max={4}
                    valueLabel={POSE_LABELS[pose]}
                    onChange={(i: number) => setPose(POSE_ORDER[i])}
                    ariaLabel="Pose"
                  />
                  <div className="flex flex-col gap-2 px-0.5">
                    <Switch label="Orbit" checked={orbit} onChange={() => setOrbit((o) => !o)} />
                    <Switch label="Nametag" checked={showNametag} onChange={() => setShowNametag((n) => !n)} />
                  </div>
                </div>
              </ControlGroup>

              <ControlGroup label="Background">
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
              </ControlGroup>

              <button
                type="button"
                onClick={onGenerate}
                disabled={generating || !previewReady || !!previewError}
                className="mc-btn mc-btn-green mc-btn-hero w-full"
              >
                {generateLabel}
              </button>
            </div>
          </main>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 px-3 py-2 text-[0.7rem] text-muted">
        <span>skinderdragon 1.0 — not affiliated with Mojang</span>
        <span className="text-right">
          {edition === "bedrock" ? (
            <>lookup via <a href="https://api.geysermc.org">GeyserMC</a> · skins from Mojang&apos;s CDN</>
          ) : (
            <>lookup via <a href="https://playerdb.co">playerdb</a> · skins from Mojang&apos;s CDN</>
          )}
        </span>
      </footer>
    </>
  );
}
