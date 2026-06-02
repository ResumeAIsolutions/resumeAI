import { useEffect, useState, useRef } from "react";
import { ProcessingStatus } from "../components/ProcessingStatus";
import type { TailorResponse } from "../types";

interface Props {
  requestId: string;
  onComplete: (result: TailorResponse) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}

const STAGE_ESTIMATES: Record<number, string> = {
  1: "~5s",
  2: "~5s",
  3: "~20s",
  4: "~10s",
};

export function ProcessingPage({ requestId, onComplete, onError, onCancel }: Props) {
  const [stage, setStage] = useState(1);
  const [stageMessage, setStageMessage] = useState("Starting up...");
  const [elapsed, setElapsed] = useState(0);
  const stageStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => { onErrorRef.current = onError; });

  useEffect(() => {
    stageStartRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  useEffect(() => {
    const es = new EventSource(`/api/tailor/stream/${requestId}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "stage") {
          setStage(data.stage);
          if (data.message) setStageMessage(data.message);
        } else if (data.type === "done") {
          es.close();
          const r = data.result;
          if (!r || !r.diff || !r.scores) {
            onErrorRef.current("Unexpected response from server. Please try again.");
            return;
          }
          onCompleteRef.current(r as TailorResponse);
        } else if (data.type === "error") {
          es.close();
          onErrorRef.current(data.message || "Pipeline failed. Please try again.");
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      es.close();
      onErrorRef.current("Lost connection to server. Please re-submit your resume.");
    };
    return () => es.close();
  }, [requestId]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: "3rem", textAlign: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          Resume<span style={{ color: "var(--accent)" }}>AI</span>
        </span>
      </div>

      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Indigo arc progress */}
        <div style={{
          position: "relative",
          width: 80, height: 80,
          margin: "0 auto 2rem",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="80" height="80" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="5" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke="var(--accent)" strokeWidth="5"
              strokeDasharray="213.6"
              strokeDashoffset={213.6 - (stage / 4) * 213.6}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
            animation: "spin 1s linear infinite",
          }} />
        </div>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{
            fontSize: "1.5rem", fontWeight: 700,
            color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "0.5rem",
          }}>
            Tailoring your resume…
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "0.375rem" }}>
            {stageMessage}
          </p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
            stage {stage}/4 · {elapsed}s elapsed · est. {STAGE_ESTIMATES[stage] ?? "…"} total
          </p>
        </div>

        <ProcessingStatus currentStage={stage} />

        {onCancel && (
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
