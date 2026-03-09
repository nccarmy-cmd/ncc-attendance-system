import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

/* ═══════════════════════════════════════════════════════════
   SENIOR ATTENDANCE
   Props:
     userProfile  { assigned_division, assigned_category }
     parade       { id, parade_date, session, status,
                    categories[], parade_type_map{},
                    parade_instructions, ano_remarks }
════════════════════════════════════════════════════════════ */

const STYLES = `
  .sa-wrap {
    padding: 20px 20px 40px;
    max-width: 800px;
  }

  /* ── page header ── */
  .sa-header {
    margin-bottom: 20px;
  }
  .sa-header-title {
    font-family: var(--csi-font-display,'Syne',sans-serif);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--csi-text-primary);
    margin: 0 0 4px;
  }
  .sa-header-sub {
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-size: 0.72rem;
    color: var(--csi-text-muted);
    margin: 0;
  }

  /* ── notice / banner ── */
  .sa-banner {
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 14px;
    font-size: 0.8rem;
  }
  .sa-banner--notif {
    background: var(--csi-amber-bg, rgba(251,191,36,.12));
    border: 1px solid var(--csi-amber-border, rgba(251,191,36,.3));
    color: var(--csi-amber);
  }
  .sa-banner--remarks {
    background: var(--csi-bg-input);
    border: 1px solid var(--csi-border);
    color: var(--csi-text-sub);
    border-left: 3px solid var(--csi-indigo);
  }
  .sa-banner--instructions {
    background: rgba(79,70,229,0.08);
    border: 1px solid rgba(99,102,241,0.25);
    color: var(--csi-text-sub);
    border-left: 3px solid var(--csi-indigo);
  }
  .sa-banner--locked {
    background: var(--csi-red-bg, rgba(248,113,113,.10));
    border: 1px solid var(--csi-red-border, rgba(248,113,113,.25));
    color: var(--csi-red);
  }
  .sa-banner--success {
    background: var(--csi-green-bg, rgba(52,211,153,.12));
    border: 1px solid var(--csi-green-border, rgba(52,211,153,.3));
    color: var(--csi-green);
  }
  .sa-banner-label {
    font-weight: 700;
    margin-bottom: 4px;
    display: block;
  }
  .sa-banner ul { margin: 4px 0 0; padding-left: 18px; }
  .sa-banner li { margin-bottom: 2px; }

  /* ── category + filter pills ── */
  .sa-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .sa-pill {
    padding: 5px 13px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    border: 1px solid var(--csi-border-input);
    background: var(--csi-bg-input);
    color: var(--csi-text-sub);
    cursor: pointer;
    transition: all 0.15s;
  }
  .sa-pill--active {
    background: var(--csi-indigo);
    border-color: var(--csi-indigo);
    color: #fff;
  }
  .sa-pill:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── parade meta row ── */
  .sa-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .sa-meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 0.7rem;
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-weight: 600;
    background: var(--csi-bg-input);
    border: 1px solid var(--csi-border);
    color: var(--csi-text-sub);
  }
  .sa-meta-chip--type {
    color: var(--csi-indigo-light, #818cf8);
    border-color: rgba(99,102,241,0.3);
    background: rgba(79,70,229,0.08);
  }

  /* ── stat boxes ── */
  .sa-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  @media (max-width: 480px) { .sa-stats { grid-template-columns: repeat(2,1fr); } }
  .sa-stat {
    background: var(--csi-bg-card);
    border: 1px solid var(--csi-border);
    border-radius: 8px;
    padding: 10px 12px;
    text-align: center;
  }
  .sa-stat-val {
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--csi-text-primary);
    display: block;
    line-height: 1.2;
  }
  .sa-stat-lbl {
    font-size: 0.65rem;
    color: var(--csi-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
    display: block;
  }

  /* ── table ── */
  .sa-table-wrap {
    background: var(--csi-bg-card);
    border: 1px solid var(--csi-border);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 18px;
  }
  .sa-table {
    width: 100%;
    border-collapse: collapse;
  }
  .sa-table th {
    background: var(--csi-bg-input);
    padding: 9px 14px;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--csi-text-muted);
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    text-align: left;
    border-bottom: 1px solid var(--csi-border);
  }
  .sa-table td {
    padding: 9px 14px;
    font-size: 0.8rem;
    color: var(--csi-text-primary);
    border-bottom: 1px solid var(--csi-border);
    vertical-align: middle;
  }
  .sa-table tr:last-child td { border-bottom: none; }
  .sa-table tr:hover td { background: var(--csi-bg-input); }
  .sa-table tr.sa-row--perm td { opacity: 0.7; }

  .sa-enroll {
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-size: 0.72rem;
    color: var(--csi-text-muted);
  }
  .sa-perm-reason {
    font-size: 0.68rem;
    color: var(--csi-amber);
    font-family: var(--csi-font-mono,monospace);
    margin-top: 2px;
  }
  .sa-status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.65rem;
    font-weight: 700;
    font-family: var(--csi-font-mono,monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .sa-status-badge--present    { background:var(--csi-green-bg,rgba(52,211,153,.15)); color:var(--csi-green); }
  .sa-status-badge--permission { background:var(--csi-amber-bg,rgba(251,191,36,.15)); color:var(--csi-amber); }
  .sa-status-badge--absent     { background:var(--csi-red-bg,rgba(248,113,113,.12));  color:var(--csi-red); }

  /* ── toggle switch ── */
  .sa-toggle-wrap { display:flex; align-items:center; gap:8px; }
  .sa-toggle {
    position: relative;
    width: 38px;
    height: 21px;
    flex-shrink: 0;
  }
  .sa-toggle input { opacity:0; width:0; height:0; }
  .sa-toggle-slider {
    position: absolute;
    inset: 0;
    border-radius: 21px;
    background: var(--csi-bg-input);
    border: 1px solid var(--csi-border-input);
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .sa-toggle-slider::before {
    content: '';
    position: absolute;
    width: 15px; height: 15px;
    left: 2px; top: 2px;
    border-radius: 50%;
    background: var(--csi-text-muted);
    transition: transform 0.2s, background 0.2s;
  }
  .sa-toggle input:checked + .sa-toggle-slider {
    background: var(--csi-green);
    border-color: var(--csi-green);
  }
  .sa-toggle input:checked + .sa-toggle-slider::before {
    transform: translateX(17px);
    background: #fff;
  }
  .sa-toggle input:disabled + .sa-toggle-slider { opacity: 0.45; cursor: not-allowed; }

  /* ── action bar ── */
  .sa-action-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .sa-btn {
    padding: 9px 20px;
    border: none;
    border-radius: 7px;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: var(--csi-font-body,'Inter',sans-serif);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }
  .sa-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sa-btn--primary { background: var(--csi-indigo); color: #fff; }
  .sa-btn--primary:hover:not(:disabled) { background: var(--csi-indigo-hover,#4338ca); }
  .sa-btn--ghost {
    background: var(--csi-bg-input);
    border: 1px solid var(--csi-border-input);
    color: var(--csi-text-sub);
  }
  .sa-btn--ghost:hover:not(:disabled) { background: var(--csi-bg-card); }

  /* ── empty state ── */
  .sa-empty {
    padding: 40px 0;
    text-align: center;
    color: var(--csi-text-muted);
    font-size: 0.82rem;
  }

  /* ── skeleton ── */
  .sa-skel {
    background: var(--csi-bg-input);
    border-radius: 6px;
    animation: sa-pulse 1.4s ease-in-out infinite;
  }
  @keyframes sa-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;

export default function SeniorAttendance({ userProfile, parade }) {
  const division = userProfile?.assigned_division;

  /* ── derive available categories from parade ── */
  const availableCategories = useMemo(() => {
    if (!parade?.categories) return [];
    return [...parade.categories].sort();
  }, [parade]);

  const [category, setCategory] = useState(null);

  /* set default category once parade loads */
  useEffect(() => {
    if (availableCategories.length > 0 && !category) {
      setCategory(availableCategories[0]);
    }
  }, [availableCategories]);

  /* data state */
  const [cadets,      setCadets]      = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [attendance,  setAttendance]  = useState({});   // { cadet_id: bool }
  const [notifications, setNotifications] = useState([]);

  const [hasExisting, setHasExisting] = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [filter,      setFilter]      = useState("ALL");

  const [loadingData, setLoadingData] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [alert,       setAlert]       = useState(null);  // { type, msg }
  const [summary,     setSummary]     = useState(null);

  /* ── load cadets / permissions / attendance when category/parade changes ── */
  useEffect(() => {
    if (!parade || !division || !category) return;
    setAlert(null);
    setSummary(null);

    async function loadData() {
      setLoadingData(true);

      const [cadetRes, permRes, attnRes, notifRes] = await Promise.all([
        supabase
          .from("cadets")
          .select("id, enrollment_no, name, rank")
          .eq("is_active", true)
          .eq("category", category)
          .eq("division", division)
          .neq("status","dropped")
          .order("enrollment_no"),

        supabase
          .from("permissions")
          .select("cadet_id, reason, to_date")
          .or(`parade_id.eq.${parade.id},to_date.gte.${parade.parade_date}`),

        supabase
          .from("attendance")
          .select("cadet_id, status")
          .eq("parade_id", parade.id),

        supabase
          .from("notifications")
          .select("id, message, type")
          .eq("is_active", true)
          .eq("target_role", "senior")
          .eq("parade_id", parade.id)
          .or(`user_id.is.null,user_id.eq.${(await supabase.auth.getUser()).data.user?.id}`)
      ]);

      const restored = {};
      attnRes.data?.forEach(a => {
        /* restore as bool: present=true, anything else=false */
        restored[a.cadet_id] = a.status === "present";
      });

      setCadets(cadetRes.data || []);
      setPermissions(permRes.data || []);
      setAttendance(restored);
      setHasExisting((attnRes.data?.length || 0) > 0);
      setNotifications(notifRes.data || []);
      setEditMode(false);
      setFilter("ALL");
      setLoadingData(false);
    }

    loadData();
  }, [parade, division, category]);

  /* ── helpers ── */
  const hasPermission = id => permissions.some(p => p.cadet_id === id);
  const getPermission = id => permissions.find(p => p.cadet_id === id);

  function getStatus(id) {
    if (hasPermission(id)) return "PERMISSION";
    if (attendance[id])   return "PRESENT";
    return "ABSENT";
  }

  function togglePresent(id) {
    if (!editMode && hasExisting) return;
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  }

  /* ── computed stats ── */
  const stats = useMemo(() => {
    const total  = cadets.length;
    const perm   = cadets.filter(c => hasPermission(c.id)).length;
    const present= cadets.filter(c => !hasPermission(c.id) && attendance[c.id]).length;
    const absent = total - perm - present;
    return { total, present, perm, absent };
  }, [cadets, permissions, attendance]);

  /* ── filtered list ── */
  const visibleCadets = useMemo(() => {
    return cadets.filter(c => {
      if (filter === "ALL")        return true;
      if (filter === "PRESENT")    return getStatus(c.id) === "PRESENT";
      if (filter === "PERMISSION") return getStatus(c.id) === "PERMISSION";
      if (filter === "ABSENT")     return getStatus(c.id) === "ABSENT";
      return true;
    });
  }, [cadets, permissions, attendance, filter]);

  /* ── submit attendance ── */
  async function submitAttendance() {
    if (!parade || !cadets.length) return;
    setSubmitting(true);
    setAlert(null);

    const records = cadets.map(c => {
      const perm = getPermission(c.id);
      if (perm) return { cadet_id: c.id, status: "absent_with_permission", reason: perm.reason };
      return {
        cadet_id: c.id,
        status: attendance[c.id] ? "present" : "absent_without_permission"
      };
    });

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc("write_attendance_batch", {
      p_actor_id:  user.id,
      p_parade_id: parade.id,
      p_records:   records
    });

    setSubmitting(false);

    if (error) {
      setAlert({ type: "error", msg: error.message === "parade_locked"
        ? "Parade is locked. Attendance cannot be modified."
        : error.message });
      return;
    }

    if (data.expected !== data.written) {
      setAlert({ type: "error", msg: `Mismatch: expected ${data.expected}, wrote ${data.written}. Try again.` });
      return;
    }

    setSummary({
      total:   records.length,
      present: records.filter(r => r.status === "present").length,
      perm:    records.filter(r => r.status === "absent_with_permission").length,
      absent:  records.filter(r => r.status === "absent_without_permission").length,
    });
    setHasExisting(true);
    setEditMode(false);
    setAlert({ type: "success", msg: "Attendance submitted successfully." });
  }

  /* ── guards ── */
  if (!parade) return (
    <div className="sa-wrap">
      <style>{STYLES}</style>
      <div className="sa-empty">No active parade found.</div>
    </div>
  );

  const isLocked   = parade.status === "completed";
  const paradeType = parade.parade_type_map?.[category] || "—";
  const canEdit    = !isLocked;

  return (
    <div className="sa-wrap">
      <style>{STYLES}</style>

      {/* Page header */}
      <div className="sa-header">
        <p className="sa-header-title">Attendance</p>
        <p className="sa-header-sub">
          {parade.parade_date} · {parade.session} · {division} Division
        </p>
      </div>

      {/* Parade instructions banner */}
      {parade.parade_instructions?.trim() && (
        <div className="sa-banner sa-banner--instructions">
          <span className="sa-banner-label">📋 Parade Instructions</span>
          <div style={{ whiteSpace:"pre-wrap", marginTop:4 }}>
            {parade.parade_instructions}
          </div>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="sa-banner sa-banner--notif">
          <span className="sa-banner-label">⚠ Notice from ANO</span>
          <ul>{notifications.map(n => <li key={n.id}>{n.message}</li>)}</ul>
        </div>
      )}

      {/* ANO remarks (completed parade) */}
      {parade.ano_remarks?.trim() && (
        <div className="sa-banner sa-banner--remarks">
          <span className="sa-banner-label">📌 ANO Final Remarks</span>
          <div style={{ whiteSpace:"pre-wrap", marginTop:4 }}>{parade.ano_remarks}</div>
        </div>
      )}

      {/* Locked banner */}
      {isLocked && (
        <div className="sa-banner sa-banner--locked">
          🔒 Parade completed. Attendance is locked and view-only.
        </div>
      )}

      {/* Alert */}
      {alert && (
        <div className={`sa-banner ${alert.type === "success" ? "sa-banner--success" : "sa-banner--locked"}`}>
          {alert.msg}
        </div>
      )}

      {/* Category selector */}
      <div style={{ marginBottom:10 }}>
        <p style={{ fontSize:"0.68rem", fontFamily:"var(--csi-font-mono,monospace)",
          fontWeight:700, color:"var(--csi-text-muted)", textTransform:"uppercase",
          letterSpacing:"0.06em", margin:"0 0 7px" }}>Category</p>
        <div className="sa-pills">
          {availableCategories.map(cat => (
            <button key={cat}
              className={`sa-pill${category === cat ? " sa-pill--active" : ""}`}
              onClick={() => setCategory(cat)}>
              Cat {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Parade type meta */}
      <div className="sa-meta">
        <span className="sa-meta-chip sa-meta-chip--type">📌 {paradeType}</span>
        <span className="sa-meta-chip">🪖 {division}</span>
      </div>

      {/* Stats */}
      <div className="sa-stats">
        <div className="sa-stat">
          <span className="sa-stat-val">{stats.total}</span>
          <span className="sa-stat-lbl">Total</span>
        </div>
        <div className="sa-stat" style={{ borderColor:"rgba(52,211,153,.3)" }}>
          <span className="sa-stat-val" style={{ color:"var(--csi-green)" }}>{stats.present}</span>
          <span className="sa-stat-lbl">Present</span>
        </div>
        <div className="sa-stat" style={{ borderColor:"rgba(251,191,36,.3)" }}>
          <span className="sa-stat-val" style={{ color:"var(--csi-amber)" }}>{stats.perm}</span>
          <span className="sa-stat-lbl">Permission</span>
        </div>
        <div className="sa-stat" style={{ borderColor:"rgba(248,113,113,.3)" }}>
          <span className="sa-stat-val" style={{ color:"var(--csi-red)" }}>{stats.absent}</span>
          <span className="sa-stat-lbl">Absent</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="sa-pills" style={{ marginBottom:12 }}>
        {["ALL","PRESENT","PERMISSION","ABSENT"].map(f => (
          <button key={f} className={`sa-pill${filter === f ? " sa-pill--active" : ""}`}
            onClick={() => setFilter(f)}>
            {f === "ALL" ? "All" : f === "PERMISSION" ? "On Leave" : f.charAt(0)+f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      {loadingData ? (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="sa-skel" style={{ height:46, animationDelay:`${i*0.08}s` }} />
          ))}
        </div>
      ) : (
        <div className="sa-table-wrap">
          {visibleCadets.length === 0 ? (
            <div className="sa-empty">No cadets match this filter.</div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Enrollment</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th style={{ textAlign:"center" }}>Mark Present</th>
                </tr>
              </thead>
              <tbody>
                {visibleCadets.map(c => {
                  const perm   = getPermission(c.id);
                  const status = getStatus(c.id);
                  const locked = !!perm || isLocked || (hasExisting && !editMode);

                  return (
                    <tr key={c.id} className={perm ? "sa-row--perm" : ""}>
                      <td><span className="sa-enroll">{c.enrollment_no}</span></td>
                      <td>
                        <span style={{ fontWeight:500 }}>{c.name}</span>
                        {perm && <div className="sa-perm-reason">📋 {perm.reason}</div>}
                      </td>
                      <td>
                        <span className={`sa-status-badge sa-status-badge--${status.toLowerCase() === "permission" ? "permission" : status.toLowerCase()}`}>
                          {status === "PERMISSION" ? "On Leave" : status.charAt(0)+status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td style={{ textAlign:"center" }}>
                        {perm ? (
                          <span style={{ color:"var(--csi-text-muted)", fontSize:"0.75rem" }}>—</span>
                        ) : (
                          <label className="sa-toggle">
                            <input type="checkbox"
                              checked={!!attendance[c.id]}
                              disabled={locked}
                              onChange={() => togglePresent(c.id)} />
                            <span className="sa-toggle-slider" />
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Summary after submit */}
      {summary && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
          {[
            ["Total",   summary.total,   "var(--csi-text-primary)"],
            ["Present", summary.present, "var(--csi-green)"],
            ["Leave",   summary.perm,    "var(--csi-amber)"],
            ["Absent",  summary.absent,  "var(--csi-red)"],
          ].map(([lbl,val,color]) => (
            <div key={lbl} className="sa-stat">
              <span className="sa-stat-val" style={{ color }}>{val}</span>
              <span className="sa-stat-lbl">{lbl}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      {canEdit && !loadingData && (
        <div className="sa-action-bar">
          {!hasExisting && (
            <button className="sa-btn sa-btn--primary" onClick={submitAttendance} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Attendance"}
            </button>
          )}
          {hasExisting && !editMode && (
            <button className="sa-btn sa-btn--ghost" onClick={() => setEditMode(true)}>
              Edit Attendance
            </button>
          )}
          {editMode && (
            <>
              <button className="sa-btn sa-btn--primary" onClick={submitAttendance} disabled={submitting}>
                {submitting ? "Saving…" : "Save Changes"}
              </button>
              <button className="sa-btn sa-btn--ghost" onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
