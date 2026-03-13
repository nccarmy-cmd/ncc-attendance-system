import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../components/ThemeContext";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SYNE = { fontFamily: "'Syne', sans-serif" };
const RANKS = ["CDT", "LCPL", "CPL", "SGT", "CQMS", "JUO", "SUO"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DIVISIONS = ["SD", "SW"];
const BRANCHES = ["CSE", "CSE-AIML", "CSE-AIDS", "IT", "ECE", "EEE", "MECH", "CIVIL"];
const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEAR = `${CURRENT_YEAR}-${String(CURRENT_YEAR + 1).slice(2)}`;

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function actionLabel(type) {
  const map = {
    category_promotion: "Category Promotion",
    rank_promotion: "Rank Promotion",
    rank_change: "Rank Change",
    stayed_back: "Stayed Back",
    dropped: "Dropped",
    reinstated: "Reinstated",
    batch_intake: "New Intake",
  };
  return map[type] ?? type;
}
function actionColor(type) {
  if (type === "category_promotion") return { bg: "#1e3a5f", border: "#1d4ed8", text: "#93c5fd" };
  if (type === "rank_promotion") return { bg: "#14532d", border: "#15803d", text: "#86efac" };
  if (type === "rank_change") return { bg: "var(--csi-bg-input)", border: "#475569", text: "#94a3b8" };
  if (type === "stayed_back") return { bg: "#451a03", border: "#92400e", text: "#fbbf24" };
  if (type === "dropped") return { bg: "#450a0a", border: "#b91c1c", text: "#fca5a5" };
  if (type === "reinstated") return { bg: "#164e63", border: "#0e7490", text: "#67e8f9" };
  if (type === "batch_intake") return { bg: "#2e1065", border: "#7c3aed", text: "#c4b5fd" };
  return { bg: "var(--csi-bg-input)", border: "var(--csi-border-input)", text: "#94a3b8" };
}
function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ─────────────────────────────────────────
   CONFIRM DIALOG — Portal
───────────────────────────────────────── */
function ConfirmDialog({ title, message, warning, onConfirm, onCancel, submitting = false, progressLabel = "Processing…" }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", backgroundColor:"rgba(0,0,0,0.8)", backdropFilter:"blur(4px)" }}>
      <div style={{ background:"var(--csi-bg-card)", border:"1px solid var(--csi-border-input)", borderRadius:"1rem", boxShadow:"0 25px 60px rgba(0,0,0,0.7)", width:"100%", maxWidth:"460px", margin:"0 1rem", padding:"1.75rem" }}>

        {/* Progress overlay while submitting */}
        {submitting ? (
          <div style={{ textAlign:"center", padding:"1.5rem 0" }}>
            <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
              width:56, height:56, borderRadius:"50%",
              border:"3px solid var(--csi-bg-input)", borderTopColor:"#6366f1",
              animation:"spin 0.8s linear infinite", marginBottom:"1rem" }}/>
            <p style={{ ...SYNE, fontSize:"1rem", fontWeight:700, color:"var(--csi-text-primary)", margin:"0 0 0.4rem" }}>
              {progressLabel}
            </p>
            <p style={{ ...MONO, fontSize:"0.7rem", color:"var(--csi-text-muted)", margin:0 }}>
              Please wait — do not close this page
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ ...SYNE, fontSize:"1.2rem", fontWeight:800, color:"var(--csi-text-primary)", margin:"0 0 0.75rem" }}>{title}</h3>
            <p style={{ fontSize:"0.85rem", color:"var(--csi-text-sub)", lineHeight:1.6, marginBottom:"1rem" }}>{message}</p>
            {warning && (
              <div style={{ background:"#450a0a", border:"1px solid #b91c1c", borderRadius:"0.5rem", padding:"0.75rem 1rem", marginBottom:"1.25rem" }}>
                <p style={{ ...MONO, fontSize:"0.72rem", color:"#fca5a5", margin:0 }}>⚠ {warning}</p>
              </div>
            )}
            <div style={{ display:"flex", gap:"0.75rem", justifyContent:"flex-end" }}>
              <button onClick={onCancel}
                style={{ background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", color:"var(--csi-text-sub)", fontSize:"0.82rem", borderRadius:"0.5rem", padding:"0.5rem 1.25rem", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={onConfirm}
                style={{ background:"#4f46e5", border:"none", color:"white", fontSize:"0.82rem", fontWeight:700, borderRadius:"0.5rem", padding:"0.5rem 1.25rem", cursor:"pointer" }}>
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   TAB 1 — BATCH PROMOTION
───────────────────────────────────────── */
function TabBatchPromotion() {
  const [promoType, setPromoType] = useState(null); // 'A_to_B' | 'B_to_C' | 'C_to_alumni'
  const [academicYear, setAcademicYear] = useState(ACADEMIC_YEAR);
  const [cadets, setCadets] = useState([]);
  const [decisions, setDecisions] = useState({}); // cadet_id → { action: 'promote'|'stayed_back'|'dropped', reason: '' }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [success, setSuccess] = useState(null);
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [blockReason, setBlockReason] = useState(null); // cascade restriction message

  const fromCat = promoType === "A_to_B" ? "A" : promoType === "B_to_C" ? "B" : promoType === "C_to_alumni" ? "C" : null;
  const toCat = promoType === "A_to_B" ? "B" : promoType === "B_to_C" ? "C" : null;

  async function loadCadets() {
    if (!promoType) return;
    setLoading(true); setError(null); setCadets([]); setDecisions({}); setBlockReason(null);

    /* ── Cascade restriction check ──
       A→B only allowed if NO active C cadets remain (all C must have passed out)
       B→C only allowed if NO active C cadets remain (C must be empty / passed out)
       Reasoning: C→Alumni must happen first, then B→C, then A→B */
    if (promoType === "B_to_C") {
      const { count: cCount } = await supabase.from("cadets")
        .select("id", { count: "exact", head: true })
        .eq("category", "C").eq("is_active", true);
      if (cCount > 0) {
        setBlockReason(`Cannot promote B → C: there are still ${cCount} active Category C cadet(s). Complete C → Alumni promotion first.`);
        setLoading(false); return;
      }
    }
    if (promoType === "A_to_B") {
      const { count: bCount } = await supabase.from("cadets")
        .select("id", { count: "exact", head: true })
        .eq("category", "B").eq("is_active", true);
      if (bCount > 0) {
        setBlockReason(`Cannot promote A → B: there are still ${bCount} active Category B cadet(s). Complete B → C promotion first.`);
        setLoading(false); return;
      }
    }

    const { data, error: err } = await supabase
      .from("cadets")
      .select("id, name, enrollment_no, rank, category, division, intake_year")
      .eq("category", fromCat)
      .eq("is_active", true)
      .order("name");
    if (err) setError(err.message);
    else {
      setCadets(data || []);
      const d = {};
      (data || []).forEach((c) => { d[c.id] = { action: "promote", reason: "" }; });
      setDecisions(d);
    }
    setLoading(false);
  }

  useEffect(() => { loadCadets(); }, [promoType]);

  function setDecision(id, field, val) {
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }

  const summary = useMemo(() => {
    const vals = Object.values(decisions);
    return {
      promote: vals.filter((d) => d.action === "promote").length,
      stayed_back: vals.filter((d) => d.action === "stayed_back").length,
      dropped: vals.filter((d) => d.action === "dropped").length,
    };
  }, [decisions]);

  const canSubmit = useMemo(() => {
    return Object.entries(decisions).every(([, d]) => {
      if (d.action === "stayed_back" || d.action === "dropped") return d.reason.trim().length > 0;
      return true;
    });
  }, [decisions]);

  const sortedCadets = useMemo(() => {
    const arr = [...cadets];
    arr.sort((a,b) => {
      let va, vb;
      if (sortCol === "rank") {
        const RANK_ORDER = ["SUO","JUO","CQMS","SGT","CPL","LCPL","CDT"];
        va = RANK_ORDER.indexOf(a.rank); vb = RANK_ORDER.indexOf(b.rank);
        if (va===-1) va=99; if (vb===-1) vb=99;
        return sortDir==="asc" ? va-vb : vb-va;
      }
      if (sortCol === "division") { va=a.division??""; vb=b.division??""; }
      else if (sortCol === "intake") { va=a.intake_year??0; vb=b.intake_year??0; return sortDir==="asc"?va-vb:vb-va; }
      else if (sortCol === "enrollment") { va=a.enrollment_no??""; vb=b.enrollment_no??""; }
      else { va=a.name??""; vb=b.name??""; }
      return sortDir==="asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [cadets, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  const SortArrow = ({col}) => sortCol!==col
    ? <span style={{opacity:0.3,fontSize:"0.55rem"}}> ⇅</span>
    : <span style={{fontSize:"0.55rem",color:"#818cf8"}}> {sortDir==="asc"?"↑":"↓"}</span>;

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      // 1. Create batch_event
      const { data: batchData, error: batchErr } = await supabase
        .from("batch_event")
        .insert({ event_type: promoType, academic_year: academicYear, performed_by: user.id })
        .select("id")
        .single();
      if (batchErr) throw new Error(batchErr.message);
      const batchEventId = batchData.id;

      // 2. Build promotion_log rows + cadet updates
      const logRows = [];
      const cadetUpdates = [];

      for (const cadet of cadets) {
        const d = decisions[cadet.id];
        if (d.action === "promote") {
          logRows.push({
            cadet_id: cadet.id,
            action_type: "category_promotion",
            from_category: fromCat,
            to_category: toCat ?? null,
            from_rank: cadet.rank,
            to_rank: cadet.rank, // rank carries forward
            batch_event_id: batchEventId,
            reason: null,
            performed_by: user.id,
          });
          if (promoType === "C_to_alumni") {
            cadetUpdates.push({ id: cadet.id, is_active: false, passout_year: CURRENT_YEAR });
          } else {
            cadetUpdates.push({ id: cadet.id, category: toCat });
          }
        } else if (d.action === "stayed_back") {
          logRows.push({
            cadet_id: cadet.id,
            action_type: "stayed_back",
            from_category: fromCat,
            to_category: fromCat,
            from_rank: cadet.rank,
            to_rank: cadet.rank,
            batch_event_id: batchEventId,
            reason: d.reason,
            performed_by: user.id,
          });
          // no cadet update — stays as-is
        } else if (d.action === "dropped") {
          logRows.push({
            cadet_id: cadet.id,
            action_type: "dropped",
            from_category: fromCat,
            to_category: null,
            from_rank: cadet.rank,
            to_rank: null,
            batch_event_id: batchEventId,
            reason: d.reason,
            performed_by: user.id,
          });
          cadetUpdates.push({ id: cadet.id, is_active: false, drop_reason: d.reason });
        }
      }

      // 3. Insert all promotion_log rows
      const { error: logErr } = await supabase.from("promotion_log").insert(logRows);
      if (logErr) throw new Error(logErr.message);

      // 4. Apply cadet updates one by one (Supabase doesn't support bulk upsert with different values easily)
      for (const upd of cadetUpdates) {
        const { id, ...fields } = upd;
        const { error: updErr } = await supabase.from("cadets").update(fields).eq("id", id);
        if (updErr) throw new Error(updErr.message);
      }

      setSuccess(`Batch promotion complete. ${summary.promote} promoted, ${summary.stayed_back} stayed back, ${summary.dropped} dropped.`);
      setConfirm(false);
      setCadets([]);
      setDecisions({});
      setPromoType(null);
    } catch (e) {
      setError(e.message);
      setConfirm(false);
    }
    setSubmitting(false);
  }

  return (
    <div>
      {/* Success banner */}
      {success && (
        <div style={{ background: "#14532d", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "0.85rem 1.25rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ ...MONO, fontSize: "0.78rem", color: "#86efac", margin: 0 }}>✓ {success}</p>
          <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "#86efac", cursor: "pointer", fontSize: "1rem" }}>×</button>
        </div>
      )}

      {/* Config bar */}
      <div className="bg-[#0f1623] border border-slate-800 rounded-2xl p-5 mb-5">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-4" style={MONO}>Configure Batch Promotion</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div>
            <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Promotion Type</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[
                { val: "A_to_B", label: "A → B", desc: "A Certificate Exam" },
                { val: "B_to_C", label: "B → C", desc: "B Certificate Exam" },
                { val: "C_to_alumni", label: "C → Alumni", desc: "C Certificate / Passout" },
              ].map(({ val, label, desc }) => (
                <button key={val} onClick={() => setPromoType(val)}
                  style={{
                    background: promoType === val ? "#4f46e5" : "var(--csi-bg-input)",
                    border: `1px solid ${promoType === val ? "#6366f1" : "var(--csi-border-input)"}`,
                    borderRadius: "0.6rem", padding: "0.6rem 1rem", cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s"
                  }}>
                  <p style={{ ...SYNE, fontSize: "0.9rem", fontWeight: 700, color: promoType === val ? "white" : "#94a3b8", margin: "0 0 0.15rem" }}>{label}</p>
                  <p style={{ ...MONO, fontSize: "0.6rem", color: promoType === val ? "#c7d2fe" : "#475569", margin: 0 }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Academic Year</p>
            <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2025-26"
              style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", ...MONO, width: "110px" }} />
          </div>
        </div>
      </div>

      {error && <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}><p style={{ ...MONO, fontSize: "0.75rem", color: "#fca5a5", margin: 0 }}>⚠ {error}</p></div>}

      {/* Cascade restriction block */}
      {blockReason && (
        <div style={{ background: "#451a03", border: "1px solid #d97706", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1rem", display:"flex", gap:"0.75rem", alignItems:"flex-start" }}>
          <span style={{ fontSize:"1.2rem" }}>🔒</span>
          <div>
            <p style={{ ...MONO, fontSize: "0.75rem", color: "#fbbf24", margin:"0 0 0.3rem", fontWeight:700 }}>Promotion Blocked — Order of Operations Required</p>
            <p style={{ ...MONO, fontSize: "0.72rem", color: "#d97706", margin:0 }}>{blockReason}</p>
            <p style={{ ...MONO, fontSize: "0.65rem", color: "#92400e", margin:"0.4rem 0 0" }}>
              Correct order: C → Alumni first · then B → C · then A → B
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--csi-text-muted)", ...MONO, fontSize: "0.82rem" }} className="animate-pulse">Loading cadets…</div>}

      {/* Cadet decision table */}
      {!loading && cadets.length > 0 && (
        <>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { label: "Total", val: cadets.length, color: "var(--csi-text-primary)" },
              { label: promoType === "C_to_alumni" ? "Passing Out" : `Promoting to ${toCat}`, val: summary.promote, color: "#86efac" },
              { label: "Staying Back", val: summary.stayed_back, color: "#fbbf24" },
              { label: "Dropping Out", val: summary.dropped, color: "#fca5a5" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.75rem", padding: "0.6rem 1rem" }}>
                <p style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", margin: "0 0 0.2rem" }}>{label}</p>
                <p style={{ ...SYNE, fontSize: "1.4rem", fontWeight: 700, color, margin: 0 }}>{val}</p>
              </div>
            ))}
            {!canSubmit && (
              <div style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: "0.75rem", padding: "0.6rem 1rem", display: "flex", alignItems: "center" }}>
                <p style={{ ...MONO, fontSize: "0.7rem", color: "#fbbf24", margin: 0 }}>⚠ Reason required for all Stayed Back / Dropped cadets</p>
              </div>
            )}
            <button
              onClick={() => setConfirm(true)}
              disabled={!canSubmit || submitting}
              style={{ marginLeft: "auto", background: canSubmit ? "#4f46e5" : "var(--csi-bg-input)", border: `1px solid ${canSubmit ? "#6366f1" : "var(--csi-border-input)"}`, color: canSubmit ? "white" : "#475569", fontSize: "0.82rem", fontWeight: 700, borderRadius: "0.6rem", padding: "0.6rem 1.5rem", cursor: canSubmit ? "pointer" : "not-allowed", ...MONO, transition: "all 0.15s", display:"flex", alignItems:"center", gap:"0.5rem" }}>
              {submitting && <span style={{ display:"inline-block", width:12, height:12, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>}
              {submitting ? "Processing promotion…" : "Execute Promotion"}
            </button>
          </div>

          {/* Table */}
          <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", overflow: "hidden" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "var(--csi-bg-input)" }}>
                  {[
                    {label:"Cadet",      col:"name"},
                    {label:"Enrollment", col:"enrollment"},
                    {label:"Rank",       col:"rank"},
                    {label:"Div",        col:"division"},
                    {label:"Intake",     col:"intake"},
                    {label:"Decision",   col:null},
                    {label:"Reason",     col:null},
                  ].map(({label,col}) => (
                    <th key={label} onClick={col?()=>toggleSort(col):undefined}
                      style={{ textAlign:"left", padding:"0.7rem 0.85rem", color: sortCol===col?"#a5b4fc":"#64748b",
                        fontWeight:600, fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.06em",
                        cursor:col?"pointer":"default", userSelect:"none", whiteSpace:"nowrap" }}>
                      {label}{col&&<SortArrow col={col}/>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCadets.map((c, i) => {
                  const d = decisions[c.id] ?? { action: "promote", reason: "" };
                  const rowBg = d.action === "stayed_back" ? "rgba(69,26,3,0.3)" : d.action === "dropped" ? "rgba(69,10,10,0.3)" : "transparent";
                  return (
                    <tr key={c.id} style={{ borderTop: "1px solid var(--csi-bg-input)", background: i % 2 === 0 ? rowBg : `${rowBg}` }}>
                      <td style={{ padding: "0.65rem 0.85rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>{initials(c.name)}</div>
                          <span style={{ color: "var(--csi-text-primary)", fontWeight: 500 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "0.65rem 0.85rem", ...MONO, color: "var(--csi-text-muted)", fontSize: "0.72rem" }}>{c.enrollment_no}</td>
                      <td style={{ padding: "0.65rem 0.85rem", color: "var(--csi-text-sub)" }}>{c.rank}</td>
                      <td style={{ padding: "0.65rem 0.85rem" }}>
                        <span style={{ ...MONO, fontSize: "0.65rem", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-sub)", borderRadius: "0.25rem", padding: "0.1rem 0.35rem" }}>{c.division}</span>
                      </td>
                      <td style={{ padding: "0.65rem 0.85rem", ...MONO, color: "var(--csi-text-muted)", fontSize: "0.72rem" }}>{c.intake_year ?? "—"}</td>
                      <td style={{ padding: "0.65rem 0.85rem" }}>
                        <div style={{ display: "flex", borderRadius: "0.4rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
                          {[
                            { val: "promote", label: promoType === "C_to_alumni" ? "Passout" : "Promote", color: "#14532d", activeColor: "#15803d" },
                            { val: "stayed_back", label: "Stay Back", color: "#451a03", activeColor: "#92400e" },
                            { val: "dropped", label: "Drop", color: "#450a0a", activeColor: "#b91c1c" },
                          ].map(({ val, label, color, activeColor }) => (
                            <button key={val} onClick={() => setDecision(c.id, "action", val)}
                              style={{ ...MONO, fontSize: "0.6rem", padding: "0.3rem 0.6rem", border: "none", cursor: "pointer", background: d.action === val ? activeColor : color, color: d.action === val ? "white" : "#64748b", transition: "all 0.1s", fontWeight: d.action === val ? 700 : 400 }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "0.65rem 0.85rem" }}>
                        {(d.action === "stayed_back" || d.action === "dropped") ? (
                          <input
                            value={d.reason}
                            onChange={(e) => setDecision(c.id, "reason", e.target.value)}
                            placeholder="Required — enter reason…"
                            style={{ background: "var(--csi-bg-input)", border: `1px solid ${d.reason.trim() ? "var(--csi-border-input)" : "#b91c1c"}`, color: "var(--csi-text-primary)", fontSize: "0.72rem", borderRadius: "0.35rem", padding: "0.3rem 0.6rem", width: "100%", minWidth: "180px", ...MONO }}
                          />
                        ) : (
                          <span style={{ color: "var(--csi-border-input)", fontSize: "0.72rem", ...MONO }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {!loading && !promoType && (
        <div style={{ textAlign: "center", padding: "5rem 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎖</div>
          <p style={{ ...MONO, color: "var(--csi-text-muted)", fontSize: "0.82rem" }}>Select a promotion type to begin.</p>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Execute Batch Promotion"
          message={`This will promote ${summary.promote} cadets, mark ${summary.stayed_back} as stayed back, and drop ${summary.dropped} cadets. All changes will be logged to the promotion audit trail.`}
          warning="This action cannot be undone. Cadet records will be updated permanently."
          onConfirm={handleSubmit}
          onCancel={() => { if (!submitting) setConfirm(false); }}
          submitting={submitting}
          progressLabel={`Promoting ${summary.promote} cadets — updating records…`}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 2 — INDIVIDUAL RANK CHANGE
───────────────────────────────────────── */
function TabRankChange() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newRank, setNewRank] = useState("");
  const [actionType, setActionType] = useState("rank_promotion"); // rank_promotion | rank_change | dropped
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const debounceRef = useRef(null);

  async function search(q) {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("cadets")
      .select("id, name, enrollment_no, rank, category, division, is_active")
      .or(`name.ilike.%${q}%,enrollment_no.ilike.%${q}%`)
      .order("name").limit(15);
    setResults(data || []);
    setSearching(false);
  }

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function selectCadet(c) {
    setSelectedCadet(c);
    setNewRank(c.rank);
    setActionType("rank_promotion");
    setReason("");
    setError(null);
    setSuccess(null);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("promotion_log")
      .select("*")
      .eq("cadet_id", c.id)
      .order("performed_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
    setHistoryLoading(false);
  }

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const logRow = {
        cadet_id: selectedCadet.id,
        action_type: actionType,
        from_category: selectedCadet.category,
        to_category: actionType === "dropped" ? null : selectedCadet.category,
        from_rank: selectedCadet.rank,
        to_rank: actionType === "dropped" ? null : newRank,
        reason: reason || null,
        performed_by: user.id,
      };
      const { error: logErr } = await supabase.from("promotion_log").insert(logRow);
      if (logErr) throw new Error(logErr.message);

      if (actionType === "dropped") {
        const { error: updErr } = await supabase.from("cadets").update({ is_active: false, drop_reason: reason }).eq("id", selectedCadet.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: updErr } = await supabase.from("cadets").update({ rank: newRank }).eq("id", selectedCadet.id);
        if (updErr) throw new Error(updErr.message);
      }

      setSuccess(`${actionType === "dropped" ? "Cadet dropped" : `Rank updated to ${newRank}`} successfully.`);
      setSelectedCadet((prev) => ({ ...prev, rank: actionType === "dropped" ? prev.rank : newRank, is_active: actionType === "dropped" ? false : prev.is_active }));
      await selectCadet({ ...selectedCadet, rank: actionType === "dropped" ? selectedCadet.rank : newRank });
      setConfirm(false);
    } catch (e) {
      setError(e.message);
      setConfirm(false);
    }
    setSubmitting(false);
  }

  const needsReason = actionType === "dropped" || actionType === "rank_change";
  const canSubmit = newRank && (!needsReason || reason.trim().length > 0);

  return (
    <div style={{ display: "flex", gap: "1.25rem" }}>
      {/* Left — search */}
      <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1rem" }}>
          <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>Search Cadet</p>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or enrollment…"
            style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", width: "100%", boxSizing: "border-box" }} />
        </div>
        <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", overflow: "hidden", flex: 1 }}>
          {searching && <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)", textAlign: "center", padding: "2rem" }}>Searching…</p>}
          {!searching && query && results.length === 0 && <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-text-muted)", textAlign: "center", padding: "2rem" }}>No cadets found.</p>}
          {!searching && !query && <p style={{ ...MONO, fontSize: "0.72rem", color: "var(--csi-border-input)", textAlign: "center", padding: "2rem" }}>Type to search.</p>}
          {results.map((c) => {
            const sel = selectedCadet?.id === c.id;
            return (
              <button key={c.id} onClick={() => selectCadet(c)}
                style={{ width: "100%", textAlign: "left", background: sel ? "rgba(79,70,229,0.2)" : "none", border: "none", borderBottom: "1px solid var(--csi-bg-input)", padding: "0.75rem 1rem", cursor: "pointer", borderLeft: sel ? "2px solid #6366f1" : "2px solid transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: sel ? "#4f46e5" : "var(--csi-bg-input)", border: `1px solid ${sel ? "#6366f1" : "var(--csi-border-input)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 700, color: sel ? "white" : "#64748b", flexShrink: 0 }}>{initials(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: sel ? "white" : "#e2e8f0", fontSize: "0.8rem", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                    <p style={{ ...MONO, color: "var(--csi-text-muted)", fontSize: "0.62rem", margin: 0 }}>{c.enrollment_no} · {c.rank} · Cat {c.category}</p>
                  </div>
                  {!c.is_active && <span style={{ ...MONO, fontSize: "0.5rem", background: "#451a03", border: "1px solid #92400e", color: "#fbbf24", borderRadius: "0.2rem", padding: "0.05rem 0.3rem" }}>Inactive</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — action + history */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
        {!selectedCadet ? (
          <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎖</div>
              <p style={{ ...MONO, color: "var(--csi-text-muted)", fontSize: "0.82rem" }}>Search and select a cadet to manage their rank.</p>
            </div>
          </div>
        ) : (
          <>
            {success && (
              <div style={{ background: "#14532d", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ ...MONO, fontSize: "0.75rem", color: "#86efac", margin: 0 }}>✓ {success}</p>
                <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "#86efac", cursor: "pointer" }}>×</button>
              </div>
            )}
            {error && <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: "0.75rem", padding: "0.75rem 1rem" }}><p style={{ ...MONO, fontSize: "0.75rem", color: "#fca5a5", margin: 0 }}>⚠ {error}</p></div>}

            {/* Cadet header */}
            <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 52, height: 52, borderRadius: "0.75rem", background: "linear-gradient(135deg,#1e293b,#0f172a)", border: "2px solid #334155", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ ...SYNE, fontSize: "1.1rem", fontWeight: 800, color: "#6366f1" }}>{initials(selectedCadet.name)}</span>
                </div>
                <div>
                  <h3 style={{ ...SYNE, fontSize: "1.1rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: "0 0 0.25rem" }}>{selectedCadet.name}</h3>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {[selectedCadet.enrollment_no, `Cat ${selectedCadet.category}`, selectedCadet.division, !selectedCadet.is_active ? "Inactive" : "Active"].map((t, i) => (
                      <span key={i} style={{ ...MONO, fontSize: "0.62rem", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: i === 3 && !selectedCadet.is_active ? "#fca5a5" : "#94a3b8", borderRadius: "0.25rem", padding: "0.15rem 0.45rem" }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <p style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.2rem" }}>Current Rank</p>
                  <p style={{ ...SYNE, fontSize: "1.6rem", fontWeight: 800, color: "#818cf8", margin: 0 }}>{selectedCadet.rank}</p>
                </div>
              </div>
            </div>

            {/* Action form */}
            {selectedCadet.is_active && (
              <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1.25rem" }}>
                <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Rank Action</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                  {/* Action type */}
                  <div>
                    <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>Action</p>
                    <div style={{ display: "flex", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
                      {[
                        { val: "rank_promotion", label: "Promote" },
                        { val: "rank_change", label: "Change" },
                        { val: "dropped", label: "Drop Cadet" },
                      ].map(({ val, label }) => (
                        <button key={val} onClick={() => setActionType(val)}
                          style={{ ...MONO, fontSize: "0.68rem", padding: "0.45rem 0.85rem", border: "none", cursor: "pointer", transition: "all 0.1s", fontWeight: actionType === val ? 700 : 400, background: actionType === val ? (val === "dropped" ? "#b91c1c" : "#4f46e5") : "var(--csi-bg-input)", color: actionType === val ? "white" : "#64748b" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* New rank (not shown for dropped) */}
                  {actionType !== "dropped" && (
                    <div>
                      <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>New Rank</p>
                      <div style={{ display: "flex", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
                        {RANKS.map((r) => (
                          <button key={r} onClick={() => setNewRank(r)}
                            style={{ ...MONO, fontSize: "0.65rem", padding: "0.45rem 0.7rem", border: "none", cursor: "pointer", transition: "all 0.1s", background: newRank === r ? "#4f46e5" : r === selectedCadet.rank ? "#1e3a5f" : "var(--csi-bg-input)", color: newRank === r ? "white" : r === selectedCadet.rank ? "#818cf8" : "#64748b", fontWeight: newRank === r ? 700 : 400 }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reason field */}
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                    Reason {needsReason ? <span style={{ color: "#f87171" }}>*</span> : "(optional)"}
                  </p>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder={actionType === "dropped" ? "Required — explain why this cadet is being dropped…" : "Optional — note for this rank change…"}
                    rows={3}
                    style={{ background: "var(--csi-bg-input)", border: `1px solid ${needsReason && !reason.trim() ? "#b91c1c" : "var(--csi-border-input)"}`, color: "var(--csi-text-primary)", fontSize: "0.78rem", borderRadius: "0.5rem", padding: "0.6rem 0.75rem", width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
                </div>

                <button onClick={() => setConfirm(true)} disabled={!canSubmit || submitting}
                  style={{ background: canSubmit ? (actionType === "dropped" ? "#b91c1c" : "#4f46e5") : "var(--csi-bg-input)", border: "none", color: canSubmit ? "white" : "#475569", fontSize: "0.82rem", fontWeight: 700, borderRadius: "0.5rem", padding: "0.6rem 1.5rem", cursor: canSubmit ? "pointer" : "not-allowed", ...MONO }}>
                  {submitting ? "Processing…" : actionType === "dropped" ? "Drop Cadet" : "Update Rank"}
                </button>
              </div>
            )}

            {/* Promotion history */}
            <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1.25rem" }}>
              <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Promotion History</p>
              {historyLoading ? (
                <p style={{ ...MONO, fontSize: "0.75rem", color: "var(--csi-border-input)", textAlign: "center", padding: "1.5rem" }}>Loading…</p>
              ) : history.length === 0 ? (
                <p style={{ ...MONO, fontSize: "0.75rem", color: "var(--csi-border-input)", textAlign: "center", padding: "1.5rem" }}>No history yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {history.map((h) => {
                    const col = actionColor(h.action_type);
                    return (
                      <div key={h.id} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: "0.6rem", padding: "0.7rem 0.9rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ ...MONO, fontSize: "0.62rem", color: col.text, fontWeight: 700 }}>{actionLabel(h.action_type)}</span>
                        {h.from_rank && h.to_rank && h.from_rank !== h.to_rank && (
                          <span style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-sub)" }}>{h.from_rank} → {h.to_rank}</span>
                        )}
                        {h.from_category && h.to_category && h.from_category !== h.to_category && (
                          <span style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-sub)" }}>Cat {h.from_category} → Cat {h.to_category}</span>
                        )}
                        {h.reason && <span style={{ fontSize: "0.72rem", color: "var(--csi-text-muted)", fontStyle: "italic" }}>"{h.reason}"</span>}
                        <span style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)", marginLeft: "auto" }}>{new Date(h.performed_at).toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={actionType === "dropped" ? "Drop Cadet" : "Update Rank"}
          message={actionType === "dropped"
            ? `${selectedCadet.name} will be marked inactive. Reason: "${reason}"`
            : `${selectedCadet.name}'s rank will change from ${selectedCadet.rank} to ${newRank}.`}
          warning={actionType === "dropped" ? "This will set the cadet as inactive immediately." : null}
          onConfirm={handleSubmit}
          onCancel={() => { if (!submitting) setConfirm(false); }}
          submitting={submitting}
          progressLabel={actionType === "dropped" ? "Dropping cadet…" : `Updating rank to ${newRank}…`}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 3 — NEW A INTAKE
───────────────────────────────────────── */
const EMPTY_FORM = {
  enrollment_no: "", name: "", father_name: "", rank: "CDT", category: "A",
  division: "SD", mobile_no: "", email: "", blood_group: "", date_of_birth: "",
  roll_no: "", branch: "", intake_year: String(CURRENT_YEAR),
  camps_attended: "", national_camps: "", achievement_links: "", id_photo_link: "",
};

/* ── Shared form style constants — module scope so Field + TabNewIntake both access ── */
const inputStyle    = { background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", width: "100%", boxSizing: "border-box" };
const inputErrStyle = { ...inputStyle, borderColor: "#ef4444" };
const labelStyle    = { ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.3rem", display: "block" };
const hintStyle     = { ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)", marginTop: "0.2rem" };
const errStyle      = { ...MONO, fontSize: "0.6rem", color: "#f87171", marginTop: "0.2rem" };

/* ── Field wrapper — defined OUTSIDE TabNewIntake to prevent remount on rerender ── */
function Field({ label, hint, error, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && !error && <p style={hintStyle}>{hint}</p>}
      {error && <p style={errStyle}>⚠ {error}</p>}
    </div>
  );
}

function TabNewIntake() {
  const [mode, setMode] = useState("register"); // register | edit
  const [subMode, setSubMode] = useState("single"); // single | bulk (only in register)
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  /* edit-mode search */
  const [editSearch, setEditSearch]   = useState("");
  const [editResults, setEditResults] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [editForm, setEditForm]       = useState({});
  const [editErrors, setEditErrors]   = useState({});
  const editDebounce = useRef(null);

  /* bulk CSV */
  const [csvText, setCsvText]       = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError]     = useState(null);
  const fileRef = useRef(null);

  function setField(k, v) {
    // Auto-uppercase for name and father_name
    if (k === "name" || k === "father_name") v = v.toUpperCase();
    setForm(p => ({ ...p, [k]: v }));
    setFormErrors(p => ({ ...p, [k]: null }));
  }
  function setEditField(k, v) {
    if (k === "name" || k === "father_name") v = v.toUpperCase();
    setEditForm(p => ({ ...p, [k]: v }));
    setEditErrors(p => ({ ...p, [k]: null }));
  }

  /* ── Enrollment No generator ── */
  function generateEnrollment(division, year) {
    const y = year || String(CURRENT_YEAR);
    const div = division === "SW" ? "SWA" : "SDA";
    return `AP/${y}/${div}/`;
  }

  /* ── Enrollment validation ── */
  function validateEnrollment(val) {
    if (!val.trim()) return "Enrollment number is required.";
    // Accept both formats:
    // AP/YYYY/SDA/NNNNNN  or  APYYYYSDIAXXXXXXX
    const fmt1 = /^AP\/\d{4}\/(SD|SW)A\/\d+$/i;
    const fmt2 = /^AP\d{4}SD[IA]A?\d+$/i;
    if (!fmt1.test(val) && !fmt2.test(val))
      return "Format: AP/2023/SDA/418617 or AP2024SDIA0130026";
    return null;
  }

  function validateMobile(val) {
    if (!val) return null; // optional
    if (!/^\d{10}$/.test(val)) return "Must be exactly 10 digits.";
    return null;
  }

  function validateEmail(val) {
    if (!val) return null; // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Invalid email format.";
    return null;
  }

  function validateDOB(val) {
    if (!val) return null;
    const d = new Date(val);
    const now = new Date();
    if (d >= now) return "Date of birth must be in the past.";
    return null;
  }

  function validateForm(f) {
    const errs = {};
    const en = validateEnrollment(f.enrollment_no);
    if (en) errs.enrollment_no = en;
    if (!f.name.trim()) errs.name = "Name is required.";
    const mob = validateMobile(f.mobile_no);
    if (mob) errs.mobile_no = mob;
    const em = validateEmail(f.email);
    if (em) errs.email = em;
    const dob = validateDOB(f.date_of_birth);
    if (dob) errs.date_of_birth = dob;
    return errs;
  }

  /* ── CSV parse ── */
  function parseCsv(text) {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setCsvError("CSV must have a header row and at least one data row."); return; }
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    });
    setCsvPreview(rows); setCsvError(null);
  }
  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const t = ev.target.result; setCsvText(t); parseCsv(t); };
    reader.readAsText(file);
  }

  /* ── Submit single registration ── */
  async function submitSingle() {
    const errs = validateForm(form);
    if (Object.keys(errs).length) { setFormErrors(errs); setError("Please fix the errors below."); return; }
    setSubmitting(true); setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const payload = {
        ...form,
        name: form.name.toUpperCase(),
        father_name: form.father_name ? form.father_name.toUpperCase() : null,
        is_active: true, status: "active",
        intake_year: parseInt(form.intake_year) || CURRENT_YEAR,
        mobile_no: form.mobile_no || null,
        email: form.email || null,
        blood_group: form.blood_group || null,
        date_of_birth: form.date_of_birth || null,
        roll_no: form.roll_no || null,
        branch: form.branch || null,
        camps_attended: form.camps_attended || null,
        national_camps: form.national_camps || null,
        achievement_links: form.achievement_links || null,
        id_photo_link: form.id_photo_link || null,
      };
      const { data: inserted, error: insErr } = await supabase.from("cadets").insert(payload).select("id").single();
      if (insErr) throw new Error(insErr.message);
      await supabase.from("promotion_log").insert({
        cadet_id: inserted.id, action_type: "batch_intake",
        to_category: "A", to_rank: "CDT", performed_by: user.id,
      });
      setSuccess(`${form.name} registered successfully as Cadet (CDT), Category A.`);
      setForm(EMPTY_FORM); setFormErrors({});
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  }

  /* ── Submit bulk CSV ── */
  async function submitBulk() {
    if (!csvPreview.length) { setError("No CSV data to import."); return; }
    setSubmitting(true); setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const payload = csvPreview.map(r => ({
        enrollment_no: r.enrollment_no ?? "",
        name: (r.name ?? "").toUpperCase(),
        father_name: r.father_name ? r.father_name.toUpperCase() : null,
        rank: r.rank || "CDT", category: "A",
        division: r.division || "SD",
        mobile_no: r.mobile_no || null,
        email: r.email || null,
        blood_group: r.blood_group || null,
        date_of_birth: r.date_of_birth || null,
        roll_no: r.roll_no || null,
        branch: r.branch || null,
        intake_year: parseInt(r.intake_year) || CURRENT_YEAR,
        is_active: true, status: "active",
      }));
      const { data: inserted, error: insErr } = await supabase.from("cadets").insert(payload).select("id");
      if (insErr) throw new Error(insErr.message);
      const logRows = inserted.map(c => ({ cadet_id: c.id, action_type: "batch_intake", to_category: "A", to_rank: "CDT", performed_by: user.id }));
      await supabase.from("promotion_log").insert(logRows);
      setSuccess(`${inserted.length} cadets imported successfully.`);
      setCsvPreview([]); setCsvText("");
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  }

  /* ── Edit mode: search cadets ── */
  useEffect(() => {
    if (mode !== "edit") return;
    clearTimeout(editDebounce.current);
    editDebounce.current = setTimeout(async () => {
      if (!editSearch.trim()) { setEditResults([]); return; }
      setEditLoading(true);
      const { data } = await supabase.from("cadets")
        .select("id,name,enrollment_no,rank,category,division,is_active")
        .or(`name.ilike.%${editSearch}%,enrollment_no.ilike.%${editSearch}%`)
        .limit(15);
      setEditResults(data || []);
      setEditLoading(false);
    }, 350);
    return () => clearTimeout(editDebounce.current);
  }, [editSearch, mode]);

  async function selectForEdit(c) {
    const { data } = await supabase.from("cadets").select("*").eq("id", c.id).single();
    setEditTarget(data);
    setEditForm({ ...data, date_of_birth: data.date_of_birth?.slice(0,10) ?? "" });
    setEditErrors({});
  }

  async function submitEdit() {
    const errs = {};
    const mob = validateMobile(editForm.mobile_no);
    if (mob) errs.mobile_no = mob;
    const em = validateEmail(editForm.email);
    if (em) errs.email = em;
    const dob = validateDOB(editForm.date_of_birth);
    if (dob) errs.date_of_birth = dob;
    if (!editForm.name?.trim()) errs.name = "Name is required.";
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setSubmitting(true); setError(null);
    try {
      const payload = {
        name: editForm.name?.toUpperCase(),
        father_name: editForm.father_name ? editForm.father_name.toUpperCase() : null,
        rank: editForm.rank,
        category: editForm.category,
        division: editForm.division,
        mobile_no: editForm.mobile_no || null,
        email: editForm.email || null,
        blood_group: editForm.blood_group || null,
        date_of_birth: editForm.date_of_birth || null,
        roll_no: editForm.roll_no || null,
        branch: editForm.branch || null,
        intake_year: parseInt(editForm.intake_year) || null,
        camps_attended: editForm.camps_attended || null,
        national_camps: editForm.national_camps || null,
        achievement_links: editForm.achievement_links || null,
        id_photo_link: editForm.id_photo_link || null,
        is_active: editForm.is_active,
        status: editForm.status || "active",
        passout_year: editForm.passout_year ? parseInt(editForm.passout_year) : null,
        drop_reason: editForm.drop_reason || null,
      };
      const { error: upErr } = await supabase.from("cadets").update(payload).eq("id", editTarget.id);
      if (upErr) throw new Error(upErr.message);
      setSuccess(`${editForm.name} updated successfully.`);
      setEditTarget(null); setEditForm({}); setEditSearch(""); setEditResults([]);
    } catch (e) { setError(e.message); }
    setSubmitting(false);
  }

  /* ── Styles ── */
  /* styles moved to module scope — see above TabNewIntake */

  /* ── Registration form fields ── */
  const REGISTER_FIELDS = [
    {
      key: "enrollment_no", label: "Enrollment No", required: true,
      hint: "Format: AP/2023/SDA/418617 · AP/2023/SWA/418617 · AP2024SDIA0130026",
      render: (val, onChange, err) => (
        <div style={{ display:"flex", gap:"0.4rem" }}>
          <input value={val}
            onChange={e => {
              const v = e.target.value.toUpperCase().replace(/[^AP0-9/]/g,"");
              onChange(v);
            }}
            placeholder="AP/2026/SDA/418617"
            style={err ? inputErrStyle : inputStyle} />
          <button type="button"
            onClick={() => onChange(generateEnrollment(form.division, form.intake_year))}
            title="Auto-fill prefix"
            style={{ ...MONO, fontSize:"0.65rem", background:"#1e3a5f", border:"1px solid var(--csi-border-input)", color:"#93c5fd", borderRadius:"0.5rem", padding:"0 0.6rem", cursor:"pointer", whiteSpace:"nowrap" }}>
            Auto
          </button>
        </div>
      )
    },
    {
      key: "name", label: "Full Name", required: true,
      hint: "Auto-converted to UPPERCASE",
      render: (val, onChange, err) => (
        <input value={val} onChange={e => onChange(e.target.value)}
          placeholder="CADET FULL NAME"
          style={err ? inputErrStyle : inputStyle} />
      )
    },
    {
      key: "father_name", label: "Father's Name",
      hint: "Auto-converted to UPPERCASE",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value)}
          placeholder="FATHER NAME"
          style={inputStyle} />
      )
    },
    {
      key: "division", label: "Division", required: true,
      render: (val, onChange) => (
        <div style={{ display:"flex", gap:"0.5rem" }}>
          {["SD","SW"].map(d => (
            <button key={d} type="button" onClick={() => onChange(d)}
              style={{ flex:1, ...MONO, fontSize:"0.75rem", padding:"0.45rem", borderRadius:"0.5rem", border:"1px solid", cursor:"pointer",
                background: val===d ? "#1e3a5f" : "var(--csi-bg-input)",
                borderColor: val===d ? "#3b82f6" : "var(--csi-border-input)",
                color: val===d ? "#93c5fd" : "#64748b", fontWeight: val===d ? 700 : 400 }}>
              {d}
            </button>
          ))}
        </div>
      )
    },
    {
      key: "intake_year", label: "Intake Year", required: true,
      hint: "Year of joining NCC (e.g. 2026)",
      render: (val, onChange) => (
        <input type="number" value={val} onChange={e => onChange(e.target.value)}
          min="2010" max="2040" placeholder={String(CURRENT_YEAR)}
          style={inputStyle} />
      )
    },
    {
      key: "roll_no", label: "College Roll No",
      hint: "Format: 23KB1A04D0 (YY + KB + 1A regular/5A lateral + branch + roll)",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value.toUpperCase())}
          placeholder="23KB1A04D0" style={inputStyle} />
      )
    },
    {
      key: "branch", label: "Branch / Department",
      hint: "Select college branch",
      render: (val, onChange) => (
        <select value={val} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">— Select Branch —</option>
          {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      )
    },
    {
      key: "mobile_no", label: "Mobile No",
      hint: "10-digit Indian mobile number",
      render: (val, onChange, err) => (
        <input value={val} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0,10))}
          placeholder="9876543210" maxLength={10}
          style={err ? inputErrStyle : inputStyle} />
      )
    },
    {
      key: "email", label: "Email ID",
      hint: "College or personal email",
      render: (val, onChange, err) => (
        <input type="email" value={val} onChange={e => onChange(e.target.value.toLowerCase())}
          placeholder="cadet@college.edu"
          style={err ? inputErrStyle : inputStyle} />
      )
    },
    {
      key: "date_of_birth", label: "Date of Birth",
      render: (val, onChange, err) => (
        <input type="date" value={val} onChange={e => onChange(e.target.value)}
          max={new Date().toISOString().slice(0,10)}
          style={err ? inputErrStyle : inputStyle} />
      )
    },
    {
      key: "blood_group", label: "Blood Group",
      render: (val, onChange) => (
        <select value={val} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">— Select —</option>
          {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      )
    },
    {
      key: "camps_attended", label: "Camps Attended",
      hint: "e.g. ATC, RDC, NIC",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value)} placeholder="ATC 2024, RDC 2025" style={inputStyle} />
      )
    },
    {
      key: "national_camps", label: "National Camps",
      hint: "National-level camps / Republic Day",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value)} placeholder="RDC 2025" style={inputStyle} />
      )
    },
    {
      key: "achievement_links", label: "Achievement Links",
      hint: "URL to certificates or portfolio",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value)} placeholder="https://drive.google.com/…" style={inputStyle} />
      )
    },
    {
      key: "id_photo_link", label: "Photo Link",
      hint: "URL to cadet's ID photo",
      render: (val, onChange) => (
        <input value={val} onChange={e => onChange(e.target.value)} placeholder="https://…" style={inputStyle} />
      )
    },
  ];

  /* ── Edit form fields (all DB columns) ── */
  const EDIT_FIELDS = [
    { key:"name",             label:"Full Name",         required:true, hint:"Auto-UPPERCASE" },
    { key:"father_name",      label:"Father's Name",     hint:"Auto-UPPERCASE" },
    { key:"rank",             label:"Rank",              type:"rank_select" },
    { key:"category",         label:"Category",          type:"cat_select" },
    { key:"division",         label:"Division",          type:"div_select" },
    { key:"roll_no",          label:"College Roll No" },
    { key:"branch",           label:"Branch",            type:"branch_select" },
    { key:"mobile_no",        label:"Mobile No",         hint:"10 digits" },
    { key:"email",            label:"Email ID",          hint:"Valid email format" },
    { key:"date_of_birth",    label:"Date of Birth",     type:"date" },
    { key:"blood_group",      label:"Blood Group",       type:"blood_select" },
    { key:"intake_year",      label:"Intake Year",       type:"year_select" },
    { key:"camps_attended",   label:"Camps Attended" },
    { key:"national_camps",   label:"National Camps" },
    { key:"achievement_links",label:"Achievement Links" },
    { key:"id_photo_link",    label:"Photo Link" },
    { key:"is_active",        label:"Active Status",     type:"active_select" },
    { key:"status",           label:"Status",            type:"status_select" },
    { key:"passout_year",     label:"Passout Year",      hint:"Fill if cadet has passed out" },
    { key:"drop_reason",      label:"Drop Reason",       hint:"Fill if cadet was dropped" },
  ];

  function renderEditInput(f) {
    const val = editForm[f.key] ?? "";
    const err = editErrors[f.key];
    const is = err ? inputErrStyle : inputStyle;
    switch(f.type) {
      case "rank_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}>{RANKS.map(r=><option key={r} value={r}>{r}</option>)}</select>;
      case "cat_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}>{["A","B","C"].map(c=><option key={c} value={c}>{c}</option>)}</select>;
      case "div_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}>{["SD","SW"].map(d=><option key={d} value={d}>{d}</option>)}</select>;
      case "branch_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}><option value="">— Select —</option>{BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}</select>;
      case "blood_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}><option value="">— Select —</option>{BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}</select>;
      case "year_select":
        return <input type="number" value={val} onChange={e=>setEditField(f.key,e.target.value)} min="2010" max="2040" placeholder={String(CURRENT_YEAR)} style={is}/>;
      case "date":
        return <input type="date" value={val} onChange={e=>setEditField(f.key,e.target.value)} max={new Date().toISOString().slice(0,10)} style={is}/>;
      case "active_select":
        return <select value={String(val)} onChange={e=>setEditField(f.key,e.target.value==="true")} style={is}><option value="true">Active</option><option value="false">Inactive</option></select>;
      case "status_select":
        return <select value={val} onChange={e=>setEditField(f.key,e.target.value)} style={is}>{["active","passout","dropped"].map(s=><option key={s} value={s}>{s}</option>)}</select>;
      default:
        return <input value={val}
          onChange={e=>{
            let v = e.target.value;
            if(f.key==="name"||f.key==="father_name") v=v.toUpperCase();
            if(f.key==="mobile_no") v=v.replace(/\D/g,"").slice(0,10);
            if(f.key==="email") v=v.toLowerCase();
            setEditField(f.key,v);
          }}
          style={is}/>;
    }
  }

  const cardStyle = { background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1.5rem" };
  const sectionTitle = { ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" };

  return (
    <div>
      {/* ── Mode toggle ── */}
      <div style={{ display:"flex", gap:"0.75rem", marginBottom:"1.5rem", flexWrap:"wrap", alignItems:"center" }}>
        {[
          { val:"register", label:"➕  Register New Cadet" },
          { val:"edit",     label:"✏️  Update Cadet Details" },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => { setMode(val); setError(null); setSuccess(null); }}
            style={{ ...MONO, fontSize:"0.75rem", padding:"0.55rem 1.2rem", border:"1px solid",
              borderRadius:"0.6rem", cursor:"pointer",
              background: mode===val ? "#312e81" : "var(--csi-bg-input)",
              borderColor: mode===val ? "#6366f1" : "var(--csi-border-input)",
              color: mode===val ? "#a5b4fc" : "#64748b",
              fontWeight: mode===val ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Alerts ── */}
      {success && (
        <div style={{ background:"#14532d", border:"1px solid #15803d", borderRadius:"0.75rem", padding:"0.75rem 1rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between" }}>
          <p style={{ ...MONO, fontSize:"0.75rem", color:"#86efac", margin:0 }}>✓ {success}</p>
          <button onClick={()=>setSuccess(null)} style={{ background:"none", border:"none", color:"#86efac", cursor:"pointer", fontSize:"1rem" }}>×</button>
        </div>
      )}
      {error && (
        <div style={{ background:"#450a0a", border:"1px solid #b91c1c", borderRadius:"0.75rem", padding:"0.75rem 1rem", marginBottom:"1rem" }}>
          <p style={{ ...MONO, fontSize:"0.75rem", color:"#fca5a5", margin:0 }}>⚠ {error}</p>
        </div>
      )}

      {/* ══════════════════════════════════════
          MODE: REGISTER
      ══════════════════════════════════════ */}
      {mode === "register" && (
        <div>
          {/* Sub-mode: single / bulk */}
          <div style={{ display:"flex", borderRadius:"0.6rem", overflow:"hidden", border:"1px solid var(--csi-border-input)", width:"fit-content", marginBottom:"1.5rem" }}>
            {[{ val:"single", label:"Single Registration" },{ val:"bulk", label:"Bulk CSV Import" }].map(({ val, label }) => (
              <button key={val} onClick={() => setSubMode(val)}
                style={{ ...MONO, fontSize:"0.72rem", padding:"0.5rem 1.1rem", border:"none", cursor:"pointer",
                  background: subMode===val ? "#4f46e5" : "var(--csi-bg-input)",
                  color: subMode===val ? "white" : "#64748b",
                  fontWeight: subMode===val ? 700 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {subMode === "single" ? (
            <div style={cardStyle}>
              <p style={sectionTitle}>New Cadet — Category A · Rank CDT (default)</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"1.1rem", marginBottom:"1.75rem" }}>

                {/* Enrollment No */}
                <Field label="Enrollment No *" hint="Format: AP/2023/SDA/418617 · AP/2023/SWA/418617" error={formErrors.enrollment_no}>
                  <div style={{ display:"flex", gap:"0.4rem" }}>
                    <input value={form.enrollment_no}
                      onChange={e => setField("enrollment_no", e.target.value.toUpperCase().replace(/[^AP0-9/]/g,""))}
                      placeholder="AP/2026/SDA/418617"
                      style={formErrors.enrollment_no ? inputErrStyle : inputStyle} />
                    <button type="button"
                      onClick={() => setField("enrollment_no", generateEnrollment(form.division, form.intake_year))}
                      style={{ ...MONO, fontSize:"0.65rem", background:"#1e3a5f", border:"1px solid var(--csi-border-input)", color:"#93c5fd", borderRadius:"0.5rem", padding:"0 0.6rem", cursor:"pointer", whiteSpace:"nowrap" }}>
                      Auto
                    </button>
                  </div>
                </Field>

                {/* Full Name */}
                <Field label="Full Name *" hint="Auto-converted to UPPERCASE" error={formErrors.name}>
                  <input value={form.name}
                    onChange={e => setField("name", e.target.value)}
                    placeholder="CADET FULL NAME"
                    style={formErrors.name ? inputErrStyle : inputStyle} />
                </Field>

                {/* Father Name */}
                <Field label="Father's Name" hint="Auto-converted to UPPERCASE">
                  <input value={form.father_name}
                    onChange={e => setField("father_name", e.target.value)}
                    placeholder="FATHER NAME"
                    style={inputStyle} />
                </Field>

                {/* Division */}
                <Field label="Division *">
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    {["SD","SW"].map(d => (
                      <button key={d} type="button" onClick={() => setField("division", d)}
                        style={{ flex:1, ...MONO, fontSize:"0.75rem", padding:"0.45rem", borderRadius:"0.5rem", border:"1px solid", cursor:"pointer",
                          background: form.division===d ? "#1e3a5f" : "var(--csi-bg-input)",
                          borderColor: form.division===d ? "#3b82f6" : "var(--csi-border-input)",
                          color: form.division===d ? "#93c5fd" : "#64748b",
                          fontWeight: form.division===d ? 700 : 400 }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Intake Year */}
                <Field label="Intake Year *" hint="Year of joining NCC (e.g. 2026)">
                  <input type="number" value={form.intake_year}
                    onChange={e => setField("intake_year", e.target.value)}
                    min="2010" max="2040" placeholder={String(CURRENT_YEAR)}
                    style={inputStyle} />
                </Field>

                {/* Roll No */}
                <Field label="College Roll No" hint="Format: 23KB1A04D0">
                  <input value={form.roll_no}
                    onChange={e => setField("roll_no", e.target.value.toUpperCase())}
                    placeholder="23KB1A04D0" style={inputStyle} />
                </Field>

                {/* Branch */}
                <Field label="Branch / Department" hint="Select college branch">
                  <select value={form.branch} onChange={e => setField("branch", e.target.value)} style={inputStyle}>
                    <option value="">— Select Branch —</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>

                {/* Mobile */}
                <Field label="Mobile No" hint="10-digit Indian mobile number" error={formErrors.mobile_no}>
                  <input value={form.mobile_no}
                    onChange={e => setField("mobile_no", e.target.value.replace(/\D/g,"").slice(0,10))}
                    placeholder="9876543210" maxLength={10}
                    style={formErrors.mobile_no ? inputErrStyle : inputStyle} />
                </Field>

                {/* Email */}
                <Field label="Email ID" hint="College or personal email" error={formErrors.email}>
                  <input type="email" value={form.email}
                    onChange={e => setField("email", e.target.value.toLowerCase())}
                    placeholder="cadet@college.edu"
                    style={formErrors.email ? inputErrStyle : inputStyle} />
                </Field>

                {/* DOB */}
                <Field label="Date of Birth" error={formErrors.date_of_birth}>
                  <input type="date" value={form.date_of_birth}
                    onChange={e => setField("date_of_birth", e.target.value)}
                    max={new Date().toISOString().slice(0,10)}
                    style={formErrors.date_of_birth ? inputErrStyle : inputStyle} />
                </Field>

                {/* Blood Group */}
                <Field label="Blood Group">
                  <select value={form.blood_group} onChange={e => setField("blood_group", e.target.value)} style={inputStyle}>
                    <option value="">— Select —</option>
                    {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>

                {/* Camps Attended */}
                <Field label="Camps Attended" hint="e.g. ATC, RDC, NIC">
                  <input value={form.camps_attended}
                    onChange={e => setField("camps_attended", e.target.value)}
                    placeholder="ATC 2024, RDC 2025" style={inputStyle} />
                </Field>

                {/* National Camps */}
                <Field label="National Camps" hint="National-level camps / Republic Day">
                  <input value={form.national_camps}
                    onChange={e => setField("national_camps", e.target.value)}
                    placeholder="RDC 2025" style={inputStyle} />
                </Field>

                {/* Achievement Links */}
                <Field label="Achievement Links" hint="URL to certificates or portfolio">
                  <input value={form.achievement_links}
                    onChange={e => setField("achievement_links", e.target.value)}
                    placeholder="https://drive.google.com/…" style={inputStyle} />
                </Field>

                {/* Photo Link */}
                <Field label="Photo Link" hint="URL to cadet's ID photo">
                  <input value={form.id_photo_link}
                    onChange={e => setField("id_photo_link", e.target.value)}
                    placeholder="https://…" style={inputStyle} />
                </Field>

              </div>
              <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>
                <button onClick={submitSingle} disabled={submitting}
                  style={{ background:"#4f46e5", border:"none", color:"white", fontSize:"0.82rem", fontWeight:700,
                    borderRadius:"0.5rem", padding:"0.65rem 1.75rem", cursor:"pointer", ...MONO }}>
                  {submitting ? "Registering…" : "Register Cadet"}
                </button>
                <button onClick={() => { setForm(EMPTY_FORM); setFormErrors({}); setError(null); }}
                  style={{ background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", color:"#94a3b8",
                    fontSize:"0.75rem", fontWeight:600, borderRadius:"0.5rem", padding:"0.65rem 1.1rem", cursor:"pointer", ...MONO }}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              <div style={{ background:"#0f1623", border:"2px dashed #334155", borderRadius:"1rem", padding:"2.5rem", textAlign:"center", cursor:"pointer" }}
                onClick={() => fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
                <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>📄</div>
                <p style={{ ...MONO, fontSize:"0.78rem", color:"#64748b" }}>Click to upload CSV file</p>
                <p style={{ ...MONO, fontSize:"0.62rem", color:"var(--csi-border-input)", marginTop:"0.35rem" }}>
                  Required columns: enrollment_no, name, division<br/>
                  Optional: father_name, roll_no, branch, mobile_no, email, date_of_birth, blood_group, intake_year, camps_attended
                </p>
              </div>
              {csvError && <div style={{ background:"#450a0a", border:"1px solid #b91c1c", borderRadius:"0.75rem", padding:"0.75rem 1rem" }}><p style={{ ...MONO, fontSize:"0.75rem", color:"#fca5a5", margin:0 }}>⚠ {csvError}</p></div>}
              {csvPreview.length > 0 && (
                <div style={{ background:"#0f1623", border:"1px solid var(--csi-bg-input)", borderRadius:"1rem", overflow:"hidden" }}>
                  <div style={{ padding:"0.75rem 1rem", borderBottom:"1px solid var(--csi-bg-input)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <p style={{ ...MONO, fontSize:"0.65rem", color:"#475569", textTransform:"uppercase", margin:0 }}>{csvPreview.length} cadets ready to import</p>
                    <button onClick={submitBulk} disabled={submitting}
                      style={{ background:"#4f46e5", border:"none", color:"white", fontSize:"0.72rem", fontWeight:700, borderRadius:"0.4rem", padding:"0.4rem 1rem", cursor:"pointer", ...MONO }}>
                      {submitting ? "Importing…" : "Import All"}
                    </button>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.72rem" }}>
                      <thead>
                        <tr style={{ background:"var(--csi-bg-input)" }}>
                          {Object.keys(csvPreview[0]).map(h => (
                            <th key={h} style={{ textAlign:"left", padding:"0.5rem 0.75rem", color:"#64748b", fontWeight:600, fontSize:"0.62rem", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0, 10).map((row, i) => (
                          <tr key={i} style={{ borderTop:"1px solid var(--csi-bg-input)" }}>
                            {Object.values(row).map((v, j) => (
                              <td key={j} style={{ padding:"0.45rem 0.75rem", color:"#94a3b8", whiteSpace:"nowrap" }}>{v || "—"}</td>
                            ))}
                          </tr>
                        ))}
                        {csvPreview.length > 10 && (
                          <tr style={{ borderTop:"1px solid var(--csi-bg-input)" }}>
                            <td colSpan={Object.keys(csvPreview[0]).length} style={{ padding:"0.5rem 0.75rem", color:"#475569", ...MONO, fontSize:"0.65rem", textAlign:"center" }}>
                              … and {csvPreview.length - 10} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          MODE: EDIT / UPDATE
      ══════════════════════════════════════ */}
      {mode === "edit" && (
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          {/* Search */}
          <div style={cardStyle}>
            <p style={sectionTitle}>Search Cadet to Update</p>
            <input value={editSearch} onChange={e => setEditSearch(e.target.value)}
              placeholder="Search by name or enrollment number…"
              style={{ ...inputStyle, marginBottom:"0.75rem" }} />
            {editLoading && <p style={{ ...MONO, fontSize:"0.72rem", color:"#475569" }}>Searching…</p>}
            {editResults.length > 0 && !editTarget && (
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", maxHeight:"260px", overflowY:"auto" }}>
                {editResults.map(c => (
                  <button key={c.id} onClick={() => selectForEdit(c)}
                    style={{ background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", borderRadius:"0.6rem",
                      padding:"0.6rem 0.9rem", cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ color:"#e2e8f0", fontSize:"0.8rem", fontWeight:600, margin:0 }}>{c.name}</p>
                      <p style={{ ...MONO, color:"#475569", fontSize:"0.62rem", margin:0 }}>{c.enrollment_no} · {c.rank} · Cat {c.category} · {c.division}</p>
                    </div>
                    {!c.is_active && <span style={{ ...MONO, fontSize:"0.6rem", background:"var(--csi-bg-input)", border:"1px solid #475569", borderRadius:"0.3rem", padding:"0.15rem 0.4rem", color:"#64748b" }}>Alumni</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edit form */}
          {editTarget && (
            <div style={cardStyle}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:"0.5rem" }}>
                <div>
                  <p style={{ ...MONO, fontSize:"0.6rem", color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 0.2rem" }}>Editing Cadet</p>
                  <p style={{ ...SYNE, fontSize:"1rem", fontWeight:800, color:"#e2e8f0", margin:0 }}>{editTarget.name}</p>
                  <p style={{ ...MONO, fontSize:"0.65rem", color:"#475569", margin:0 }}>{editTarget.enrollment_no} · {editTarget.rank} · Cat {editTarget.category}</p>
                </div>
                <button onClick={() => { setEditTarget(null); setEditForm({}); setEditSearch(""); setEditResults([]); }}
                  style={{ background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", color:"#94a3b8", fontSize:"0.72rem", borderRadius:"0.5rem", padding:"0.4rem 0.9rem", cursor:"pointer", ...MONO }}>
                  ← Back to Search
                </button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"1.1rem", marginBottom:"1.75rem" }}>
                {EDIT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    {renderEditInput(f)}
                    {f.hint && !editErrors[f.key] && <p style={hintStyle}>{f.hint}</p>}
                    {editErrors[f.key] && <p style={errStyle}>⚠ {editErrors[f.key]}</p>}
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:"0.75rem" }}>
                <button onClick={submitEdit} disabled={submitting}
                  style={{ background:"#4f46e5", border:"none", color:"white", fontSize:"0.82rem", fontWeight:700,
                    borderRadius:"0.5rem", padding:"0.65rem 1.75rem", cursor:"pointer", ...MONO }}>
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => { setEditTarget(null); setEditForm({}); setEditSearch(""); setEditResults([]); setError(null); }}
                  style={{ background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", color:"#94a3b8",
                    fontSize:"0.75rem", fontWeight:600, borderRadius:"0.5rem", padding:"0.65rem 1.1rem", cursor:"pointer", ...MONO }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   TAB 4 — PROMOTION HISTORY
───────────────────────────────────────── */
function TabPromotionHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function fetchLogs() {
    setLoading(true); setError(null);
    let q = supabase
      .from("promotion_log")
      .select(`*, cadets(name, enrollment_no, category, rank)`)
      .order("performed_at", { ascending: false })
      .limit(200);
    if (filterType !== "ALL") q = q.eq("action_type", filterType);
    if (fromDate) q = q.gte("performed_at", fromDate);
    if (toDate) q = q.lte("performed_at", toDate + "T23:59:59");
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setLogs(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) => l.cadets?.name?.toLowerCase().includes(q) || l.cadets?.enrollment_no?.toLowerCase().includes(q));
  }, [logs, search]);

  return (
    <div>
      {/* Filters */}
      <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>Action Type</p>
          <div style={{ display: "flex", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
            {["ALL", "category_promotion", "rank_promotion", "rank_change", "stayed_back", "dropped", "batch_intake"].map((t) => {
              const col = t === "ALL" ? { bg: "#4f46e5", text: "white" } : actionColor(t);
              return (
                <button key={t} onClick={() => setFilterType(t)}
                  style={{ ...MONO, fontSize: "0.6rem", padding: "0.4rem 0.6rem", border: "none", cursor: "pointer", background: filterType === t ? (t === "ALL" ? "#4f46e5" : col.bg) : "var(--csi-bg-input)", color: filterType === t ? (t === "ALL" ? "white" : col.text) : "#475569", transition: "all 0.1s", whiteSpace: "nowrap" }}>
                  {t === "ALL" ? "All" : actionLabel(t)}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>From</p>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.75rem", borderRadius: "0.4rem", padding: "0.4rem 0.6rem" }} />
        </div>
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>To</p>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.75rem", borderRadius: "0.4rem", padding: "0.4rem 0.6rem" }} />
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cadet name or enrollment…"
          style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.78rem", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", width: "220px" }} />
        <button onClick={fetchLogs}
          style={{ background: "#4f46e5", border: "none", color: "var(--csi-text-primary)", fontSize: "0.78rem", fontWeight: 700, borderRadius: "0.5rem", padding: "0.45rem 1.1rem", cursor: "pointer", ...MONO, marginLeft: "auto" }}>
          Refresh
        </button>
      </div>

      {error && <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}><p style={{ ...MONO, fontSize: "0.75rem", color: "#fca5a5", margin: 0 }}>⚠ {error}</p></div>}

      {/* Future trackers placeholder */}
      <div style={{ background: "var(--csi-bg-card)", border: "1px dashed #334155", borderRadius: "1rem", padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Future Promotion Factors — Coming Soon</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          {[
            { icon: "📝", label: "Mock Test Results", desc: "Exam scores by senior cadets" },
            { icon: "🎪", label: "Event Contributions", desc: "Work done in NCC events" },
            { icon: "🏕", label: "Camps Attended", desc: "CATC, ATC, national camps" },
            { icon: "⚠", label: "Conduct Record", desc: "Suspicious activities or warnings" },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.6rem", padding: "0.7rem 0.9rem", minWidth: "160px", opacity: 0.6 }}>
              <p style={{ fontSize: "1rem", margin: "0 0 0.25rem" }}>{icon}</p>
              <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", fontWeight: 700, margin: "0 0 0.15rem" }}>{label}</p>
              <p style={{ fontSize: "0.65rem", color: "var(--csi-border-input)", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Log table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--csi-text-muted)", ...MONO, fontSize: "0.82rem" }} className="animate-pulse">Loading history…</div>
      ) : (
        <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", overflow: "hidden" }}>
          <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--csi-bg-input)" }}>
            <span style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)" }}>{filtered.length} records</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ background: "var(--csi-bg-input)" }}>
                  {["Date", "Cadet", "Action", "From", "To", "Reason"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.6rem 0.85rem", color: "var(--csi-text-muted)", fontWeight: 600, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => {
                  const col = actionColor(l.action_type);
                  return (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--csi-bg-input)", background: i % 2 === 0 ? "transparent" : "var(--csi-bg-row-alt)" }}>
                      <td style={{ padding: "0.6rem 0.85rem", ...MONO, color: "var(--csi-text-muted)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>{new Date(l.performed_at).toLocaleDateString()}</td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        <p style={{  fontWeight: 500, margin: "0 0 0.1rem", color: "var(--csi-text-primary)", fontSize: "0.8rem" }}>{l.cadets?.name ?? "—"}</p>
                        <p style={{ ...MONO, fontSize: "0.62rem", margin: 0 }}>{l.cadets?.enrollment_no}</p>
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem" }}>
                        <span style={{ ...MONO, fontSize: "0.62rem", background: col.bg, border: `1px solid ${col.border}`, color: col.text, borderRadius: "0.25rem", padding: "0.15rem 0.45rem", whiteSpace: "nowrap" }}>
                          {actionLabel(l.action_type)}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: "0.72rem" }}>
                        {(l.from_category || l.from_rank) ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                            {l.from_category && <span style={{ ...MONO, fontSize:"0.62rem", background:"var(--csi-bg-input)", border:"1px solid var(--csi-border-input)", color:"#94a3b8", borderRadius:"0.25rem", padding:"0.1rem 0.35rem", width:"fit-content" }}>Cat {l.from_category}</span>}
                            {l.from_rank && <span style={{ ...MONO, fontSize:"0.62rem", color:"#64748b" }}>{l.from_rank}</span>}
                          </div>
                        ) : <span style={{ color:"var(--csi-border-input)" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", fontSize: "0.72rem" }}>
                        {(l.to_category || l.to_rank) ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                            {l.to_category && <span style={{ ...MONO, fontSize:"0.62rem", background:"#1e3a5f", border:"1px solid #3b82f6", color:"#93c5fd", borderRadius:"0.25rem", padding:"0.1rem 0.35rem", width:"fit-content" }}>Cat {l.to_category}</span>}
                            {l.to_rank && <span style={{ ...MONO, fontSize:"0.62rem", color:"#94a3b8" }}>{l.to_rank}</span>}
                          </div>
                        ) : <span style={{ color:"var(--csi-border-input)" }}>—</span>}
                      </td>
                      <td style={{ padding: "0.6rem 0.85rem", color: "var(--csi-text-muted)", fontSize: "0.75rem", fontStyle: "italic", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.reason ?? "—"}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--csi-border-input)", ...MONO, fontSize: "0.75rem" }}>No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   ROOT — BATCH PROMOTION DASHBOARD
───────────────────────────────────────── */
const TABS = [
  { id: "batch", label: "Batch Promotion" },
  { id: "rank", label: "Rank Change" },
  { id: "intake", label: "Cadet Registry" },
  { id: "history", label: "Promotion History" },
];

export default function BatchPromotion() {
  const [activeTab, setActiveTab] = useState("batch");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .bp-page { background: var(--csi-bg-page); color: var(--csi-text-primary); min-height: 100vh; padding: 1.5rem; transition: background 0.2s, color 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="bp-page">

        {/* Header */}
        <div className="mb-5">
          <p style={{ ...MONO, fontSize: "0.7rem", color: "#818cf8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            NCC Unit Management
          </p>
          <h1 style={{ ...SYNE, fontSize: "1.9rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: 0 }}>
            Batch & Rank Promotion
          </h1>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.75rem", padding: "0.25rem", width: "fit-content" }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ ...MONO, fontSize: "0.75rem", fontWeight: activeTab === tab.id ? 700 : 400, padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", transition: "all 0.15s", background: activeTab === tab.id ? "#4f46e5" : "transparent", color: activeTab === tab.id ? "white" : "#64748b" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "batch" && <TabBatchPromotion />}
        {activeTab === "rank" && <TabRankChange />}
        {activeTab === "intake" && <TabNewIntake />}
        {activeTab === "history" && <TabPromotionHistory />}
      </div>
    </>
  );
}
