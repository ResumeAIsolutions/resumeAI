import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { UploadZone } from "../components/UploadZone";
import { ErrorBanner } from "../components/ErrorBanner";
import { UserNav } from "../components/UserNav";
import type { User } from "@supabase/supabase-js";
import { getBaseResume, uploadBaseResume } from "../api/client";
import { supabase } from "../lib/supabase";
import { TemplateId, Tier } from "../types";
import { TEMPLATES, TemplateThumbnail, TemplatePreviewModal } from "../components/TemplateMockup";

interface Props {
  onSubmit: (file: File, jd: string) => void;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  user: User | null;
  onDashboard: () => void;
  onSignOut: () => void;
  onNewResume: () => void;
  onLogoClick: () => void;
  tier: Tier;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onUpgrade: () => void;
  isAdmin?: boolean;
  onAdminPanel?: () => void;
}

const MIN_JD_WORDS = 50;

export function UploadPage({ 
  onSubmit, loading, error, onClearError, user, onDashboard, onSignOut, onNewResume, onLogoClick,
  tier, templateId, onTemplateChange, onUpgrade, isAdmin = false, onAdminPanel
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState("");
  const [saveAsBase, setSaveAsBase] = useState(false);
  const [baseResume, setBaseResume] = useState<{ found: boolean; filename?: string; storage_path?: string } | null>(null);
  const [usingBase, setUsingBase] = useState(false);
  const [hasLoadedBase, setHasLoadedBase] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<typeof TEMPLATES[number] | null>(null);

  useEffect(() => {
    if (user && !hasLoadedBase && !file) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          getBaseResume(session.access_token)
            .then((info) => {
              if (info.found) {
                setBaseResume(info);
                setUsingBase(true);
              }
              setHasLoadedBase(true);
            });
        }
      });
    }
  }, [user, hasLoadedBase, file]);

  const jdWordCount = jd.trim().split(/\s+/).filter(Boolean).length;
  const jdTooShort = jd.trim().length > 0 && jdWordCount < MIN_JD_WORDS;
  const canSubmit = (file !== null || usingBase) && jdWordCount >= MIN_JD_WORDS && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    let finalFile = file;

    try {
      if (usingBase && !file && baseResume?.storage_path) {
        // Download base resume to submit
        const { data, error: dlError } = await supabase.storage.from("resumes").download(baseResume.storage_path);
        if (dlError || !data) throw new Error("Failed to load your base resume.");
        finalFile = new File([data], baseResume.filename || "resume.pdf", { type: data.type });
      }

      if (!finalFile) return;

      if (saveAsBase && user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await uploadBaseResume(finalFile, session.access_token);
      }

      onSubmit(finalFile, jd);
    } catch (err) {
      console.error(err);
      // We could set an error state here, but for now just log it
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={onLogoClick}
          style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--white-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          aria-label="Go to dashboard"
        >
          Resume<span style={{ color: "var(--lime)" }}>AI</span>
        </button>
        {user ? (
          <UserNav user={user} isAdmin={isAdmin} onDashboard={onDashboard} onSignOut={onSignOut} onNewResume={onNewResume} onAdminPanel={onAdminPanel} />
        ) : (
          <span className="mono" style={{ color: "var(--text-tertiary)" }}>step 1 of 3</span>
        )}
      </nav>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div className="mono" style={{ color: "var(--lime)", marginBottom: "0.75rem" }}>upload & tailor</div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 700, lineHeight: 1.15, color: "var(--white-primary)", letterSpacing: "-0.02em" }}>
            Tailor your resume<br />
            <span style={{ color: "var(--lime)" }}>to any job in 60 seconds.</span>
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Upload your resume and paste the job description. Our AI rewrites your bullets to match — without making anything up.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "1.5rem" }}>
            <ErrorBanner message={error} onDismiss={onClearError} />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Resume upload */}
            <div className="bento-card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <label className="mono" style={{ color: "var(--text-secondary)" }}>
                  your resume
                </label>
                {usingBase && (
                  <button
                    type="button"
                    onClick={() => { setUsingBase(false); setFile(null); }}
                    style={{ background: "none", border: "none", color: "var(--lime)", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    Use a different file
                  </button>
                )}
              </div>

              {usingBase && baseResume ? (
                <div style={{ 
                  padding: "2rem", 
                  border: "1px dashed var(--lime)", 
                  borderRadius: "1rem", 
                  background: "rgba(204,255,0,0.03)",
                  textAlign: "center"
                }}>
                  <p style={{ color: "var(--white-primary)", fontWeight: 600, fontSize: 15 }}>
                    Loaded: {baseResume.filename}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: "0.4rem" }}>
                    Your stored base resume will be used for tailoring.
                  </p>
                </div>
              ) : (
                <>
                  <UploadZone 
                    file={file} 
                    onFileSelect={(f) => {
                      setFile(f);
                      setUsingBase(false);
                    }} 
                  />
                  {user && file && (
                    <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        id="saveAsBase"
                        checked={saveAsBase}
                        onChange={(e) => setSaveAsBase(e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                      <label htmlFor="saveAsBase" style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}>
                        {baseResume?.found ? "Replace my current base resume with this one" : "Save this as my base resume for future use"}
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Template Gallery */}
            <div className="bento-card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
                <label className="mono" style={{ color: "var(--text-secondary)" }}>
                  resume template
                </label>
                <div style={{ fontSize: 11, color: "var(--lime)", fontWeight: 600 }}>
                  {TEMPLATES.find(t => t.id === templateId)?.label}
                </div>
              </div>

              <div style={{ 
                display: "flex", 
                gap: "1.25rem", 
                overflowX: "auto", 
                padding: "4px 4px 1rem 4px",
                margin: "0 -4px",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch"
              }}>
                {TEMPLATES.map((t) => {
                  const isActive = t.id === templateId;
                  const isLocked = t.pro && tier !== "pro";

                  return (
                    <div 
                      key={t.id}
                      onClick={() => setPreviewTemplate(t)}
                      style={{
                        flex: "0 0 130px",
                        cursor: "pointer",
                        position: "relative",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div style={{
                        borderRadius: "0.75rem",
                        overflow: "hidden",
                        border: `2px solid ${isActive ? "var(--lime)" : "rgba(255,255,255,0.06)"}`,
                        position: "relative",
                        aspectRatio: "1 / 1.41",
                        background: "rgba(255,255,255,0.02)"
                      }}>
                        <TemplateThumbnail id={t.id} />
                        
                        {isLocked && (
                          <div style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.5)",
                            backdropFilter: "blur(1px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                            <span style={{ fontSize: "1.25rem" }}>🔒</span>
                          </div>
                        )}
                        
                        {isActive && (
                          <div style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "var(--lime)",
                            color: "#000",
                            borderRadius: "50%",
                            width: 20,
                            height: 20,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 800,
                            boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: "0.6rem", textAlign: "center" }}>
                        <div style={{ fontSize: 12, color: isActive ? "var(--lime)" : "var(--white-primary)", fontWeight: 600 }}>{t.label}</div>
                        {t.pro && <div style={{ fontSize: 9, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>PRO</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Job description */}
            <div className="bento-card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1rem" }}>
                <label htmlFor="jd" className="mono" style={{ color: "var(--text-secondary)" }}>
                  job description
                </label>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: jdTooShort ? "#f87171" : "var(--text-tertiary)",
                  }}
                  aria-live="polite"
                >
                  {jdWordCount} / {MIN_JD_WORDS} words min
                </span>
              </div>
              <textarea
                id="jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the full job description here, including responsibilities and requirements..."
                rows={10}
                aria-describedby="jd-hint"
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${jdTooShort ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "1rem",
                  padding: "1rem",
                  fontSize: 14,
                  color: "var(--white-primary)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: 1.6,
                  outline: "none",
                  resize: "vertical",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { if (!jdTooShort) e.currentTarget.style.borderColor = "rgba(204,255,0,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = jdTooShort ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)"; }}
              />
              {jdTooShort && (
                <p id="jd-hint" role="alert" style={{ marginTop: "0.5rem", fontSize: 12, color: "#f87171" }}>
                  Paste the full job description for best results (at least {MIN_JD_WORDS} words).
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={loading}
              className="neon-btn"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: 15,
                opacity: canSubmit ? 1 : 0.4,
                cursor: canSubmit ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: "inline-block", width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Tailoring your resume...
                </>
              ) : "Tailor My Resume →"}
            </button>
          </div>
        </form>

        <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          Your resume is processed in memory and never stored on our servers.
        </p>
      </main>

      {previewTemplate && (
        <TemplatePreviewModal 
          template={previewTemplate}
          tier={tier}
          onSelect={(id) => { onTemplateChange(id); setPreviewTemplate(null); }}
          onUpgrade={() => { setPreviewTemplate(null); onUpgrade(); }}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
