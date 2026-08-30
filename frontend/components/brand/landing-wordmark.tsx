import { BRAND_ASSETS } from "@/lib/brand/assets";
import { cn } from "@/lib/utils/cn";

type LandingWordmarkProps = {
  className?: string;
};

/** White wordmark for dark landing chrome (header / footer). */
export function LandingWordmark({ className }: LandingWordmarkProps) {
  return (
    <img
      src={BRAND_ASSETS.logoWhite}
      alt="Bloggr"
      width={100}
      height={40}
      className={cn("h-8 w-auto", className)}
    />
  );
}
