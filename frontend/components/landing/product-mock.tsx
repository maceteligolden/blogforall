import { cn } from "@/lib/utils/cn";

type MockVariant = "workspace" | "goal" | "context" | "research" | "draft" | "calendar" | "memory" | "api";

interface ProductMockProps {
  variant?: MockVariant;
  className?: string;
  annotation?: string;
  alt?: string;
  decorative?: boolean;
}

const LABELS: Record<MockVariant, string> = {
  workspace: "Product screenshot — workspace",
  goal: "Product screenshot — goal",
  context: "Product screenshot — context",
  research: "Product screenshot — sources",
  draft: "Product screenshot — draft",
  calendar: "Product screenshot — calendar",
  memory: "Product screenshot — memory",
  api: "Product screenshot — API",
};

/** Grey card placeholders until real screenshots are captured (LPRD SH-*). */
export function ProductMock({
  variant = "workspace",
  className,
  annotation,
  alt,
  decorative = false,
}: ProductMockProps) {
  const label = alt ?? LABELS[variant];

  return (
    <figure className={cn("relative", className)} aria-hidden={decorative || undefined}>
      <div
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        className="relative flex min-h-[220px] sm:min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-gray-700 bg-gray-800"
      >
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-300">{LABELS[variant]}</p>
          <p className="mt-2 text-xs text-gray-500">Placeholder</p>
        </div>
      </div>

      {annotation && !decorative && (
        <figcaption className="mt-3 text-center text-xs text-primary/90">{annotation}</figcaption>
      )}
    </figure>
  );
}
