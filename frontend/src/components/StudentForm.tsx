"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export type StudentInput = {
  age: number;
  internal_marks: number;
  previous_marks: number;
  attendance: number;
};

export type ModelType = "ml" | "dl";

export type FeatureContribution = {
  feature: string;
  value: number;
  contribution: number;
};

export type PredictionOutput = {
  prediction: string;
  confidence: number;
  model_used: string;
  feature_contributions: FeatureContribution[];
  timestamp: string;
};

type Props = {
  onResult: (r: PredictionOutput) => void;
  onError: (msg: string) => void;
};

const DEFAULTS: StudentInput = {
  age: 18,
  internal_marks: 75,
  previous_marks: 80,
  attendance: 85
};

export function StudentForm({ onResult, onError }: Props) {
  const [modelType, setModelType] = useState<ModelType>("ml");
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<StudentInput>(DEFAULTS);

  const canSubmit = useMemo(() => {
    return (
      values.age >= 15 &&
      values.age <= 30 &&
      values.internal_marks >= 0 &&
      values.internal_marks <= 100 &&
      values.previous_marks >= 0 &&
      values.previous_marks <= 100 &&
      values.attendance >= 0 &&
      values.attendance <= 100
    );
  }, [values]);

  async function submit() {
    if (!canSubmit) return;

    setLoading(true);
    onError("");

    try {
      const res = await api.post<PredictionOutput>("/predict", values, {
        params: { model_type: modelType }
      });
      onResult(res.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        onError(detail);
      } else {
        onError("Could not reach backend. Make sure FastAPI is running on http://localhost:8000");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Student Input</CardTitle>
        <CardDescription>Enter details and get a predicted category with explanations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Model</div>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={modelType}
            onChange={(e) => setModelType(e.target.value as ModelType)}
          >
            <option value="ml">ML (Random Forest)</option>
            <option value="dl">DL (Neural Network)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Age (15-30)</div>
            <Input
              type="number"
              value={values.age}
              onChange={(e) => setValues((v) => ({ ...v, age: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Attendance % (0-100)</div>
            <Input
              type="number"
              value={values.attendance}
              onChange={(e) => setValues((v) => ({ ...v, attendance: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Internal Marks (0-100)</div>
            <Input
              type="number"
              value={values.internal_marks}
              onChange={(e) =>
                setValues((v) => ({ ...v, internal_marks: Number(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Previous Marks (0-100)</div>
            <Input
              type="number"
              value={values.previous_marks}
              onChange={(e) =>
                setValues((v) => ({ ...v, previous_marks: Number(e.target.value) }))
              }
            />
          </div>
        </div>

        <Button className="w-full" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? "Predicting…" : "Predict Performance"}
        </Button>
      </CardContent>
    </Card>
  );
}
