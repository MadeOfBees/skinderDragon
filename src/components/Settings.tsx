import { type ReactNode } from "react";
import type { PanoramaSource } from "./Panorama";
import type { Edition } from "../lib/providers";
import { Modal } from "./Modal";
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
  edition: Edition;
  onEdition: (edition: Edition) => void;
}

export function Settings({
  open,
  onClose,
  panoramaSource,
  onPanoramaSource,
  edition,
  onEdition,
}: SettingsProps) {
  return (
    <Modal open={open} title="Settings" ariaLabel="Settings" onClose={onClose} testId="settings">
      <div className="mc-modal-body">
        <SettingRow
          label="Edition"
          hint={
            edition === "bedrock"
              ? "Bedrock skins are best-effort; GeyserMC only has skins for players in its cache."
              : "Which Minecraft edition to search."
          }
        >
          <Multibutton
            options={[
              { label: "Java", value: "java" as Edition, testId: "edition-java" },
              { label: "Bedrock", value: "bedrock" as Edition, testId: "edition-bedrock" },
            ]}
            value={edition}
            onChange={onEdition}
          />
        </SettingRow>

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
    </Modal>
  );
}
