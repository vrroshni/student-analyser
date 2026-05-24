"use client";

import * as React from "react";
import type { TooltipProps } from "recharts";
import { ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

export type TooltipExtraRow = {
  label: React.ReactNode;
  value: React.ReactNode;
};

export type TooltipStatusChip = {
  label: string;
  tone: "good" | "warn" | "bad";
};

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    // Accepted for API compatibility; chart colors live in :root (--chart-1..4)
    // and are referenced directly by stroke/fill, so no inline override here.
    config?: ChartConfig;
  }
>(({ className, children }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "h-[260px] w-full rounded-lg border border-border/70 bg-background/40 p-3",
        className
      )}
    >
      <ResponsiveContainer>{children as any}</ResponsiveContainer>
    </div>
  );
});
ChartContainer.displayName = "ChartContainer";

const PERCENT_KEYS = new Set(["percentage", "attendance"]);

function formatValueForKey(value: any, dataKey: string | undefined): string {
  if (typeof value !== "number") return String(value);
  if (dataKey && PERCENT_KEYS.has(dataKey)) {
    return `${value.toFixed(1)}%`;
  }
  return `${value.toFixed(0)} marks`;
}

const TONE_CLASSES: Record<TooltipStatusChip["tone"], string> = {
  good: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  warn: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  bad: "border-rose-500/40 bg-rose-500/15 text-rose-200"
};

type ChartTooltipContentProps = TooltipProps<any, any> & {
  labelFormatter?: (label: any) => React.ReactNode;
  valueFormatter?: (value: any, dataKey?: string) => React.ReactNode;
  extraRows?: (row: any) => TooltipExtraRow[];
  statusChip?: (row: any) => TooltipStatusChip | null | undefined;
};

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, payload, label, labelFormatter, valueFormatter, extraRows, statusChip }, ref) => {
    if (!active || !payload?.length) return null;

    const vf = valueFormatter ?? formatValueForKey;
    const row = payload[0]?.payload;
    const extras = extraRows && row ? extraRows(row) : [];
    const chip = statusChip && row ? statusChip(row) : null;

    return (
      <div
        ref={ref}
        className="min-w-[200px] rounded-lg border border-primary/30 bg-background/95 px-3.5 py-2.5 text-xs shadow-lg shadow-primary/10 backdrop-blur"
      >
        <div className="mb-1.5 text-sm font-semibold text-foreground">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>

        <div className="space-y-1">
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
              </div>
              <div className="font-semibold text-foreground">{vf(p.value, p.dataKey)}</div>
            </div>
          ))}
        </div>

        {extras.length > 0 && (
          <>
            <div className="my-2 h-px bg-border/60" />
            <div className="space-y-1">
              {extras.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-6">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {chip && (
          <div className="mt-2.5 flex justify-end">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                TONE_CLASSES[chip.tone]
              )}
            >
              {chip.label}
            </span>
          </div>
        )}
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// Re-export recharts' Tooltip directly so the chart wrappers (LineChart,
// BarChart, …) recognise it via `displayName === "Tooltip"`. A custom
// wrapper component breaks that lookup and silently disables the tooltip.
const ChartTooltip = Tooltip;

// Cursor presets — spread at the call site so the chart type drives the
// hover affordance (dashed line for line charts, soft column for bars).
const lineChartCursor = {
  stroke: "hsl(var(--primary))",
  strokeOpacity: 0.35,
  strokeWidth: 1,
  strokeDasharray: "3 3"
} as const;

const barChartCursor = {
  fill: "hsl(var(--primary))",
  fillOpacity: 0.08
} as const;

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  lineChartCursor,
  barChartCursor
};
