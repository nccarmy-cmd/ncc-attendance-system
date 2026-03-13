import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/* ── Design tokens ────────────────────────────────────── */
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SYNE = { fontFamily: "'Syne', sans-serif" };

const inputBase = {
  width: '100%',
  background: 'var(--csi-bg-input)',
  border: '1px solid var(--csi-border)',
  borderRadius: '6px',
  color: 'var(--csi-text-primary)',
  padding: '0.55rem 0.85rem',
  fontSize: '0.82rem',
  outline: 'none',
  boxSizing: 'border-box',
  ...MONO,
};

const PLACE_OPTIONS = [
  'Ground',
  'NCC Office',
  'EEE Seminar Hall',
  'Open Auditorium',
  'EL-2',
  'EL-1',
  'Other',
];

/* ── Field wrapper ─────────────────────────────────────── */
function Field({ label, required, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{
        ...MONO,
        fontSize: '0.62rem',
        color: 'var(--csi-text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
        {required && <span style={{ color: 'var(--csi-red)', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{ ...MONO, fontSize: '0.6rem', color: 'var(--csi-indigo-light)', opacity: 0.8 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────── */
export default function TabCreate({ onParadeCreated }) {

  /* ── Form state ──────────────────────────────────────── */
  const [date,        setDate]        = useState('');
  const [session,     setSession]     = useState('');   // 'morning' | 'evening'
  const [time,        setTime]        = useState('');
  const [place,       setPlace]       = useState('');
  const [customPlace, setCustomPlace] = useState('');

  /* ── UI state ────────────────────────────────────────── */
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  /* ── Notification tracker (shown after creation) ─────── */
  const [lastParade,   setLastParade]   = useState(null);  // { id, date, session, time, place }
  const [notifStats,   setNotifStats]   = useState(null);  // { total, acked, pending, pendingNames }
  const [loadingStats, setLoadingStats] = useState(false);

  /* ── Auto-fill time when session changes ─────────────── */
  useEffect(() => {
    if (session === 'morning')   setTime('06:00');
    else if (session === 'afternoon') setTime('12:00');
    else if (session === 'evening')   setTime('17:00');
    else setTime('');
  }, [session]);

  /* ── Load ack stats for last parade ─────────────────── */
  const loadNotifStats = useCallback(async (paradeId) => {
    if (!paradeId) return;
    setLoadingStats(true);
    try {
      const { data: notifs } = await supabase
        .from('parade_notifications')
        .select('id, acknowledged, role, user_id')
        .eq('parade_id', paradeId);

      if (!notifs) { setNotifStats(null); return; }

      const total   = notifs.length;
      const acked   = notifs.filter(n => n.acknowledged).length;
      const pending = total - acked;

      // Get names of pending cadets via their user_id → profiles → cadets
      const pendingUserIds = notifs
        .filter(n => !n.acknowledged && n.role === 'cadet')
        .map(n => n.user_id)
        .filter(Boolean);

      let pendingNames = [];
      if (pendingUserIds.length > 0) {
        const { data: pendingProfiles } = await supabase
          .from('profiles')
          .select('cadet_id')
          .in('id', pendingUserIds);

        const cadetIds = (pendingProfiles || [])
          .map(p => p.cadet_id)
          .filter(Boolean);

        if (cadetIds.length > 0) {
          const { data: pendingCadets } = await supabase
            .from('cadets')
            .select('name')
            .in('id', cadetIds);

          pendingNames = (pendingCadets || [])
            .map(c => c.name)
            .filter(Boolean)
            .sort();
        }
      }

      setNotifStats({ total, acked, pending, pendingNames });
    } catch (e) {
      console.error('notif stats error', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  /* ── Poll stats every 30s while panel is open ────────── */
  useEffect(() => {
    if (!lastParade?.id) return;
    loadNotifStats(lastParade.id);
    const interval = setInterval(() => loadNotifStats(lastParade.id), 30000);
    return () => clearInterval(interval);
  }, [lastParade, loadNotifStats]);

  /* ── Validate ────────────────────────────────────────── */
  function validate() {
    if (!date)    return 'Date is required.';
    if (!session) return 'Session is required.';
    if (!time)    return 'Time is required.';
    const finalPlace = place === 'Other' ? customPlace.trim() : place;
    if (!finalPlace) return 'Place is required.';
    return null;
  }

  /* ── Handle Create ────────────────────────────────────── */
  async function handleCreate() {
    const err = validate();
    if (err) { setError(err); return; }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setNotifStats(null);
    setLastParade(null);

    const finalPlace = place === 'Other' ? customPlace.trim() : place;

    try {
      // ── STEP 1: Create the parade ────────────────────────
      const { data: parade, error: pErr } = await supabase
        .from('parades')
        .insert({
          parade_date : date,
          session,
          time,
          place       : finalPlace,
          status      : 'active',
        })
        .select('id, parade_date, session, time, place')
        .single();

      if (pErr) throw pErr;
      const newParadeId = parade.id;

      // ── STEP 2: Delete ALL old parade_notifications ──────
      // (notifications for every previous parade — keeps table tiny)
      await supabase
        .from('parade_notifications')
        .delete()
        .neq('parade_id', newParadeId);

      // ── STEP 3: Fetch eligible users ─────────────────────
      // Seniors always get notified.
      // Cadets only if their linked cadet is is_active = true.
      const { data: seniors } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('role', 'senior');

      // Get all active cadet IDs from cadets table first
      const { data: activeCadets } = await supabase
        .from('cadets')
        .select('id')
        .eq('is_active', true);

      const activeCadetIds = (activeCadets || []).map(c => c.id);

      // Then get profiles whose cadet_id is in the active list
      let cadetProfiles = [];
      if (activeCadetIds.length > 0) {
        const { data: cp } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('role', 'cadet')
          .in('cadet_id', activeCadetIds);
        cadetProfiles = cp || [];
      }

      const allUsers = [
        ...(seniors || []),
        ...cadetProfiles,
      ];

      // ── STEP 4: Insert notifications ─────────────────────
      console.log(`[Notif] seniors: ${(seniors||[]).length}, activeCadets: ${cadetProfiles.length}, total: ${allUsers.length}`);

      if (allUsers.length > 0) {
        const notifRows = allUsers.map(u => ({
          parade_id    : newParadeId,
          user_id      : u.id,
          role         : u.role,
          acknowledged : false,
        }));

        const { error: nErr } = await supabase
          .from('parade_notifications')
          .insert(notifRows);

        if (nErr) throw new Error(`Notification insert failed: ${nErr.message}`);
      }

      // ── STEP 5: Update UI ────────────────────────────────
      setLastParade(parade);
      setSuccess(`Parade created · ${allUsers.length} notifications dispatched`);
      onParadeCreated?.();

      // Reset form
      setDate('');
      setSession('');
      setTime('');
      setPlace('');
      setCustomPlace('');

    } catch (err) {
      setError(err.message || 'Failed to create parade. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Helpers ─────────────────────────────────────────── */
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  }

  const pct = notifStats
    ? Math.round((notifStats.acked / Math.max(notifStats.total, 1)) * 100)
    : 0;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ══════════════════════════════════════════════════
          FORM CARD
          ══════════════════════════════════════════════ */}
      <div style={{
        background: 'var(--csi-bg-card)',
        border: '1px solid var(--csi-border)',
        borderRadius: '10px',
        padding: '1.4rem',
      }}>
        <div style={{ ...SYNE, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--csi-text-muted)', marginBottom: '1.25rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--csi-border)' }}>
          Create New Parade
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

          {/* DATE */}
          <Field label="Date" required>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              style={{
                ...inputBase,
                colorScheme: 'dark',
              }}
            />
          </Field>

          {/* SESSION */}
          <Field label="Session" required>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['morning', 'afternoon', 'evening'].map(s => (
                <button
                  key={s}
                  onClick={() => setSession(s)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: session === s ? 'var(--csi-indigo)' : 'var(--csi-border)',
                    background: session === s ? 'rgba(79,70,229,0.15)' : 'var(--csi-bg-input)',
                    color: session === s ? 'var(--csi-indigo-light)' : 'var(--csi-text-muted)',
                    cursor: 'pointer',
                    ...MONO,
                    fontSize: '0.67rem',
                    letterSpacing: '0.06em',
                    textTransform: 'capitalize',
                    transition: 'all 0.15s',
                  }}
                >
                  {s === 'morning' ? '☀ Morning' : s === 'afternoon' ? '🌤 Afternoon' : '🌆 Evening'}
                </button>
              ))}
            </div>
          </Field>

          {/* TIME */}
          <Field
            label="Time"
            required
            hint={
              session === 'morning'
                ? 'Morning default: 06:00 AM · Edit if different'
                : session === 'afternoon'
                ? 'Afternoon default: 12:00 PM · Edit if different'
                : session === 'evening'
                ? 'Evening default: 05:00 PM · Edit if different'
                : 'Select session first for suggestion'
            }
          >
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                ...inputBase,
                colorScheme: 'dark',
              }}
            />
          </Field>

          {/* PLACE */}
          <Field label="Place" required>
            <select
              value={place}
              onChange={e => { setPlace(e.target.value); setCustomPlace(''); }}
              style={{
                ...inputBase,
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                paddingRight: '2rem',
                cursor: 'pointer',
              }}
            >
              <option value="">Select location…</option>
              {PLACE_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          {/* CUSTOM PLACE — only shown if 'Other' selected */}
          {place === 'Other' && (
            <Field label="Specify Location" required>
              <input
                type="text"
                placeholder="e.g. Basketball Court"
                value={customPlace}
                onChange={e => setCustomPlace(e.target.value)}
                style={inputBase}
                autoFocus
              />
            </Field>
          )}

        </div>

        {/* Error / Success */}
        {error && (
          <div style={{
            ...MONO, fontSize: '0.72rem', color: 'var(--csi-red)',
            marginTop: '1rem', padding: '0.6rem 0.9rem',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: '6px',
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            ...MONO, fontSize: '0.72rem', color: 'var(--csi-green)',
            marginTop: '1rem', padding: '0.6rem 0.9rem',
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: '6px',
          }}>
            ✓ {success}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleCreate}
          disabled={submitting}
          style={{
            marginTop: '1.25rem',
            width: '100%',
            padding: '0.75rem',
            background: submitting ? 'var(--csi-bg-input)' : 'var(--csi-indigo)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            ...SYNE,
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#4338ca'; }}
          onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = 'var(--csi-indigo)'; }}
        >
          {submitting ? 'Creating Parade…' : '+ Create Parade & Notify'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          NOTIFICATION STATUS CARD (shown after creation)
          ══════════════════════════════════════════════ */}
      {lastParade && (
        <div style={{
          background: 'var(--csi-bg-card)',
          border: '1px solid var(--csi-border)',
          borderRadius: '10px',
          padding: '1.4rem',
        }}>
          <div style={{ ...SYNE, fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--csi-text-muted)', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--csi-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Notification Status</span>
            {/* Live parade info */}
            <span style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: '0.03em' }}>
              {fmtDate(lastParade.parade_date)} · {lastParade.session} · {fmtTime(lastParade.time)} · {lastParade.place}
            </span>
          </div>

          {loadingStats ? (
            <div style={{ ...MONO, fontSize: '0.72rem', color: 'var(--csi-text-muted)', padding: '1rem 0' }}>
              Loading acknowledgement data…
            </div>
          ) : notifStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Stat pills */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { label: 'Notified',  val: notifStats.total,   color: 'var(--csi-text-primary)' },
                  { label: 'Ack\'d',    val: notifStats.acked,   color: 'var(--csi-green)' },
                  { label: 'Pending',   val: notifStats.pending, color: notifStats.pending > 0 ? 'var(--csi-amber)' : 'var(--csi-text-muted)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{
                    flex: 1, textAlign: 'center',
                    background: 'var(--csi-bg-input)',
                    border: '1px solid var(--csi-border)',
                    borderRadius: '8px', padding: '0.75rem 0.5rem',
                  }}>
                    <div style={{ ...MONO, fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>
                      {val}
                    </div>
                    <div style={{ ...MONO, fontSize: '0.58rem', color: 'var(--csi-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', marginBottom: '0.35rem' }}>
                  <span>Acknowledgement Rate</span>
                  <span style={{ color: pct === 100 ? 'var(--csi-green)' : pct > 50 ? 'var(--csi-amber)' : 'var(--csi-red)' }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--csi-bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: pct === 100 ? 'var(--csi-green)' : pct > 50 ? 'var(--csi-amber)' : 'var(--csi-indigo)',
                    borderRadius: 4, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>

              {/* Pending names list */}
              {notifStats.pendingNames.length > 0 && (
                <div>
                  <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Cadets Not Yet Acknowledged ({notifStats.pendingNames.length})
                  </div>
                  <div style={{
                    background: 'var(--csi-bg-input)',
                    border: '1px solid var(--csi-border)',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}>
                    {notifStats.pendingNames.map((name, i) => (
                      <div key={i} style={{
                        ...MONO, fontSize: '0.72rem',
                        color: 'var(--csi-amber)',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                      }}>
                        <span style={{ color: 'var(--csi-text-muted)', fontSize: '0.6rem' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pct === 100 && (
                <div style={{
                  ...MONO, fontSize: '0.72rem', color: 'var(--csi-green)',
                  textAlign: 'center', padding: '0.5rem',
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  borderRadius: '6px',
                }}>
                  ✓ All cadets have acknowledged the parade
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={() => loadNotifStats(lastParade.id)}
                disabled={loadingStats}
                style={{
                  ...MONO, fontSize: '0.65rem', letterSpacing: '0.06em',
                  padding: '5px 14px', borderRadius: '4px',
                  background: 'transparent',
                  border: '1px solid var(--csi-border)',
                  color: 'var(--csi-text-muted)',
                  cursor: 'pointer', alignSelf: 'flex-end',
                }}
              >
                ↻ Refresh
              </button>

            </div>
          ) : (
            <div style={{ ...MONO, fontSize: '0.72rem', color: 'var(--csi-text-muted)' }}>
              No notification data yet.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
