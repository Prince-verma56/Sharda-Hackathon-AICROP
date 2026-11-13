'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const green = 'var(--crop-green-600)';

export function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const config = { count: { label: 'Diagnoses', color: green } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs><linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={green} stopOpacity={0.35} /><stop offset="95%" stopColor={green} stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area dataKey="count" type="monotone" stroke={green} strokeWidth={2} fill="url(#fillCount)" />
      </AreaChart>
    </ChartContainer>
  );
}

export function HBarChart({ data, label }: { data: { name: string; count: number }[]; label: string }) {
  const config = { count: { label, color: green } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 34) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill={green} radius={6} />
      </BarChart>
    </ChartContainer>
  );
}

const PIE = ['#4a7a33', '#c9e3b3', '#e3b341', '#d97757', '#9aa39a'];

export function DonutChart({ data }: { data: { name: string; count: number }[] }) {
  const config = Object.fromEntries(data.map((d, i) => [d.name, { label: d.name, color: PIE[i % PIE.length] }])) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-square h-[220px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={55} strokeWidth={2}>
          {data.map((d, i) => <Cell key={d.name} fill={PIE[i % PIE.length]} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
