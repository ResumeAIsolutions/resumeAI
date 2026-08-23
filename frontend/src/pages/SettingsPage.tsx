import { CreditCard, Sparkles, UserCircle2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Tier } from "../types";

interface Props {
  user: User;
  tier: Tier;
  onUpgrade: () => void;
}

export function SettingsPage({ user, tier, onUpgrade }: Props) {
  return (
    <div
      style={{
        minHeight: "100%",
        padding: "1.5rem",
        background:
          "radial-gradient(circle at top center, color-mix(in srgb, var(--accent) 9%, transparent) 0, transparent 32%), var(--bg)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <section
          className="bento-card"
          style={{
            padding: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 650 }}>
            <div className="label" style={{ marginBottom: "0.45rem" }}>
              Settings
            </div>
            <h1 style={{ fontSize: "2.1rem", letterSpacing: "-0.05em", color: "var(--text-primary)", marginBottom: "0.65rem" }}>
              Account, billing, and workspace appearance
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              Keep your profile, plan, and visual preferences in sync from one place. Theme and accent changes
              apply immediately across the workspace.
            </p>
          </div>

          <div className={`pill ${tier === "pro" ? "pill-pro" : "pill-neutral"}`}>{tier.toUpperCase()} PLAN</div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
            gap: "1rem",
          }}
        >
          <div className="bento-card" style={{ padding: "1.25rem" }}>
            <div className="label" style={{ marginBottom: "0.35rem" }}>
              Profile
            </div>
            <h2 style={{ fontSize: 20, color: "var(--text-primary)", marginBottom: "1rem" }}>Your account</h2>

            <div
              style={{
                padding: "1rem",
                borderRadius: 18,
                background: "var(--elevated)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                    color: "var(--accent)",
                  }}
                >
                  <UserCircle2 size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                    {(user.user_metadata?.full_name as string | undefined) || "ResumeAI user"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user.email}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.6rem" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Auth provider: <span style={{ color: "var(--text-primary)" }}>{user.app_metadata.provider ?? "email"}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Account created:{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bento-card" style={{ padding: "1.25rem" }}>
            <div className="label" style={{ marginBottom: "0.35rem" }}>
              Plan & Billing
            </div>
            <h2 style={{ fontSize: 20, color: "var(--text-primary)", marginBottom: "1rem" }}>Manage your access</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "1rem",
                alignItems: "center",
                padding: "1rem",
                borderRadius: 18,
                border: "1px solid var(--border)",
                background:
                  tier === "pro"
                    ? "linear-gradient(135deg, color-mix(in srgb, var(--pro) 10%, var(--surface)) 0%, var(--elevated) 100%)"
                    : "var(--elevated)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.35rem" }}>
                  <CreditCard size={18} color={tier === "pro" ? "var(--pro)" : "var(--text-secondary)"} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                    {tier === "pro" ? "ResumeAI Pro" : "ResumeAI Free"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {tier === "pro"
                    ? "Your lifetime Pro access is active on this account. No renewal or cancellation is required."
                    : "Upgrade to unlock premium templates, DOCX export, and cover letters."}
                </p>
              </div>

              {tier === "pro" ? (
                <div className="pill pill-pro">Lifetime Access</div>
              ) : (
                <button type="button" className="accent-btn" onClick={onUpgrade}>
                  <Sparkles size={16} />
                  Upgrade to Pro
                </button>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
