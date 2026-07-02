import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface Feedback {
  id: string;
  type: "bug" | "feature" | "general";
  name: string | null;
  email: string | null;
  message: string;
  priority: string | null;
  image_url: string | null;
  metadata: Record<string, string>;
  user_id: string | null;
  status: "open" | "in-progress" | "resolved";
  created_at: string;
  updated_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  bug: "#f97316",
  feature: "#8b5cf6",
  general: "#3b82f6",
};
const TYPE_EMOJI: Record<string, string> = { bug: "🐛", feature: "💡", general: "💬" };
const STATUS_COLORS: Record<string, string> = {
  open: "#eab308",
  "in-progress": "#3b82f6",
  resolved: "#10b981",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const color = map[value] ?? "#888";
  return (
    <span style={{ background: `${color}20`, color, border: `1px solid ${color}55`, borderRadius: 9999, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" as any }}>
      {value}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ feedback, onClose, onStatusChange }: {
  feedback: Feedback;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function changeStatus(newStatus: string) {
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id: feedback.id, status: newStatus }),
      });
      if (resp.ok) onStatusChange(feedback.id, newStatus);
    } finally {
      setUpdating(false);
    }
  }
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
    >
      <div style={{ width: "100%", maxWidth: 520, background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "1.5rem", padding: "2rem", position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "1rem", right: "1rem", background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: 20 }}>{TYPE_EMOJI[feedback.type]}</span>
          <Badge value={feedback.type} map={TYPE_COLORS} />
          <Badge value={feedback.status} map={STATUS_COLORS} />
          {feedback.priority && <Badge value={feedback.priority} map={{ low: "#10b981", medium: "#f59e0b", high: "#ef4444" }} />}
        </div>

        {feedback.name && <h3 style={{ color: "#ebebeb", fontWeight: 700, marginBottom: "0.75rem", fontSize: 16 }}>{feedback.name}</h3>}

        <p style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.65, marginBottom: "1.25rem", whiteSpace: "pre-wrap" }}>{feedback.message}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {feedback.email && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>✉️ {feedback.email}</div>}
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>📅 {fmt(feedback.created_at)}</div>
          {(feedback.metadata as any)?.browser && <div style={{ fontSize: 11, color: "var(--text-tertiary)", gridColumn: "1/-1", wordBreak: "break-all" }}>🌐 {(feedback.metadata as any).browser?.substring(0, 100)}</div>}
          {(feedback.metadata as any)?.url && <div style={{ fontSize: 11, color: "var(--text-tertiary)", gridColumn: "1/-1" }}>🔗 {(feedback.metadata as any).url}</div>}
        </div>

        {feedback.image_url && (
          <img src={feedback.image_url} alt="Screenshot" style={{ width: "100%", borderRadius: "0.75rem", marginBottom: "1.25rem", border: "1px solid rgba(255,255,255,0.08)" }} />
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: "0.65rem", fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Update Status</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" as any }}>
            {(["open", "in-progress", "resolved"] as const).map((s) => (
              <button key={s} onClick={() => changeStatus(s)} disabled={updating || feedback.status === s}
                style={{ padding: "0.45rem 1rem", borderRadius: 9999, border: `1px solid ${STATUS_COLORS[s]}55`, background: feedback.status === s ? `${STATUS_COLORS[s]}20` : "transparent", color: STATUS_COLORS[s], fontSize: 12, fontWeight: 600, cursor: feedback.status === s ? "default" : "pointer", fontFamily: "'Space Grotesk', sans-serif", opacity: updating ? 0.6 : 1 }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Management Tab ──────────────────────────────────────────────────────

function AdminsTab() {
  const [admins, setAdmins] = useState<{ email: string; isDefault?: boolean }[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const DEFAULT_ADMIN = "edlahareen@gmail.com";

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${session?.access_token}` } });
    if (resp.ok) {
      const users: { email: string; is_admin: boolean }[] = await resp.json();
      const adminUsers = users.filter((u) => u.is_admin || u.email === DEFAULT_ADMIN);
      setAdmins(adminUsers.map((u) => ({ email: u.email, isDefault: u.email === DEFAULT_ADMIN })));
    }
  }

  useEffect(() => { load(); }, []);

  async function grantAdmin() {
    if (!grantEmail) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // We mark user as admin via Supabase Admin API through existing admin endpoint
      const resp = await fetch(`/api/admin/grant-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: grantEmail }),
      });
      if (resp.ok) {
        setMsg({ type: "ok", text: `Admin granted to ${grantEmail}` });
        setGrantEmail("");
        load();
      } else {
        const e = await resp.json().catch(() => ({ detail: "Error" }));
        setMsg({ type: "err", text: e.detail ?? "Failed" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeAdmin(email: string) {
    if (email === DEFAULT_ADMIN) return;
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`/api/admin/revoke-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email }),
    });
    if (resp.ok) { setMsg({ type: "ok", text: `Revoked admin for ${email}` }); load(); }
    else setMsg({ type: "err", text: "Failed to revoke." });
  }

  const inputStyle: React.CSSProperties = { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "0.65rem 0.9rem", fontSize: 13, color: "#ebebeb", fontFamily: "'Space Grotesk', sans-serif", outline: "none" };

  return (
    <div>
      {msg && (
        <div style={{ background: msg.type === "ok" ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.1)", border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(248,113,113,0.3)"}`, borderRadius: "0.75rem", padding: "0.65rem 0.9rem", marginBottom: "1rem", fontSize: 13, color: msg.type === "ok" ? "#10b981" : "#f87171" }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1.25rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-secondary)", marginBottom: "0.85rem" }}>Grant Admin Access</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" style={inputStyle} />
          <button onClick={grantAdmin} disabled={loading || !grantEmail} style={{ background: "#ccff00", color: "#000", border: "none", borderRadius: "0.75rem", padding: "0.65rem 1.25rem", fontWeight: 700, cursor: loading || !grantEmail ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", opacity: loading || !grantEmail ? 0.6 : 1 }}>
            Grant
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {admins.length === 0 && <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>No admins found.</p>}
        {admins.map((a) => (
          <div key={a.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", padding: "0.75rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: 13, color: "#ebebeb" }}>{a.email}</span>
              {a.isDefault && <span style={{ background: "rgba(204,255,0,0.12)", color: "#ccff00", border: "1px solid rgba(204,255,0,0.3)", borderRadius: 9999, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>Default</span>}
            </div>
            {!a.isDefault && (
              <button onClick={() => revokeAdmin(a.email)} style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "0.5rem", padding: "0.35rem 0.75rem", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export function AdminFeedbackPage({ onBack }: Props) {
  const [tab, setTab] = useState<"inbox" | "admins">("inbox");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Feedback | null>(null);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const resp = await fetch(`/api/feedback?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setFeedbacks(data.feedbacks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { if (tab === "inbox") loadFeedback(); }, [tab, loadFeedback]);

  function onStatusChange(id: string, status: string) {
    setFeedbacks((prev) => prev.map((f) => f.id === id ? { ...f, status: status as any } : f));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status: status as any } : null);
  }

  const selectStyle: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.6rem", padding: "0.4rem 0.75rem", fontSize: 12, color: "#ebebeb", fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#000", fontFamily: "'Space Grotesk', sans-serif", padding: "2rem 1.5rem" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: 0, fontFamily: "inherit" }}>
          ← Back
        </button>

        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ebebeb", letterSpacing: "-0.02em" }}>Feedback <span style={{ color: "#ccff00" }}>Inbox</span></h1>
          <span style={{ background: "rgba(204,255,0,0.1)", color: "#ccff00", border: "1px solid rgba(204,255,0,0.3)", borderRadius: 9999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{feedbacks.length}</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: "2rem" }}>Manage user-submitted bug reports, feature requests, and feedback.</p>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }}>
          {(["inbox", "admins"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "0.6rem 1.25rem", background: "transparent", border: "none", borderBottom: tab === t ? "2px solid #ccff00" : "2px solid transparent", color: tab === t ? "#ccff00" : "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400, fontFamily: "inherit", textTransform: "capitalize", marginBottom: "-1px" }}>
              {t === "inbox" ? "📬 Inbox" : "👤 Admins"}
            </button>
          ))}
        </div>

        {/* Inbox Tab */}
        {tab === "inbox" && (
          <>
            {/* Filters */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" as any, alignItems: "center" }}>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Types</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="general">General</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={loadFeedback} disabled={loading} style={{ background: "rgba(204,255,0,0.1)", color: "#ccff00", border: "1px solid rgba(204,255,0,0.3)", borderRadius: "0.6rem", padding: "0.4rem 0.9rem", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>
                {loading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {/* Table */}
            {loading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading feedback…</p>}
            {!loading && feedbacks.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-tertiary)", fontSize: 14 }}>
                No feedback found for the current filters.
              </div>
            )}

            {!loading && feedbacks.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Type", "From", "Summary", "Priority", "Status", "Date", ""].map((h) => (
                        <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left" as any, color: "var(--text-secondary)", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 400, whiteSpace: "nowrap" as any }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.map((fb) => (
                      <tr key={fb.id}
                        onClick={() => setSelected(fb)}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={{ padding: "0.75rem" }}><Badge value={fb.type} map={TYPE_COLORS} /></td>
                        <td style={{ padding: "0.75rem", color: "var(--text-primary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as any }}>{fb.email || fb.user_id?.substring(0, 8) || "—"}</td>
                        <td style={{ padding: "0.75rem", color: "#ebebeb", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as any }}>{fb.name || fb.message.substring(0, 60)}</td>
                        <td style={{ padding: "0.75rem" }}>{fb.priority ? <Badge value={fb.priority} map={{ low: "#10b981", medium: "#f59e0b", high: "#ef4444" }} /> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td style={{ padding: "0.75rem" }}><Badge value={fb.status} map={STATUS_COLORS} /></td>
                        <td style={{ padding: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" as any }}>{fmt(fb.created_at)}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <button style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", padding: "0.25rem 0.6rem", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Admins Tab */}
        {tab === "admins" && <AdminsTab />}
      </div>

      {selected && <DetailModal feedback={selected} onClose={() => setSelected(null)} onStatusChange={onStatusChange} />}
    </div>
  );
}
