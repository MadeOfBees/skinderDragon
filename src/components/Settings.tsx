import { useEffect, type ReactNode } from "react";
import type { PanoramaSource } from "./Panorama";
import { seg } from "../lib/ui";

/** One labelled option row: title + hint on the left, control on the right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
  panoramaSource: PanoramaSource;
  onPanoramaSource: (source: PanoramaSource) => void;
}

/**
 * The Minecraft-style "Options" screen: a dark Ore UI panel floating over a
 * dimmed backdrop, holding app-level preferences (currently the title-screen
 * panorama channel). Add future settings as more <SettingRow>s. Closes on the
 * Done button, the ✕, a backdrop click, or Escape.
 */
export function Settings({
  open,
  onClose,
  panoramaSource,
  onPanoramaSource,
}: SettingsProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="mc-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings"
    >
      <div
        className="mc-panel mc-modal mc-dialog-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between gap-3 border-b-2 border-black/50 pb-2.5">
          <h2 className="mc-title text-[1.1rem]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="mc-btn mc-btn-stone mc-btn-icon"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </header>

        <SettingRow label="Panorama" hint="Title-screen background source.">
          <button
            type="button"
            data-testid="panorama-release"
            aria-pressed={panoramaSource === "release"}
            className={seg(panoramaSource === "release")}
            onClick={() => onPanoramaSource("release")}
          >
            Release
          </button>
          <button
            type="button"
            data-testid="panorama-snapshot"
            aria-pressed={panoramaSource === "snapshot"}
            className={seg(panoramaSource === "snapshot")}
            onClick={() => onPanoramaSource("snapshot")}
          >
            Snapshot
          </button>
        </SettingRow>

        <button
          type="button"
          onClick={onClose}
          className="mc-btn mc-btn-green mc-btn-hero mt-4 w-full"
        >
          Done
        </button>
      </div>
    </div>
  );
}
