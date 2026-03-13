import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import nccLogo from "../assets/ncc-logo.png";
import SeniorAttendance from "../pages/SeniorAttendance";
import SeniorReport from "../pages/SeniorReport";
import SeniorFeedback from "../pages/SeniorFeedback";
import CadetDashboard from "../pages/CadetDashboard";
import SettingsPanel from "../components/SettingsPanel";

/* ─── nav: 3 pages now, My Record added ─── */
const NAV = [
  { id: "attendance", label: "Attendance",    short: "Attend",    icon: "✅" },
  { id: "report",     label: "Parade Report", short: "Report",    icon: "📝" },
  { id: "myrecord",   label: "My Record",     short: "My Record", icon: "🪖" },
];

const BREAKPOINT = 768;

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }

  .sl-shell {
    display: flex; width: 100vw; height: 100vh; max-width: 100vw;
    overflow: hidden; background: var(--csi-bg-page);
    font-family: var(--csi-font-body, 'Inter', sans-serif);
    position: relative; margin: 0; padding: 0;
  }

  .sl-sidebar {
    width: 230px; min-width: 230px; max-width: 230px; flex-shrink: 0;
    background: var(--csi-bg-card); border-right: 1px solid var(--csi-border);
    display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; z-index: 100;
  }
  @media (max-width: 768px) {
    .sl-sidebar {
      position: fixed; top: 0; left: 0; height: 100%;
      width: 240px; min-width: 240px; max-width: 240px;
      transform: translateX(-100%); transition: transform 0.25s ease;
      box-shadow: 4px 0 24px rgba(0,0,0,0.4);
    }
    .sl-sidebar--open { transform: translateX(0); }
  }

  .sl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 99; backdrop-filter: blur(2px); }

  .sl-brand { padding: 20px 18px 14px; border-bottom: 1px solid var(--csi-border); flex-shrink: 0; }
  .sl-brand-unit { font-family: var(--csi-font-display,'Syne',sans-serif); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--csi-text-muted); margin: 0 0 4px; }
  .sl-brand-title { font-family: var(--csi-font-display,'Syne',sans-serif); font-size: 1rem; font-weight: 800; color: var(--csi-text-primary); margin: 0; }

  .sl-div-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 6px; font-family: var(--csi-font-mono,'JetBrains Mono',monospace); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; background: var(--csi-indigo); color: #fff; }

  .sl-chip { padding: 6px 10px; border-radius: 6px; font-size: 0.7rem; font-family: var(--csi-font-mono,'JetBrains Mono',monospace); font-weight: 600; letter-spacing: 0.02em; border: 1px solid; flex-shrink: 0; }
  .sl-chip--none   { background: var(--csi-bg-input); color: var(--csi-text-muted); border-color: var(--csi-border); }
  .sl-chip--active { background: var(--csi-green-bg,rgba(52,211,153,.12)); color: var(--csi-green); border-color: var(--csi-green-border,rgba(52,211,153,.3)); }
  .sl-chip--review { background: var(--csi-amber-bg,rgba(251,191,36,.12)); color: var(--csi-amber); border-color: var(--csi-amber-border,rgba(251,191,36,.3)); }
  .sl-chip--done   { background: var(--csi-bg-input); color: var(--csi-text-sub); border-color: var(--csi-border); }

  .sl-nav { padding: 8px 10px; flex: 1; }
  .sl-nav-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: none; border-radius: 7px; background: transparent; color: var(--csi-text-sub); font-size: 0.82rem; font-family: var(--csi-font-body,'Inter',sans-serif); cursor: pointer; text-align: left; margin-bottom: 2px; transition: background 0.15s, color 0.15s; }
  .sl-nav-btn:hover { background: var(--csi-bg-input); color: var(--csi-text-primary); }
  .sl-nav-btn--active { background: rgba(79,70,229,0.15); color: var(--csi-indigo-light,#818cf8); font-weight: 600; }
  .sl-nav-icon { font-size: 1rem; width: 20px; text-align: center; flex-shrink: 0; }
  .sl-nav-badge { margin-left: auto; background: var(--csi-red,#f87171); color: #fff; font-size: 0.62rem; font-weight: 700; font-family: var(--csi-font-mono,monospace); padding: 1px 5px; border-radius: 10px; min-width: 16px; text-align: center; }

  .sl-sidebar-footer { padding: 10px; border-top: 1px solid var(--csi-border); flex-shrink: 0; }
  .sl-settings-btn { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 7px; background: transparent; color: var(--csi-text-muted); font-size: 0.8rem; font-family: var(--csi-font-body,'Inter',sans-serif); cursor: pointer; transition: all 0.15s; text-align: left; }
  .sl-settings-btn:hover { background: var(--csi-bg-input); color: var(--csi-text-sub); }
  .sl-settings-btn--active { background: rgba(79,70,229,0.12); color: var(--csi-indigo-light,#818cf8); }

  .sl-main { flex: 1; min-width: 0; max-width: 100%; display: flex; flex-direction: column; overflow: hidden; height: 100vh; position: relative; }

  .sl-topbar { height: 52px; min-height: 52px; max-height: 52px; background: var(--csi-bg-card); border-bottom: 1px solid var(--csi-border); display: flex; align-items: center; padding: 0 16px; gap: 12px; flex-shrink: 0; z-index: 50; width: 100%; box-sizing: border-box; }
  .sl-hamburger { display: none; background: none; border: none; color: var(--csi-text-primary); font-size: 1.2rem; cursor: pointer; padding: 4px 8px; border-radius: 5px; line-height: 1; flex-shrink: 0; }
  .sl-hamburger:hover { background: var(--csi-bg-input); }
  @media (max-width: 768px) { .sl-hamburger { display: flex; align-items: center; } }
  .sl-topbar-logo { height: 30px; cursor: pointer; border-radius: 3px; flex-shrink: 0; transition: opacity 0.15s; }
  .sl-topbar-logo:hover { opacity: 0.82; }
  .sl-topbar-title { font-family: var(--csi-font-display,'Syne',sans-serif); font-size: 0.88rem; font-weight: 700; color: var(--csi-text-primary); letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-topbar-page { margin-left: auto; font-size: 0.72rem; color: var(--csi-text-muted); font-family: var(--csi-font-mono,monospace); white-space: nowrap; flex-shrink: 0; }
  @media (min-width: 769px) { .sl-topbar-page { display: none; } }

  .sl-content { flex: 1; min-height: 0; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: var(--csi-border) transparent; width: 100%; box-sizing: border-box; }
  .sl-content::-webkit-scrollbar { width: 4px; }
  .sl-content::-webkit-scrollbar-track { background: transparent; }
  .sl-content::-webkit-scrollbar-thumb { background: var(--csi-border); border-radius: 2px; }
  @media (max-width: 768px) { .sl-content { padding-bottom: 64px; } }

  .sl-bottom-nav { display: none; }
  @media (max-width: 768px) {
    .sl-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; height: 56px; background: var(--csi-bg-card); border-top: 1px solid var(--csi-border); z-index: 300; padding-bottom: env(safe-area-inset-bottom,0px); }
  }
  .sl-bottom-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; cursor: pointer; padding: 4px 0; color: var(--csi-text-muted); font-size: 0.6rem; font-family: var(--csi-font-body,'Inter',sans-serif); transition: color 0.15s; position: relative; }
  .sl-bottom-btn--active { color: var(--csi-indigo-light,#818cf8); }
  .sl-bottom-btn .sl-nav-icon { font-size: 1.15rem; width: auto; }
  .sl-bottom-dot { position: absolute; top: 5px; right: calc(50% - 14px); width: 7px; height: 7px; background: var(--csi-red,#f87171); border-radius: 50%; border: 1.5px solid var(--csi-bg-card); }

  .sl-skel { background: var(--csi-bg-input); border-radius: 6px; animation: sl-pulse 1.4s ease-in-out infinite; }
  @keyframes sl-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* ── No-record placeholder ── */
  .sl-no-record {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 60vh; gap: 0.75rem; padding: 2rem; text-align: center;
  }
`;

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════════════ */
export default function SeniorLayout() {
  const [currentPage,  setCurrentPage]  = useState(() => localStorage.getItem("senior_page") || "attendance");
  const [sidebarOpen,  setSidebarOpen]  = useState(window.innerWidth > BREAKPOINT);
  const [isMobile,     setIsMobile]     = useState(window.innerWidth <= BREAKPOINT);
  const [userProfile,  setUserProfile]  = useState(null);
  const [parade,       setParade]       = useState(null);
  const [notifCount,   setNotifCount]   = useState(0);
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasCadetLink, setHasCadetLink] = useState(null); // null=loading, true/false

  /* ── fetch profile + active parade + notif count ── */
  const fetchInitial = useCallback(async () => {
    setLoadingInit(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingInit(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("assigned_division, assigned_category, cadet_id")
      .eq("id", user.id)
      .single();

    setUserProfile(profile);
    setHasCadetLink(!!profile?.cadet_id);

    const { data: paradeData } = await supabase
      .from("parades")
      .select("id, parade_date, session, status, categories, parade_type_map, parade_instructions, ano_remarks")
      .in("status", ["active", "attendance_submitted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setParade(paradeData);

    if (paradeData && user) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("target_role", "senior")
        .eq("parade_id", paradeData.id)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      setNotifCount(count || 0);
    }

    setLoadingInit(false);
  }, []);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= BREAKPOINT;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function handleLogout() {
    localStorage.removeItem("senior_page");
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function chipData() {
    if (!parade) return { text: "No active parade", cls: "sl-chip--none" };
    if (parade.status === "active")               return { text: `Active · ${parade.parade_date}`, cls: "sl-chip--active" };
    if (parade.status === "attendance_submitted") return { text: `Review · ${parade.parade_date}`, cls: "sl-chip--review" };
    return { text: `Done · ${parade.parade_date}`, cls: "sl-chip--done" };
  }

  function goTo(page) {
    localStorage.setItem("senior_page", page);
    setCurrentPage(page);
    if (isMobile) setSidebarOpen(false);
  }

  function renderPage() {
    if (currentPage === "attendance") return <SeniorAttendance userProfile={userProfile} parade={parade} />;
    if (currentPage === "report")     return <SeniorReport     userProfile={userProfile} parade={parade} />;
    if (currentPage === "myrecord")   return <MyRecordPage hasCadetLink={hasCadetLink} />;
    if (currentPage === "feedback")   return <SeniorFeedback />;
    return null;
  }

  if (loadingInit) return (
    <>
      <style>{STYLES}</style>
      <div className="sl-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: 240 }}>
          {[44, 24, 24, 24, 24].map((h, i) => (
            <div key={i} className="sl-skel" style={{ height: h, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </>
  );

  const chip    = chipData();
  const curNav  = NAV.find(n => n.id === currentPage);
  const curShort = curNav?.short || "";

  function SidebarInner() {
    return (
      <>
        <div className="sl-brand">
          <p className="sl-brand-unit">2(A) EME Unit NCC</p>
          <p className="sl-brand-title">Senior Dashboard</p>
        </div>

        {userProfile?.assigned_division && (
          <div style={{ padding: "14px 18px 0" }}>
            <span className="sl-div-badge">🪖 {userProfile.assigned_division} Division</span>
          </div>
        )}

        <div style={{ padding: "10px 18px 12px" }}>
          <div className={`sl-chip ${chip.cls}`}>{chip.text}</div>
        </div>

        <nav className="sl-nav">
          {NAV.map(({ id, label, icon }) => (
            <button key={id}
              className={`sl-nav-btn${currentPage === id ? " sl-nav-btn--active" : ""}`}
              onClick={() => goTo(id)}>
              <span className="sl-nav-icon">{icon}</span>
              {label}
              {id === "attendance" && notifCount > 0 && (
                <span className="sl-nav-badge">{notifCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sl-sidebar-footer">
          <button
            className={`sl-settings-btn${settingsOpen ? " sl-settings-btn--active" : ""}`}
            onClick={() => setSettingsOpen(v => !v)}>
            <span className="sl-nav-icon">⚙️</span>
            Settings
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="sl-shell">

        {!isMobile && sidebarOpen && (
          <aside className="sl-sidebar"><SidebarInner /></aside>
        )}

        {isMobile && (
          <>
            {sidebarOpen && <div className="sl-overlay" onClick={() => setSidebarOpen(false)} />}
            <aside className={`sl-sidebar${sidebarOpen ? " sl-sidebar--open" : ""}`}>
              <SidebarInner />
            </aside>
          </>
        )}

        <main className="sl-main">
          <header className="sl-topbar">
            <button className="sl-hamburger" onClick={() => setSidebarOpen(v => !v)} aria-label="Menu">
              {sidebarOpen ? "✕" : "☰"}
            </button>
            <img src={nccLogo} alt="NCC" className="sl-topbar-logo" onClick={() => setSidebarOpen(v => !v)} />
            <span className="sl-topbar-title">Senior Dashboard</span>
            <span className="sl-topbar-page">{curShort}</span>
          </header>

          <div className="sl-content">
            {renderPage()}
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAV (3 items + settings) ── */}
        <nav className="sl-bottom-nav">
          {NAV.map(({ id, short, icon }) => (
            <button key={id}
              className={`sl-bottom-btn${currentPage === id ? " sl-bottom-btn--active" : ""}`}
              onClick={() => goTo(id)}>
              <span className="sl-nav-icon">{icon}</span>
              {short}
              {id === "attendance" && notifCount > 0 && <span className="sl-bottom-dot" />}
            </button>
          ))}
          <button
            className={`sl-bottom-btn${settingsOpen ? " sl-bottom-btn--active" : ""}`}
            onClick={() => setSettingsOpen(v => !v)}>
            <span className="sl-nav-icon">⚙️</span>
            Settings
          </button>
        </nav>
      </div>

      {settingsOpen && (
        <SettingsPanel
          role="senior"
          currentPage={currentPage}
          onNavigate={(page) => { goTo(page); setSettingsOpen(false); }}
          onLogout={handleLogout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MY RECORD PAGE — wraps CadetDashboard
   Shows a "not linked" message if cadet_id is null
════════════════════════════════════════════════════════════ */
function MyRecordPage({ hasCadetLink }) {
  // Still loading
  if (hasCadetLink === null) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", color: "var(--csi-text-muted)" }}>
        Loading…
      </div>
    </div>
  );

  // cadet_id not linked
  if (!hasCadetLink) return (
    <div className="sl-no-record">
      <div style={{ fontSize: "2rem" }}>🔗</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "1rem", fontWeight: 700, color: "var(--csi-text-primary)" }}>
        Cadet Profile Not Linked
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.72rem", color: "var(--csi-text-muted)", maxWidth: 280, lineHeight: 1.6 }}>
        Your senior account is not linked to a cadet record yet. Contact ANO to link your profile.
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "var(--csi-text-muted)", marginTop: "0.5rem", opacity: 0.6 }}>
        ANO: Profiles → set cadet_id for this senior
      </div>
    </div>
  );

  // Linked — render CadetDashboard directly, it handles its own data fetching
  return <CadetDashboard />;
}
