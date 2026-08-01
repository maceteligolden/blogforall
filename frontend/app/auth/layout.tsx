import type { ReactNode } from "react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthSplitLayout>{children}</AuthSplitLayout>
    </ToastProvider>
  );
}
