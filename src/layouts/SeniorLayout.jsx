import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import nccLogo from "../assets/ncc-logo.png";

import SeniorAttendance from "../pages/SeniorAttendance";
import SeniorReport from "../pages/SeniorReport";

export default function SeniorLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("attendance");
 

  // 🔹 Logout handler
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function renderPage() {
    if (currentPage === "attendance") return <SeniorAttendance />;
    if (currentPage === "report") return <SeniorReport />;
    return null;
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      {/* SIDE MENU */}
      {menuOpen && (
        <div style={{
          width: "220px",
          background: "#1f2937",
          color: "white",
          padding: "16px"
        }}>
          <h4>Senior Menu</h4>

          <button onClick={() => setCurrentPage("attendance")}>
            Attendance
          </button>

          <br /><br />

          <button onClick={() => setCurrentPage("report")}>
            Report
          </button>

          <hr />

          <button
            onClick={handleLogout}
            style={{ color: "red", marginTop: "10px" }}
          >
            Logout
          </button>
        </div>
      )}

      {/* MAIN AREA */}
      <div style={{ flex: 1 }}>
        {/* TOP BAR */}
        <div style={{
          height: "60px",
          background: "#111827",
          display: "flex",
          alignItems: "center",
          padding: "0 16px"
        }}>
          <img
            src={nccLogo}
            alt="NCC"
            style={{ height: "40px", cursor: "pointer" }}
            onClick={() => setMenuOpen(!menuOpen)}
          />
          <span style={{ color: "white", marginLeft: "12px" }}>
            Senior Dashboard
          </span>
        </div>

        {/* CONTENT */}
        <div style={{ padding: "16px" }}>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
