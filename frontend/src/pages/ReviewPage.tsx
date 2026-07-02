import { useState, useMemo } from "react";
import { InsightsPanel } from "../components/InsightsPanel";
import { DiffViewer } from "../components/DiffViewer";
import { EdgeCaseAlert } from "../components/EdgeCaseAlert";
import { ErrorBanner } from "../components/ErrorBanner";
import { PreviewPanel } from "../components/PreviewPanel";
import { FileDown, MailPlus, CheckCheck, XCircle } from "lucide-react";
import type { TailorResponse, BulletState, DownloadRequest, Tier, UpgradeReason, TemplateId } from "../types";
import { downloadFile } from "../api/client";

const SECTIONS = ["All", "Experience", "Projects", "Summary", "Skills", "Education"] as const;
type Section = typeof SECTIONS[number];

interface Props {
  result: TailorResponse;
  onDone: () => void;
  onCoverLetter: () => void;
  tier: Tier;
  onDashboard: () => void;
  onSignOut: () => void;
  onLogoClick: () => void;
  onUpgrade: (reason: UpgradeReason) => void;
  templateId: TemplateId;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReviewPage({
  result, onDone, onCoverLetter, tier,
  onUpgrade, templateId,
}: Props) {
  const [bulletStates, setBulletStates] = useState<Record<string, BulletState>>(() => {
    const init: Record<string, BulletState> = {};
    for (const diff of result.diff) {
      init[diff.bullet_id] = { choice: "accept", editedText: diff.tailored };
    }
    return init;
  });
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [downloaded, setDownloaded] = useState<"pdf" | "docx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("All");

  const visibleDiffs = useMemo(() => {
    if (activeSection === "All") return result.diff;
    const normalizedSection = activeSection.toLowerCase();
    return result.diff.filter((diff) => diff.section.toLowerCase().includes(normalizedSection));
  }, [activeSection, result.diff]);

  const projectedMatchPercent = useMemo(() => {
    const allKeywords = [
      ...result.jd_analysis.ats_keywords,
      ...result.jd_analysis.required_skills,
    ];
    if (!allKeywords.length) return result.scores.match_percent;
    const accepted = new Set<string>();
    for (const diff of result.diff) {
      const state = bulletStates[diff.bullet_id] ?? { choice: "accept", editedText: diff.tailored };
      if (state.choice !== "reject") {
        diff.keywords_added.forEach((k) => accepted.add(k.toLowerCase()));
      }
    }
    const gain = Math.round((accepted.size / allKeywords.length) * 100);
    return Math.min(100, result.scores.match_percent + gain);
  }, [bulletStates, result.diff, result.jd_analysis, result.scores.match_percent]);

  function buildDownloadRequest(): DownloadRequest {
    const accepted: Record<string, string> = {};
    for (const diff of result.diff) {
      const state = bulletStates[diff.bullet_id] ?? { choice: "accept", editedText: diff.tailored };
      if (state.choice === "accept") accepted[diff.bullet_id] = diff.tailored;
      else if (state.choice === "edit") accepted[diff.bullet_id] = state.editedText;
      else accepted[diff.bullet_id] = "original";
    }
    return { session_id: result.session_id, accepted_bullets: accepted, template_id: templateId };
  }

  async function handleDownload(format: "pdf" | "docx") {
    if (format === "docx" && tier !== "pro") { onUpgrade("docx"); return; }
    setDownloading(format);
    setDownloadError(null);
    try {
      const req = buildDownloadRequest();
      const blob = await downloadFile(format, req);
      const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const jobTitle = slug(`${result.jd_analysis.role_level} ${result.jd_analysis.industry}`);
      const userName = slug(result.resume_summary.name);
      triggerDownload(blob, `${jobTitle}_${userName}.${format}`);
      setDownloaded(format);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  function handleBulletChange(bulletId: string, state: BulletState) {
    setBulletStates((prev) => ({ ...prev, [bulletId]: state }));
  }

  function handleAcceptAll() {
    const next: Record<string, BulletState> = {};
    for (const diff of result.diff) next[diff.bullet_id] = { choice: "accept", editedText: diff.tailored };
    setBulletStates(next);
  }

  function handleRejectAll() {
    const next: Record<string, BulletState> = {};
    for (const diff of result.diff) next[diff.bullet_id] = { choice: "reject", editedText: diff.original };
    setBulletStates(next);
  }

  const acceptedCount = Object.values(bulletStates).filter((state) => state.choice === "accept" || state.choice === "edit").length;
  const totalChanged = result.diff.length;
  const previewRequest = useMemo(() => buildDownloadRequest(), [bulletStates, templateId, result.session_id]);
  const previewRefreshKey = useMemo(() => JSON.stringify(previewRequest), [previewRequest]);

  return (
    <div style={{
      display: "flex",
      height: "100%",
      overflow: "hidden",
      fontFamily: "'Inter', sans-serif",
      background: "var(--bg)",
    }}>

      {/* ── Zone 1: PDF Preview (42%) ───────────────────── */}
      <div style={{
        flex: "0 0 42%",
        maxWidth: "42%",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "0.875rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <span className="label">Preview</span>
          <span className="pill pill-ghost" style={{ fontSize: 11 }}>
            {acceptedCount}/{totalChanged} accepted
          </span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
          <PreviewPanel
            fetchPdf={() => downloadFile("pdf", previewRequest)}
            refreshKey={previewRefreshKey}
          />
        </div>
      </div>

      {/* ── Zone 2: AI Editor (38%) ─────────────────────── */}
      <div style={{
        flex: "0 0 38%",
        maxWidth: "38%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRight: "1px solid var(--border)",
      }}>
        {/* Editor toolbar */}
        <div style={{
          padding: "0.875rem 1rem 0",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
            <span className="label">AI Suggestions</span>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button
                onClick={handleAcceptAll}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "0.3rem 0.625rem", borderRadius: 9999,
                  background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)",
                  color: "var(--green)", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(52,211,153,0.18)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(52,211,153,0.1)")}
              >
                <CheckCheck size={12} /> Accept All
              </button>
              <button
                onClick={handleRejectAll}
                style={{
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  padding: "0.3rem 0.625rem", borderRadius: 9999,
                  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                  color: "var(--red)", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
              >
                <XCircle size={12} /> Reject All
              </button>
            </div>
          </div>

          {/* Section chips */}
          <div style={{ display: "flex", gap: "0.25rem", overflowX: "auto", paddingBottom: "0.75rem", scrollbarWidth: "none" }}>
            {SECTIONS.map(s => (
              <button key={s} className={`section-chip${activeSection === s ? " active" : ""}`} onClick={() => setActiveSection(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Diffs */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1rem 6rem" }}>
          {downloadError && (
            <div style={{ marginBottom: "1rem" }}>
              <ErrorBanner message={downloadError} onDismiss={() => setDownloadError(null)} />
            </div>
          )}
          {result.edge_cases.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <EdgeCaseAlert edgeCases={result.edge_cases} />
            </div>
          )}
          {visibleDiffs.length === 0 ? (
            <div
              className="bento-card"
              style={{
                padding: "2rem 1.25rem",
                textAlign: "center",
                background: "var(--surface)",
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
                No suggestions in {activeSection}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Try another section filter to review the rest of the tailored bullets.
              </p>
            </div>
          ) : (
            <DiffViewer
              diffs={visibleDiffs}
              bulletStates={bulletStates}
              onBulletChange={handleBulletChange}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
            />
          )}
        </div>
      </div>

      {/* ── Zone 3: Insights (20%) ──────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}>
        <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span className="label">Insights</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <InsightsPanel
            scores={result.scores}
            projectedMatchPercent={projectedMatchPercent}
            atsKeywords={[...result.jd_analysis.ats_keywords, ...result.jd_analysis.required_skills]}
            edgeCaseCount={result.edge_cases.length}
          />
        </div>
      </div>

      {/* ── Floating action bar ──────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.625rem 0.875rem",
        background: "rgba(17,17,24,0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-2xl)",
        boxShadow: "var(--shadow-lg)",
      }}>
        <button
          onClick={() => handleDownload("pdf")}
          disabled={downloading === "pdf"}
          className="accent-btn"
          style={{ fontSize: 13, padding: "0.5rem 1rem", gap: "0.4rem" }}
        >
          <FileDown size={14} />
          {downloading === "pdf" ? "Exporting…" : downloaded === "pdf" ? "✓ PDF" : "Export PDF"}
        </button>

        <button
          onClick={() => handleDownload("docx")}
          disabled={downloading === "docx"}
          className="ghost-btn"
          style={{ fontSize: 13, gap: "0.4rem" }}
        >
          <FileDown size={14} />
          {tier !== "pro" ? "DOCX (Pro)" : downloading === "docx" ? "Exporting…" : "Export DOCX"}
        </button>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        <button
          onClick={onCoverLetter}
          className="ghost-btn"
          style={{ fontSize: 13, gap: "0.4rem" }}
        >
          <MailPlus size={14} />
          {tier !== "pro" ? "Cover Letter (Pro)" : "Cover Letter"}
        </button>

        <button
          onClick={onDone}
          className="ghost-btn"
          style={{ fontSize: 13 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
