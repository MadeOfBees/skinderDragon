import { useEffect, type ReactNode } from "react";
import type { PanoramaSource } from "./Panorama";
import { CloseIcon } from "./CloseIcon";
import { Multibutton } from "./Multibutton";

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
      <div className="shrink-0">{children}</div>
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
        <header className="mc-modal-header flex items-center justify-between gap-3">
          <h2 className="mc-title text-[1.1rem]">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="mc-btn mc-btn-stone mc-btn-icon"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="mc-modal-body">
          <SettingRow label="Panorama" hint="Title-screen background source.">
            <Multibutton
              options={[
                { label: "Release", value: "release", testId: "panorama-release" },
                { label: "Snapshot", value: "snapshot", testId: "panorama-snapshot" },
              ]}
              value={panoramaSource}
              onChange={onPanoramaSource}
            />
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
    </div>
  );
}
