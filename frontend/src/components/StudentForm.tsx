"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export type StudentInput = {
  name: string;
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
  record_id: number;
  prediction: string;
  confidence: number;
  model_used: string;
  feature_contributions: FeatureContribution[];
  timestamp: string;
};

type Props = {
  onResult: (r: PredictionOutput) => void;
  onError: (msg: string) => void;
  onLoadingChange?: (loading: boolean) => void;
};

const DEFAULTS: StudentInput = {
  name: "Student",
  age: 18,
  internal_marks: 75,
  previous_marks: 80,
  attendance: 85
};

export function StudentForm({ onResult, onError, onLoadingChange }: Props) {
  const [modelType, setModelType] = useState<ModelType>("ml");
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<StudentInput>(DEFAULTS);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");

  const canSubmit = useMemo(() => {
    return (
      values.name.trim().length > 0 &&
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
    onLoadingChange?.(true);
    onError("");

    try {
      if (photo) {
        const form = new FormData();
        form.append("name", values.name);
        form.append("age", String(values.age));
        form.append("internal_marks", String(values.internal_marks));
        form.append("previous_marks", String(values.previous_marks));
        form.append("attendance", String(values.attendance));
        form.append("photo", photo);

        const res = await api.post<PredictionOutput>("/predict-with-photo", form, {
          params: { model_type: modelType },
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
        setPhotoPreviewUrl(
          `http://localhost:8000/records/${res.data.record_id}/photo?t=${Date.now()}`
        );
        onResult(res.data);
      } else {
        const res = await api.post<PredictionOutput>("/predict", values, {
          params: { model_type: modelType }
        });
        onResult(res.data);
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        onError(detail);
      } else {
        onError("Could not reach backend. Make sure FastAPI is running on http://localhost:8000");
      }
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }

  useEffect(() => {
    if (!photo) {
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Student Input</CardTitle>
        <CardDescription>Enter details and get a predicted category with explanations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Student name</div>
          <Input
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </div>

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

        <div className="space-y-2">
          <div className="text-sm font-medium">Student photo (optional)</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
          {photo ? (
            <div className="text-xs text-muted-foreground">Selected: {photo.name}</div>
          ) : null}

          {photoPreviewUrl ? (
            <div className="pt-2">
              <img
                src={photoPreviewUrl}
                alt="Student photo preview"
                className="h-24 w-24 rounded-md border border-border object-cover"
              />
            </div>
          ) : null}
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
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Predicting
            </span>
          ) : (
            "Predict Performance"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
