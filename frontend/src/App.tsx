import { Component, useEffect, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { startTailor, getUserSubscription, cancelRazorpaySubscription, getBaseResume, ApiError } from "./api/client";
import type { BaseResumeInfo } from "./api/client";
import { AppShell } from "./components/AppShell";
import { AuthModal } from "./components/AuthModal";
import { FeedbackFAB } from "./components/FeedbackFAB";
import { UpgradeModal } from "./components/UpgradeModal";
import { incrementAnonCount, anonLimitReached } from "./lib/subscription";
import { saveToHistory } from "./lib/history";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { AdminFeedbackPage } from "./pages/AdminFeedbackPage";
import { AdminPage } from "./pages/AdminPage";
import { AiReviewPage } from "./pages/AiReviewPage";
import { CoverLetterPage } from "./pages/CoverLetterPage";
import { CoverLettersPage } from "./pages/CoverLettersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DonePage } from "./pages/DonePage";
import { LandingPage } from "./pages/LandingPage";
import { ProcessingPage } from "./pages/ProcessingPage";
import { ResumesPage } from "./pages/ResumesPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TailorSetupPage } from "./pages/TailorSetupPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { UploadPage } from "./pages/UploadPage";
import type { AppStep, TailorResponse, TemplateId, Tier, UpgradeReason } from "./types";

class ReviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ReviewPage crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "var(--bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter', sans-serif",
            padding: "1.5rem",
          }}
        >
          <div className="bento-card" style={{ maxWidth: 440, width: "100%", padding: "2rem", textAlign: "center" }}>
            <p style={{ color: "var(--accent)", fontWeight: 700, marginBottom: "0.45rem" }}>Something went wrong</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: "1.2rem" }}>{this.state.message}</p>
            <button type="button" className="accent-btn" onClick={() => this.setState({ hasError: false, message: "" })}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function isAdminUser(user: User | null) {
  return Boolean(user?.user_metadata?.is_admin);
}

type WorkspaceNavId = "dashboard" | "resumes" | "templates" | "cover" | "review" | "settings" | "upgrade" | "admin";
type TailorOnboardingStage = "resume" | "template" | null;

export default function App() {
  const [step, setStep] = useState<AppStep>("landing");
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<Tier>("free");
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentJd, setCurrentJd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState(false);
  const [baseResume, setBaseResume] = useState<BaseResumeInfo | null>(null);
  const [baseResumeLoading, setBaseResumeLoading] = useState(false);
  const [tailorOnboardingStage, setTailorOnboardingStage] = useState<TailorOnboardingStage>(null);
  const [tailorTemplateConfirmed, setTailorTemplateConfirmed] = useState(false);
  const [tailorOnboardingActive, setTailorOnboardingActive] = useState(false);
  const [templateId, setTemplateId] = useState<TemplateId>(() => {
    return (localStorage.getItem("resumeai_template") as TemplateId) || "jake";
  });

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    localStorage.setItem("resumeai_template", templateId);
  }, [templateId]);

  // Handle admin pages: show auth if not logged in, redirect if not admin
  useEffect(() => {
    if (!sessionReady) return;
    if (step !== "admin" && step !== "admin-feedback") return;
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!isAdmin) {
      setStep("dashboard");
    }
  }, [step, sessionReady, user, isAdmin]);

  useEffect(() => {
    if (window.location.pathname === "/admin") {
      setStep("admin");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void fetchTier(currentUser.id);
        void refreshBaseResume(currentUser);
        setStep((prev) => (prev === "admin" ? "admin" : "dashboard"));
      }
      setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        void fetchTier(currentUser.id);
        void refreshBaseResume(currentUser);
      } else {
        setTier("free");
        setBaseResume(null);
        setTailorOnboardingActive(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchTier(userId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const info = await getUserSubscription(userId, session?.access_token);
      setTier(info.tier);
    } catch {
      setTier("free");
    }
  }

  async function refreshBaseResume(targetUser: User | null = user): Promise<BaseResumeInfo | null> {
    if (!targetUser) {
      setBaseResume(null);
      return null;
    }

    setBaseResumeLoading(true);
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
      setBaseResumeLoading(false);
    }
  }

  function showUpgrade(reason: UpgradeReason) {
    setUpgradeReason(reason);
  }

  async function handleCancelSubscription() {
    if (!window.confirm("Cancel your Pro subscription? You'll keep access until the current billing period ends.")) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await cancelRazorpaySubscription(session?.access_token ?? "");
      setTier("free");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancellation failed. Please try again.");
    }
  }

  function handleGetStarted() {
    if (!isSupabaseConfigured || user) {
      setStep(user ? "dashboard" : "upload");
      return;
    }
    setShowAuth(true);
  }

  function handleStartPro() {
    if (user) {
      showUpgrade("tailor_limit");
      return;
    }
    setPendingUpgrade(true);
    setShowAuth(true);
  }

  function handleAuthSuccess() {
    setShowAuth(false);
    if (pendingUpgrade) {
      setPendingUpgrade(false);
      showUpgrade("tailor_limit");
      return;
    }
    setStep((prev) => (prev === "admin" ? "admin" : "dashboard"));
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort sign-out
    }
    setUser(null);
    setTier("free");
    setBaseResume(null);
    setTailorOnboardingStage(null);
    setTailorTemplateConfirmed(false);
    setTailorOnboardingActive(false);
    setResult(null);
    setStep("landing");
  }

  async function handleSubmit(file: File, jd: string) {
    if (!user) {
      if (anonLimitReached()) {
        setShowAuth(true);
        return;
      }
      incrementAnonCount();
    }

    setLoading(true);
    setError(null);
    setCurrentFile(file);
    setCurrentJd(jd);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const nextRequestId = await startTailor(file, jd, user?.id ?? undefined, session?.access_token ?? undefined);
      setRequestId(nextRequestId);
      setStep("processing");
    } catch (err) {
      if (err instanceof ApiError && err.code === "limit_reached") {
        showUpgrade("tailor_limit");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handlePipelineDone(response: TailorResponse) {
    setResult(response);
    setTailorOnboardingActive(false);
    if (user) {
      void saveToHistory(response, currentFile?.name ?? "", currentJd).catch(console.error);
    }
    setStep("review");
  }

  function handlePipelineError(message: string) {
    setError(message);
    setStep(user ? "tailor-setup" : "upload");
  }

  function handleReopen(response: TailorResponse) {
    setResult(response);
    setStep("review");
  }

  function handleOpenCoverLetterGenerator(response: TailorResponse) {
    setResult(response);
    setStep("cover-letter");
  }

  function handleStartOver() {
    setResult(null);
    setError(null);
    setCurrentFile(null);
    setCurrentJd("");
    setRequestId(null);
    setTailorOnboardingStage(null);
    setTailorTemplateConfirmed(false);
    setTailorOnboardingActive(false);
    setStep(user ? "dashboard" : "upload");
  }

  function handleLogoClick() {
    setStep(user ? "dashboard" : "landing");
  }

  function handleTemplateChange(nextTemplate: TemplateId) {
    setTemplateId(nextTemplate);
    if (tailorOnboardingStage === "template") {
      setTailorTemplateConfirmed(true);
    }
  }

  async function handleStartTailoringFlow() {
    if (!user) {
      setStep("upload");
      return;
    }

    setError(null);
    const info = await refreshBaseResume(user);
    if (info?.found) {
      setTailorOnboardingActive(false);
      setTailorOnboardingStage(null);
      setTailorTemplateConfirmed(false);
      setStep("tailor-setup");
      return;
    }

    setTailorOnboardingActive(true);
    setTailorOnboardingStage("resume");
    setTailorTemplateConfirmed(false);
    setStep("resumes");
  }

  function handleBaseResumeReady(info: BaseResumeInfo) {
    setBaseResume(info);
    setError(null);
    setTailorOnboardingActive(true);
    setTailorOnboardingStage("template");
    setTailorTemplateConfirmed(false);
    setStep("templates");
  }

  function handleProceedToTailorSetup() {
    setError(null);
    setTailorOnboardingStage(null);
    setTailorTemplateConfirmed(false);
    setStep("tailor-setup");
  }

  async function handleTailorSetupSubmit(jobInput: string) {
    if (!user || !baseResume?.found || !baseResume.storage_path) {
      setTailorOnboardingActive(true);
      setTailorOnboardingStage("resume");
      setStep("resumes");
      return;
    }

    try {
      const { data, error: downloadError } = await supabase.storage.from("resumes").download(baseResume.storage_path);
      if (downloadError || !data) {
        throw new Error("Failed to load your default resume. Please reselect it.");
      }

      const file = new File([data], baseResume.filename || "resume.pdf", {
        type: data.type || "application/pdf",
      });

      await handleSubmit(file, jobInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start tailoring with your default resume.");
      setStep("tailor-setup");
    }
  }

  function handleWorkspaceNav(id: WorkspaceNavId) {
    switch (id) {
      case "dashboard":
        setStep("dashboard");
        break;
      case "resumes":
        setStep("resumes");
        break;
      case "templates":
        setStep("templates");
        break;
      case "cover":
        setStep("cover-letters");
        break;
      case "review":
        setStep(result ? "review" : "ai-review");
        break;
      case "settings":
        setStep("settings");
        break;
      case "upgrade":
        showUpgrade("tailor_limit");
        break;
      case "admin":
        if (isAdmin) setStep("admin");
        break;
    }
  }

  function renderWorkspacePage(
    activeNav: WorkspaceNavId | undefined,
    title: string,
    content: ReactNode,
    topbarRight?: ReactNode,
  ) {
    if (!user) return null;

    return (
      <AppShell
        user={user}
        tier={tier}
        activeNav={activeNav}
        topbarTitle={title}
        topbarRight={topbarRight}
        onNav={(id) => handleWorkspaceNav(id as WorkspaceNavId)}
        onSignOut={() => {
          void handleSignOut();
        }}
        onDashboard={() => setStep("dashboard")}
        isAdmin={isAdmin}
      >
        {content}
      </AppShell>
    );
  }

  const newResumeButton = (
    <button
      type="button"
      className="accent-btn"
      style={{ fontSize: 13, padding: "0.45rem 1rem" }}
      onClick={() => { void handleStartTailoringFlow(); }}
      disabled={baseResumeLoading}
    >
      {baseResumeLoading ? "Loading..." : "+ New Resume"}
    </button>
  );

  function renderPage() {
    switch (step) {
      case "landing":
        return <LandingPage onGetStarted={handleGetStarted} onStartPro={handleStartPro} onLogoClick={handleLogoClick} />;

      case "dashboard":
        return renderWorkspacePage(
          "dashboard",
          "Dashboard",
          <DashboardPage
            user={user!}
            tier={tier}
            onNewResume={() => { void handleStartTailoringFlow(); }}
            onOpenSection={(nextStep) => setStep(nextStep)}
            onReopen={handleReopen}
            onUpgrade={showUpgrade}
          />,
          newResumeButton,
        );

      case "upload":
        return (
          <UploadPage
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            onClearError={() => setError(null)}
            user={user}
            tier={tier}
            templateId={templateId}
            onTemplateChange={handleTemplateChange}
            onDashboard={() => setStep("dashboard")}
            onSignOut={() => {
              void handleSignOut();
            }}
            onNewResume={() => { void handleStartTailoringFlow(); }}
            onLogoClick={handleLogoClick}
            onUpgrade={() => showUpgrade("tailor_limit")}
          />
        );

      case "tailor-setup":
        return renderWorkspacePage(
          undefined,
          "Tailor Resume",
          <TailorSetupPage
            baseResume={baseResume}
            templateId={templateId}
            loading={loading}
            error={error}
            onboarding={tailorOnboardingActive}
            onClearError={() => setError(null)}
            onChangeResume={() => {
              setTailorOnboardingActive(tailorOnboardingActive || !baseResume?.found);
              setTailorOnboardingStage(tailorOnboardingActive || !baseResume?.found ? "resume" : null);
              setStep("resumes");
            }}
            onChangeTemplate={() => {
              setTailorOnboardingStage(tailorOnboardingActive ? "template" : null);
              setStep("templates");
            }}
            onSubmit={(jobInput) => {
              void handleTailorSetupSubmit(jobInput);
            }}
          />,
        );

      case "processing":
        return requestId ? <ProcessingPage requestId={requestId} onComplete={handlePipelineDone} onError={handlePipelineError} onCancel={handleStartOver} /> : null;

      case "review":
        return result
          ? user
            ? renderWorkspacePage(
                "review",
                "Resume Review",
                <ReviewErrorBoundary>
                  <ReviewPage
                    result={result}
                    onDone={() => setStep("done")}
                    onCoverLetter={() => {
                      if (tier !== "pro") {
                        showUpgrade("cover_letter");
                        return;
                      }
                      setStep("cover-letter");
                    }}
                    user={user}
                    tier={tier}
                    templateId={templateId}
                    onDashboard={() => setStep("dashboard")}
                    onSignOut={() => {
                      void handleSignOut();
                    }}
                    onLogoClick={handleLogoClick}
                    onUpgrade={showUpgrade}
                    onCancelSubscription={handleCancelSubscription}
                  />
                </ReviewErrorBoundary>,
              )
            : (
              <ReviewErrorBoundary>
                <ReviewPage
                  result={result}
                  onDone={() => setStep("done")}
                  onCoverLetter={() => {
                    if (tier !== "pro") {
                      showUpgrade("cover_letter");
                      return;
                    }
                    setStep("cover-letter");
                  }}
                  user={null}
                  tier={tier}
                  templateId={templateId}
                  onDashboard={() => setStep("dashboard")}
                  onSignOut={() => {
                    void handleSignOut();
                  }}
                  onLogoClick={handleLogoClick}
                  onUpgrade={showUpgrade}
                  onCancelSubscription={handleCancelSubscription}
                />
              </ReviewErrorBoundary>
            )
          : null;

      case "cover-letter":
        return result ? (
          <CoverLetterPage
            resumeSummary={result.resume_summary}
            jdAnalysis={result.jd_analysis}
            onDone={() => setStep(user ? "dashboard" : "review")}
            user={user}
            onDashboard={() => setStep("dashboard")}
            onSignOut={() => {
              void handleSignOut();
            }}
            onNewResume={() => { void handleStartTailoringFlow(); }}
            onLogoClick={handleLogoClick}
          />
        ) : null;

      case "resumes":
        return renderWorkspacePage(
          "resumes",
          "Resume Library",
          <ResumesPage
            user={user!}
            tier={tier}
            onNewResume={() => { void handleStartTailoringFlow(); }}
            onReopen={handleReopen}
            onUpgrade={showUpgrade}
            onboardingGuide={tailorOnboardingStage === "resume"}
            onBaseResumeReady={handleBaseResumeReady}
            onContinueSetup={() => {
              setTailorOnboardingStage("template");
              setStep("templates");
            }}
          />,
          newResumeButton,
        );

      case "templates":
        return renderWorkspacePage(
          "templates",
          "Templates",
          <TemplatesPage
            templateId={templateId}
            tier={tier}
            onTemplateChange={handleTemplateChange}
            onUpgrade={showUpgrade}
            onboardingGuide={tailorOnboardingStage === "template"}
            templateConfirmed={tailorTemplateConfirmed}
            onTemplateConfirmed={() => setTailorTemplateConfirmed(true)}
            onProceed={handleProceedToTailorSetup}
          />,
        );

      case "cover-letters":
        return renderWorkspacePage(
          "cover",
          "Cover Letters",
          <CoverLettersPage
            tier={tier}
            activeResult={result}
            onNewResume={() => { void handleStartTailoringFlow(); }}
            onOpenGenerator={handleOpenCoverLetterGenerator}
            onUpgrade={showUpgrade}
          />,
        );

      case "ai-review":
        return renderWorkspacePage(
          "review",
          "AI Review",
          <AiReviewPage activeResult={result} onNewResume={() => { void handleStartTailoringFlow(); }} onReopen={handleReopen} />,
          result ? (
            <button type="button" className="ghost-btn" onClick={() => setStep("review")}>
              Resume Review
            </button>
          ) : newResumeButton,
        );

      case "settings":
        return renderWorkspacePage(
          "settings",
          "Settings",
          <SettingsPage
            user={user!}
            tier={tier}
            onCancelSubscription={handleCancelSubscription}
            onUpgrade={() => showUpgrade("tailor_limit")}
          />,
        );

      case "done":
        return (
          <DonePage
            onStartOver={handleStartOver}
            user={user}
            onDashboard={() => setStep("dashboard")}
            onSignOut={() => {
              void handleSignOut();
            }}
            onLogoClick={handleLogoClick}
          />
        );

      case "admin":
        if (!sessionReady) return null;
        if (!user) return null; // useEffect below handles showing auth
        if (!isAdmin) return null; // useEffect below redirects
        return <AdminPage user={user} onLogoClick={handleLogoClick} onBack={() => setStep("dashboard")} />;

      case "admin-feedback":
        if (!sessionReady) return null;
        if (!user) return null;
        if (!isAdmin) return null;
        return <AdminFeedbackPage onBack={() => setStep("dashboard")} />;

      default:
        return <LandingPage onGetStarted={handleGetStarted} onStartPro={handleStartPro} onLogoClick={handleLogoClick} />;
    }
  }

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={handleAuthSuccess} />}
      {upgradeReason && (
        <UpgradeModal
          reason={upgradeReason}
          user={user}
          onClose={() => setUpgradeReason(null)}
          onSignIn={() => {
            setUpgradeReason(null);
            setShowAuth(true);
          }}
          onUpgradeSuccess={() => {
            if (user) void fetchTier(user.id);
            setUpgradeReason(null);
          }}
        />
      )}
      {renderPage()}
      {user && step !== "landing" && step !== "admin-feedback" && <FeedbackFAB />}
    </>
  );
}
