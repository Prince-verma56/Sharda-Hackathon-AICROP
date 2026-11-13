"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

// Clerk is only mounted when the app is configured to use it (AUTH_PROVIDER=clerk exposed
// as NEXT_PUBLIC_AUTH_PROVIDER). CropAI's default is first-party sessions (server/auth).
const useClerk = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || "credentials").toLowerCase() === "clerk";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!useClerk) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}
