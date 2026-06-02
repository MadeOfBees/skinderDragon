import { Modal } from "./Modal";
import { PreviewSlot } from "./PreviewSlot";
import { UiBar } from "./UiBar";
import { DownloadIcon } from "../icons/DownloadIcon";

export interface RenderModalProps {
  open: boolean;
  generating: boolean;
  progress: number;
  gifUrl: string | null;
  username: string;
  /** Human-readable pose label, e.g. "Run". */
  poseLabel: string;
  orbit: boolean;
  format: "gif" | "png";
  /** Square pixel dimension of the exported GIF, e.g. 512. */
  size: number;
  downloadName: string;
  /** Background for the preview slot — CSS color or "transparent". */
  background: string;
  onClose: () => void;
  onCancel: () => void;
}

export function RenderModal({
  open,
  generating,
  progress,
  gifUrl,
  username,
  poseLabel,
  orbit,
  format,
  size,
  downloadName,
  background,
  onClose,
  onCancel,
}: RenderModalProps) {
  return (
    <Modal
      open={open}
      title={generating ? "Rendering…" : "Your Render"}
      ariaLabel="Generated render"
      onClose={onClose}
      disabled={generating}
      panelClassName="flex flex-col items-center"
      testId="render-modal"
    >
      <div className="mc-modal-body flex w-full flex-col items-center">
        <PreviewSlot background={background} className="relative">
          {gifUrl && !generating ? (
            <img
              data-testid="result-gif"
              src={gifUrl}
              alt={`${username} ${poseLabel} ${format === "gif" ? "animation" : "render"}`}
              className="pixelated block w-full h-full"
            />
          ) : (
            <div className="grid w-full h-full place-items-center text-sm text-muted">
              {Math.round(progress * 100)}%
            </div>
          )}
        </PreviewSlot>

        {generating ? (
          <>
            <UiBar value={progress} className="mt-4 w-full" />
            <button
              type="button"
              onClick={onCancel}
              className="mc-btn mc-btn-stone mt-4 w-full text-[0.8rem]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-[0.7rem] text-muted">
              {username} · {poseLabel}
              {orbit ? " + Orbit" : ""} · {size}×{size}
            </p>
            {gifUrl && (
              <a
                data-testid="download"
                href={gifUrl}
                download={downloadName}
                className="mc-btn mc-btn-green mc-btn-hero mt-4 block w-full text-center"
              >
                <DownloadIcon /> Download {format.toUpperCase()}
              </a>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
