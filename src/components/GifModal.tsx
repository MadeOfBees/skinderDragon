import { Modal } from "./Modal";
import { PreviewSlot } from "./PreviewSlot";
import { DownloadIcon } from "../icons/DownloadIcon";

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
  onCancel: () => void;
}

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
  onCancel,
}: GifModalProps) {
  return (
    <Modal
      open={open}
      title={generating ? "Rendering…" : "Your GIF"}
      ariaLabel="Generated GIF"
      onClose={onClose}
      disabled={generating}
      panelClassName="flex flex-col items-center"
      testId="gif-modal"
    >
      <div className="mc-modal-body flex w-full flex-col items-center">
        <PreviewSlot className="relative">
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
        </PreviewSlot>

        {generating ? (
          <>
            <div className="mc-xp mt-4 w-full">
              <div className="mc-xp-fill" style={{ width: `${progress * 100}%` }} />
            </div>
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
                <DownloadIcon /> Download GIF
              </a>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
