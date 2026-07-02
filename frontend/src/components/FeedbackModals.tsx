import React, { useState, useRef } from "react";

const BASE = "/api";

/** Captures browser/OS/screen metadata on the client */
function captureMetadata(): Record<string, string> {
  return {
    browser: navigator.userAgent.substring(0, 200),
    os: (navigator.platform || "unknown").substring(0, 50),
    url: window.location.href.substring(0, 500),
    screen_size: `${window.screen.width}x${window.screen.height}`,
  };
}

async function postFeedback(data: FormData): Promise<void> {
  const resp = await fetch(`${BASE}/feedback`, { method: "POST", body: data });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Submission failed" }));
    throw new Error(typeof err.detail === "string" ? err.detail : "Submission failed");
  }
}

// ─── Shared style helpers ──────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.80)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  padding: "1rem",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  background: "#0c0c0c",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "1.5rem",
  padding: "2rem",
  position: "relative",
  maxHeight: "90vh",
  overflowY: "auto",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: "0.15em",
  color: "var(--text-secondary)",
  marginBottom: "0.4rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.75rem",
  padding: "0.65rem 0.9rem",
  fontSize: 14,
  color: "#ebebeb",
  fontFamily: "'Space Grotesk', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", minHeight: 104 };

const fieldWrap: React.CSSProperties = { marginBottom: "1rem" };

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      style={{ position: "absolute", top: "1.1rem", right: "1.1rem", background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0.2rem" }}
    >✕</button>
  );
}

function SuccessState({ color, onClose }: { color: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${color}18`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", fontSize: 24 }}>✓</div>
      <h3 style={{ color: "#ebebeb", fontWeight: 700, marginBottom: "0.5rem" }}>Sent! Thank you.</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>We'll look into it shortly.</p>
      <button onClick={onClose} style={{ marginTop: "1.5rem", background: color, color: "#000", border: "none", borderRadius: 9999, padding: "0.65rem 1.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>Close</button>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "0.75rem", padding: "0.65rem 0.9rem", marginBottom: "1rem", fontSize: 13, color: "#f87171" }}>
      {msg}
    </div>
  );
}

function SubmitBtn({ loading, color, label = "Send" }: { loading: boolean; color: string; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{ width: "100%", marginTop: "0.25rem", background: color, color: "#000", border: "none", borderRadius: 9999, padding: "0.75rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "opacity 0.2s" }}
    >
      {loading && <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", animation: "spin 0.8s linear infinite" }} />}
      {loading ? "Sending…" : label}
    </button>
  );
}

// ─── 1. Bug Report Modal ───────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BugReportModal({ isOpen, onClose }: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(formRef.current!);
      fd.set("type", "bug");
      const meta = captureMetadata();
      Object.entries(meta).forEach(([k, v]) => fd.set(k, v));
      await postFeedback(fd);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setLoading(false); onClose(); }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
      setLoading(false);
    }
  }

  const ORANGE = "#f97316";

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <CloseBtn onClose={onClose} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1.5rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${ORANGE}18`, border: `1px solid ${ORANGE}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🐛</div>
          <div>
            <h2 style={{ color: "#ebebeb", fontSize: 17, fontWeight: 700, margin: 0 }}>Report a Bug</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>Something broken? Tell us what happened.</p>
          </div>
        </div>

        {success ? (
          <SuccessState color={ORANGE} onClose={onClose} />
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {error && <ErrorBanner msg={error} />}

            <div style={fieldWrap}>
              <label style={labelStyle}>Bug Summary <span style={{ color: ORANGE }}>*</span></label>
              <input name="name" required placeholder="Short description of the bug" style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Steps to Reproduce <span style={{ color: ORANGE }}>*</span></label>
              <textarea name="message" required placeholder="1. Go to...\n2. Click...\n3. See error..." style={textareaStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Priority</label>
              <select name="priority" defaultValue="medium" style={{ ...inputStyle, appearance: "none" as any }}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Your Email (optional)</label>
              <input name="email" type="email" placeholder="you@example.com" style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Screenshot (optional, max 5 MB)</label>
              <input name="file" type="file" accept="image/*" style={{ ...inputStyle, padding: "0.45rem 0.9rem", cursor: "pointer", fontSize: 13 }} />
            </div>

            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: "1rem", fontFamily: "'JetBrains Mono', monospace" }}>
              🔍 Browser, OS &amp; URL are captured automatically
            </p>

            <SubmitBtn loading={loading} color={ORANGE} label="Report Bug" />
          </form>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── 2. Feature Request Modal ──────────────────────────────────────────────────

export function FeatureRequestModal({ isOpen, onClose }: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(formRef.current!);
      fd.set("type", "feature");
      const meta = captureMetadata();
      Object.entries(meta).forEach(([k, v]) => fd.set(k, v));
      await postFeedback(fd);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setLoading(false); onClose(); }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
      setLoading(false);
    }
  }

  const VIOLET = "#8b5cf6";

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <CloseBtn onClose={onClose} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1.5rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${VIOLET}18`, border: `1px solid ${VIOLET}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💡</div>
          <div>
            <h2 style={{ color: "#ebebeb", fontSize: 17, fontWeight: 700, margin: 0 }}>Request a Feature</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>Have an idea? We'd love to hear it.</p>
          </div>
        </div>

        {success ? (
          <SuccessState color={VIOLET} onClose={onClose} />
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {error && <ErrorBanner msg={error} />}

            <div style={fieldWrap}>
              <label style={labelStyle}>Feature Title <span style={{ color: VIOLET }}>*</span></label>
              <input name="name" required placeholder="e.g. Export to LinkedIn profile" style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Why is this needed? <span style={{ color: VIOLET }}>*</span></label>
              <textarea name="message" required placeholder="Describe how this would improve your workflow..." style={textareaStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Your Email (optional)</label>
              <input name="email" type="email" placeholder="you@example.com" style={inputStyle} />
            </div>

            <SubmitBtn loading={loading} color={VIOLET} label="Submit Request" />
          </form>
        )}
      </div>
    </div>
  );
}

// ─── 3. General Feedback Modal ─────────────────────────────────────────────────

export function GeneralFeedbackModal({ isOpen, onClose }: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(formRef.current!);
      fd.set("type", "general");
      const meta = captureMetadata();
      Object.entries(meta).forEach(([k, v]) => fd.set(k, v));
      await postFeedback(fd);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setLoading(false); onClose(); }, 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
      setLoading(false);
    }
  }

  const GREEN = "#10b981";

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <CloseBtn onClose={onClose} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1.5rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${GREEN}18`, border: `1px solid ${GREEN}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💬</div>
          <div>
            <h2 style={{ color: "#ebebeb", fontSize: 17, fontWeight: 700, margin: 0 }}>Give Feedback</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>Thoughts, suggestions, questions.</p>
          </div>
        </div>

        {success ? (
          <SuccessState color={GREEN} onClose={onClose} />
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {error && <ErrorBanner msg={error} />}

            <div style={fieldWrap}>
              <label style={labelStyle}>Subject <span style={{ color: GREEN }}>*</span></label>
              <input name="name" required placeholder="e.g. Love the new design!" style={inputStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Message <span style={{ color: GREEN }}>*</span></label>
              <textarea name="message" required placeholder="Share your thoughts with us..." style={textareaStyle} />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Your Email (optional)</label>
              <input name="email" type="email" placeholder="you@example.com" style={inputStyle} />
            </div>

            <SubmitBtn loading={loading} color={GREEN} label="Send Feedback" />
          </form>
        )}
      </div>
    </div>
  );
}
