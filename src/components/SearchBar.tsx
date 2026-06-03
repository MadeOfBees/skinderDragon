import type { FormEvent } from "react";
import { SearchIcon } from "../icons/SearchIcon";
import { cn } from "../lib/ui";

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
    <div className={cn("mc-panel", className)}>
      <form className="mc-search-bar" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mc-input"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={disabled} aria-label="Search" className="mc-search-btn">
          <SearchIcon />
        </button>
      </form>
      {error && (
        <p data-testid="error" className="mc-error mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
