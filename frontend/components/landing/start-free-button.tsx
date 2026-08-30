"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { landingTracker } from "@/lib/analytics/flows/landing.tracker";
import { useLandingResumeCta } from "@/lib/onboarding/use-landing-resume";
import { cn } from "@/lib/utils/cn";

interface StartFreeButtonProps {
  className?: string;
  label?: string;
  size?: "default" | "lg";
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  placement?: string;
}

export function StartFreeButton({
  className,
  label,
  size = "default",
  variant = "primary",
  fullWidth,
  placement,
}: StartFreeButtonProps) {
  const resumeCta = useLandingResumeCta();
  const href = resumeCta.href === "/auth/signup" && label ? "/auth/signup" : resumeCta.href;
  const text = resumeCta.href === "/auth/signup" ? (label ?? resumeCta.label) : resumeCta.label;

  return (
    <Link
      href={href}
      className={cn(fullWidth && "w-full block")}
      onClick={() => {
        if (!placement) return;
        landingTracker.ctaClicked({ placement, cta_label: text, href });
      }}
    >
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
