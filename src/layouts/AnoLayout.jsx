/**
 * AnoLayout.jsx
 * ─────────────────────────────────────────────────────────────
 * Root shell for the ANO dashboard.
 *
 * Schema: user_profiles columns used:
 *   - role               : 'ano' | 'senior'
 *   - assigned_category  : 'A' | 'B' | 'C'  (system categorisation)
 *   - assigned_division  : 'SD' | 'SW'       (primary access restriction)
 *
 * Layout:
 *   - Desktop (≥769px): persistent sidebar (230px) + main content
 *   - Mobile  (≤768px): top bar + full content + bottom nav bar
 *   - All pages occupy 100% of available space (no double padding)
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import nccLogo from "../assets/ncc-logo.png";
import ParadeControl from "../pages/ParadeControl";
import CsiUnitSummary from "../pages/CsiUnitSummary";
import BatchPromotion from "../pages/BatchPromotion";
import AdminDesk from "../pages/AdminDesk";
import SettingsPanel from "../components/SettingsPanel";
import { useTheme } from "../components/ThemeContext";

/* ── Constants ──────────────────────────────────────────────── */
const SIDEBAR_W  = 230;
const TOPBAR_H   = 52;
const MOBILE_NAV = 56;
const BREAKPOINT = 768;

const NAV = [
  { id: "parade",    label: "Parade Control", short: "Parade",    icon: "🎖"  },
  { id: "csi",       label: "CSI Dashboard",  short: "CSI",       icon: "📊"  },
  { id: "promotion", label: "Promotions",     short: "Promote",   icon: "⬆️"  },
  { id: "admindesk", label: "AdminDesk",      short: "Desk",      icon: "🛠"  },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  html, body { height: 100%; overflow: hidden; }
  #root      { height: 100%; }

  @keyframes al-in      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes al-shimmer { 0%,100%{opacity:.3} 50%{opacity:.75} }
  @keyframes al-drawin  { from{transform:translateX(-100%)} to{transform:translateX(0)} }

  /* ── Shell ── */
  .al-shell {
    display        : flex;
    flex-direction : row;
    width          : 100vw;
    height         : 100vh;
    overflow       : hidden;
    background     : var(--csi-bg-page);
    color          : var(--csi-text-primary);
    transition     : background .25s, color .25s;
    font-family    : var(--csi-font-body, sans-serif);
  }

  /* ═══ SIDEBAR ═══ */
  .al-sidebar {
    width          : ${SIDEBAR_W}px;
    flex-shrink    : 0;
    height         : 100vh;
    display        : flex;
    flex-direction : column;
    background     : var(--csi-bg-card);
    border-right   : 1px solid var(--csi-border);
    transition     : background .25s, border-color .25s;
    overflow       : hidden;
    z-index        : 200;
  }

  /* ── Brand ── */
  .al-brand {
    padding        : 1rem 1rem 0.8rem;
    border-bottom  : 1px solid var(--csi-border);
    flex-shrink    : 0;
  }
  .al-brand-unit {
    font-family    : var(--csi-font-mono);
    font-size      : 0.57rem;
    color          : var(--csi-text-muted);
    text-transform : uppercase;
    letter-spacing : 0.12em;
    margin-bottom  : 0.2rem;
  }
  .al-brand-title {
    font-family    : var(--csi-font-display);
    font-size      : 0.82rem;
    font-weight    : 700;
    color          : var(--csi-indigo-light);
  }

  /* ── Parade chip ── */
  .al-chip {
    margin         : 0.55rem 0.7rem;
    padding        : 0.42rem 0.7rem;
    border-radius  : 0.5rem;
    font-family    : var(--csi-font-mono);
    font-size      : 0.61rem;
    line-height    : 1.45;
    flex-shrink    : 0;
    transition     : background .25s;
  }
  .al-chip--none   { background:var(--csi-bg-input);  color:var(--csi-text-muted); border:1px solid var(--csi-border-input); }
  .al-chip--active { background:var(--csi-green-bg);  color:var(--csi-green);      border:1px solid var(--csi-green-border); }
  .al-chip--review { background:var(--csi-amber-bg);  color:var(--csi-amber);      border:1px solid var(--csi-amber-border); }

  /* ── Nav ── */
  .al-nav { flex:1; padding:0.35rem 0; overflow-y:auto; }
  .al-nav::-webkit-scrollbar          { width:3px; }
  .al-nav::-webkit-scrollbar-track    { background:transparent; }
  .al-nav::-webkit-scrollbar-thumb    { background:var(--csi-border-input); border-radius:99px; }

  .al-nav-btn {
    width          : 100%;
    text-align     : left;
    background     : none;
    border         : none;
    border-left    : 3px solid transparent;
    padding        : 0.7rem 1rem 0.7rem 0.85rem;
    cursor         : pointer;
    font-family    : var(--csi-font-display);
    font-size      : 0.82rem;
    font-weight    : 400;
    color          : var(--csi-text-sub);
    transition     : all .12s;
    display        : flex;
    align-items    : center;
    gap            : 0.6rem;
  }
  .al-nav-btn:hover {
    color              : var(--csi-text-primary);
    background         : var(--csi-bg-hover);
    border-left-color  : var(--csi-indigo-light);
  }
  .al-nav-btn--active {
    color              : var(--csi-text-primary);
    font-weight        : 700;
    background         : rgba(79,70,229,.12);
    border-left-color  : var(--csi-indigo);
  }
  .al-nav-icon { font-size:.95rem; flex-shrink:0; width:20px; text-align:center; }

  /* ── Settings footer ── */
  .al-footer { border-top:1px solid var(--csi-border); flex-shrink:0; position:relative; }
  .al-settings-btn {
    width:100%; background:none; border:none; padding:0.72rem 1rem;
    cursor:pointer; display:flex; align-items:center; gap:0.55rem;
    color:var(--csi-text-muted); font-family:var(--csi-font-display);
    font-size:0.82rem; font-weight:600; transition:background .12s, color .12s;
  }
  .al-settings-btn:hover        { background:var(--csi-bg-hover); color:var(--csi-text-primary); }
  .al-settings-btn--on          { background:rgba(79,70,229,.1); color:var(--csi-indigo-light); }

  /* ═══ MAIN ═══ */
  .al-main {
    flex           : 1;
    display        : flex;
    flex-direction : column;
    min-width      : 0;
    height         : 100vh;
    overflow       : hidden;
  }

  /* ── Top bar ── */
  .al-topbar {
    height         : ${TOPBAR_H}px;
    flex-shrink    : 0;
    background     : var(--csi-bg-card);
    border-bottom  : 1px solid var(--csi-border);
    display        : flex;
    align-items    : center;
    padding        : 0 1rem;
    gap            : 0.7rem;
    transition     : background .25s, border-color .25s;
    z-index        : 100;
  }
  .al-topbar-logo  { height:32px; cursor:pointer; border-radius:3px; flex-shrink:0; transition:opacity .15s; }
  .al-topbar-logo:hover { opacity:.82; }
  .al-topbar-title {
    font-family    : var(--csi-font-display);
    font-size      : 0.9rem;
    font-weight    : 700;
    color          : var(--csi-text-primary);
    flex           : 1;
    white-space    : nowrap;
    overflow       : hidden;
    text-overflow  : ellipsis;
  }
  .al-hamburger {
    background     : none;
    border         : none;
    color          : var(--csi-text-sub);
    font-size      : 1.2rem;
    cursor         : pointer;
    padding        : 0.3rem 0.4rem;
    border-radius  : 0.35rem;
    line-height    : 1;
    flex-shrink    : 0;
    display        : none;
    transition     : background .12s;
  }
  .al-hamburger:hover { background:var(--csi-bg-input); }

  /* ── Topbar settings button ── */
  .al-topbar-settings {
    background     : none;
    border         : none;
    color          : var(--csi-text-sub);
    font-size      : 1.2rem;
    cursor         : pointer;
    padding        : 0.3rem 0.4rem;
    border-radius  : 0.35rem;
    line-height    : 1;
    flex-shrink    : 0;
    display        : flex;
    align-items    : center;
    justify-content: center;
    transition     : background .12s, color .12s;
  }
  .al-topbar-settings:hover { background:var(--csi-bg-input); }
  .al-topbar-settings--on   { color:var(--csi-indigo-light); background:rgba(79,70,229,.1); }

  /* ── Content ── */
  .al-content {
    flex         : 1;
    overflow-y   : auto;
    overflow-x   : auto;
    min-height   : 0;
    -webkit-overflow-scrolling : touch;
  }
  .al-content::-webkit-scrollbar       { width:5px; }
  .al-content::-webkit-scrollbar-track { background:transparent; }
  .al-content::-webkit-scrollbar-thumb { background:var(--csi-border-input); border-radius:99px; }

  /* ═══ MOBILE OVERRIDES (≤768px) ═══ */
  @media (max-width: ${BREAKPOINT}px) {

    /* Sidebar becomes a fixed drawer */
    .al-sidebar {
      position   : fixed;
      top:0; left:0; bottom:0;
      transform  : translateX(-100%);
      box-shadow : 6px 0 28px rgba(0,0,0,.5);
      transition : transform .28s cubic-bezier(.4,0,.2,1), background .25s, border-color .25s;
    }
    .al-sidebar--open { transform: translateX(0); animation: al-drawin .28s cubic-bezier(.4,0,.2,1); }

    /* Overlay behind drawer */
    .al-overlay {
      position   : fixed;
      inset      : 0;
      z-index    : 190;
      background : rgba(0,0,0,.55);
      backdrop-filter: blur(2px);
    }

    /* Show hamburger */
    .al-hamburger { display:flex; align-items:center; justify-content:center; }

    /* Bottom nav visible */
    .al-bottomnav { display:flex; }

    /* Leave room for bottom nav */
    .al-content { padding-bottom: ${MOBILE_NAV}px; }
  }

  /* ═══ BOTTOM NAV (mobile only) ═══ */
  .al-bottomnav {
    display        : none;
    position       : fixed;
    bottom:0; left:0; right:0;
    height         : ${MOBILE_NAV}px;
    background     : var(--csi-bg-card);
    border-top     : 1px solid var(--csi-border);
    z-index        : 150;
    transition     : background .25s, border-color .25s;
  }
  .al-bn-btn {
    flex           : 1;
    background     : none;
    border         : none;
    cursor         : pointer;
    display        : flex;
    flex-direction : column;
    align-items    : center;
    justify-content: center;
    gap            : 0.15rem;
    color          : var(--csi-text-muted);
    font-family    : var(--csi-font-mono);
    font-size      : 0.52rem;
    text-transform : uppercase;
    letter-spacing : 0.05em;
    padding        : 0.35rem 0.15rem;
    transition     : color .12s;
    position       : relative;
  }
  .al-bn-btn--active { color:var(--csi-indigo-light); }
  .al-bn-btn--active::before {
    content    : '';
    position   : absolute;
    top        : 0; left:25%; right:25%;
    height     : 2px;
    background : var(--csi-indigo);
    border-radius: 0 0 2px 2px;
  }
  .al-bn-icon { font-size:1.15rem; line-height:1; }

  /* ── Loading skeleton ── */
  .al-skel { background:var(--csi-bg-card); border-radius:.5rem; animation:al-shimmer 1.4s ease infinite; }
`;

/* ═══════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════ */
export default function AnoLayout() {
  const [sidebarOpen,  setSidebarOpen]  = useState(window.innerWidth > 768);
  const [parade,       setParade]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [currentPage,  setCurrentPage]  = useState(() => localStorage.getItem("ano_page") || "parade");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile,     setIsMobile]     = useState(window.innerWidth <= BREAKPOINT);

  useTheme(); // ensure theme context is active

  /* ── Responsive ── */
  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);   // restore on desktop
      else setSidebarOpen(false);           // collapse on mobile
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Logout ── */
  async function handleLogout() {
    await supabase.auth.signOut();
  }

  /* ── Fetch parade ── */
  const fetchParade = useCallback(async () => {
    const { data } = await supabase
      .from("parades")
      .select("id, parade_date, session, status, categories")
      .in("status", ["active", "attendance_submitted"])
      .maybeSingle();
    setParade(data || null);
    return data || null;
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchParade();
      setLoading(false);
    }
    init();
  }, [fetchParade]);

  /* ── Navigate ── */
  function goTo(page) {
    localStorage.setItem("ano_page", page);
    setCurrentPage(page);
    setSettingsOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  /* ── Parade chip data ── */
  function chipData() {
    if (!parade)
      return { cls: "al-chip--none",   text: "No active parade" };
    if (parade.status === "active")
      return { cls: "al-chip--active", text: `Active · ${parade.parade_date}` };
    return   { cls: "al-chip--review", text: `Review · ${parade.parade_date}` };
  }

  /* ── Render page ── */
  function renderPage() {
    switch (currentPage) {
      case "parade":    return <ParadeControl />;
      case "csi":       return <CsiUnitSummary />;
      case "promotion": return <BatchPromotion />;
      case "admindesk": return <AdminDesk userRole="ano" />;
      default:          return null;
    }
  }

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{STYLES}</style>
      <div className="al-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: 240 }}>
          {[44, 24, 24, 24, 24].map((h, i) => (
            <div key={i} className="al-skel" style={{ height: h, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </>
  );

  const chip = chipData();

  /* ── Sidebar inner contents (reused for desktop + mobile drawer) ── */
  function SidebarInner() {
    return (
      <>
        {/* Brand */}
        <div className="al-brand">
          <p className="al-brand-unit">2(A) EME Unit NCC</p>
          <p className="al-brand-title">ANO Dashboard</p>
        </div>

        {/* Parade status chip */}
        <div className={`al-chip ${chip.cls}`}>{chip.text}</div>

        {/* Nav links */}
        <nav className="al-nav">
          {NAV.map(({ id, label, icon }) => (
            <button key={id}
              className={`al-nav-btn${currentPage === id ? " al-nav-btn--active" : ""}`}
              onClick={() => goTo(id)}>
              <span className="al-nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* Settings */}
        <div className="al-footer">
          <button
            className={`al-settings-btn${settingsOpen ? " al-settings-btn--on" : ""}`}
            onClick={() => setSettingsOpen(v => !v)}>
            <span style={{ fontSize: "1rem" }}>⚙️</span>
            Settings
          </button>

        </div>
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="al-shell">

        {/* ════ DESKTOP SIDEBAR ════ */}
        {!isMobile && sidebarOpen && (
          <aside className="al-sidebar">
            <SidebarInner />
          </aside>
        )}

        {/* ════ MOBILE DRAWER ════ */}
        {isMobile && (
          <>
            {sidebarOpen && (
              <div className="al-overlay" onClick={() => setSidebarOpen(false)} />
            )}
            <aside className={`al-sidebar${sidebarOpen ? " al-sidebar--open" : ""}`}>
              <SidebarInner />
            </aside>
          </>
        )}

        {/* ════ MAIN COLUMN ════ */}
        <main className="al-main">

          {/* Top bar */}
          <header className="al-topbar">
            <button className="al-hamburger"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Menu">
              {sidebarOpen ? "✕" : "☰"}
            </button>

            <img src={nccLogo} alt="NCC"
              className="al-topbar-logo"
              onClick={() => setSidebarOpen(v => !v)} />

            <span className="al-topbar-title">NCC ANO Dashboard</span>

            {/* Active page label — mobile topbar right */}
            {isMobile && (
              <span style={{
                fontFamily: "var(--csi-font-mono)", fontSize: "0.6rem",
                color: "var(--csi-indigo-light)", flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {NAV.find(n => n.id === currentPage)?.short}
              </span>
            )}

            {/* ⚙️ Settings — always visible in topbar on mobile */}
            <button
              className={`al-topbar-settings${settingsOpen ? " al-topbar-settings--on" : ""}`}
              onClick={() => setSettingsOpen(v => !v)}
              aria-label="Settings">
              ⚙️
            </button>
          </header>

          {/* Page content */}
          <div className="al-content">
            {renderPage()}
          </div>

        </main>

        {/* ════ MOBILE BOTTOM NAV ════ */}
        <nav className="al-bottomnav">
          {NAV.map(({ id, short, icon }) => (
            <button key={id}
              className={`al-bn-btn${currentPage === id ? " al-bn-btn--active" : ""}`}
              onClick={() => goTo(id)}>
              <span className="al-bn-icon">{icon}</span>
              {short}
            </button>
          ))}
        </nav>

      </div>

      {/* ════ SETTINGS PANEL ════ */}
      {settingsOpen && (
        <SettingsPanel
          role="ano"
          currentPage={currentPage}
          onNavigate={(page) => { goTo(page); setSettingsOpen(false); }}
          onLogout={handleLogout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
