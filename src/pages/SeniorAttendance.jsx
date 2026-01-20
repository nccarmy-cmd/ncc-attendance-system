import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/toggle.css";

export default function SeniorAttendance() {
  /* -----------------------------
     STATE
  ------------------------------*/
  const [parade, setParade] = useState(null);
  const [category, setCategory] = useState("A");
  const [division, setDivision] = useState(null);

  const [cadets, setCadets] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [attendance, setAttendance] = useState({});

  const [hasExistingAttendance, setHasExistingAttendance] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const [summary, setSummary] = useState(null);

  const [notifications, setNotifications] = useState([]);

  /* -----------------------------
     LOAD PARADE + PROFILE
  ------------------------------*/
  useEffect(() => {
    async function loadInitial() {
      const user = (await supabase.auth.getUser()).data.user;

      const { data: profile } = await supabase
        .from("profiles")
        .select("assigned_division")
        .eq("id", user.id)
        .single();

      setDivision(profile.assigned_division);

      const { data: paradeData } = await supabase
        .from("parades")
        .select("*")
        .in("status", ["active", "attendance_submitted" ,"completed"])
        .order("created_at",{ascending: false })
        .limit(1)
        .maybeSingle();

      setParade(paradeData);
    }

    loadInitial();
  }, []);

  /* -----------------------------
     LOAD CADETS / PERMISSIONS / ATTENDANCE
  ------------------------------*/
  useEffect(() => {
    if (!parade || !division) return;

    async function loadData() {
      const { data: cadetData } = await supabase
        .from("cadets")
        .select("id, enrollment_no, name")
        .eq("is_active", true)
        .eq("category", category)
        .eq("division", division)
        .order("enrollment_no");

      const { data: permissionData } = await supabase
        .from("permissions")
        .select("*")
        .or(`parade_id.eq.${parade.id},to_date.gte.${parade.parade_date}`);

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("parade_id", parade.id);

      const restored = {};
      attendanceData?.forEach(a => {
        restored[a.cadet_id] = a.status === "present";
      });

      setCadets(cadetData || []);
      setPermissions(permissionData || []);
      setAttendance(restored);
      setHasExistingAttendance((attendanceData?.length || 0) > 0);
      setEditMode(false);
      setSummary(null);
    }

    loadData();
  }, [parade, division, category]);

  useEffect(() => {
    if (!parade || !division) return;

    async function loadNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message, type")
        .eq("is_active", true)
        .eq("target_role", "senior")
        .or(
          `target_division.is.null,target_division.eq.${division}`
        )
        .or(
          `target_category.is.null,target_category.eq.${category}`
        )
        .eq("parade_id", parade.id);

      if (error) {
        console.error("Failed to load notifications", error);
        return;
      }

      setNotifications(data || []);
    }

    loadNotifications();
  }, [parade, division, category]);

  /* -----------------------------
     HELPERS
  ------------------------------*/
  const hasPermission = cadetId =>
    permissions.some(p => p.cadet_id === cadetId);

  const getStatus = cadetId => {
    if (hasPermission(cadetId)) return "PERMISSION";
    if (attendance[cadetId]) return "PRESENT";
    return "ABSENT";
  };

  const togglePresent = cadetId => {
    if (!editMode && hasExistingAttendance) return;

    setAttendance(prev => ({
      ...prev,
      [cadetId]: !prev[cadetId]
    }));
  };

  const showRemarksBanner =
    parade?.status === "completed" &&
    parade?.ano_remarks &&
    parade.ano_remarks.trim() !== "";

  /* -----------------------------
     FILTERED CADETS
  ------------------------------*/
  const visibleCadets = cadets.filter(c => {
    if (filter === "ALL") return true;
    return getStatus(c.id) === filter;
  });

  /* -----------------------------
     SUBMIT / SAVE ATTENDANCE
  ------------------------------*/
  async function submitAttendance() {
    const records = cadets.map(c => {
      if (hasPermission(c.id)) {
        const perm = permissions.find(p => p.cadet_id === c.id);
        return {
          cadet_id: c.id,
          status: "absent_with_permission",
          reason: perm.reason
        };
      }

      return {
        cadet_id: c.id,
        status: attendance[c.id]
          ? "present"
          : "absent_without_permission"
      };
    });

    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase.rpc(
      "write_attendance_batch",
      {
        p_actor_id: user.id,
        p_parade_id: parade.id,
        p_records: records
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    if (data.expected !== data.written) {
      alert("Attendance mismatch. Try again.");
      return;
    }

    // Summary
    setSummary({
      total: records.length,
      present: records.filter(r => r.status === "present").length,
      permission: records.filter(r => r.status === "absent_with_permission").length,
      absent: records.filter(r => r.status === "absent_without_permission").length
    });

    setHasExistingAttendance(true);
    setEditMode(false);
  }

  /* -----------------------------
     RENDER
  ------------------------------*/
  if (!parade) return <p>No active parade</p>;

  const paradeTypeForCategory =
    parade?.parade_type_map?.[category] || "—";

  return (
    <div>
      <h3>{parade.parade_date} — {parade.session}</h3>

      {notifications.length > 0 && (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            color: "#856404",
            padding: "10px",
            marginBottom: "12px",
            borderRadius: "6px"
          }}
        >
          <b>⚠ NOTICE</b>
          <ul style={{ marginTop: "6px", paddingLeft: "20px" }}>
            {notifications.map(n => (
              <li key={n.id}>{n.message}</li>
            ))}
          </ul>
        </div>
      )}

      {showRemarksBanner && (
        <div
          style={{
            background: "#fff8e1",
            border: "1px solid #f5c542",
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "6px"
          }}
        >
          <b>📌 ANO Final Remarks</b>

          <div
            style={{
              marginTop: "6px",
              whiteSpace: "pre-wrap",
              color: "#333"
            }}
          >
            {parade.ano_remarks}
          </div>
        </div>
      )}

      <label>Category: </label>
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option>A</option>
        <option>B</option>
        <option>C</option>
      </select>
      <div style={{ marginTop: "6px", marginBottom: "10px" }}>
        <strong>Parade Type:</strong>{" "}
        <span>{paradeTypeForCategory}</span>
      </div>

      <hr />


      {/* FILTER BUTTONS */}
      {hasExistingAttendance && (
        <div style={{ marginBottom: "10px" }}>
          <button onClick={() => setFilter("ALL")}>All</button>{" "}
          <button onClick={() => setFilter("PRESENT")}>Present</button>{" "}
          <button onClick={() => setFilter("PERMISSION")}>Permission</button>{" "}
          <button onClick={() => setFilter("ABSENT")}>Absent</button>
        </div>
      )}

      {/* TABLE */}
      <table border="1" cellPadding="6" width="100%">
        <thead>
          <tr>
            <th>Enrollment</th>
            <th>Name</th>
            <th>Present</th>
          </tr>
        </thead>
        <tbody>
          {visibleCadets.map(c => {
            const perm = permissions.find(p => p.cadet_id === c.id);

            return (
              <tr key={c.id}>
                <td>{c.enrollment_no}</td>
                <td>
                  {c.name}
                  {perm && <div style={{ fontSize: 12 }}>({perm.reason})</div>}
                </td>
                <td align="center">
                  {!perm ? (
                    <input
                      type="checkbox"
                      className="toggle"
                      checked={!!attendance[c.id]}
                      disabled={hasExistingAttendance && !editMode}
                      onChange={() => togglePresent(c.id)}
                    />
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* SUMMARY */}
      {summary && (
        <div style={{ marginTop: "10px" }}>
          <strong>Summary:</strong>
          <div>Total: {summary.total}</div>
          <div>Present: {summary.present}</div>
          <div>Permission: {summary.permission}</div>
          <div>Absent: {summary.absent}</div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div style={{ marginTop: "10px" }}>
        {!hasExistingAttendance && (
          <button onClick={submitAttendance}>Submit Attendance</button>
        )}

        {hasExistingAttendance && !editMode && (
          <button onClick={() => setEditMode(true)}>Edit Attendance</button>
        )}

        {editMode && (
          <button onClick={submitAttendance}>Save Changes</button>
        )}
      </div>
    </div>
  );
}
