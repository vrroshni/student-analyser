"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api, verifyOTP, resendOTP, getOTPStatus } from "@/lib/api";
import { signupSchema, loginSchema, loginWithPasswordSchema, otpSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AuthCard({
  onAuthed
}: {
  onAuthed: (token: string) => void;
}) {
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // OTP toggle state
  const [otpEnabled, setOtpEnabled] = useState<boolean>(false);

  // OTP state
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpEmail, setOtpEmail] = useState<string>("");
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch OTP status on mount
  useEffect(() => {
    getOTPStatus()
      .then((res) => setOtpEnabled(res.data.otp_enabled))
      .catch(() => {});
  }, []);

  // Reset to form step when switching role or mode
  useEffect(() => {
    setStep("form");
    setOtpCode("");
    setError("");
    setFieldErrors({});
    setTouched({});
  }, [role, mode]);

  // Cleanup cooldown interval
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startResendCooldown() {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Real-time validation for touched fields
  const liveErrors = useMemo(() => {
    const schema = mode === "signup" ? signupSchema : otpEnabled ? loginSchema : loginWithPasswordSchema;
    const data = mode === "signup" ? { email, password, name } : otpEnabled ? { email } : { email, password };
    const result = schema.safeParse(data);
    if (result.success) return {};
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path.join(".") || "form";
      if (!errors[key]) errors[key] = issue.message;
    });
    return errors;
  }, [email, password, name, mode, otpEnabled]);

  const canSubmit = useMemo(() => {
    const schema = mode === "signup" ? signupSchema : otpEnabled ? loginSchema : loginWithPasswordSchema;
    const data = mode === "signup" ? { email, password, name } : otpEnabled ? { email } : { email, password };
    return schema.safeParse(data).success;
  }, [email, password, name, mode, otpEnabled]);

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function getFieldError(field: string): string | undefined {
    // Show field errors from server first, then live errors if field was touched
    if (fieldErrors[field]) return fieldErrors[field];
    if (touched[field] && liveErrors[field]) return liveErrors[field];
    return undefined;
  }

  async function submit() {
    // Run full validation
    const schema = mode === "signup" ? signupSchema : otpEnabled ? loginSchema : loginWithPasswordSchema;
    const data = mode === "signup" ? { email, password, name } : otpEnabled ? { email } : { email, password };
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path.join(".") || "form";
        if (!errors[key]) errors[key] = issue.message;
      });
      setFieldErrors(errors);
      // Mark all fields as touched
      setTouched({ email: true, password: true, name: true });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError("");

    try {
      const url =
        role === "teacher"
          ? mode === "signup"
            ? "/auth/signup"
            : "/auth/login"
          : mode === "signup"
            ? "/auth/student/signup"
            : "/auth/student/login";
      const payload =
        mode === "signup"
          ? { email, password, name }
          : otpEnabled
            ? { email }
            : { email, password };

      const res = await api.post(url, payload);

      if (res.data.access_token) {
        // OTP disabled: direct auth
        onAuthed(res.data.access_token);
      } else {
        // OTP enabled: transition to OTP step
        setOtpEmail(email);
        setStep("otp");
        startResendCooldown();
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (Array.isArray(detail)) {
        const errors: Record<string, string> = {};
        detail.forEach((d: any) => {
          const field = d.loc?.[d.loc.length - 1] || "form";
          if (!errors[field]) errors[field] = d.msg;
        });
        setFieldErrors(errors);
        setError(Object.values(errors)[0] || "Validation failed");
      } else {
        setError(typeof detail === "string" ? detail : "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    const otpResult = otpSchema.safeParse(otpCode);
    if (!otpResult.success) {
      setError(otpResult.error.issues[0].message);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await verifyOTP({
        email: otpEmail,
        otp_code: otpCode,
        purpose: mode,
        role,
      });
      onAuthed(res.data.access_token);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOTP() {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError("");

    try {
      await resendOTP({ email: otpEmail, purpose: mode, role });
      startResendCooldown();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not resend OTP");
    } finally {
      setLoading(false);
    }
  }

  // Password strength indicators for signup
  const passwordChecks = useMemo(() => {
    if (mode !== "signup") return [];
    return [
      { label: "At least 8 characters", met: password.length >= 8 },
      { label: "One uppercase letter", met: /[A-Z]/.test(password) },
      { label: "One lowercase letter", met: /[a-z]/.test(password) },
      { label: "One number", met: /[0-9]/.test(password) },
      { label: "One special character", met: /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\`~]/.test(password) },
    ];
  }, [password, mode]);

  if (step === "otp") {
    return (
      <Card className="border-border/70 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We sent a 6-digit verification code to <strong>{otpEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="text-sm font-medium">Enter OTP</div>
            <Input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
          </div>

          <Button
            className="w-full"
            disabled={otpCode.length !== 6 || loading}
            onClick={handleVerifyOTP}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={resendCooldown > 0 || loading}
              onClick={handleResendOTP}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("form");
                setOtpCode("");
                setError("");
              }}
            >
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle>Access</CardTitle>
        <CardDescription>Login or create an account to use predictions and history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <Tabs value={role} onValueChange={(v) => setRole(v as any)}>
          <TabsList>
            <TabsTrigger value="teacher">Teacher</TabsTrigger>
            <TabsTrigger value="student">Student</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
                placeholder="Enter your registered email"
              />
              {getFieldError("email") && (
                <div className="text-xs text-destructive">{getFieldError("email")}</div>
              )}
              {otpEnabled && (
                <div className="text-xs text-muted-foreground">
                  We'll send a verification code to your email.
                </div>
              )}
            </div>
            {!otpEnabled && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Password</div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur("password")}
                  placeholder="Enter your password"
                />
                {getFieldError("password") && (
                  <div className="text-xs text-destructive">{getFieldError("password")}</div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Name (optional)</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur("name")}
              />
              {getFieldError("name") && (
                <div className="text-xs text-destructive">{getFieldError("name")}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Email</div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur("email")}
              />
              {getFieldError("email") && (
                <div className="text-xs text-destructive">{getFieldError("email")}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Password</div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
              />
              {getFieldError("password") && (
                <div className="text-xs text-destructive">{getFieldError("password")}</div>
              )}
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  {passwordChecks.map((check) => (
                    <div
                      key={check.label}
                      className={`text-xs ${check.met ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {check.met ? "\u2713" : "\u25CB"} {check.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Button className="w-full" disabled={!canSubmit || loading} onClick={submit}>
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : otpEnabled ? "Send OTP" : "Login"}
        </Button>

        <div className="text-xs text-muted-foreground">
          Note: your session token is stored locally in this browser.
        </div>
      </CardContent>
    </Card>
  );
}
