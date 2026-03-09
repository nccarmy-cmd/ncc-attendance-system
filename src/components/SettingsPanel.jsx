import { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { supabase } from '../lib/supabaseClient';

/* ─────────────────────────────────────────────────────────────
   SETTINGS PANEL  (v3)
   Fixed overlay anchored bottom-left above the Settings button.
   ANO  → Appearance + AdminDesk shortcut + Logout
   Senior → Appearance + Feedback form (Submit/My Reports) + Logout

   Props:
     onNavigate(pageId)  — nav shortcut (ANO only)
     onLogout()          — logout handler
     onClose()           — close panel
     currentPage         — highlights active shortcut
     role                — 'ano' | 'senior'
─────────────────────────────────────────────────────────────── */
export default function SettingsPanel({ onNavigate, onLogout, currentPage, onClose, role = 'ano' }) {
  const { theme, setTheme, isDark } = useTheme();

  const T = {
    bg:           isDark ? '#0f1623'                : '#ffffff',
    border:       isDark ? '#1e293b'                : '#e2e8f0',
    text:         isDark ? '#f1f5f9'                : '#1e293b',
    textSub:      isDark ? '#94a3b8'                : '#64748b',
    hover:        isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    active:       isDark ? 'rgba(79,70,229,0.18)'   : 'rgba(79,70,229,0.08)',
    activeBorder: '#4f46e5',
    danger:       isDark ? '#fca5a5'                : '#dc2626',
    dangerHover:  isDark ? 'rgba(220,38,38,0.1)'    : 'rgba(220,38,38,0.06)',
    overlay:      isDark ? 'rgba(0,0,0,0.35)'       : 'rgba(0,0,0,0.15)',
    inputBg:      isDark ? '#1a2234'                : '#f0f4fb',
    inputBorder:  isDark ? '#2b3c55'                : '#c5cfdf',
  };

  const themeOptions = [
    { val: 'light',  icon: '☀️',  label: 'Light'  },
    { val: 'device', icon: '💻',  label: 'Device' },
    { val: 'dark',   icon: '🌙',  label: 'Dark'   },
  ];

  const isAno = role === 'ano';

  const labelSt = {
    display: 'block', fontSize: '0.62rem', color: T.textSub,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    fontFamily: "'JetBrains Mono', monospace", marginBottom: '0.4rem',
  };
  const inputSt = {
    width: '100%', boxSizing: 'border-box',
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: '6px', padding: '7px 10px',
    color: T.text, fontSize: '0.78rem',
    fontFamily: "'Inter', sans-serif", outline: 'none',
    resize: 'vertical',
  };
  const selectSt = {
    ...inputSt, cursor: 'pointer', appearance: 'none', resize: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2364748b'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  };

  function handleNav(id) { onNavigate?.(id); onClose?.(); }
  function handleLogout() { onClose?.(); onLogout?.(); }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1199, background: T.overlay,
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        bottom: '3.5rem',
        left: '0.75rem',
        width: '226px',
        maxHeight: 'calc(100vh - 52px - 4.5rem)',
        overflowY: 'auto',
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: '0.85rem',
        boxShadow: isDark
          ? '0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
          : '0 -8px 32px rgba(0,0,0,0.14)',
        zIndex: 1200,
        fontFamily: "'Inter', sans-serif",
        scrollbarWidth: 'thin',
        scrollbarColor: isDark ? '#1e293b transparent' : '#e2e8f0 transparent',
      }}>

        {/* ── Appearance ── */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.border}` }}>
          <p style={{ ...labelSt, marginBottom: '0.6rem' }}>Appearance</p>
          <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden', border: `1px solid ${T.border}` }}>
            {themeOptions.map(({ val, icon, label }) => (
              <button key={val} onClick={() => setTheme(val)} title={label}
                style={{
                  flex: 1, background: theme === val ? '#4f46e5' : 'transparent',
                  border: 'none', padding: '0.45rem 0', cursor: 'pointer',
                  color: theme === val ? 'white' : T.textSub,
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: '0.15rem',
                }}>
                <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.04em' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── ANO: AdminDesk shortcut ── */}
        {isAno && (
          <div style={{ padding: '0.4rem 0', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => handleNav('admindesk')}
              style={{
                width: '100%', textAlign: 'left',
                background: currentPage === 'admindesk' ? T.active : 'none',
                border: 'none',
                borderLeft: `2px solid ${currentPage === 'admindesk' ? T.activeBorder : 'transparent'}`,
                padding: '0.6rem 1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (currentPage !== 'admindesk') e.currentTarget.style.background = T.hover; }}
              onMouseLeave={e => { e.currentTarget.style.background = currentPage === 'admindesk' ? T.active : 'none'; }}>
              <span style={{ fontSize: '1rem' }}>📬</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: T.text }}>AdminDesk</p>
                <p style={{ margin: 0, fontSize: '0.62rem', color: T.textSub, fontFamily: "'JetBrains Mono', monospace" }}>Reports & feedback</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Senior: Feedback nav shortcut ── */}
        {!isAno && (
          <div style={{ padding: '0.4rem 0', borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => handleNav('feedback')}
              style={{
                width: '100%', textAlign: 'left',
                background: currentPage === 'feedback' ? T.active : 'none',
                border: 'none',
                borderLeft: `2px solid ${currentPage === 'feedback' ? T.activeBorder : 'transparent'}`,
                padding: '0.6rem 1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (currentPage !== 'feedback') e.currentTarget.style.background = T.hover; }}
              onMouseLeave={e => { e.currentTarget.style.background = currentPage === 'feedback' ? T.active : 'none'; }}>
              <span style={{ fontSize: '1rem' }}>📣</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: T.text }}>Feedback</p>
                <p style={{ margin: 0, fontSize: '0.62rem', color: T.textSub, fontFamily: "'JetBrains Mono', monospace" }}>Submit & track reports</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Logout ── */}
        <div style={{ padding: '0.4rem 0' }}>
          <button onClick={handleLogout}
            style={{
              width: '100%', textAlign: 'left', background: 'none', border: 'none',
              padding: '0.6rem 1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.dangerHover}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <span style={{ fontSize: '1rem' }}>🚪</span>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: T.danger }}>Logout</p>
          </button>
        </div>
      </div>
    </>
  );
}


