import { seg } from "../lib/ui";

interface Option<T> {
  label: string;
  value: T;
  testId?: string;
}

interface MultibuttonProps<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Multibutton<T>({
  options,
  value,
  onChange,
  className = "",
}: MultibuttonProps<T>) {
  return (
    <div className={`mc-anim-slider ${className}`}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          data-testid={opt.testId}
          aria-pressed={opt.value === value}
          className={`mc-btn flex-1 ${seg(opt.value === value)}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
