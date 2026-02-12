"use client";

import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TokenResponse = {
  access_token: string;
  token_type: string;
};

export function TeacherAuthCard({
  onAuthed
}: {
  onAuthed: (token: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (mode === "signup" && password.length < 6) return false;
    return true;
  }, [email, password, mode]);

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const url = mode === "signup" ? "/auth/signup" : "/auth/login";
      const payload =
        mode === "signup"
          ? { email, password, name }
          : { email, password };

      const res = await api.post<TokenResponse>(url, payload);
      const token = res.data.access_token;
      window.localStorage.setItem("teacher_access_token", token);
      onAuthed(token);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Teacher Access</CardTitle>
        <CardDescription>Login or create a teacher account to use predictions and history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Name (optional)</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Password (min 6 chars)</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </TabsContent>
        </Tabs>

        <Button className="w-full" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? "Please wait" : mode === "signup" ? "Create account" : "Login"}
        </Button>

        <div className="text-xs text-muted-foreground">
          Note: your session token is stored locally in this browser.
        </div>
      </CardContent>
    </Card>
  );
}
