/**
 * Smooth page entrance for the app areas. Used from route `template.tsx` files, which Next.js
 * re-mounts on every navigation, so each page fades and rises in (≈350 ms). Respects
 * "reduce motion" (no animation).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col animate-in duration-500 ease-out fade-in slide-in-from-bottom-2 fill-mode-both motion-reduce:animate-none">{children}</div>;
}
