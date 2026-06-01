interface SwitchTrackIconProps {
  checked?: boolean;
}

export function SwitchTrackIcon({ checked }: SwitchTrackIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="480"
      height="224"
      viewBox="0 0 30 14"
      shape-rendering="crispEdges"
    >
      <rect x="0" y="0" width="30" height="1" fill="#1e1e1f" />
      <rect x="0" y="1" width="1" height="13" fill="#1e1e1f" />
      <rect x="29" y="1" width="1" height="13" fill="#1e1e1f" />
      <rect x="15" y="1" width="13" height="1" fill="#a3a4a6" />
      <rect x="28" y="1" width="1" height="1" fill="#acadaf" />
      <rect x="15" y="2" width="13" height="2" fill="#8c8d90" />
      <rect x="28" y="2" width="1" height="11" fill="#97989b" />
      <rect x="15" y="4" width="5" height="1" fill="#8c8d90" />
      <rect x="20" y="4" width="4" height="1" fill="#242425" />
      <rect x="24" y="4" width="4" height="1" fill="#8c8d90" />
      <rect x="15" y="5" width="4" height="7" fill="#8c8d90" />
      <rect x="19" y="5" width="1" height="4" fill="#242425" />
      <rect x="20" y="5" width="4" height="4" fill="#8c8d90" />
      <rect x="24" y="5" width="1" height="4" fill="#242425" />
      <rect x="25" y="5" width="3" height="7" fill="#8c8d90" />
      <rect x="19" y="9" width="1" height="3" fill="#8c8d90" />
      <rect x="20" y="9" width="4" height="1" fill="#242425" />
      <rect x="24" y="9" width="1" height="3" fill="#8c8d90" />
      <rect x="20" y="10" width="4" height="2" fill="#8c8d90" />
      <rect x="15" y="12" width="13" height="1" fill="#97989b" />
      {/* grey base for left side — shown when unchecked */}
      <rect x="1" y="1" width="14" height="1" fill="#a3a4a6" />
      <rect x="1" y="2" width="1" height="10" fill="#8c8d90" />
      <rect x="2" y="2" width="13" height="10" fill="#8c8d90" />
      <rect x="1" y="12" width="1" height="1" fill="#97989b" />
      <rect x="2" y="12" width="13" height="1" fill="#97989b" />
      <rect x="1" y="13" width="28" height="1" fill="#1e1e1f" />
      {/* green overlay — fades in when checked */}
      <g style={{ opacity: checked ? 1 : 0, transition: "opacity 0.1s" }}>
        <rect x="1" y="1" width="14" height="1" fill="#639d52" />
        <rect x="1" y="2" width="1" height="10" fill="#639d52" />
        <rect x="2" y="2" width="13" height="2" fill="#3c8527" />
        <rect x="2" y="4" width="5" height="8" fill="#3c8527" />
        <rect x="7" y="4" width="1" height="6" fill="#ffffff" />
        <rect x="8" y="4" width="7" height="8" fill="#3c8527" />
        <rect x="7" y="10" width="1" height="2" fill="#3c8527" />
        <rect x="1" y="12" width="1" height="1" fill="#72a763" />
        <rect x="2" y="12" width="13" height="1" fill="#4f913c" />
      </g>
    </svg>
  );
}
