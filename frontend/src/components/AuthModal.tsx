import { useState, useEffect, useRef } from "react";
import type { CSSProperties, FormEvent, MouseEvent, ReactNode, RefObject } from "react";
import { X, ArrowRight, Eye, EyeOff, Zap, ShieldCheck, FileDown } from "lucide-react";
import { supabase } from "../lib/supabase";

interface AuthModalProps {
  onClose: () => void;
  onAuth: () => void;
}

type AuthMode = "signin" | "signup";

// Defined at module level so React never sees it as a new component on re-render
const FIELD: CSSProperties = {
  width: "100%",
  background: "var(--elevated)",
  border: "1px solid var(--border)",
  borderRadius: "0.875rem",
  padding: "0.9rem 1.1rem",
  fontSize: 15,
  color: "var(--text-primary)",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box" as const,
};

function Field({
  id, label, type, value, onChange, placeholder, autoComplete, inputRef, action,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; autoComplete: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <label htmlFor={id} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef as RefObject<HTMLInputElement>}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ ...FIELD, paddingRight: action ? "3rem" : FIELD.padding as string }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-border)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        {action && (
          <div style={{ position: "absolute", right: "0.875rem", top: "50%", transform: "translateY(-50%)" }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthModal({ onClose, onAuth }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => firstInputRef.current?.focus(), 80); }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleOverlayClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { onAuth(); } else { setConfirmSent(true); }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.message === "Invalid login credentials" ? "Wrong email or password." : err.message);
        setLoading(false);
        return;
      }
      onAuth();
    }
    setLoading(false);
  }

  function switchMode() { setError(null); setConfirmSent(false); setMode((m) => (m === "signup" ? "signin" : "signup")); }

  const overlayStyle: CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "1rem",
    background: "rgba(4,4,7,0.76)",
    backdropFilter: "blur(14px)",
  };

  // ── Email confirm state ───────────────────────────────────────────────────
  if (confirmSent) {
    return (
      <div ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" style={overlayStyle}>
        <div style={{
          position: "relative",
          width: "100%", maxWidth: 480,
          background: "color-mix(in srgb, var(--surface) 92%, black 8%)",
          border: "1px solid var(--border)",
          borderRadius: "2rem",
          padding: "3rem 2.5rem",
          textAlign: "center",
          fontFamily: "'Inter', sans-serif",
        }}>
          <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
            <X size={18} />
          </button>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: 28 }}>✉</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Check your email</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "2rem" }}>
            We sent a confirmation link to<br />
            <strong style={{ color: "var(--accent)" }}>{email}</strong>.<br />
            Click it to activate your account, then sign in.
          </p>
          <button onClick={switchMode} className="neon-btn" style={{ padding: "0.875rem 2rem", fontSize: 14 }}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  // ── Main modal — split layout ─────────────────────────────────────────────
  return (
    <div ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" style={overlayStyle}>
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 880,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        background: "color-mix(in srgb, var(--surface) 95%, black 5%)",
        border: "1px solid var(--border)",
        borderRadius: "2rem",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
      }}>
        {/* ── Left panel — branding ─────────────────────────────────── */}
        <div style={{
          padding: "3rem",
          background: "linear-gradient(180deg, var(--accent-soft) 0%, color-mix(in srgb, var(--surface) 94%, black 6%) 100%)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 520,
        }}>
          {/* Logo */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em", color: "var(--text-primary)", marginBottom: "2.5rem", fontFamily: "'Space Grotesk', sans-serif" }}>
              Resume<span style={{ color: "var(--accent)" }}>AI</span>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <div className="mono" style={{ color: "var(--accent)", marginBottom: "0.75rem" }}>
                {mode === "signup" ? "get started free" : "welcome back"}
              </div>
              <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em", color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {mode === "signup"
                  ? <>Tailor your resume.<br /><span style={{ color: "var(--accent)" }}>Land more interviews.</span></>
                  : <>Good to see<br /><span style={{ color: "var(--accent)" }}>you again.</span></>
                }
              </h2>
            </div>

            {/* Benefits */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                { icon: <Zap size={14} />, text: "Tailored bullets in under 60 seconds" },
                { icon: <ShieldCheck size={14} />, text: "Zero hallucinations — we verify every change" },
                { icon: <FileDown size={14} />, text: "Download as PDF or DOCX instantly" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust line */}
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: "2rem", lineHeight: 1.6 }}>
            Your resume data is processed in memory<br />and never stored on our servers.
          </p>
        </div>

        {/* ── Right panel — form ────────────────────────────────────── */}
        <div style={{ padding: "3rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ position: "absolute", top: "1.25rem", right: "1.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <X size={18} />
          </button>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.375rem", fontFamily: "'Space Grotesk', sans-serif" }}>
              {mode === "signup" ? "Create your free account" : "Sign in to ResumeAI"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {mode === "signup" ? "No credit card required." : "Resume tailoring awaits."}
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            {mode === "signup" && (
              <Field
                id="auth-name" label="Full Name" type="text"
                value={name} onChange={setName}
                placeholder="Jane Smith" autoComplete="name"
                inputRef={mode === "signup" ? firstInputRef : undefined}
              />
            )}

            <Field
              id="auth-email" label="Email" type="email"
              value={email} onChange={setEmail}
              placeholder="jane@university.edu" autoComplete="email"
              inputRef={mode === "signin" ? firstInputRef : undefined}
            />

            <Field
              id="auth-password" label="Password" type={showPassword ? "text" : "password"}
              value={password} onChange={setPassword}
              placeholder="Min. 8 characters"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              action={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", padding: 0 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {error && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: "0.75rem", background: "var(--error-soft)", border: "1px solid rgba(248,113,113,0.25)", color: "#fca5a5", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neon-btn"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "0.25rem",
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  {mode === "signup" ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                <>
                  {mode === "signup" ? "Create free account" : "Sign in"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.5rem 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={async () => {
              setError(null);
              setLoading(true);
              const { error: err } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin },
              });
              if (err) { setError(err.message); setLoading(false); }
            }}
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.875rem",
              borderRadius: "0.875rem",
              border: "1px solid var(--border)",
              background: "var(--elevated)",
              color: "var(--text-primary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Inter', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.625rem",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "color-mix(in srgb, var(--accent-soft) 30%, var(--elevated))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--elevated)"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Switch mode */}
          <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={switchMode}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontWeight: 700, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {mode === "signup" ? "Sign in" : "Sign up free"}
              </button>
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
