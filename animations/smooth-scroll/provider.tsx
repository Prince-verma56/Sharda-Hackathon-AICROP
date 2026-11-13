'use client';

/**
 * Smooth Scroll Provider
 *
 * Initializes Lenis for smooth scrolling and coordinates with
 * GSAP ScrollTrigger. Only one Lenis instance is created.
 *
 * Wrap your application with <SmoothScrollProvider> in the root layout.
 */

import { useEffect, createContext, useContext, useState, type ReactNode } from 'react';
import Lenis from '@studio-freight/lenis';
import { gsap, ScrollTrigger, registerGsapPlugins } from '../core';

interface SmoothScrollContextValue {
  lenis: Lenis | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
});

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}

interface SmoothScrollProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function SmoothScrollProvider({
  children,
  enabled = true,
}: SmoothScrollProviderProps) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;

    registerGsapPlugins();

    const lenisInstance = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(lenisInstance);

    // Coordinate Lenis with GSAP ScrollTrigger
    lenisInstance.on('scroll', ScrollTrigger.update);

    // Keep a reference so cleanup removes the exact callback that was added
    // (removing lenisInstance.raf left a stale ticker running after remounts).
    const tick = (time: number) => {
      lenisInstance.raf(time * 1000);
    };
    gsap.ticker.add(tick);

    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenisInstance.destroy();
      setLenis(null);
    };
  }, [enabled]);

  return (
    <SmoothScrollContext value={{ lenis }}>
      {children}
    </SmoothScrollContext>
  );
}
