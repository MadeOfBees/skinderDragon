import { type ReactNode } from "react";

interface PreviewSlotProps {
  children: ReactNode;
  /** Extra classes forwarded to the inner checkerboard div (e.g. "relative"). */
  className?: string;
}

/** Recessed inventory slot with a checkerboard transparency background. */
export function PreviewSlot({ children, className }: PreviewSlotProps) {
  return (
    <div className="mc-slot p-2">
      <div className={["checkerboard overflow-hidden leading-none", className].filter(Boolean).join(" ")}>
        {children}
      </div>
    </div>
  );
}
