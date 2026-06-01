export function DownloadIcon({ className = "inline h-[1em] w-[1em] -mt-0.5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="112"
      height="112"
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="0" width="3" height="6" fill="currentColor" />
      <rect x="0" y="3" width="2" height="1" fill="currentColor" />
      <rect x="5" y="3" width="2" height="1" fill="currentColor" />
      <rect x="1" y="4" width="1" height="1" fill="currentColor" />
      <rect x="5" y="4" width="1" height="1" fill="currentColor" />
      <rect x="3" y="6" width="1" height="1" fill="currentColor" />
    </svg>
  );
}
