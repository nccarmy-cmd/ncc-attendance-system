/**
 * CsiUnitSummary.jsx  — v6
 * ────────────────────────────────────────────────────────────────
 *
 * FIXES IN THIS VERSION
 * ─────────────────────
 * 1. PAGE ALIGNMENT
 *    • .csi-page has NO padding (sidebar wrapper handles outer space)
 *    • .csi-inner adds padding — renders flush to the sidebar edge
 *    • min-width:0 on flex children stops table overflow on desktop
 *
 * 2. PARADE HISTORY TABLE — fully interactive column headers
 *    Each column header shows a small dropdown when clicked:
 *    • Date     → date-range picker (From / To inputs + Apply)
 *    • Session  → Morning / Evening / All  (radio pills)
 *    • Type     → all unique parade types from DB  (radio pills)
 *    • Status   → Present / AbsWP / AbsWOP / All   (radio pills)
 *    • Reason   → all unique reasons from DB        (radio pills)
 *    Active filter chips appear above the table.
 *    Clear × button resets all filters.
 *
 * 3. PARADE RECORD 404 → clear SQL instructions printed in error
 *
 * HOW TO EDIT
 * ───────────
 *  Colors / sizes    → CsiDashboard.css tokens
 *  Rank order        → RANK_ORDER array below
 *  Default range     → DEFAULT_FROM constant below
 *  Tab labels        → TABS array at the bottom
 */

import {
  useEffect, useState, useMemo, useCallback,
  useRef, Fragment,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import "./CsiDashboard.css";

/* ── Constants ── */
const TODAY        = new Date().toISOString().slice(0, 10);
const DEFAULT_FROM = "2026-01-20";
const RANK_ORDER   = ["SUO", "JUO", "CQMS", "SGT", "CPL", "LCPL", "CDT"];

/* ── Helpers ── */
const pctHex  = (p) => p >= 75 ? "var(--csi-green)" : p >= 60 ? "var(--csi-amber)" : "var(--csi-red)";
const pctCls  = (p) => `csi-pct-badge csi-pct-badge--${p>=75?"good":p>=60?"mid":"low"}`;
const stBadge = (s) => `csi-badge csi-badge--${s==="present"?"present":s==="absent_with_permission"?"awp":"awop"}`;
const stLabel = (s) => s==="present"?"Present":s==="absent_with_permission"?"AbsWP":"AbsWOP";
const fmt     = (n) => Number(n??0).toFixed(1);
const ini     = (name) => !name ? "?" : name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();

/* ── Excel export (pure JS, no library) ── */
function exportToExcel(rows, from, to) {
  if (!rows.length) return;
  const H = ["Enrollment No","Name","Rank","Category","Division","Total Parades","Present","Abs WP","Abs WOP","Attendance %"];
  const lines = [H.join("\t"), ...rows.map(r=>[
    r.enrollment_no??"", r.name??"", r.rank??"", r.category??"", r.division??"",
    r.total_parades??0, r.present??0, r.absent_wp??0, r.absent_wop??0,
    fmt(parseFloat(r.present_pct??0)),
  ].join("\t"))];
  const blob = new Blob([lines.join("\n")],{type:"text/tab-separated-values;charset=utf-8;"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`NCC_Unit_Attendance_${from}_to_${to}.xls`;
  a.click();
}

/* ══════════════════════════════════════════════════════════════
   PARADE HISTORY TABLE — clickable column-header dropdowns
   Each column header opens a small filter/sort dropdown.

   Props:
     parades   — array of parade records
     compact   — if true, uses smaller padding (inside popup)
══════════════════════════════════════════════════════════════ */
function ParadeHistoryTable({ parades, compact = false }) {
  /* ── per-column active filter/sort state ── */
  const [dateFrom,   setDateFrom]   = useState("");       /* filter: from date */
  const [dateTo,     setDateTo]     = useState("");       /* filter: to date   */
  const [dateDir,    setDateDir]    = useState("desc");   /* sort direction    */
  const [sessionF,   setSessionF]   = useState("ALL");
  const [typeF,      setTypeF]      = useState("ALL");
  const [statusF,    setStatusF]    = useState("ALL");
  const [reasonF,    setReasonF]    = useState("ALL");

  /* which dropdown is open */
  const [openDrop,   setOpenDrop]   = useState(null);    /* "date"|"session"|"type"|"status"|"reason" */
  const [pendingFrom,setPendingFrom]= useState("");
  const [pendingTo,  setPendingTo]  = useState("");

  /* close dropdown when clicking outside */
  const dropRef = useRef(null);
  useEffect(()=>{
    if (!openDrop) return;
    function handler(e){
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpenDrop(null);
    }
    document.addEventListener("mousedown", handler);
    return ()=>document.removeEventListener("mousedown", handler);
  },[openDrop]);

  /* unique values from data */
  const uniqSessions = useMemo(()=>[...new Set(parades.map(p=>p.session).filter(Boolean))],[parades]);
  const uniqTypes    = useMemo(()=>[...new Set(parades.map(p=>p.parade_type).filter(Boolean))].sort(),[parades]);
  const uniqReasons  = useMemo(()=>[...new Set(parades.map(p=>p.att_reason).filter(Boolean))].sort(),[parades]);

  /* apply all filters then sort */
  const rows = useMemo(()=>{
    let arr=[...parades];
    if (dateFrom)        arr=arr.filter(p=>(p.parade_date??"")>=dateFrom);
    if (dateTo)          arr=arr.filter(p=>(p.parade_date??"")<=dateTo);
    if (sessionF!=="ALL")arr=arr.filter(p=>p.session===sessionF);
    if (typeF!=="ALL")   arr=arr.filter(p=>p.parade_type===typeF);
    if (statusF!=="ALL") arr=arr.filter(p=>{
      if (statusF==="present") return p.att_status==="present";
      if (statusF==="awp")     return p.att_status==="absent_with_permission";
      if (statusF==="awop")    return p.att_status==="absent_without_permission";
      return true;
    });
    if (reasonF!=="ALL") arr=arr.filter(p=>p.att_reason===reasonF);
    arr.sort((a,b)=>{
      const av=a.parade_date??"", bv=b.parade_date??"";
      return dateDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
    });
    return arr;
  },[parades,dateFrom,dateTo,sessionF,typeF,statusF,reasonF,dateDir]);

  /* active filter count */
  const hasDateFilter = dateFrom||dateTo;
  const activeFilters = [hasDateFilter?`Date filtered`:"",
    sessionF!=="ALL"?`Session: ${sessionF}`:"",
    typeF!=="ALL"?`Type: ${typeF}`:"",
    statusF!=="ALL"?`Status: ${stLabel(statusF==="present"?"present":statusF==="awp"?"absent_with_permission":"absent_without_permission")}`:"",
    reasonF!=="ALL"?`Reason: ${reasonF}`:"",
  ].filter(Boolean);

  function clearAll(){
    setDateFrom(""); setDateTo(""); setSessionF("ALL");
    setTypeF("ALL"); setStatusF("ALL"); setReasonF("ALL");
    setDateDir("desc");
  }

  /* ── small sort/filter icon badge on header ── */
  function ColIcon({ col }){
    const active =
      (col==="date"    && (hasDateFilter||dateDir!=="desc")) ||
      (col==="session" && sessionF!=="ALL") ||
      (col==="type"    && typeF!=="ALL") ||
      (col==="status"  && statusF!=="ALL") ||
      (col==="reason"  && reasonF!=="ALL");
    return (
      <span style={{
        marginLeft:"0.28rem", fontSize:"0.62rem",
        color: active ? "var(--csi-indigo-light)" : "var(--csi-text-muted)",
        opacity: active ? 1 : 0.5,
      }}>
        {col==="date" ? (dateDir==="asc"?"↑":"↓") : "▾"}
      </span>
    );
  }

  function toggle(col){
    if (col==="date" && openDrop!=="date"){
      setPendingFrom(dateFrom); setPendingTo(dateTo);
    }
    setOpenDrop(d=>d===col?null:col);
  }

  /* ── pill row helper for enum dropdowns ── */
  function PillRow({ options, value, onChange }){
    return (
      <div style={{ display:"flex",flexWrap:"wrap",gap:"0.28rem",padding:"0.5rem 0.75rem" }}>
        {["ALL",...options].map(o=>(
          <button key={o}
            className={`csi-sort-menu-item${value===o?" csi-sort-menu-item--active":""}`}
            style={{ padding:"0.3rem 0.6rem",borderRadius:"var(--csi-radius-sm)",border:"1px solid var(--csi-border-input)",background:value===o?"var(--csi-indigo)":"var(--csi-bg-input)",color:value===o?"white":"var(--csi-text-sub)" }}
            onClick={()=>{ onChange(o); setOpenDrop(null); }}>
            {o==="ALL"?"All":o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropRef} style={{ position:"relative" }}>
      {/* Active filter chips */}
      {activeFilters.length>0 && (
        <div style={{ display:"flex",alignItems:"center",gap:"0.35rem",flexWrap:"wrap",marginBottom:"0.5rem" }}>
          <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.55rem",color:"var(--csi-text-label)",textTransform:"uppercase",letterSpacing:"0.08em" }}>
            Filters:
          </span>
          {activeFilters.map(f=>(
            <span key={f} style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",background:"rgba(79,70,229,0.12)",color:"var(--csi-indigo-light)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"var(--csi-radius-sm)",padding:"0.1rem 0.45rem" }}>
              {f}
            </span>
          ))}
          <button onClick={clearAll}
            style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.58rem",background:"none",border:"none",color:"var(--csi-red)",cursor:"pointer",marginLeft:"0.2rem" }}>
            Clear all ×
          </button>
          <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",color:"var(--csi-text-muted)",marginLeft:"auto" }}>
            {rows.length} / {parades.length}
          </span>
        </div>
      )}

      <div className="csi-table-wrap">
        <div className="csi-table-scroll">
          <table className="csi-table">
            <thead>
              <tr>
                {/* DATE header */}
                <th style={{ position:"relative" }} onClick={()=>toggle("date")}>
                  Date <ColIcon col="date" />
                  {openDrop==="date" && (
                    <div className="csi-sort-menu" onClick={e=>e.stopPropagation()}>
                      {/* sort direction */}
                      {[{v:"desc",l:"Newest first ↓"},{v:"asc",l:"Oldest first ↑"}].map(({v,l})=>(
                        <button key={v} className={`csi-sort-menu-item${dateDir===v?" csi-sort-menu-item--active":""}`}
                          onClick={()=>{setDateDir(v);setOpenDrop(null);}}>
                          {dateDir===v?"✓ ":""}{l}
                        </button>
                      ))}
                      <div className="csi-sort-menu-divider"/>
                      {/* date range filter */}
                      <div className="csi-sort-menu-datepick">
                        <label>From</label>
                        <input type="date" value={pendingFrom} onChange={e=>setPendingFrom(e.target.value)}
                          className="csi-input" style={{ fontSize:"0.68rem",padding:"0.28rem 0.5rem" }}/>
                        <label style={{marginTop:"0.2rem"}}>To</label>
                        <input type="date" value={pendingTo} onChange={e=>setPendingTo(e.target.value)}
                          className="csi-input" style={{ fontSize:"0.68rem",padding:"0.28rem 0.5rem" }}/>
                        <div style={{ display:"flex",gap:"0.35rem",marginTop:"0.35rem" }}>
                          <button className="csi-btn-primary"
                            style={{ fontSize:"0.65rem",padding:"0.28rem 0.7rem",flex:1 }}
                            onClick={()=>{setDateFrom(pendingFrom);setDateTo(pendingTo);setOpenDrop(null);}}>
                            Apply
                          </button>
                          <button className="csi-btn-ghost"
                            style={{ fontSize:"0.65rem",padding:"0.28rem 0.55rem" }}
                            onClick={()=>{setPendingFrom("");setPendingTo("");setDateFrom("");setDateTo("");setOpenDrop(null);}}>
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </th>

                {/* SESSION header */}
                <th style={{ position:"relative" }} onClick={()=>toggle("session")}>
                  Session <ColIcon col="session" />
                  {openDrop==="session" && (
                    <div className="csi-sort-menu" onClick={e=>e.stopPropagation()}>
                      <PillRow
                        options={uniqSessions.length ? uniqSessions : ["morning","evening"]}
                        value={sessionF}
                        onChange={setSessionF}
                      />
                    </div>
                  )}
                </th>

                {/* TYPE header */}
                <th style={{ position:"relative" }} onClick={()=>toggle("type")}>
                  Type <ColIcon col="type" />
                  {openDrop==="type" && (
                    <div className="csi-sort-menu" onClick={e=>e.stopPropagation()}>
                      {uniqTypes.length===0
                        ? <p style={{ padding:"0.6rem 0.85rem",fontFamily:"var(--csi-font-mono)",fontSize:"0.65rem",color:"var(--csi-text-muted)" }}>No types available</p>
                        : <PillRow options={uniqTypes} value={typeF} onChange={setTypeF} />
                      }
                    </div>
                  )}
                </th>

                {/* STATUS header */}
                <th style={{ position:"relative" }} onClick={()=>toggle("status")}>
                  Status <ColIcon col="status" />
                  {openDrop==="status" && (
                    <div className="csi-sort-menu" onClick={e=>e.stopPropagation()}>
                      <PillRow
                        options={["present","awp","awop"]}
                        value={statusF}
                        onChange={setStatusF}
                      />
                    </div>
                  )}
                </th>

                {/* REASON header */}
                <th style={{ position:"relative" }} onClick={()=>toggle("reason")}>
                  Reason <ColIcon col="reason" />
                  {openDrop==="reason" && (
                    <div className="csi-sort-menu" onClick={e=>e.stopPropagation()}>
                      {uniqReasons.length===0
                        ? <p style={{ padding:"0.6rem 0.85rem",fontFamily:"var(--csi-font-mono)",fontSize:"0.65rem",color:"var(--csi-text-muted)" }}>No reasons on record</p>
                        : <PillRow options={uniqReasons} value={reasonF} onChange={setReasonF} />
                      }
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p,i)=>(
                <tr key={p.parade_id??i} className={`${i%2?"alt":""} no-click`}>
                  <td style={{ fontFamily:"var(--csi-font-mono)",color:"var(--csi-text-primary)",fontSize:"0.76rem" }}>{p.parade_date}</td>
                  <td style={{ color:"var(--csi-text-sub)",textTransform:"capitalize" }}>{p.session}</td>
                  <td style={{ color:"var(--csi-text-primary)" }}>{p.parade_type??"—"}</td>
                  <td><span className={stBadge(p.att_status)}>{stLabel(p.att_status)}</span></td>
                  <td style={{ color:"var(--csi-text-muted)",fontStyle:"italic" }}>{p.att_reason??"—"}</td>
                </tr>
              ))}
              {rows.length===0 && (
                <tr><td colSpan={5} className="csi-table-empty">
                  {parades.length===0 ? "No parade records in this date range." : "No records match the active filters."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ATTENDANCE GAUGE
══════════════════════════════════════════════════════════════ */
function AttendanceGauge({ presentPct, awpPct, awopPct, size=130 }){
  const R=size*0.38,C=2*Math.PI*R,cx=size/2;
  const arc=(pct,off)=>({strokeDasharray:`${(pct/100)*C} ${C}`,strokeDashoffset:-((off/100)*C)});
  return (
    <div style={{ position:"relative",width:size,height:size,flexShrink:0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="var(--csi-bg-input)" strokeWidth="12"/>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="butt" style={arc(awopPct,presentPct+awpPct)}/>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#f59e0b" strokeWidth="12" strokeLinecap="butt" style={arc(awpPct,presentPct)}/>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#10b981" strokeWidth="12" strokeLinecap="butt" style={arc(presentPct,0)}/>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontFamily:"var(--csi-font-display)",fontSize:size*0.1,fontWeight:800,color:pctHex(presentPct),lineHeight:1 }}>
          {fmt(presentPct)}%
        </span>
        <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:size*0.042,color:"var(--csi-text-label)",textTransform:"uppercase",letterSpacing:"0.08em" }}>
          Present
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TRIBAR / SORT ICON
══════════════════════════════════════════════════════════════ */
function TriBar({ present, awp, awop }){
  return (
    <div className="csi-tribar">
      <div className="csi-tribar__present" style={{ width:`${present}%` }}/>
      <div className="csi-tribar__awp"     style={{ width:`${awp}%`     }}/>
      <div className="csi-tribar__awop"    style={{ width:`${awop}%`    }}/>
    </div>
  );
}
function SortIcon({ col, sortCol, sortDir }){
  if (sortCol!==col) return <span style={{ marginLeft:"0.25rem",opacity:0.2,fontSize:"0.65rem" }}>⇅</span>;
  return <span style={{ marginLeft:"0.25rem",color:"var(--csi-indigo-light)",fontSize:"0.65rem" }}>{sortDir==="asc"?"↑":"↓"}</span>;
}

/* ══════════════════════════════════════════════════════════════
   CADET DETAIL POPUP  (unit summary row click)
══════════════════════════════════════════════════════════════ */
function CadetDetailPopup({ cadet, fromDate, toDate, onClose }){
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [popFrom, setPopFrom] = useState(fromDate);
  const [popTo,   setPopTo]   = useState(toDate);

  const load = useCallback(async(f,t)=>{
    setLoading(true);
    const { data } = await supabase.rpc("get_csi_cadet_detail",{
      p_cadet_id:cadet.cadet_id, p_from_date:f, p_to_date:t,
    });
    setDetail(data||[]); setLoading(false);
  },[cadet.cadet_id]);

  useEffect(()=>{ load(popFrom,popTo); document.body.style.overflow="hidden"; return()=>{document.body.style.overflow="";};}, []);
  useEffect(()=>{ const h=e=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); },[onClose]);

  const summary    = detail?.[0]??null;
  const parades    = detail??[];
  const presentPct = parseFloat(summary?.present_pct??0);
  const awpPct     = parseFloat(summary?.absent_wp_pct??0);
  const awopPct    = parseFloat(summary?.absent_wop_pct??0);

  return createPortal(
    <div className="csi-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="csi-modal">
        <div className="csi-modal__header">
          <div>
            <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.63rem",color:"var(--csi-indigo-light)",letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 0.15rem" }}>
              {summary?.cadet_enrollment??cadet.enrollment_no} · {summary?.cadet_rank??cadet.rank}
            </p>
            <h2 style={{ fontFamily:"var(--csi-font-display)",fontSize:"1.2rem",fontWeight:800,color:"var(--csi-text-primary)",margin:"0 0 0.1rem" }}>
              {summary?.cadet_name??cadet.name}
            </h2>
            <p style={{ fontSize:"0.7rem",color:"var(--csi-text-muted)",margin:0 }}>
              Cat {summary?.cadet_category??cadet.category} · {summary?.cadet_division??cadet.division}
            </p>
          </div>
          <button className="csi-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="csi-modal__datebar">
          <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.58rem",color:"var(--csi-text-muted)",textTransform:"uppercase",letterSpacing:"0.1em" }}>Range</span>
          <input type="date" value={popFrom} onChange={e=>setPopFrom(e.target.value)} className="csi-input" style={{ fontSize:"0.7rem",padding:"0.26rem 0.5rem" }}/>
          <span style={{ color:"var(--csi-border-input)" }}>→</span>
          <input type="date" value={popTo} onChange={e=>setPopTo(e.target.value)} className="csi-input" style={{ fontSize:"0.7rem",padding:"0.26rem 0.5rem" }}/>
          <button onClick={()=>load(popFrom,popTo)} className="csi-btn-primary" style={{ marginLeft:"auto",padding:"0.26rem 0.8rem",fontSize:"0.7rem" }}>Apply</button>
        </div>
        <div className="csi-modal__body">
          {loading ? <div className="csi-loading">Loading cadet data…</div>
          : !summary ? (
            <div className="csi-empty"><div className="csi-empty__icon">📭</div><p className="csi-empty__text">No attendance data in this range.</p></div>
          ) : (
            <>
              <div style={{ display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1rem",flexWrap:"wrap" }}>
                <AttendanceGauge presentPct={presentPct} awpPct={awpPct} awopPct={awopPct} size={115}/>
                <div className="csi-mini-stats" style={{ flex:1,minWidth:"160px" }}>
                  {[
                    {label:"Total Parades",val:summary.total_parades,   color:"var(--csi-text-primary)"},
                    {label:"Present",       val:summary.present_count,   color:"var(--csi-green)"},
                    {label:"Abs WP",        val:summary.absent_wp_count, color:"var(--csi-amber)"},
                    {label:"Abs WOP",       val:summary.absent_wop_count,color:"var(--csi-red)"},
                  ].map(({label,val,color})=>(
                    <div key={label} className="csi-mini-stat">
                      <p className="csi-mini-stat__label">{label}</p>
                      <p className="csi-mini-stat__val" style={{ color }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="csi-section-label" style={{ marginBottom:"0.4rem" }}>Parade History</p>
              <ParadeHistoryTable parades={parades} compact />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════
   PANEL 1 — UNIT SUMMARY
══════════════════════════════════════════════════════════════ */
function PanelUnitSummary(){
  const [fromDate,      setFromDate]      = useState(DEFAULT_FROM);
  const [toDate,        setToDate]        = useState(TODAY);
  const [catFilter,     setCatFilter]     = useState("ALL");
  const [divFilter,     setDivFilter]     = useState("ALL");
  const [rows,          setRows]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [sortCol,       setSortCol]       = useState("present_pct");
  const [sortDir,       setSortDir]       = useState("asc");
  const [search,        setSearch]        = useState("");
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [pctThr,        setPctThr]        = useState("");
  const [pctMode,       setPctMode]       = useState("below");

  async function fetchData(){
    setLoading(true); setError(null);
    const { data, error:err } = await supabase.rpc("get_csi_unit_summary",{
      p_from_date:fromDate, p_to_date:toDate, p_category:null, p_division:null,
    });
    if (err) setError(err.message);
    else setRows(data||[]);
    setLoading(false);
  }
  useEffect(()=>{ fetchData(); },[]);

  const stats = useMemo(()=>{
    if (!rows.length) return null;
    const total=rows.length;
    const avg=rows.reduce((s,r)=>s+parseFloat(r.present_pct??0),0)/total;
    return { total, avg, below75: rows.filter(r=>parseFloat(r.present_pct??0)<75).length };
  },[rows]);

  const filtered = useMemo(()=>{
    let arr=[...rows];
    if (divFilter!=="ALL") arr=arr.filter(r=>r.division===divFilter);
    if (catFilter!=="ALL") arr=arr.filter(r=>r.category===catFilter);
    if (search.trim()){ const q=search.toLowerCase(); arr=arr.filter(r=>r.name?.toLowerCase().includes(q)||r.enrollment_no?.toLowerCase().includes(q)); }
    const thr=parseFloat(pctThr);
    if (!isNaN(thr)&&thr>=0&&thr<=100){
      arr = pctMode==="below" ? arr.filter(r=>parseFloat(r.present_pct??0)<thr) : arr.filter(r=>parseFloat(r.present_pct??0)>=thr);
    }
    arr.sort((a,b)=>{
      let av=a[sortCol]??0, bv=b[sortCol]??0;
      if (sortCol==="rank"){av=RANK_ORDER.indexOf(a.rank);if(av===-1)av=99;bv=RANK_ORDER.indexOf(b.rank);if(bv===-1)bv=99;}
      if (typeof av==="string")av=av.toLowerCase();
      if (typeof bv==="string")bv=bv.toLowerCase();
      if(av<bv)return sortDir==="asc"?-1:1;
      if(av>bv)return sortDir==="asc"?1:-1;
      return 0;
    });
    return arr;
  },[rows,catFilter,divFilter,search,sortCol,sortDir,pctThr,pctMode]);

  function tog(col){ if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortCol(col);setSortDir("asc");} }
  function TH({ col, label, style={} }){ return <th onClick={()=>tog(col)} style={style}>{label}<SortIcon col={col} sortCol={sortCol} sortDir={sortDir}/></th>; }

  return (
    <div>
      {/* Filter bar */}
      <div className="csi-filter-bar">
        <div className="csi-filter-group">
          <label className="csi-filter-label">From</label>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="csi-input"/>
        </div>
        <div className="csi-filter-group">
          <label className="csi-filter-label">To</label>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="csi-input"/>
        </div>
        <button className="csi-btn-ghost" onClick={()=>setToDate(TODAY)}>Today</button>
        <div className="csi-filter-group">
          <label className="csi-filter-label">Category</label>
          <div className="csi-pill-group">
            {["ALL","A","B","C"].map(c=><button key={c} className={`csi-pill${catFilter===c?" csi-pill--active":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
          </div>
        </div>
        <div className="csi-filter-group">
          <label className="csi-filter-label">Division</label>
          <div className="csi-pill-group">
            {["ALL","SD","SW"].map(d=><button key={d} className={`csi-pill${divFilter===d?" csi-pill--active":""}`} onClick={()=>setDivFilter(d)}>{d}</button>)}
          </div>
        </div>
        <button className="csi-btn-primary" onClick={fetchData} disabled={loading} style={{ marginLeft:"auto" }}>
          {loading?"Loading…":"Load Data"}
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="csi-stats-grid">
          {[
            {label:"Total Cadets",      val:stats.total,              color:"var(--csi-text-primary)"},
            {label:"Avg Attendance",    val:`${fmt(stats.avg)}%`,     color:pctHex(stats.avg)},
            {label:"Below 75%",         val:stats.below75,            color:stats.below75>0?"var(--csi-red)":"var(--csi-green)"},
            {label:"Completed Parades", val:rows[0]?.total_parades??"—", color:"var(--csi-indigo-light)"},
          ].map(({label,val,color})=>(
            <div key={label} className="csi-stat-card">
              <p className="csi-stat-label">{label}</p>
              <p className="csi-stat-value" style={{ color }}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tool row: legend + search + pct filter + export */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"0.5rem",marginBottom:"0.6rem" }}>
        <div className="csi-legend">
          {[["#10b981","≥75%"],["#f59e0b","60–74%"],["#ef4444","<60%"]].map(([c,l])=>(
            <div key={l} className="csi-legend-item"><span className="csi-legend-dot" style={{ background:c }}/>{l}</div>
          ))}
        </div>
        <div style={{ display:"flex",gap:"0.45rem",alignItems:"center",flexWrap:"wrap" }}>
          {/* Pct filter */}
          <input type="number" min="0" max="100" placeholder="Att %"
            value={pctThr} onChange={e=>setPctThr(e.target.value)}
            className="csi-input" style={{ width:"72px",padding:"0.36rem 0.5rem",fontSize:"0.7rem" }}/>
          <button
            className={`csi-pct-toggle${pctThr?(pctMode==="below"?" csi-pct-toggle--below":" csi-pct-toggle--above"):""}`}
            onClick={()=>setPctMode(m=>m==="below"?"above":"below")}>
            {pctMode==="below"?"< Below":"≥ Above"}
          </button>
          {pctThr && <button className="csi-btn-ghost" onClick={()=>setPctThr("")} style={{ padding:"0.32rem 0.55rem" }}>✕</button>}
          {/* Search */}
          <input type="text" placeholder="Search name / enrollment…" value={search} onChange={e=>setSearch(e.target.value)} className="csi-input csi-search"/>
          {search && <button className="csi-btn-ghost" onClick={()=>setSearch("")}>Clear</button>}
          <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.62rem",color:"var(--csi-text-muted)" }}>{filtered.length} cadets</span>
          <button className="csi-btn-excel" onClick={()=>exportToExcel(filtered,fromDate,toDate)}>↓ Excel</button>
        </div>
      </div>

      {error && <div className="csi-error">⚠ {error}</div>}

      {/* Table */}
      <div className="csi-table-wrap">
        {loading&&!rows.length
          ? <div className="csi-loading">Fetching unit data…</div>
          : (
          <div className="csi-table-scroll">
            <table className="csi-table">
              <thead>
                <tr>
                  <TH col="name"          label="Name"/>
                  <TH col="enrollment_no" label="Enrollment"/>
                  <TH col="rank"          label="Rank"/>
                  <TH col="category"      label="Cat"/>
                  <TH col="division"      label="Div"/>
                  <TH col="total_parades" label="Parades"/>
                  <TH col="present"       label="P"    style={{ color:"#10b981" }}/>
                  <TH col="absent_wp"     label="AWP"  style={{ color:"#f59e0b" }}/>
                  <TH col="absent_wop"    label="AWOP" style={{ color:"#ef4444" }}/>
                  <TH col="present_pct"   label="%"/>
                  <th className="no-sort" style={{ minWidth:"100px" }}>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r,i)=>{
                  const pPct=parseFloat(r.present_pct??0);
                  return (
                    <tr key={r.cadet_id} className={i%2?"alt":""} onClick={()=>setSelectedCadet(r)}>
                      <td style={{ color:"var(--csi-text-primary)",fontWeight:500 }}>{r.name}</td>
                      <td style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.69rem",color:"var(--csi-text-sub)" }}>{r.enrollment_no}</td>
                      <td style={{ color:"var(--csi-text-sub)" }}>{r.rank}</td>
                      <td><span className="csi-badge csi-badge--neutral">{r.category}</span></td>
                      <td><span className="csi-badge csi-badge--neutral">{r.division}</span></td>
                      <td style={{ fontFamily:"var(--csi-font-mono)",textAlign:"center",color:"var(--csi-text-sub)" }}>{r.total_parades}</td>
                      <td style={{ fontFamily:"var(--csi-font-mono)",textAlign:"center",color:"#10b981" }}>{r.present}</td>
                      <td style={{ fontFamily:"var(--csi-font-mono)",textAlign:"center",color:"#f59e0b" }}>{r.absent_wp}</td>
                      <td style={{ fontFamily:"var(--csi-font-mono)",textAlign:"center",color:"#ef4444" }}>{r.absent_wop}</td>
                      <td><span className={pctCls(pPct)}>{fmt(pPct)}%</span></td>
                      <td style={{ minWidth:"100px" }}>
                        <TriBar present={parseFloat(r.present_pct??0)} awp={parseFloat(r.absent_wp_pct??0)} awop={parseFloat(r.absent_wop_pct??0)}/>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&!loading&&(
                  <tr><td colSpan={11} className="csi-table-empty">
                    {search||pctThr?"No cadets match the active filters.":"No data — adjust filters and press Load Data."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCadet && (
        <CadetDetailPopup cadet={selectedCadet} fromDate={fromDate} toDate={toDate}
          onClose={()=>setSelectedCadet(null)}/>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PANEL 2 — CADET PROFILE
══════════════════════════════════════════════════════════════ */
function PanelCadetProfile(){
  const [query,         setQuery]         = useState("");
  const [catFilter,     setCatFilter]     = useState("ALL");
  const [divFilter,     setDivFilter]     = useState("ALL");
  const [includeAlumni, setIncludeAlumni] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError,   setSearchError]   = useState(null);
  const [searched,      setSearched]      = useState(false);
  const [selectedCadet, setSelectedCadet] = useState(null);
  const [cadetFull,     setCadetFull]     = useState(null);
  const [fromDate,      setFromDate]      = useState(DEFAULT_FROM);
  const [toDate,        setToDate]        = useState(TODAY);
  const [detail,        setDetail]        = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState(null);
  const debounceRef = useRef(null);

  async function searchCadets(q,cat,div,alumni){
    if (!q.trim()){ setSearchResults([]); setSearched(false); return; }
    setSearchLoading(true); setSearchError(null); setSearched(true);
    let qb=supabase.from("cadets").select("id,name,enrollment_no,rank,category,division,is_active").order("name");
    qb=qb.or(`name.ilike.%${q}%,enrollment_no.ilike.%${q}%`);
    if (!alumni) {
      qb=qb.eq("is_active",true);
      qb=qb.neq("status","dropped"); // exclude dropped cadets from normal search
    }
    if (cat!=="ALL") qb=qb.eq("category",cat);
    if (div!=="ALL") qb=qb.eq("division",div);
    qb=qb.limit(20);
    const { data, error:err }=await qb;
    if (err) setSearchError(err.message);
    else setSearchResults(data||[]);
    setSearchLoading(false);
  }

  useEffect(()=>{
    clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(()=>searchCadets(query,catFilter,divFilter,includeAlumni),350);
    return()=>clearTimeout(debounceRef.current);
  },[query,catFilter,divFilter,includeAlumni]);

  const loadDetail=useCallback(async(id,f,t)=>{
    setDetailLoading(true); setDetailError(null);
    const { data,error:err }=await supabase.rpc("get_csi_cadet_detail",{p_cadet_id:id,p_from_date:f,p_to_date:t});
    if (err) setDetailError(err.message);
    else setDetail(data||[]);
    setDetailLoading(false);
  },[]);

  async function fetchFull(id){
    const { data }=await supabase.from("cadets").select("*").eq("id",id).single();
    setCadetFull(data||null);
  }

  function selectCadet(c){ setSelectedCadet(c); setCadetFull(null); fetchFull(c.id); loadDetail(c.id,fromDate,toDate); }
  function applyRange(){ if(selectedCadet) loadDetail(selectedCadet.id,fromDate,toDate); }

  const summary    = detail?.[0]??null;
  const parades    = detail??[];
  const presentPct = parseFloat(summary?.present_pct??0);
  const awpPct     = parseFloat(summary?.absent_wp_pct??0);
  const awopPct    = parseFloat(summary?.absent_wop_pct??0);

  /* profile fields — exact DB columns, required fields always shown with "Not Updated" fallback */
  const NOT_UPDATED = "— Not Updated";
  function fmtField(v){ return (v===null||v===undefined||String(v).trim()==="") ? NOT_UPDATED : String(v); }
  function fmtFieldDate(v){
    if (!v) return NOT_UPDATED;
    try { return new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }
    catch(e){ return String(v); }
  }

  function profFields(c){
    if (!c) return [];

    /* Determine true active status: alumni badge shown in header already,
       but status field in DB may still say "active" for alumni cadets.
       Derive display status from is_active + passout_year + drop_reason */
    const derivedStatus = !c.is_active
      ? (c.passout_year ? "Passed Out" : c.drop_reason ? "Dropped" : "Inactive")
      : (c.status || "Active");

    /* ── ACADEMIC DETAILS ── */
    const academic = [
      { key:"Roll No",         val:fmtField(c.roll_no),   missing:!c.roll_no,   group:"academic" },
      { key:"Branch",          val:fmtField(c.branch),    missing:!c.branch,    group:"academic" },
      { key:"Email ID",        val:fmtField(c.email),     missing:!c.email,     group:"academic" },
    ];

    /* ── NCC DETAILS ── */
    const ncc = [
      { key:"Intake Year",     val:fmtField(c.intake_year),          missing:!c.intake_year,     group:"ncc" },
      { key:"Camps Attended",  val:fmtField(c.camps_attended),       missing:!c.camps_attended,  group:"ncc" },
      { key:"National Camps",  val:fmtField(c.national_camps),       missing:!c.national_camps,  group:"ncc" },
      { key:"Achievements",    val:fmtField(c.achievement_links),    missing:!c.achievement_links, group:"ncc" },
    ];

    /* ── PERSONAL DETAILS ── */
    const personal = [
      { key:"Mobile No",       val:fmtField(c.mobile_no),            missing:!c.mobile_no,       group:"personal" },
      { key:"Date of Birth",   val:fmtFieldDate(c.date_of_birth),    missing:!c.date_of_birth,   group:"personal" },
      { key:"Blood Group",     val:fmtField(c.blood_group),          missing:!c.blood_group,     group:"personal" },
      { key:"Father's Name",   val:fmtField(c.father_name),          missing:!c.father_name,     group:"personal" },
    ];

    /* ── STATUS DETAILS — shown as last row(s) ── */
    const status = [
      { key:"Status",          val:derivedStatus,
        tag: !c.is_active ? (c.drop_reason ? "drop" : "passout") : "status",
        group:"status" },
    ];
    if (c.passout_year)  status.push({ key:"Passed Out Year", val:String(c.passout_year), tag:"passout", group:"status" });
    if (c.drop_reason)   status.push({ key:"Drop Reason",     val:c.drop_reason,           tag:"drop",    group:"status" });

    return [...academic, ...ncc, ...personal, ...status];
  }

  return (
    <div className="csi-split">
      {/* LEFT */}
      <div className="csi-split__left">
        <div className="csi-card" style={{ display:"flex",flexDirection:"column",gap:"0.65rem" }}>
          <p className="csi-section-label" style={{ margin:0 }}>Search Cadet</p>
          <input type="text" placeholder="Name or enrollment…" value={query} onChange={e=>setQuery(e.target.value)} className="csi-input" style={{ width:"100%" }}/>
          <div>
            <p className="csi-filter-label" style={{ marginBottom:"0.25rem" }}>Category</p>
            <div className="csi-pill-group" style={{ width:"100%" }}>
              {["ALL","A","B","C"].map(c=><button key={c} style={{ flex:1 }} className={`csi-pill${catFilter===c?" csi-pill--active":""}`} onClick={()=>setCatFilter(c)}>{c}</button>)}
            </div>
          </div>
          <div>
            <p className="csi-filter-label" style={{ marginBottom:"0.25rem" }}>Division</p>
            <div className="csi-pill-group" style={{ width:"100%" }}>
              {["ALL","SD","SW"].map(d=><button key={d} style={{ flex:1 }} className={`csi-pill${divFilter===d?" csi-pill--active":""}`} onClick={()=>setDivFilter(d)}>{d}</button>)}
            </div>
          </div>
          <button onClick={()=>setIncludeAlumni(v=>!v)}
            className={`csi-btn-ghost${includeAlumni?" csi-pill--active":""}`}
            style={{ width:"100%",textAlign:"center" }}>
            {includeAlumni?"✓ Including Alumni":"Include Alumni"}
          </button>
        </div>

        <div className="csi-search-list" style={{ flex:1 }}>
          {searchLoading && <div className="csi-loading">Searching…</div>}
          {searchError   && <div className="csi-error">{searchError}</div>}
          {!searchLoading&&searched&&searchResults.length===0 && <div className="csi-empty"><p className="csi-empty__text">No cadets found.</p></div>}
          {!searchLoading&&!searched && <div className="csi-empty"><p className="csi-empty__text">Type to search cadets.</p></div>}
          {!searchLoading&&searchResults.map(c=>{
            const sel=selectedCadet?.id===c.id;
            return (
              <button key={c.id} className={`csi-search-item${sel?" csi-search-item--selected":""}`} onClick={()=>selectCadet(c)}>
                <div className={`csi-avatar${sel?" csi-avatar--active":""}`} style={{ width:32,height:32,fontSize:"0.55rem" }}>{ini(c.name)}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ color:"var(--csi-text-primary)",fontSize:"0.77rem",fontWeight:600,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{c.name}</p>
                  <p style={{ fontFamily:"var(--csi-font-mono)",color:"var(--csi-text-muted)",fontSize:"0.58rem",margin:0 }}>{c.enrollment_no} · Cat {c.category} · {c.division}</p>
                </div>
                {!c.is_active && <span className="csi-badge csi-badge--alumni">Alumni</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT */}
      <div className="csi-split__right">
        {!selectedCadet ? (
          <div className="csi-card" style={{ minHeight:"360px",display:"flex" }}>
            <div className="csi-empty" style={{ flex:1 }}>
              <div className="csi-empty__icon">🔍</div>
              <p className="csi-empty__text">Search and select a cadet to view their full profile and attendance.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Identity + date range */}
            <div className="csi-card">
              <div style={{ display:"flex",alignItems:"center",gap:"0.9rem",flexWrap:"wrap" }}>
                <div className="csi-avatar" style={{ width:64,height:64,fontSize:"1.15rem",borderRadius:"0.7rem",border:"2px solid var(--csi-border-input)" }}>
                  {ini(selectedCadet.name)}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.58rem",color:"var(--csi-indigo-light)",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 0.15rem" }}>
                    {selectedCadet.enrollment_no}
                  </p>
                  <h2 style={{ fontFamily:"var(--csi-font-display)",fontSize:"1.1rem",fontWeight:800,color:"var(--csi-text-primary)",margin:"0 0 0.2rem" }}>
                    {selectedCadet.name}
                  </h2>
                  <div style={{ display:"flex",gap:"0.32rem",flexWrap:"wrap" }}>
                    <span className="csi-badge csi-badge--neutral">{selectedCadet.rank}</span>
                    <span className="csi-badge csi-badge--indigo">Cat {selectedCadet.category}</span>
                    <span className="csi-badge csi-badge--indigo">{selectedCadet.division}</span>
                    {!selectedCadet.is_active && <span className="csi-badge csi-badge--alumni">Alumni</span>}
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap" }}>
                  <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="csi-input" style={{ fontSize:"0.7rem",padding:"0.3rem 0.5rem" }}/>
                  <span style={{ color:"var(--csi-border-input)" }}>→</span>
                  <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="csi-input" style={{ fontSize:"0.7rem",padding:"0.3rem 0.5rem" }}/>
                  <button className="csi-btn-primary" onClick={applyRange} disabled={detailLoading} style={{ padding:"0.32rem 0.8rem",fontSize:"0.7rem" }}>Apply</button>
                </div>
              </div>
            </div>

            {/* Full info grid — grouped */}
            {cadetFull && (()=>{
              const fields = profFields(cadetFull);
              const GROUP_LABELS = { academic:"Academic", ncc:"NCC", personal:"Personal", status:"Status" };
              const groups = ["academic","ncc","personal","status"];
              return (
                <div className="csi-card">
                  <p className="csi-section-label">Cadet Information</p>
                  {groups.map(g=>{
                    const gFields = fields.filter(f=>f.group===g);
                    if (!gFields.length) return null;
                    return (
                      <div key={g} style={{ marginBottom:"1rem" }}>
                        <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.55rem",color:"var(--csi-indigo-light)",
                          textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 0.5rem",
                          paddingBottom:"0.3rem",borderBottom:"1px solid var(--csi-border-card)" }}>
                          {GROUP_LABELS[g]}
                        </p>
                        <div className="csi-profile-grid">
                          {gFields.map(({key,val,missing,tag})=>{
                            const valColor = missing
                              ? "var(--csi-text-muted)"
                              : tag==="drop"    ? "var(--csi-red)"
                              : tag==="passout" ? "var(--csi-amber)"
                              : tag==="status"  ? "var(--csi-indigo-light)"
                              : "var(--csi-text-primary)";
                            return (
                              <div key={key} className="csi-profile-field">
                                <p className="csi-profile-field__key">{key}</p>
                                <p className="csi-profile-field__val" style={{ color:valColor, fontStyle:missing?"italic":"normal" }}>{val}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Attendance */}
            {detailLoading
              ? <div className="csi-card"><div className="csi-loading">Loading attendance…</div></div>
              : detailError
                ? <div className="csi-error">⚠ {detailError}</div>
                : summary ? (
                  <>
                    <div className="csi-card">
                      <p className="csi-section-label">Attendance Overview</p>
                      <div style={{ display:"flex",alignItems:"center",gap:"1rem",flexWrap:"wrap" }}>
                        <AttendanceGauge presentPct={presentPct} awpPct={awpPct} awopPct={awopPct} size={110}/>
                        <div className="csi-mini-stats" style={{ flex:1,minWidth:"160px" }}>
                          {[
                            {label:"Total Parades",val:summary.total_parades,   color:"var(--csi-text-primary)"},
                            {label:"Present",       val:summary.present_count,   color:"var(--csi-green)"},
                            {label:"Abs WP",        val:summary.absent_wp_count, color:"var(--csi-amber)"},
                            {label:"Abs WOP",       val:summary.absent_wop_count,color:"var(--csi-red)"},
                          ].map(({label,val,color})=>(
                            <div key={label} className="csi-mini-stat">
                              <p className="csi-mini-stat__label">{label}</p>
                              <p className="csi-mini-stat__val" style={{ color }}>{val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="csi-card">
                      <p className="csi-section-label">Parade History</p>
                      <ParadeHistoryTable parades={parades}/>
                    </div>
                  </>
                ) : (
                  <div className="csi-card">
                    <div className="csi-empty">
                      <div className="csi-empty__icon">📭</div>
                      <p className="csi-empty__text">No attendance data in this date range.</p>
                    </div>
                  </div>
                )
            }
          </>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   PARADE RECORD — helpers
══════════════════════════════════════════════════════════════ */
const UNIT_NAME    = "2(A) EME UNIT NCC, NELLORE";
const COLLEGE_NAME = "N.B.K.R.I.S.T. VIDYANAGAR";

/* rank → Parade-State column */
const RANK_COL = { SUO:"suo", JUO:"juo", CQMS:"sgt", SGT:"sgt", CPL:"cpl", LCPL:"lcpl", CDT:"cdt" };

function buildParadeState(rows){
  const base = { suo:0, juo:0, sgt:0, cpl:0, lcpl:0, cdt:0 };
  const present={...base}, awp={...base}, awop={...base};
  rows.forEach(r=>{
    const col = RANK_COL[r.rank] ?? "cdt";
    if (r.att_status==="present")                    present[col]++;
    else if (r.att_status==="absent_with_permission") awp[col]++;
    else                                              awop[col]++;
  });
  const tot = (o) => Object.values(o).reduce((a,b)=>a+b,0);
  return { present, awp, awop,
    totPresent:tot(present), totAwp:tot(awp), totAwop:tot(awop),
    grandTotal:rows.length };
}

/* ── Inline jsPDF loader (CDN, MIT licensed) ── */
async function loadJsPDF(){
  if (window.jspdf) return window.jspdf.jsPDF;
  await new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  await new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

/* ── PDF Generation ── */
async function generateNccPDF(parade, modal, rows){
  const JsPDF = await loadJsPDF();

  const ps   = buildParadeState(rows);
  const date = new Date(parade.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
  const sessionLabel = parade.session.charAt(0).toUpperCase()+parade.session.slice(1);
  const absWP  = rows.filter(r=>r.att_status==="absent_with_permission");
  const absWOP = rows.filter(r=>r.att_status==="absent_without_permission");
  const sdEnrolled = rows.filter(r=>r.division==="SD").length;
  const swEnrolled = rows.filter(r=>r.division==="SW").length;
  const sdPresent  = rows.filter(r=>r.division==="SD"&&r.att_status==="present").length;
  const swPresent  = rows.filter(r=>r.division==="SW"&&r.att_status==="present").length;

  const doc = new JsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, ml=15, mr=195, cw=W-ml-mr; // page dims
  const LINE = (y,x1=ml,x2=mr)=>{ doc.setDrawColor(0); doc.line(x1,y,x2,y); };
  const RECT = (x,y,w,h)=>doc.rect(x,y,w,h);
  const TXT  = (t,x,y,opts={})=>{
    doc.setFontSize(opts.size||9);
    doc.setFont("helvetica", opts.bold?"bold":"normal");
    doc.text(String(t??""),x,y,{align:opts.align||"left",...(opts.maxWidth?{maxWidth:opts.maxWidth}:{})});
  };
  const HEADING = (title,y)=>{
    TXT(UNIT_NAME, W/2, y,  {bold:true, size:13, align:"center"});
    TXT(title,     W/2, y+7,{bold:true, size:10, align:"center"});
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(ml,y+9,mr,y+9);
    return y+14;
  };

  /* ══════════════ PAGE 1 — Attendance Register ══════════════ */
  let y = HEADING("INSTITUTIONAL TRAINING ATTENDANCE REGISTER : 2025-26", 18);
  y+=2;
  TXT("Name of the Institution",ml,y); LINE(y, ml+45, mr); TXT(COLLEGE_NAME, ml+47, y, {size:9});
  y+=6;
  TXT("Date",ml+130,y); LINE(y,ml+143,mr); TXT(date,ml+145,y,{size:9});
  y+=6;
  TXT("Name of the ANO/Care Taker",ml,y); LINE(y,ml+54,mr); TXT(modal.anoName,ml+56,y,{size:9});
  y+=6;
  TXT("Parade  From",ml,y); LINE(y,ml+28,ml+65); TXT(modal.paradeFrom,ml+30,y,{size:9});
  TXT("To",ml+67,y); LINE(y,ml+72,ml+120); TXT(modal.paradeTo,ml+74,y,{size:9});
  TXT("No. of Periods",ml+122,y); LINE(y,ml+148,mr); TXT(modal.noPeriods||"",ml+150,y,{size:9});
  y+=6;
  TXT("Cadet Str. Auth",ml,y); LINE(y,ml+33,ml+90); TXT(String(ps.grandTotal),ml+35,y,{size:9});
  TXT("Enrolled",ml+92,y); LINE(y,ml+108,mr); TXT(String(ps.totPresent),ml+110,y,{size:9});
  y+=6;

  /* attendance table */
  doc.autoTable({
    startY:y,
    margin:{left:ml,right:W-mr},
    head:[["S.No","Cadets on Parade","Subjects Covered","Refreshment Served","Remarks"]],
    body:[
      ["1",`SD Cdts  ${sdPresent}`,
        `Common Subjects\n1. ${modal.cs1||""}\n2. ${modal.cs2||""}\n3. ${modal.cs3||""}\n4. ${modal.cs4||""}\nSpecialized Subjects\n1. ${modal.ss1||""}\n2. ${modal.ss2||""}\n3. ${modal.ss3||""}`,
        parade.refreshments?"Yes":"No", modal.remarks1||""],
      ["2",`SW Cdts  ${swPresent}`,"","",""],
    ],
    theme:"grid",
    styles:{fontSize:8, cellPadding:2},
    columnStyles:{0:{cellWidth:10},1:{cellWidth:28},2:{cellWidth:80},3:{cellWidth:30},4:{cellWidth:cw-148}},
  });
  y = doc.lastAutoTable.finalY+8;

  const SIG=(label,x,w,yy)=>{
    LINE(yy,x,x+w);
    TXT(label,x,yy+4,{size:8});
  };
  TXT("Name & Signature of PI Staff",ml,y); LINE(y,ml+52,ml+100);
  TXT(modal.piStaffName||"",ml+54,y,{size:8}); y+=10;
  TXT("Name & Signature of ANO",ml,y);  LINE(y,ml+45,ml+100);
  TXT(modal.anoName||"",ml+47,y,{size:8}); y+=10;
  TXT("Name & Signature of Two Sr Cadets",ml,y); y+=5;
  TXT("1.",ml,y); LINE(y,ml+6,ml+80); TXT(modal.srCdt1Name||"",ml+8,y,{size:8});
  TXT("(Mobile No.",ml+82,y,{size:8}); LINE(y,ml+104,ml+140); TXT(modal.srCdt1Mobile||"",ml+106,y,{size:8}); TXT(")",ml+141,y,{size:8});
  y+=7;
  TXT("2.",ml+20,y); LINE(y,ml+26,ml+80); TXT(modal.srCdt2Name||"",ml+28,y,{size:8});
  TXT("(Mobile No.",ml+82,y,{size:8}); LINE(y,ml+104,ml+140); TXT(modal.srCdt2Mobile||"",ml+106,y,{size:8}); TXT(")",ml+141,y,{size:8});
  y+=9;
  TXT("Visit of any VIP/Dignitary",ml,y); LINE(y,ml+48,mr);
  const vipFull=modal.vipVisit?(modal.vipDate?`${modal.vipVisit}  (${modal.vipDate})`:modal.vipVisit):"";
  TXT(vipFull,ml+50,y,{size:8,maxWidth:cw-50});
  TXT("Date:",ml+142,y,{size:8}); LINE(y,ml+152,mr); TXT(modal.vipDate||"",ml+154,y,{size:8}); y+=14;
  SIG("Signature of SM/S JCO",ml,45,y);
  SIG("Signature of Adm Offr",ml+65,45,y);
  SIG("Signature of CO",ml+130,50,y);
  y+=8;
  TXT("* Note : This register will be maintained separately for each institute and will be taken by the PI Staff during training.",
    ml,y,{size:7,maxWidth:cw});

  /* ══════════════ PAGE 2 — Training Diary ══════════════ */
  doc.addPage();
  y = HEADING("TRAINING DIARY FOR THE YEAR 2025-26 (INSTITUTE / COLLEGE WISE)", 18);
  y+=2;
  TXT("Sub Unit",ml,y); LINE(y,ml+16,ml+80); TXT(COLLEGE_NAME,ml+18,y,{size:8.5});
  y+=6;
  TXT("Parade Date",ml,y); LINE(y,ml+22,ml+75); TXT(date,ml+24,y,{size:9});
  TXT("Parade Timing",ml+80,y); LINE(y,ml+106,mr); TXT(`${modal.paradeFrom} – ${modal.paradeTo}`,ml+108,y,{size:9});
  y+=6;
  TXT("No of Parade",ml,y); LINE(y,ml+24,ml+75); TXT(modal.noOfParade||"",ml+26,y,{size:9});
  TXT("No of Periods:",ml+80,y); LINE(y,ml+108,mr); TXT(modal.noPeriods||"",ml+110,y,{size:9});
  y+=6;

  doc.autoTable({
    startY:y,
    margin:{left:ml,right:W-mr},
    head:[[
      {content:"Enrolled Strength",colSpan:2},{content:"Total",rowSpan:2},
      {content:"On Parade",colSpan:2},{content:"Total",rowSpan:2},
      {content:"Name of PI Staff\nConducting Parade",rowSpan:2}
    ],[
      "SD","SW","SD","SW"
    ]],
    body:[[
      String(sdEnrolled), String(swEnrolled), String(ps.grandTotal),
      String(sdPresent),  String(swPresent),  String(ps.totPresent),
      modal.piStaffName||""
    ]],
    theme:"grid",
    styles:{fontSize:8.5, cellPadding:3, halign:"center"},
  });
  y = doc.lastAutoTable.finalY+6;

  TXT("Visit of VIP/CO/AO/Remarks  (With date)",ml,y,{bold:true,size:8.5});
  LINE(y+5,ml,mr); LINE(y+11,ml,mr);
  TXT(vipFull,ml,y+9,{size:8.5,maxWidth:cw}); y+=16;

  TXT("Refreshment Served",ml,y,{bold:true,size:8.5});
  LINE(y+5,ml,mr); LINE(y+11,ml,mr);
  TXT(parade.refreshments?"Yes":"No",ml,y+9,{size:8.5}); y+=16;

  TXT(`Next Parade to be held on`,ml,y,{size:8.5}); LINE(y,ml+48,ml+100);
  TXT(modal.nextParadeDate||"",ml+50,y,{size:8.5});
  TXT("at",ml+102,y,{size:8.5}); LINE(y,ml+107,ml+145);
  TXT(modal.nextParadeTime||"",ml+109,y,{size:8.5}); TXT("Hrs",ml+147,y,{size:8.5}); y+=6;
  TXT("to",ml+80,y,{size:8.5}); LINE(y,ml+85,ml+140);
  TXT(modal.nextParadeEndTime||"",ml+87,y,{size:8.5}); TXT("hrs",ml+142,y,{size:8.5}); y+=10;

  doc.autoTable({
    startY:y, margin:{left:ml,right:W-mr},
    head:[["Signature of ANO/CTO\nwith Name","Principal","Sig of Senior PI Staff\nwith Name","Sig. of Sr. Cadet\nwith Name"]],
    body:[["","","",""]],
    theme:"grid",
    styles:{fontSize:8, cellPadding:10, halign:"center"},
  });
  y = doc.lastAutoTable.finalY+6;

  TXT("Station",ml,y,{size:8}); LINE(y,ml+14,ml+80); TXT("Nellore",ml+16,y,{size:8});
  TXT("Signature of CO/AO",mr-40,y,{size:8}); y+=6;
  TXT("Date",ml,y,{size:8}); LINE(y,ml+10,ml+60); TXT(date,ml+12,y,{size:8});

  /* ══════════════ PAGE 3 — Parade State ══════════════ */
  doc.addPage();
  TXT("Company",ml,20,{size:9}); LINE(20,ml+16,ml+70); TXT(COLLEGE_NAME,ml+18,20,{size:8.5});
  TXT("PARADE STATE",W/2,20,{bold:true,size:13,align:"center"});
  TXT("Date",mr-30,20,{size:9}); LINE(20,mr-20,mr); TXT(date,mr-18,20,{size:8.5});
  y=26;

  const psHeads = [["","Offr's","SUO's","JUO's","Sgts","Cpl","L/Cpl","Cdts","Total"]];
  const offr = modal.officerCount||"";
  const psBody = [
    ["Total on Parade",  offr, ps.present.suo, ps.present.juo, ps.present.sgt, ps.present.cpl, ps.present.lcpl, ps.present.cdt, ps.totPresent],
    ["Absent with Leave (PTO)", "", ps.awp.suo, ps.awp.juo, ps.awp.sgt, ps.awp.cpl, ps.awp.lcpl, ps.awp.cdt, ps.totAwp],
    ["Absent without Leave (PTO)","", ps.awop.suo, ps.awop.juo, ps.awop.sgt, ps.awop.cpl, ps.awop.lcpl, ps.awop.cdt, ps.totAwop],
    ["Total", modal.officerCount||"",
      ps.present.suo+ps.awp.suo+ps.awop.suo,
      ps.present.juo+ps.awp.juo+ps.awop.juo,
      ps.present.sgt+ps.awp.sgt+ps.awop.sgt,
      ps.present.cpl+ps.awp.cpl+ps.awop.cpl,
      ps.present.lcpl+ps.awp.lcpl+ps.awop.lcpl,
      ps.present.cdt+ps.awp.cdt+ps.awop.cdt,
      ps.grandTotal],
  ].map(r=>r.map(String));

  doc.autoTable({
    startY:y, margin:{left:ml,right:W-mr},
    head:psHeads, body:psBody, theme:"grid",
    styles:{fontSize:8.5, cellPadding:3, halign:"center"},
    columnStyles:{0:{halign:"left",cellWidth:52}},
  });
  y = doc.lastAutoTable.finalY+8;

  TXT("Initials Audit",ml,y,{size:8.5}); LINE(y,ml+22,ml+90); y+=10;
  TXT("Note :- This parade state will be submitted to",ml,y,{size:8});
  TXT("Instructor*",mr-30,y,{size:8}); LINE(y,mr-15,mr); y+=4;
  TXT("Officer I/C Parade",mr-30,y+4,{size:8}); y+=10;
  ["* Battalion","Company","Platoon","Section","Unit"].forEach((label,i)=>{
    TXT(label.replace("*","  "),ml+(i===0?0:4),y+i*5,{size:8,bold:i===0});
  });
  TXT("Headquarters by 10.00 Hrs the following day",ml+60,y+10,{size:8}); y+=38;
  TXT("* A Member of the Regular Indian instructional staff will sign in this place and none else if no such instructor on parade, the space will be left blank.",
    ml,y,{size:7,maxWidth:cw}); y+=9;
  TXT("* The entry relevant to the unit should be retained and others, scored out when the form filled in.",
    ml,y,{size:7,maxWidth:cw}); y+=8;
  TXT("(P.TO.)",mr,y,{size:8,align:"right"});

  /* ══════════════ PAGE 4 — Roll of Absentees ══════════════ */
  doc.addPage();
  TXT("ROLL OF ABSENTEES",W/2,20,{bold:true,size:13,align:"center"});
  y=26;

  const halfW=(cw/2)-2;
  const awpBody  = absWP.map((r,i)=>  [String(i+1)+". "+r.enrollment_no, r.rank, r.cadet_name]);
  const awopBody = absWOP.map((r,i)=> [String(i+1)+". "+r.enrollment_no, r.rank, r.cadet_name]);
  const maxRows  = Math.max(awpBody.length, awopBody.length, 4);
  // pad to equal rows
  while(awpBody.length<maxRows)  awpBody.push(["","",""]);
  while(awopBody.length<maxRows) awopBody.push(["","",""]);

  // Left side - AbsWP
  doc.autoTable({
    startY:y, startX:ml,
    margin:{left:ml, right:ml+halfW+4},
    head:[[ {content:"(1)  Absent with leave",colSpan:3} ],["Enrolment No","Rank","Name"]],
    body:awpBody, theme:"grid",
    styles:{fontSize:8, cellPadding:2},
    columnStyles:{0:{cellWidth:22},1:{cellWidth:14}},
  });

  // Right side - AbsWOP
  doc.autoTable({
    startY:y, startX:ml+halfW+4,
    margin:{left:ml+halfW+4, right:W-mr},
    head:[[ {content:"(2)  Absent without leave",colSpan:3} ],["Enrolment No","Rank","Name"]],
    body:awopBody, theme:"grid",
    styles:{fontSize:8, cellPadding:2},
    columnStyles:{0:{cellWidth:22},1:{cellWidth:14}},
  });

  return doc;
}


/* ══════════════════════════════════════════════════════════════
   DOWNLOAD MODAL COMPONENT
══════════════════════════════════════════════════════════════ */
function DownloadModal({ parade, rows, onClose }){
  const [fmt,      setFmt]      = useState("pdf");
  const [busy,     setBusy]     = useState(false);
  const [step,     setStep]     = useState(1); // 1=fill form, 2=generating

  /* pre-fill what we know */
  const [f, setF] = useState({
    anoName:      "",
    piStaffName:  "",
    paradeFrom:   "",
    paradeTo:     "",
    noPeriods:    "",
    noOfParade:   "",
    officerCount: "",
    cs1:"", cs2:"", cs3:"", cs4:"",   // common subjects
    ss1:"", ss2:"", ss3:"",            // specialized subjects
    srCdt1Name:"", srCdt1Mobile:"",
    srCdt2Name:"", srCdt2Mobile:"",
    vipVisit:"", vipDate:"",
    nextParadeDate:"", nextParadeTime:"", nextParadeEndTime:"",
    remarks1:"",
  });
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  /* find top 2 cadets by rank for Sr Cadet pre-fill */
  useEffect(()=>{
    const present = rows.filter(r=>r.att_status==="present");
    present.sort((a,b)=>(RANK_ORDER.indexOf(a.rank)||99)-(RANK_ORDER.indexOf(b.rank)||99));
    if(present[0]) setF(p=>({...p, srCdt1Name:present[0].cadet_name, srCdt1Mobile:""}));
    if(present[1]) setF(p=>({...p, srCdt2Name:present[1].cadet_name, srCdt2Mobile:""}));
  },[rows]);

  async function handleGenerate(){
    setBusy(true); setStep(2);
    try{
      const doc = await generateNccPDF(parade, f, rows);

      if(fmt==="pdf"||fmt==="both"){
        doc.save(`NCC_Parade_${parade.date}_${parade.session}.pdf`);
      }

      if(fmt==="jpg"||fmt==="both"){
        /* Convert PDF pages to JPG using pdf.js CDN */
        await downloadPdfAsJpgs(doc, parade);
      }
    }catch(e){
      alert("Generation failed: "+e.message);
    }
    setBusy(false);
    onClose();
  }

  async function downloadPdfAsJpgs(doc, parade){
    /* Load pdf.js to render each page */
    if(!window.pdfjsLib){
      await new Promise((res,rej)=>{
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const pdfBytes = doc.output("arraybuffer");
    const pdfDoc   = await window.pdfjsLib.getDocument({data:pdfBytes}).promise;
    const pageNames=["AttendanceRegister","TrainingDiary","ParadeState","RollOfAbsentees"];
    for(let i=1;i<=pdfDoc.numPages;i++){
      const page    = await pdfDoc.getPage(i);
      const vp      = page.getViewport({scale:3}); // 3x = ~220dpi
      const canvas  = document.createElement("canvas");
      canvas.width  = vp.width; canvas.height = vp.height;
      await page.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise;
      await new Promise(res=>{
        canvas.toBlob(blob=>{
          const a=document.createElement("a");
          a.href=URL.createObjectURL(blob);
          a.download=`NCC_${pageNames[i-1]}_${parade.date}_${parade.session}.jpg`;
          a.click();
          URL.revokeObjectURL(a.href);
          res();
        },"image/jpeg",0.95);
      });
    }
  }

  const Field=({label,k,placeholder,half})=>(
    <div style={{flex:half?"1 1 45%":"1 1 100%",minWidth:0}}>
      <p style={{fontSize:"0.65rem",color:"var(--csi-text-muted)",marginBottom:"0.18rem",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</p>
      <input className="csi-input" style={{width:"100%",fontSize:"0.8rem"}}
        value={f[k]} onChange={e=>set(k,e.target.value)} placeholder={placeholder||""}/>
    </div>
  );

  const Section=({title,children})=>(
    <div style={{marginBottom:"0.9rem"}}>
      <p style={{fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",color:"var(--csi-indigo-light)",
        textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.5rem",borderBottom:"1px solid var(--csi-border)",paddingBottom:"0.25rem"}}>{title}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem"}}>{children}</div>
    </div>
  );

  return createPortal(
    <div className="csi-modal-backdrop" onClick={onClose}>
      <div className="csi-modal" style={{maxWidth:"640px",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="csi-modal__header">
          <div>
            <p style={{fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",color:"var(--csi-indigo-light)",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 0.15rem"}}>
              Parade Documents
            </p>
            <h3 style={{fontFamily:"var(--csi-font-display)",fontSize:"1rem",fontWeight:800,color:"var(--csi-text-primary)",margin:0}}>
              Download NCC Forms
            </h3>
            <p style={{fontSize:"0.72rem",color:"var(--csi-text-muted)",marginTop:"0.2rem"}}>
              {parade.date} · {parade.session} · Fill missing details then generate
            </p>
          </div>
          <button className="csi-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="csi-modal__body">
          {/* Format selector */}
          <Section title="Output Format">
            {[["pdf","PDF (4 pages)"],["jpg","JPG (4 images)"],["both","PDF + JPG both"]].map(([v,l])=>(
              <button key={v} className={`csi-pill${fmt===v?" csi-pill--active":""}`}
                onClick={()=>setFmt(v)} style={{flex:"none"}}>{l}</button>
            ))}
          </Section>

          <Section title="Personnel Details">
            <Field label="ANO Name *" k="anoName" placeholder="e.g. Capt. John Smith"/>
            <Field label="PI Staff Name" k="piStaffName" placeholder="Name of PI Staff conducting parade"/>
            <Field label="Officer Count (for Parade State)" k="officerCount" placeholder="0" half/>
            <Field label="No. of Parade" k="noOfParade" placeholder="e.g. 12" half/>
          </Section>

          <Section title="Timing">
            <Field label="Parade From *" k="paradeFrom" placeholder="e.g. 08:00 Hrs" half/>
            <Field label="Parade To *"   k="paradeTo"   placeholder="e.g. 10:00 Hrs" half/>
            <Field label="No. of Periods *" k="noPeriods" placeholder="e.g. 4" half/>
          </Section>

          <Section title="Subjects Covered">
            <Field label="Common Subject 1" k="cs1" placeholder="e.g. Drill"/>
            <Field label="Common Subject 2" k="cs2" placeholder="e.g. Map Reading"/>
            <Field label="Common Subject 3" k="cs3" placeholder="e.g. Obstacle Training"/>
            <Field label="Common Subject 4" k="cs4" placeholder="e.g. First Aid"/>
            <Field label="Specialized Subject 1" k="ss1" placeholder="e.g. Weapon Training"/>
            <Field label="Specialized Subject 2" k="ss2" placeholder="e.g. Field Craft"/>
            <Field label="Specialized Subject 3" k="ss3" placeholder="e.g. Communication"/>
          </Section>

          <Section title="Senior Cadets on Parade">
            <Field label="Sr Cadet 1 Name" k="srCdt1Name" placeholder="Auto-filled from top rank" half/>
            <Field label="Sr Cadet 1 Mobile" k="srCdt1Mobile" placeholder="Mobile No." half/>
            <Field label="Sr Cadet 2 Name" k="srCdt2Name" placeholder="Auto-filled from top rank" half/>
            <Field label="Sr Cadet 2 Mobile" k="srCdt2Mobile" placeholder="Mobile No." half/>
          </Section>

          <Section title="Additional Info">
            <Field label="VIP / Dignitary Visit (optional)" k="vipVisit" placeholder="Name and designation, or leave blank" half/>
            <Field label="VIP Visit Date" k="vipDate" placeholder="e.g. 07 Mar 2026" half/>
            <Field label="Next Parade Date" k="nextParadeDate" placeholder="e.g. 14 Mar 2026" half/>
            <Field label="Next Parade From" k="nextParadeTime" placeholder="e.g. 08:00 Hrs" half/>
            <Field label="Next Parade To" k="nextParadeEndTime" placeholder="e.g. 10:00 Hrs" half/>
            <Field label="Remarks" k="remarks1" placeholder="Any additional remarks"/>
          </Section>

          {/* Signature guide */}
          <div style={{background:"var(--csi-bg-card-alt,var(--csi-surface))",border:"1px solid var(--csi-border)",borderRadius:"0.5rem",padding:"0.75rem",fontSize:"0.75rem",color:"var(--csi-text-sub)",lineHeight:1.6}}>
            <p style={{fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",color:"var(--csi-amber)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>
              📝 Signature Boxes
            </p>
            <p>All signature lines are left <strong>blank</strong> — print and sign physically, or use the signature upload guide below.</p>
            <p style={{marginTop:"0.4rem",fontWeight:600,color:"var(--csi-text-primary)"}}>How to set up digital signatures:</p>
            <ol style={{paddingLeft:"1.2rem",marginTop:"0.3rem"}}>
              <li>Sign on white paper → photograph it → crop to signature only → save as <code>.png</code></li>
              <li>In Supabase → Storage → create a bucket called <code>signatures</code> (set to <em>private</em>)</li>
              <li>Upload files as: <code>ano_signature.png</code>, <code>co_signature.png</code>, <code>sm_jco_signature.png</code>, <code>adm_offr_signature.png</code></li>
              <li>For PI Staff / guests: upload as <code>pi_staff/[name].png</code> — we will add a Signature Manager panel later</li>
            </ol>
            <p style={{marginTop:"0.4rem",color:"var(--csi-text-muted)",fontSize:"0.68rem"}}>
              Once uploaded, signatures will auto-embed into future PDF exports. We will wire this up when we build the Unit Details panel.
            </p>
          </div>
        </div>

        <div style={{padding:"0.9rem 1.1rem",borderTop:"1px solid var(--csi-border)",display:"flex",gap:"0.6rem",justifyContent:"flex-end"}}>
          <button className="csi-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="csi-btn-primary" onClick={handleGenerate} disabled={busy||!f.anoName||!f.paradeFrom||!f.paradeTo||!f.noPeriods}>
            {busy?"Generating…":"⬇ Generate & Download"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════
   PANEL 3 — PARADE RECORD
══════════════════════════════════════════════════════════════ */
function PanelParadeRecord(){
  const [selDate,      setSelDate]      = useState(TODAY);
  const [selSession,   setSelSession]   = useState("morning");
  const [rows,         setRows]         = useState([]);
  const [reports,      setReports]      = useState({});
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [catFilter,    setCatFilter]    = useState("ALL");
  const [divFilter,    setDivFilter]    = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortCol,      setSortCol]      = useState("rank");
  const [sortDir,      setSortDir]      = useState("asc");
  const [openReport,   setOpenReport]   = useState(null);
  const [showDownload, setShowDownload] = useState(false);

  async function loadParade(){
    setLoading(true); setError(null); setRows([]); setReports({});
    const { data, error:err } = await supabase.rpc("get_csi_parade_record",{
      p_parade_date:selDate, p_session:selSession,
    });
    if (err){
      const is404 = err.code==="PGRST202"||err.message?.toLowerCase().includes("404")||err.message?.toLowerCase().includes("not found");
      setError(is404
        ? `RPC not found (404). This is NOT an RLS issue — the function simply doesn't exist yet.\n\nRun this in your Supabase SQL editor:\n\nCREATE OR REPLACE FUNCTION get_csi_parade_record(p_parade_date date, p_session text)\nRETURNS SETOF ... AS $$ ... $$ LANGUAGE sql;\n\nIf you already have it, check the function name matches exactly.`
        : err.message);
      setLoading(false); return;
    }
    if (!data?.length){ setError(`No parade found for ${selDate} (${selSession} session).`); setLoading(false); return; }
    setRows(data);
    const paradeId=data[0].parade_id;
    const { data:rData }=await supabase.from("parade_reports").select("category,report_text,updated_at").eq("parade_id",paradeId);
    const rMap={}; (rData||[]).forEach(r=>{rMap[r.category]=r;}); setReports(rMap);
    setLoading(false);
  }

  const header        = rows[0]??null;
  const totalPresent  = header?Number(header.present_strength):0;
  const totalStrength = header?Number(header.total_strength):0;
  const presentPct    = totalStrength>0?(totalPresent/totalStrength)*100:0;

  /* ── column-header sort ── */
  function toggleSort(col){
    if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else{ setSortCol(col); setSortDir("asc"); }
  }
  const SortIcon=({col})=>{
    if(sortCol!==col) return <span style={{opacity:0.3,fontSize:"0.6rem"}}> ⇅</span>;
    return <span style={{fontSize:"0.6rem",color:"var(--csi-indigo-light)"}}> {sortDir==="asc"?"↑":"↓"}</span>;
  };

  const filteredRows = useMemo(()=>{
    let arr=[...rows];
    if (catFilter!=="ALL")    arr=arr.filter(r=>r.category===catFilter);
    if (divFilter!=="ALL")    arr=arr.filter(r=>r.division===divFilter);
    if (statusFilter!=="ALL") arr=arr.filter(r=>{
      if (statusFilter==="present") return r.att_status==="present";
      if (statusFilter==="awp")     return r.att_status==="absent_with_permission";
      if (statusFilter==="awop")    return r.att_status==="absent_without_permission";
      return true;
    });
    arr.sort((a,b)=>{
      let va,vb;
      if(sortCol==="rank"){
        va=RANK_ORDER.indexOf(a.rank); vb=RANK_ORDER.indexOf(b.rank);
        if(va===-1)va=99; if(vb===-1)vb=99;
        return sortDir==="asc"?va-vb:vb-va;
      }
      if(sortCol==="enrollment"){ va=a.enrollment_no??""; vb=b.enrollment_no??""; }
      else if(sortCol==="name")  { va=a.cadet_name??"";   vb=b.cadet_name??""; }
      else if(sortCol==="cat")   { va=a.category??"";     vb=b.category??""; }
      else if(sortCol==="div")   { va=a.division??"";     vb=b.division??""; }
      else if(sortCol==="status"){ va=a.att_status??"";   vb=b.att_status??""; }
      else { va=""; vb=""; }
      const cmp = String(va).localeCompare(String(vb));
      return sortDir==="asc"?cmp:-cmp;
    });
    return arr;
  },[rows,catFilter,divFilter,statusFilter,sortCol,sortDir]);

  const reportPopup = openReport ? createPortal(
    <div className="csi-modal-backdrop" onClick={()=>setOpenReport(null)}>
      <div className="csi-modal" style={{ maxWidth:"520px" }} onClick={e=>e.stopPropagation()}>
        <div className="csi-modal__header">
          <div>
            <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.6rem",color:"var(--csi-indigo-light)",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 0.15rem" }}>Category Report</p>
            <h3 style={{ fontFamily:"var(--csi-font-display)",fontSize:"1rem",fontWeight:800,color:"var(--csi-text-primary)",margin:0 }}>Category {openReport}</h3>
            {reports[openReport]?.updated_at && <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.58rem",color:"var(--csi-text-muted)",marginTop:"0.15rem" }}>Updated {new Date(reports[openReport].updated_at).toLocaleString()}</p>}
          </div>
          <button className="csi-modal__close" onClick={()=>setOpenReport(null)}>×</button>
        </div>
        <div className="csi-modal__body">
          <p style={{ color:"var(--csi-text-primary)",fontSize:"0.82rem",lineHeight:1.75,whiteSpace:"pre-wrap" }}>{reports[openReport]?.report_text}</p>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  /* sortable TH helper */
  const STH=({col,label,noSort})=>(
    <th onClick={noSort?undefined:()=>toggleSort(col)}
      style={{cursor:noSort?"default":"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
      {label}{!noSort&&<SortIcon col={col}/>}
    </th>
  );

  return (
    <div>
      <div className="csi-filter-bar">
        <div className="csi-filter-group">
          <label className="csi-filter-label">Parade Date</label>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} className="csi-input"/>
        </div>
        <div className="csi-filter-group">
          <label className="csi-filter-label">Session</label>
          <div className="csi-pill-group">
            {["morning","evening"].map(s=><button key={s} className={`csi-pill${selSession===s?" csi-pill--active":""}`} onClick={()=>setSelSession(s)} style={{ textTransform:"capitalize" }}>{s}</button>)}
          </div>
        </div>
        <button className="csi-btn-primary" onClick={loadParade} disabled={loading}>{loading?"Loading…":"Load Parade"}</button>
        {rows.length>0 && (
          <button className="csi-btn-ghost" onClick={()=>setShowDownload(true)}
            style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"0.35rem"}}>
            ⬇ Download Documents
          </button>
        )}
      </div>

      {error && (
        <div className="csi-error" style={{ whiteSpace:"pre-wrap" }}>⚠ {error}</div>
      )}

      {!loading&&!error&&rows.length===0 && (
        <div className="csi-card"><div className="csi-empty">
          <div className="csi-empty__icon">📋</div>
          <p className="csi-empty__text">Select a date and session, then press Load Parade.</p>
        </div></div>
      )}

      {rows.length>0 && (
        <div className="csi-split">
          {/* LEFT */}
          <div className="csi-split__left">
            <div className="csi-card">
              <p className="csi-section-label">Parade Details</p>
              <div className="csi-meta-list">
                {[
                  {label:"Date",        val:selDate},
                  {label:"Session",     val:selSession.charAt(0).toUpperCase()+selSession.slice(1)},
                  {label:"Status",      val:header.parade_status},
                  {label:"Refreshments",val:header.refreshments_given?"Yes":"No"},
                  {label:"Closed At",   val:header.closed_at?new Date(header.closed_at).toLocaleString():"—"},
                ].map(({label,val})=>(
                  <div key={label} className="csi-meta-row">
                    <span className="csi-meta-key">{label}</span>
                    <span className="csi-meta-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="csi-card">
              <p className="csi-section-label">Strength</p>
              <div className="csi-strength-nums">
                <div className="csi-strength-num">
                  <p className="csi-strength-num__val" style={{ color:pctHex(presentPct) }}>{totalPresent}</p>
                  <p className="csi-strength-num__label">Present</p>
                </div>
                <span className="csi-strength-divider">/</span>
                <div className="csi-strength-num">
                  <p className="csi-strength-num__val" style={{ color:"var(--csi-text-primary)" }}>{totalStrength}</p>
                  <p className="csi-strength-num__label">Total</p>
                </div>
              </div>
              <TriBar present={presentPct} awp={0} awop={100-presentPct}/>
              <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.62rem",color:pctHex(presentPct),textAlign:"right",marginTop:"0.28rem" }}>{fmt(presentPct)}%</p>
              <div style={{ marginTop:"0.65rem" }}>
                {[["Cat A",header.cat_a_strength],["Cat B",header.cat_b_strength],["Cat C",header.cat_c_strength]].map(([l,v])=>(
                  <div key={l} className="csi-meta-row" style={{ marginBottom:"0.25rem" }}>
                    <span className="csi-meta-key">{l}</span>
                    <span className="csi-meta-val">{v??0}</span>
                  </div>
                ))}
              </div>
            </div>

            {header.parade_type_map && (
              <div className="csi-card">
                <p className="csi-section-label">Activity by Category</p>
                {Object.entries(header.parade_type_map).map(([cat,type])=>(
                  <div key={cat} className="csi-meta-row" style={{ marginBottom:"0.28rem" }}>
                    <span className="csi-meta-key">Cat {cat}</span>
                    <span className="csi-meta-val">{type}</span>
                  </div>
                ))}
              </div>
            )}

            {(header.ano_remarks||header.parade_remarks) && (
              <div className="csi-card">
                <p className="csi-section-label">Remarks</p>
                {header.parade_remarks && <div style={{ marginBottom:"0.6rem" }}>
                  <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.57rem",color:"var(--csi-text-muted)",textTransform:"uppercase",marginBottom:"0.2rem" }}>Parade</p>
                  <p style={{ fontSize:"0.77rem",color:"var(--csi-text-sub)",lineHeight:1.55 }}>{header.parade_remarks}</p>
                </div>}
                {header.ano_remarks && <div>
                  <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.57rem",color:"var(--csi-text-muted)",textTransform:"uppercase",marginBottom:"0.2rem" }}>ANO</p>
                  <p style={{ fontSize:"0.77rem",color:"var(--csi-text-sub)",lineHeight:1.55 }}>{header.ano_remarks}</p>
                </div>}
              </div>
            )}

            <div className="csi-card">
              <p className="csi-section-label">Category Reports</p>
              {["A","B","C"].map(cat=>{
                const report=reports[cat],catIn=header.categories?.includes(cat);
                if (!catIn) return null;
                return (
                  <div key={cat} className={`csi-report-card${!report?" csi-report-card--pending":""}`} onClick={()=>report&&setOpenReport(cat)}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.69rem",color:"var(--csi-text-sub)",fontWeight:600 }}>Category {cat}</span>
                      {report
                        ? <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.57rem",color:"var(--csi-green)" }}>✓ Submitted</span>
                        : <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.57rem",color:"var(--csi-red)" }}>✗ Pending</span>
                      }
                    </div>
                    {report && <p style={{ fontSize:"0.69rem",color:"var(--csi-text-muted)",marginTop:"0.28rem",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{report.report_text}</p>}
                    {report && <p style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.57rem",color:"var(--csi-indigo-light)",marginTop:"0.22rem" }}>Tap to read →</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT */}
          <div className="csi-split__right">
            <div className="csi-card" style={{ display:"flex",flexWrap:"wrap",gap:"0.5rem",alignItems:"flex-end" }}>
              {[
                {label:"Category", pills:[{v:"ALL",l:"All"},{v:"A",l:"A"},{v:"B",l:"B"},{v:"C",l:"C"}], state:catFilter,    set:setCatFilter},
                {label:"Division", pills:[{v:"ALL",l:"All"},{v:"SD",l:"SD"},{v:"SW",l:"SW"}],            state:divFilter,    set:setDivFilter},
                {label:"Status",   pills:[{v:"ALL",l:"All"},{v:"present",l:"Present"},{v:"awp",l:"AbsWP"},{v:"awop",l:"AbsWOP"}], state:statusFilter, set:setStatusFilter},
              ].map(({label,pills,state,set})=>(
                <div key={label}>
                  <p className="csi-filter-label" style={{ marginBottom:"0.22rem" }}>{label}</p>
                  <div className="csi-pill-group">
                    {pills.map(({v,l})=><button key={v} className={`csi-pill${state===v?" csi-pill--active":""}`} onClick={()=>set(v)}>{l}</button>)}
                  </div>
                </div>
              ))}
              <span style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.62rem",color:"var(--csi-text-muted)",alignSelf:"flex-end",marginLeft:"auto" }}>
                {filteredRows.length} / {rows.length} cadets
              </span>
            </div>

            <div className="csi-table-wrap">
              <div className="csi-table-scroll">
                <table className="csi-table">
                  <thead>
                    <tr>
                      <STH col="enrollment" label="Enrollment"/>
                      <STH col="name"       label="Name"/>
                      <STH col="rank"       label="Rank"/>
                      <STH col="cat"        label="Cat"/>
                      <STH col="div"        label="Div"/>
                      <STH col="activity"   label="Activity" noSort/>
                      <STH col="status"     label="Status"/>
                      <STH col="reason"     label="Reason" noSort/>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r,i)=>{
                      const isAlumni=!r.is_active;
                      return (
                        <tr key={r.cadet_id??i} className={`${i%2?"alt":""} no-click`} style={{ opacity:isAlumni?0.55:1 }}>
                          <td style={{ fontFamily:"var(--csi-font-mono)",fontSize:"0.69rem",color:"var(--csi-text-sub)" }}>{r.enrollment_no}</td>
                          <td>
                            <div style={{ display:"flex",alignItems:"center",gap:"0.4rem" }}>
                              <span style={{ color:"var(--csi-text-primary)",fontSize:"0.79rem",fontWeight:500 }}>{r.cadet_name}</span>
                              {isAlumni && <span className="csi-badge csi-badge--alumni">Alumni</span>}
                            </div>
                          </td>
                          <td style={{ color:"var(--csi-text-sub)" }}>{r.rank}</td>
                          <td><span className="csi-badge csi-badge--neutral">{r.category}</span></td>
                          <td><span className="csi-badge csi-badge--neutral">{r.division}</span></td>
                          <td style={{ color:"var(--csi-text-muted)",fontSize:"0.76rem" }}>{r.cadet_parade_type??"—"}</td>
                          <td><span className={stBadge(r.att_status)}>{stLabel(r.att_status)}</span></td>
                          <td style={{ color:"var(--csi-text-muted)",fontSize:"0.72rem",fontStyle:"italic" }}>{r.att_reason??"—"}</td>
                        </tr>
                      );
                    })}
                    {filteredRows.length===0 && <tr><td colSpan={8} className="csi-table-empty">No cadets match current filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {reportPopup}
      {showDownload && rows.length>0 && (
        <DownloadModal
          parade={{ date:selDate, session:selSession, refreshments:header?.refreshments_given }}
          rows={rows}
          onClose={()=>setShowDownload(false)}
        />
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   ROOT — TAB SHELL
══════════════════════════════════════════════════════════════ */
const TABS = [
  {id:"unit",    label:"Unit Summary"},
  {id:"profile", label:"Cadet Profile"},
  {id:"parade",  label:"Parade Record"},
];

export default function CsiDashboard(){
  const [activeTab, setActiveTab] = useState("unit");
  return (
    <div className="csi-page">
      <div className="csi-inner">
        <div className="csi-header">
          <p className="csi-header__eyebrow">CSI · Cadet Strength Intelligence</p>
          <h1 className="csi-header__title">Dashboard</h1>
        </div>
        <div className="csi-tabs">
          {TABS.map(tab=>(
            <button key={tab.id} className={`csi-tab${activeTab===tab.id?" csi-tab--active":""}`}
              onClick={()=>setActiveTab(tab.id)}>{tab.label}</button>
          ))}
        </div>
        {activeTab==="unit"    && <PanelUnitSummary/>}
        {activeTab==="profile" && <PanelCadetProfile/>}
        {activeTab==="parade"  && <PanelParadeRecord/>}
      </div>
    </div>
  );
}
