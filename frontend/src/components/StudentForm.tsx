"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

const TOTAL_OUT_OF = 600;
const INTERNAL_OUT_OF = 300;
const UNIVERSITY_OUT_OF = 300;

const DEPARTMENTS = ["CSE", "IT", "ECE", "EEE", "ME", "CE"] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type SemesterInput = {
  semester: number;
  internal_marks: number;
  university_marks: number;
  attendance: number;
};

export type StudentInput = {
  name: string;
  age: number;
  department: Department;
  semesters: SemesterInput[];
};

export type ModelType = "ml" | "dl";

export type FeatureContribution = {
  feature: string;
  value: number;
  contribution: number;
};

export type PredictionOutput = {
  record_id: number;
  department?: string | null;
  semesters: SemesterInput[];
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

const semesterSchema = z
  .object({
    semester: z.number().int().min(1).max(8),
    internal_marks: z.number().int().min(0).max(INTERNAL_OUT_OF),
    university_marks: z.number().int().min(0).max(UNIVERSITY_OUT_OF),
    attendance: z.number().min(0).max(100)
  })
  .superRefine(
    (
      val: {
        semester: number;
        internal_marks: number;
        university_marks: number;
        attendance: number;
      },
      ctx: z.RefinementCtx
    ) => {
    if (val.internal_marks + val.university_marks > TOTAL_OUT_OF) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Internal + University must be <= ${TOTAL_OUT_OF}`,
        path: ["internal_marks"]
      });
    }
    }
  );

const studentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    age: z.number().int().min(15).max(30),
    department: z.enum(DEPARTMENTS),
    semesters: z.array(semesterSchema).min(1).max(8)
  })
  .superRefine((val: StudentInput, ctx: z.RefinementCtx) => {
    const sems = [...val.semesters]
      .map((s) => s.semester)
      .sort((a, b) => a - b);
    const uniq = Array.from(new Set(sems));
    if (uniq.length !== sems.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate semesters are not allowed",
        path: ["semesters"]
      });
      return;
    }
  });

const DEFAULTS: StudentInput = {
  name: "Student",
  age: 18,
  department: "CSE",
  semesters: [
    {
      semester: 1,
      internal_marks: 200,
      university_marks: 210,
      attendance: 85
    }
  ]
};

export function StudentForm({ onResult, onError, onLoadingChange }: Props) {
  const [modelType, setModelType] = useState<ModelType>("ml");
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<StudentInput>(DEFAULTS);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const computed = useMemo(() => {
    const sems = values.semesters;
    const percentages = sems.map(
      (s) => ((s.internal_marks + s.university_marks) / TOTAL_OUT_OF) * 100
    );
    const avgPct = percentages.length
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : 0;
    const avgAtt = sems.length ? sems.reduce((a, b) => a + b.attendance, 0) / sems.length : 0;
    return { avgPct, avgAtt };
  }, [values.semesters]);

  const canSubmit = useMemo(() => {
    return studentSchema.safeParse(values).success;
  }, [values]);

  const selectedSemesters = useMemo(() => {
    return new Set(values.semesters.map((s) => s.semester));
  }, [values.semesters]);

  function availableSemesterOptions(current?: number): number[] {
    const opts: number[] = [];
    for (let sem = 1; sem <= 8; sem++) {
      if (!selectedSemesters.has(sem) || sem === current) opts.push(sem);
    }
    return opts;
  }

  function addSemester() {
    setValues((v) => {
      if (v.semesters.length >= 8) return v;
      const used = new Set(v.semesters.map((s) => s.semester));
      let nextSem = 1;
      while (used.has(nextSem) && nextSem <= 8) nextSem++;
      if (nextSem > 8) return v;
      return {
        ...v,
        semesters: [
          ...v.semesters,
          { semester: nextSem, internal_marks: 0, university_marks: 0, attendance: 0 }
        ]
      };
    });
  }

  function removeSemester(index: number) {
    setValues((v) => {
      const next = [...v.semesters];
      next.splice(index, 1);
      return { ...v, semesters: next.length ? next : v.semesters };
    });
  }

  async function submit() {
    const parsed = studentSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      onError(Object.values(nextErrors)[0] ?? "Please fix validation errors.");
      return;
    }

    setFieldErrors({});

    setLoading(true);
    onLoadingChange?.(true);
    onError("");

    try {
      if (photo) {
        const form = new FormData();
        form.append("name", parsed.data.name);
        form.append("age", String(parsed.data.age));
        form.append("department", parsed.data.department);
        form.append("semesters_json", JSON.stringify(parsed.data.semesters));
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
        const res = await api.post<PredictionOutput>("/predict", parsed.data, {
          params: { model_type: modelType }
        });
        onResult(res.data);
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        onError(detail);
      } else if (Array.isArray(detail) && detail.length) {
        const first = detail[0];
        const msg =
          typeof first?.msg === "string"
            ? first.msg
            : typeof first === "string"
              ? first
              : "Request validation failed";
        onError(msg);
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
          {fieldErrors["name"] ? (
            <div className="text-xs text-destructive">{fieldErrors["name"]}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Department</div>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={values.department}
            onChange={(e) =>
              setValues((v) => ({ ...v, department: e.target.value as Department }))
            }
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {fieldErrors["department"] ? (
            <div className="text-xs text-destructive">{fieldErrors["department"]}</div>
          ) : null}
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
              onChange={(e) =>
                setValues((v) => ({ ...v, age: Number(e.target.value) }))
              }
            />
            {fieldErrors["age"] ? (
              <div className="text-xs text-destructive">{fieldErrors["age"]}</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Semester-wise inputs</div>
            <div className="text-xs text-muted-foreground">
              Total per sem: {TOTAL_OUT_OF} (Internal out of {INTERNAL_OUT_OF}, University out of {UNIVERSITY_OUT_OF})
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Add semesters you have marks for. Same semester cannot be chosen twice.
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={values.semesters.length >= 8}
              onClick={addSemester}
            >
              + Add Semester
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {[...values.semesters]
              .map((s, idx) => ({ s, idx }))
              .sort((a, b) => a.s.semester - b.s.semester)
              .map(({ s, idx }) => {
              const obtained = s.internal_marks + s.university_marks;
              const pct = (obtained / TOTAL_OUT_OF) * 100;
              return (
                <div key={s.semester} className="rounded-lg border border-border/70 bg-background/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">Semester</div>
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={s.semester}
                        onChange={(e) => {
                          const sem = Number(e.target.value);
                          setValues((v) => {
                            const next = [...v.semesters];
                            next[idx] = { ...next[idx], semester: sem };
                            return { ...v, semesters: next };
                          });
                        }}
                      >
                        {availableSemesterOptions(s.semester).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={values.semesters.length <= 1}
                        onClick={() => removeSemester(idx)}
                        className="h-9 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Obtained: <span className="font-medium text-foreground">{obtained}</span> / {TOTAL_OUT_OF} · %: <span className="font-medium text-foreground">{pct.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Internal (0-{INTERNAL_OUT_OF})</div>
                      <Input
                        type="number"
                        value={s.internal_marks}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setValues((v) => {
                            const next = [...v.semesters];
                            next[idx] = { ...next[idx], internal_marks: n };
                            return { ...v, semesters: next };
                          });
                        }}
                      />
                      {fieldErrors[`semesters.${idx}.internal_marks`] ? (
                        <div className="text-xs text-destructive">
                          {fieldErrors[`semesters.${idx}.internal_marks`]}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">University (0-{UNIVERSITY_OUT_OF})</div>
                      <Input
                        type="number"
                        value={s.university_marks}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setValues((v) => {
                            const next = [...v.semesters];
                            next[idx] = { ...next[idx], university_marks: n };
                            return { ...v, semesters: next };
                          });
                        }}
                      />
                      {fieldErrors[`semesters.${idx}.university_marks`] ? (
                        <div className="text-xs text-destructive">
                          {fieldErrors[`semesters.${idx}.university_marks`]}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Attendance % (0-100)</div>
                      <Input
                        type="number"
                        value={s.attendance}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setValues((v) => {
                            const next = [...v.semesters];
                            next[idx] = { ...next[idx], attendance: n };
                            return { ...v, semesters: next };
                          });
                        }}
                      />
                      {fieldErrors[`semesters.${idx}.attendance`] ? (
                        <div className="text-xs text-destructive">
                          {fieldErrors[`semesters.${idx}.attendance`]}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-3 text-sm">
              Avg Percentage: <span className="font-semibold">{computed.avgPct.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/30 px-4 py-3 text-sm">
              Avg Attendance: <span className="font-semibold">{computed.avgAtt.toFixed(1)}%</span>
            </div>
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
