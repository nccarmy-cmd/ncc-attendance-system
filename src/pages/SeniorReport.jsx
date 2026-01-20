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
•Activity and Duration:

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
`
};

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SeniorReport() {

  const [parade, setParade] = useState(null);
  const [category, setCategory] = useState("A");

  const [reportText, setReportText] = useState("");
  const [existingReport, setExistingReport] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [division, setDivision] = useState(null);

    useEffect(() => {
      async function loadParade() {
        setLoading(true);

        const user = (await supabase.auth.getUser()).data.user;

        const { data: profile } = await supabase
          .from("profiles")
          .select("assigned_division")
          .eq("id", user.id)
          .single();

        setDivision(profile.assigned_division);

        const { data } = await supabase
          .from("parades")
          .select("*")
          .in("status", ["active", "attendance_submitted"])
          .single();

        setParade(data);
        setLoading(false);
      }

      loadParade();
    }, []);


    useEffect(() => {
      if (!parade) return;

      async function loadReport() {
        setLoading(true);

        const { data } = await supabase
          .from("parade_reports")
          .select("*")
          .eq("parade_id", parade.id)
          .eq("category", category)
          .single();

        if (data) {
          setReportText(data.report_text);
          setExistingReport(true);
        } else {
          const paradeType = parade.parade_type_map?.[category];
          setReportText(REPORT_TEMPLATES[paradeType] || "");
          setExistingReport(false);
        }

        setLoading(false);
      }

      loadReport();
    }, [parade, category]);

    async function saveReport() {
      if (!parade) return;

      if (parade.status === "completed") {
        alert("Parade is completed. Report is locked.");
        return;
      }

      setSaving(true);

      const user = (await supabase.auth.getUser()).data.user;
      const paradeType = parade.parade_type_map?.[category];

      const { error } = await supabase
        .from("parade_reports")
        .upsert(
          {
            parade_id: parade.id,
            category,
            parade_type: paradeType,
            report_text: reportText,
            created_by: user.id
          },
          {
            onConflict: "parade_id,category"
          }
        );


      if (error) {
        alert(error.message);
      } else {
        alert("Report saved successfully");
        setExistingReport(true);
      }

      setSaving(false);
    }
    if (loading) return <p>Loading report…</p>;
    if (!parade) return <p>No active parade.</p>;
      return (
        <div>
          <h3>Parade Report</h3>

          <p>
            <strong>Date:</strong> {parade.parade_date} &nbsp;
            <strong>Session:</strong> {parade.session}
          </p>

          <label>Category: </label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option>A</option>
            <option>B</option>
            <option>C</option>
          </select>

          <p>
            <strong>Parade Type:</strong>{" "}
            {parade.parade_type_map?.[category] || "—"}
          </p>
          <p>
            <strong>Division:</strong> {division}
          </p>

          <textarea
            value={reportText}
            disabled={parade.status === "completed"}
            onChange={(e) => setReportText(e.target.value)}
            style={{
              width: "100%",
              minHeight: "300px",
              resize: "both"
              
            }}
          />


          {parade.status === "completed" ? (
            <p>🔒 Parade completed. Report is locked.</p>
          ) : (
            <button onClick={saveReport} disabled={saving}>
              {existingReport ? "Save Changes" : "Save Report"}
            </button>
          )}
        </div>
      );
    }



    
