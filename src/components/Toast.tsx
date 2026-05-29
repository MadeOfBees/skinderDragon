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
        <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true">
          <rect width="24" height="24" rx="2" fill="#5D7C15" />
          <polygon points="5,13 9,17 19,7 17.5,5.5 9,14 6.5,11.5" fill="white" />
        </svg>
      )}
      <span className="leading-tight">
        <span className="block text-[0.7rem] text-splash">
          Advancement Made!
        </span>
        <span className="block text-sm">{message}</span>
      </span>
    </div>
  );
}
