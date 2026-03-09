import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* ═══════════════════════════════════════════════════════════
   SENIOR FEEDBACK PAGE
   Full-page dashboard: Submit Report + My Reports
   Uses --csi-* tokens for theme consistency
════════════════════════════════════════════════════════════ */

const DASHBOARD_OPTS = ["Senior Dashboard", "Attendance", "Parade Report", "Other"];
const SIGNAL_OPTS    = ["bug", "enhancement", "data_issue", "other"];
const PRIORITY_OPTS  = ["low", "medium", "high"];

const STYLES = `
  .sf-wrap {
    padding: 24px 24px 48px;
    max-width: 680px;
  }

  /* ── header ── */
  .sf-title {
    font-family: var(--csi-font-display, 'Syne', sans-serif);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--csi-text-primary);
    margin: 0 0 4px;
  }
  .sf-sub {
    font-size: 0.78rem;
    color: var(--csi-text-muted);
    margin: 0 0 24px;
    font-family: var(--csi-font-mono, 'JetBrains Mono', monospace);
  }

  /* ── tab bar ── */
  .sf-tabs {
    display: flex;
    gap: 4px;
    background: var(--csi-bg-input);
    border-radius: 9px;
    padding: 3px;
    margin-bottom: 24px;
  }
  .sf-tab {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 7px;
    font-size: 0.8rem;
    font-family: var(--csi-font-body, 'Inter', sans-serif);
    cursor: pointer;
    transition: all 0.15s;
    background: transparent;
    color: var(--csi-text-muted);
    font-weight: 400;
  }
  .sf-tab--active {
    background: var(--csi-bg-card);
    color: var(--csi-text-primary);
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }

  /* ── form fields ── */
  .sf-field { margin-bottom: 14px; }
  .sf-label {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--csi-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-family: var(--csi-font-mono, 'JetBrains Mono', monospace);
    margin-bottom: 6px;
  }
  .sf-input, .sf-select, .sf-textarea {
    width: 100%;
    background: var(--csi-bg-input);
    border: 1px solid var(--csi-border-input);
    border-radius: 7px;
    padding: 9px 12px;
    color: var(--csi-text-primary);
    font-size: 0.82rem;
    font-family: var(--csi-font-body, 'Inter', sans-serif);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .sf-input:focus,
  .sf-select:focus,
  .sf-textarea:focus {
    border-color: var(--csi-border-focus, #6366f1);
  }
  .sf-select {
    appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 11px center;
  }
  .sf-textarea {
    resize: vertical;
    min-height: 110px;
    line-height: 1.6;
  }
  .sf-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 480px) { .sf-row-2 { grid-template-columns: 1fr; } }

  /* ── alert banner ── */
  .sf-alert {
    padding: 10px 14px;
    border-radius: 7px;
    font-size: 0.8rem;
    margin-bottom: 14px;
    border: 1px solid;
  }
  .sf-alert--success {
    background: var(--csi-green-bg, rgba(52,211,153,.12));
    color: var(--csi-green);
    border-color: var(--csi-green-border, rgba(52,211,153,.3));
  }
  .sf-alert--error {
    background: var(--csi-red-bg, rgba(248,113,113,.1));
    color: var(--csi-red);
    border-color: var(--csi-red-border, rgba(248,113,113,.3));
  }

  /* ── submit button ── */
  .sf-submit {
    padding: 10px 24px;
    border: none;
    border-radius: 7px;
    background: var(--csi-indigo);
    color: #fff;
    font-size: 0.83rem;
    font-weight: 600;
    font-family: var(--csi-font-body, 'Inter', sans-serif);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 4px;
  }
  .sf-submit:hover:not(:disabled) { background: var(--csi-indigo-hover, #4338ca); }
  .sf-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── report cards ── */
  .sf-card {
    background: var(--csi-bg-card);
    border: 1px solid var(--csi-border);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
  }
  .sf-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 5px;
  }
  .sf-card-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--csi-text-primary);
    margin: 0;
    line-height: 1.3;
  }
  .sf-badges {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .sf-badge {
    font-size: 0.62rem;
    padding: 2px 7px;
    border-radius: 10px;
    font-family: var(--csi-font-mono, monospace);
    font-weight: 700;
    text-transform: uppercase;
    background: var(--csi-bg-input);
    letter-spacing: 0.03em;
  }
  .sf-badge--open        { color: var(--csi-amber); }
  .sf-badge--acknowledged,
  .sf-badge--in_progress { color: var(--csi-indigo-light, #818cf8); }
  .sf-badge--resolved    { color: var(--csi-green); }
  .sf-badge--dismissed   { color: var(--csi-text-muted); }
  .sf-badge--low         { color: var(--csi-text-muted); }
  .sf-badge--medium      { color: var(--csi-amber); }
  .sf-badge--high        { color: var(--csi-red); }

  .sf-card-meta {
    font-size: 0.72rem;
    color: var(--csi-text-muted);
    margin: 0 0 4px;
    font-family: var(--csi-font-mono, monospace);
  }
  .sf-admin-note {
    margin-top: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    background: var(--csi-bg-input);
    border-left: 2px solid var(--csi-indigo);
    font-size: 0.75rem;
    color: var(--csi-text-sub);
    line-height: 1.5;
  }
  .sf-admin-note-label {
    font-weight: 700;
    color: var(--csi-indigo-light, #818cf8);
    margin-right: 4px;
  }
  .sf-card-date {
    font-size: 0.65rem;
    color: var(--csi-text-muted);
    font-family: var(--csi-font-mono, monospace);
    margin-top: 6px;
    display: block;
  }

  /* ── empty state ── */
  .sf-empty {
    text-align: center;
    padding: 48px 0;
    color: var(--csi-text-muted);
    font-size: 0.82rem;
  }
  .sf-empty-icon { font-size: 2rem; margin-bottom: 8px; display: block; }

  /* ── skeleton ── */
  .sf-skel {
    background: var(--csi-bg-input);
    border-radius: 8px;
    animation: sf-pulse 1.4s ease-in-out infinite;
    margin-bottom: 10px;
  }
  @keyframes sf-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;

export default function SeniorFeedback() {
  const [tab,         setTab]         = useState("submit");
  const [myReports,   setMyReports]   = useState([]);
  const [loading,     setLoading]     = useState(false);

  /* form state */
  const [dashboard,   setDashboard]   = useState("Senior Dashboard");
  const [signalType,  setSignalType]  = useState("bug");
  const [priority,    setPriority]    = useState("medium");
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [alert,       setAlert]       = useState(null); // { type, msg }

  /* load my reports when tab switches */
  useEffect(() => {
    if (tab !== "mine") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("admindesk")
        .select("*")
        .eq("submitted_by", user.id)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setMyReports(data || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tab]);

  async function handleSubmit() {
    if (!title.trim())       { setAlert({ type: "error", msg: "Title is required." }); return; }
    if (!description.trim()) { setAlert({ type: "error", msg: "Description is required." }); return; }

    setSubmitting(true);
    setAlert(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("admindesk").insert({
      submitted_by: user.id,
      role:         "senior",
      dashboard,
      signal_type:  signalType,
      title:        title.trim(),
      description:  description.trim(),
      priority,
      status:       "open",
    });

    setSubmitting(false);

    if (error) {
      setAlert({ type: "error", msg: error.message });
    } else {
      setAlert({ type: "success", msg: "Report submitted. The ANO will review it shortly." });
      setTitle("");
      setDescription("");
      setSignalType("bug");
      setPriority("medium");
      setDashboard("Senior Dashboard");
    }
  }

  function statusBadgeClass(s) {
    return `sf-badge sf-badge--${s.replace(" ", "_")}`;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  return (
    <div className="sf-wrap">
      <style>{STYLES}</style>

      {/* Header */}
      <p className="sf-title">Feedback & Reports</p>
      <p className="sf-sub">Report bugs · Request improvements · Flag data issues</p>

      {/* Tab bar */}
      <div className="sf-tabs">
        <button
          className={`sf-tab${tab === "submit" ? " sf-tab--active" : ""}`}
          onClick={() => setTab("submit")}>
          Submit Report
        </button>
        <button
          className={`sf-tab${tab === "mine" ? " sf-tab--active" : ""}`}
          onClick={() => setTab("mine")}>
          My Reports
        </button>
      </div>

      {/* ── SUBMIT TAB ── */}
      {tab === "submit" && (
        <div>
          {alert && (
            <div className={`sf-alert sf-alert--${alert.type}`}>{alert.msg}</div>
          )}

          {/* Area */}
          <div className="sf-field">
            <label className="sf-label">Dashboard / Area</label>
            <select className="sf-select" value={dashboard} onChange={e => setDashboard(e.target.value)}>
              {DASHBOARD_OPTS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Type + Priority */}
          <div className="sf-row-2">
            <div className="sf-field">
              <label className="sf-label">Type</label>
              <select className="sf-select" value={signalType} onChange={e => setSignalType(e.target.value)}>
                {SIGNAL_OPTS.map(o => (
                  <option key={o} value={o}>{o.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="sf-field">
              <label className="sf-label">Priority</label>
              <select className="sf-select" value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITY_OPTS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="sf-field">
            <label className="sf-label">Title</label>
            <input
              className="sf-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief description of the issue…"
            />
          </div>

          {/* Description */}
          <div className="sf-field">
            <label className="sf-label">Description</label>
            <textarea
              className="sf-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Steps to reproduce, what you expected vs what happened…"
              rows={5}
            />
          </div>

          <button className="sf-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      )}

      {/* ── MY REPORTS TAB ── */}
      {tab === "mine" && (
        <div>
          {loading ? (
            <>
              {[80, 72, 80].map((h, i) => (
                <div key={i} className="sf-skel" style={{ height: h, animationDelay: `${i * 0.1}s` }} />
              ))}
            </>
          ) : myReports.length === 0 ? (
            <div className="sf-empty">
              <span className="sf-empty-icon">📭</span>
              No reports submitted yet.
            </div>
          ) : (
            myReports.map(r => (
              <div key={r.id} className="sf-card">
                <div className="sf-card-top">
                  <p className="sf-card-title">{r.title}</p>
                  <div className="sf-badges">
                    <span className={`sf-badge sf-badge--${r.priority}`}>
                      {r.priority}
                    </span>
                    <span className={`sf-badge sf-badge--${r.status}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <p className="sf-card-meta">
                  {r.dashboard} · {r.signal_type.replace("_", " ")}
                </p>
                {r.admin_note && (
                  <div className="sf-admin-note">
                    <span className="sf-admin-note-label">ANO:</span>
                    {r.admin_note}
                  </div>
                )}
                <span className="sf-card-date">{formatDate(r.created_at)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
