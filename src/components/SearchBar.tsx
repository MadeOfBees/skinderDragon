import type { FormEvent } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Search…",
  error,
  className = "",
}: SearchBarProps) {
  return (
    <div className={`mc-search-panel p-3.5 ${className}`}>
      <form className="mc-search-bar flex items-center" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mc-input flex-1 text-base"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={disabled} aria-label="Search" className="mc-search-btn">
          {/* Placeholder magnifier — final SVG to be dropped in later. */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <line x1="14.5" y1="14.5" x2="20" y2="20" />
          </svg>
        </button>
      </form>
      {error && (
        <p data-testid="error" className="mt-3 text-center text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
