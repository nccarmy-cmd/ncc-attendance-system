import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../components/ThemeContext";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SYNE = { fontFamily: "'Syne', sans-serif" };

const DASHBOARD_PANELS = {
  "ANO Dashboard": [
    "Create Parade",
    "Permissions",
    "Review & Close",
    "CSI — Unit Summary",
    "CSI — Cadet Profile",
    "CSI — Parade Record",
    "Batch Promotion — Batch Promotion",
    "Batch Promotion — Rank Change",
    "Batch Promotion — New A Intake",
    "Batch Promotion — Promotion History",
    "AdminDesk",
  ],
  "Senior Dashboard": [
    "Attendance Marking",
    "Report Submission",
    "AdminDesk",
  ],
};

const SIGNAL_TYPES = [
  { val: "bug", label: "Bug", icon: "🐛", desc: "Something is broken or behaving incorrectly" },
  { val: "enhancement", label: "Enhancement", icon: "✨", desc: "A suggestion to improve existing functionality" },
  { val: "data_issue", label: "Data Issue", icon: "🗄", desc: "Incorrect, missing or inconsistent data" },
  { val: "other", label: "Other", icon: "📋", desc: "General feedback or anything else" },
];

const PRIORITIES = [
  { val: "low", label: "Low", color: "var(--csi-text-muted)", bg: "var(--csi-bg-input)", border: "var(--csi-border-input)" },
  { val: "medium", label: "Medium", color: "#fbbf24", bg: "#451a03", border: "#92400e" },
  { val: "high", label: "High", color: "#f87171", bg: "#450a0a", border: "#b91c1c" },
];

const STATUSES = [
  { val: "open", label: "Open", color: "#93c5fd", bg: "#1e3a5f", border: "#1d4ed8" },
  { val: "acknowledged", label: "Acknowledged", color: "#c4b5fd", bg: "#2e1065", border: "#7c3aed" },
  { val: "in_progress", label: "In Progress", color: "#fbbf24", bg: "#451a03", border: "#92400e" },
  { val: "resolved", label: "Resolved", color: "#86efac", bg: "#14532d", border: "#15803d" },
  { val: "dismissed", label: "Dismissed", color: "var(--csi-text-sub)", bg: "var(--csi-bg-input)", border: "var(--csi-border-input)" },
];

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function statusStyle(val) {
  return STATUSES.find((s) => s.val === val) ?? STATUSES[0];
}
function priorityStyle(val) {
  return PRIORITIES.find((p) => p.val === val) ?? PRIORITIES[0];
}
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─────────────────────────────────────────
   NOTIFICATION BANNER
───────────────────────────────────────── */
function NotificationBanner({ notifications, onDismiss }) {
  if (!notifications.length) return null;
  return (
    <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {notifications.map((n) => {
        const st = statusStyle(n.admindesk?.status);
        return (
          <div key={n.id} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: "0.75rem", padding: "0.85rem 1.1rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...MONO, fontSize: "0.65rem", color: st.color, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.2rem" }}>
                AdminDesk Update · {n.admindesk?.title}
              </p>
              <p style={{ fontSize: "0.82rem", color: "var(--csi-text-primary)", margin: 0 }}>{n.message}</p>
              {n.admindesk?.admin_note && (
                <p style={{ fontSize: "0.75rem", color: "var(--csi-text-sub)", fontStyle: "italic", margin: "0.3rem 0 0" }}>
                  Admin note: "{n.admindesk.admin_note}"
                </p>
              )}
            </div>
            <button onClick={() => onDismiss(n.id)}
              style={{ background: "none", border: "none", color: "var(--csi-text-muted)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, flexShrink: 0, padding: "0 0.2rem" }}
              onMouseEnter={(e) => (e.target.style.color = "white")}
              onMouseLeave={(e) => (e.target.style.color = "#64748b")}>×</button>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────
   SIGNAL DETAIL MODAL
───────────────────────────────────────── */
function SignalDetailModal({ signal, isAno, onClose, onUpdate }) {
  const [status, setStatus] = useState(signal.status);
  const [adminNote, setAdminNote] = useState(signal.admin_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  async function handleSave() {
    setSaving(true); setError(null);
    const { error: err } = await supabase
      .from("admindesk")
      .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() })
      .eq("id", signal.id);
    if (err) { setError(err.message); setSaving(false); return; }

    // Insert notification for the submitter
    if (signal.submitted_by) {
      await supabase.from("notifications").insert({
        admindesk_id: signal.id,
        user_id: signal.submitted_by,
        message: `Your report "${signal.title}" status changed to ${status}.`,
        type: "admindesk",
        target_role: signal.role,
        is_active: true,
      });
    }

    onUpdate({ ...signal, status, admin_note: adminNote });
    setSaving(false);
    onClose();
  }

  const st = statusStyle(signal.status);
  const pt = priorityStyle(signal.priority);
  const sigType = SIGNAL_TYPES.find((t) => t.val === signal.signal_type);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-border-input)", borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.7)", width: "100%", maxWidth: "620px", margin: "0 1rem", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--csi-bg-input)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: 1, marginRight: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <span style={{ ...MONO, fontSize: "0.6rem", background: st.bg, border: `1px solid ${st.border}`, color: st.color, borderRadius: "0.25rem", padding: "0.15rem 0.45rem" }}>{st.label}</span>
              <span style={{ ...MONO, fontSize: "0.6rem", background: pt.bg, border: `1px solid ${pt.border}`, color: pt.color, borderRadius: "0.25rem", padding: "0.15rem 0.45rem" }}>{pt.label} Priority</span>
              <span style={{ ...MONO, fontSize: "0.6rem", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-sub)", borderRadius: "0.25rem", padding: "0.15rem 0.45rem" }}>{sigType?.icon} {sigType?.label}</span>
            </div>
            <h2 style={{ ...SYNE, fontSize: "1.15rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: "0 0 0.25rem" }}>{signal.title}</h2>
            <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", margin: 0 }}>
              {signal.dashboard}{signal.panel ? ` → ${signal.panel}` : ""} · {signal.role} · {timeAgo(signal.created_at)}
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--csi-text-muted)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}
            onMouseEnter={(e) => (e.target.style.color = "white")}
            onMouseLeave={(e) => (e.target.style.color = "#64748b")}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Description */}
          <div>
            <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Description</p>
            <div style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", borderRadius: "0.6rem", padding: "0.85rem 1rem" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--csi-text-primary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{signal.description}</p>
            </div>
          </div>

          {/* ANO management section */}
          {isAno && (
            <>
              <div>
                <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Update Status</p>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {STATUSES.map((s) => (
                    <button key={s.val} onClick={() => setStatus(s.val)}
                      style={{ ...MONO, fontSize: "0.65rem", padding: "0.4rem 0.75rem", border: `1px solid ${status === s.val ? s.border : "var(--csi-border-input)"}`, borderRadius: "0.4rem", cursor: "pointer", background: status === s.val ? s.bg : "var(--csi-bg-input)", color: status === s.val ? s.color : "#64748b", fontWeight: status === s.val ? 700 : 400, transition: "all 0.15s" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Admin Note <span style={{ color: "var(--csi-border-input)" }}>(visible to submitter)</span></p>
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a note for the submitter — e.g. acknowledged, fix planned for next update…"
                  rows={3}
                  style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} />
              </div>
              {error && <p style={{ ...MONO, fontSize: "0.72rem", color: "#f87171" }}>⚠ {error}</p>}
              <button onClick={handleSave} disabled={saving}
                style={{ background: "#4f46e5", border: "none", color: "var(--csi-text-primary)", fontSize: "0.82rem", fontWeight: 700, borderRadius: "0.5rem", padding: "0.6rem 1.5rem", cursor: "pointer", ...MONO, alignSelf: "flex-start" }}>
                {saving ? "Saving…" : "Save & Notify Submitter"}
              </button>
            </>
          )}

          {/* Existing admin note (read-only for non-ANO) */}
          {!isAno && signal.admin_note && (
            <div>
              <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Admin Note</p>
              <div style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", borderRadius: "0.6rem", padding: "0.85rem 1rem" }}>
                <p style={{ fontSize: "0.82rem", color: "var(--csi-text-sub)", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>{signal.admin_note}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────────────────────────────────
   SUBMIT FORM TAB
───────────────────────────────────────── */
function TabSubmit({ userRole, userId, onSubmitted }) {
  const dashboards = userRole === "ano"
    ? ["ANO Dashboard", "Senior Dashboard"]
    : ["Senior Dashboard"];

  const [dashboard, setDashboard] = useState(dashboards[0]);
  const [panel, setPanel] = useState("");
  const [signalType, setSignalType] = useState("bug");
  const [priority, setPriority] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const panels = DASHBOARD_PANELS[dashboard] ?? [];

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) { setError("Title and description are required."); return; }
    setSubmitting(true); setError(null);
    const { error: err } = await supabase.from("admindesk").insert({
      submitted_by: userId,
      role: userRole,
      dashboard,
      panel: panel || null,
      signal_type: signalType,
      title: title.trim(),
      description: description.trim(),
      priority,
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    setSuccess(true);
    setTitle(""); setDescription(""); setPanel(""); setSignalType("bug"); setPriority("medium");
    onSubmitted();
    setSubmitting(false);
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div style={{ maxWidth: "680px" }}>
      {success && (
        <div style={{ background: "#14532d", border: "1px solid #15803d", borderRadius: "0.75rem", padding: "0.85rem 1.1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.1rem" }}>✓</span>
          <p style={{ ...MONO, fontSize: "0.75rem", color: "#86efac", margin: 0 }}>Report submitted successfully. The team has been notified.</p>
        </div>
      )}
      {error && (
        <div style={{ background: "#450a0a", border: "1px solid #b91c1c", borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ ...MONO, fontSize: "0.75rem", color: "#fca5a5", margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "1rem", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem" }}>Your Role</p>
          <div style={{ ...MONO, fontSize: "0.82rem", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "#818cf8", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", display: "inline-block" }}>
            {userRole === "ano" ? "ANO" : "Senior Cadet"}
          </div>
        </div>

        {/* Dashboard */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Dashboard</p>
          <div style={{ display: "flex", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--csi-border-input)", width: "fit-content" }}>
            {dashboards.map((d) => (
              <button key={d} onClick={() => { setDashboard(d); setPanel(""); }}
                style={{ ...MONO, fontSize: "0.72rem", padding: "0.5rem 1rem", border: "none", cursor: "pointer", background: dashboard === d ? "#4f46e5" : "var(--csi-bg-input)", color: dashboard === d ? "white" : "#64748b", fontWeight: dashboard === d ? 700 : 400 }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Panel */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
            Panel <span style={{ color: "var(--csi-border-input)" }}>(optional)</span>
          </p>
          <select value={panel} onChange={(e) => setPanel(e.target.value)}
            style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: panel ? "#e2e8f0" : "#64748b", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", minWidth: "260px" }}>
            <option value="">— General / Not panel-specific —</option>
            {panels.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Signal type */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Report Type</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
            {SIGNAL_TYPES.map(({ val, label, icon, desc }) => (
              <button key={val} onClick={() => setSignalType(val)}
                style={{ background: signalType === val ? "#1e3a5f" : "var(--csi-bg-input)", border: `1px solid ${signalType === val ? "#3b82f6" : "var(--csi-border-input)"}`, borderRadius: "0.6rem", padding: "0.75rem", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <p style={{ fontSize: "1.1rem", margin: "0 0 0.2rem" }}>{icon}</p>
                <p style={{ ...MONO, fontSize: "0.7rem", fontWeight: 700, color: signalType === val ? "#93c5fd" : "#94a3b8", margin: "0 0 0.15rem" }}>{label}</p>
                <p style={{ fontSize: "0.62rem", color: "var(--csi-text-muted)", margin: 0, lineHeight: 1.4 }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Priority</p>
          <div style={{ display: "flex", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--csi-border-input)", width: "fit-content" }}>
            {PRIORITIES.map(({ val, label, color, bg, border }) => (
              <button key={val} onClick={() => setPriority(val)}
                style={{ ...MONO, fontSize: "0.72rem", padding: "0.45rem 1rem", border: "none", cursor: "pointer", background: priority === val ? bg : "var(--csi-bg-input)", color: priority === val ? color : "#64748b", fontWeight: priority === val ? 700 : 400, borderRight: "1px solid var(--csi-border-input)", transition: "all 0.1s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            Title <span style={{ color: "#f87171" }}>*</span>
            <span style={{ color: "var(--csi-border-input)", marginLeft: "0.5rem" }}>{title.length}/80</span>
          </p>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Short summary of the issue or request…"
            style={{ background: "var(--csi-bg-input)", border: `1px solid ${!title.trim() ? "var(--csi-border-input)" : "#475569"}`, color: "var(--csi-text-primary)", fontSize: "0.85rem", borderRadius: "0.5rem", padding: "0.6rem 0.85rem", width: "100%", boxSizing: "border-box" }} />
        </div>

        {/* Description */}
        <div>
          <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
            Description <span style={{ color: "#f87171" }}>*</span>
          </p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue or request in detail. Include steps to reproduce if it's a bug, or the expected behavior if it's an enhancement…"
            rows={5}
            style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.82rem", borderRadius: "0.5rem", padding: "0.65rem 0.85rem", width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} />
        </div>

        <button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim()}
          style={{ background: title.trim() && description.trim() ? "#4f46e5" : "var(--csi-bg-input)", border: "none", color: title.trim() && description.trim() ? "white" : "#475569", fontSize: "0.85rem", fontWeight: 700, borderRadius: "0.5rem", padding: "0.7rem 1.75rem", cursor: title.trim() && description.trim() ? "pointer" : "not-allowed", ...MONO, alignSelf: "flex-start", transition: "all 0.15s" }}>
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MY REPORTS TAB
───────────────────────────────────────── */
function TabMyReports({ userId, isAno, refreshTrigger }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");

  async function fetchReports() {
    setLoading(true);
    const { data } = await supabase
      .from("admindesk")
      .select("*")
      .eq("submitted_by", userId)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchReports(); }, [refreshTrigger]);

  const filtered = useMemo(() => {
    if (filterStatus === "ALL") return reports;
    return reports.filter((r) => r.status === filterStatus);
  }, [reports, filterStatus]);

  function handleUpdate(updated) {
    setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  }

  return (
    <div>
      {/* Filter */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setFilterStatus("ALL")}
          style={{ ...MONO, fontSize: "0.65rem", padding: "0.35rem 0.75rem", border: `1px solid ${filterStatus === "ALL" ? "#6366f1" : "var(--csi-border-input)"}`, borderRadius: "0.4rem", cursor: "pointer", background: filterStatus === "ALL" ? "#4f46e5" : "var(--csi-bg-input)", color: filterStatus === "ALL" ? "white" : "#64748b" }}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s.val} onClick={() => setFilterStatus(s.val)}
            style={{ ...MONO, fontSize: "0.65rem", padding: "0.35rem 0.75rem", border: `1px solid ${filterStatus === s.val ? s.border : "var(--csi-border-input)"}`, borderRadius: "0.4rem", cursor: "pointer", background: filterStatus === s.val ? s.bg : "var(--csi-bg-input)", color: filterStatus === s.val ? s.color : "#64748b", transition: "all 0.1s" }}>
            {s.label}
          </button>
        ))}
        <span style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-border-input)", marginLeft: "auto" }}>{filtered.length} reports</span>
      </div>

      {loading ? (
        <p style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-muted)", textAlign: "center", padding: "3rem" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</div>
          <p style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-muted)" }}>No reports found.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {filtered.map((r) => {
            const st = statusStyle(r.status);
            const pt = priorityStyle(r.priority);
            const sigType = SIGNAL_TYPES.find((t) => t.val === r.signal_type);
            return (
              <div key={r.id} onClick={() => setSelected(r)}
                style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.85rem", padding: "1rem 1.1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--csi-border-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--csi-bg-input)")}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ ...MONO, fontSize: "0.58rem", background: st.bg, border: `1px solid ${st.border}`, color: st.color, borderRadius: "0.2rem", padding: "0.1rem 0.35rem" }}>{st.label}</span>
                      <span style={{ ...MONO, fontSize: "0.58rem", background: pt.bg, border: `1px solid ${pt.border}`, color: pt.color, borderRadius: "0.2rem", padding: "0.1rem 0.35rem" }}>{pt.label}</span>
                      <span style={{ ...MONO, fontSize: "0.58rem", background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-muted)", borderRadius: "0.2rem", padding: "0.1rem 0.35rem" }}>{sigType?.icon} {sigType?.label}</span>
                    </div>
                    <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--csi-text-primary)", margin: "0 0 0.2rem" }}>{r.title}</p>
                    <p style={{ ...MONO, fontSize: "0.62rem", color: "var(--csi-text-muted)", margin: 0 }}>
                      {r.dashboard}{r.panel ? ` → ${r.panel}` : ""} · {timeAgo(r.created_at)}
                    </p>
                    {r.admin_note && (
                      <p style={{ fontSize: "0.72rem", color: "var(--csi-text-muted)", fontStyle: "italic", marginTop: "0.4rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                        Admin: "{r.admin_note}"
                      </p>
                    )}
                  </div>
                  <span style={{ color: "var(--csi-border-input)", fontSize: "0.9rem", flexShrink: 0 }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <SignalDetailModal signal={selected} isAno={isAno} onClose={() => setSelected(null)} onUpdate={handleUpdate} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   ALL REPORTS TAB (ANO only)
───────────────────────────────────────── */
function TabAllReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("open");
  const [filterType, setFilterType] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [search, setSearch] = useState("");

  async function fetchAll() {
    setLoading(true);
    let q = supabase.from("admindesk").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "ALL") q = q.eq("status", filterStatus);
    if (filterType !== "ALL") q = q.eq("signal_type", filterType);
    if (filterPriority !== "ALL") q = q.eq("priority", filterPriority);
    const { data } = await q;
    setReports(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [filterStatus, filterType, filterPriority]);

  const filtered = useMemo(() => {
    if (!search.trim()) return reports;
    const q = search.toLowerCase();
    return reports.filter((r) => r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
  }, [reports, search]);

  function handleUpdate(updated) {
    setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  }

  const openCount = reports.filter((r) => r.status === "open").length;
  const highCount = reports.filter((r) => r.priority === "high" && r.status !== "resolved" && r.status !== "dismissed").length;

  return (
    <div>
      {/* Admin placeholder banner */}
      <div style={{ background: "var(--csi-bg-card)", border: "1px dashed #334155", borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1rem" }}>🔐</span>
        <p style={{ ...MONO, fontSize: "0.65rem", color: "var(--csi-text-muted)", margin: 0 }}>
          Full admin management will be available when the Admin role is implemented. ANO can manage reports in the interim.
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.1rem", flexWrap: "wrap" }}>
        {[
          { label: "Open", val: openCount, color: "#93c5fd" },
          { label: "High Priority", val: highCount, color: "#f87171" },
          { label: "Total", val: reports.length, color: "var(--csi-text-primary)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.75rem", padding: "0.6rem 1rem" }}>
            <p style={{ ...MONO, fontSize: "0.58rem", color: "var(--csi-text-muted)", textTransform: "uppercase", margin: "0 0 0.15rem" }}>{label}</p>
            <p style={{ ...SYNE, fontSize: "1.4rem", fontWeight: 700, color, margin: 0 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.85rem", padding: "0.85rem 1rem", marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        {/* Status */}
        <div style={{ display: "flex", borderRadius: "0.4rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
          {[{ val: "ALL", label: "All" }, ...STATUSES].map((s) => (
            <button key={s.val} onClick={() => setFilterStatus(s.val)}
              style={{ ...MONO, fontSize: "0.6rem", padding: "0.35rem 0.65rem", border: "none", cursor: "pointer", background: filterStatus === s.val ? (s.val === "ALL" ? "#4f46e5" : s.bg) : "var(--csi-bg-input)", color: filterStatus === s.val ? (s.val === "ALL" ? "white" : s.color) : "#64748b", borderRight: "1px solid var(--csi-bg-input)", transition: "all 0.1s", whiteSpace: "nowrap" }}>
              {s.label}
            </button>
          ))}
        </div>
        {/* Type */}
        <div style={{ display: "flex", borderRadius: "0.4rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
          <button onClick={() => setFilterType("ALL")}
            style={{ ...MONO, fontSize: "0.6rem", padding: "0.35rem 0.65rem", border: "none", cursor: "pointer", background: filterType === "ALL" ? "#4f46e5" : "var(--csi-bg-input)", color: filterType === "ALL" ? "white" : "#64748b", borderRight: "1px solid var(--csi-bg-input)" }}>All Types</button>
          {SIGNAL_TYPES.map((t) => (
            <button key={t.val} onClick={() => setFilterType(t.val)}
              style={{ ...MONO, fontSize: "0.6rem", padding: "0.35rem 0.65rem", border: "none", cursor: "pointer", background: filterType === t.val ? "#1e3a5f" : "var(--csi-bg-input)", color: filterType === t.val ? "#93c5fd" : "#64748b", borderRight: "1px solid var(--csi-bg-input)" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {/* Priority */}
        <div style={{ display: "flex", borderRadius: "0.4rem", overflow: "hidden", border: "1px solid var(--csi-border-input)" }}>
          <button onClick={() => setFilterPriority("ALL")}
            style={{ ...MONO, fontSize: "0.6rem", padding: "0.35rem 0.65rem", border: "none", cursor: "pointer", background: filterPriority === "ALL" ? "#4f46e5" : "var(--csi-bg-input)", color: filterPriority === "ALL" ? "white" : "#64748b", borderRight: "1px solid var(--csi-bg-input)" }}>All</button>
          {PRIORITIES.map((p) => (
            <button key={p.val} onClick={() => setFilterPriority(p.val)}
              style={{ ...MONO, fontSize: "0.6rem", padding: "0.35rem 0.65rem", border: "none", cursor: "pointer", background: filterPriority === p.val ? p.bg : "var(--csi-bg-input)", color: filterPriority === p.val ? p.color : "#64748b", borderRight: "1px solid var(--csi-bg-input)" }}>
              {p.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports…"
          style={{ background: "var(--csi-bg-input)", border: "1px solid var(--csi-border-input)", color: "var(--csi-text-primary)", fontSize: "0.75rem", borderRadius: "0.4rem", padding: "0.35rem 0.7rem", width: "180px" }} />
        <span style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-border-input)", marginLeft: "auto" }}>{filtered.length} reports</span>
      </div>

      {loading ? (
        <p style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-muted)", textAlign: "center", padding: "3rem" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📭</div>
          <p style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-muted)" }}>No reports match current filters.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((r) => {
            const st = statusStyle(r.status);
            const pt = priorityStyle(r.priority);
            const sigType = SIGNAL_TYPES.find((t) => t.val === r.signal_type);
            return (
              <div key={r.id} onClick={() => setSelected(r)}
                style={{ background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.85rem", padding: "0.9rem 1.1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--csi-border-input)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--csi-bg-input)")}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: pt.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--csi-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                  </div>
                  <p style={{ ...MONO, fontSize: "0.6rem", color: "var(--csi-text-muted)", margin: 0 }}>
                    {sigType?.icon} {sigType?.label} · {r.dashboard}{r.panel ? ` → ${r.panel}` : ""} · {r.role} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <span style={{ ...MONO, fontSize: "0.58rem", background: st.bg, border: `1px solid ${st.border}`, color: st.color, borderRadius: "0.2rem", padding: "0.15rem 0.45rem", flexShrink: 0 }}>{st.label}</span>
                <span style={{ color: "var(--csi-border-input)", fontSize: "0.9rem", flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <SignalDetailModal signal={selected} isAno={true} onClose={() => setSelected(null)} onUpdate={handleUpdate} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   ROOT — ADMINDESK DASHBOARD
───────────────────────────────────────── */
export default function AdminDesk({ userRole = "ano" }) {
  const [userId, setUserId] = useState(null);
  const [unreadNotifs, setUnreadNotifs] = useState([]);
  const [activeTab, setActiveTab] = useState("submit");
  const [submitRefresh, setSubmitRefresh] = useState(0);

  const isAno = userRole === "ano";

  const TABS = [
    { id: "submit", label: "Submit Report" },
    { id: "mine", label: "My Reports" },
    ...(isAno ? [{ id: "all", label: "All Reports" }] : []),
  ];

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Fetch unread notifications for this user
      const { data } = await supabase
        .from("notifications")
        .select("*, admindesk:admindesk_id(title, status, admin_note)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("type", "admindesk")
        .order("created_at", { ascending: false });
      setUnreadNotifs(data || []);
    }
    init();
  }, []);

  async function dismissNotif(id) {
    await supabase.from("notifications").update({ is_active: false }).eq("id", id);
    setUnreadNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  if (!userId) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <p style={{ ...MONO, fontSize: "0.78rem", color: "var(--csi-text-muted)" }}>Loading…</p>
    </div>
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .bp-page { background: var(--csi-bg-page); color: var(--csi-text-primary); min-height: 100vh; padding: 1.5rem; transition: background 0.2s, color 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="bp-page">

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ ...MONO, fontSize: "0.7rem", color: "#818cf8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            NCC Unit Software
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h1 style={{ ...SYNE, fontSize: "1.9rem", fontWeight: 800, color: "var(--csi-text-primary)", margin: 0 }}>AdminDesk</h1>
            {unreadNotifs.length > 0 && (
              <span style={{ ...MONO, fontSize: "0.62rem", background: "#1e3a5f", border: "1px solid #3b82f6", color: "#93c5fd", borderRadius: "1rem", padding: "0.2rem 0.6rem" }}>
                {unreadNotifs.length} update{unreadNotifs.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--csi-text-muted)", marginTop: "0.25rem" }}>
            Report bugs, request enhancements, or flag data issues.
          </p>
        </div>

        {/* Notification banners */}
        <NotificationBanner notifications={unreadNotifs} onDismiss={dismissNotif} />

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", background: "var(--csi-bg-card)", border: "1px solid var(--csi-bg-input)", borderRadius: "0.75rem", padding: "0.25rem", width: "fit-content" }}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ ...MONO, fontSize: "0.75rem", fontWeight: activeTab === tab.id ? 700 : 400, padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", transition: "all 0.15s", background: activeTab === tab.id ? "#4f46e5" : "transparent", color: activeTab === tab.id ? "white" : "#64748b" }}>
              {tab.label}

            </button>
          ))}
        </div>

        {activeTab === "submit" && (
          <TabSubmit userRole={userRole} userId={userId} onSubmitted={() => setSubmitRefresh((n) => n + 1)} />
        )}
        {activeTab === "mine" && (
          <TabMyReports userId={userId} isAno={isAno} refreshTrigger={submitRefresh} />
        )}
        {activeTab === "all" && isAno && <TabAllReports />}
      </div>
    </>
  );
}
