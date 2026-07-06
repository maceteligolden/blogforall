import type { ReactNode } from "react";
import { AuthAbstractPanel } from "./auth-abstract-panel";
import { cn } from "@/lib/utils/cn";

type AuthSplitLayoutProps = {
  children: ReactNode;
  /** Wider content column for multi-column flows (e.g. plan selection). */
  wide?: boolean;
};

export function AuthSplitLayout({ children, wide = false }: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white lg:h-dvh lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-full lg:grid-cols-2">
        <div className="lg:sticky lg:top-0 lg:h-full lg:overflow-hidden">
          <AuthAbstractPanel />
        </div>

        <div className="flex flex-col px-4 py-10 sm:px-8 lg:h-full lg:overflow-y-auto lg:px-12 xl:px-16">
          <div
            className={cn(
              "mx-auto my-auto w-full py-4",
              wide ? "max-w-6xl" : "max-w-md"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
