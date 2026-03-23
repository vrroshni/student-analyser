"use client";

import { useEffect, useState } from "react";

import { adminLogin, api, getOTPStatus, updateOTPSettings } from "@/lib/api";
import { adminLoginSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentForm } from "@/components/StudentForm";
import { PredictionResult } from "@/components/PredictionResult";
import { HistoryList } from "@/components/HistoryList";
import type { PredictionOutput } from "@/components/StudentForm";
import { Trash2 } from "lucide-react";

type UserRecord = { id: number; email: string; name: string; created_at: string };

function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [teachers, setTeachers] = useState<UserRecord[]>([]);
  const [students, setStudents] = useState<UserRecord[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  const [otpEnabled, setOtpEnabled] = useState<boolean>(false);
  const [otpToggleLoading, setOtpToggleLoading] = useState(false);

  const [result, setResult] = useState<PredictionOutput | null>(null);
  const [predictError, setPredictError] = useState("");
  const [predictLoading, setPredictLoading] = useState(false);

  useEffect(() => {
    const t = window.localStorage.getItem("access_token") || "";
    if (t && getRoleFromToken(t) === "admin") {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    setDashLoading(true);
    Promise.all([api.get("/admin/teachers"), api.get("/admin/students"), getOTPStatus()])
      .then(([tRes, sRes, otpRes]) => {
        setTeachers(tRes.data);
        setStudents(sRes.data);
        setOtpEnabled(otpRes.data.otp_enabled);
      })
      .catch(() => {
        setError("Failed to load user data");
      })
      .finally(() => setDashLoading(false));
  }, [token]);

  async function handleLogin() {
    const result = adminLoginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await adminLogin({ email, password });
      const t = res.data.access_token;
      window.localStorage.setItem("access_token", t);
      setToken(t);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTeacher(id: number) {
    try {
      await api.delete(`/admin/teachers/${id}`);
      setTeachers((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to delete teacher");
    }
  }

  async function handleDeleteStudent(id: number) {
    try {
      await api.delete(`/admin/students/${id}`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to delete student");
    }
  }

  async function handleToggleOTP() {
    setOtpToggleLoading(true);
    try {
      const res = await updateOTPSettings(!otpEnabled);
      setOtpEnabled(res.data.otp_enabled);
    } catch {
      setError("Failed to update OTP setting");
    } finally {
      setOtpToggleLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem("access_token");
    setToken("");
    setTeachers([]);
    setStudents([]);
  }

  if (!token) {
    return (
      <main className="min-h-screen">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_500px_at_10%_10%,rgba(59,130,246,0.25),transparent),radial-gradient(900px_450px_at_90%_20%,rgba(20,184,166,0.18),transparent)]" />
        <div className="mx-auto max-w-md px-4 pt-24">
          <Card className="border-border/70 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>Sign in with your admin credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <div className="text-sm font-medium">Email</div>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Password</div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                />
              </div>

              <Button className="w-full" disabled={loading} onClick={handleLogin}>
                {loading ? "Please wait..." : "Login"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_500px_at_10%_10%,rgba(59,130,246,0.25),transparent),radial-gradient(900px_450px_at_90%_20%,rgba(20,184,166,0.18),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight">Admin Dashboard</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Manage users, predict performance, and view history
            </div>
          </div>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>

        <Tabs defaultValue="users" className="mt-6">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="predict">Predict</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {dashLoading ? (
              <div className="mt-10 text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="mt-2 space-y-8">
                {/* Settings */}
                <Card className="border-border/70 bg-card/60 backdrop-blur">
                  <CardHeader>
                    <CardTitle>Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">OTP Verification</div>
                        <div className="text-xs text-muted-foreground">
                          {otpEnabled
                            ? "Users verify their identity via email OTP"
                            : "Users login with email and password directly"}
                        </div>
                      </div>
                      <button
                        onClick={handleToggleOTP}
                        disabled={otpToggleLoading}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
                          otpEnabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            otpEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Teachers */}
                <Card className="border-border/70 bg-card/60 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Teachers
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {teachers.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {teachers.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No teachers have signed up yet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teachers.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell>{t.name || "-"}</TableCell>
                              <TableCell>{t.email}</TableCell>
                              <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteTeacher(t.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Students */}
                <Card className="border-border/70 bg-card/60 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Students
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {students.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {students.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No students have signed up yet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.name || "-"}</TableCell>
                              <TableCell>{s.email}</TableCell>
                              <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteStudent(s.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="predict">
            {predictError ? (
              <div className="mb-5 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
                {predictError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <StudentForm
                userRole="admin"
                onResult={(r) => setResult(r)}
                onError={(msg) => setPredictError(msg)}
                onLoadingChange={(l) => setPredictLoading(l)}
              />
              <PredictionResult result={result} loading={predictLoading} />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <HistoryList />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
