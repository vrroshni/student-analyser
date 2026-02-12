"use client";

import type { PredictionOutput } from "./StudentForm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

function dotClassFor(prediction: string): string {
  const p = prediction.toLowerCase();
  if (p.includes("good")) return "bg-emerald-400";
  if (p.includes("average")) return "bg-amber-400";
  return "bg-rose-400";
}

function badgeVariantFor(prediction: string): "success" | "warning" | "danger" {
  const p = prediction.toLowerCase();
  if (p.includes("good")) return "success";
  if (p.includes("average")) return "warning";
  return "danger";
}

function buildExplanation(result: PredictionOutput, contributions: PredictionOutput["feature_contributions"]): string {
  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
  );
  const top = sorted.slice(0, 2);
  const positives = top.filter((t) => t.contribution >= 0);
  const negatives = top.filter((t) => t.contribution < 0);

  const parts: string[] = [];
  if (positives.length) {
    parts.push(
      `Main factors pushing toward "${result.prediction}": ${positives
        .map((p) => `${p.feature} (${p.value})`)
        .join(", ")}.`
    );
  }
  if (negatives.length) {
    parts.push(
      `Factors pulling away: ${negatives
        .map((n) => `${n.feature} (${n.value})`)
        .join(", ")}.`
    );
  }

  if (!parts.length) {
    return "Explanation is not available for this prediction.";
  }
  return parts.join(" ");
}

export function PredictionResult({
  result,
  loading
}: {
  result: PredictionOutput | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="border-border/70 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle>Prediction</CardTitle>
          <CardDescription>Running model inference…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/40" />
          <div className="h-24 w-full animate-pulse rounded bg-muted/20" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="border-border/70 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle>Prediction</CardTitle>
          <CardDescription>Submit the form to see prediction + contributions.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }

  const dotClass = dotClassFor(result.prediction);

  const providedSemesters = new Set((result.semesters ?? []).map((s) => s.semester));
  const filteredContributions = (result.feature_contributions ?? []).filter((c) => {
    if (c.feature === "age") return true;
    const m = /^sem(\d+)_(internal|university|attendance)$/.exec(c.feature);
    if (!m) return true;
    const sem = Number(m[1]);
    return providedSemesters.has(sem);
  });

  const maxAbs = Math.max(
    1e-9,
    ...filteredContributions.map((c) => Math.abs(c.contribution))
  );

  const chartData = (result.semesters ?? []).map((s) => {
    const obtained = (s.internal_marks ?? 0) + (s.university_marks ?? 0);
    const pct = (obtained / 600) * 100;
    return {
      semester: `Sem ${s.semester}`,
      percentage: Number.isFinite(pct) ? pct : 0,
      attendance: s.attendance ?? 0,
      internal: s.internal_marks ?? 0,
      university: s.university_marks ?? 0
    };
  });

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Prediction</CardTitle>
        <CardDescription>
          Model: <span className="font-medium">{result.model_used}</span> · Confidence:{" "}
          <span className="font-medium">{Math.round(result.confidence * 100)}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={"h-2.5 w-2.5 rounded-full " + dotClass} />
          <Badge variant={badgeVariantFor(result.prediction)}>{result.prediction}</Badge>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-muted-foreground">
              Department: <span className="font-medium text-foreground">{result.department ?? "-"}</span>
            </div>
            <div className="text-muted-foreground">
              Semesters: <span className="font-medium text-foreground">{chartData.length || 0}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
          {buildExplanation(result, filteredContributions)}
        </div>

        <div>
          <div className="text-sm font-semibold">Student performance</div>
          {chartData.length ? (
            <Tabs defaultValue="percentage" className="mt-3">
              <TabsList>
                <TabsTrigger value="percentage">Percentage</TabsTrigger>
                <TabsTrigger value="attendance">Attendance</TabsTrigger>
                <TabsTrigger value="marks">Marks Split</TabsTrigger>
              </TabsList>

              <TabsContent value="percentage">
                <ChartContainer
                  config={{
                    percentage: { label: "Percentage", color: "hsl(var(--chart-1, 210 100% 66%))" }
                  }}
                >
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      name="%"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </TabsContent>

              <TabsContent value="attendance">
                <ChartContainer
                  config={{
                    attendance: { label: "Attendance", color: "hsl(var(--chart-2, 164 100% 40%))" }
                  }}
                >
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip />
                    <Line
                      type="monotone"
                      dataKey="attendance"
                      name="Attendance %"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ChartContainer>
              </TabsContent>

              <TabsContent value="marks">
                <ChartContainer
                  config={{
                    internal: { label: "Internal", color: "hsl(var(--chart-3, 48 100% 60%))" },
                    university: { label: "University", color: "hsl(var(--chart-4, 330 100% 70%))" }
                  }}
                >
                  <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 600]} tickLine={false} axisLine={false} />
                    <ChartTooltip />
                    <Bar dataKey="internal" name="Internal" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="university" name="University" stackId="a" fill="#fb7185" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
              No semester data available for charting.
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold">Feature contributions</div>
          <div className="mt-3 space-y-3">
            {filteredContributions.map((c) => {
              const pct = Math.min(1, Math.abs(c.contribution) / maxAbs);
              const direction = c.contribution >= 0 ? "+" : "-";
              return (
                <div key={c.feature} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{c.feature}</div>
                    <div className="text-xs text-muted-foreground">
                      value: <span className="font-medium text-foreground">{c.value}</span> · shap:{" "}
                      <span className="font-medium text-foreground">
                        {direction + Math.abs(c.contribution).toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full border border-border bg-muted/30">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Note: For DL, contributions may be slower/approx depending on SHAP availability.
        </div>
      </CardContent>
    </Card>
  );
}
