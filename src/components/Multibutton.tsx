import { cn, seg } from "../lib/ui";

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
    <div className={cn("mc-anim-slider", className)}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          data-testid={opt.testId}
          aria-pressed={opt.value === value}
          className={cn("mc-btn", seg(opt.value === value))}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
