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
    <div className={`mc-panel mc-search-panel p-3.5 ${className}`}>
      <form className="mc-search-bar flex" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mc-input flex-1 text-base"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Search"
          className="mc-btn mc-btn-stone mc-search-btn"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            style={{
              width: "1.4rem",
              height: "1.4rem",
              filter: "drop-shadow(0.08em 0.08em 0 rgba(0,0,0,0.5))",
            }}
          >
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
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
