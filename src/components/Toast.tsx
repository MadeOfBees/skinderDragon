import { useEffect } from "react";

interface ToastProps {
  /** The advancement title; the toast is shown while this is non-null. */
  message: string | null;
  /** Player-head data URL for the toast icon, if available. */
  headUrl: string | null;
  onDismiss: () => void;
}

/** A Minecraft "Advancement Made!" toast that chimes in and auto-dismisses. */
export function Toast({ message, headUrl, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, 4500);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="mc-toast" role="status">
      {headUrl ? (
        <img src={headUrl} alt="" className="pixelated h-8 w-8" />
      ) : (
        <span className="text-xl">🟩</span>
      )}
      <span className="leading-tight">
        <span className="block text-[0.7rem] text-[var(--color-splash)]">
          Advancement Made!
        </span>
        <span className="block text-sm">{message}</span>
      </span>
    </div>
  );
}
