import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fetchProfile, ProfileError, type MinecraftProfile } from "./lib/profile";
import { generateGif, type AnimationMode, type Background } from "./lib/exportGif";
import { Panorama } from "./components/Panorama";
import { Toast } from "./components/Toast";
import { usePreview } from "./hooks/usePreview";
import { renderHead } from "./lib/head";
import { playClick, setMuted } from "./lib/sound";
import { randomSplash } from "./data/splashes";

const seg = (active: boolean) =>
  `mc-btn flex-1 ${active ? "mc-btn-green" : "mc-btn-stone"}`;

export function App() {
  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<MinecraftProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headUrl, setHeadUrl] = useState<string | null>(null);

  const [mode, setMode] = useState<AnimationMode>("run");
  const [bgKind, setBgKind] = useState<"transparent" | "color">("color");
  const [bgColor, setBgColor] = useState("#1d2030");

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);

  const [splash] = useState(randomSplash);
  const canvasRef = usePreview(profile, mode);

  // Render the player-head avatar from the skin texture.
  useEffect(() => {
    setHeadUrl(null);
    if (!profile) return;
    let active = true;
    renderHead(profile.skinUrl).then((url) => active && setHeadUrl(url));
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

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) playClick();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    playClick();
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
    playClick();
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
        background,
        onProgress: setProgress,
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

  const pick = (fn: () => void) => () => {
    playClick();
    fn();
  };

  return (
    <>
      <Panorama />
      <Toast message={toast} headUrl={headUrl} onDismiss={dismissToast} />

      <div className="relative z-0 mx-auto w-full max-w-3xl px-5 pt-10 pb-24">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="mc-btn mc-btn-stone mc-btn-icon absolute right-4 top-4"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <header className="mb-8 text-center">
          <span className="relative inline-block">
            <h1 className="mc-title text-[1.5rem] sm:text-[2.1rem]">🐉 skinderdragon</h1>
            <span className="mc-splash absolute -right-6 -bottom-3 text-[0.7rem] sm:text-[0.8rem]">
              {splash}
            </span>
          </span>
          <p className="mt-4 text-sm text-muted">
            Turn a Minecraft username into a looping skin GIF.
          </p>
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
                  <span data-testid="cape-badge" className="mc-tag">
                    cape
                  </span>
                )}
              </span>
            </div>

            <div className="flex w-full max-w-[360px] flex-col gap-4">
              <fieldset className="mc-panel m-0 p-3.5">
                <legend className="px-1.5 text-[0.7rem] uppercase text-muted">Animation</legend>
                <div className="flex gap-2.5">
                  <button type="button" className={seg(mode === "run")} onClick={pick(() => setMode("run"))}>
                    Run
                  </button>
                  <button type="button" className={seg(mode === "orbit")} onClick={pick(() => setMode("orbit"))}>
                    Orbit
                  </button>
                </div>
              </fieldset>

              <fieldset className="mc-panel m-0 p-3.5">
                <legend className="px-1.5 text-[0.7rem] uppercase text-muted">Background</legend>
                <div className="flex gap-2.5">
                  <button type="button" className={seg(bgKind === "color")} onClick={pick(() => setBgKind("color"))}>
                    Solid
                  </button>
                  <button
                    type="button"
                    className={seg(bgKind === "transparent")}
                    onClick={pick(() => setBgKind("transparent"))}
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
                      {profile.username} · {mode === "run" ? "Run" : "Orbit"} · 512×512
                    </span>
                  </div>
                  <a
                    data-testid="download"
                    href={gifUrl}
                    download={`${profile.username}-${mode}.gif`}
                    onClick={() => playClick()}
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
