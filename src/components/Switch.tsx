import { SwitchOnIcon } from "../icons/SwitchOnIcon";
import { SwitchOffIcon } from "../icons/SwitchOffIcon";

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
        <span className="mc-switch-on"><SwitchOnIcon /></span>
        <span className="mc-switch-off"><SwitchOffIcon /></span>
        <span className="mc-switch-thumb" />
      </span>
    </label>
  );
}
