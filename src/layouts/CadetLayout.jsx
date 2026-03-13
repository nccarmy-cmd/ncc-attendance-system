import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import CadetDashboard from '../pages/CadetDashboard';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };
const SYNE = { fontFamily: "'Syne', sans-serif" };

const STYLES = `
  .cl-shell {
    min-height: 100vh;
    background: var(--csi-bg-page);
    color: var(--csi-text-primary);
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top, 0px);
  }
  .cl-topbar {
    background: var(--csi-bg-card);
    border-bottom: 1px solid var(--csi-border);
    padding: 0 1.25rem;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    flex-shrink: 0;
  }
`;

export default function CadetLayout() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="cl-shell">

        {/* ── Top Nav Bar ─────────────────────────────────── */}
        <header className="cl-topbar">

          {/* Left — Unit identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--csi-green)',
              boxShadow: '0 0 6px var(--csi-green)',
            }} />
            <span style={{
              ...SYNE,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--csi-text-primary)',
              letterSpacing: '0.02em',
            }}>
              NBKRIST NCC
            </span>
            <span style={{
              ...MONO,
              fontSize: '0.62rem',
              color: 'var(--csi-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Cadets Records System
            </span>
          </div>

          {/* Right — Role chip + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              ...MONO,
              fontSize: '0.6rem',
              color: 'var(--csi-indigo-light)',
              background: 'rgba(79,70,229,0.12)',
              border: '1px solid rgba(79,70,229,0.25)',
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              CADET
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                ...MONO,
                fontSize: '0.65rem',
                padding: '4px 12px',
                background: 'transparent',
                border: '1px solid var(--csi-border)',
                color: 'var(--csi-text-muted)',
                borderRadius: '4px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--csi-red)';
                e.currentTarget.style.color = 'var(--csi-red)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--csi-border)';
                e.currentTarget.style.color = 'var(--csi-text-muted)';
              }}
            >
              {loggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </header>

        {/* ── Page Content ─────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <CadetDashboard />
        </main>

      </div>
    </>
  );
}