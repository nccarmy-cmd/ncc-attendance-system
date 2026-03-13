/**
 * ParadeControl.jsx — with parade notification dispatch
 *
 * Changes from previous version:
 *  - handleCreate now dispatches parade_notifications after parade insert
 *  - Fetches all seniors + active cadets from profiles
 *  - Deletes old notifications, inserts fresh rows for new parade
 *  - Success card shows notification count
 *  - Error is now fatal (surfaced to UI instead of swallowed)
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

const PARADE_TYPES = [
  "Theory", "Drill", "Weapon Training", "Physical Training (PT)",
  "Parade Rehearsal", "Cultural Practice", "Event", "Awareness Program","Study Hours",
];

const PERMISSION_REASONS = [
  "Health issue", "Unit office work", "Went home",
  "Sports", "Camp duty","Academic works", "Exams", "Family Problems", "Other",
];

const SESSION_OPTIONS = [
  { val: "morning",   label: "Morning",   icon: "🌅" },
  { val: "afternoon", label: "Afternoon", icon: "☀️"  },
  { val: "evening",   label: "Evening",   icon: "🌆" },
];

const CAT_COLORS = {
  A: { accent: "#34d399", bg: "var(--csi-green-bg)",    border: "var(--csi-green-border)"  },
  B: { accent: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.28)"   },
  C: { accent: "#fbbf24", bg: "var(--csi-amber-bg)",    border: "var(--csi-amber-border)"  },
};

const RANK_ORDER = ["SUO", "JUO", "CQMS", "SGT", "CPL", "LCPL", "CDT"];
const MONO  = { fontFamily: "var(--csi-font-mono)" };
const SYNE  = { fontFamily: "var(--csi-font-display)" };

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  @keyframes pd-in    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pd-pop   { 0%{transform:scale(0.93);opacity:0} 60%{transform:scale(1.02)} 100%{transform:scale(1);opacity:1} }
  @keyframes pd-spin  { to { transform:rotate(360deg); } }
  @keyframes pd-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)} 70%{box-shadow:0 0 0 7px rgba(99,102,241,0)} }
  @keyframes pd-shimmer { 0%,100%{opacity:0.35} 50%{opacity:0.9} }

  .pd-page { background:var(--csi-bg-page); color:var(--csi-text-primary); min-height:100vh; padding:1.75rem 1.5rem 3rem; transition:background .25s,color .25s; font-family:var(--csi-font-body,sans-serif); }
  .pd-inner { max-width:860px; margin:0 auto; }
  .pd-eyebrow { font-family:var(--csi-font-mono); font-size:0.6rem; color:var(--csi-indigo-light); text-transform:uppercase; letter-spacing:0.14em; margin:0 0 0.3rem; }
  .pd-title { font-family:var(--csi-font-display); font-size:1.9rem; font-weight:800; color:var(--csi-text-primary); margin:0 0 0.2rem; }
  .pd-subtitle { font-size:.81rem; color:var(--csi-text-muted); margin:0 0 1.75rem; }

  .pd-tabs { display:flex; gap:0.2rem; background:var(--csi-bg-card); border:1px solid var(--csi-border); border-radius:0.8rem; padding:0.25rem; margin-bottom:1.5rem; width:fit-content; transition:background .25s; }
  .pd-tab { font-family:var(--csi-font-mono); font-size:0.73rem; font-weight:400; padding:0.5rem 1.1rem; border-radius:0.55rem; border:none; cursor:pointer; transition:all .15s; background:transparent; color:var(--csi-text-muted); white-space:nowrap; }
  .pd-tab:hover { color:var(--csi-text-primary); background:var(--csi-bg-input); }
  .pd-tab--active { background:var(--csi-indigo); color:white; font-weight:700; box-shadow:0 2px 10px rgba(79,70,229,.28); }
  .pd-tab--dot::after { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:#fbbf24; margin-left:0.4rem; vertical-align:middle; }

  .pd-card { background:var(--csi-bg-card); border:1px solid var(--csi-border); border-radius:0.9rem; padding:1.3rem; margin-bottom:0.9rem; animation:pd-in .35s ease both; transition:background .25s,border-color .25s; }
  .pd-card--amber { border-color:var(--csi-amber-border); background:var(--csi-amber-bg); }
  .pd-card--red   { border-color:var(--csi-red-border);   background:var(--csi-red-bg);   }
  .pd-card--green { border-color:var(--csi-green-border); background:var(--csi-green-bg); animation:pd-pop .4s ease both; }
  .pd-card--dash  { border-style:dashed; }
  .pd-card:nth-child(1){animation-delay:.04s} .pd-card:nth-child(2){animation-delay:.09s}
  .pd-card:nth-child(3){animation-delay:.14s} .pd-card:nth-child(4){animation-delay:.19s}
  .pd-card:nth-child(5){animation-delay:.24s}

  .pd-label { font-family:var(--csi-font-mono); font-size:0.57rem; color:var(--csi-indigo-light); text-transform:uppercase; letter-spacing:0.13em; margin:0 0 0.85rem; }
  .pd-field { margin-bottom:1rem; }
  .pd-field-label { font-family:var(--csi-font-mono); font-size:0.6rem; color:var(--csi-text-muted); text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:0.38rem; }
  .pd-input,.pd-select,.pd-textarea { background:var(--csi-bg-input); border:1px solid var(--csi-border-input); color:var(--csi-text-primary); border-radius:0.5rem; padding:0.5rem 0.8rem; font-size:0.82rem; width:100%; box-sizing:border-box; font-family:inherit; transition:border-color .15s,box-shadow .15s; }
  .pd-input:focus,.pd-select:focus,.pd-textarea:focus { outline:none; border-color:var(--csi-border-focus); box-shadow:0 0 0 3px rgba(99,102,241,.11); }
  .pd-textarea { resize:vertical; min-height:76px; line-height:1.55; }

  .pd-session-row { display:flex; gap:0.45rem; }
  .pd-session-btn { flex:1; background:var(--csi-bg-input); border:1px solid var(--csi-border-input); color:var(--csi-text-sub); border-radius:0.55rem; padding:0.6rem 0.4rem; cursor:pointer; font-family:var(--csi-font-mono); font-size:0.7rem; text-align:center; transition:all .15s; display:flex; flex-direction:column; align-items:center; gap:0.18rem; }
  .pd-session-btn:hover { border-color:var(--csi-indigo-light); color:var(--csi-text-primary); }
  .pd-session-btn--on { background:var(--csi-indigo); border-color:var(--csi-indigo); color:white; box-shadow:0 2px 10px rgba(79,70,229,.28); }

  .pd-cat-grid { display:flex; gap:0.6rem; }
  .pd-cat-card { flex:1; border-radius:0.7rem; border:1px solid var(--csi-border-input); background:var(--csi-bg-input); padding:0.85rem 0.7rem; cursor:pointer; transition:all .18s; position:relative; overflow:hidden; }
  .pd-cat-card:hover { border-color:var(--csi-border-focus); }
  .pd-cat-letter { font-family:var(--csi-font-display); font-size:1.5rem; font-weight:800; line-height:1; margin-bottom:0.25rem; }
  .pd-cat-badge { position:absolute; top:0.4rem; right:0.5rem; font-family:var(--csi-font-mono); font-size:0.62rem; font-weight:700; }
  .pd-cat-select { background:var(--csi-bg-card); border:1px solid var(--csi-border-input); color:var(--csi-text-primary); border-radius:0.38rem; padding:0.3rem 0.45rem; font-size:0.67rem; width:100%; margin-top:0.45rem; font-family:var(--csi-font-mono); cursor:pointer; transition:opacity .15s; }
  .pd-cat-select:disabled { opacity:0.28; cursor:not-allowed; }

  .pd-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .pd-toggle-track { width:40px; height:22px; border-radius:99px; border:1px solid var(--csi-border-input); background:var(--csi-bg-input); position:relative; cursor:pointer; transition:background .2s,border-color .2s; flex-shrink:0; }
  .pd-toggle-track--on { background:var(--csi-indigo); border-color:var(--csi-indigo); }
  .pd-toggle-thumb { width:14px; height:14px; border-radius:50%; background:white; position:absolute; top:3px; left:3px; transition:left .2s; box-shadow:0 1px 3px rgba(0,0,0,.25); }
  .pd-toggle-thumb--on { left:19px; }

  .pd-meta-row { display:flex; justify-content:space-between; align-items:center; padding:0.38rem 0; border-bottom:1px solid var(--csi-border); }
  .pd-meta-row:last-child { border-bottom:none; }
  .pd-meta-key { font-family:var(--csi-font-mono); font-size:0.6rem; color:var(--csi-text-muted); text-transform:uppercase; letter-spacing:0.08em; }
  .pd-meta-val { font-family:var(--csi-font-mono); font-size:0.7rem; color:var(--csi-text-primary); font-weight:600; }

  .pd-filter-row { display:flex; gap:0.35rem; flex-wrap:wrap; align-items:center; margin-bottom:0.9rem; }
  .pd-pill { font-family:var(--csi-font-mono); font-size:0.63rem; padding:0.32rem 0.75rem; border-radius:0.4rem; border:1px solid var(--csi-border-input); background:var(--csi-bg-input); color:var(--csi-text-muted); cursor:pointer; transition:all .12s; }
  .pd-pill:hover { color:var(--csi-text-primary); border-color:var(--csi-indigo-light); }
  .pd-pill--on { background:var(--csi-indigo); border-color:var(--csi-indigo); color:white; }
  .pd-pill--amber-on { background:var(--csi-amber-bg); border-color:var(--csi-amber-border); color:var(--csi-amber); }

  .pd-search { background:var(--csi-bg-input); border:1px solid var(--csi-border-input); color:var(--csi-text-primary); border-radius:0.45rem; padding:0.38rem 0.75rem; font-size:0.78rem; font-family:var(--csi-font-mono); width:200px; transition:border-color .15s; }
  .pd-search:focus { outline:none; border-color:var(--csi-border-focus); }
  .pd-search::placeholder { color:var(--csi-text-muted); }

  .pd-table { width:100%; border-collapse:collapse; font-size:0.78rem; }
  .pd-table th { font-family:var(--csi-font-mono); font-size:0.58rem; text-transform:uppercase; letter-spacing:0.09em; color:var(--csi-text-muted); padding:0.55rem 0.7rem; text-align:left; border-bottom:1px solid var(--csi-border); background:var(--csi-bg-input); white-space:nowrap; }
  .pd-table td { padding:0.55rem 0.7rem; border-bottom:1px solid var(--csi-border); vertical-align:middle; }
  .pd-table tr:last-child td { border-bottom:none; }
  .pd-table tr:hover td { background:var(--csi-bg-input); }

  .pd-perm-chip { display:inline-flex; align-items:center; gap:0.35rem; background:var(--csi-amber-bg); border:1px solid var(--csi-amber-border); color:var(--csi-amber); border-radius:0.35rem; padding:0.2rem 0.55rem; font-family:var(--csi-font-mono); font-size:0.65rem; cursor:pointer; transition:all .12s; }
  .pd-perm-chip:hover { border-color:var(--csi-amber); }
  .pd-perm-add { display:inline-flex; align-items:center; gap:0.3rem; background:transparent; border:1px dashed var(--csi-border-input); color:var(--csi-text-muted); border-radius:0.35rem; padding:0.2rem 0.55rem; font-family:var(--csi-font-mono); font-size:0.63rem; cursor:pointer; transition:all .12s; }
  .pd-perm-add:hover { border-color:var(--csi-indigo-light); color:var(--csi-text-primary); }
  .pd-perm-editor { background:var(--csi-bg-input); border:1px solid var(--csi-border-focus); border-radius:0.55rem; padding:0.7rem; display:flex; flex-direction:column; gap:0.5rem; animation:pd-in .2s ease both; }
  .pd-perm-editor-row { display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap; }

  .pd-badge { display:inline-block; font-family:var(--csi-font-mono); font-size:0.58rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:0.25rem; text-transform:uppercase; letter-spacing:0.06em; }
  .pd-badge--present  { background:var(--csi-green-bg);  color:var(--csi-green);  border:1px solid var(--csi-green-border); }
  .pd-badge--perm     { background:var(--csi-amber-bg);  color:var(--csi-amber);  border:1px solid var(--csi-amber-border); }
  .pd-badge--absent   { background:var(--csi-red-bg);    color:var(--csi-red);    border:1px solid var(--csi-red-border);   }

  .pd-stat-grid { display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:1rem; }
  .pd-stat-box { flex:1; min-width:90px; background:var(--csi-bg-card); border:1px solid var(--csi-border); border-radius:0.7rem; padding:0.7rem 0.9rem; transition:background .25s; }
  .pd-stat-key { font-family:var(--csi-font-mono); font-size:0.57rem; color:var(--csi-text-muted); text-transform:uppercase; letter-spacing:0.09em; margin:0 0 0.25rem; }
  .pd-stat-val { font-family:var(--csi-font-display); font-size:1.5rem; font-weight:800; margin:0; line-height:1; }

  .pd-rank-table { width:100%; border-collapse:collapse; font-size:0.75rem; }
  .pd-rank-table th { font-family:var(--csi-font-mono); font-size:0.57rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--csi-text-muted); padding:0.45rem 0.65rem; border-bottom:1px solid var(--csi-border); text-align:center; background:var(--csi-bg-input); }
  .pd-rank-table th:first-child { text-align:left; }
  .pd-rank-table td { padding:0.45rem 0.65rem; text-align:center; border-bottom:1px solid var(--csi-border); color:var(--csi-text-primary); }
  .pd-rank-table td:first-child { text-align:left; font-family:var(--csi-font-mono); font-size:0.65rem; color:var(--csi-text-sub); }
  .pd-rank-table tr:last-child td { border-bottom:none; }

  .pd-btn-primary { background:var(--csi-indigo); border:none; color:white; font-family:var(--csi-font-mono); font-size:0.82rem; font-weight:700; border-radius:0.6rem; padding:0.72rem 1.5rem; cursor:pointer; transition:background .15s,transform .1s; display:inline-flex; align-items:center; gap:0.5rem; }
  .pd-btn-primary:hover:not(:disabled) { background:var(--csi-indigo-hover); transform:translateY(-1px); }
  .pd-btn-primary:disabled { opacity:0.45; cursor:not-allowed; }
  .pd-btn-primary--full { width:100%; justify-content:center; animation:pd-pulse 2s infinite; }
  .pd-btn-primary--full:disabled { animation:none; }

  .pd-btn-ghost { background:transparent; border:1px solid var(--csi-border-input); color:var(--csi-text-sub); font-family:var(--csi-font-mono); font-size:0.75rem; border-radius:0.5rem; padding:0.45rem 1rem; cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:0.4rem; }
  .pd-btn-ghost:hover { border-color:var(--csi-indigo-light); color:var(--csi-text-primary); }
  .pd-btn-ghost:disabled { opacity:0.4; cursor:not-allowed; }

  .pd-btn-danger { background:var(--csi-red-bg); border:1px solid var(--csi-red-border); color:var(--csi-red); font-family:var(--csi-font-mono); font-size:0.82rem; font-weight:700; border-radius:0.6rem; padding:0.72rem 1.5rem; cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:0.5rem; }
  .pd-btn-danger:hover:not(:disabled) { background:var(--csi-red-border); color:white; }
  .pd-btn-danger:disabled { opacity:0.4; cursor:not-allowed; }

  .pd-btn-icon { background:var(--csi-bg-input); border:1px solid var(--csi-border-input); color:var(--csi-text-sub); border-radius:0.4rem; padding:0.28rem 0.55rem; cursor:pointer; font-size:0.8rem; line-height:1; transition:all .12s; }
  .pd-btn-icon:hover { border-color:var(--csi-border-focus); color:var(--csi-text-primary); }
  .pd-btn-icon--save  { background:var(--csi-green-bg); border-color:var(--csi-green-border); color:var(--csi-green); }
  .pd-btn-icon--del   { background:var(--csi-red-bg); border-color:var(--csi-red-border); color:var(--csi-red); }

  .pd-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:pd-spin .7s linear infinite; flex-shrink:0; }
  .pd-spinner--sm { width:12px; height:12px; border-top-color:var(--csi-indigo); border-color:var(--csi-border-input); }
  .pd-skel { background:linear-gradient(90deg,var(--csi-bg-card) 25%,var(--csi-bg-input) 50%,var(--csi-bg-card) 75%); background-size:200% 100%; border-radius:0.45rem; animation:pd-shimmer 1.4s ease infinite; }

  .pd-alert { border-radius:0.6rem; padding:0.75rem 0.95rem; margin-bottom:0.85rem; display:flex; gap:0.55rem; align-items:flex-start; animation:pd-in .22s ease both; }
  .pd-alert p { font-family:var(--csi-font-mono); font-size:0.72rem; margin:0; line-height:1.5; }
  .pd-alert--error { background:var(--csi-red-bg);   border:1px solid var(--csi-red-border);   }
  .pd-alert--error p { color:var(--csi-red); }
  .pd-alert--warn  { background:var(--csi-amber-bg); border:1px solid var(--csi-amber-border); }
  .pd-alert--warn  p { color:var(--csi-amber); }
  .pd-alert--info  { background:var(--csi-bg-card);  border:1px solid var(--csi-border); }
  .pd-alert--info  p { color:var(--csi-text-sub); }

  .pd-modal-overlay { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.75); backdrop-filter:blur(4px); }
  .pd-modal { background:var(--csi-bg-card); border:1px solid var(--csi-border); border-radius:1rem; box-shadow:0 24px 56px rgba(0,0,0,.65); width:100%; max-width:440px; margin:0 1rem; padding:1.6rem; animation:pd-in .25s ease both; }
  .pd-modal h3 { font-family:var(--csi-font-display); font-size:1.15rem; font-weight:800; color:var(--csi-text-primary); margin:0 0 0.65rem; }
  .pd-modal p  { font-size:0.83rem; color:var(--csi-text-sub); line-height:1.6; margin:0 0 1.1rem; }
  .pd-modal-actions { display:flex; gap:0.65rem; justify-content:flex-end; }

  .pd-report-card { border:1px solid var(--csi-border); border-radius:0.7rem; padding:0.9rem 1rem; cursor:pointer; transition:border-color .15s,background .15s; margin-bottom:0.6rem; }
  .pd-report-card:hover { border-color:var(--csi-border-focus); background:var(--csi-bg-input); }
  .pd-report-card--missing { border-color:var(--csi-red-border); background:var(--csi-red-bg); cursor:default; }
  .pd-report-card--missing:hover { background:var(--csi-red-bg); border-color:var(--csi-red-border); }

  .pd-locked { display:flex; align-items:center; gap:0.6rem; background:var(--csi-amber-bg); border:1px solid var(--csi-amber-border); border-radius:0.6rem; padding:0.6rem 0.9rem; margin-bottom:1rem; font-family:var(--csi-font-mono); font-size:0.68rem; color:var(--csi-amber); animation:pd-in .22s ease both; }
  .pd-no-parade { text-align:center; padding:3rem 1rem; }
  .pd-no-parade-icon { font-size:2.5rem; margin-bottom:0.75rem; }
  .pd-success-icon { width:52px; height:52px; border-radius:50%; background:var(--csi-green-bg); border:2px solid var(--csi-green-border); display:flex; align-items:center; justify-content:center; font-size:1.4rem; margin:0 auto 0.9rem; }
`;

/* ── Shared components ── */
function Skeleton({ height = 80, width = "100%" }) {
  return <div className="pd-skel" style={{ height, width, marginBottom: "0.75rem" }} />;
}
function Alert({ type = "error", children }) {
  const icons = { error: "⚠", warn: "⚠", info: "ℹ" };
  return (
    <div className={`pd-alert pd-alert--${type}`}>
      <span style={{ flexShrink: 0, fontSize: "0.9rem" }}>{icons[type]}</span>
      <p>{children}</p>
    </div>
  );
}
function ConfirmModal({ title, message, warning, confirmLabel = "Confirm", onConfirm, onCancel, loading }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="pd-modal-overlay" onClick={e => { if (!loading && e.target === e.currentTarget) onCancel(); }}>
      <div className="pd-modal">
        {loading ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ display: "inline-block", width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--csi-border-input)", borderTopColor: "var(--csi-indigo)", animation: "pd-spin .8s linear infinite", marginBottom: "1rem" }} />
            <p style={{ ...SYNE, fontSize: "1rem", fontWeight: 700, color: "var(--csi-text-primary)", margin: "0 0 0.3rem" }}>Processing…</p>
            <p style={{ ...MONO, fontSize: "0.68rem", color: "var(--csi-text-muted)", margin: 0 }}>Please wait — do not close this page</p>
          </div>
        ) : (
          <>
            <h3>{title}</h3>
            <p>{message}</p>
            {warning && <Alert type="warn">{warning}</Alert>}
            <div className="pd-modal-actions">
              <button className="pd-btn-ghost" onClick={onCancel}>Cancel</button>
              <button className="pd-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ ACK TRACKER — shown after parade creation ═══ */
function AckTracker({ success, onReset, onCancelled }) {
  const [stats,        setStats]        = useState(null);
  const [ackedNames,   setAckedNames]   = useState([]);
  const [pendingNames, setPendingNames] = useState([]);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showAcked,    setShowAcked]    = useState(false);
  const [showPending,  setShowPending]  = useState(false);
  const intervalRef = useRef(null);

  /* Cancel state */
  const [cancelMode,   setCancelMode]   = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState(null);

  async function fetchStats() {
    if (!success?.paradeId) return;

    const { data: notifs } = await supabase
      .from("parade_notifications")
      .select("user_id, role, acknowledged")
      .eq("parade_id", success.paradeId);

    if (!notifs) return;

    const total   = notifs.length;
    const acked   = notifs.filter(n => n.acknowledged).length;
    const pending = total - acked;
    setStats({ total, acked, pending });
    setLastRefresh(new Date());

    // Resolve display entries for all roles
    async function resolveEntries(userIds) {
      if (userIds.length === 0) return [];
      // Get profiles for these user IDs
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, role, cadet_id")
        .in("id", userIds);
      if (!profs || profs.length === 0) return [];

      const entries = [];

      // Cadets — resolve name via cadet_id
      const cadetProfs = profs.filter(p => p.role === "cadet" && p.cadet_id);
      if (cadetProfs.length > 0) {
        const cadetIds = cadetProfs.map(p => p.cadet_id);
        const { data: cadets } = await supabase
          .from("cadets").select("id, name, rank").in("id", cadetIds);
        const cadetMap = Object.fromEntries((cadets || []).map(c => [c.id, c]));
        cadetProfs.forEach(p => {
          const c = cadetMap[p.cadet_id];
          if (c) entries.push({ name: c.name, rank: c.rank, role: "cadet" });
        });
      }

      // Seniors — resolve name via cadets table (seniors also have cadet_id)
      const seniorProfs = profs.filter(p => p.role === "senior");
      if (seniorProfs.length > 0) {
        const seniorCadetIds = seniorProfs.map(p => p.cadet_id).filter(Boolean);
        if (seniorCadetIds.length > 0) {
          const { data: seniorCadets } = await supabase
            .from("cadets").select("id, name, rank").in("id", seniorCadetIds);
          const seniorMap = Object.fromEntries((seniorCadets || []).map(c => [c.id, c]));
          seniorProfs.forEach(p => {
            const c = seniorMap[p.cadet_id];
            entries.push({ name: c?.name || "Senior", rank: c?.rank || "—", role: "senior" });
          });
        } else {
          // seniors without cadet_id
          seniorProfs.forEach(() => entries.push({ name: "Senior", rank: "—", role: "senior" }));
        }
      }

      return entries.sort((a, b) => a.name.localeCompare(b.name));
    }

    const ackedIds   = notifs.filter(n =>  n.acknowledged).map(n => n.user_id);
    const pendingIds = notifs.filter(n => !n.acknowledged).map(n => n.user_id);

    const [an, pn] = await Promise.all([resolveEntries(ackedIds), resolveEntries(pendingIds)]);
    setAckedNames(an);
    setPendingNames(pn);
    setLoading(false);
  }

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 30000);
    return () => clearInterval(intervalRef.current);
  }, [success?.paradeId]);

  async function handleCancel() {
    if (!cancelReason.trim()) { setCancelError("Please provide a reason."); return; }
    setCancelling(true); setCancelError(null);
    const user = (await supabase.auth.getUser()).data.user;
    const { error: err } = await supabase.from("parades").update({
      status        : "cancelled",
      cancel_reason : cancelReason.trim(),
      cancelled_by  : user.id,
      cancelled_at  : new Date().toISOString(),
    }).eq("id", success.paradeId).in("status", ["active"]);
    if (err) { setCancelError(err.message); setCancelling(false); return; }
    await supabase.from("permissions").delete().eq("parade_id", success.paradeId);
    await supabase.from("parade_notifications").delete().eq("parade_id", success.paradeId);
    setCancelling(false); setCancelMode(false); setCancelReason("");
    if (onCancelled) onCancelled();
  }

  const pct = stats ? Math.round((stats.acked / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div>
      {/* ── Parade summary card ── */}
      <div className="pd-card pd-card--green" style={{ padding: "1.4rem 1.5rem", marginBottom: "0.9rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "1.1rem" }}>✓</span>
              <p style={{ ...SYNE, fontSize: "1.05rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: 0 }}>Parade Active</p>
            </div>
            <p style={{ ...MONO, fontSize: "0.68rem", color: "var(--csi-text-muted)", margin: "0 0 0.75rem" }}>
              {success.parade_date} · {success.session?.charAt(0).toUpperCase() + success.session?.slice(1)}
              {success.paradeTime ? ` · ${success.paradeTime}` : ""}
              {success.place ? ` · ${success.place}` : ""}
              {" · Cat "}{success.categories?.join(", ")}
            </p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {Object.entries(success.parade_type_map || {}).map(([cat, type]) => (
                <span key={cat} style={{
                  ...MONO, fontSize: "0.63rem", fontWeight: 600,
                  background: CAT_COLORS[cat]?.bg, color: CAT_COLORS[cat]?.accent,
                  border: `1px solid ${CAT_COLORS[cat]?.border}`,
                  borderRadius: "0.35rem", padding: "0.2rem 0.55rem",
                }}>Cat {cat} · {type}</span>
              ))}
            </div>
          </div>
          {/* Cancel button */}
          <button
            className="pd-btn-danger"
            style={{ fontSize: "0.72rem", padding: "0.4rem 0.9rem", alignSelf: "flex-start" }}
            onClick={() => { setCancelMode(true); setCancelError(null); setCancelReason(""); }}>
            ✕ Cancel Parade
          </button>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          background: "rgba(52,211,153,0.12)", border: "1px solid var(--csi-green-border)",
          borderRadius: "0.45rem", padding: "0.3rem 0.8rem", marginTop: "0.9rem",
        }}>
          <span>🔔</span>
          <span style={{ ...MONO, fontSize: "0.67rem", color: "var(--csi-green)", fontWeight: 600 }}>
            {stats ? stats.total : (success.notified || "…")} notification{(stats?.total ?? success.notified) !== 1 ? "s" : ""} dispatched
          </span>
        </div>
      </div>

      {/* ── Ack tracker card ── */}
      <div className="pd-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <p className="pd-label" style={{ margin: 0 }}>🔔 Acknowledgement Tracker</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {lastRefresh && (
              <span style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)" }}>
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button className="pd-btn-ghost" style={{ fontSize: "0.65rem", padding: "0.28rem 0.7rem" }}
              onClick={fetchStats}>↻ Refresh</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <Skeleton height={70} /><Skeleton height={70} /><Skeleton height={70} />
          </div>
        ) : stats ? (
          <>
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.1rem" }}>
              {/* Notified — not clickable */}
              <div className="pd-stat-box" style={{ flex: 1 }}>
                <p className="pd-stat-key">Notified</p>
                <p className="pd-stat-val" style={{ color: "var(--csi-text-primary)", fontSize: "1.6rem" }}>{stats.total}</p>
              </div>
              {/* Ack'd — toggle */}
              <div className="pd-stat-box" style={{
                flex: 1, cursor: "pointer",
                borderColor: showAcked ? "var(--csi-green-border)" : "var(--csi-border)",
                background: showAcked ? "var(--csi-green-bg)" : "var(--csi-bg-card)",
              }} onClick={() => { setShowAcked(p => !p); setShowPending(false); }}>
                <p className="pd-stat-key" style={{ color: showAcked ? "var(--csi-green)" : undefined }}>
                  ✓ Acknowledged {showAcked ? "▲" : "▼"}
                </p>
                <p className="pd-stat-val" style={{ color: "var(--csi-green)", fontSize: "1.6rem" }}>{stats.acked}</p>
              </div>
              {/* Pending — toggle */}
              <div className="pd-stat-box" style={{
                flex: 1, cursor: "pointer",
                borderColor: showPending ? "var(--csi-amber-border)" : "var(--csi-border)",
                background: showPending ? "var(--csi-amber-bg)" : "var(--csi-bg-card)",
              }} onClick={() => { setShowPending(p => !p); setShowAcked(false); }}>
                <p className="pd-stat-key" style={{ color: showPending ? "var(--csi-amber)" : undefined }}>
                  ⏳ Awaiting {showPending ? "▲" : "▼"}
                </p>
                <p className="pd-stat-val" style={{ color: stats.pending > 0 ? "var(--csi-amber)" : "var(--csi-text-muted)", fontSize: "1.6rem" }}>{stats.pending}</p>
              </div>
            </div>

            <div style={{ marginBottom: "1.1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)" }}>Response rate</span>
                <span style={{ ...MONO, fontSize: "0.6rem", color: pct === 100 ? "var(--csi-green)" : "var(--csi-amber)", fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: "6px", borderRadius: "99px", background: "var(--csi-bg-input)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "99px", width: `${pct}%`,
                  background: pct === 100 ? "var(--csi-green)" : "var(--csi-indigo)",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>

            {/* ── Acknowledged list ── */}
            {showAcked && (
              <div style={{
                background: "var(--csi-green-bg)", border: "1px solid var(--csi-green-border)",
                borderRadius: "0.6rem", padding: "0.85rem 1rem", marginBottom: "0.75rem",
                animation: "pd-in 0.2s ease both",
              }}>
                <p style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-green)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.65rem" }}>
                  ✓ Acknowledged — {ackedNames.length}
                </p>
                {ackedNames.length === 0 ? (
                  <p style={{ ...MONO, fontSize: "0.7rem", color: "var(--csi-text-muted)" }}>No one has acknowledged yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {ackedNames.map((entry, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          ...MONO, fontSize: "0.58rem", fontWeight: 700,
                          background: entry.role === "senior" ? "rgba(129,140,248,0.15)" : "rgba(52,211,153,0.12)",
                          color: entry.role === "senior" ? "#818cf8" : "var(--csi-green)",
                          border: `1px solid ${entry.role === "senior" ? "rgba(129,140,248,0.3)" : "var(--csi-green-border)"}`,
                          borderRadius: "0.25rem", padding: "0.1rem 0.4rem", flexShrink: 0,
                        }}>{entry.role === "senior" ? "SNR" : "CDT"}</span>
                        <span style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)" }}>{entry.rank} {entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Awaiting list ── */}
            {showPending && (
              <div style={{
                background: "var(--csi-amber-bg)", border: "1px solid var(--csi-amber-border)",
                borderRadius: "0.6rem", padding: "0.85rem 1rem", marginBottom: "0.75rem",
                animation: "pd-in 0.2s ease both",
              }}>
                <p style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-amber)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.65rem" }}>
                  ⏳ Awaiting — {pendingNames.length}
                </p>
                {pendingNames.length === 0 ? (
                  <p style={{ ...MONO, fontSize: "0.7rem", color: "var(--csi-text-muted)" }}>Everyone has acknowledged!</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {pendingNames.map((entry, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{
                          ...MONO, fontSize: "0.58rem", fontWeight: 700,
                          background: entry.role === "senior" ? "rgba(129,140,248,0.15)" : "rgba(251,191,36,0.12)",
                          color: entry.role === "senior" ? "#818cf8" : "var(--csi-amber)",
                          border: `1px solid ${entry.role === "senior" ? "rgba(129,140,248,0.3)" : "var(--csi-amber-border)"}`,
                          borderRadius: "0.25rem", padding: "0.1rem 0.4rem", flexShrink: 0,
                        }}>{entry.role === "senior" ? "SNR" : "CDT"}</span>
                        <span style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)" }}>{entry.rank} {entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {stats.total === 0 && (
              <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)", textAlign: "center", padding: "1rem 0" }}>
                No notification rows found for this parade.
              </p>
            )}
          </>
        ) : null}

        <p style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)", marginTop: "0.9rem" }}>
          Auto-refreshes every 30 seconds
        </p>
      </div>

      {/* ── Cancel modal ── */}
      {cancelMode && (
        <div className="pd-modal-overlay"
          onClick={() => { if (!cancelling) { setCancelMode(false); setCancelReason(""); } }}>
          <div className="pd-modal" onClick={e => e.stopPropagation()}>
            <h3>Cancel Parade</h3>
            <p>
              Cancel the <strong>{success.parade_date}</strong> ({success.session}) parade?
              This cannot be undone.
            </p>
            {cancelError && <Alert type="error">{cancelError}</Alert>}
            <label className="pd-field-label" style={{ display: "block", marginBottom: "0.4rem" }}>
              Reason <span style={{ color: "var(--csi-red)" }}>*</span>
            </label>
            <textarea
              className="pd-textarea"
              placeholder="e.g. Heavy rain — parade ground waterlogged."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              disabled={cancelling}
              style={{ marginBottom: "1.1rem" }}
            />
            <div className="pd-modal-actions">
              <button className="pd-btn-ghost" disabled={cancelling}
                onClick={() => { setCancelMode(false); setCancelReason(""); }}>Go Back</button>
              <button className="pd-btn-danger" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <><div className="pd-spinner" />Cancelling…</> : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 1 — CREATE PARADE ═══ */
function TabCreate({ onParadeCreated }) {
  const today = new Date().toISOString().split("T")[0];

  const [paradeDate,      setParadeDate]      = useState(today);
  const [session,         setSession]         = useState("");
  const [paradeTime,      setParadeTime]      = useState("");
  const [place,           setPlace]           = useState("");
  const [selectedCats,    setSelectedCats]    = useState({ A: true, B: true, C: true });
  const [paradeTypes,     setParadeTypes]     = useState({ A: "Theory", B: "Theory", C: "Theory" });
  const [instructions,    setInstructions]    = useState("");
  const [loading,         setLoading]         = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error,           setError]           = useState(null);
  const [blocked,         setBlocked]         = useState(null);
  const [success,         setSuccess]         = useState(null);

  /* Cancel parade state */
  const [cancelMode,   setCancelMode]   = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState(null);

  useEffect(() => {
    async function init() {
      setInitialChecking(true);
      const { data: active } = await supabase
        .from("parades").select("id, parade_date, session, time, place, status, categories, parade_type_map")
        .in("status", ["active", "attendance_submitted"]).limit(1).maybeSingle();
      if (active) {
        // If still active (not yet submitted), show ack tracker automatically
        if (active.status === "active") {
          // Count notifications dispatched
          const { data: notifRows } = await supabase
            .from("parade_notifications")
            .select("id")
            .eq("parade_id", active.id);
          setSuccess({
            paradeId        : active.id,
            parade_date     : active.parade_date,
            session         : active.session,
            paradeTime      : active.time || "",
            place           : active.place || "",
            categories      : active.categories || [],
            parade_type_map : active.parade_type_map || {},
            notified        : (notifRows || []).length,
          });
          setInitialChecking(false);
          return;
        }
        // attendance_submitted — show blocked card
        setBlocked(active);
        setInitialChecking(false);
        return;
      }
      const { data: last } = await supabase
        .from("parades").select("parade_type_map").eq("status", "completed")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.parade_type_map) setParadeTypes(p => ({ ...p, ...last.parade_type_map }));
      setInitialChecking(false);
    }
    init();
  }, []);

  const activeCats = Object.keys(selectedCats).filter(c => selectedCats[c]);

  /* Cancel parade handler */
  async function handleCancelParade() {
    if (!cancelReason.trim()) {
      setCancelError("Please provide a reason before cancelling.");
      return;
    }
    setCancelling(true);
    setCancelError(null);
    const user = (await supabase.auth.getUser()).data.user;

    const { error: err } = await supabase
      .from("parades")
      .update({
        status        : "cancelled",
        cancel_reason : cancelReason.trim(),
        cancelled_by  : user.id,
        cancelled_at  : new Date().toISOString(),
      })
      .eq("id", blocked.id)
      .in("status", ["active"]);

    if (err) {
      setCancelError(err.message);
      setCancelling(false);
      return;
    }

    await supabase.from("permissions").delete().eq("parade_id", blocked.id);

    setCancelling(false);
    setCancelMode(false);
    setCancelReason("");
    setBlocked(null);
  }

  /* ── MAIN CREATE HANDLER — with notification dispatch ── */
  async function handleCreate() {
    setError(null);
    if (!paradeDate)             { setError("Please select a parade date.");        return; }
    if (paradeDate < today)      { setError("Cannot create parade for past date."); return; }
    if (!session)                { setError("Please select a session.");             return; }
    if (activeCats.length === 0) { setError("Select at least one category.");       return; }
    setLoading(true);

    try {
      // Block if parade already active
      const { data: live } = await supabase
        .from("parades").select("id, parade_date, session, status")
        .in("status", ["active", "attendance_submitted"]).limit(1).maybeSingle();
      if (live) { setBlocked(live); setLoading(false); return; }

      // ── STEP 1: Insert parade ────────────────────────────────
      const typeMap = {};
      activeCats.forEach(c => { typeMap[c] = paradeTypes[c]; });
      const user = (await supabase.auth.getUser()).data.user;

      const { data: newParade, error: err } = await supabase
        .from("parades")
        .insert({
          parade_date         : paradeDate,
          session             : session,
          time                : paradeTime  || null,
          place               : place.trim() || null,
          categories          : activeCats,
          parade_type_map     : typeMap,
          status              : "active",
          created_by          : user.id,
          parade_instructions : instructions.trim() || null,
        })
        .select("id")
        .single();

      if (err) throw new Error(err.message);
      const newParadeId = newParade.id;

      // ── STEP 2: Delete old notifications + clear stale pending permissions ──
      await supabase
        .from("parade_notifications")
        .delete()
        .neq("parade_id", newParadeId);

      // Clear unanswered permission requests from previous parades
      await supabase
        .from("permissions")
        .delete()
        .neq("parade_id", newParadeId)
        .eq("status", "pending");

      // ── STEP 3: Fetch users to notify ───────────────────────
      // Seniors — always notified
      const { data: seniors } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("role", "senior");

      // All cadet profiles — they are already linked to cadets via cadet_id
      // We skip the .in() on activeCadetIds to avoid Supabase's 100-item limit.
      // Instead fetch all cadet profiles and let the FK relationship handle it.
      const { data: cadetProfiles } = await supabase
        .from("profiles")
        .select("id, role, cadet_id")
        .eq("role", "cadet");

      // Filter to only active cadets by cross-checking cadet_id
      const { data: activeCadetRows } = await supabase
        .from("cadets")
        .select("id")
        .eq("is_active", true);
      const activeCadetIdSet = new Set((activeCadetRows || []).map(c => c.id));

      const filteredCadetProfiles = (cadetProfiles || [])
        .filter(p => p.cadet_id && activeCadetIdSet.has(p.cadet_id));

      const allUsers = [...(seniors || []), ...filteredCadetProfiles];

      // ── STEP 4: Insert notifications ────────────────────────
      if (allUsers.length > 0) {
        const notifRows = allUsers.map(u => ({
          parade_id    : newParadeId,
          user_id      : u.id,
          role         : u.role,
          acknowledged : false,
        }));

        const { error: nErr } = await supabase
          .from("parade_notifications")
          .insert(notifRows);

        if (nErr) throw new Error(`Notification insert failed: ${nErr.message}`);
      }

      // ── STEP 5: Update UI ────────────────────────────────────
      setSuccess({
        paradeId        : newParadeId,
        parade_date     : paradeDate,
        session,
        paradeTime,
        place,
        categories      : activeCats,
        parade_type_map : typeMap,
        notified        : allUsers.length,
      });
      if (onParadeCreated) onParadeCreated();

    } catch (e) {
      setError(e.message || "Failed to create parade. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (initialChecking) return (
    <div><Skeleton height={120} /><Skeleton height={160} /><Skeleton height={80} /></div>
  );

  /* ── Blocked card ── */
  if (blocked) return (
    <div className="pd-card pd-card--amber">
      <p className="pd-label" style={{ color: "var(--csi-amber)" }}>⚠ Active Parade Exists</p>
      <p style={{ fontSize: "0.82rem", color: "var(--csi-text-sub)", marginBottom: "1rem", lineHeight: 1.6 }}>
        A parade is already active. Close it before creating a new one.
      </p>

      {[
        { k: "Date",    v: blocked.parade_date },
        { k: "Session", v: blocked.session?.charAt(0).toUpperCase() + blocked.session?.slice(1) },
        { k: "Status",  v: blocked.status?.replace("_", " ").toUpperCase() },
      ].map(({ k, v }) => (
        <div key={k} className="pd-meta-row">
          <span className="pd-meta-key">{k}</span>
          <span className="pd-meta-val">{v ?? "—"}</span>
        </div>
      ))}

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button className="pd-btn-ghost"
          onClick={async () => {
            setBlocked(null); setInitialChecking(true);
            const { data } = await supabase.from("parades").select("id, parade_date, session, status")
              .in("status", ["active", "attendance_submitted"]).limit(1).maybeSingle();
            setBlocked(data || null); setInitialChecking(false);
          }}>
          Re-check status
        </button>

        {blocked.status === "active" && (
          <button
            className="pd-btn-danger"
            style={{ fontSize: "0.75rem", padding: "0.45rem 1rem" }}
            onClick={() => { setCancelMode(true); setCancelError(null); setCancelReason(""); }}>
            ✕ Cancel Parade
          </button>
        )}
      </div>

      {cancelMode && (
        <div className="pd-modal-overlay"
          onClick={() => { if (!cancelling) { setCancelMode(false); setCancelReason(""); } }}>
          <div className="pd-modal" onClick={e => e.stopPropagation()}>
            <h3>Cancel Parade</h3>
            <p>
              Cancel the <strong>{blocked.parade_date}</strong> ({blocked.session}) parade?
              This cannot be undone. Mention the reason so it is recorded.
            </p>
            {cancelError && <Alert type="error">{cancelError}</Alert>}
            <label className="pd-field-label" style={{ display: "block", marginBottom: "0.4rem" }}>
              Reason for Cancellation <span style={{ color: "var(--csi-red)" }}>*</span>
            </label>
            <textarea
              className="pd-textarea"
              placeholder="e.g. Heavy rain forecast — parade ground waterlogged. Rescheduled to tomorrow morning session."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              disabled={cancelling}
              style={{ marginBottom: "1.1rem" }}
            />
            <div className="pd-modal-actions">
              <button className="pd-btn-ghost" disabled={cancelling}
                onClick={() => { setCancelMode(false); setCancelReason(""); }}>
                Go Back
              </button>
              <button className="pd-btn-danger" onClick={handleCancelParade} disabled={cancelling || !cancelReason.trim()}>
                {cancelling
                  ? <><div className="pd-spinner" />Cancelling…</>
                  : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Success: ack tracker ── */
  if (success) return <AckTracker success={success} onCancelled={() => { setSuccess(null); }} onReset={() => {
    setSuccess(null); setSession(""); setInstructions(""); setParadeTime(""); setPlace("");
    setSelectedCats({ A: true, B: true, C: true }); setParadeDate(today);
  }} />;

  /* ── Main form ── */
  return (
    <div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="pd-card">
        <p className="pd-label">Schedule</p>
        <div className="pd-field">
          <label className="pd-field-label">Parade Date</label>
          <input type="date" className="pd-input" value={paradeDate} min={today}
            onChange={e => setParadeDate(e.target.value)} />
        </div>
        <div className="pd-field" style={{ marginBottom: 0 }}>
          <label className="pd-field-label">Session</label>
          <div className="pd-session-row">
            {SESSION_OPTIONS.map(({ val, label, icon }) => (
              <button key={val}
                className={`pd-session-btn${session === val ? " pd-session-btn--on" : ""}`}
                onClick={() => {
                  setSession(val);
                  if (!paradeTime) {
                    if (val === "morning")   setParadeTime("06:00");
                    if (val === "afternoon") setParadeTime("12:00");
                    if (val === "evening")   setParadeTime("17:00");
                  }
                }}>
                <span style={{ fontSize: "1.1rem" }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "1rem" }}>
          <div className="pd-field" style={{ marginBottom: 0 }}>
            <label className="pd-field-label">Time</label>
            <input type="time" className="pd-input" value={paradeTime}
              onChange={e => setParadeTime(e.target.value)}
              style={{ colorScheme: "dark" }} />
          </div>
          <div className="pd-field" style={{ marginBottom: 0 }}>
            <label className="pd-field-label">Place</label>
            <input type="text" className="pd-input" value={place}
              placeholder="e.g. Parade Ground"
              onChange={e => setPlace(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="pd-card">
        <p className="pd-label">Categories &amp; Parade Types
          <span style={{ color: "var(--csi-text-muted)", fontWeight: 400, marginLeft: "0.5rem" }}>— {activeCats.length} selected</span>
        </p>
        <div className="pd-cat-grid">
          {["A", "B", "C"].map(cat => {
            const on  = selectedCats[cat];
            const col = CAT_COLORS[cat];
            return (
              <div key={cat} className="pd-cat-card"
                style={on ? { background: col.bg, borderColor: col.border, borderWidth: "1.5px" } : {}}
                onClick={() => setSelectedCats(p => ({ ...p, [cat]: !p[cat] }))}>
                <span className="pd-cat-badge" style={{ color: on ? col.accent : "var(--csi-text-muted)" }}>{on ? "✓" : "—"}</span>
                <div className="pd-cat-letter" style={{ color: on ? col.accent : "var(--csi-text-muted)" }}>{cat}</div>
                <div style={{ ...MONO, fontSize: "0.56rem", color: on ? col.accent : "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>Category</div>
                <select className="pd-cat-select" value={paradeTypes[cat]} disabled={!on}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setParadeTypes(p => ({ ...p, [cat]: e.target.value }))}
                  style={on ? { borderColor: col.border } : {}}>
                  {PARADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pd-card">
        <p className="pd-label">Parade Instructions <span style={{ color: "var(--csi-text-muted)", fontWeight: 400 }}>(optional — instructions to seniors before parade)</span></p>
        <textarea className="pd-textarea"
          placeholder="e.g. Carry ID cards. Reporting time 8:00 AM sharp."
          value={instructions} onChange={e => setInstructions(e.target.value)} />
      </div>
      {session && activeCats.length > 0 && (
        <div className="pd-card pd-card--dash" style={{ animationDelay: ".25s" }}>
          <p className="pd-label">Preview</p>
          {[
            { k: "Date",       v: paradeDate },
            { k: "Session",    v: session.charAt(0).toUpperCase() + session.slice(1) },
            { k: "Time",       v: paradeTime || "—" },
            { k: "Place",      v: place      || "—" },
            { k: "Categories", v: activeCats.join(", ") },
            ...activeCats.map(c => ({ k: `Cat ${c} Activity`, v: paradeTypes[c], color: CAT_COLORS[c]?.accent })),
          ].map(({ k, v, color }) => (
            <div key={k} className="pd-meta-row">
              <span className="pd-meta-key">{k}</span>
              <span className="pd-meta-val" style={color ? { color } : {}}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <button className="pd-btn-primary pd-btn-primary--full"
        onClick={handleCreate}
        disabled={loading || !session || activeCats.length === 0}>
        {loading ? <><div className="pd-spinner" />Creating Parade…</> : "⚡ Create Parade & Notify"}
      </button>
    </div>
  );
}

/* ═══ TAB 2 — PERMISSIONS ═══ */
function TabPermissions() {
  const [parade,      setParade]      = useState(null);
  const [cadets,      setCadets]      = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [editing,     setEditing]     = useState({});
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [noParade,    setNoParade]    = useState(false);
  const [error,       setError]       = useState(null);
  const [catFilter,   setCatFilter]   = useState("ALL");
  const [divFilter,   setDivFilter]   = useState("ALL");
  const [search,      setSearch]      = useState("");
  const [view,        setView]        = useState("requests"); // "requests" | "all"
  const [responding,  setResponding]  = useState(null); // { permId, mode: 'approve'|'reject', note }
  const editorRef = useRef(null);
  const locked = parade?.status !== "active";

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("parades").select("*")
        .in("status", ["active", "attendance_submitted"]).maybeSingle();
      if (!data) { setNoParade(true); setLoading(false); return; }
      setParade(data);
    }
    load();
  }, []);

  useEffect(() => {
    if (!parade) return;
    async function loadData() {
      setLoading(true);
      const { data: c } = await supabase.from("cadets").select("*")
        .eq("is_active", true).in("category", parade.categories).order("enrollment_no");
      const { data: p } = await supabase.from("permissions").select("*, cadets(name, rank, enrollment_no, category, division)")
        .eq("parade_id", parade.id);
      setCadets(c || []); setPermissions(p || []); setLoading(false);
    }
    loadData();
  }, [parade]);

  useEffect(() => {
    function outside(e) { if (editorRef.current && !editorRef.current.contains(e.target)) setEditing({}); }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const cadetRequests = useMemo(() =>
    permissions.filter(p => p.status === "pending" || p.requested_by),
    [permissions]);

  const filtered = useMemo(() => cadets
    .filter(c => catFilter === "ALL" || c.category === catFilter)
    .filter(c => divFilter === "ALL" || c.division === divFilter)
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ap = permissions.some(p => p.cadet_id === a.id);
      const bp = permissions.some(p => p.cadet_id === b.id);
      if (ap && !bp) return -1; if (!ap && bp) return 1;
      return a.enrollment_no.localeCompare(b.enrollment_no);
    }), [cadets, permissions, catFilter, divFilter, search]);

  const getPerm   = id => permissions.find(p => p.cadet_id === id && p.status === "approved");
  const permCount = filtered.filter(c => getPerm(c.id)).length;
  const pendingCount = cadetRequests.filter(p => p.status === "pending").length;

  async function reloadPerms() {
    const { data } = await supabase.from("permissions")
      .select("*, cadets(name, rank, enrollment_no, category, division)")
      .eq("parade_id", parade.id);
    setPermissions(data || []);
  }

  // ANO: multi-day modal state
  const [multiModal, setMultiModal] = useState(null);

  // ANO: single parade permission
  async function grantSingle(cadet) {
    if (locked) { setError("Permissions locked."); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("permissions").upsert({
      parade_id: parade.id, cadet_id: cadet.id,
      reason: "ANO Permission",
      from_date: parade.parade_date, to_date: parade.parade_date,
      to_session: parade.session, status: "approved",
    });
    if (err) { setError(err.message); setSaving(false); return; }
    await reloadPerms(); setSaving(false);
  }
  // ANO: open multi-day modal
  function openMulti(cadet) {
    if (locked) { setError("Permissions locked."); return; }
    const ex = getPerm(cadet.id);
    setMultiModal({ cadetId: cadet.id, cadetName: cadet.name,
      fromDate: ex?.from_date || parade.parade_date, fromSession: ex?.to_session || parade.session,
      toDate: ex?.to_date || parade.parade_date, toSession: ex?.to_session || parade.session });
    setError(null);
  }
  async function saveMultiPerm() {
    if (!multiModal.fromDate || !multiModal.fromSession || !multiModal.toDate || !multiModal.toSession) {
      setError("Fill all date and session fields."); return;
    }
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("permissions").upsert({
      parade_id: parade.id, cadet_id: multiModal.cadetId,
      reason: "ANO Multi-day Permission",
      from_date: multiModal.fromDate, to_date: multiModal.toDate,
      to_session: multiModal.toSession, status: "approved",
    });
    if (err) { setError(err.message); setSaving(false); return; }
    await reloadPerms(); setMultiModal(null); setSaving(false);
  }
  async function deletePerm(cadetId) {
    setSaving(true);
    const { error: err } = await supabase.from("permissions").delete()
      .eq("parade_id", parade.id).eq("cadet_id", cadetId);
    if (err) { setError(err.message); setSaving(false); return; }
    await reloadPerms(); setSaving(false);
  }

  // Approve / reject cadet request
  async function handleRespond(perm, approved) {
    if (!responding) return;
    setSaving(true); setError(null);
    const anoUser = (await supabase.auth.getUser()).data.user;

    const { error: err } = await supabase.from("permissions")
      .update({ status: approved ? "approved" : "rejected", ano_note: responding.note?.trim() || null })
      .eq("id", perm.id);
    if (err) { setError(err.message); setSaving(false); return; }

    // Send system notification to cadet
    if (perm.requested_by) {
      await supabase.from("system_notifications").insert({
        user_id : perm.requested_by,
        type    : approved ? "permission_approved" : "permission_rejected",
        title   : approved ? "✓ Permission Approved" : "✕ Permission Declined",
        body    : approved
          ? `Your permission request for ${parade.parade_date} (${perm.from_date}–${perm.to_date}) has been approved.`
          : `Your permission request for ${parade.parade_date} has been declined.`,
        meta    : { permission_id: perm.id, parade_date: parade.parade_date, ano_note: responding.note?.trim() || null },
      });
    }

    await reloadPerms();
    setResponding(null); setSaving(false);
  }

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  if (loading) return <div><Skeleton height={60} /><Skeleton height={300} /><Skeleton height={60} /></div>;
  if (noParade) return (
    <div className="pd-card">
      <div className="pd-no-parade">
        <div className="pd-no-parade-icon">🪖</div>
        <p style={{ ...SYNE, fontSize: "1rem", fontWeight: 700, color: "var(--csi-text-primary)", margin: "0 0 0.35rem" }}>No Active Parade</p>
        <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)" }}>Create a parade first to manage permissions.</p>
      </div>
    </div>
  );

  return (
    <div>
      {locked && <div className="pd-locked">🔒 Permissions are locked — attendance has been submitted.</div>}

      {/* Parade info */}
      <div className="pd-card" style={{ marginBottom: "0.9rem" }}>
        <p className="pd-label">Active Parade</p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {[
            { k: "Date",       v: parade.parade_date },
            { k: "Session",    v: parade.session?.charAt(0).toUpperCase() + parade.session?.slice(1) },
            { k: "Categories", v: parade.categories?.join(", ") },
          ].map(({ k, v }) => (
            <div key={k}>
              <div className="pd-meta-key" style={{ marginBottom: "0.15rem" }}>{k}</div>
              <div style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-primary)", fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* View toggle */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.9rem" }}>
        <button className={`pd-pill${view === "requests" ? " pd-pill--on" : ""}`} onClick={() => setView("requests")} style={{ position: "relative" }}>
          Cadet Requests
          {pendingCount > 0 && (
            <span style={{ ...MONO, fontSize: "0.52rem", background: "var(--csi-amber)", color: "#000", borderRadius: "99px", padding: "1px 5px", marginLeft: "0.4rem", fontWeight: 700 }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button className={`pd-pill${view === "all" ? " pd-pill--on" : ""}`} onClick={() => setView("all")}>
          All Permissions
        </button>
      </div>

      {/* ── VIEW: CADET REQUESTS ── */}
      {view === "requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {cadetRequests.length === 0 ? (
            <div className="pd-card" style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ ...MONO, fontSize: "0.75rem", color: "var(--csi-text-muted)" }}>No cadet permission requests for this parade</div>
            </div>
          ) : cadetRequests.map(perm => {
            const c = perm.cadets;
            const isPending  = perm.status === "pending";
            const isApproved = perm.status === "approved";
            const isResponding = responding?.permId === perm.id;
            const statusColor = isApproved ? "var(--csi-green)" : perm.status === "rejected" ? "var(--csi-red)" : "var(--csi-amber)";
            return (
              <div key={perm.id} className="pd-card" style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: statusColor }}>
                {/* Cadet info + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ ...MONO, fontSize: "0.8rem", fontWeight: 700, color: "var(--csi-text-primary)" }}>
                      {c?.rank} {c?.name}
                    </div>
                    <div style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", marginTop: "0.15rem" }}>
                      {c?.enrollment_no} · Cat {c?.category} · {c?.division}
                    </div>
                  </div>
                  <span style={{ ...MONO, fontSize: "0.58rem", padding: "3px 9px", borderRadius: 4, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}`, fontWeight: 700, flexShrink: 0 }}>
                    {perm.status?.toUpperCase()}
                  </span>
                </div>

                {/* Description */}
                <div style={{ background: "var(--csi-bg-input)", borderRadius: 6, padding: "0.6rem 0.75rem", marginBottom: "0.65rem" }}>
                  <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.3rem" }}>Reason</div>
                  <div style={{ ...MONO, fontSize: "0.75rem", color: "var(--csi-text-primary)", lineHeight: 1.5 }}>
                    {perm.description || perm.reason || "—"}
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>From</div>
                    <div style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)", fontWeight: 600 }}>{fmtDate(perm.from_date)}</div>
                  </div>
                  <div>
                    <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>To</div>
                    <div style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)", fontWeight: 600 }}>{fmtDate(perm.to_date)}</div>
                  </div>
                  <div>
                    <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>Requested</div>
                    <div style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)" }}>{fmtDate(perm.created_at)}</div>
                  </div>
                </div>

                {/* ANO note if already responded */}
                {perm.ano_note && !isResponding && (
                  <div style={{ ...MONO, fontSize: "0.67rem", color: "var(--csi-text-muted)", fontStyle: "italic", marginBottom: "0.5rem" }}>
                    Your note: {perm.ano_note}
                  </div>
                )}

                {/* Respond panel */}
                {isPending && !locked && (
                  isResponding ? (
                    <div style={{ borderTop: "1px solid var(--csi-border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>
                        {responding.mode === "approve" ? "✓ Approving" : "✕ Declining"} — Note (optional)
                      </div>
                      <textarea
                        placeholder={responding.mode === "approve" ? "Add an approval note…" : "Give a reason for declining…"}
                        value={responding.note || ""}
                        onChange={e => setResponding(r => ({ ...r, note: e.target.value }))}
                        rows={2}
                        style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border)", borderRadius: 6, padding: "0.5rem 0.65rem", ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)", resize: "vertical", outline: "none", width: "100%", boxSizing: "border-box" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button onClick={() => handleRespond(perm, responding.mode === "approve")} disabled={saving}
                          style={{ flex: 1, padding: "0.55rem", background: responding.mode === "approve" ? "var(--csi-green)" : "var(--csi-red)", border: "none", borderRadius: 6, color: "#000", ...MONO, fontSize: "0.7rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                          {saving ? "Saving…" : responding.mode === "approve" ? "✓ Confirm Approve" : "✕ Confirm Decline"}
                        </button>
                        <button onClick={() => setResponding(null)} style={{ padding: "0.55rem 0.9rem", background: "transparent", border: "1px solid var(--csi-border)", borderRadius: 6, color: "var(--csi-text-muted)", ...MONO, fontSize: "0.7rem", cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--csi-border)", paddingTop: "0.75rem" }}>
                      <button onClick={() => setResponding({ permId: perm.id, mode: "approve", note: "" })}
                        style={{ flex: 1, padding: "0.5rem", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 6, color: "var(--csi-green)", ...MONO, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => setResponding({ permId: perm.id, mode: "reject", note: "" })}
                        style={{ flex: 1, padding: "0.5rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "var(--csi-red)", ...MONO, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}>
                        ✕ Decline
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── VIEW: ALL PERMISSIONS (ANO managed) ── */}
      {view === "all" && (
        <div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.75rem" }}>
            {["ALL", "A", "B", "C"].map(v => (
              <button key={v} className={`pd-pill${catFilter === v ? " pd-pill--on" : ""}`} onClick={() => setCatFilter(v)}>Cat {v === "ALL" ? "All" : v}</button>
            ))}
            <span style={{ color: "var(--csi-border-input)" }}>│</span>
            {["ALL", "SD", "SW"].map(v => (
              <button key={v} className={`pd-pill${divFilter === v ? " pd-pill--on" : ""}`} onClick={() => setDivFilter(v)}>{v === "ALL" ? "All Div" : v}</button>
            ))}
            <input className="pd-search" placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", marginLeft: "auto" }}>{filtered.length} cadets · {permCount} approved</span>
          </div>
          <div className="pd-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="pd-table">
              <thead><tr><th>#</th><th>Enrollment</th><th>Rank</th><th>Name</th><th>Cat</th><th>Div</th><th>Permission</th></tr></thead>
              <tbody>
                {filtered.map((cadet, idx) => {
                  const perm = getPerm(cadet.id);
                  const isEditing = editing.cadetId === cadet.id;
                  return (
                    <tr key={cadet.id}>
                      <td style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)" }}>{idx + 1}</td>
                      <td style={{ ...MONO, fontSize: "0.68rem", color: "var(--csi-text-sub)" }}>{cadet.enrollment_no}</td>
                      <td style={{ ...MONO, fontSize: "0.7rem" }}>{cadet.rank}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.82rem" }}>{cadet.name}</td>
                      <td><span className="pd-badge" style={{ background: CAT_COLORS[cadet.category]?.bg, color: CAT_COLORS[cadet.category]?.accent, border: `1px solid ${CAT_COLORS[cadet.category]?.border}` }}>{cadet.category}</span></td>
                      <td style={{ ...MONO, fontSize: "0.7rem", color: "var(--csi-text-sub)" }}>{cadet.division}</td>
                      <td>
                        {perm ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                            <span className="pd-perm-chip">
                              ✓ {perm.from_date === perm.to_date ? perm.from_date : `${perm.from_date} → ${perm.to_date}`}
                            </span>
                            <button className="pd-btn-icon pd-btn-icon--del" style={{ fontSize: "0.6rem", padding: "0.15rem 0.4rem" }}
                              onClick={() => deletePerm(cadet.id)} disabled={saving || locked}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button className="pd-perm-add" disabled={locked || saving}
                              onClick={() => grantSingle(cadet)}>+ Grant</button>
                            <button className="pd-btn-ghost" style={{ fontSize: "0.6rem", padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}
                              disabled={locked} onClick={() => openMulti(cadet)}>📅</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ANO Multi-day Modal ── */}
      {multiModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-border)", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ ...SYNE, fontSize: "0.9rem", fontWeight: 700, color: "var(--csi-text-primary)" }}>
              📅 Multi-day Permission
            </div>
            <div style={{ ...MONO, fontSize: "0.68rem", color: "var(--csi-text-muted)" }}>
              {multiModal.cadetName}
            </div>
            {error && <div style={{ ...MONO, fontSize: "0.7rem", color: "var(--csi-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "0.45rem 0.7rem" }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>From Date</div>
                <input type="date" value={multiModal.fromDate} min={parade.parade_date}
                  onChange={e => setMultiModal(m => ({ ...m, fromDate: e.target.value }))}
                  style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border)", borderRadius: 6, padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.75rem", color: "var(--csi-text-primary)", outline: "none" }} />
                <select value={multiModal.fromSession}
                  onChange={e => setMultiModal(m => ({ ...m, fromSession: e.target.value }))}
                  style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border)", borderRadius: 6, padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.75rem", color: "var(--csi-text-primary)", outline: "none" }}>
                  <option value="">Session…</option>
                  {["morning","afternoon","evening"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>To Date</div>
                <input type="date" value={multiModal.toDate} min={multiModal.fromDate || parade.parade_date}
                  onChange={e => setMultiModal(m => ({ ...m, toDate: e.target.value }))}
                  style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border)", borderRadius: 6, padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.75rem", color: "var(--csi-text-primary)", outline: "none" }} />
                <select value={multiModal.toSession}
                  onChange={e => setMultiModal(m => ({ ...m, toSession: e.target.value }))}
                  style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border)", borderRadius: 6, padding: "0.45rem 0.6rem", ...MONO, fontSize: "0.75rem", color: "var(--csi-text-primary)", outline: "none" }}>
                  <option value="">Session…</option>
                  {["morning","afternoon","evening"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button onClick={saveMultiPerm} disabled={saving}
                style={{ flex: 1, padding: "0.65rem", background: "var(--csi-indigo)", border: "none", borderRadius: 6, color: "#fff", ...SYNE, fontSize: "0.78rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "✓ Save Permission"}
              </button>
              <button onClick={() => { setMultiModal(null); setError(null); }}
                style={{ padding: "0.65rem 1rem", background: "transparent", border: "1px solid var(--csi-border)", borderRadius: 6, color: "var(--csi-text-muted)", ...MONO, fontSize: "0.72rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ TAB 3 — REVIEW & CLOSE ═══ */
function TabReview() {
  const [parade,       setParade]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [noParade,     setNoParade]     = useState(false);
  const [cadets,       setCadets]       = useState([]);
  const [attendance,   setAttendance]   = useState([]);
  const [rankSummary,  setRankSummary]  = useState({});
  const [pendingSlots, setPendingSlots] = useState([]);
  const [reports,      setReports]      = useState({});
  const [openReport,   setOpenReport]   = useState(null);
  const [remarks,      setRemarks]      = useState("");
  const [refreshments, setRefreshments] = useState(false);
  const [catFilter,    setCatFilter]    = useState("ALL");
  const [divFilter,    setDivFilter]    = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notifying,    setNotifying]    = useState(false);
  const [notified,     setNotified]     = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [closing,      setClosing]      = useState(false);
  const [error,        setError]        = useState(null);
  const [closed,       setClosed]       = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("parades").select("*").eq("status", "attendance_submitted").maybeSingle();
      if (!data) { setNoParade(true); setLoading(false); return; }
      setParade(data); setRemarks(data.ano_remarks || ""); setRefreshments(data.refreshments_given || false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!parade) return;
    async function loadData() {
      setLoading(true);
      const { data: c } = await supabase.from("cadets").select("id, enrollment_no, name, rank, category, division").eq("is_active", true).in("category", parade.categories);
      const { data: a } = await supabase.from("attendance").select("cadet_id, status").eq("parade_id", parade.id);
      setCadets(c || []); setAttendance(a || []); setLoading(false);
    }
    loadData();
  }, [parade]);

  useEffect(() => {
    const s = {};
    cadets.forEach(c => { if (!s[c.rank]) s[c.rank] = { total: 0, present: 0 }; s[c.rank].total++; });
    attendance.forEach(a => { if (a.status === "present") { const c = cadets.find(x => x.id === a.cadet_id); if (c) s[c.rank].present++; } });
    setRankSummary(s);
  }, [cadets, attendance]);

  useEffect(() => {
    const slots = [];
    ["A", "B", "C"].forEach(cat => {
      ["SD", "SW"].forEach(div => {
        const scope = cadets.filter(c => c.category === cat && c.division === div);
        if (scope.length === 0) return;
        if (!attendance.some(a => scope.some(c => c.id === a.cadet_id))) slots.push({ category: cat, division: div });
      });
    });
    setPendingSlots(slots);
  }, [cadets, attendance]);

  useEffect(() => {
    if (!parade) return;
    async function loadReports() {
      const { data } = await supabase.from("parade_reports").select("category, division, report_text, updated_at").eq("parade_id", parade.id);
      const map = {};
      (data || []).forEach(r => { if (!map[r.category]) map[r.category] = []; map[r.category].push(r); });
      setReports(map);
    }
    loadReports();
  }, [parade]);

  const { presentCadets, permCadets, absentCadets, filteredCadets } = useMemo(() => {
    const fc = cadets.filter(c => (catFilter === "ALL" || c.category === catFilter) && (divFilter === "ALL" || c.division === divFilter));
    const present = [], perm = [], absent = [];
    fc.forEach(c => {
      const rec = attendance.find(a => a.cadet_id === c.id);
      if (rec?.status === "present") present.push(c);
      else if (rec?.status === "absent_with_permission") perm.push(c);
      else absent.push(c);
    });
    return { presentCadets: present, permCadets: perm, absentCadets: absent, filteredCadets: fc };
  }, [cadets, attendance, catFilter, divFilter]);

  function percent(count) {
    if (filteredCadets.length === 0) return "0.0";
    return ((count / filteredCadets.length) * 100).toFixed(1);
  }

  async function informSeniors() {
    if (pendingSlots.length === 0) return;
    setNotifying(true);
    const notifRows = [];
    for (const slot of pendingSlots) {
      const { data: seniorProfiles } = await supabase.from("profiles").select("id").eq("role", "senior").eq("assigned_division", slot.division);
      if (seniorProfiles && seniorProfiles.length > 0) {
        seniorProfiles.forEach(s => { notifRows.push({ parade_id: parade.id, user_id: s.id, type: "pending", target_role: "senior", message: `Attendance for Category ${slot.category} – ${slot.division} is pending. Submit immediately.` }); });
      } else {
        notifRows.push({ parade_id: parade.id, type: "pending", target_role: "senior", message: `Attendance for Category ${slot.category} – ${slot.division} is pending (no senior assigned).` });
      }
    }
    if (notifRows.length > 0) await supabase.from("notifications").insert(notifRows);
    setNotifying(false); setNotified(true); setTimeout(() => setNotified(false), 5000);
  }

  async function handleClose() {
    setClosing(true); setError(null);
    await supabase.from("parades").update({ ano_remarks: remarks, refreshments_given: refreshments }).eq("id", parade.id);
    const user = (await supabase.auth.getUser()).data.user;
    const { error: err } = await supabase.rpc("close_parade", { p_actor_id: user.id, p_parade_id: parade.id });
    if (err) {
      if (err.message.includes("attendance_pending")) setError("Cannot close — attendance is still pending for some categories.");
      else if (err.message.includes("parade_not_ready")) setError("Parade is not ready to be closed.");
      else setError(err.message);
      setClosing(false); setClosingModal(false); return;
    }
    setClosing(false); setClosingModal(false); setClosed(true);
  }

  if (loading) return <div><Skeleton height={80} /><Skeleton height={200} /><Skeleton height={120} /></div>;
  if (noParade) return (
    <div className="pd-card">
      <div className="pd-no-parade">
        <div className="pd-no-parade-icon">📋</div>
        <p style={{ ...SYNE, fontSize: "1rem", fontWeight: 700, color: "var(--csi-text-primary)", margin: "0 0 0.35rem" }}>No Parade Ready for Review</p>
        <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)" }}>Parade review is available once seniors have submitted attendance.</p>
      </div>
    </div>
  );
  if (closed) return (
    <div className="pd-card pd-card--green" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
      <div className="pd-success-icon">🎖</div>
      <p style={{ ...SYNE, fontSize: "1.2rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: "0 0 0.35rem" }}>Parade Closed</p>
      <p style={{ ...MONO, fontSize: "0.7rem", color: "var(--csi-text-muted)" }}>All records have been locked permanently.</p>
    </div>
  );

  const displayPresent = statusFilter === "ALL" || statusFilter === "PRESENT";
  const displayPerm    = statusFilter === "ALL" || statusFilter === "PERMISSION";
  const displayAbsent  = statusFilter === "ALL" || statusFilter === "ABSENT";

  return (
    <div>
      {error && <Alert type="error">{error}</Alert>}
      <div className="pd-card" style={{ marginBottom: "0.9rem" }}>
        <p className="pd-label">Parade Under Review</p>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {[{ k: "Date", v: parade.parade_date }, { k: "Session", v: parade.session?.charAt(0).toUpperCase() + parade.session?.slice(1) }, { k: "Categories", v: parade.categories?.join(", ") }].map(({ k, v }) => (
            <div key={k}>
              <div className="pd-meta-key" style={{ marginBottom: "0.15rem" }}>{k}</div>
              <div style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-primary)", fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {pendingSlots.length > 0 && (
        <div className="pd-card pd-card--amber" style={{ marginBottom: "0.9rem" }}>
          <p className="pd-label" style={{ color: "var(--csi-amber)" }}>⚠ Attendance Pending</p>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            {pendingSlots.map((s, i) => <span key={i} className="pd-badge pd-badge--absent">Cat {s.category} – {s.division}</span>)}
          </div>
          {notified
            ? <Alert type="info">Seniors have been notified.</Alert>
            : <button className="pd-btn-ghost" onClick={informSeniors} disabled={notifying}>
                {notifying ? <><div className="pd-spinner pd-spinner--sm" style={{ borderTopColor: "var(--csi-amber)" }} />Notifying…</> : "📢 Inform Seniors"}
              </button>
          }
        </div>
      )}
      <div className="pd-card">
        <p className="pd-label">Rank Summary</p>
        <div style={{ overflowX: "auto" }}>
          <table className="pd-rank-table">
            <thead><tr><th>—</th>{RANK_ORDER.map(r => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              <tr><td>Total</td>{RANK_ORDER.map(r => <td key={r}>{rankSummary[r]?.total || 0}</td>)}</tr>
              <tr><td>Present</td>{RANK_ORDER.map(r => <td key={r} style={{ color: rankSummary[r]?.present ? "var(--csi-green)" : "var(--csi-text-muted)" }}>{rankSummary[r]?.present || 0}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="pd-card">
        <p className="pd-label">Category Reports</p>
        {["A", "B", "C"].map(cat => {
          const rows = reports[cat] || []; const hasAny = rows.length > 0; const col = CAT_COLORS[cat];
          const sharedRow = rows.find(r => r.division === "SHARED");
          const sdRow     = rows.find(r => r.division === "SD");
          const swRow     = rows.find(r => r.division === "SW");
          const preview   = (sharedRow || sdRow || swRow)?.report_text || "";
          return (
            <div key={cat} className={`pd-report-card${!hasAny ? " pd-report-card--missing" : ""}`} onClick={() => hasAny && setOpenReport(cat)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: hasAny ? "0.4rem" : 0 }}>
                <span style={{ ...MONO, fontSize: "0.68rem", fontWeight: 700, color: col.accent }}>Category {cat}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {!hasAny && <span className="pd-badge pd-badge--absent">Missing</span>}
                  {sharedRow && <span className="pd-badge pd-badge--present">Shared</span>}
                  {sdRow     && <span className="pd-badge pd-badge--present">SD</span>}
                  {swRow     && <span className="pd-badge pd-badge--present">SW</span>}
                </div>
              </div>
              {hasAny && <p style={{ fontSize: "0.78rem", color: "var(--csi-text-sub)", margin: "0.2rem 0 0", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{preview}</p>}
              {hasAny && <p style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)", margin: "0.3rem 0 0" }}>{rows.length} report{rows.length > 1 ? "s" : ""} submitted</p>}
            </div>
          );
        })}
      </div>
      {openReport && (() => {
        const rows = reports[openReport] || [];
        const sharedRow = rows.find(r => r.division === "SHARED");
        const sdRow     = rows.find(r => r.division === "SD");
        const swRow     = rows.find(r => r.division === "SW");
        const divRows   = [sdRow, swRow].filter(Boolean);
        return (
          <div className="pd-modal-overlay" onClick={() => setOpenReport(null)}>
            <div className="pd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "85vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>Category {openReport} Report{rows.length > 1 ? "s" : ""}</h3>
                <button className="pd-btn-icon" onClick={() => setOpenReport(null)}>×</button>
              </div>
              {sharedRow && (
                <div style={{ marginBottom: divRows.length ? "1.2rem" : 0 }}>
                  <p style={{ ...MONO, fontSize: "0.62rem", fontWeight: 700, color: "var(--csi-indigo-light)", marginBottom: "0.5rem", textTransform: "uppercase" }}>Shared Report (All Divisions)</p>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.83rem", color: "var(--csi-text-sub)", lineHeight: 1.65, marginBottom: "0.4rem" }}>{sharedRow.report_text}</p>
                  <p style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)" }}>Updated: {new Date(sharedRow.updated_at).toLocaleString()}</p>
                </div>
              )}
              {divRows.map((row, i) => (
                <div key={row.division} style={{ marginTop: i > 0 || sharedRow ? "1.2rem" : 0, paddingTop: i > 0 || sharedRow ? "1.2rem" : 0, borderTop: i > 0 || sharedRow ? "1px solid var(--csi-border)" : "none" }}>
                  <p style={{ ...MONO, fontSize: "0.62rem", fontWeight: 700, color: "var(--csi-green)", marginBottom: "0.5rem", textTransform: "uppercase" }}>{row.division} Division</p>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.83rem", color: "var(--csi-text-sub)", lineHeight: 1.65, marginBottom: "0.4rem" }}>{row.report_text}</p>
                  <p style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)" }}>Updated: {new Date(row.updated_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="pd-card">
        <div className="pd-filter-row">
          {["ALL", "A", "B", "C"].map(v => <button key={v} className={`pd-pill${catFilter === v ? " pd-pill--on" : ""}`} onClick={() => setCatFilter(v)}>Cat {v === "ALL" ? "All" : v}</button>)}
          <span style={{ color: "var(--csi-border-input)" }}>│</span>
          {["ALL", "SD", "SW"].map(v => <button key={v} className={`pd-pill${divFilter === v ? " pd-pill--on" : ""}`} onClick={() => setDivFilter(v)}>{v === "ALL" ? "All Div" : v}</button>)}
          <span style={{ color: "var(--csi-border-input)" }}>│</span>
          {[{ v: "ALL", l: "All" }, { v: "PRESENT", l: "Present" }, { v: "PERMISSION", l: "Permission" }, { v: "ABSENT", l: "Absent" }].map(({ v, l }) => (
            <button key={v} className={`pd-pill${statusFilter === v ? " pd-pill--on" : ""}`} onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="pd-stat-grid">
          {[
            { k: "Total",      v: filteredCadets.length, c: "var(--csi-text-primary)" },
            { k: "Present",    v: `${presentCadets.length} (${percent(presentCadets.length)}%)`, c: "var(--csi-green)" },
            { k: "Permission", v: `${permCadets.length} (${percent(permCadets.length)}%)`,       c: "var(--csi-amber)" },
            { k: "Absent",     v: `${absentCadets.length} (${percent(absentCadets.length)}%)`,   c: "var(--csi-red)"   },
          ].map(({ k, v, c }) => (
            <div key={k} className="pd-stat-box"><p className="pd-stat-key">{k}</p><p className="pd-stat-val" style={{ color: c }}>{v}</p></div>
          ))}
        </div>
      </div>
      {displayPresent && presentCadets.length > 0 && <MiniCadetTable title="Present" cadets={presentCadets} badge="present" />}
      {displayPerm    && permCadets.length    > 0 && <MiniCadetTable title="Absent — With Permission" cadets={permCadets} badge="perm" />}
      {displayAbsent  && absentCadets.length  > 0 && <MiniCadetTable title="Absent — No Permission" cadets={absentCadets} badge="absent" />}
      <div className="pd-card">
        <p className="pd-label">ANO Remarks</p>
        <textarea className="pd-textarea" placeholder="Final remarks for this parade…" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={parade.status === "completed"} />
        <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", marginTop: "0.4rem" }}>Remarks will be locked after closing the parade.</p>
      </div>
      <div className="pd-card">
        <p className="pd-label">Refreshments</p>
        <div className="pd-toggle-row">
          <div>
            <div style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-primary)", fontWeight: 600, marginBottom: "0.15rem" }}>Refreshments Provided</div>
            <div style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)" }}>Were refreshments given to cadets after this parade?</div>
          </div>
          <div className={`pd-toggle-track${refreshments ? " pd-toggle-track--on" : ""}`} onClick={() => setRefreshments(r => !r)}>
            <div className={`pd-toggle-thumb${refreshments ? " pd-toggle-thumb--on" : ""}`} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
        <button className="pd-btn-danger" disabled={pendingSlots.length > 0} onClick={() => setClosingModal(true)}>🔒 Close Parade</button>
      </div>
      {pendingSlots.length > 0 && <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textAlign: "right", marginTop: "0.4rem" }}>Cannot close — attendance still pending</p>}
      {closingModal && (
        <ConfirmModal
          title="Close Parade"
          message="This action is irreversible. Attendance, permissions, and reports will be permanently locked."
          warning="Ensure all category reports are submitted before closing."
          confirmLabel="Close Parade"
          loading={closing}
          onConfirm={handleClose}
          onCancel={() => !closing && setClosingModal(false)}
        />
      )}
    </div>
  );
}

function MiniCadetTable({ title, cadets, badge }) {
  return (
    <div className="pd-card" style={{ marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <p className="pd-label" style={{ margin: 0 }}>{title}</p>
        <span className={`pd-badge pd-badge--${badge}`}>{cadets.length}</span>
      </div>
      <table className="pd-table">
        <thead><tr><th>#</th><th>Enrollment</th><th>Rank</th><th>Name</th><th>Cat</th><th>Div</th></tr></thead>
        <tbody>
          {cadets.map((c, i) => (
            <tr key={c.id}>
              <td style={{ fontSize: "0.62rem", color: "var(--csi-text-muted)" }}>{i + 1}</td>
              <td style={{ fontFamily: "var(--csi-font-mono)", fontSize: "0.68rem", color: "var(--csi-text-sub)" }}>{c.enrollment_no}</td>
              <td style={{ fontFamily: "var(--csi-font-mono)", fontSize: "0.7rem" }}>{c.rank}</td>
              <td style={{ fontWeight: 600, fontSize: "0.82rem" }}>{c.name}</td>
              <td><span className="pd-badge" style={{ background: CAT_COLORS[c.category]?.bg, color: CAT_COLORS[c.category]?.accent, border: `1px solid ${CAT_COLORS[c.category]?.border}` }}>{c.category}</span></td>
              <td style={{ fontFamily: "var(--csi-font-mono)", fontSize: "0.7rem", color: "var(--csi-text-sub)" }}>{c.division}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ParadeControl() {
  const [tab, setTab] = useState("create");
  const TABS = [
    { id: "create",      label: "Create Parade"  },
    { id: "permissions", label: "Permissions"    },
    { id: "review",      label: "Review & Close" },
  ];
  return (
    <>
      <style>{STYLES}</style>
      <div className="pd-page">
        <div className="pd-inner">
          <p className="pd-eyebrow">NCC Unit — ANO Panel</p>
          <h1 className="pd-title">Parade Control</h1>
          <p className="pd-subtitle">Manage the full parade lifecycle — create, permissions, review, and close.</p>
          <div className="pd-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`pd-tab${tab === t.id ? " pd-tab--active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          {tab === "create"      && <TabCreate onParadeCreated={() => {}} />}
          {tab === "permissions" && <TabPermissions />}
          {tab === "review"      && <TabReview />}
        </div>
      </div>
    </>
  );
}
