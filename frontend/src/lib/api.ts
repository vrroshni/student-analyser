import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

function getAccessToken(): string {
  if (typeof window === "undefined") return "";

  const unified = window.localStorage.getItem("access_token") || "";
  if (unified) return unified;

  const legacyTeacher = window.localStorage.getItem("teacher_access_token") || "";
  if (legacyTeacher) {
    window.localStorage.setItem("access_token", legacyTeacher);
    window.localStorage.removeItem("teacher_access_token");
    return legacyTeacher;
  }

  return "";
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("access_token");
      window.localStorage.removeItem("teacher_access_token");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(err);
  }
);

// OTP helpers

export type OTPSentResponse = { message: string; email: string };
export type TokenResponse = { access_token: string; token_type: string };

export async function verifyOTP(data: {
  email: string;
  otp_code: string;
  purpose: string;
  role: string;
}) {
  return api.post<TokenResponse>("/auth/verify-otp", data);
}

export async function resendOTP(data: {
  email: string;
  purpose: string;
  role: string;
}) {
  return api.post<OTPSentResponse>("/auth/resend-otp", data);
}
