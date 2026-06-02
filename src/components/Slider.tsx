import { ThumbIcon } from "../icons/thumb/ThumbIcon";
import { UiBarStepIcon } from "../icons/uiBar/UiBarStepIcon";
import { UiBar } from "./UiBar";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  valueLabel?: string;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  valueLabel,
  onChange,
  ariaLabel,
}: SliderProps) {
  const fill = (value - min) / (max - min);
  const pct = `${fill * 100}%`;
  const numIntervals = (max - min) / step;
  const stepMarkers = numIntervals <= 16
    ? Array.from({ length: numIntervals - 1 }, (_, i) => (i + 1) / numIntervals)
    : [];

  return (
    <div className="mc-range-wrap">
      <div className="mc-range-header">
        <span className="mc-range-label">{label}</span>
        {valueLabel !== undefined && (
          <span className="mc-range-value">{valueLabel}</span>
        )}
      </div>
      <div className="mc-range-track" style={{ "--pct": pct } as React.CSSProperties}>
        <UiBar value={fill} className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none" />
        {stepMarkers.length > 0 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 pointer-events-none" aria-hidden="true">
            {stepMarkers.map((pct) => (
              <div key={pct} className="mc-track-step" style={{ left: `calc(3px + ${pct} * (100% - 6px))` }}>
                <UiBarStepIcon />
              </div>
            ))}
          </div>
        )}
        <input
          type="range"
          className="mc-range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={ariaLabel ?? label}
        />
        <div className="mc-range-thumb-overlay" aria-hidden="true">
          <ThumbIcon />
        </div>
      </div>
    </div>
  );
}
