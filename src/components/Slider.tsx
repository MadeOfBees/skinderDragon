import { ThumbIcon } from "../icons/thumb/ThumbIcon";
import { SliderLeftCapIcon } from "../icons/slider/SliderLeftCapIcon";
import { SliderRightCapIcon } from "../icons/slider/SliderRightCapIcon";
import { SliderGreyFillIcon } from "../icons/slider/SliderGreyFillIcon";
import { SliderGreenFillIcon } from "../icons/slider/SliderGreenFillIcon";
import { SliderStepIcon } from "../icons/slider/SliderStepIcon";

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
        <div className="mc-range-track-svgs" aria-hidden="true">
          <div className="mc-track-cap mc-track-cap-left"><SliderLeftCapIcon /></div>
          <div className="mc-track-fills">
            <div className="mc-track-fill mc-track-fill-grey"><SliderGreyFillIcon /></div>
            <div className="mc-track-fill mc-track-fill-green"><SliderGreenFillIcon /></div>
          </div>
          <div className="mc-track-cap mc-track-cap-right"><SliderRightCapIcon /></div>
          {stepMarkers.map((pct) => (
            <div key={pct} className="mc-track-step" style={{ left: `calc(${pct} * (100% - 32px) + 16px)` }}>
              <SliderStepIcon />
            </div>
          ))}
        </div>
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
