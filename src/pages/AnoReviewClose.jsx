import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AnoReviewClose() {
  /* --------------------
     STATE
  -------------------- */
  const [parade, setParade] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cadets, setCadets] = useState([]);
  const [attendance, setAttendance] = useState([]);

  const [rankSummary, setRankSummary] = useState({});
  const [pendingSlots, setPendingSlots] = useState([]);

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [reports, setReports] = useState({});
  const [openReport, setOpenReport] = useState(null);

  const [remarks, setRemarks] = useState("");

  const presentCadets = [];
  const permissionCadets = [];
  const absentCadets = [];


  /* --------------------
     1️⃣ Load parade
  -------------------- */
  useEffect(() => {
    async function loadParade() {
      const { data, error } = await supabase
        .from("parades")
        .select("*")
        .eq("status", "attendance_submitted")
        .single();

      if (error) {
        alert("No parade ready for review");
        return;
      }

      setParade(data);
    }

    loadParade();
  }, []);

  useEffect(() => {
    if (parade) {
      setRemarks(parade.ano_remarks || "");
    }
  }, [parade]);

  /* --------------------
     2️⃣ Load cadets + attendance
  -------------------- */
  useEffect(() => {
    if (!parade) return;

    async function loadData() {
      setLoading(true);

      const { data: cadetData } = await supabase
        .from("cadets")
        .select("id, enrollment_no, name, rank, category, division")
        .eq("is_active", true)
        .in("category", parade.categories);

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("cadet_id, status")
        .eq("parade_id", parade.id);

      setCadets(cadetData || []);
      setAttendance(attendanceData || []);
      setLoading(false);
    }

    loadData();
  }, [parade]);

  /* --------------------
     3️⃣ Rank Summary (clean)
  -------------------- */
  useEffect(() => {
    const summary = {};

    cadets.forEach(c => {
      if (!summary[c.rank]) {
        summary[c.rank] = { total: 0, present: 0 };
      }
      summary[c.rank].total += 1;
    });

    attendance.forEach(a => {
      if (a.status === "present") {
        const cadet = cadets.find(c => c.id === a.cadet_id);
        if (cadet) {
          summary[cadet.rank].present += 1;
        }
      }
    });

    setRankSummary(summary);
  }, [cadets, attendance]);

  /* --------------------
     4️⃣ Pending Slots
  -------------------- */
  useEffect(() => {
    const slots = [];
    const categories = ["A", "B", "C"];
    const divisions = ["SD", "SW"];

    categories.forEach(cat => {
      divisions.forEach(div => {
        const scoped = cadets.filter(
          c => c.category === cat && c.division === div
        );

        if (scoped.length === 0) return;

        const hasAttendance = attendance.some(a =>
          scoped.some(c => c.id === a.cadet_id)
        );

        if (!hasAttendance) {
          slots.push({ category: cat, division: div });
        }
      });
    });

    setPendingSlots(slots);
  }, [cadets, attendance]);


  /* --------------------
   Load Category Reports
  -------------------- */
  useEffect(() => {
    if (!parade) return;

    async function loadReports() {
      const { data, error } = await supabase
        .from("parade_reports")
        .select("category, report_text, updated_at")
        .eq("parade_id", parade.id);

      if (error) {
        console.error("Failed to load reports", error);
        return;
      }

      // Convert array → map { A: report, B: report }
      const map = {};
      data.forEach(r => {
        map[r.category] = r;
      });

      setReports(map);
    }

    loadReports();
  }, [parade]);


  /* --------------------
     HELPERS
  -------------------- */
  function isPending(category, division) {
    return pendingSlots.some(
      s =>
        (category === "ALL" || s.category === category) &&
        (division === "ALL" || s.division === division)
    );
  }

  async function informSeniors() {
    if (!parade || pendingSlots.length === 0) {
      alert("No pending attendance to notify.");
      return;
    }

    const notificationsPayload = pendingSlots.map(slot => ({
      parade_id: parade.id,
      type: "pending",
      message: `Attendance for Category ${slot.category} – ${slot.division} is pending. Submit attendance immediately.`
    }));

    const { error } = await supabase
      .from("notifications")
      .insert(notificationsPayload);

    if (error) {
      console.error("Notification insert failed:", error);
      alert("Failed to notify seniors. Check console.");
      return;
    }

    alert("Seniors notified successfully.");
  }

  /* --------------------
     DERIVED + FILTERED CADETS
  -------------------- */
  const scopedCadets = cadets.filter(c =>
    (categoryFilter === "ALL" || c.category === categoryFilter) &&
    (divisionFilter === "ALL" || c.division === divisionFilter)
  );

 

  const filteredCadets = cadets.filter(c => {
    if (categoryFilter !== "ALL" && c.category !== categoryFilter) return false;
    if (divisionFilter !== "ALL" && c.division !== divisionFilter) return false;
    return true;
  });

  filteredCadets.forEach(cadet => {
    const record = attendance.find(a => a.cadet_id === cadet.id);

    if (record?.status === "present") {
      presentCadets.push(cadet);
    } else if (record?.status === "absent_with_permission") {
      permissionCadets.push(cadet);
    } else {
      absentCadets.push(cadet);
    }
  });

  const totalCount = filteredCadets.length;
  

  const presentCount = presentCadets.length;
  const permissionCount = permissionCadets.length;
  const absentCount = absentCadets.length;

  function percent(count) {
    if (totalCount === 0) return "0.0";
    return ((count / totalCount) * 100).toFixed(1);
  }
  function percent(count) {
    if (totalCount === 0) return "0.0";
    return ((count / totalCount) * 100).toFixed(1);
  }

  async function handleCloseParade() {
    const confirm = window.confirm(
      "This action is irreversible.\n\nAttendance, permissions, and reports will be locked permanently.\n\nDo you want to continue?"
    );

    if (!confirm) return;

    await supabase
      .from("parades")
      .update({ ano_remarks: remarks })
      .eq("id", parade.id);

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.rpc("close_parade", {
      p_actor_id: user.id,
      p_parade_id: parade.id
    });

    if (error) {
      if (error.message.includes("attendance_pending")) {
        alert("Cannot close parade. Attendance is still pending.");
      } else if (error.message.includes("parade_not_ready")) {
        alert("Parade is not ready to be closed.");
      } else {
        alert("Failed to close parade. Check console.");
        console.error(error);
      }
      return;
    }

    alert("Parade closed successfully.");

    // Reset dashboard state
    setParade(null);
  }


  /* --------------------
     RENDER
  -------------------- */
  if (!parade) return <p>Loading parade…</p>;
  if (loading) return <p>Calculating summary…</p>;

  const RANK_ORDER = ["SUO", "JUO", "SGT", "CPL", "LCPL", "CDT"];

  return (
    <div>
      <h2>
        Parade Review — {parade.parade_date} ({parade.session})
      </h2>

      {/* Pending Banner */}
      {pendingSlots.length > 0 && (
        <div style={{ background: "#222", color: "#fff", padding: "10px" }}>
          <b>⚠ Attendance Pending</b>
          <ul>
            {pendingSlots.map((s, i) => (
              <li key={i}>
                Category {s.category} – {s.division}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendingSlots.length > 0 && (
        <button
          onClick={informSeniors}
          style={{
            background: "#b91c1c",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            marginTop: "10px"
          }}
        >
          Inform Seniors
        </button>
      )}

      {/* Rank Summary */}
      <h3>Rank Summary</h3>
      <table border="1" cellPadding="8" width="100%">
        <thead>
          <tr>
            <th>Ranks →</th>
            {RANK_ORDER.map(r => <th key={r}>{r}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total</td>
            {RANK_ORDER.map(r => <td key={r}>{rankSummary[r]?.total || 0}</td>)}
          </tr>
          <tr>
            <td>Present</td>
            {RANK_ORDER.map(r => <td key={r}>{rankSummary[r]?.present || 0}</td>)}
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: "20px" }}>
        <h3>Category Reports</h3>

        {["A", "B", "C"].map((cat) => {
          const report = reports[cat];

          return (
            <div
              key={cat}
              onClick={() => report && setOpenReport(cat)}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "12px",
                cursor: report ? "pointer" : "default",
                backgroundColor: report ? "#ffffff" : "#fdecea"
              }}
            >
              {/* Header */}
              <div style={{ fontWeight: "bold", color: "#555", marginBottom: "6px" }}>
                Category {cat}
              </div>

              {/* Submitted report */}
              {report ? (
                <>
                  <div style={{ fontSize: "12px", color: "#555" }}>
                    Last updated:{" "}
                    {new Date(report.updated_at).toLocaleString()}
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#111"
                    }}
                  >
                    {report.report_text.slice(0, 100)}
                    {report.report_text.length > 100 && "…"}
                  </div>
                </>
              ) : (
                /* Not submitted */
                <div style={{ color: "#b00020", marginTop: "6px" }}>
                  ❌ Not submitted
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openReport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={() => setOpenReport(null)}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "20px",
              color: "#555",
              width: "90%",
              maxWidth: "600px",
              borderRadius: "8px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Category {openReport} Report</h3>

            <div
              style={{
                whiteSpace: "pre-wrap",
                marginTop: "12px",
                color: "#111"
              }}
            >
              {reports[openReport]?.report_text}
            </div>

            <button
              style={{ marginTop: "16px" }}
              onClick={() => setOpenReport(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <hr />

      <div style={{ marginTop: "20px" }}>
        <h4>ANO Remarks (Final)</h4>

        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
          disabled={parade.status === "completed"}
          placeholder="Enter final remarks for this parade..."
        />

        {parade.status === "attendance_submitted" && (
          <small style={{ color: "#555" }}>
            Remarks will be locked after closing the parade.
          </small>
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={handleCloseParade}
          style={{
            background: "#b00020",
            color: "white",
            padding: "10px 16px",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Close Parade
        </button>
      </div>


      {/* Filters (side-by-side as requested) */}
      <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="ALL">All Categories</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>

        <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}>
          <option value="ALL">All Divisions</option>
          <option value="SD">SD</option>
          <option value="SW">SW</option>
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All</option>
          <option value="PRESENT">Present</option>
          <option value="PERMISSION">Permission</option>
          <option value="ABSENT">Absent</option>
        </select>
      </div>

      {/* Attendance Summary */}
      <div
        style={{
          marginTop: "16px",
          marginBottom: "16px",
          padding: "12px",
          color: "#b32727ff",
          border: "1px solid #a73333ff",
          borderRadius: "8px",
          background: "#f9f9f9"
        }}
      >
        <b>Total Cadets:</b> {totalCount}
        <br /><br />

        <div>
          Present:&nbsp;
          <b>{presentCount}</b>
          &nbsp;({percent(presentCount)}%)
        </div>

        <div>
          Absent with Permission:&nbsp;
          <b>{permissionCount}</b>
          &nbsp;({percent(permissionCount)}%)
        </div>

        <div>
          Absent without Permission:&nbsp;
          <b>{absentCount}</b>
          &nbsp;({percent(absentCount)}%)
        </div>
      </div>

      {/* Cadet Tables */}
      <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
        {(statusFilter === "ALL" || statusFilter === "PRESENT") && (
          <CadetTable title="Present" data={presentCadets} />
        )}
        {(statusFilter === "ALL" || statusFilter === "PERMISSION") && (
          <CadetTable title="Absent (Permission)" data={permissionCadets} />
        )}
        {(statusFilter === "ALL" || statusFilter === "ABSENT") && (
          <CadetTable title="Absent (No Permission)" data={absentCadets} />
        )}
      </div>
    </div>
  );
}

/* --------------------
   Small helper component
-------------------- */
function CadetTable({ title, data }) {
  return (
    <div>
      <h4>{title}</h4>
      <table border="1" width="100%" cellPadding="6">
        <thead>
          <tr>
            <th>Enrollment No</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id}>
              <td>{c.enrollment_no}</td>
              <td>{c.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
