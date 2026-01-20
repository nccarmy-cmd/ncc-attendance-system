import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

const REASONS = [
  "Health issue",
  "Unit office work",
  "Went home",
  "Sports",
  "Camp duty",
  "Other",
];

export default function AnoPermissions() {
  const [parade, setParade] = useState(null);
  const [cadets, setCadets] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [divisionFilter, setDivisionFilter] = useState("ALL");
  const [searchName, setSearchName] = useState("");

  const editorRef = useRef(null);

  /* -------------------------------
     1️⃣ Load active parade
  -------------------------------- */
  useEffect(() => {
    async function loadParade() {
      const { data } = await supabase
        .from("parades")
        .select("*")
        .in("status",[ "active", "attendance_submitted"])
        .single();

      setParade(data);
    }
    loadParade();
  }, []);

  const permissionsLocked = parade?.status !== "active";

  /* -------------------------------
     2️⃣ Load cadets + permissions
  -------------------------------- */
  useEffect(() => {
    if (!parade) return;

    async function loadData() {
      setLoading(true);

      const { data: cadetData } = await supabase
        .from("cadets")
        .select("*")
        .eq("is_active", true)
        .in("category", parade.categories)
        .order("enrollment_no", { ascending: true });

      const { data: permissionData } = await supabase
        .from("permissions")
        .select("*")
        .eq("parade_id", parade.id);
      
      setCadets(cadetData || []);
      setPermissions(permissionData || []);
      setLoading(false);
    }

    loadData();
  }, [parade]);

  const filteredCadets = cadets
  // 1️⃣ category filter
  .filter(c =>
    categoryFilter === "ALL" ? true : c.category === categoryFilter
  )
  // 2️⃣ division filter
  .filter(c =>
    divisionFilter === "ALL" ? true : c.division === divisionFilter
  )
  // 3️⃣ search by name (case-insensitive)
  .filter(c =>
    c.name.toLowerCase().includes(searchName.toLowerCase())
  );
  
   
  
  const hasPermission = (cadetId) =>
    permissions.some(p => p.cadet_id === cadetId);
  const filteredPermissionCount = filteredCadets.filter(c =>
    hasPermission(c.id)
  ).length;
  const sortedCadets = [...filteredCadets].sort((a, b) => {
    const aHasPermission = hasPermission(a.id);
    const bHasPermission = hasPermission(b.id);

    if (aHasPermission && !bHasPermission) return -1;
    if (!aHasPermission && bHasPermission) return 1;

    return a.enrollment_no.localeCompare(b.enrollment_no);
  });


  /* -------------------------------
     3️⃣ Close editor on outside click
  -------------------------------- */
  useEffect(() => {
    function handleClickOutside(e) {
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        setEditing({});
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* -------------------------------
     Helpers
  -------------------------------- */
  const getPermission = (cadetId) =>
    permissions.find((p) => p.cadet_id === cadetId);

  const startEdit = (cadet) => {
    if (permissionsLocked) {
      alert("Attendance already submitted. Permissions are locked.");
      return;
    }

    const existing = getPermission(cadet.id);

    setEditing({
      cadetId: cadet.id,
      reason: existing?.reason || "",
      to_date: existing?.to_date || parade.parade_date,
      showDate: false,
    });
  };



  /* -------------------------------
     4️⃣ Save permission
  -------------------------------- */
  const savePermission = async () => {
    if (permissionsLocked) {
      alert("Permissions are locked after attendance submission.");
      return;
    }

    if (!editing.reason) {
      alert("Reason required");
      return;
    }

    if (editing.to_date < parade.parade_date) {
      alert("Permission date cannot be before parade date");
      return;
    }

    const { error } = await supabase.from("permissions").upsert({
      parade_id: parade.id,
      cadet_id: editing.cadetId,
      reason: editing.reason,
      to_date: editing.to_date || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    reloadPermissions();
    setEditing({});
  };


  /* -------------------------------
     5️⃣ Delete permission
  -------------------------------- */
  const deletePermission = async (cadetId) => {
    if (permissionsLocked) {
      alert("Permissions are locked after attendance submission.");
      return;
    }

    const { error } = await supabase
      .from("permissions")
      .delete()
      .eq("parade_id", parade.id)
      .eq("cadet_id", cadetId);

    if (error) {
      alert(error.message);
      return;
    }

    reloadPermissions();
    setEditing({});
  };

  const reloadPermissions = async () => {
    const { data } = await supabase
      .from("permissions")
      .select("*")
      .eq("parade_id", parade.id);

    setPermissions(data || []);
  };

  if (loading) return <p>Loading permissions…</p>;

  return (
    <div>
      <h2>Permission Management</h2>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="ALL">All Categories</option>
          <option value="A">Category A</option>
          <option value="B">Category B</option>
          <option value="C">Category C</option>
        </select>

        <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}>
          <option value="ALL">All Divisions</option>
          <option value="SD">SD</option>
          <option value="SW">SW</option>
        </select>

        <input
          type="text"
          placeholder="Search cadet name"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
        />

      <p>
        Total Cadets: {filteredCadets.length}| Permissions: {filteredPermissionCount}
      </p>

      <table>
        <thead>
          <tr>
            <th>S.No</th>
            <th>Enrollment</th>
            <th>Rank</th>
            <th>Name</th>
            <th>Permission</th>
          </tr>
        </thead>

        <tbody>
          {sortedCadets.map((cadet, idx) => {
            const perm = getPermission(cadet.id);
            const isEditing = editing.cadetId === cadet.id;

            return (
              <tr key={cadet.id}>
                <td>{idx + 1}</td>
                <td>{cadet.enrollment_no}</td>
                <td>{cadet.rank}</td>
                <td>{cadet.name}</td>

                <td>
                  {isEditing ? (
                    <div ref={editorRef}>
                      <select
                        value={editing.reason}
                        onChange={(e) =>
                          setEditing({ ...editing, reason: e.target.value })
                        }
                      >
                        <option value="">Select reason</option>
                        {REASONS.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>

                      <button
                        title="Multiple days"
                        onClick={() =>
                          setEditing({ ...editing, showDate: true })
                        }
                      >
                        🗓️
                      </button>

                      {editing.showDate && (
                        <input
                          type="date"
                          value={editing.to_date}
                          min={parade.parade_date}
                          onChange={(e) =>
                            setEditing({ ...editing, to_date: e.target.value })
                          }
                        />
                      )}


                      <button onClick={savePermission}>✔</button>
                      <button onClick={() => deletePermission(cadet.id)}>
                        ✖
                      </button>
                    </div>
                  ) : perm ? (
                    <span onClick={() => startEdit(cadet)}>
                      {perm.reason}
                      {perm.to_date && ` (upto ${perm.to_date})`}
                    </span>
                  ) : (
                    <span onClick={() => startEdit(cadet)}>
                      [ Reason ▼ ] 🗓️
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
