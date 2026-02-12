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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[84px]">Photo</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Prediction</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead className="text-right">Internal</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
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
                        <div className="h-10 w-10 rounded-md border border-dashed border-border" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.name || "(no name)"}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariantFor(r.prediction)}>{r.prediction}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Math.round(r.confidence * 100)}%</TableCell>
                    <TableCell>{r.model_used}</TableCell>
                    <TableCell className="text-right">{r.age}</TableCell>
                    <TableCell className="text-right">{r.internal_marks}</TableCell>
                    <TableCell className="text-right">{r.previous_marks}</TableCell>
                    <TableCell className="text-right">{r.attendance}</TableCell>
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
