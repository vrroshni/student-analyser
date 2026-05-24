"use client";

import type { PredictionOutput } from "./StudentForm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  barChartCursor,
  lineChartCursor,
  type TooltipExtraRow,
  type TooltipStatusChip
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

function dotClassFor(prediction: string): string {
  const p = prediction.toLowerCase();
  if (p.includes("best")) return "bg-violet-400";
  if (p.includes("good")) return "bg-emerald-400";
  return "bg-rose-400";
}

function badgeVariantFor(prediction: string): "best" | "success" | "danger" {
  const p = prediction.toLowerCase();
  if (p.includes("best")) return "best";
  if (p.includes("good")) return "success";
  return "danger";
}

const ATTENDANCE_STANDARD = 80;
const MARKS_STANDARD = 85;

function attendanceTone(avg: number): { tone: "good" | "warn" | "bad"; label: string; tile: string; text: string } {
  if (avg >= ATTENDANCE_STANDARD) {
    return {
      tone: "good",
      label: "Meets 80% standard",
      tile: "border-emerald-500/30 bg-emerald-500/10",
      text: "text-emerald-300"
    };
  }
  if (avg >= 60) {
    return {
      tone: "warn",
      label: "Below 80% standard",
      tile: "border-amber-500/30 bg-amber-500/10",
      text: "text-amber-300"
    };
  }
  return {
    tone: "bad",
    label: "Critically low attendance",
    tile: "border-rose-500/30 bg-rose-500/10",
    text: "text-rose-300"
  };
}

function marksTone(avg: number): { tone: "good" | "warn" | "bad"; label: string; tile: string; text: string } {
  if (avg >= MARKS_STANDARD) {
    return {
      tone: "good",
      label: "Meets 85% standard",
      tile: "border-emerald-500/30 bg-emerald-500/10",
      text: "text-emerald-300"
    };
  }
  if (avg >= 70) {
    return {
      tone: "warn",
      label: "Below 85% standard",
      tile: "border-amber-500/30 bg-amber-500/10",
      text: "text-amber-300"
    };
  }
  return {
    tone: "bad",
    label: "Marks need urgent attention",
    tile: "border-rose-500/30 bg-rose-500/10",
    text: "text-rose-300"
  };
}

type SemesterRow = {
  semester: string;
  percentage: number;
  attendance: number;
  internal: number;
  university: number;
};

function percentageTooltipRows(row: SemesterRow): TooltipExtraRow[] {
  const total = row.internal + row.university;
  return [
    { label: "Internal", value: `${row.internal} / 300` },
    { label: "University", value: `${row.university} / 300` },
    { label: "Total", value: `${total} / 600` },
    { label: "Attendance", value: `${row.attendance.toFixed(1)}%` }
  ];
}

function percentageTooltipChip(row: SemesterRow): TooltipStatusChip {
  if (row.percentage >= MARKS_STANDARD) return { label: "Meets 85% standard", tone: "good" };
  if (row.percentage >= 70) return { label: "Below 85% standard", tone: "warn" };
  return { label: "Marks critically low", tone: "bad" };
}

function attendanceTooltipRows(row: SemesterRow): TooltipExtraRow[] {
  const total = row.internal + row.university;
  return [
    { label: "Marks", value: `${row.percentage.toFixed(1)}%` },
    { label: "Internal", value: `${row.internal} / 300` },
    { label: "University", value: `${row.university} / 300` },
    { label: "Total", value: `${total} / 600` }
  ];
}

function attendanceTooltipChip(row: SemesterRow): TooltipStatusChip {
  if (row.attendance >= ATTENDANCE_STANDARD) return { label: "Meets 80% standard", tone: "good" };
  if (row.attendance >= 60) return { label: "Below 80% standard", tone: "warn" };
  return { label: "Attendance critically low", tone: "bad" };
}

function marksTooltipRows(row: SemesterRow): TooltipExtraRow[] {
  const total = row.internal + row.university;
  return [
    { label: "Total", value: `${total} / 600` },
    { label: "Percentage", value: `${row.percentage.toFixed(1)}%` },
    { label: "Attendance", value: `${row.attendance.toFixed(1)}%` }
  ];
}

function marksTooltipChip(row: SemesterRow): TooltipStatusChip {
  if (row.percentage >= MARKS_STANDARD) return { label: "Meets 85% standard", tone: "good" };
  if (row.percentage >= 70) return { label: "Below 85% standard", tone: "warn" };
  return { label: "Marks critically low", tone: "bad" };
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
  loading,
  userRole,
  onTryAlternate,
}: {
  result: PredictionOutput | null;
  loading?: boolean;
  userRole?: "teacher" | "student" | "admin" | null;
  onTryAlternate?: () => void;
}) {
  const isAdmin = userRole === "admin";
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

  const avgAttendance = chartData.length
    ? chartData.reduce((acc, d) => acc + d.attendance, 0) / chartData.length
    : 0;
  const avgMarksPct = chartData.length
    ? chartData.reduce((acc, d) => acc + d.percentage, 0) / chartData.length
    : 0;
  const attTone = attendanceTone(avgAttendance);
  const marksToneInfo = marksTone(avgMarksPct);

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur transition-shadow hover:shadow-lg hover:shadow-violet-500/10">
      <CardHeader>
        <CardTitle>Prediction</CardTitle>
        <CardDescription>
          {isAdmin ? (
            <>
              Model: <span className="font-medium">{result.model_used}</span> · Confidence:{" "}
              <span className="font-medium">{Math.round(result.confidence * 100)}%</span>
              {result.model_accuracy != null && (
                <>
                  {" "}· Model Accuracy:{" "}
                  <span className="font-medium">{Math.round(result.model_accuracy * 100)}%</span>
                </>
              )}
            </>
          ) : (
            <>
              {result.model_used.toLowerCase().includes("random forest") ? "Approach 1" : "Alternate Approach"}
              {" "}· Confidence:{" "}
              <span className="font-medium">{Math.round(result.confidence * 100)}%</span>
            </>
          )}
        </CardDescription>
        {!isAdmin && onTryAlternate && (
          <div
            className="mt-2 cursor-pointer rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
            onClick={onTryAlternate}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTryAlternate(); }}
          >
            <span className="font-medium">Want to test it again?</span>{" "}
            Try an alternate approach &rarr;
          </div>
        )}
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

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border px-4 py-3 ${attTone.tile}`}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg Attendance</div>
                <div className={`text-2xl font-bold ${attTone.text}`}>{avgAttendance.toFixed(1)}%</div>
              </div>
              <div className={`mt-1 text-xs ${attTone.text}`}>{attTone.label}</div>
            </div>
            <div className={`rounded-lg border px-4 py-3 ${marksToneInfo.tile}`}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg Marks</div>
                <div className={`text-2xl font-bold ${marksToneInfo.text}`}>{avgMarksPct.toFixed(1)}%</div>
              </div>
              <div className={`mt-1 text-xs ${marksToneInfo.text}`}>{marksToneInfo.label}</div>
            </div>
          </div>
        )}

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
                    percentage: { label: "Percentage", color: "hsl(var(--chart-1))" }
                  }}
                >
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={lineChartCursor}
                      content={
                        <ChartTooltipContent
                          extraRows={percentageTooltipRows}
                          statusChip={percentageTooltipChip}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      name="Percentage"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 0, fill: "hsl(var(--chart-1))" }}
                      activeDot={{ r: 8, strokeWidth: 2, stroke: "#fff", fill: "hsl(var(--chart-1))" }}
                    />
                  </LineChart>
                </ChartContainer>
              </TabsContent>

              <TabsContent value="attendance">
                <ChartContainer
                  config={{
                    attendance: { label: "Attendance", color: "hsl(var(--chart-2))" }
                  }}
                >
                  <LineChart data={chartData} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={lineChartCursor}
                      content={
                        <ChartTooltipContent
                          extraRows={attendanceTooltipRows}
                          statusChip={attendanceTooltipChip}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="attendance"
                      name="Attendance"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--chart-2))", fill: "hsl(var(--background))" }}
                      activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff", fill: "hsl(var(--chart-2))" }}
                    />
                  </LineChart>
                </ChartContainer>
              </TabsContent>

              <TabsContent value="marks">
                <ChartContainer
                  config={{
                    internal: { label: "Internal", color: "hsl(var(--chart-3))" },
                    university: { label: "University", color: "hsl(var(--chart-4))" }
                  }}
                >
                  <BarChart data={chartData} margin={{ left: 8, right: 8, top: 12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="semester" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 600]} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      cursor={barChartCursor}
                      content={
                        <ChartTooltipContent
                          extraRows={marksTooltipRows}
                          statusChip={marksTooltipChip}
                        />
                      }
                    />
                    <Bar dataKey="internal" name="Internal" stackId="a" fill="hsl(var(--chart-3))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="university" name="University" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
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

      </CardContent>
    </Card>
  );
}
