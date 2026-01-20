import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import nccLogo from "../assets/ncc-logo.png";

import AnoCreateParade from "../pages/AnoCreateParade";
import AnoPermissions from "../pages/AnoPermissions";
import AnoReviewClose from "../pages/AnoReviewClose";

export default function AnoLayout() {
  /* ---------------- STATE ---------------- */

  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [parade, setParade] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- LOGOUT ---------------- */

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  /* ---------------- FETCH PARADE ---------------- */

  async function fetchParade() {
    const { data } = await supabase
      .from("parades")
      .select("*")
      .in("status", ["active", "attendance_submitted"])
      .maybeSingle();

    setParade(data || null);
    return data || null;
  }

  /* ---------------- INITIAL LOAD ---------------- */

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      const paradeData = await fetchParade();

      // Decide landing page based on parade state
      if (!paradeData) {
        setCurrentPage("create");
      } else if (paradeData.status === "active") {
        setCurrentPage("permissions");
      } else if (paradeData.status === "attendance_submitted") {
        setCurrentPage("review");
      }

      setLoading(false);
    }

    initialize();
  }, []);

  /* ---------------- SAFE PAGE SWITCH ---------------- */

  function goTo(page) {
    if (!parade && page !== "create") return;

    if (parade?.status === "active") {
      if (page === "review") return;
    }

    if (parade?.status === "attendance_submitted") {
      if (page === "create") return;
    }

    setCurrentPage(page);
  }

  /* ---------------- RENDER ---------------- */

  function renderPage() {
    if (currentPage === "create") {
      return <AnoCreateParade onParadeCreated={fetchParade} />;
    }

    if (currentPage === "permissions") {
      return <AnoPermissions parade={parade} onChange={fetchParade} />;
    }

    if (currentPage === "review") {
      return <AnoReviewClose parade={parade} onChange={fetchParade} />;
    }

    return null;
  }

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* SIDE MENU */}
      {menuOpen && (
        <div
          style={{
            width: "220px",
            background: "#1f2937",
            color: "white",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h4>ANO MENU</h4>

          <button onClick={() => goTo("create")}>Create Parade</button>
          <br />

          <button onClick={() => goTo("permissions")} disabled={!parade}>
            Permissions
          </button>
          <br />

          <button
            onClick={() => goTo("review")}
            disabled={!parade || parade.status !== "attendance_submitted"}
          >
            Review & Close
          </button>

          <div style={{ marginTop: "auto" }}>
            <hr />
            <button onClick={handleLogout} style={{ color: "red" }}>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            height: "60px",
            background: "#111827",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
          }}
        >
          <img
            src={nccLogo}
            alt="NCC Logo"
            style={{ height: "40px", cursor: "pointer" }}
            onClick={() => setMenuOpen(!menuOpen)}
          />

          <span style={{ color: "white", marginLeft: "12px" }}>
            NCC ANO Dashboard
          </span>
        </div>

        <div style={{ padding: "20px" }}>{renderPage()}</div>
      </div>
    </div>
  );
}
