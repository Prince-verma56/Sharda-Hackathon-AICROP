"use client";

import React, { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isFeatureEnabled } from "@/config/features";

interface PreloaderContextType {
  isPreloaderComplete: boolean;
  setPreloaderComplete: (status: boolean) => void;
}

const PreloaderContext = createContext<PreloaderContextType | undefined>(undefined);

export function PreloaderProvider({ children }: { children: ReactNode }) {
  const isPreloaderFeatureEnabled = isFeatureEnabled("preloader");
  // The intro preloader belongs to the public marketing site only. Farmer, admin and dev
  // tools must render immediately (slow phones, repeated hard navigations).
  const pathname = usePathname() ?? "/";
  const isAppRoute = /^\/(farmer|admin|dev|volunteer|login|signup|register|workspaces|auth)(\/|$)/.test(pathname);
  // If preloader is disabled (or not wanted on this route), it's instantly complete
  const [isPreloaderComplete, setPreloaderComplete] = useState(!isPreloaderFeatureEnabled || isAppRoute);

  return (
    <PreloaderContext.Provider value={{ isPreloaderComplete, setPreloaderComplete }}>
      {children}
    </PreloaderContext.Provider>
  );
}

export function usePreloader() {
  const context = useContext(PreloaderContext);
  if (context === undefined) {
    throw new Error("usePreloader must be used within a PreloaderProvider");
  }
  return context;
}
