import { type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/ui";

interface PreviewSlotProps {
  children: ReactNode;
  /** CSS color string for a solid background, or "transparent". */
  background?: string;
  /** Extra classes forwarded to the inner div (e.g. "relative"). */
  className?: string;
}

export function PreviewSlot({ children, background = "#313233", className }: PreviewSlotProps) {
  const style: CSSProperties | undefined = background === "transparent" ? undefined : { background };
  return (
    <div className="mc-slot">
      <div
        className={cn("mc-slot-inner", className)}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
