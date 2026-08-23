import React from "react";
import { TemplateId, Tier } from "../types";
import { PreviewPanel } from "./PreviewPanel";
import { getTemplatePreview } from "../api/client";

export const TEMPLATES = [
  { id: "jake",      label: "Jake's Classic", desc: "ATS-safe · Minimal · Clean",  pro: false },
  { id: "modern",    label: "Modern",         desc: "Teal accents · Left-aligned · Professional",  pro: true  },
  { id: "executive", label: "Executive",      desc: "Charter serif · Navy · Elegant small-caps",   pro: true  },
  { id: "tech",      label: "Tech Bold",      desc: "Full sans-serif · Blue section bars · Bold",  pro: true  },
  { id: "swiss",     label: "Swiss Minimal",  desc: "Ruleless · Whitespace-driven · Modern sans",  pro: true  },
  { id: "crimson",   label: "Crimson",        desc: "Classic serif · Burgundy accents",            pro: true  },
  { id: "compact",   label: "Compact",        desc: "Dense one-pager · Tight margins",             pro: true  },
  { id: "soham",     label: "ATS Pro",        desc: "Small-caps · ATS optimized",   pro: true  },
  { id: "overleaf",  label: "Clean",          desc: "Open bullets · Minimal",       pro: true  },
] as const;

// Per-template visual descriptor driving the HTML thumbnail mockups.
// Mirrors the LaTeX TemplateConfig knobs in backend/generators/templates/*.py.
interface MockStyle {
  bodyFont: string;
  accent: string;          // section header color
  rule: string;            // section header border-bottom ("none" = ruleless)
  smallCapsSections: boolean;
  nameSize: number;
  nameAlign: "left" | "center";
  nameFont: string;
  nameColor: string;
  nameSmallCaps: boolean;
  bullet: string;
  showSummary: boolean;
  headerFontSize: number;
  pagePadding?: string;    // default "40px 50px" — mirrors template margins
}

const SANS = "Arial, Helvetica, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const MOCK_STYLES: Record<TemplateId, MockStyle> = {
  jake: {
    bodyFont: SANS, accent: "#111", rule: "0.4px solid #111", smallCapsSections: false,
    nameSize: 15, nameAlign: "center", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "•", showSummary: false, headerFontSize: 10,
  },
  modern: {
    bodyFont: SANS, accent: "#4495A2", rule: "1px solid #4495A2", smallCapsSections: false,
    nameSize: 28, nameAlign: "left", nameFont: SERIF, nameColor: "#111", nameSmallCaps: false,
    bullet: "•", showSummary: true, headerFontSize: 11,
  },
  soham: {
    bodyFont: SANS, accent: "#111", rule: "0.6px solid #aaa", smallCapsSections: true,
    nameSize: 16, nameAlign: "center", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "•", showSummary: false, headerFontSize: 12,
  },
  overleaf: {
    bodyFont: SANS, accent: "#111", rule: "0.6px solid #aaa", smallCapsSections: true,
    nameSize: 16, nameAlign: "center", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "○", showSummary: false, headerFontSize: 12,
  },
  executive: {
    bodyFont: SERIF, accent: "#1f3a5f", rule: "0.8px solid #1f3a5f", smallCapsSections: true,
    nameSize: 22, nameAlign: "center", nameFont: SERIF, nameColor: "#1f3a5f", nameSmallCaps: true,
    bullet: "•", showSummary: true, headerFontSize: 12,
  },
  tech: {
    bodyFont: SANS, accent: "#2563eb", rule: "2px solid #2563eb", smallCapsSections: false,
    nameSize: 28, nameAlign: "left", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "•", showSummary: true, headerFontSize: 11,
  },
  swiss: {
    bodyFont: SANS, accent: "#6b7280", rule: "none", smallCapsSections: false,
    nameSize: 28, nameAlign: "left", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "–", showSummary: true, headerFontSize: 9, pagePadding: "50px 58px",
  },
  crimson: {
    bodyFont: SERIF, accent: "#881337", rule: "0.8px solid #881337", smallCapsSections: true,
    nameSize: 20, nameAlign: "center", nameFont: SERIF, nameColor: "#881337", nameSmallCaps: false,
    bullet: "•", showSummary: true, headerFontSize: 12,
  },
  compact: {
    bodyFont: SANS, accent: "#111", rule: "0.4px solid #111", smallCapsSections: false,
    nameSize: 14, nameAlign: "center", nameFont: SANS, nameColor: "#111", nameSmallCaps: false,
    bullet: "•", showSummary: false, headerFontSize: 10, pagePadding: "22px 30px",
  },
};

interface MockupProps {
  id: TemplateId;
}

export function TemplateMockup({ id }: MockupProps) {
  const s = MOCK_STYLES[id] ?? MOCK_STYLES.jake;

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: s.headerFontSize,
    fontWeight: 700,
    color: s.accent,
    borderBottom: s.rule,
    paddingBottom: 2,
    marginTop: s.rule === "none" ? 16 : 12,
    marginBottom: 4,
    textTransform: "uppercase",
    fontVariant: s.smallCapsSections ? "small-caps" : "normal",
    letterSpacing: s.rule === "none" ? "0.08em" : "normal",
    fontFamily: s.bodyFont,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: s.nameSize,
    fontWeight: 700,
    color: s.nameColor,
    textAlign: s.nameAlign,
    marginBottom: s.nameAlign === "left" ? 4 : 2,
    fontFamily: s.nameFont,
    fontVariant: s.nameSmallCaps ? "small-caps" : "normal",
  };

  const subHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#444",
    textAlign: s.nameAlign,
    marginBottom: 12,
    fontFamily: s.bodyFont,
  };

  const entryHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    fontWeight: 700,
    color: "#111",
    fontFamily: s.bodyFont,
  };

  const entrySubHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    fontStyle: "italic",
    color: "#333",
    marginTop: 1,
    fontFamily: s.bodyFont,
  };

  const bulletStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#333",
    marginLeft: 15,
    marginTop: 2,
    lineHeight: 1.3,
    fontFamily: s.bodyFont,
    position: "relative",
  };

  const bulletChar = s.bullet;
  const showSummary = s.showSummary;

  return (
    <div style={{ width: 520, minHeight: 735, background: "#fff", padding: s.pagePadding ?? "40px 50px", boxSizing: "border-box", color: "#000" }}>
      <div style={nameStyle}>DASHIELL HAMMETT</div>
      <div style={subHeaderStyle}>555-0199 | detective@continental.com | linkedin.com/in/dash | San Francisco, CA</div>

      {showSummary && (
        <>
          <div style={sectionHeaderStyle}>SUMMARY</div>
          <div style={{ fontSize: 10, color: "#333", lineHeight: 1.4, fontFamily: s.bodyFont }}>
            Results-driven software engineer with 8+ years of experience building scalable data systems and
            full-stack applications. Proven track record in leading cross-functional teams, optimizing
            CI/CD pipelines, and delivering production ML systems that process millions of records daily.
          </div>
        </>
      )}

      <div style={sectionHeaderStyle}>TECHNICAL SKILLS</div>
      <div style={{ fontSize: 10, color: "#111", lineHeight: 1.4, fontFamily: s.bodyFont }}>
        <strong>Languages:</strong> Python, TypeScript, SQL, Go, Rust, LaTeX<br/>
        <strong>Frameworks:</strong> React, FastAPI, Node.js, Django, Tailwind CSS, Next.js<br/>
        <strong>Tools:</strong> Docker, Kubernetes, Terraform, AWS, PostgreSQL, Redis, Apache Kafka
      </div>

      <div style={sectionHeaderStyle}>WORK EXPERIENCE</div>
      <div>
        <div style={entryHeaderStyle}>
          <span>Continental Detective Agency</span>
          <span>Aug. 2021 – Present</span>
        </div>
        <div style={entrySubHeaderStyle}>
          <span>Senior Software Engineer</span>
          <span>San Francisco, CA</span>
        </div>
        {[
          "Architected a distributed event-processing pipeline handling 2M+ daily transactions with sub-200ms latency using Kafka and Redis.",
          "Led migration of monolithic REST API to microservices architecture, reducing deployment time by 65% and improving fault isolation.",
          "Designed and shipped a real-time analytics dashboard serving 500+ internal users, reducing manual reporting effort by 40%.",
          "Mentored a team of 4 junior engineers through code reviews, pair programming, and technical design sessions.",
        ].map((b, i) => (
          <div key={i} style={bulletStyle}>
            <span style={{ position: "absolute", left: -12 }}>{bulletChar}</span>
            {b}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <div style={entryHeaderStyle}>
          <span>Gutting & Associates</span>
          <span>May 2018 – Jul. 2021</span>
        </div>
        <div style={entrySubHeaderStyle}>
          <span>Software Engineer</span>
          <span>New York, NY</span>
        </div>
        {[
          "Built a full-stack customer portal with React and FastAPI, onboarding 12,000+ users in the first quarter post-launch.",
          "Optimized PostgreSQL query performance across 15 critical endpoints, reducing p95 latency from 1.2s to 180ms.",
          "Implemented CI/CD pipelines with GitHub Actions and Docker, cutting release cycles from bi-weekly to daily.",
        ].map((b, i) => (
          <div key={i} style={bulletStyle}>
            <span style={{ position: "absolute", left: -12 }}>{bulletChar}</span>
            {b}
          </div>
        ))}
      </div>

      <div style={sectionHeaderStyle}>PROJECTS</div>
      <div>
        <div style={entryHeaderStyle}>
          <span>Red Harvest Analysis Tool | <i>Python, NLP, FastAPI</i></span>
          <span>Jan. 2023</span>
        </div>
        {[
          "Developed an NLP-powered document classification system processing 50K+ documents daily with 94% accuracy.",
          "Implemented a real-time alerting pipeline with WebSocket streaming and Redis pub/sub for instant notifications.",
        ].map((b, i) => (
          <div key={i} style={bulletStyle}>
            <span style={{ position: "absolute", left: -12 }}>{bulletChar}</span>
            {b}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4 }}>
        <div style={entryHeaderStyle}>
          <span>CloudDeploy CLI | <i>Go, Terraform, AWS</i></span>
          <span>Sep. 2022</span>
        </div>
        {[
          "Created an open-source CLI tool for one-command cloud deployments, reaching 1.2K GitHub stars in 3 months.",
          "Integrated Terraform plan previews and cost estimation, helping teams reduce infrastructure spend by 25%.",
        ].map((b, i) => (
          <div key={i} style={bulletStyle}>
            <span style={{ position: "absolute", left: -12 }}>{bulletChar}</span>
            {b}
          </div>
        ))}
      </div>

      <div style={sectionHeaderStyle}>EDUCATION</div>
      <div>
        <div style={entryHeaderStyle}>
          <span>Stanford University</span>
          <span>June 2018</span>
        </div>
        <div style={entrySubHeaderStyle}>
          <span>Bachelor of Science in Computer Science</span>
          <span>GPA: 3.9/4.0</span>
        </div>
      </div>

      {!showSummary && (
        <>
          <div style={sectionHeaderStyle}>CERTIFICATIONS</div>
          <div style={{ fontSize: 10, color: "#333", lineHeight: 1.4, fontFamily: s.bodyFont }}>
            AWS Solutions Architect – Associate · Kubernetes Application Developer (CKAD) · Google Cloud Professional Data Engineer
          </div>
        </>
      )}
    </div>
  );
}

export function TemplateThumbnail({ id }: MockupProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const MOCKUP_WIDTH = 520;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      setScale(el.clientWidth / MOCKUP_WIDTH);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: "1 / 1.4142",
        overflow: "hidden",
        borderRadius: "0.4rem",
        background: "#fff",
        position: "relative",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0, left: 0,
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        width: MOCKUP_WIDTH,
        pointerEvents: "none",
      }}>
        <TemplateMockup id={id} />
      </div>
    </div>
  );
}

interface ModalProps {
  template: typeof TEMPLATES[number];
  tier: Tier;
  onSelect: (id: TemplateId) => void;
  onUpgrade: () => void;
  onClose: () => void;
}

export function TemplatePreviewModal({ template, tier, onSelect, onUpgrade, onClose }: ModalProps) {
  const isLocked = template.pro && tier !== "pro";

  return (
    <div 
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 620,
          background: "#111",
          borderRadius: "1.25rem",
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh"
        }}
      >
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>{template.label}</h3>
              {template.pro && <span style={{ background: "#ccff00", color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>PRO</span>}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{template.desc}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 24, padding: 0 }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "1.5rem", background: "#1a1a1a" }}>
          <div
            style={{
              height: "min(72vh, 920px)",
              minHeight: 420,
              maxWidth: 540,
              margin: "0 auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              borderRadius: 8,
              padding: "0.75rem",
              background: "#111",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <PreviewPanel
              fetchPdf={() => getTemplatePreview(template.id)}
              refreshKey={template.id}
            />
          </div>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {isLocked ? (
            <button 
              onClick={onUpgrade}
              style={{
                width: "100%",
                padding: "1rem",
                borderRadius: "0.75rem",
                background: "#ccff00",
                color: "#111",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontSize: 15
              }}
            >
              Upgrade to Pro to Use This Template
            </button>
          ) : (
            <button 
              onClick={() => { onSelect(template.id); onClose(); }}
              style={{
                width: "100%",
                padding: "1rem",
                borderRadius: "0.75rem",
                background: "#ccff00",
                color: "#111",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontSize: 15
              }}
            >
              Use This Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
