import Link from "next/link";

function BlogPostIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] aspect-[4/5] sm:max-w-[320px]">
      {/* Soft ambient glow */}
      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[72px]" />

      {/* Back card */}
      <div
        className="absolute inset-x-6 top-[18%] h-[62%] rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-2xl shadow-black/40"
        style={{ transform: "rotate(-6deg) translateY(12px) scale(0.92)" }}
      />

      {/* Middle card */}
      <div
        className="absolute inset-x-4 top-[12%] h-[66%] rounded-2xl border border-white/[0.08] bg-white/[0.05] shadow-2xl shadow-black/50"
        style={{ transform: "rotate(3deg) translateY(6px) scale(0.96)" }}
      />

      {/* Front card */}
      <div className="absolute inset-x-0 top-[6%] h-[72%] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.04] p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/10" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-16 rounded-full bg-white/25" />
            <div className="h-1.5 w-10 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="mb-6 space-y-2">
          <div className="h-2 w-3/4 rounded-full bg-white/20" />
          <div className="h-2 w-full rounded-full bg-white/10" />
          <div className="h-2 w-full rounded-full bg-white/10" />
          <div className="h-2 w-2/3 rounded-full bg-white/10" />
        </div>

        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-white/[0.07]" />
          <div className="h-1.5 w-full rounded-full bg-white/[0.07]" />
          <div className="h-1.5 w-5/6 rounded-full bg-white/[0.07]" />
          <div className="h-1.5 w-full rounded-full bg-white/[0.07]" />
          <div className="h-1.5 w-4/5 rounded-full bg-white/[0.07]" />
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
          <div className="h-2 w-20 rounded-full bg-white/10" />
          <div className="h-8 w-20 rounded-lg bg-primary/80" />
        </div>
      </div>
    </div>
  );
}

export function AuthAbstractPanel() {
  return (
    <div className="relative flex h-full min-h-[220px] sm:min-h-[280px] lg:min-h-0 w-full flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Subtle background wash */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(30,64,175,0.18),transparent_70%)]" />

      <div className="relative z-10 flex h-full flex-col px-8 py-10 lg:px-14 lg:py-14">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-white/90 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-sm"
          aria-label="Bloggr home"
        >
          Bloggr
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-8 lg:py-12">
          <div className="origin-center scale-[0.72] sm:scale-90 lg:scale-100">
            <BlogPostIllustration />
          </div>
        </div>

        <div className="hidden space-y-3 lg:block">
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-tight text-white lg:text-[32px]">
            Your ideas,
            <br />
            published beautifully.
          </h2>
          <p className="max-w-[280px] text-[15px] leading-relaxed text-white/45">
            Create, schedule, and grow your blog — all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
