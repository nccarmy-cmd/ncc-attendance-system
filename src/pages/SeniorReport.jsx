import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

/* ═══════════════════════════════════════════════════════════
   REPORT TEMPLATES
════════════════════════════════════════════════════════════ */
const REPORT_TEMPLATES = {
  "Theory": `• Topic covered (Specialised / Common / General Awareness):
• Class / syllabus requirement to complete topic:

• Parade conducted by (ANO / PI Staff / Senior):

• Place of instruction:

• Test conducted (if any) – Average marks / performance:

• Observations / remarks:
`,
  "Drill": `• Type of drill conducted:
• Place and dress code:

• Parade taken by (ANO / PI Staff / Senior):

• Synchronisation and coordination:

• Execution of commands:

• Areas requiring improvement:

• Overall assessment:
`,
  "Weapon Training": `• Place and dress code:
• Parade taken by (ANO / PI Staff / Senior):

• Weapon handling and posture:

• Cadet discipline during training:

• Observed mistakes / safety concerns:

• Remarks:
`,
  "Physical Training (PT)": `• Type of PT activities conducted:
• Activity and Duration:

• Cadet participation and turnout:

• Physical endurance level observed:

• Injuries / health issues (if any):

• Overall performance:

• Remarks:
`,
  "Parade Rehearsal": `• Purpose of rehearsal:
• Strength present:

• Presence of ANO / PI Staff / Senior:

• Dress code:

• Coordination between contingents:

• Drill accuracy and alignment:

• Readiness level:

• Observations / remarks:
`,
  "Cultural Practice": `• Event / programme being practised (with date):
• Type of performance (song / dance / skit etc.):

• Status (completed / ongoing) and count of items:

• Time required to complete preparation:

• Remarks:
`,
  "Event": `• Event name:
• Guests attended:

• Place and duration of event:

• Cadet discipline and conduct:

• Refreshments served (if any - filled by C category):

• Interaction with guests / public exposure:

• Outcome / impact of the event:

• Remarks:
`,
  "Awareness Program": `• Topic / theme of awareness:
• Guests attended / involved:

• Mode of delivery (talk / rally / demonstration):

• Public response (if any):

• Learning outcome for cadets:

• Remarks:
`,
};

const OTHER_DIVISION = { SD: "SW", SW: "SD" };

/* ═══════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
const STYLES = `
  .sr-wrap { padding: 20px 20px 40px; max-width: 900px; }

  .sr-header-title {
    font-family: var(--csi-font-display,'Syne',sans-serif);
    font-size: 1.1rem; font-weight: 800;
    color: var(--csi-text-primary); margin: 0 0 4px;
  }
  .sr-header-sub {
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-size: 0.72rem; color: var(--csi-text-muted); margin: 0 0 20px;
  }

  .sr-banner {
    padding: 11px 14px; border-radius: 8px;
    font-size: 0.8rem; margin-bottom: 14px; border: 1px solid;
  }
  .sr-banner--locked  { background:var(--csi-bg-input); color:var(--csi-text-muted); border-color:var(--csi-border); }
  .sr-banner--success { background:var(--csi-green-bg,rgba(52,211,153,.12)); color:var(--csi-green); border-color:var(--csi-green-border,rgba(52,211,153,.3)); }
  .sr-banner--error   { background:var(--csi-red-bg,rgba(248,113,113,.1)); color:var(--csi-red); border-color:var(--csi-red-border,rgba(248,113,113,.3)); }
  .sr-banner--info    { background:rgba(79,70,229,.08); color:var(--csi-indigo-light,#818cf8); border-color:rgba(99,102,241,.25); }

  .sr-pills { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
  .sr-pill {
    padding: 5px 13px; border-radius: 20px;
    font-size: 0.75rem; font-weight: 600;
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    border: 1px solid var(--csi-border-input);
    background: var(--csi-bg-input); color: var(--csi-text-sub);
    cursor: pointer; transition: all 0.15s;
  }
  .sr-pill--active { background:var(--csi-indigo); border-color:var(--csi-indigo); color:#fff; }

  .sr-meta { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
  .sr-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 5px;
    font-size: 0.7rem; font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-weight: 600; background: var(--csi-bg-input);
    border: 1px solid var(--csi-border); color: var(--csi-text-sub);
  }
  .sr-chip--type { color:var(--csi-indigo-light,#818cf8); border-color:rgba(99,102,241,.3); background:rgba(79,70,229,.08); }

  /* ── mode toggle ── */
  .sr-mode-bar {
    display: flex; gap: 4px; margin-bottom: 18px;
    background: var(--csi-bg-input); border-radius: 8px; padding: 3px;
    width: fit-content;
  }
  .sr-mode-btn {
    padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 0.78rem; font-weight: 600;
    font-family: var(--csi-font-body,'Inter',sans-serif);
    transition: all 0.15s; background: transparent; color: var(--csi-text-muted);
  }
  .sr-mode-btn--active {
    background: var(--csi-bg-card); color: var(--csi-text-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,.2);
  }

  /* ── panels ── */
  .sr-panels {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 16px; align-items: start;
  }
  @media (max-width: 640px) { .sr-panels { grid-template-columns: 1fr; } }

  .sr-panel {
    background: var(--csi-bg-card); border: 1px solid var(--csi-border);
    border-radius: 10px; overflow: hidden;
  }
  .sr-panel--ref { border-style: dashed; }

  .sr-panel-header {
    padding: 10px 14px; background: var(--csi-bg-input);
    border-bottom: 1px solid var(--csi-border);
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .sr-panel-title {
    font-size: 0.72rem; font-weight: 700;
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--csi-text-muted); margin: 0;
  }
  .sr-panel-badge {
    font-size: 0.63rem; padding: 2px 8px; border-radius: 10px;
    font-family: var(--csi-font-mono,monospace); font-weight: 700; text-transform: uppercase;
  }
  .sr-panel-badge--edit { background:rgba(79,70,229,.15); color:var(--csi-indigo-light,#818cf8); }
  .sr-panel-badge--own  { background:var(--csi-green-bg,rgba(52,211,153,.15)); color:var(--csi-green); }
  .sr-panel-badge--ref  { background:var(--csi-bg-card); color:var(--csi-text-muted); border:1px solid var(--csi-border); }

  .sr-panel-body { padding: 14px; }

  .sr-textarea {
    width: 100%; min-height: 280px;
    background: var(--csi-bg-input); border: 1px solid var(--csi-border-input);
    border-radius: 7px; padding: 10px 12px; color: var(--csi-text-primary);
    font-family: var(--csi-font-mono,'JetBrains Mono',monospace);
    font-size: 0.76rem; line-height: 1.7; resize: vertical;
    box-sizing: border-box; outline: none; transition: border-color 0.15s;
  }
  .sr-textarea:focus { border-color: var(--csi-border-focus,#6366f1); }
  .sr-textarea:disabled { opacity: 0.6; cursor: not-allowed; background: var(--csi-bg-card); }

  .sr-readonly {
    width: 100%; min-height: 160px; max-height: 320px;
    background: var(--csi-bg-card); padding: 0;
    color: var(--csi-text-sub); font-family: var(--csi-font-mono,monospace);
    font-size: 0.74rem; line-height: 1.75; white-space: pre-wrap;
    word-break: break-word; overflow-y: auto;
  }

  .sr-saved-at {
    font-size: 0.66rem; color: var(--csi-text-muted);
    font-family: var(--csi-font-mono,monospace); margin-top: 6px; display: block;
  }

  .sr-action-bar { display:flex; gap:10px; margin-top:12px; align-items:center; flex-wrap:wrap; }
  .sr-btn {
    padding: 9px 20px; border: none; border-radius: 7px;
    font-size: 0.82rem; font-weight: 600;
    font-family: var(--csi-font-body,'Inter',sans-serif);
    cursor: pointer; transition: background 0.15s, opacity 0.15s;
  }
  .sr-btn:disabled { opacity:.5; cursor:not-allowed; }
  .sr-btn--primary { background:var(--csi-indigo); color:#fff; }
  .sr-btn--primary:hover:not(:disabled) { background:var(--csi-indigo-hover,#4338ca); }
  .sr-btn--ghost {
    background:var(--csi-bg-input); border:1px solid var(--csi-border-input);
    color:var(--csi-text-sub);
  }
  .sr-btn--ghost:hover:not(:disabled) { background:var(--csi-bg-card); color:var(--csi-text-primary); }

  .sr-empty {
    padding: 30px 0; text-align: center;
    color: var(--csi-text-muted); font-size: 0.78rem; font-style: italic;
  }

  .sr-skel { background:var(--csi-bg-input); border-radius:6px; animation:sr-pulse 1.4s ease-in-out infinite; }
  @keyframes sr-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`;

/*
  REPORT MODE LOGIC
  ─────────────────
  "shared"   → one record per (parade_id, category), no division column used
               SD writes it first; SW opens it, sees the text, can edit (same record)
  "separate" → SW can choose to write their own (parade_id, category, division) record

  On load:
    1. Fetch all reports for (parade_id, category) — up to 2 rows
    2. sharedReport = row with division IS NULL or the first row if only one exists
    3. myReport     = row where division = myDivision
    4. otherReport  = row where division = otherDivision
    If myReport exists → mode = "separate" (I already wrote my own)
    If only sharedReport exists → mode = "shared" (editing the shared one)
    If nothing → mode = "shared", text = template

  Save in "shared" mode:
    upsert with NO division field, onConflict = "parade_id,category"
    (requires the old (parade_id,category) unique constraint — OR a new shared record with division=null)

  Save in "separate" mode:
    upsert with division = myDivision, onConflict = "parade_id,category,division"

  DB constraint needed:
    Both (parade_id,category) for shared rows  AND (parade_id,category,division) for division rows
    Simplest: use division = NULL for shared, division = 'SD'/'SW' for separate
    Unique: (parade_id, category, COALESCE(division,'')) — partial index approach
    OR: just use (parade_id, category, division) and set division = 'SHARED' for shared records

  SIMPLEST APPROACH FOR THIS CODEBASE:
    Use division = 'SHARED' for shared report, division = 'SD'/'SW' for separate
    onConflict = "parade_id,category,division" for all upserts
    This uses the SAME constraint already migrated: UNIQUE(parade_id,category,division)
*/

export default function SeniorReport({ userProfile, parade }) {
  const division = userProfile?.assigned_division;
  const otherDiv = OTHER_DIVISION[division];

  const availableCategories = useMemo(() => {
    if (!parade?.categories) return [];
    return [...parade.categories].sort();
  }, [parade]);

  const [category,     setCategory]     = useState(null);

  // shared report: division = 'SHARED'
  const [sharedText,   setSharedText]   = useState("");
  const [sharedSavedAt, setSharedSavedAt] = useState(null);
  const [sharedExists, setSharedExists] = useState(false);

  // my separate report: division = myDivision
  const [myText,       setMyText]       = useState("");
  const [mySavedAt,    setMySavedAt]    = useState(null);
  const [myExists,     setMyExists]     = useState(false);

  // other division's separate report (read-only reference)
  const [otherText,    setOtherText]    = useState("");
  const [otherExists,  setOtherExists]  = useState(false);

  // "shared" = editing the shared report | "separate" = writing own division report
  const [mode,         setMode]         = useState("shared");
  const [otherCollapsed, setOtherCollapsed] = useState(false);

  const [loadingData,  setLoadingData]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [alert,        setAlert]        = useState(null);

  /* default category */
  useEffect(() => {
    if (availableCategories.length > 0 && !category) setCategory(availableCategories[0]);
  }, [availableCategories]);

  /* load reports on category change */
  useEffect(() => {
    if (!parade || !division || !category) return;
    setAlert(null);
    setMode("shared");

    async function loadReports() {
      setLoadingData(true);

      const { data: rows } = await supabase
        .from("parade_reports")
        .select("division, report_text, updated_at")
        .eq("parade_id", parade.id)
        .eq("category", category);

      const shared    = rows?.find(r => r.division === "SHARED");
      const mine      = rows?.find(r => r.division === division);
      const other     = rows?.find(r => r.division === otherDiv);

      const template = REPORT_TEMPLATES[parade.parade_type_map?.[category]] || "";

      // shared report
      if (shared) {
        setSharedText(shared.report_text);
        setSharedSavedAt(shared.updated_at);
        setSharedExists(true);
      } else {
        setSharedText(template);
        setSharedSavedAt(null);
        setSharedExists(false);
      }

      // my separate
      if (mine) {
        setMyText(mine.report_text);
        setMySavedAt(mine.updated_at);
        setMyExists(true);
        setMode("separate"); // I already have a separate one
      } else {
        setMyText(template);
        setMySavedAt(null);
        setMyExists(false);
      }

      // other division separate
      if (other) {
        setOtherText(other.report_text);
        setOtherExists(true);
      } else {
        setOtherText("");
        setOtherExists(false);
      }

      setLoadingData(false);
    }
    loadReports();
  }, [parade, division, category]);

  /* save */
  async function saveReport() {
    if (!parade || !division || !category) return;
    if (parade.status === "completed") {
      setAlert({ type: "error", msg: "Parade completed. Report locked." });
      return;
    }
    setSaving(true);
    setAlert(null);

    const { data: { user } } = await supabase.auth.getUser();
    const paradeType = parade.parade_type_map?.[category];
    const divisionVal = mode === "shared" ? "SHARED" : division;
    const textToSave  = mode === "shared" ? sharedText : myText;

    const { error } = await supabase
      .from("parade_reports")
      .upsert(
        {
          parade_id:   parade.id,
          category,
          division:    divisionVal,
          parade_type: paradeType,
          report_text: textToSave,
          created_by:  user.id,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: "parade_id,category,division" }
      );

    setSaving(false);
    if (error) {
      setAlert({ type: "error", msg: error.message });
    } else {
      const now = new Date().toISOString();
      if (mode === "shared") {
        setSharedExists(true);
        setSharedSavedAt(now);
      } else {
        setMyExists(true);
        setMySavedAt(now);
      }
      setAlert({ type: "success", msg: "Report saved." });
    }
  }

  function switchToSeparate() {
    // pre-fill with shared text as starting point if shared exists
    if (sharedExists && !myExists) setMyText(sharedText);
    setMode("separate");
  }

  const isLocked   = parade?.status === "completed";
  const paradeType = parade?.parade_type_map?.[category] || "—";
  const fmtDate    = d => d ? new Date(d).toLocaleString("en-IN",{ day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit" }) : null;

  if (!parade) return (
    <div className="sr-wrap"><style>{STYLES}</style>
      <p style={{ color:"var(--csi-text-muted)",fontSize:"0.82rem" }}>No active parade.</p>
    </div>
  );

  return (
    <div className="sr-wrap">
      <style>{STYLES}</style>

      <p className="sr-header-title">Parade Report</p>
      <p className="sr-header-sub">{parade.parade_date} · {parade.session} · {division} Division</p>

      {isLocked && <div className="sr-banner sr-banner--locked">🔒 Parade completed. Report locked.</div>}
      {alert    && <div className={`sr-banner sr-banner--${alert.type}`}>{alert.msg}</div>}

      {/* Category selector */}
      <div style={{ marginBottom:10 }}>
        <p style={{ fontSize:"0.68rem",fontFamily:"var(--csi-font-mono,monospace)",fontWeight:700,
          color:"var(--csi-text-muted)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 7px" }}>Category</p>
        <div className="sr-pills">
          {availableCategories.map(cat => (
            <button key={cat} className={`sr-pill${category===cat?" sr-pill--active":""}`}
              onClick={() => setCategory(cat)}>Cat {cat}</button>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="sr-meta">
        <span className="sr-chip sr-chip--type">📌 {paradeType}</span>
        <span className="sr-chip">🪖 {division}</span>
      </div>

      {/* Mode toggle — only show if not locked */}
      {!isLocked && (
        <div style={{ marginBottom:18 }}>
          <p style={{ fontSize:"0.68rem",fontFamily:"var(--csi-font-mono,monospace)",fontWeight:700,
            color:"var(--csi-text-muted)",textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 7px" }}>Report Mode</p>
          <div className="sr-mode-bar">
            <button className={`sr-mode-btn${mode==="shared"?" sr-mode-btn--active":""}`}
              onClick={() => setMode("shared")}>
              ✏️ Shared Report
            </button>
            <button className={`sr-mode-btn${mode==="separate"?" sr-mode-btn--active":""}`}
              onClick={switchToSeparate}>
              📄 {myExists ? "My Separate Report" : "Write Separate"}
            </button>
          </div>
          {mode === "shared" && (
            <p style={{ fontSize:"0.72rem",color:"var(--csi-text-muted)",marginTop:6 }}>
              Editing the shared report — both divisions see and can edit this.
            </p>
          )}
          {mode === "separate" && (
            <p style={{ fontSize:"0.72rem",color:"var(--csi-text-muted)",marginTop:6 }}>
              Writing your own {division} Division report — appears alongside the shared report for ANO.
            </p>
          )}
        </div>
      )}

      {/* Content area */}
      {loadingData ? (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {[1,2].map(i => <div key={i} className="sr-skel" style={{ height:120,animationDelay:`${i*0.1}s` }} />)}
        </div>
      ) : (
        <>
          {/* Main editable panel */}
          <div className="sr-panel" style={{ marginBottom:16 }}>
            <div className="sr-panel-header">
              <p className="sr-panel-title">
                {mode === "shared" ? "Shared Report (All Divisions)" : `${division} Division — Your Report`}
              </p>
              <span className={`sr-panel-badge ${mode==="shared"?"sr-panel-badge--edit":"sr-panel-badge--own"}`}>
                {mode === "shared" ? "Shared" : "Your Own"}
              </span>
            </div>
            <div className="sr-panel-body">
              <textarea
                className="sr-textarea"
                value={mode === "shared" ? sharedText : myText}
                disabled={isLocked}
                onChange={e => mode === "shared" ? setSharedText(e.target.value) : setMyText(e.target.value)}
                placeholder={`Write ${mode === "shared" ? "the shared" : "your"} parade report here…`}
              />
              {(mode==="shared" ? sharedSavedAt : mySavedAt) && (
                <span className="sr-saved-at">Last saved: {fmtDate(mode==="shared" ? sharedSavedAt : mySavedAt)}</span>
              )}
              {!isLocked && (
                <div className="sr-action-bar">
                  <button className="sr-btn sr-btn--primary" onClick={saveReport} disabled={saving}>
                    {saving ? "Saving…" : (mode==="shared" ? (sharedExists?"Update Shared":"Save Shared") : (myExists?"Update My Report":"Save My Report"))}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Reference panels — show other's separate report + shared (if in separate mode) */}
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>

            {/* If in separate mode: show shared report as reference */}
            {mode === "separate" && sharedExists && (
              <div className="sr-panel sr-panel--ref">
                <div className="sr-panel-header">
                  <p className="sr-panel-title">Shared Report — Reference</p>
                  <span className="sr-panel-badge sr-panel-badge--ref">Read-only</span>
                </div>
                <div className="sr-panel-body">
                  <div className="sr-readonly">{sharedText}</div>
                  {sharedSavedAt && <span className="sr-saved-at">Updated: {fmtDate(sharedSavedAt)}</span>}
                </div>
              </div>
            )}

            {/* Other division's separate report (if they wrote one) */}
            {otherExists && (
              <div className="sr-panel sr-panel--ref">
                <div className="sr-panel-header">
                  <p className="sr-panel-title">{otherDiv} Division — Separate Report</p>
                  <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                    <span className="sr-panel-badge sr-panel-badge--ref">Read-only</span>
                    <button style={{ background:"none",border:"none",fontSize:"0.7rem",
                      color:"var(--csi-text-muted)",cursor:"pointer",fontFamily:"var(--csi-font-mono,monospace)" }}
                      onClick={() => setOtherCollapsed(v=>!v)}>
                      {otherCollapsed ? "▼ Show" : "▲ Hide"}
                    </button>
                  </div>
                </div>
                {!otherCollapsed && (
                  <div className="sr-panel-body">
                    <div className="sr-readonly">{otherText}</div>
                  </div>
                )}
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
