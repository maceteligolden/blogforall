"use client";

import { useIdentifyUser } from "./hooks/use-identify-user";

export function IdentifyUserProvider({ children }: { children: React.ReactNode }) {
  useIdentifyUser();
  return <>{children}</>;
}
