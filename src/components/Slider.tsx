import { ThumbIcon } from "../icons/thumb/ThumbIcon";

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
  const pct = `${((value - min) / (max - min)) * 100}%`;

  return (
    <div className="mc-range-wrap">
      <div className="mc-range-header">
        <span className="mc-range-label">{label}</span>
        {valueLabel !== undefined && (
          <span className="mc-range-value">{valueLabel}</span>
        )}
      </div>
      <div className="mc-range-track" style={{ "--pct": pct } as React.CSSProperties}>
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
