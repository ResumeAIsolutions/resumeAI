import React from "react";
import { TemplateId, Tier } from "../types";

export const TEMPLATES = [
  { id: "jake",     label: "Jake's Classic", desc: "ATS-safe · Minimal · Clean",  pro: false },
  { id: "modern",   label: "Modern",         desc: "Teal accents · Left-aligned · Professional",  pro: true  },
  { id: "soham",    label: "ATS Pro",        desc: "Small-caps · ATS optimized",   pro: true  },
  { id: "overleaf", label: "Clean",          desc: "Open bullets · Minimal",       pro: true  },
] as const;

interface MockupProps {
  id: TemplateId;
}

export function TemplateMockup({ id }: MockupProps) {
  const isModern = id === "modern";
  const isSoham = id === "soham" || id === "overleaf";
  const isJake = id === "jake";
  const isOverleaf = id === "overleaf";

  const accentColor = isModern ? "#4495A2" : "#111";
  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: isModern ? 11 : isSoham ? 12 : 10,
    fontWeight: 700,
    color: isModern ? "#4495A2" : "#111",
    borderBottom: isModern ? "1px solid #4495A2" : isSoham ? "0.6px solid #aaa" : "0.4px solid #111",
    paddingBottom: 2,
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    fontVariant: isSoham ? "small-caps" : "normal",
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  const nameStyle: React.CSSProperties = {
    fontSize: isModern ? 28 : isSoham ? 16 : 15,
    fontWeight: 700,
    color: isModern ? "#111" : "#111",
    textAlign: isModern ? "left" : "center",
    marginBottom: isModern ? 4 : 2,
    fontFamily: isModern ? "Georgia, 'Times New Roman', serif" : "Arial, Helvetica, sans-serif",
  };

  const subHeaderStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#444",
    textAlign: isModern ? "left" : "center",
    marginBottom: 12,
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  const entryHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    fontWeight: 700,
    color: "#111",
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  const entrySubHeaderStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    fontStyle: "italic",
    color: "#333",
    marginTop: 1,
    fontFamily: "Arial, Helvetica, sans-serif",
  };

  const bulletStyle: React.CSSProperties = {
    fontSize: 10,
    color: "#333",
    marginLeft: 15,
    marginTop: 2,
    lineHeight: 1.3,
    fontFamily: "Arial, Helvetica, sans-serif",
    position: "relative",
  };

  const bulletChar = isOverleaf ? "○" : "•";

  return (
    <div style={{ width: 520, minHeight: 735, background: "#fff", padding: "40px 50px", boxSizing: "border-box", color: "#000" }}>
      <div style={nameStyle}>DASHIELL HAMMETT</div>
      <div style={subHeaderStyle}>555-0199 | detective@continental.com | linkedin.com/in/dash | San Francisco, CA</div>

      {isModern && (
        <>
          <div style={sectionHeaderStyle}>SUMMARY</div>
          <div style={{ fontSize: 10, color: "#333", lineHeight: 1.4, fontFamily: "Arial, sans-serif" }}>
            Results-driven software engineer with 8+ years of experience building scalable data systems and
            full-stack applications. Proven track record in leading cross-functional teams, optimizing
            CI/CD pipelines, and delivering production ML systems that process millions of records daily.
          </div>
        </>
      )}

      <div style={sectionHeaderStyle}>TECHNICAL SKILLS</div>
      <div style={{ fontSize: 10, color: "#111", lineHeight: 1.4, fontFamily: "Arial, sans-serif" }}>
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

      {!isModern && (
        <>
          <div style={sectionHeaderStyle}>CERTIFICATIONS</div>
          <div style={{ fontSize: 10, color: "#333", lineHeight: 1.4, fontFamily: "Arial, sans-serif" }}>
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

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "1.5rem", display: "flex", justifyContent: "center", background: "#1a1a1a" }}>
          <div style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.5)", borderRadius: 4, flexShrink: 0 }}>
            <TemplateMockup id={template.id} />
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
