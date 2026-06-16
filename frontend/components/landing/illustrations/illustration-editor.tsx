/** Minimal abstract “block editor” — no bitmaps; uses currentColor. */
export function IllustrationEditor({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="24"
        y="20"
        width="152"
        height="120"
        rx="12"
        className="stroke-gray-700"
        strokeWidth="1.5"
        fill="rgb(17 24 39 / 0.5)"
      />
      <rect x="40" y="36" width="88" height="8" rx="2" className="fill-primary/40" />
      <rect x="40" y="52" width="120" height="6" rx="2" className="fill-gray-600" />
      <rect x="40" y="66" width="100" height="6" rx="2" className="fill-gray-600" />
      <rect
        x="40"
        y="88"
        width="56"
        height="40"
        rx="4"
        className="stroke-primary/50"
        strokeWidth="1.2"
        fill="rgb(30 58 138 / 0.15)"
      />
      <rect x="108" y="88" width="52" height="18" rx="3" className="fill-gray-700" />
      <rect x="108" y="112" width="52" height="16" rx="3" className="fill-gray-700" />
    </svg>
  );
}
