import { useState, useEffect, useRef } from "react";
import { Copy, Download, RefreshCw, Loader2, Check } from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { UserNav } from "../components/UserNav";
import { PreviewPanel } from "../components/PreviewPanel";
import { generateCoverLetter, downloadCoverLetterPdf } from "../api/client";
import { supabase } from "../lib/supabase";
import type { ResumeSummary, JDAnalysis } from "../types";
import type { User } from "@supabase/supabase-js";

interface CoverLetterPageProps {
  resumeSummary: ResumeSummary;
  jdAnalysis: JDAnalysis;
  onDone: () => void;
  user: User | null;
  onDashboard: () => void;
  onSignOut: () => void;
  onNewResume: () => void;
  onLogoClick: () => void;
}

export function CoverLetterPage({
  resumeSummary,
  jdAnalysis,
  onDone,
  user,
  onDashboard,
  onSignOut,
  onNewResume,
  onLogoClick,
}: CoverLetterPageProps) {
  const [coverLetter, setCoverLetter] = useState("");
  const [metadata, setMetadata] = useState({ hiring_manager: "Hiring Manager", company_name: "", job_title: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setCoverLetter("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const result = await generateCoverLetter(resumeSummary, jdAnalysis, abortRef.current.signal, session?.access_token);
      setCoverLetter(result.cover_letter);
      setMetadata({
        hiring_manager: result.hiring_manager,
        company_name: result.company_name,
        job_title: result.job_title,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      textareaRef.current?.select();
    }
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const blob = await downloadCoverLetterPdf(
        resumeSummary,
        coverLetter,
        metadata.hiring_manager,
        metadata.company_name,
        metadata.job_title,
        session?.access_token,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cover_letter.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "PDF generation failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  const wordCount = coverLetter.trim().split(/\s+/).filter(Boolean).length;
  const wcColor =
    wordCount < 200 || wordCount > 400
      ? "rgba(248,113,113,0.7)"
      : wordCount < 250 || wordCount > 350
      ? "rgba(251,191,36,0.7)"
      : "rgba(204,255,0,0.5)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 20,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "1rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)",
      }}>
        <button
          type="button"
          onClick={onLogoClick}
          style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", color: "var(--white-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
        >
          Resume<span style={{ color: "var(--lime)" }}>AI</span>
        </button>
        {user ? (
          <UserNav user={user} onDashboard={onDashboard} onSignOut={onSignOut} onNewResume={onNewResume} />
        ) : (
          <span className="mono" style={{ color: "var(--text-tertiary)" }}>optional — cover letter</span>
        )}
      </nav>

      {/* 60/40 split */}
      <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>

      <main style={{ flex: "0 0 60%", maxWidth: "60%", overflowY: "auto", padding: "2.5rem 1.5rem 6rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="mono" style={{ color: "var(--lime)", marginBottom: "0.5rem" }}>ai generated</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--white-primary)", letterSpacing: "-0.02em" }}>
            Your Cover Letter
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: 14, color: "var(--text-secondary)" }}>
            Tailored to match the job description. Edit freely before downloading.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: "1.5rem" }}>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {pdfError && (
          <div style={{ marginBottom: "1.5rem" }}>
            <ErrorBanner message={pdfError} onDismiss={() => setPdfError(null)} />
          </div>
        )}

        {/* Editor card */}
        <div className="bento-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          {loading ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "1rem", padding: "4rem 2rem",
              color: "var(--text-secondary)",
            }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--lime)" }} aria-hidden="true" />
              <p style={{ fontSize: 14 }}>Generating your cover letter…</p>
            </div>
          ) : error && !coverLetter ? (
            <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
              <button
                onClick={load}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.625rem 1.5rem", borderRadius: 9999,
                  border: "1px solid rgba(204,255,0,0.3)", background: "transparent",
                  color: "var(--lime)", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={18}
                aria-label="Cover letter text — editable"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  color: "var(--white-primary)", fontSize: 14, lineHeight: 1.75,
                  resize: "vertical", fontFamily: "'Space Grotesk', sans-serif",
                  boxSizing: "border-box",
                }}
              />
              <div style={{
                marginTop: "0.75rem", paddingTop: "0.75rem",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12, color: wcColor,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {wordCount} words
                <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>· target: 280–330</span>
              </div>
            </>
          )}
        </div>

        {/* Toolbar — only shown when text is ready */}
        {!loading && coverLetter && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            {/* Download PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              aria-label="Download as PDF"
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1.25rem", borderRadius: 9999,
                border: "1px solid rgba(204,255,0,0.3)",
                background: "rgba(204,255,0,0.08)",
                color: pdfLoading ? "rgba(204,255,0,0.4)" : "var(--lime)",
                fontSize: 13, fontWeight: 700,
                cursor: pdfLoading ? "not-allowed" : "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                transition: "background 0.2s",
              }}
            >
              {pdfLoading
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden="true" />
                : <Download size={14} aria-hidden="true" />}
              {pdfLoading ? "Generating PDF…" : "Download PDF"}
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              aria-label={copied ? "Copied!" : "Copy to clipboard"}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1.25rem", borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: copied ? "rgba(255,255,255,0.06)" : "transparent",
                color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
                transition: "background 0.2s",
              }}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? "Copied!" : "Copy Text"}
            </button>

            {/* Regenerate */}
            <button
              onClick={load}
              aria-label="Regenerate cover letter"
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.625rem 1.25rem", borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Regenerate
            </button>
          </div>
        )}

        {/* Back */}
        <button
          onClick={onDone}
          disabled={loading}
          className="neon-btn"
          style={{
            padding: "0.75rem 2rem", fontSize: 14,
            opacity: loading ? 0.5 : 1,
            cursor: loading ? "not-allowed" : "pointer",
            animation: "none",
          }}
        >
          ← Back to Resume
        </button>
      </main>

      {/* Right 40% — PDF preview (only shown after content is generated) */}
      <aside style={{
        flex: "0 0 40%",
        maxWidth: "40%",
        overflowY: "auto",
        padding: "1.5rem",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}>
        {coverLetter ? (
          <PreviewPanel
            fetchPdf={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              return downloadCoverLetterPdf(
                resumeSummary,
                coverLetter,
                metadata.hiring_manager,
                metadata.company_name,
                metadata.job_title,
                session?.access_token,
              );
            }}
            refreshKey={JSON.stringify({
              coverLetter,
              hiringManager: metadata.hiring_manager,
              companyName: metadata.company_name,
              jobTitle: metadata.job_title,
            })}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)" }}>
            <p style={{ fontSize: 13 }}>PDF preview will appear once your cover letter is generated.</p>
          </div>
        )}
      </aside>

      </div>{/* end split */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
