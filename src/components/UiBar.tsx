import type { CSSProperties } from "react";
import { UiBarLeftCapIcon } from "../icons/uiBar/UiBarLeftCapIcon";
import { UiBarRightCapIcon } from "../icons/uiBar/UiBarRightCapIcon";
import { UiBarGreyFillIcon } from "../icons/uiBar/UiBarGreyFillIcon";
import { UiBarGreenFillIcon } from "../icons/uiBar/UiBarGreenFillIcon";

interface UiBarProps {
  /** Fill level from 0 to 1. */
  value: number;
  className?: string;
}

export function UiBar({ value, className }: UiBarProps) {
  const pct = `${value * 100}%`;
  return (
    <div
      aria-hidden="true"
      className={["h-3 flex items-stretch", className].filter(Boolean).join(" ")}
      style={{ "--pct": pct } as CSSProperties}
    >
      <div className="mc-track-cap mc-track-cap-left"><UiBarLeftCapIcon /></div>
      <div className="mc-track-fills">
        <div className="mc-track-fill mc-track-fill-grey"><UiBarGreyFillIcon /></div>
        <div className="mc-track-fill mc-track-fill-green"><UiBarGreenFillIcon /></div>
      </div>
      <div className="mc-track-cap mc-track-cap-right"><UiBarRightCapIcon /></div>
    </div>
  );
}
