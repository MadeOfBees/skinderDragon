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
      panelClassName="mc-col-center"
      testId="render-modal"
    >
      <div className="mc-modal-body mc-col-center">
        <PreviewSlot background={background}>
          {gifUrl && !generating ? (
            <img
              data-testid="result-gif"
              src={gifUrl}
              alt={`${username} ${poseLabel} ${format === "gif" ? "animation" : "render"}`}
              className="pixelated mc-slot-fill"
            />
          ) : (
            <div className="mc-slot-progress">
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
              className="mc-btn mc-btn-stone mc-btn-block mt-4 text-[0.8rem]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p className="mc-render-meta">
              {username} · {poseLabel}
              {orbit ? " + Orbit" : ""} · {size}×{size}
            </p>
            {gifUrl && (
              <a
                data-testid="download"
                href={gifUrl}
                download={downloadName}
                className="mc-btn mc-btn-green mc-btn-hero mc-btn-block mt-4"
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
