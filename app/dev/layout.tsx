/**
 * /dev/* — internal engineering tools. Not part of the farmer-facing product.
 * Returns 404 in production builds unless ENABLE_DEV_TOOLS=true is set explicitly.
 */
import { notFound } from 'next/navigation';
import { isDevToolsEnabled } from './dev-tools';

export default function DevToolsLayout({ children }: { children: React.ReactNode }) {
  if (!isDevToolsEnabled()) notFound();
  return <div className="flex min-h-full flex-1 flex-col bg-muted/30 font-sans">{children}</div>;
}
