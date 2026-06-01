export function ThumbIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="256"
      height="256"
      viewBox="0 0 16 16"
      shape-rendering="crispEdges"
    >
      <rect x="0" y="0" width="16" height="1" fill="#1e1e1f" />
      <rect x="0" y="1" width="1" height="15" fill="#1e1e1f" />
      <rect x="1" y="1" width="13" height="1" fill="#ecedee" />
      <rect x="14" y="1" width="1" height="1" fill="#f4f4f5" />
      <rect x="15" y="1" width="1" height="15" fill="#1e1e1f" />
      <rect x="1" y="2" width="1" height="10" fill="#ecedee" />
      <rect
        x="2"
        y="2"
        width="12"
        height="10"
        style={{ fill: "var(--thumb-fill, #d0d1d4)" }}
      />
      <rect x="14" y="2" width="1" height="11" fill="#e3e3e5" />
      <rect x="1" y="12" width="1" height="1" fill="#f4f4f5" />
      <rect x="2" y="12" width="12" height="1" fill="#e3e3e5" />
      <rect x="1" y="13" width="14" height="2" fill="#58585a" />
      <rect x="1" y="15" width="14" height="1" fill="#1e1e1f" />
    </svg>
  );
}
