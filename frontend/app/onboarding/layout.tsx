import { OnboardingProviders } from "@/components/onboarding/onboarding-providers";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingProviders>{children}</OnboardingProviders>;
}
