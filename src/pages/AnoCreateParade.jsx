import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/*
  Fixed list of allowed parade types.
  This prevents free-text garbage in DB.
*/
const PARADE_TYPES = [
  'Theory',
  'Drill',
  'Weapon Training',
  'Physical Training (PT)',
  'Parade Rehearsal',
  'Cultural Practice',
  'Event',
  'Awareness Program'
];

export default function AnoCreateParade() {
  /* -------------------------------------------------------
     STATE SECTION
     ------------------------------------------------------- */

  // Parade date (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];
  const [paradeDate, setParadeDate] = useState(today);


  // Session: morning / evening
  const [session, setSession] = useState('');

  // Categories included in parade
  const [selectedCategories, setSelectedCategories] = useState({
    A: true,
    B: true,
    C: true
  });

  // Parade type per category
  const [paradeTypes, setParadeTypes] = useState({
    A: 'Theory',
    B: 'Theory',
    C: 'Theory'
  });

  // UI helpers
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* -------------------------------------------------------
     INITIAL LOAD
     ------------------------------------------------------- */
  useEffect(() => {
    async function initialize() {
      setError(null);

      // 1️⃣ Check for existing active parade (DB-level protection already exists)
      const { data: activeParade } = await supabase
        .from('parades')
        .select('id')
        .in('status', ['active', 'attendance_submitted'])
        .limit(1)
        .maybeSingle();

      if (activeParade) {
        setError(
          'An active parade already exists. Please close it before creating a new one.'
        );
        return;
      }

      // 2️⃣ Restore previous parade types from last completed parade
      const { data: lastParade } = await supabase
        .from('parades')
        .select('parade_type_map')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastParade && lastParade.parade_type_map) {
        setParadeTypes((prev) => ({
          ...prev,
          ...lastParade.parade_type_map
        }));
      }
    }

    initialize();
  }, []);

  /* -------------------------------------------------------
     HANDLERS
     ------------------------------------------------------- */

  function toggleCategory(category) {
    setSelectedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }));
  }

  function changeParadeType(category, value) {
    setParadeTypes((prev) => ({
      ...prev,
      [category]: value
    }));
  }

  async function handleCreateParade() {
    setError(null);

    /*
      VALIDATION 1:
      Date must be selected
    */
    if (!paradeDate) {
      setError('Please select parade date.');
      return;
    }

    /*
      VALIDATION 2:
      Session must be selected
    */
    if (!session) {
      setError('Please select parade session.');
      return;
    }

    /*
      VALIDATION 3:
      At least one category must be selected
    */
    const activeCategories = Object.keys(selectedCategories).filter(
      (cat) => selectedCategories[cat]
    );

    if (activeCategories.length === 0) {
      setError('Select at least one category.');
      return;
    }

    setLoading(true);

    /*
      Build parade_type_map ONLY for selected categories
    */
    const paradeTypeMap = {};
    activeCategories.forEach((cat) => {
      paradeTypeMap[cat] = paradeTypes[cat];
    });

    const today = new Date().toISOString().split('T')[0];

    if (paradeDate < today) {
      setError('Cannot create parade for a past date.');
      return;
    }

    /*
      FINAL DB INSERT
    */
    const user = (await supabase.auth.getUser()).data.user;

    const { error: insertError } = await supabase
      .from('parades')
      .insert({
        parade_date: paradeDate,
        session: session,
        categories: activeCategories,
        parade_type_map: paradeTypeMap,
        status: 'active',
        created_by: user.id
      });


    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    alert('Parade created successfully.');
  }

  /* -------------------------------------------------------
     UI
     ------------------------------------------------------- */
  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h2>ANO – Create Parade</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Parade Date */}
      <label>
        Parade Date:
        <input
          type="date"
          value={paradeDate}
          onChange={(e) => setParadeDate(e.target.value)}
        />
      </label>

      <br /><br />

      {/* Session */}
      <label>
        Session:
        <select
          value={session}
          onChange={(e) => setSession(e.target.value)}
        >
          <option value="">-- Select Session --</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
          <option value="After-Noon">After-Noon</option>
        </select>
      </label>

      <br /><br />

      {/* Categories */}
      <h4>Parade Categories</h4>
      {['A', 'B', 'C'].map((cat) => (
        <label key={cat} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={selectedCategories[cat]}
            onChange={() => toggleCategory(cat)}
          />
          Category {cat}
        </label>
      ))}

      {/* Parade Types */}
      <h4 style={{ marginTop: 20 }}>Parade Type (per category)</h4>
      {['A', 'B', 'C'].map((cat) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <strong>Category {cat}:</strong>{' '}
          <select
            value={paradeTypes[cat]}
            disabled={!selectedCategories[cat]}
            onChange={(e) => changeParadeType(cat, e.target.value)}
          >
            {PARADE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button onClick={handleCreateParade} disabled={loading}>
        {loading ? 'Creating...' : 'Create Parade'}
      </button>
    </div>
  );
}
