import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./CloseIcon";

interface ModalProps {
  open: boolean;
  title: string;
  ariaLabel: string;
  onClose: () => void;
  /** When true: blocks backdrop click, Escape, and disables the close button. */
  disabled?: boolean;
  panelClassName?: string;
  testId?: string;
  children: ReactNode;
}

export function Modal({
  open,
  title,
  ariaLabel,
  onClose,
  disabled,
  panelClassName,
  testId,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open || disabled) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, disabled, onClose]);

  if (!open) return null;

  return (
    <div
      className="mc-modal-backdrop"
      onClick={disabled ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div
        className={["mc-panel mc-modal mc-dialog-in", panelClassName].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mc-modal-header flex w-full items-center justify-between gap-3">
          <h2 className="mc-title text-[1.1rem]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            aria-label="Close"
            className="mc-btn mc-btn-stone mc-btn-icon"
          >
            <CloseIcon />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
