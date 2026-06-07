import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

interface Props {
  onGetStarted: () => void;
  onStartPro: () => void;
  onLogoClick: () => void;
}

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  blue:    "#ccff00",
  blueSoft:"rgba(204,255,0,0.15)",
  blueBorder:"rgba(204,255,0,0.3)",
  bg:      "#0B0B0F",
  surface: "#121218",
  white:   "#E5E7EB",
  success: "#30D158",
  ink:     "#0B0B0F",
  lime:    "#ccff00",
  glass: {
    background: "rgba(18,18,24,0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
} as const;

// ── Noise SVG overlay (data URI) ─────────────────────────────────────────────
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

// ── Grid pattern background ──────────────────────────────────────────────────
const GRID_BG: CSSProperties = {
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
  `,
  backgroundSize: "60px 60px",
};

// ── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ onGetStarted, onLogoClick }: { onGetStarted: () => void; onLogoClick: () => void }) {
  return (
    <header style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
      padding: "1.5rem 2.5rem",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      {/* Logo — click goes to dashboard (or upload if not signed in) */}
      <button
        type="button"
        onClick={onLogoClick}
        style={{
          display: "flex", alignItems: "center",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
        aria-label="Go to dashboard"
      >
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 16, color: T.white, letterSpacing: "-0.02em" }}>
          Resume<span style={{ color: T.blue }}>AI</span>
        </span>
      </button>

      {/* Pill nav */}
      <nav style={{
        ...T.glass,
        borderRadius: "9999px",
        padding: "0.5rem 1.25rem",
        display: "flex", gap: "2rem",
      }}>
        {["Features", "How it Works", "Pricing"].map(link => (
          <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`} style={{
            fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500,
            color: "var(--text-primary)", textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseOver={e => (e.currentTarget.style.color = T.white)}
          onMouseOut={e => (e.currentTarget.style.color = "var(--text-primary)")}
          >
            {link}
          </a>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {/* System status */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.blue,
            animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span className="mono" style={{ color: "var(--text-secondary)", fontSize: 10 }}>
            SYSTEM ONLINE
          </span>
        </div>
        {/* CTA */}
        <button onClick={onGetStarted} style={{
          background: T.blue, color: T.ink, fontFamily: "'Inter',sans-serif",
          fontWeight: 600, fontSize: 14, border: "none", borderRadius: "9999px",
          padding: "0.5rem 1.25rem", cursor: "pointer",
          transition: "background 0.2s, transform 0.2s",
        }}
        onMouseOver={e => { e.currentTarget.style.opacity="0.9"; }}
        onMouseOut={e => { e.currentTarget.style.opacity="1"; }}
        >
          Get Started
        </button>
      </div>
    </header>
  );
}

// ── Hero mockup card ─────────────────────────────────────────────────────────
function HeroMockup() {
  return (
    <div className="float-anim" style={{
      ...T.glass, borderRadius: "2rem", padding: "1.5rem", width: "100%", maxWidth: 400,
      position: "relative",
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span className="mono" style={{ color: "var(--text-secondary)" }}>DIFF REVIEW</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {["#ff5f57","#febc2e","#28c840"].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </div>
      </div>

      {/* ATS score badge */}
      <div style={{
        ...T.glass, borderRadius: "0.75rem", padding: "0.75rem 1rem",
        marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: "var(--text-secondary)" }}>ATS Match Score</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 80, height: 4, borderRadius: 9999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{ width: "87%", height: "100%", background: T.blue, borderRadius: 9999 }} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.blue, fontWeight: 600 }}>87%</span>
        </div>
      </div>

      {/* Bullet diff */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Original */}
        <div style={{
          background: "rgba(255,80,80,0.08)", borderRadius: "0.75rem",
          padding: "0.75rem 1rem", borderLeft: "2px solid rgba(255,80,80,0.4)",
        }}>
          <div className="mono" style={{ color: "rgba(255,100,100,0.7)", marginBottom: "0.25rem" }}>ORIGINAL</div>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, textDecoration: "line-through" }}>
            Developed Python scripts for data processing tasks.
          </p>
        </div>

        {/* Tailored */}
        <div style={{
          background: T.blueSoft, borderRadius: "0.75rem",
          padding: "0.75rem 1rem", borderLeft: `2px solid ${T.blue}66`,
        }}>
          <div className="mono" style={{ color: `${T.blue}cc`, marginBottom: "0.25rem" }}>TAILORED</div>
          <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: T.white, lineHeight: 1.5 }}>
            Engineered Python ETL pipelines processing 50K+ daily records, cutting processing time by 40%.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          {[
            { label: "Accept", bg: `${T.blue}22`, color: T.blue, border: `${T.blue}44` },
            { label: "Keep Original", bg: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "rgba(255,255,255,0.1)" },
            { label: "Edit", bg: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "rgba(255,255,255,0.1)" },
          ].map(btn => (
            <button key={btn.label} style={{
              background: btn.bg, color: btn.color,
              border: `1px solid ${btn.border}`, borderRadius: "0.5rem",
              padding: "0.3rem 0.75rem", fontSize: 11, fontWeight: 600,
              fontFamily: "'Space Grotesk',sans-serif", cursor: "pointer",
            }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI badge */}
      <div className="float-anim-delay" style={{
        position: "absolute", top: -16, right: -16,
        background: T.blue, borderRadius: "0.5rem",
        padding: "0.35rem 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(0,0,0,0.45)" }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: T.ink, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          AI Active
        </span>
      </div>
    </div>
  );
}

// ── Floating stat card ───────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="float-anim-delay" style={{
      ...T.glass, borderRadius: "1rem", padding: "0.875rem 1.125rem",
      minWidth: 140,
    }}>
      <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 22, color: T.blue, letterSpacing: "-0.04em" }}>{value}</div>
      {sub && <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "0 2.5rem", paddingTop: "6rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: "4rem", width: "100%", alignItems: "center" }}>

        {/* Left — copy */}
        <div>
          {/* AI label */}
          <div className="fade-up-1 mono" style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            ...T.glass, borderRadius: "9999px", padding: "0.4rem 0.875rem",
            marginBottom: "1.75rem",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.lime, animation: "pulse-dot 2s infinite" }} />
            <span style={{ color: "var(--text-secondary)" }}>AI-POWERED RESUME TAILORING</span>
          </div>

          {/* Giant headline */}
          <h1 className="fade-up-2" style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontWeight: 700,
            fontSize: "clamp(3.5rem, 7vw, 7.5rem)",
            lineHeight: 0.88,
            letterSpacing: "-0.06em",
            color: T.white,
            marginBottom: "1.75rem",
          }}>
            Land Your<br />
            Dream Job<br />
            <em style={{
              fontStyle: "italic",
              color: T.blue,
            }}>
              in 60 Seconds.
            </em>
          </h1>

          {/* Subheadline */}
          <p className="fade-up-3" style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: "clamp(1rem, 1.3vw, 1.125rem)",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 520,
            marginBottom: "2.5rem",
          }}>
            Stop rewriting your resume for every application. Upload your resume, paste any job description, and get AI-tailored bullets that match what recruiters screen for —{" "}
            <span style={{ color: T.white }}>without making anything up.</span>
          </p>

          {/* CTAs */}
          <div className="fade-up-4" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button className="neon-btn" onClick={onGetStarted} style={{ padding: "0.875rem 2rem", fontSize: 15 }}>
              Start Tailoring Free →
            </button>
            <a href="#how-it-works" style={{
              fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 500,
              color: "var(--text-secondary)", textDecoration: "none",
              display: "flex", alignItems: "center", gap: "0.35rem",
              transition: "color 0.2s",
            }}
            onMouseOver={e => (e.currentTarget.style.color = T.white)}
            onMouseOut={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              See How It Works ↓
            </a>
          </div>

          {/* Trust micro-copy */}
          <div className="fade-up-4" style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "1.5rem" }}>
            {["Free account", "No credit card", "Resume never stored"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="6" fill={`${T.blue}22`} />
                  <path d="M3.5 6L5.5 8L8.5 4" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: "var(--text-secondary)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — mockup */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "0.75rem", alignSelf: "flex-start" }}>
            <StatCard label="AVG TIME" value="58s" sub="Upload to download" />
            <StatCard label="ACCURACY" value="100%" sub="Zero hallucinations" />
          </div>
          <HeroMockup />
          <div style={{ alignSelf: "flex-start" }}>
            <StatCard label="ATS FORMATS" value="PDF + DOCX" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Trust bar ────────────────────────────────────────────────────────────────
function TrustBar() {
  const items = [
    { icon: "⚡", label: "60-second tailoring" },
    { icon: "🛡", label: "Zero hallucinations" },
    { icon: "✓", label: "ATS-keyword matched" },
    { icon: "↓", label: "PDF + DOCX export" },
    { icon: "🔒", label: "Resume never stored" },
  ];
  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.06)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "1.25rem 2.5rem",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "3rem",
      flexWrap: "wrap",
    }}>
      {items.map(({ icon, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span className="mono" style={{ color: "var(--text-secondary)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Bento features ───────────────────────────────────────────────────────────
function BentoFeatures() {
  return (
    <section id="features" style={{ padding: "6rem 2.5rem" }}>
      <div style={{ marginBottom: "3.5rem" }}>
        <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>// FEATURES</div>
        <h2 style={{
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
          fontSize: "clamp(2rem,3.5vw,3rem)", letterSpacing: "-0.05em",
          color: T.white, lineHeight: 1,
        }}>
          Built different.<br />
          <span style={{ color: "var(--text-tertiary)" }}>For students who need results.</span>
        </h2>
      </div>

      {/* Bento grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "auto auto", gap: "1rem" }}>

        {/* Large 2×2 — Hallucination-free */}
        <div className="bento-card" style={{ gridColumn: "span 2", gridRow: "span 2", padding: "2rem", display: "flex", flexDirection: "column" }}>
          <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }}>01 / INTEGRITY</div>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "1.625rem", letterSpacing: "-0.04em", color: T.white, lineHeight: 1.15, marginBottom: "0.75rem" }}>
            AI that never<br />makes things up.
          </h3>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "auto" }}>
            Every rewrite is validated against your original. If the AI can't improve a bullet without inventing facts, it leaves it unchanged. Period.
          </p>
          {/* Validation bars */}
          <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[
              { label: "Fact accuracy", val: 100, color: T.blue },
              { label: "Keyword match", val: 87, color: T.success },
              { label: "ATS compatibility", val: 92, color: T.blue },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color, fontWeight: 500 }}>{val}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 9999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 9999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tall 1×2 — ATS keywords */}
        <div className="bento-card" style={{ gridColumn: "span 1", gridRow: "span 2", padding: "1.75rem", display: "flex", flexDirection: "column" }}>
          <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }}>02 / ATS</div>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.03em", color: T.white, marginBottom: "0.625rem", lineHeight: 1.2 }}>
            Keywords recruiters actually scan for.
          </h3>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "auto" }}>
            We analyze the job description and surface the exact ATS keywords woven naturally into your bullets.
          </p>
          {/* Keyword chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.5rem" }}>
            {["Python", "REST APIs", "CI/CD", "AWS Lambda", "PostgreSQL", "FastAPI", "Docker", "ETL"].map(kw => (
              <span key={kw} style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 500,
                background: T.blueSoft, color: T.blue,
                border: `1px solid ${T.blueBorder}`, borderRadius: "0.4rem", padding: "0.25rem 0.5rem",
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Accent 1×1 — 60 seconds */}
        <div className="bento-card" style={{
          background: T.blue, border: "none", padding: "1.75rem",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          position: "relative", overflow: "hidden",
        }}>
          <div className="mono" style={{ color: "rgba(0,0,0,0.55)" }}>03 / SPEED</div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: "3.5rem", letterSpacing: "-0.06em", color: T.ink, lineHeight: 1 }}>60s</div>
            <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, color: "rgba(0,0,0,0.65)", lineHeight: 1.4, marginTop: "0.5rem" }}>
              From upload to tailored resume. Faster than reading the job description.
            </p>
          </div>
        </div>

        {/* 1×1 — Diff review */}
        <div className="bento-card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }}>04 / CONTROL</div>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.03em", color: T.white, marginBottom: "0.5rem" }}>
              You approve every change.
            </h3>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Accept, reject, or hand-edit each bullet before downloading. Nothing ships without your sign-off.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {["✓ Accept", "✕ Reject", "✎ Edit"].map(a => (
              <span key={a} style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "var(--text-secondary)",
                background: "rgba(255,255,255,0.06)", borderRadius: "0.375rem",
                padding: "0.25rem 0.5rem", border: "1px solid rgba(255,255,255,0.08)",
              }}>{a}</span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

// ── Methodology (light contrast section) ─────────────────────────────────────
function Methodology() {
  const steps = [
    {
      n: "01",
      title: "Upload your resume",
      body: "Drop in your base resume and paste the role you want to target. ResumeAI reads your real experience first so the edits stay grounded.",
    },
    {
      n: "02",
      title: "Review the tailored draft",
      body: "We rewrite bullets around the job description, surface the changes, and let you accept, reject, or edit each suggestion before anything is final.",
    },
    {
      n: "03",
      title: "Export and apply",
      body: "Preview the result, download your tailored resume, and move straight into your application flow with a cleaner recruiter-ready version.",
    },
  ];

  return (
    <section
      id="how-it-works"
      style={{
        padding: "5.5rem 2.5rem",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ marginBottom: "2.75rem", maxWidth: 720 }}>
        <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "0.8rem" }}>
          // HOW IT WORKS
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "clamp(2rem,3vw,3rem)", letterSpacing: "-0.05em", lineHeight: 1.04, color: T.white, marginBottom: "0.9rem" }}>
          A simple three-step flow.
        </h2>
        <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          No extra setup, no busywork, and no resume builder maze. Bring your resume in, tailor it fast, and leave with something you can actually send.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {steps.map(({ n, title, body }) => (
          <div
            key={n}
            className="bento-card"
            style={{
              padding: "1.5rem",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              minHeight: 220,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "1.1rem",
                background: T.blueSoft,
                border: `1px solid ${T.blueBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 15,
                fontWeight: 700,
                color: T.blue,
              }}
            >
              {n}
            </div>

            <div>
              <h4 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 20, color: T.white, marginBottom: "0.5rem" }}>
                {title}
              </h4>
              <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────────
function Pricing({ onGetStarted, onStartPro }: { onGetStarted: () => void; onStartPro: () => void }) {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Try it out, no card required.",
      features: ["3 tailors per month", "PDF download", "ATS score", "Keyword match"],
      cta: "Start Tailoring Free",
      accent: "solid",
      onClick: onGetStarted,
    },
    {
      name: "Pro",
      price: "$9",
      period: "one-time",
      description: "For active job seekers.",
      features: ["Unlimited tailors", "PDF + DOCX download", "History & dashboard", "Cover letter generation", "Priority processing"],
      cta: "Start Pro →",
      accent: "featured",
      onClick: onStartPro,
    },
  ];

  return (
    <section id="pricing" style={{ padding: "6rem 2.5rem", background: T.surface }}>
      <div style={{ marginBottom: "3.5rem", textAlign: "center" }}>
        <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>// PRICING</div>
        <h2 style={{
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
          fontSize: "clamp(2rem,3.5vw,3rem)", letterSpacing: "-0.05em",
          color: T.white, lineHeight: 1,
        }}>
          Simple, honest pricing.
        </h2>
        <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: "var(--text-secondary)", marginTop: "0.75rem" }}>
          Start free. Upgrade when you need more.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", maxWidth: 860, margin: "0 auto" }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="bento-card"
            style={{
              padding: "2rem",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              border: plan.accent === "featured" ? `1px solid ${T.blue}55` : "1px solid rgba(255,255,255,0.07)",
              background: plan.accent === "featured" ? T.blueSoft : "rgba(255,255,255,0.02)",
            }}
          >
            {plan.accent === "featured" && (
              <div style={{
                position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: T.blue, borderRadius: 9999, padding: "0.2rem 0.875rem",
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
                color: T.ink, letterSpacing: "0.1em", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                MOST POPULAR
              </div>
            )}

            <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "0.5rem" }}>{plan.name.toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.5rem" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: "2.5rem", letterSpacing: "-0.05em", color: plan.accent === "featured" ? T.blue : T.white }}>
                {plan.price}
              </span>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "var(--text-secondary)" }}>{plan.period}</span>
            </div>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              {plan.description}
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {plan.features.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="7" fill={plan.accent === "featured" ? T.blueSoft : "rgba(255,255,255,0.06)"} />
                    <path d="M4 7L6.5 9.5L10 5" stroke={plan.accent === "featured" ? T.blue : "var(--text-secondary)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "rgba(235,235,235,0.65)" }}>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={plan.onClick}
              style={{
                marginTop: "2rem",
                width: "100%",
                padding: "0.75rem",
                borderRadius: 9999,
                fontFamily: "'Space Grotesk',sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s",
                background: T.blue,
                color: T.ink,
                border: "none",
              }}
              onMouseOver={e => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseOut={e => { e.currentTarget.style.opacity = "1"; }}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Footer CTA ───────────────────────────────────────────────────────────────
function FooterCTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <footer style={{ background: T.bg, padding: "5rem 2.5rem 3rem", position: "relative", overflow: "hidden" }}>
      <div
        className="bento-card"
        style={{
          position: "relative",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "2rem",
          background: "linear-gradient(180deg, rgba(204,255,0,0.05) 0%, rgba(255,255,255,0.02) 100%)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", alignItems: "center" }}>
          <div>
            <div className="mono" style={{ color: "var(--text-tertiary)", marginBottom: "1rem" }}>// GET STARTED TODAY</div>
            <h2 style={{
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700,
              fontSize: "clamp(2.1rem,4vw,3.25rem)", letterSpacing: "-0.05em",
              color: T.white, lineHeight: 1.05, marginBottom: "1rem",
            }}>
              Tailor faster.
              <br />
              Apply with more confidence.
            </h2>
            <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
              ResumeAI keeps the process focused: upload once, review the diffs, and export a cleaner version built for the role in front of you.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}>
            <button onClick={onGetStarted} style={{
              background: T.blue, color: T.ink,
              fontFamily: "'Inter',sans-serif", fontWeight: 700,
              fontSize: 17, border: "none", borderRadius: "9999px",
              padding: "1rem 2rem", cursor: "pointer",
              transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s",
              boxShadow: "0 8px 32px rgba(204,255,0,0.22)",
              display: "inline-flex", alignItems: "center", gap: "0.625rem",
            }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(204,255,0,0.3)"; }}
            onMouseOut={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(204,255,0,0.22)"; }}
            >
              Start Tailoring Free
              <span style={{ fontSize: 18 }}>→</span>
            </button>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              {["Free account", "PDF export", "ATS scoring", "Cover letters for Pro"].map((item) => (
                <span
                  key={item}
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 10,
                    color: "rgba(235,235,235,0.48)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "0.45rem 0.7rem",
                    borderRadius: "9999px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: "4rem", paddingTop: "1.5rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: T.white, marginBottom: "0.25rem" }}>
            Resume<span style={{ color: T.blue }}>AI</span>
          </div>
          <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: "rgba(235,235,235,0.42)" }}>
            AI tailoring for focused job applications.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {["Tailoring", "Dashboard history", "Template exports"].map((item) => (
            <span
              key={item}
              style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: 13,
                color: "var(--text-secondary)",
                padding: "0.45rem 0.8rem",
                borderRadius: "9999px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {item}
            </span>
          ))}
        </div>

        <span className="mono" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} RESUMEAI
        </span>
      </div>
    </footer>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export function LandingPage({ onGetStarted, onStartPro, onLogoClick }: Props) {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll-triggered fade-up for bento cards and methodology
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = "1";
            (entry.target as HTMLElement).style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".observe-fade").forEach(el => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.transform = "translateY(20px)";
      (el as HTMLElement).style.transition = "opacity 0.6s ease, transform 0.6s ease";
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Floating shell */}
      <div ref={shellRef} style={{
        maxWidth: 1600,
        margin: "0 auto",
        background: T.surface,
        borderRadius: "2.5rem",
        border: "1px solid rgba(255,255,255,0.07)",
        overflow: "hidden",
        position: "relative",
        ...GRID_BG,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 50px 100px rgba(0,0,0,0.8)",
      }}>
        {/* Noise overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: NOISE, backgroundRepeat: "repeat",
          backgroundSize: "200px 200px", opacity: 0.04,
        }} />

        {/* Glow spheres */}
        <div style={{
          position: "absolute", top: -200, left: "5%", width: 700, height: 700,
          background: `radial-gradient(circle, rgba(204,255,0,0.1) 0%, transparent 70%)`,
          filter: "blur(120px)", pointerEvents: "none", zIndex: 0,
        }} />
        <div style={{
          position: "absolute", top: "35%", right: -150, width: 500, height: 500,
          background: `radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)`,
          filter: "blur(120px)", pointerEvents: "none", zIndex: 0,
        }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <Nav onGetStarted={onGetStarted} onLogoClick={onLogoClick} />
          <Hero onGetStarted={onGetStarted} />
          <TrustBar />
          <BentoFeatures />
          <Methodology />
          <Pricing onGetStarted={onGetStarted} onStartPro={onStartPro} />
          <FooterCTA onGetStarted={onGetStarted} />
        </div>
      </div>
    </div>
  );
}
