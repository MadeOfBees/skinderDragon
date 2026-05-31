interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <label className="mc-switch">
      <span>{label}</span>
      <input
        type="checkbox"
        className="mc-switch-input"
        checked={checked}
        onChange={onChange}
      />
      <span className="mc-switch-track">
        <span className="mc-switch-thumb" />
      </span>
    </label>
  );
}
