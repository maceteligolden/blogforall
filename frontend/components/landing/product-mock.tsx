import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** Each variant maps to a unique demo asset — no screenshot reuse. */
export type MockVariant = "workspace" | "goal" | "context" | "research" | "draft" | "calendar" | "memory";

interface ProductMockProps {
  variant?: MockVariant;
  className?: string;
  annotation?: string;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
}

const DEMO_SRC: Record<MockVariant, string> = {
  workspace: "/demos/blog_genereated_conversational.png",
  goal: "/demos/ai_topic_generation.png",
  context: "/demos/user_gives_context.png",
  research: "/demos/ai_researches.png",
  draft: "/demos/post_plan_generated.png",
  calendar: "/demos/post_scheduled.png",
  memory: "/demos/ai_gets_user_onboarded.png",
};

const LABELS: Record<MockVariant, string> = {
  workspace: "Bloggr workspace with conversation and draft",
  goal: "AI topic suggestions for a new post",
  context: "Adding context and constraints to an AI post",
  research: "Orchestrator researching with sources",
  draft: "AI-generated post plan and outline",
  calendar: "Publishing calendar with a scheduled post",
  memory: "Workspace onboarding gathering business context",
};

export function ProductMock({
  variant = "workspace",
  className,
  annotation,
  alt,
  decorative = false,
  priority = false,
}: ProductMockProps) {
  const label = alt ?? LABELS[variant];
  const src = DEMO_SRC[variant];

  return (
    <figure className={cn("relative group/mock", className)} aria-hidden={decorative || undefined}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-gray-700/90 bg-[#0a0a0a]",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_48px_-24px_rgba(0,0,0,0.8)]",
          "ring-1 ring-primary/10",
          !decorative &&
            "transition-[transform,border-color,box-shadow] duration-300 ease-out motion-safe:group-hover/mock:-translate-y-1 motion-safe:group-hover/mock:border-gray-600 motion-safe:group-hover/mock:ring-primary/25"
        )}
      >
        <div className="flex h-8 items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.04] px-3">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="ml-2 h-1.5 flex-1 max-w-[40%] rounded-full bg-white/10" />
        </div>
        <div className="relative aspect-[16/10] w-full">
          <Image
            src={src}
            alt={decorative ? "" : label}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 55vw, 640px"
            className="object-cover object-top"
            priority={priority}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
            aria-hidden
          />
        </div>
      </div>

      {annotation && !decorative && (
        <figcaption className="mt-3 text-center text-xs text-primary/90">{annotation}</figcaption>
      )}
    </figure>
  );
}
