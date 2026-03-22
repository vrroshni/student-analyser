"use client";

import { useEffect, useState } from "react";

import type { PredictionOutput } from "@/components/StudentForm";
import { HistoryList } from "@/components/HistoryList";
import { StudentForm } from "@/components/StudentForm";
import { PredictionResult } from "@/components/PredictionResult";
import { AuthCard } from "@/components/TeacherAuthCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

function getRoleFromToken(token: string): "teacher" | "student" | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role === "teacher" ? "teacher" : payload.role === "student" ? "student" : null;
  } catch {
    return null;
  }
}

export default function Page() {
  const [result, setResult] = useState<PredictionOutput | null>(null);
  const [error, setError] = useState<string>("");
  const [predictLoading, setPredictLoading] = useState<boolean>(false);
  const [token, setToken] = useState<string>("");
  const [userRole, setUserRole] = useState<"teacher" | "student" | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem("access_token") || window.localStorage.getItem("teacher_access_token") || "";
    setToken(t);
    setUserRole(getRoleFromToken(t));

    function onLogout() {
      setToken("");
      setUserRole(null);
      setResult(null);
      setError("");
    }

    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

  function logout() {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("teacher_access_token");
    setToken("");
    setUserRole(null);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_500px_at_10%_10%,rgba(59,130,246,0.25),transparent),radial-gradient(900px_450px_at_90%_20%,rgba(20,184,166,0.18),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight">Student Performance Analyzer</div>
            <div className="mt-1 text-sm text-muted-foreground">
              FastAPI + Scikit-learn + TensorFlow (optional) + SHAP + SQLite
            </div>
          </div>

          {token ? (
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          ) : null}
        </div>

        {!token ? (
          <div className="mt-10 flex justify-center">
            <div className="w-full max-w-md">
              <AuthCard
                onAuthed={(t) => {
                  window.localStorage.setItem("access_token", t);
                  setToken(t);
                  setUserRole(getRoleFromToken(t));
                }}
              />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="predict" className="mt-6">
            <TabsList>
              <TabsTrigger value="predict">Predict</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="predict">
              {error ? (
                <div className="mb-5 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <StudentForm
                  userRole={userRole}
                  onResult={(r) => {
                    setResult(r);
                  }}
                  onError={(msg) => {
                    setError(msg);
                  }}
                  onLoadingChange={(l) => setPredictLoading(l)}
                />
                <PredictionResult result={result} loading={predictLoading} />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <HistoryList />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
