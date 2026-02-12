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

function defaultValueFormatter(value: any): string {
  if (typeof value === "number") return value.toFixed(1);
  return String(value);
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  TooltipProps<any, any> & {
    labelFormatter?: (label: any) => React.ReactNode;
    valueFormatter?: (value: any) => React.ReactNode;
  }
>(({ active, payload, label, labelFormatter, valueFormatter }, ref) => {
  if (!active || !payload?.length) return null;

  const vf = valueFormatter ?? defaultValueFormatter;
  return (
    <div
      ref={ref}
      className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow"
    >
      <div className="mb-1 font-medium">
        {labelFormatter ? labelFormatter(label) : String(label)}
      </div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded"
                style={{ background: p.color }}
              />
              <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
            </div>
            <div className="font-medium">{vf(p.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

function ChartTooltip(props: TooltipProps<any, any>) {
  return <Tooltip cursor={false} content={<ChartTooltipContent />} {...props} />;
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
