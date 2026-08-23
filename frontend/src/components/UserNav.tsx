import { useState, useRef, useEffect } from "react";
import { LogOut, LayoutDashboard, ChevronDown, FileText, Shield, MessageSquare } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User;
  onDashboard: () => void;
  onSignOut: () => void;
  onNewResume: () => void;
  onFeedbackInbox?: () => void;
  onAdminPanel?: () => void;
  isAdmin?: boolean;
}

export function UserNav({ user, onDashboard, onSignOut, onNewResume, onFeedbackInbox, onAdminPanel, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const name: string = (user.user_metadata?.full_name as string | undefined) || user.email || "User";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    onSignOut();
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 9999,
          padding: "0.35rem 0.75rem 0.35rem 0.35rem",
          cursor: "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(204,255,0,0.4)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
      >
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--lime)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: "#000",
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--white-primary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name.split(" ")[0]}
        </span>
        <ChevronDown size={13} color="var(--text-secondary)" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 0.5rem)",
          right: 0,
          minWidth: 220,
          background: "rgba(12,12,12,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "1.25rem",
          overflow: "hidden",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          zIndex: 100,
        }}>
          {/* User info header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--white-primary)", marginBottom: "0.2rem" }}>{name}</p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
          </div>

          {/* Actions */}
          <div style={{ padding: "0.5rem" }}>
            {[
              { icon: <LayoutDashboard size={14} />, label: "My Dashboard", action: () => { setOpen(false); onDashboard(); } },
              { icon: <FileText size={14} />, label: "Tailor New Resume", action: () => { setOpen(false); onNewResume(); } },
              ...(isAdmin ? [
                { icon: <Shield size={14} />, label: "Admin Panel", action: () => { setOpen(false); onAdminPanel ? onAdminPanel() : (window.location.href = "/admin"); } },
                { icon: <MessageSquare size={14} />, label: "Feedback Inbox", action: () => { setOpen(false); onFeedbackInbox?.(); } },
              ] : []),
            ].map(({ icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.75rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'Space Grotesk', sans-serif",
                  textAlign: "left",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(204,255,0,0.08)"; e.currentTarget.style.color = "var(--lime)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-primary)"; }}
              >
                {icon}
                {label}
              </button>
            ))}

            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0.375rem 0" }} />

            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 0.875rem",
                borderRadius: "0.75rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(248,113,113,0.7)",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'Space Grotesk', sans-serif",
                textAlign: "left",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(248,113,113,0.7)"; }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
