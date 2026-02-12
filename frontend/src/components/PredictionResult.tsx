"use client";

import type { PredictionOutput } from "./StudentForm";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function dotClassFor(prediction: string): string {
  const p = prediction.toLowerCase();
  if (p.includes("good")) return "bg-emerald-400";
  if (p.includes("average")) return "bg-amber-400";
  return "bg-rose-400";
}

export function PredictionResult({ result }: { result: PredictionOutput | null }) {
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

  const maxAbs = Math.max(
    1e-9,
    ...result.feature_contributions.map((c) => Math.abs(c.contribution))
  );

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
          <div className="text-sm font-semibold">{result.prediction}</div>
        </div>

        <div>
          <div className="text-sm font-semibold">Feature contributions</div>
          <div className="mt-3 space-y-3">
            {result.feature_contributions.map((c) => {
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
