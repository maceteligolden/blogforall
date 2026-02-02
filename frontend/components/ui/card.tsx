import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          {
            "bg-gray-900 border border-gray-800": variant === "default",
            "border border-gray-700": variant === "outline",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export { Card };
