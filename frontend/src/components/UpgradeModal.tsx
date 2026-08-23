import { X, Zap, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { createRazorpayOrder, verifyRazorpayPayment } from "../api/client";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

// Razorpay global type
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

interface Props {
  reason: "tailor_limit" | "docx" | "cover_letter" | "history";
  user: User | null;
  onClose: () => void;
  onSignIn: () => void;
  onUpgradeSuccess?: () => void;
}

const REASON_COPY: Record<Props["reason"], { title: string; subtitle: string }> = {
  tailor_limit: {
    title: "You've used all 3 free tailors",
    subtitle: "Upgrade to Pro for unlimited resume tailoring — one-time payment, lifetime access.",
  },
  docx: {
    title: "DOCX download is a Pro feature",
    subtitle: "Upgrade to Pro to download your resume as a Word document.",
  },
  cover_letter: {
    title: "Cover letters are a Pro feature",
    subtitle: "Upgrade to Pro to generate AI-powered cover letters.",
  },
  history: {
    title: "Pro unlocks advanced resume workflows",
    subtitle: "Upgrade to Pro for premium templates, DOCX export, and AI cover letters.",
  },
};

const PRO_FEATURES = [
  "Unlimited tailors (lifetime access)",
  "PDF + DOCX download",
  "Premium resume templates",
  "AI cover letter generation",
  "Priority processing",
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function UpgradeModal({ reason, user, onClose, onSignIn, onUpgradeSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Detect Indian locale → default INR
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const copy = REASON_COPY[reason];

  async function handleUpgrade() {
    if (!user) { onClose(); onSignIn(); return; }
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load payment SDK. Please try again.");

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? "";
      const { order_id, key_id, amount } = await createRazorpayOrder(currency, accessToken);

      // Open Razorpay Checkout popup for one-time order payment
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: key_id,
          amount,
          currency,
          order_id,
          name: "ResumeAI",
          description: "Pro Lifetime Access",
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              await verifyRazorpayPayment(
                {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                },
                accessToken,
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: {
            email: user.email ?? "",
          },
          theme: { color: "#ccff00" },
          modal: {
            ondismiss: () => reject(new Error("dismissed")),
          },
        });
        rzp.open();
      });

      setSuccess(true);
      onUpgradeSuccess?.();
    } catch (e) {
      if (e instanceof Error && e.message === "dismissed") {
        // User closed popup — not an error
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Pro"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        padding: "1rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 420,
        background: "#0c0c0c",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "1.5rem",
        padding: "2rem",
        position: "relative",
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: "1rem", right: "1rem", background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <X size={18} />
        </button>

        {success ? (
          /* Success state */
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(204,255,0,0.12)", border: "1px solid rgba(204,255,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
              <Check size={22} style={{ color: "var(--lime)" }} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--white-primary)", marginBottom: "0.5rem" }}>
              You're Pro now!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              Your Pro access is active. Reload the page to unlock all Pro features.
            </p>
            <button
              onClick={onClose}
              className="neon-btn"
              style={{ padding: "0.75rem 1.5rem", fontSize: 14, animation: "none" }}
            >
              Continue →
            </button>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(204,255,0,0.1)", border: "1px solid rgba(204,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <Zap size={20} style={{ color: "var(--lime)" }} />
            </div>

            {/* Heading */}
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--white-primary)", marginBottom: "0.5rem", letterSpacing: "-0.01em" }}>
              {copy.title}
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              {copy.subtitle}
            </p>

            {/* Features */}
            <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {PRO_FEATURES.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <Check size={13} style={{ color: "var(--lime)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Currency toggle + Price */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--white-primary)", letterSpacing: "-0.03em" }}>
                  {currency === "INR" ? "₹749" : "$9"}
                </span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>one-time</span>
              </div>
              <div style={{ display: "flex", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
                {(["INR", "USD"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    style={{
                      padding: "0.3rem 0.75rem",
                      border: "none",
                      background: currency === c ? "rgba(204,255,0,0.15)" : "transparent",
                      color: currency === c ? "var(--lime)" : "var(--text-secondary)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: "1rem" }}>{error}</p>
            )}

            {/* CTA */}
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="neon-btn"
              style={{ width: "100%", padding: "0.75rem", fontSize: 14, animation: "none", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              {loading
                ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Opening payment…</>
                : user ? "Start Pro →" : "Sign in to upgrade →"}
            </button>

            <p style={{ marginTop: "0.875rem", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              One-time payment. No renewal required.
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
