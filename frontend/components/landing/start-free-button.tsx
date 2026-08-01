"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LANDING_CTAS } from "@/lib/landing/landing-copy";
import { cn } from "@/lib/utils/cn";

interface StartFreeButtonProps {
  className?: string;
  label?: string;
  size?: "default" | "lg";
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export function StartFreeButton({
  className,
  label,
  size = "default",
  variant = "primary",
  fullWidth,
}: StartFreeButtonProps) {
  const { isAuthenticated } = useAuthStore();
  const href = isAuthenticated ? "/dashboard" : "/auth/signup";
  const text = isAuthenticated ? LANDING_CTAS.dashboard : (label ?? LANDING_CTAS.startFree);

  return (
    <Link href={href} className={cn(fullWidth && "w-full block")}>
      <Button
        size={size}
        className={cn(
          "rounded-lg font-medium transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
          variant === "primary" && "bg-primary hover:bg-primary/90 text-white",
          variant === "secondary" &&
            "bg-transparent border border-gray-700 text-white hover:bg-gray-900 hover:border-gray-600",
          size === "lg" && "min-h-[48px] px-8 text-base",
          fullWidth && "w-full",
          className
        )}
      >
        {text}
      </Button>
    </Link>
  );
}
