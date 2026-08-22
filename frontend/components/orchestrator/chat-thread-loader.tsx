"use client";

/**
 * Full-pane placeholder while the visible thread is switching or still loading.
 * Replaces the transcript so a previous conversation cannot flash through.
 */
export function ChatThreadLoader({ message = "Loading conversation…" }: { message?: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center py-16 px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary mb-4"
        aria-hidden
      />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
