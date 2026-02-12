"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type HistoryRecord = {
  id: number;
  name: string;
  age: number;
  internal_marks: number;
  previous_marks: number;
  attendance: number;
  prediction: string;
  confidence: number;
  model_used: string;
  has_photo: boolean;
  created_at: string;
};

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

        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-border/70 bg-background/40 px-4 py-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{r.name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground">{r.prediction}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>

              {r.has_photo ? (
                <div className="mt-3">
                  <img
                    src={`http://localhost:8000/records/${r.id}/photo?t=${encodeURIComponent(
                      r.created_at
                    )}`}
                    alt={r.name}
                    className="h-16 w-16 rounded-md border border-border object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  Age: <span className="text-foreground">{r.age}</span>
                </div>
                <div>
                  Internal: <span className="text-foreground">{r.internal_marks}</span>
                </div>
                <div>
                  Previous: <span className="text-foreground">{r.previous_marks}</span>
                </div>
                <div>
                  Attendance: <span className="text-foreground">{r.attendance}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Model: <span className="text-foreground">{r.model_used}</span> · Confidence:{" "}
                <span className="text-foreground">{Math.round(r.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>

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
