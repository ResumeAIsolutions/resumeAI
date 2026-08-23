import type { DownloadRequest, ResumeSummary, JDAnalysis, TemplateId } from "../types";
import { supabase } from "../lib/supabase";

const BASE = "/api";

/** Error thrown when the API returns a structured error with a machine-readable code. */
export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function startTailor(
  resumeFile: File,
  jobDescription: string,
  userId?: string,
  accessToken?: string,
): Promise<string> {
  const form = new FormData();
  form.append("resume_file", resumeFile);
  form.append("job_description", jobDescription);
  form.append("original_filename", resumeFile.name);
  if (userId) form.append("user_id", userId);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/tailor/start`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Upload timed out. Please try again.");
    }
    throw new Error("Could not reach the server. Make sure the backend is running on port 8001.");
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    const text = await resp.text().catch(() => "");
    try {
      const err = JSON.parse(text);
      const detail = err.detail;
      if (typeof detail === "object" && detail?.message) {
        throw new ApiError(detail.code ?? "", detail.message);
      }
      if (typeof detail === "string") throw new Error(detail);
    } catch (e) {
      if (e instanceof Error && !(e instanceof SyntaxError) && e.message !== text) throw e;
    }
    throw new Error(resp.status >= 500 ? `Server error (${resp.status}). Please try again.` : "Request failed");
  }

  const data: { request_id: string } = await resp.json();
  return data.request_id;
}


export async function downloadFile(
  format: "pdf" | "docx",
  req: DownloadRequest,
): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  const resp = await fetch(`${BASE}/download/${format}`, {
    method: "POST",
    headers,
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Download failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Download failed");
  }

  return resp.blob();
}

export async function getTemplatePreview(templateId: TemplateId): Promise<Blob> {
  const resp = await fetch(`${BASE}/download/template-preview/${templateId}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Template preview failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Template preview failed");
  }
  return resp.blob();
}

export interface CoverLetterResult {
  cover_letter: string;
  hiring_manager: string;
  company_name: string;
  job_title: string;
}

export async function generateCoverLetter(
  resumeSummary: ResumeSummary,
  jdAnalysis: JDAnalysis,
  signal?: AbortSignal,
  accessToken?: string,
): Promise<CoverLetterResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 130_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/cover-letter`, {
      method: "POST",
      headers,
      body: JSON.stringify({ resume_summary: resumeSummary, jd_analysis: jdAnalysis }),
      signal: combinedSignal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // If the caller's own signal aborted (e.g. component cleanup), re-throw as-is
      // so the caller can silently ignore it. Only show "timed out" for our internal timeout.
      if (signal?.aborted) throw e;
      throw new Error("Cover letter generation timed out. Please try again.");
    }
    throw new Error("Could not reach the server.");
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    const err = await resp.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Cover letter generation failed");
  }

  return resp.json();
}

export async function downloadCoverLetterPdf(
  resumeSummary: ResumeSummary,
  coverLetterText: string,
  hiringManager: string,
  companyName: string,
  jobTitle: string,
  accessToken?: string,
): Promise<Blob> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const resp = await fetch(`${BASE}/cover-letter/pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      resume_summary: resumeSummary,
      cover_letter_text: coverLetterText,
      hiring_manager: hiringManager,
      company_name: companyName,
      job_title: jobTitle,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
    const err = await resp.json().catch(() => ({ detail: "PDF generation failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "PDF generation failed");
  }

  return resp.blob();
}


export interface SubscriptionInfo {
  tier: "free" | "pro";
  status?: string;
  period_end?: string;
  subscription_id?: string;
  usage?: number;
  limit?: number;
}

export async function getUserSubscription(userId: string, accessToken?: string): Promise<SubscriptionInfo> {
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const resp = await fetch(`${BASE}/razorpay/subscription/${userId}`, { headers });
  if (!resp.ok) return { tier: "free", usage: 0, limit: 3 };
  return resp.json();
}

export async function getAdminStatus(accessToken: string): Promise<{ is_admin: boolean; admin_id?: string }> {
  const resp = await fetch(`${BASE}/admin/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    return { is_admin: false };
  }
  return resp.json();
}

export async function createRazorpayOrder(
  currency: "INR" | "USD",
  accessToken: string,
): Promise<{ order_id: string; key_id: string; amount: number; currency: string }> {
  const resp = await fetch(`${BASE}/razorpay/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
    body: JSON.stringify({ currency }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Order creation failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Order creation failed");
  }
  return resp.json();
}

export async function verifyRazorpayPayment(
  payload: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  },
  accessToken: string,
): Promise<void> {
  const resp = await fetch(`${BASE}/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Verification failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Payment verification failed");
  }
}

export interface BaseResumeInfo {
  found: boolean;
  id?: string;
  filename?: string;
  storage_path?: string;
}

export async function getBaseResume(accessToken: string): Promise<BaseResumeInfo> {
  const resp = await fetch(`${BASE}/resumes/base`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!resp.ok) return { found: false };
  return resp.json();
}

export async function uploadBaseResume(file: File, accessToken: string): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${BASE}/resumes/base`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}` },
    body: form,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Upload failed");
  }
}
