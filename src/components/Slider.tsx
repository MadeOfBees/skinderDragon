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

// This component took an embarrassing amount of time to get working.
// If you decide to rewrite it, send me an email so I can pray for you.
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
  // fill ∈ [0, 1]; passed to UiBar and written as --pct on the track so the
  // thumb overlay and fill bar share a single source of truth.
  const fill = (value - min) / (max - min);
  const pct = `${fill * 100}%`;

  // Markers only for coarse sliders — past 24 intervals they're too dense to read.
  // Only interior stops: min and max don't need markers because the thumb is
  // already pinned to the track edges there, so length is numIntervals - 1.
  const numIntervals = (max - min) / step;
  const stepMarkers =
    numIntervals <= 24
      ? Array.from(
          { length: numIntervals - 1 },
          (_, i) => (i + 1) / numIntervals,
        )
      : [];

  return (
    <div className="mc-range-wrap">
      <div className="mc-range-header">
        <span className="mc-range-label">{label}</span>
        {valueLabel !== undefined && (
          <span className="mc-range-value">{valueLabel}</span>
        )}
      </div>
      {/*
        The native <input type="range"> is fully transparent — interaction only.
        Visuals are absolute overlays beneath it because the native thumb can't
        be styled consistently cross-browser to match bedrock's UI design.
        The input must remain on top (z-index) so it keeps receiving mouse events.
      */}
      {/*
        --pct must carry the % unit (e.g. "25%" not 0.25) so CSS calc() can do
        mixed-unit arithmetic like calc(var(--pct) - 16px). It's set on the
        track so the UiBar fill and thumb overlay share one source of truth.
      */}
      <div
        className="mc-range-track"
        style={{ "--pct": pct } as React.CSSProperties}
      >
        <UiBar value={fill} className="mc-range-overlay" />
        {stepMarkers.length > 0 && (
          <div
            className="mc-range-overlay mc-range-overlay-steps"
            aria-hidden="true"
          >
            {/*
              Browsers space range stops evenly across the full track width, so
              a marker at (i+1)/N * 100% lands exactly where the native thumb
              will snap to. translateX(-50%) in CSS centers the 2 px SVG on
              that coordinate, keeping markers and thumb perfectly aligned.
            */}
            {stepMarkers.map((pct) => (
              <div
                key={pct}
                className="mc-track-step"
                style={{ left: `${pct * 100}%` }}
              >
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
        {/*
          Thumb overlay: 32 px wide, matching the native thumb hit area (also
          32 px in CSS) — if you change one, change both. To center it on each
          stop: left = pct*trackWidth - 16px (half the thumb width). The clamp
          at min/max is intentional — first and last steps travel slightly less
          distance than interior ones. See .mc-range-thumb-overlay in index.css.
        */}
        <div className="mc-range-thumb-overlay" aria-hidden="true">
          <ThumbIcon />
        </div>
      </div>
    </div>
  );
}
