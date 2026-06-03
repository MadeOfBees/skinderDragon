import type { ReactNode } from "react";
import { cn } from "../lib/ui";

interface ButtonProps {
  "aria-label": string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  "data-testid"?: string;
}

export function Button({
  "aria-label": ariaLabel,
  children,
  onClick,
  disabled,
  title,
  className = "",
  "data-testid": testId,
}: ButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn("mc-btn mc-btn-stone mc-btn-icon", className)}
    >
      {children}
    </button>
  );
}
