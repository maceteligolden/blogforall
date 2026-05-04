/** Minimal “review / scores” motif. */
export function IllustrationReview({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M28 96c32-48 112-48 144 0" className="stroke-gray-700" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 96 A 72 72 0 0 1 100 40" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="88" r="6" className="fill-primary" />
      <path
        d="M124 52l8 8 16-20"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="36"
        y="112"
        width="128"
        height="28"
        rx="6"
        className="stroke-gray-700"
        strokeWidth="1.2"
        fill="rgb(17 24 39 / 0.4)"
      />
      <rect x="48" y="122" width="40" height="4" rx="1" className="fill-gray-500" />
      <rect x="48" y="130" width="72" height="3" rx="1" className="fill-gray-600" />
    </svg>
  );
}
