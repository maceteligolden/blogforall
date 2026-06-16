"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <GlobalErrorContent onReset={reset} message={error.message} />
      </body>
    </html>
  );
}

function GlobalErrorContent({ onReset, message }: { onReset: () => void; message: string }) {
  return (
    <div className="max-w-md text-center space-y-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-gray-400">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
