import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Download,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { downloadFile, getBaseResume, uploadBaseResume } from "../api/client";
import type { BaseResumeInfo } from "../api/client";
import { loadHistory } from "../lib/history";
import { supabase } from "../lib/supabase";
import type { HistoryEntry, TailorResponse, Tier, UpgradeReason } from "../types";

interface Props {
  tier: Tier;
  onNewResume: () => void;
  onReopen: (result: TailorResponse) => void;
  onUpgrade: (reason: UpgradeReason) => void;
  onboardingGuide?: boolean;
  onBaseResumeReady?: (info: BaseResumeInfo) => void;
  onContinueSetup?: () => void;
}

function buildAcceptedBullets(result: TailorResponse) {
  return Object.fromEntries(result.diff.map((diff) => [diff.bullet_id, diff.tailored]));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildFilename(result: TailorResponse, format: "pdf" | "docx") {
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "tailored_resume";

  const role = slugify(`${result.jd_analysis.role_level} ${result.jd_analysis.industry}`);
  const name = slugify(result.resume_summary.name || "resume");
  return `${role}_${name}.${format}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ResumesPage({
  tier,
  onNewResume,
  onReopen,
  onUpgrade,
  onboardingGuide = false,
  onBaseResumeReady,
  onContinueSetup,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseResume, setBaseResume] = useState<{ found: boolean; filename?: string } | null>(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [uploadingBase, setUploadingBase] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    void refreshHistory();
    void refreshBaseResume();
  }, []);

  async function refreshHistory() {
    setLoading(true);
    setError(null);
    try {
      setHistory(await loadHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resume history.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshBaseResume() {
    setBaseLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const emptyInfo = { found: false };
        setBaseResume(emptyInfo);
        return emptyInfo;
      }
      const info = await getBaseResume(session.access_token);
      setBaseResume(info);
      return info;
    } catch {
      const emptyInfo = { found: false };
      setBaseResume(emptyInfo);
      return emptyInfo;
    } finally {
      setBaseLoading(false);
    }
  }

  async function handleBaseResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingBase(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again to upload a base resume.");
      await uploadBaseResume(file, session.access_token);
      const info = await refreshBaseResume();
      if (info?.found) {
        onBaseResumeReady?.(info);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Base resume upload failed.");
    } finally {
      setUploadingBase(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleDownload(entry: HistoryEntry, format: "pdf" | "docx") {
    const response = entry.response;
    if (!response) return;

    if (format === "docx" && tier !== "pro") {
      onUpgrade("docx");
      return;
    }

    setDownloading(`${entry.id}:${format}`);
    setError(null);
    try {
      const blob = await downloadFile(
        format,
        {
          session_id: response.session_id,
          accepted_bullets: buildAcceptedBullets(response),
        },
      );
      triggerDownload(blob, buildFilename(response, format));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        padding: "1.5rem",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 10%, transparent) 0, transparent 32%), var(--bg)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <section
          className="bento-card"
          style={{
            padding: "1.5rem",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="label" style={{ marginBottom: "0.45rem" }}>
              Resume Library
            </div>
            <h1 style={{ fontSize: "2.1rem", letterSpacing: "-0.05em", color: "var(--text-primary)", marginBottom: "0.55rem" }}>
              Saved sessions, exports, and your base resume
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 640 }}>
              Every tailored session you save can be reopened here. You can also set the resume file you want
              to reuse as your default base for future tailoring.
            </p>
          </div>
          <button type="button" className="accent-btn" onClick={onNewResume}>
            <FileText size={16} />
            Tailor New Resume
          </button>
        </section>

        {error && (
          <div
            style={{
              padding: "0.9rem 1rem",
              borderRadius: 16,
              background: "var(--error-soft)",
              border: "1px solid rgba(255, 69, 58, 0.2)",
              color: "var(--error)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {onboardingGuide && (
          <section
            className="bento-card"
            style={{
              padding: "1rem 1.1rem",
              borderColor: "var(--accent-border)",
              background: "color-mix(in srgb, var(--accent-soft) 42%, var(--surface))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ maxWidth: 760 }}>
                <div className="label" style={{ color: "var(--accent)", marginBottom: "0.4rem" }}>
                  Step 1 of 2
                </div>
                <h2 style={{ fontSize: 18, color: "var(--text-primary)", marginBottom: "0.45rem" }}>
                  Choose your default resume first
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  Upload the resume you want ResumeAI to reuse by default. As soon as it is saved, we’ll take you to templates so you can finish the setup.
                </p>
              </div>

              {baseResume?.found && onContinueSetup && (
                <button type="button" className="accent-btn" onClick={onContinueSetup}>
                  Continue to Templates
                </button>
              )}
            </div>
          </section>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
            gap: "1rem",
          }}
        >
          <div className="bento-card" style={{ padding: "1.25rem" }}>
            <div className="label" style={{ marginBottom: "0.35rem" }}>
              Base Resume
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
              Default file for quick tailoring
            </h2>

            {baseLoading ? (
              <div className="skeleton" style={{ height: 110 }} />
            ) : baseResume?.found ? (
              <div
                style={{
                  padding: "1rem",
                  borderRadius: 16,
                  border: "1px solid var(--border)",
                  background: "var(--elevated)",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", marginBottom: "0.5rem", minWidth: 0 }}>
                  <FolderOpen size={18} color="var(--accent)" />
                  <span style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    flex: 1,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    minWidth: 0,
                  }}>
                    {baseResume.filename}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  This file will be preselected as soon as you open the tailoring flow.
                </p>
              </div>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  borderRadius: 16,
                  border: "1px dashed var(--border)",
                  background: "var(--elevated)",
                  marginBottom: "1rem",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.6,
                }}
              >
                No default base resume saved yet. Upload one here and it will be available from the new-resume flow.
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              style={{ display: "none" }}
              onChange={handleBaseResumeChange}
            />

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="accent-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBase}
              >
                {uploadingBase ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={16} />}
                {baseResume?.found ? "Replace Base Resume" : "Upload Base Resume"}
              </button>
              <button type="button" className="ghost-btn" onClick={() => void refreshBaseResume()}>
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          <div className="bento-card" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div>
                <div className="label" style={{ marginBottom: "0.35rem" }}>
                  Saved Sessions
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Reopen or export any resume</h2>
              </div>
              <button type="button" className="ghost-btn" onClick={() => void refreshHistory()}>
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {[0, 1, 2].map((item) => (
                  <div key={item} className="skeleton" style={{ height: 124 }} />
                ))}
              </div>
            ) : history.length > 0 ? (
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {history.map((entry) => {
                  const response = entry.response;
                  if (!response) return null;
                  const pdfLoading = downloading === `${entry.id}:pdf`;
                  const docxLoading = downloading === `${entry.id}:docx`;
                  return (
                    <div
                      key={entry.id}
                      className="bento-card"
                      style={{
                        padding: "1rem",
                        background: "var(--elevated)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "1rem",
                          flexWrap: "wrap",
                          marginBottom: "0.85rem",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                              {entry.job_role || response.resume_summary.title || "Tailored Resume"}
                            </span>
                            <span className="pill pill-accent">{entry.match_percent ?? response.scores.match_percent}% match</span>
                            <span className="pill pill-ghost">{entry.ats_score ?? response.scores.ats_score}% ATS</span>
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                            {entry.original_filename ?? "Untitled resume"} · {formatDate(entry.created_at)}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            {response.changed_bullets} of {response.total_bullets} bullets tailored
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                        <button type="button" className="accent-btn" onClick={() => onReopen(response)}>
                          Open Review
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => void handleDownload(entry, "pdf")}
                          disabled={pdfLoading}
                        >
                          {pdfLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
                          Export PDF
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => void handleDownload(entry, "docx")}
                          disabled={docxLoading}
                        >
                          {docxLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
                          {tier === "pro" ? "Export DOCX" : "DOCX (Pro)"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: "2rem",
                  borderRadius: 18,
                  border: "1px dashed var(--border)",
                  background: "var(--elevated)",
                  textAlign: "center",
                }}
              >
                <FileText size={34} color="var(--text-tertiary)" style={{ margin: "0 auto 0.9rem" }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
                  No saved sessions yet
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Tailor your first resume and it will show up here with reopen and export actions.
                </p>
                <button type="button" className="accent-btn" onClick={onNewResume}>
                  <FileText size={16} />
                  Tailor First Resume
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
