/** Minimal calendar / schedule motif. */
export function IllustrationCalendar({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`text-primary ${className}`}
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="32"
        y="36"
        width="136"
        height="104"
        rx="10"
        className="stroke-gray-700"
        strokeWidth="1.5"
        fill="rgb(17 24 39 / 0.5)"
      />
      <path d="M32 56h136" className="stroke-gray-600" strokeWidth="1.2" />
      <rect x="44" y="44" width="24" height="8" rx="2" className="fill-primary/35" />
      <rect x="132" y="44" width="24" height="8" rx="2" className="fill-gray-600" />
      {[0, 1, 2, 3].flatMap((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={48 + col * 28}
            y={68 + row * 22}
            width="20"
            height="16"
            rx="3"
            className={row === 1 && col === 2 ? "fill-primary/50 stroke-primary/80" : "fill-gray-800 stroke-gray-700"}
            strokeWidth="1"
          />
        ))
      )}
    </svg>
  );
}
