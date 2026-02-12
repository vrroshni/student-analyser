"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type HistoryRecord = {
  id: number;
  name: string;
  department: string;
  age: number;
  avg_percentage: number;
  last_percentage: number;
  avg_attendance: number;
  semesters: Array<{
    semester: number;
    internal_marks: number;
    university_marks: number;
    attendance: number;
  }>;
  prediction: string;
  confidence: number;
  model_used: string;
  has_photo: boolean;
  created_at: string;
};

function initialsFor(name: string): string {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorIndexFor(name: string): number {
  const s = (name || "").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const AVATAR_BG_CLASSES = [
  "bg-blue-500/20 text-blue-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-amber-500/20 text-amber-200",
  "bg-rose-500/20 text-rose-200",
  "bg-violet-500/20 text-violet-200",
  "bg-cyan-500/20 text-cyan-200"
];

function badgeVariantFor(prediction: string): "success" | "warning" | "danger" {
  const p = prediction.toLowerCase();
  if (p.includes("good")) return "success";
  if (p.includes("average")) return "warning";
  return "danger";
}

export function HistoryList() {
  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<HistoryRecord[]>("/history", { params: { limit: 200 } });
      setItems(res.data);
    } catch (e) {
      setError("Failed to load history. Is the backend running on :8000?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Previous predictions saved to SQLite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No history yet. Run a prediction first.</div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="rounded-lg border border-border/70 bg-background/40">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[84px]">Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Prediction</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead className="text-right">Avg %</TableHead>
                  <TableHead className="text-right">Last %</TableHead>
                  <TableHead className="text-right">Avg Att%</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.has_photo ? (
                        <img
                          src={`http://localhost:8000/records/${r.id}/photo?t=${encodeURIComponent(
                            r.created_at
                          )}`}
                          alt={r.name}
                          className="h-10 w-10 rounded-md border border-border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={
                            "flex h-10 w-10 items-center justify-center rounded-md border border-border font-semibold " +
                            AVATAR_BG_CLASSES[colorIndexFor(r.name) % AVATAR_BG_CLASSES.length]
                          }
                          aria-label={r.name ? `Avatar for ${r.name}` : "Avatar"}
                          title={r.name || "(no name)"}
                        >
                          {initialsFor(r.name)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.name || "(no name)"}</TableCell>
                    <TableCell>{r.department || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariantFor(r.prediction)}>{r.prediction}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Math.round(r.confidence * 100)}%</TableCell>
                    <TableCell>{r.model_used}</TableCell>
                    <TableCell className="text-right">{r.age}</TableCell>
                    <TableCell className="text-right">{r.avg_percentage.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.last_percentage.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.avg_attendance.toFixed(1)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <button
          onClick={load}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Refresh
        </button>
      </CardContent>
    </Card>
  );
}
