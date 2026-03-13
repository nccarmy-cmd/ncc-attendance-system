import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/* ── Design tokens ───────────────────────────────────── */
const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SYNE = { fontFamily: "'Syne', sans-serif" };

const card = (extra = {}) => ({
  background: 'var(--csi-bg-card)',
  border: '1px solid var(--csi-border)',
  borderRadius: '10px',
  padding: '1.25rem 1.4rem',
  ...extra,
});
const lbl = (extra = {}) => ({
  ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)',
  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2rem', ...extra,
});
const val = (extra = {}) => ({
  ...MONO, fontSize: '0.82rem', color: 'var(--csi-text-primary)', fontWeight: 500, ...extra,
});

/* ── Percent bar ─────────────────────────────────────── */
function PctBar({ pct }) {
  const clr = pct >= 75 ? 'var(--csi-green)' : pct >= 50 ? 'var(--csi-amber)' : 'var(--csi-red)';
  return (
    <div style={{ height: 6, background: 'var(--csi-bg-input)', borderRadius: 4, overflow: 'hidden', marginTop: '0.5rem' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: clr, borderRadius: 4, transition: 'width 0.8s ease' }} />
    </div>
  );
}

/* ── Tab button ─────────────────────────────────────── */
function TabBtn({ active, onClick, icon, label: lbl, badge }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
      padding: '0.65rem 0.5rem', border: 'none', cursor: 'pointer',
      background: active ? 'var(--csi-bg-input)' : 'transparent',
      borderBottom: active ? '2px solid var(--csi-indigo)' : '2px solid transparent',
      borderRadius: active ? '8px 8px 0 0' : '8px 8px 0 0',
      transition: 'all 0.15s ease', position: 'relative',
    }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span style={{ ...MONO, fontSize: '0.58rem', color: active ? 'var(--csi-indigo-light)' : 'var(--csi-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {lbl}
      </span>
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: 'var(--csi-amber)', color: '#000',
          borderRadius: '99px', fontSize: '0.5rem', fontWeight: 700,
          ...MONO, padding: '1px 5px', lineHeight: 1.4,
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export default function CadetDashboard() {
  const [tab, setTab]               = useState('parade');
  const [cadet, setCadet]           = useState(null);
  const [userId, setUserId]         = useState(null);
  const [notification, setNotif]    = useState(null);
  const [parade, setParade]         = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [permissions, setPerms]     = useState([]);
  const [sysNotifs, setSysNotifs]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [acking, setAcking]         = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      setUserId(user.id);

      const { data: profile, error: pErr } = await supabase
        .from('profiles').select('cadet_id').eq('id', user.id).single();
      if (pErr) throw pErr;
      if (!profile?.cadet_id) throw new Error('Cadet profile not linked. Contact ANO.');

      const { data: cadetRow, error: cErr } = await supabase
        .from('cadets').select('id, name, rank, enrollment_no, category, division, is_active')
        .eq('id', profile.cadet_id).single();
      if (cErr) throw cErr;
      setCadet(cadetRow);

      // Notification
      const { data: notifRow } = await supabase
        .from('parade_notifications').select('id, parade_id, acknowledged, ack_at, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setNotif(notifRow || null);

      // Parade details
      if (notifRow?.parade_id) {
        const { data: paradeRow } = await supabase
          .from('parades').select('id, parade_date, session, time, place, status')
          .eq('id', notifRow.parade_id).maybeSingle();
        setParade(paradeRow || null);
      } else {
        setParade(null);
      }

      // Attendance
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const { data: attRows } = await supabase
        .from('attendance').select('id, parade_id, status, created_at')
        .eq('cadet_id', profile.cadet_id).gte('created_at', yearStart)
        .order('created_at', { ascending: false });
      setAttendance(attRows || []);

      // Permission requests (own)
      const { data: permRows } = await supabase
        .from('permissions').select('id, parade_id, reason, description, from_date, to_date, to_session, status, ano_note, created_at')
        .eq('cadet_id', profile.cadet_id).order('created_at', { ascending: false });
      setPerms(permRows || []);

      // System notifications (ANO responses)
      const { data: sysRows } = await supabase
        .from('system_notifications').select('id, type, title, body, meta, read, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      setSysNotifs(sysRows || []);

    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleAcknowledge() {
    if (!notification || notification.acknowledged || acking) return;
    setAcking(true);
    const { error } = await supabase.from('parade_notifications')
      .update({ acknowledged: true, ack_at: new Date().toISOString() })
      .eq('id', notification.id);
    if (!error) setNotif(prev => ({ ...prev, acknowledged: true, ack_at: new Date().toISOString() }));
    setAcking(false);
  }

  // Mark sys notif as read
  async function markRead(id) {
    await supabase.from('system_notifications').update({ read: true }).eq('id', id);
    setSysNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  // Stats
  const totalParades  = attendance.length;
  const presentCount  = attendance.filter(r => r.status === 'present').length;
  const permCount     = attendance.filter(r => r.status === 'permission').length;
  const absentCount   = attendance.filter(r => r.status === 'absent').length;
  const pct = totalParades > 0 ? Math.round(((presentCount + permCount) / totalParades) * 100) : 0;

  const unreadSys = sysNotifs.filter(n => !n.read).length;
  const pendingPerms = permissions.filter(p => p.status === 'pending').length;

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ ...MONO, color: 'var(--csi-text-muted)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Loading service record…</div>
    </div>
  );
  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div style={{ ...MONO, color: 'var(--csi-red)', fontSize: '0.8rem' }}>{error}</div>
      <button onClick={loadAll} style={{ marginTop: '1rem', ...MONO, fontSize: '0.7rem', padding: '6px 16px', background: 'transparent', border: '1px solid var(--csi-border)', color: 'var(--csi-text-muted)', borderRadius: 4, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const hasNotif = !!notification && !!parade;
  const isActive = parade?.status === 'active';
  const isAcked  = notification?.acknowledged;
  const today    = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.25rem 1rem 4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Header ── */}
      <div>
        <div style={{ ...SYNE, fontSize: '1.15rem', fontWeight: 700, color: 'var(--csi-text-primary)' }}>
          {cadet?.rank} {cadet?.name}
        </div>
        <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
          2(A) EME UNIT NCC · {cadet?.enrollment_no}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', border: '1px solid var(--csi-border)', borderRadius: '10px 10px 0 0', background: 'var(--csi-bg-card)', overflow: 'hidden' }}>
        <TabBtn active={tab === 'parade'}     onClick={() => setTab('parade')}     icon="🪖" label="Parade Orders"  badge={hasNotif && isActive && !isAcked ? 1 : 0} />
        <TabBtn active={tab === 'attendance'} onClick={() => setTab('attendance')} icon="📋" label="Attendance Log"  badge={0} />
        <TabBtn active={tab === 'profile'}    onClick={() => setTab('profile')}    icon="🪪" label="Profile"         badge={unreadSys + pendingPerms} />
      </div>

      {/* ══ TAB: PARADE ORDERS ══ */}
      {tab === 'parade' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* System notifications (ANO responses) */}
          {sysNotifs.filter(n => !n.read).map(n => (
            <div key={n.id} style={{
              ...card(), borderColor: n.type === 'permission_approved' ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '10px 10px 0 0', background: n.type === 'permission_approved' ? 'var(--csi-green)' : 'var(--csi-red)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: '0.3rem' }}>
                <div>
                  <div style={{ ...SYNE, fontSize: '0.82rem', fontWeight: 700, color: n.type === 'permission_approved' ? 'var(--csi-green)' : 'var(--csi-red)', marginBottom: '0.25rem' }}>
                    {n.title}
                  </div>
                  <div style={{ ...MONO, fontSize: '0.72rem', color: 'var(--csi-text-primary)' }}>{n.body}</div>
                  {n.meta?.ano_note && (
                    <div style={{ ...MONO, fontSize: '0.67rem', color: 'var(--csi-text-muted)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                      ANO Note: {n.meta.ano_note}
                    </div>
                  )}
                </div>
                <button onClick={() => markRead(n.id)} style={{ ...MONO, fontSize: '0.6rem', background: 'transparent', border: '1px solid var(--csi-border)', color: 'var(--csi-text-muted)', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, marginLeft: '0.75rem' }}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}

          {/* Parade notification card */}
          {!hasNotif ? (
            <div style={{ ...card(), textAlign: 'center', padding: '2.5rem' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>🔕</div>
              <div style={{ ...MONO, fontSize: '0.75rem', color: 'var(--csi-text-muted)' }}>No active parade notification</div>
              <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', marginTop: '0.4rem', opacity: 0.6 }}>
                You will be notified when ANO creates a parade
              </div>
            </div>
          ) : (
            <div style={{
              ...card(),
              borderColor: isActive && !isAcked ? 'rgba(251,191,36,0.4)' : isAcked ? 'rgba(52,211,153,0.3)' : 'var(--csi-border)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isAcked ? 'var(--csi-green)' : 'var(--csi-amber)', borderRadius: '10px 10px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingTop: '0.4rem' }}>
                <div style={{ ...MONO, fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: isActive && !isAcked ? 'var(--csi-amber)' : 'var(--csi-text-muted)' }}>
                  🪖 Parade Orders
                </div>
                {isActive && !isAcked && (
                  <span style={{ ...MONO, fontSize: '0.55rem', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--csi-amber)', padding: '2px 8px', borderRadius: 4, letterSpacing: '0.1em' }}>
                    ACTION REQUIRED
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                {[
                  { k: 'Date',     v: fmtDate(parade.parade_date) },
                  { k: 'Session',  v: parade.session || '—', cap: true },
                  { k: 'Time',     v: fmtTime(parade.time) },
                  { k: 'Place',    v: parade.place || '—', cap: true },
                  { k: 'Status',   v: parade.status, col: parade.status === 'active' ? 'var(--csi-green)' : 'var(--csi-text-muted)', cap: true },
                  { k: 'Notified', v: fmtDate(notification.created_at) },
                ].map(({ k, v, col, cap }) => (
                  <div key={k}>
                    <div style={lbl()}>{k}</div>
                    <div style={val({ color: col, textTransform: cap ? 'capitalize' : undefined })}>{v}</div>
                  </div>
                ))}
              </div>
              {isAcked ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ...MONO, fontSize: '0.72rem', color: 'var(--csi-green)', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 6, padding: '0.6rem 1rem' }}>
                  <span>✓</span><span>Acknowledged{notification.ack_at ? ` · ${fmtDate(notification.ack_at)}` : ''}</span>
                </div>
              ) : (
                <button onClick={handleAcknowledge} disabled={acking || !isActive} style={{
                  width: '100%', padding: '0.75rem', background: acking ? 'var(--csi-bg-input)' : 'var(--csi-indigo)',
                  border: 'none', borderRadius: 6, color: '#fff', ...SYNE, fontSize: '0.85rem', fontWeight: 700,
                  letterSpacing: '0.08em', cursor: acking || !isActive ? 'not-allowed' : 'pointer', opacity: acking ? 0.7 : 1,
                }}>
                  {acking ? 'Acknowledging…' : '✓  OK Sir'}
                </button>
              )}
            </div>
          )}

          {/* Permission request form */}
          <PermissionRequestForm
            cadet={cadet}
            parade={parade}
            userId={userId}
            existingRequest={permissions.find(p => p.parade_id === parade?.id)}
            onSubmitted={loadAll}
          />
        </div>
      )}

      {/* ══ TAB: ATTENDANCE LOG ══ */}
      {tab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {[
              { k: 'Present',    v: presentCount, c: 'var(--csi-green)' },
              { k: 'Permission', v: permCount,    c: 'var(--csi-amber)' },
              { k: 'Absent',     v: absentCount,  c: 'var(--csi-red)'   },
              { k: 'Total',      v: totalParades, c: 'var(--csi-text-primary)' },
            ].map(({ k, v, c }) => (
              <div key={k} style={{ ...card({ padding: '0.75rem' }), flex: 1, textAlign: 'center' }}>
                <div style={{ ...MONO, fontSize: '1.3rem', fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ ...MONO, fontSize: '0.55rem', color: 'var(--csi-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.3rem' }}>{k}</div>
              </div>
            ))}
          </div>

          {/* Percentage */}
          <div style={card()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <div style={lbl({ marginBottom: 0 })}>Attendance Percentage</div>
              <div style={{ ...MONO, fontSize: '1.1rem', fontWeight: 700, color: pct >= 75 ? 'var(--csi-green)' : pct >= 50 ? 'var(--csi-amber)' : 'var(--csi-red)' }}>
                {totalParades === 0 ? '—' : `${pct}%`}
              </div>
            </div>
            <PctBar pct={pct} />
            {totalParades > 0 && (
              <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', marginTop: '0.5rem' }}>
                {presentCount + permCount} attended of {totalParades} parades this year
                {pct < 75 && <span style={{ color: 'var(--csi-amber)', marginLeft: '0.5rem' }}>· Below 75% threshold</span>}
              </div>
            )}
          </div>

          {/* History */}
          {attendance.length > 0 && (
            <div style={card({ padding: '1rem 1.2rem' })}>
              <div style={lbl({ marginBottom: '0.75rem' })}>Recent Parades</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {attendance.slice(0, 15).map(row => (
                  <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--csi-border)' }}>
                    <div style={{ ...MONO, fontSize: '0.7rem', color: 'var(--csi-text-muted)' }}>{fmtDate(row.created_at)}</div>
                    <div style={{ ...MONO, fontSize: '0.65rem', fontWeight: 600, textTransform: 'capitalize', color: row.status === 'present' ? 'var(--csi-green)' : row.status === 'permission' ? 'var(--csi-amber)' : 'var(--csi-red)' }}>
                      {row.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attendance.length === 0 && (
            <div style={{ ...card(), textAlign: 'center', padding: '2rem' }}>
              <div style={{ ...MONO, fontSize: '0.75rem', color: 'var(--csi-text-muted)' }}>No attendance records this year</div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: PROFILE ══ */}
      {tab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Cadet details */}
          <div style={card()}>
            <div style={lbl({ marginBottom: '1rem' })}>🪪 Service Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              {[
                { k: 'Full Name',     v: cadet?.name },
                { k: 'Rank',          v: cadet?.rank },
                { k: 'Enrollment No', v: cadet?.enrollment_no },
                { k: 'Category',      v: cadet?.category },
                { k: 'Division',      v: cadet?.division },
                { k: 'Status',        v: cadet?.is_active ? 'Active' : 'Inactive', col: cadet?.is_active ? 'var(--csi-green)' : 'var(--csi-red)' },
              ].map(({ k, v, col }) => (
                <div key={k}>
                  <div style={lbl()}>{k}</div>
                  <div style={val({ color: col })}>{v || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Permission requests history */}
          <div>
            <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.6rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--csi-border)' }}>
              📄 My Permission Requests
              {pendingPerms > 0 && (
                <span style={{ ...MONO, fontSize: '0.55rem', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: 'var(--csi-amber)', padding: '2px 7px', borderRadius: 4, marginLeft: '0.6rem' }}>
                  {pendingPerms} PENDING
                </span>
              )}
            </div>
            {permissions.length === 0 ? (
              <div style={{ ...card(), textAlign: 'center', padding: '1.5rem' }}>
                <div style={{ ...MONO, fontSize: '0.72rem', color: 'var(--csi-text-muted)' }}>No permission requests submitted</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {permissions.map(perm => {
                  const statusColor = perm.status === 'approved' ? 'var(--csi-green)' : perm.status === 'rejected' ? 'var(--csi-red)' : 'var(--csi-amber)';
                  const statusBg    = perm.status === 'approved' ? 'rgba(52,211,153,0.1)' : perm.status === 'rejected' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)';
                  return (
                    <div key={perm.id} style={{ ...card({ padding: '0.9rem 1.1rem' }), borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: statusColor }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ ...MONO, fontSize: '0.75rem', color: 'var(--csi-text-primary)', marginBottom: '0.3rem' }}>
                            {perm.description || perm.reason || 'No description'}
                          </div>
                          <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)' }}>
                            {perm.from_date ? `${fmtDate(perm.from_date)} → ` : ''}{fmtDate(perm.to_date)}
                            {perm.to_session ? ` · ${perm.to_session}` : ''}
                          </div>
                          {perm.ano_note && (
                            <div style={{ ...MONO, fontSize: '0.65rem', color: 'var(--csi-text-muted)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                              ANO: {perm.ano_note}
                            </div>
                          )}
                        </div>
                        <span style={{ ...MONO, fontSize: '0.58rem', padding: '3px 9px', borderRadius: 4, background: statusBg, color: statusColor, border: `1px solid ${statusColor}`, flexShrink: 0, fontWeight: 700 }}>
                          {perm.status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past system notifications */}
          {sysNotifs.filter(n => n.read).length > 0 && (
            <div>
              <div style={lbl({ marginBottom: '0.5rem' })}>Past Responses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {sysNotifs.filter(n => n.read).map(n => (
                  <div key={n.id} style={{ ...card({ padding: '0.7rem 1rem' }), opacity: 0.7 }}>
                    <div style={{ ...MONO, fontSize: '0.7rem', color: n.type === 'permission_approved' ? 'var(--csi-green)' : 'var(--csi-red)' }}>{n.title}</div>
                    <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', marginTop: '0.2rem' }}>{n.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PERMISSION REQUEST FORM
   Default: permission for the current parade only.
   Toggle "Multi-day" to pick from/to date + session.
   ══════════════════════════════════════════════════ */
const SESSIONS = ['morning', 'afternoon', 'evening'];

/* ══════════════════════════════════════════════════════
   PERMISSION REQUEST FORM
   - If cadet already has a request for this parade,
     show its status instead of the form.
   - Default: for current parade only (no date input).
   - "Multi-day leave" toggle reveals from/to date+session.
   ══════════════════════════════════════════════════ */

function PermissionRequestForm({ cadet, parade, userId, existingRequest, onSubmitted }) {
  const [open,        setOpen]        = useState(false);
  const [description, setDescription] = useState('');
  const [multiDay,    setMultiDay]    = useState(false);
  const [fromDate,    setFromDate]    = useState('');
  const [fromSession, setFromSession] = useState('');
  const [toDate,      setToDate]      = useState('');
  const [toSession,   setToSession]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    setOpen(false); setDescription(''); setMultiDay(false);
    setFromDate(''); setFromSession(''); setToDate(''); setToSession('');
    setError(null);
  }, [parade?.id]);

  if (!parade || parade.status !== 'active') return null;

  const paradeDateFmt = new Date(parade.parade_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Already submitted — show status banner ──────────
  if (existingRequest) {
    const s      = existingRequest.status;
    const color  = s === 'approved' ? 'var(--csi-green)' : s === 'rejected' ? 'var(--csi-red)' : 'var(--csi-amber)';
    const bg     = s === 'approved' ? 'rgba(52,211,153,0.08)' : s === 'rejected' ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)';
    const border = s === 'approved' ? 'rgba(52,211,153,0.25)' : s === 'rejected' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)';
    const icon   = s === 'approved' ? '✓' : s === 'rejected' ? '✕' : '⏳';
    const title  = s === 'approved' ? 'Permission Granted'
                 : s === 'rejected' ? 'Permission Declined'
                 : 'Request Under Review';
    const sub    = s === 'approved' ? 'ANO has approved your permission request.'
                 : s === 'rejected' ? 'ANO has declined your request.'
                 : 'Your request has been sent to ANO. Awaiting response.';
    return (
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '1rem 1.4rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '1.25rem', lineHeight: 1, paddingTop: '0.1rem' }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ ...SYNE, fontSize: '0.8rem', fontWeight: 700, color, marginBottom: '0.2rem' }}>{title}</div>
          <div style={{ ...MONO, fontSize: '0.68rem', color: 'var(--csi-text-muted)', marginBottom: '0.4rem' }}>{sub}</div>
          <div style={{ ...MONO, fontSize: '0.65rem', color: 'var(--csi-text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
            "{existingRequest.description || existingRequest.reason}"
          </div>
          {existingRequest.from_date && (
            <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', marginTop: '0.35rem' }}>
              {existingRequest.from_date === existingRequest.to_date
                ? `For: ${existingRequest.from_date}`
                : `${existingRequest.from_date} → ${existingRequest.to_date}`}
            </div>
          )}
          {existingRequest.ano_note && (
            <div style={{ ...MONO, fontSize: '0.65rem', color, marginTop: '0.35rem', background: bg, borderRadius: 4, padding: '0.3rem 0.5rem' }}>
              ANO note: {existingRequest.ano_note}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No existing request — show form ─────────────────
  async function handleSubmit() {
    if (!description.trim()) { setError('Please describe your reason.'); return; }
    if (multiDay) {
      if (!fromDate)         { setError('Select the start date.'); return; }
      if (!fromSession)      { setError('Select the start session.'); return; }
      if (!toDate)           { setError('Select the end date.'); return; }
      if (!toSession)        { setError('Select the end session.'); return; }
      if (toDate < fromDate) { setError('End date cannot be before start date.'); return; }
    }
    setSubmitting(true); setError(null);
    const { error: err } = await supabase.from('permissions').insert({
      parade_id    : parade.id,
      cadet_id     : cadet.id,
      requested_by : userId,
      description  : description.trim(),
      reason       : 'Cadet Request',
      from_date    : multiDay ? fromDate    : parade.parade_date,
      to_date      : multiDay ? toDate      : parade.parade_date,
      to_session   : multiDay ? toSession   : parade.session,
      status       : 'pending',
      created_by   : userId,
    });
    if (err) { setError(err.message); setSubmitting(false); return; }
    setSubmitting(false);
    onSubmitted(); // triggers loadAll → existingRequest will be set → banner shows
  }

  const inp = { width: '100%', boxSizing: 'border-box', background: 'var(--csi-bg-input)', border: '1px solid var(--csi-border)', borderRadius: 6, padding: '0.5rem 0.65rem', ...MONO, fontSize: '0.75rem', color: 'var(--csi-text-primary)', outline: 'none' };

  return (
    <div style={{ background: 'var(--csi-bg-card)', border: '1px solid var(--csi-border)', borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.4rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span>📝</span>
          <span style={{ ...SYNE, fontSize: '0.78rem', fontWeight: 700, color: 'var(--csi-text-primary)', letterSpacing: '0.06em' }}>Request Permission</span>
        </div>
        <span style={{ ...MONO, fontSize: '0.75rem', color: 'var(--csi-text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 1.4rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', borderTop: '1px solid var(--csi-border)' }}>
          {/* Parade chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.9rem' }}>
            <span style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Parade</span>
            <span style={{ ...MONO, fontSize: '0.68rem', color: 'var(--csi-text-primary)', background: 'var(--csi-bg-input)', border: '1px solid var(--csi-border)', borderRadius: 5, padding: '0.15rem 0.6rem' }}>
              {paradeDateFmt} · {parade.session}
            </span>
          </div>

          {/* Description */}
          <div>
            <div style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Reason *</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder={`e.g. "Attending my sister's wedding in Hyderabad, unable to attend parade."`}
              maxLength={500} rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ ...MONO, fontSize: '0.58rem', color: 'var(--csi-text-muted)', textAlign: 'right', marginTop: '0.2rem' }}>{description.length}/500</div>
          </div>

          {/* Multi-day toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setMultiDay(m => !m)} style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              background: multiDay ? 'rgba(79,70,229,0.15)' : 'var(--csi-bg-input)',
              border: `1px solid ${multiDay ? 'rgba(79,70,229,0.5)' : 'var(--csi-border)'}`,
              borderRadius: 6, padding: '0.4rem 0.8rem', cursor: 'pointer',
              ...MONO, fontSize: '0.68rem', color: multiDay ? 'var(--csi-indigo-light)' : 'var(--csi-text-muted)',
              fontWeight: multiDay ? 700 : 400,
            }}>
              <span>📅</span> Multi-day leave
            </button>
            {!multiDay && (
              <span style={{ ...MONO, fontSize: '0.62rem', color: 'var(--csi-text-muted)' }}>
                For this parade only · {paradeDateFmt}
              </span>
            )}
          </div>

          {/* Date/session pickers */}
          {multiDay && (
            <div style={{ background: 'var(--csi-bg-input)', border: '1px solid var(--csi-border)', borderRadius: 8, padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ ...MONO, fontSize: '0.6rem', color: 'var(--csi-indigo-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Leave Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ ...MONO, fontSize: '0.6rem', color: 'var(--csi-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>From Date</div>
                  <input type="date" value={fromDate} min={parade.parade_date}
                    onChange={e => { setFromDate(e.target.value); if (!toDate || e.target.value > toDate) setToDate(e.target.value); }}
                    style={inp} />
                  <select value={fromSession} onChange={e => setFromSession(e.target.value)} style={inp}>
                    <option value="">Session…</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ ...MONO, fontSize: '0.6rem', color: 'var(--csi-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>To Date</div>
                  <input type="date" value={toDate} min={fromDate || parade.parade_date}
                    onChange={e => setToDate(e.target.value)}
                    style={inp} />
                  <select value={toSession} onChange={e => setToSession(e.target.value)} style={inp}>
                    <option value="">Session…</option>
                    {SESSIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ ...MONO, fontSize: '0.7rem', color: 'var(--csi-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '0.7rem', background: submitting ? 'var(--csi-bg-input)' : 'var(--csi-indigo)', border: 'none', borderRadius: 6, color: '#fff', ...SYNE, fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button onClick={() => setOpen(false)} style={{ padding: '0.7rem 1rem', background: 'transparent', border: '1px solid var(--csi-border)', borderRadius: 6, color: 'var(--csi-text-muted)', ...MONO, fontSize: '0.72rem', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
