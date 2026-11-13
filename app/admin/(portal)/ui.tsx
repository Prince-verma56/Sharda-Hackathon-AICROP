import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon }) {
  return (
    <Card className="gap-2 rounded-2xl">
      <CardContent className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-sm text-muted-foreground">{label}<Icon className="size-4 text-[var(--crop-green-600)]" /></span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

const REVIEW_STYLE: Record<string, string> = {
  UNREVIEWED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-100 text-amber-900',
  NEEDS_INFO: 'bg-orange-100 text-orange-900',
  CONFIRMED: 'bg-[var(--crop-green-100)] text-[var(--crop-green-900)]',
  CHALLENGED: 'bg-red-100 text-red-900',
};

export function ReviewBadge({ status }: { status: string }) {
  return <Badge className={cn('border-0 font-medium', REVIEW_STYLE[status])}>{status.replace('_', ' ').toLowerCase()}</Badge>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-white/60 px-6 py-12 text-center">
      <span className="font-medium">{title}</span>
      <span className="max-w-md text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

export const fmtDate = (d: Date) => d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
