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

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    config?: ChartConfig;
  }
>(({ className, children, config }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "h-[260px] w-full rounded-lg border border-border/70 bg-background/40 p-3",
        className
      )}
      style={
        config
          ? ({
              "--chart-1": config[Object.keys(config)[0]]?.color,
              "--chart-2": config[Object.keys(config)[1]]?.color,
              "--chart-3": config[Object.keys(config)[2]]?.color,
              "--chart-4": config[Object.keys(config)[3]]?.color
            } as React.CSSProperties)
          : undefined
      }
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
  // Marks (internal / university / unknown) — whole numbers read cleaner.
  return `${value.toFixed(0)} marks`;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipProps<any, any> & {
    labelFormatter?: (label: any) => React.ReactNode;
    valueFormatter?: (value: any, dataKey?: string) => React.ReactNode;
  }
>(({ active, payload, label, labelFormatter, valueFormatter }, ref) => {
  if (!active || !payload?.length) return null;

  const vf = valueFormatter ?? formatValueForKey;
  return (
    <div
      ref={ref}
      className="rounded-lg border border-primary/30 bg-background/95 px-3.5 py-2.5 text-xs shadow-lg shadow-primary/10 backdrop-blur"
    >
      <div className="mb-1.5 font-semibold text-foreground">
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
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

function ChartTooltip(props: TooltipProps<any, any>) {
  return (
    <Tooltip
      cursor={{
        stroke: "hsl(var(--primary))",
        strokeOpacity: 0.35,
        strokeWidth: 1,
        strokeDasharray: "3 3"
      }}
      content={<ChartTooltipContent />}
      {...props}
    />
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
