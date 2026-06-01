import { useEffect, useRef, type ReactNode } from "react";
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

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
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
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const frame = requestAnimationFrame(() => {
      const target = panel ? focusableIn(panel)[0] ?? panel : null;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!disabled) onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const items = focusableIn(panel);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
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
        ref={panelRef}
        className={["mc-panel mc-modal mc-dialog-in", panelClassName].filter(Boolean).join(" ")}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
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
