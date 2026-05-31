import { useEffect } from "react";
import { CloseIcon } from "./CloseIcon";

export interface GifModalProps {
  open: boolean;
  generating: boolean;
  progress: number;
  gifUrl: string | null;
  username: string;
  /** Human-readable mode label, e.g. "Run". */
  modeLabel: string;
  orbit: boolean;
  /** Square pixel dimension of the exported GIF, e.g. 512. */
  size: number;
  downloadName: string;
  onClose: () => void;
}

/**
 * The exported-GIF result, shown in a centered Ore UI dialog over a dimmed
 * backdrop (same chrome as <Settings>) instead of stacking below the controls
 * and forcing a scroll. Opens the moment "Generate GIF" is pressed: shows the
 * XP-bar progress while encoding, then swaps to the looping result + download.
 * Closes on the ✕, a backdrop click, or Escape — but only once it's done, so a
 * stray click can't dismiss an in-flight render.
 */
export function GifModal({
  open,
  generating,
  progress,
  gifUrl,
  username,
  modeLabel,
  orbit,
  size,
  downloadName,
  onClose,
}: GifModalProps) {
  // Escape closes once the render has finished.
  useEffect(() => {
    if (!open || generating) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, generating, onClose]);

  if (!open) return null;

  return (
    <div
      className="mc-modal-backdrop"
      onClick={generating ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Generated GIF"
      data-testid="gif-modal"
    >
      <div
        className="mc-panel mc-modal mc-dialog-in flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mc-modal-header flex w-full items-center justify-between gap-3">
          <h2 className="mc-title text-[1.1rem]">
            {generating ? "Rendering…" : "Your GIF"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            aria-label="Close"
            className="mc-btn mc-btn-stone mc-btn-icon"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="mc-modal-body flex w-full flex-col items-center">
          <div className="mc-slot p-2">
            <div className="checkerboard relative overflow-hidden leading-none">
              {gifUrl && !generating ? (
                <img
                  data-testid="result-gif"
                  src={gifUrl}
                  alt={`${username} ${modeLabel} animation`}
                  className="pixelated block h-64 w-64"
                />
              ) : (
                <div className="grid h-64 w-64 place-items-center text-sm text-muted">
                  {Math.round(progress * 100)}%
                </div>
              )}
            </div>
          </div>

          {generating ? (
            <div className="mc-xp mt-4 w-full">
              <div className="mc-xp-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          ) : (
            <>
              <p className="mt-3 text-[0.7rem] text-muted">
                {username} · {modeLabel}
                {orbit ? " + Orbit" : ""} · {size}×{size}
              </p>
              {gifUrl && (
                <a
                  data-testid="download"
                  href={gifUrl}
                  download={downloadName}
                  className="mc-btn mc-btn-green mc-btn-hero mt-4 block w-full text-center"
                >
                  ⬇ Download GIF
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
