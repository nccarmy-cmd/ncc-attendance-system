import { useState, useEffect, useCallback } from 'react';
import { supabase }  from '../lib/supabaseClient';
import nccLogo       from '../assets/ncc-logo.png';
import anoPhoto      from '../assets/ano.jpg';

const THEMES = {
  dark: {
    '--bg-page'            : '#05080f',
    '--bg-topbar'          : 'rgba(5,8,18,0.90)',
    '--bg-overlay'         : 'rgba(3,6,14,0.90)',
    '--bg-card'            : 'rgba(7,12,25,0.98)',
    '--bg-input'           : 'rgba(6,12,28,0.97)',
    '--text-primary'       : '#f1f5f9',
    '--text-sub'           : '#94a3b8',
    '--text-muted'         : '#354a6b',
    '--text-unit'          : '#f0a500',
    '--border-subtle'      : 'rgba(240,165,0,0.12)',
    '--border-mid'         : 'rgba(240,165,0,0.22)',
    '--border-bright'      : 'rgba(240,165,0,0.50)',
    '--border-input'       : 'rgba(240,165,0,0.20)',
    '--border-input-focus' : 'rgba(240,165,0,0.72)',
    '--gold'               : '#f0a500',
    '--gold-hover'         : '#fbbf24',
    '--gold-glow'          : 'rgba(240,165,0,0.22)',
    '--gold-dim'           : '#6b4700',
    '--indigo-soft'        : '#818cf8',
    '--danger'             : '#f87171',
    '--danger-bg'          : 'rgba(248,113,113,0.10)',
    '--danger-border'      : 'rgba(248,113,113,0.30)',
    '--success'            : '#34d399',
    '--success-bg'         : 'rgba(52,211,153,0.10)',
    '--success-border'     : 'rgba(52,211,153,0.30)',
    '--logo-blend'         : 'screen',
    '--radial-1'           : 'rgba(240,165,0,0.05)',
    '--radial-2'           : 'rgba(79,70,229,0.06)',
  },
  light: {
    '--bg-page'            : '#eef2f8',
    '--bg-topbar'          : 'rgba(228,235,248,0.93)',
    '--bg-overlay'         : 'rgba(175,190,215,0.84)',
    '--bg-card'            : 'rgba(255,255,255,0.98)',
    '--bg-input'           : 'rgba(248,250,255,0.97)',
    '--text-primary'       : '#1e293b',
    '--text-sub'           : '#475569',
    '--text-muted'         : '#94a3b8',
    '--text-unit'          : '#1e3a6e',
    '--border-subtle'      : 'rgba(30,58,110,0.10)',
    '--border-mid'         : 'rgba(30,58,110,0.20)',
    '--border-bright'      : 'rgba(30,58,110,0.42)',
    '--border-input'       : 'rgba(30,58,110,0.20)',
    '--border-input-focus' : 'rgba(30,58,110,0.68)',
    '--gold'               : '#b36b00',
    '--gold-hover'         : '#d47e00',
    '--gold-glow'          : 'rgba(179,107,0,0.18)',
    '--gold-dim'           : '#b36b00',
    '--indigo-soft'        : '#4f46e5',
    '--danger'             : '#dc2626',
    '--danger-bg'          : 'rgba(220,38,38,0.07)',
    '--danger-border'      : 'rgba(220,38,38,0.28)',
    '--success'            : '#15803d',
    '--success-bg'         : 'rgba(21,128,61,0.07)',
    '--success-border'     : 'rgba(21,128,61,0.28)',
    '--logo-blend'         : 'multiply',
    '--radial-1'           : 'rgba(179,107,0,0.05)',
    '--radial-2'           : 'rgba(79,70,229,0.04)',
  },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.dark;
  Object.entries(t).forEach(([k, v]) =>
    document.documentElement.style.setProperty(k, v));
  document.documentElement.setAttribute('data-theme', name);
}

const F = {
  display : "'Cinzel Decorative','Cinzel',serif",
  body    : "'Raleway',sans-serif",
  mono    : "'JetBrains Mono',monospace",
};

const GLOBAL_CSS = `

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Raleway:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body { background: var(--bg-page, #05080f); overflow-x: hidden; width: 100%; }
#root { width: 100%; min-height: 100dvh; display: flex; flex-direction: column; }

/* ── DESKTOP tokens (≥640px) ── */
:root {
  /* Top bar */
  --topbar-h      : 60px;
  --topbar-px     : 1.5rem;
  --topbar-gap    : 0.7rem;
  --ncc-logo-sz   : 46px;
  --unit-name-fs  : 0.86rem;   /* "2(A) EME UNIT NCC" font-size          */
  --unit-sub-fs   : 0.52rem;   /* "NBKR IST · Vidyanagar" font-size       */

  /* Body */
  --body-py       : 2rem;      /* top/bottom padding                      */
  --body-px       : 1.5rem;    /* left/right padding                      */
  --body-gap      : 1.5rem;    /* gap: ANO section ↔ ACCESS PORTAL btn    */

  /* ANO section */
  --ano-gap       : 0.6rem;    /* gap: photo / name / ANO label           */
  --ano-ring-sz   : 114px;     /* photo circle diameter                   */
  --ano-ring-off  : 8px;       /* rotating ring overhang                  */
  --ano-name-fs   : 0.8rem;    /* name + ANO label font-size              */

  /* ACCESS PORTAL button */
  --access-px     : 2.3rem;
  --access-py     : 0.62rem;
  --access-fs     : 0.74rem;
  --access-radius : 2rem;

  /* Popup overlay */
  --overlay-px    : 1rem;
  --overlay-py    : 1.5rem;
  --overlay-gap   : 0.9rem;

  /* ANO mini (inside popup) */
  --ano-mini-gap  : 0.38rem;
  --ano-mini-sz   : 80px;
  --ano-mini-off  : 6px;
  --ano-mini-nfs  : 0.7rem;

  /* Card */
  --card-maxw     : 390px;
  --card-radius   : 1rem;
  --card-px       : 1.45rem;
  --card-py       : 1.2rem;
  --card-accent-h : 3px;
  --card-title-fs : 0.93rem;
  --card-sub-fs   : 0.59rem;

  /* Form fields */
  --field-gap     : 0.9rem;
  --label-fs      : 0.6rem;
  --label-mb      : 0.35rem;
  --input-px      : 1rem;
  --input-py      : 0.68rem;
  --input-fs      : 0.86rem;
  --input-radius  : 0.5rem;

  /* Primary button */
  --btn-py        : 0.75rem;
  --btn-fs        : 0.82rem;
  --btn-radius    : 0.5rem;

  /* OTP boxes */
  --otp-w         : 2.4rem;
  --otp-h         : 2.8rem;
  --otp-gap       : 0.38rem;
  --otp-fs        : 1.1rem;

  /* Footer */
  --footer-py     : 0.6rem;
  --footer-fs     : 0.55rem;
}

/* ── MOBILE tokens (<640px) ── */
@media (max-width: 639px) {
  :root {
    --topbar-h      : 52px;
    --topbar-px     : 0.9rem;
    --topbar-gap    : 0.5rem;
    --ncc-logo-sz   : 34px;
    --unit-name-fs  : 0.68rem;
    --unit-sub-fs   : 0.44rem;

    --body-py       : 1.2rem;
    --body-px       : 0.75rem;
    --body-gap      : 1.2rem;

    --ano-gap       : 0.45rem;
    --ano-ring-sz   : 88px;
    --ano-ring-off  : 6px;
    --ano-name-fs   : 0.7rem;

    --access-px     : 1.5rem;
    --access-py     : 0.55rem;
    --access-fs     : 0.66rem;

    --overlay-px    : 0.55rem;
    --overlay-py    : 0.7rem;
    --overlay-gap   : 0.65rem;

    --ano-mini-gap  : 0.28rem;
    --ano-mini-sz   : 60px;
    --ano-mini-off  : 5px;
    --ano-mini-nfs  : 0.6rem;

    --card-maxw     : 100%;
    --card-radius   : 0.75rem;
    --card-px       : 1rem;
    --card-py       : 0.95rem;
    --card-title-fs : 0.8rem;
    --card-sub-fs   : 0.54rem;

    --field-gap     : 0.75rem;
    --label-fs      : 0.56rem;
    --label-mb      : 0.28rem;
    --input-px      : 0.85rem;
    --input-py      : 0.62rem;
    --input-fs      : 0.82rem;

    --btn-py        : 0.66rem;
    --btn-fs        : 0.75rem;

    --otp-w         : 1.85rem;
    --otp-h         : 2.3rem;
    --otp-gap       : 0.26rem;
    --otp-fs        : 0.92rem;

    --footer-py     : 0.48rem;
    --footer-fs     : 0.5rem;
  }
}

/* ── Animations ── */
@keyframes ringRotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes ringGlow {
  0%,100% { box-shadow: 0 0 8px var(--gold), 0 0 18px var(--gold-glow); opacity:.72; }
  50%      { box-shadow: 0 0 18px var(--gold), 0 0 36px var(--gold-glow), 0 0 52px rgba(240,165,0,.14); opacity:1; }
}
@keyframes popupIn {
  from { opacity:0; transform:translateY(24px) scale(.96); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes overlayIn {
  from { opacity:0; }
  to   { opacity:1; }
}
@keyframes starDrift {
  from { background-position: 0 0, 60px 80px, 130px 200px; }
  to   { background-position: 0 -2000px, 60px -1920px, 130px -1800px; }
}

/* ── Hover states ── */
.ncc-btn:hover:not(:disabled) { background: var(--gold-hover) !important; }
.ncc-link:hover               { color: var(--gold-hover) !important; }

/* ── Inputs: force correct text color in all themes ── */
input, textarea, select {
  color: var(--text-primary) !important;
  background-color: var(--bg-input);
}
input::placeholder { color: var(--text-muted) !important; opacity: 1 !important; }

/* ── Autofill: prevent Chrome from overriding colors ── */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 200px var(--bg-input) inset !important;
  -webkit-text-fill-color: var(--text-primary) !important;
  caret-color: var(--gold);
  transition: background-color 9999s;
}

/* ── Scrollbar ── */
::selection { background: rgba(240,165,0,.28); color:#fff; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: var(--gold-dim); border-radius: 2px; }

/* ── Touch targets ── */
@media (max-width: 639px) {
  .ncc-btn  { min-height: 44px; }
  .ncc-link { min-height: 36px; display: inline-flex; align-items: center; }
}
`;

/* ── AnoCircle ── */
function AnoCircle({ mini = false }) {
  const sz  = mini ? 'var(--ano-mini-sz)'  : 'var(--ano-ring-sz)';
  const neg = mini ? 'calc(-1 * var(--ano-mini-off))' : 'calc(-1 * var(--ano-ring-off))';
  return (
    <div style={{ position:'relative', width:sz, height:sz, flexShrink:0 }}>
      {/* Rotating dashed ring */}
      <div style={{
        position:'absolute', top:neg, right:neg, bottom:neg, left:neg,
        borderRadius:'50%', border:'1.5px dashed var(--gold)',
        animation:'ringRotate 7s linear infinite', opacity:0.78, pointerEvents:'none',
      }} />
      {/* Glow ring */}
      <div style={{
        position:'absolute', top:neg, right:neg, bottom:neg, left:neg,
        borderRadius:'50%', animation:'ringGlow 3.5s ease-in-out infinite', pointerEvents:'none',
      }} />
      {/* Photo */}
      <img src={anoPhoto} alt="ANO" style={{
        display:'block', width:'100%', height:'100%',
        borderRadius:'50%', objectFit:'cover', objectPosition:'top center',
        border:'2.5px solid var(--gold)',
      }} />
    </div>
  );
}

/* ── ThemeToggle ── */
function ThemeToggle({ theme, onChange }) {
  const opts = [
    { val:'light',  icon:'☀️',  label:'Light'  },
    { val:'device', icon:'💻', label:'Device' },
    { val:'dark',   icon:'🌙', label:'Dark'   },
  ];
  return (
    <div style={{
      display:'flex', borderRadius:'2rem', overflow:'hidden',
      border:'1px solid var(--border-mid)', background:'rgba(5,10,22,0.5)', flexShrink:0,
    }}>
      {opts.map(({ val, icon, label }) => (
        <button key={val} title={label} onClick={() => onChange(val)} style={{
          background : theme === val ? 'var(--gold)' : 'transparent',
          border     : 'none', padding:'0.32rem 0.58rem', cursor:'pointer',
          fontSize   : '0.72rem', lineHeight:1,
          color      : theme === val ? '#05080f' : 'var(--text-muted)',
          transition : 'background .18s, color .18s',
        }}>{icon}</button>
      ))}
    </div>
  );
}

/* ── OtpInput ── */
function OtpInput({ value, onChange }) {
  const digits = value.split('').concat(Array(8).fill('')).slice(0, 8);
  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const a = [...digits]; a[i] = '';
      if (i > 0) document.getElementById(`otp_${i-1}`)?.focus();
      onChange(a.join('')); return;
    }
    if (/^\d$/.test(e.key)) {
      const a = [...digits]; a[i] = e.key;
      onChange(a.join('').slice(0, 8));
      if (i < 7) document.getElementById(`otp_${i+1}`)?.focus();
    }
  }
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:'var(--otp-gap)' }}>
      {digits.map((d, i) => (
        <input key={i} id={`otp_${i}`} type="text" inputMode="numeric"
          maxLength={1} value={d} onChange={() => {}}
          onKeyDown={e => handleKey(i, e)}
          onPaste={e => {
            const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,8);
            onChange(p);
            setTimeout(() => document.getElementById(`otp_${Math.min(p.length,7)}`)?.focus(), 0);
            e.preventDefault();
          }}
          style={{
            width:'var(--otp-w)', height:'var(--otp-h)',
            textAlign:'center', fontSize:'var(--otp-fs)', fontWeight:700,
            background:'var(--bg-input)',
            border:`1.5px solid ${d ? 'var(--gold)' : 'var(--border-input)'}`,
            borderRadius:'0.4rem', color:'var(--gold)', outline:'none',
            fontFamily:F.mono, transition:'border-color .15s, box-shadow .15s',
            boxShadow: d ? '0 0 8px var(--gold-glow)' : 'none', flexShrink:0,
          }}
        />
      ))}
    </div>
  );
}

/* ── Field ── */
function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display:'block', fontSize:'var(--label-fs)', fontWeight:600,
        color:'var(--gold)', marginBottom:'var(--label-mb)',
        fontFamily:F.mono, textTransform:'uppercase', letterSpacing:'0.12em',
      }}>{label}</label>
      {children}
    </div>
  );
}

/* ── TInput ── */
function TInput({ type='text', value, onChange, placeholder, overrideBorder, right }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        autoComplete={type==='password'?'current-password':type==='email'?'email':'off'}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          display:'block', width:'100%', background:'var(--bg-input)',
          border:`1.5px solid ${overrideBorder ? overrideBorder : focused ? 'var(--border-input-focus)' : 'var(--border-input)'}`,
          borderRadius:'var(--input-radius)',
          padding:`var(--input-py) ${right ? '2.8rem' : 'var(--input-px)'} var(--input-py) var(--input-px)`,
          fontSize:'var(--input-fs)', color:'var(--text-primary)', outline:'none',
          fontFamily:F.body, transition:'border-color .2s, box-shadow .2s',
          boxShadow: focused ? '0 0 0 3px rgba(240,165,0,0.12)' : 'none',
        }}
      />
      {right && (
        <div style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)' }}>
          {right}
        </div>
      )}
    </div>
  );
}

/* ── StrBar ── */
function StrBar({ pw }) {
  if (!pw) return null;
  const s = pw.length >= 12
    ? { w:'100%', c:'var(--success)',    t:'Strong' }
    : pw.length >= 8
    ? { w:'60%',  c:'var(--gold-hover)', t:'Medium' }
    : { w:'25%',  c:'var(--danger)',     t:'Weak'   };
  return (
    <div style={{ marginTop:'0.38rem' }}>
      <div style={{ height:'3px', background:'rgba(255,255,255,0.08)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:s.w, background:s.c, borderRadius:'2px', transition:'width .3s, background .3s' }} />
      </div>
      <p style={{ margin:'0.18rem 0 0', fontSize:'0.58rem', color:s.c, fontFamily:F.mono }}>{s.t}</p>
    </div>
  );
}

/* ── Alert ── */
function Alert({ type='error', msg }) {
  if (!msg) return null;
  const err = type === 'error';
  return (
    <div style={{
      background:`${err ? 'var(--danger-bg)' : 'var(--success-bg)'}`,
      border:`1px solid ${err ? 'var(--danger-border)' : 'var(--success-border)'}`,
      borderRadius:'0.45rem', padding:'0.52rem 0.85rem',
      display:'flex', gap:'0.5rem', alignItems:'flex-start',
    }}>
      <span style={{ fontSize:'0.8rem', marginTop:'0.04rem', flexShrink:0 }}>{err ? '⚠' : '✓'}</span>
      <p style={{ fontFamily:F.mono, fontSize:'0.7rem', color:err?'var(--danger)':'var(--success)', margin:0, lineHeight:1.5 }}>{msg}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Login({ initialFlow = 'login' }) {

  const [theme, setTheme] = useState(() => localStorage.getItem('ncc_theme') || 'device');

  const resolveTheme = useCallback(t =>
    t === 'device'
      ? (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')
      : t,
  []);

  function changeTheme(t) {
    setTheme(t);
    localStorage.setItem('ncc_theme', t);
    applyTheme(resolveTheme(t));
  }

  useEffect(() => {
    applyTheme(resolveTheme(theme));
    const mq = window.matchMedia('(prefers-color-scheme:dark)');
    const h  = () => { if (theme === 'device') applyTheme(resolveTheme('device')); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme, resolveTheme]);

  const [open,   setOpen]   = useState(initialFlow !== 'login');
  const [email,  setEmail]  = useState('');
  const [pw,     setPw]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const [lErr,   setLErr]   = useState(null);
  const [lLd,    setLLd]    = useState(false);

  const [flow,   setFlow]   = useState(initialFlow);
  const [fpEm,   setFpEm]   = useState('');
  const [otp,    setOtp]    = useState('');
  const [np,     setNp]     = useState('');
  const [cp,     setCp]     = useState('');
  const [showNp, setShowNp] = useState(false);
  const [fpErr,  setFpErr]  = useState(null);
  const [fpMsg,  setFpMsg]  = useState(null);
  const [fpLd,   setFpLd]   = useState(false);
  const [cd,     setCd]     = useState(0);

  useEffect(() => {
    if (cd <= 0) return;
    const t = setTimeout(() => setCd(c => c-1), 1000);
    return () => clearTimeout(t);
  }, [cd]);

  useEffect(() => {
    if (initialFlow === 'newpass') setOpen(true);
  }, [initialFlow]);

  async function doLogin(e) {
    e.preventDefault(); setLErr(null); setLLd(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password:pw });
    if (error) setLErr(error.message);
    setLLd(false);
  }

  async function doSendOtp(e) {
    e.preventDefault();
    if (!fpEm.trim()) { setFpErr('Enter your email.'); return; }
    setFpLd(true); setFpErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(fpEm, { redirectTo: window.location.origin });
    if (error) { setFpErr(error.message); setFpLd(false); return; }
    setFlow('otp'); setCd(60); setFpMsg('OTP sent to your email.');
    setFpLd(false);
  }

  async function doResend() {
    if (cd > 0) return;
    setFpLd(true); setFpErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(fpEm, { redirectTo: window.location.origin });
    if (error) setFpErr(error.message);
    else { setFpMsg('OTP resent.'); setCd(60); }
    setFpLd(false);
  }

  async function doVerify(e) {
    e.preventDefault();
    if (otp.length < 8) { setFpErr('Enter all 8 digits.'); return; }
    setFpLd(true); setFpErr(null);
    const { error } = await supabase.auth.verifyOtp({ email:fpEm, token:otp, type:'recovery' });
    if (error) { setFpErr('Invalid or expired OTP.'); setFpLd(false); return; }
    setFlow('newpass'); setFpMsg(null); setFpLd(false);
  }

  async function doSetPass(e) {
    e.preventDefault();
    if (np.length < 8) { setFpErr('Minimum 8 characters.'); return; }
    if (np !== cp)     { setFpErr('Passwords do not match.'); return; }
    setFpLd(true); setFpErr(null);
    const { error } = await supabase.auth.updateUser({ password:np });
    if (error) { setFpErr(error.message); setFpLd(false); return; }
    setFlow('login'); setFpMsg('Password updated. Sign in below.');
    setOtp(''); setNp(''); setCp('');
    setFpLd(false);
  }

  function reset() {
    setFlow('login'); setFpEm(''); setOtp('');
    setNp(''); setCp(''); setFpErr(null); setFpMsg(null);
  }
  function closePortal() { setOpen(false); reset(); }

  const btnP = {
    display:'block', width:'100%', background:'var(--gold)', border:'none',
    color:'var(--bg-page)', fontSize:'var(--btn-fs)', fontWeight:700,
    borderRadius:'var(--btn-radius)', padding:'var(--btn-py) 1rem',
    cursor:'pointer', fontFamily:F.display, letterSpacing:'0.12em',
    textTransform:'uppercase', transition:'background .2s',
    boxShadow:'0 4px 18px var(--gold-glow)',
  };

  const lnk = {
    background:'none', border:'none', cursor:'pointer',
    color:'var(--text-sub)', fontSize:'0.73rem', fontFamily:F.body,
    textDecoration:'underline', textUnderlineOffset:'3px',
    transition:'color .15s', padding:0,
  };

  const eyeBtn = {
    background:'none', border:'none', cursor:'pointer',
    fontSize:'0.95rem', color:'var(--text-muted)', padding:0, lineHeight:1,
  };

  const META = {
    login  : { title:'SIGN IN',        sub:'Enter credentials to access the portal' },
    forgot : { title:'RESET PASSWORD', sub:'Enter your registered email address'     },
    otp    : { title:'VERIFY OTP',     sub:`Code sent to ${fpEm}`                    },
    newpass: { title:'NEW PASSWORD',   sub:'Set a strong password — minimum 8 chars' },
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* PAGE WRAPPER */}
      <div style={{
        position:'relative', minHeight:'100dvh', width:'100%',
        background:`
          radial-gradient(ellipse at 12% 42%, var(--radial-1) 0%, transparent 52%),
          radial-gradient(ellipse at 88% 58%, var(--radial-2) 0%, transparent 52%),
          var(--bg-page)
        `,
        fontFamily:F.body, display:'flex', flexDirection:'column', transition:'background .3s',
      }}>

        {/* Star texture */}
        <div style={{
          position:'absolute', inset:0, zIndex:0, pointerEvents:'none',
          backgroundImage:`
            radial-gradient(1px 1px at 18% 22%, rgba(240,165,0,.28) 0%, transparent 100%),
            radial-gradient(1px 1px at 62% 74%, rgba(240,165,0,.18) 0%, transparent 100%),
            radial-gradient(1px 1px at 84% 16%, rgba(79,70,229,.22)  0%, transparent 100%)
          `,
          backgroundSize:'260px 260px, 340px 340px, 210px 210px',
          animation:'starDrift 70s linear infinite',
        }} />

        {/* ── TOP BAR ── */}
        <div style={{
          position:'relative', zIndex:10,
          height:'var(--topbar-h)', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 var(--topbar-px)',
          background:'var(--bg-topbar)',
          backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
          borderBottom:'1px solid var(--border-subtle)', transition:'background .3s',
        }}>
          {/* Left: NCC logo + unit text */}
          <div style={{ display:'flex', alignItems:'center', gap:'var(--topbar-gap)', minWidth:0 }}>
            <img src={nccLogo} alt="NCC" style={{
              height:'var(--ncc-logo-sz)', width:'var(--ncc-logo-sz)',
              objectFit:'contain', mixBlendMode:'var(--logo-blend)', flexShrink:0,
            }} />
            <div style={{ minWidth:0 }}>
              <p style={{
                margin:0, fontFamily:F.display,
                fontSize:'var(--unit-name-fs)',   /* ← change --unit-name-fs in :root to resize */
                fontWeight:700, color:'var(--text-unit)',
                letterSpacing:'0.08em', lineHeight:1.2,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                2(A) EME UNIT NCC
              </p>
              <p style={{
                margin:0, fontFamily:F.mono,
                fontSize:'var(--unit-sub-fs)',    /* ← change --unit-sub-fs in :root to resize */
                color:'var(--text-muted)',
                letterSpacing:'0.14em', textTransform:'uppercase',
                lineHeight:1, whiteSpace:'nowrap',
              }}>
                NBKR IST · Vidyanagar
              </p>
            </div>
          </div>
          {/* Right: theme toggle */}
          <ThemeToggle theme={theme} onChange={changeTheme} />
        </div>

        {/* ── BODY ── */}
        <div style={{
          position:'relative', zIndex:1, flex:1,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'var(--body-py) var(--body-px)',
          gap:'var(--body-gap)',              /* ← gap between ANO cluster and button */
        }}>

          {/* ANO SECTION */}
          <div style={{
            display:'flex', flexDirection:'column',
            alignItems:'center',
            gap:'var(--ano-gap)',             /* ← gap: photo / name / ANO label */
          }}>
            {/* Photo + ring */}
            <AnoCircle mini={false} />

            {/* Name */}
            <p style={{
              margin:0, fontFamily:F.display,
              fontSize:'var(--ano-name-fs)',  /* ← change --ano-name-fs in :root to resize */
              fontWeight:600, color:'var(--text-primary)',
              letterSpacing:'0.07em', textAlign:'center',
            }}>
              Lt. Dr. G. Madhavaiah
            </p>

            {/* ANO label */}
            <p style={{
              margin:0, fontFamily:F.mono,
              fontSize:'var(--ano-name-fs)',  /* same token as name — change together */
              color:'var(--gold)',
              letterSpacing:'0.22em',
              textTransform:'uppercase', textAlign:'center',
            }}>
              ANO
            </p>
          </div>

          {/* ACCESS PORTAL button — sits below ANO section, gap = --body-gap */}
          <button className="ncc-btn" onClick={() => setOpen(true)} style={{
            background:'var(--gold)', border:'none',
            color:'var(--bg-page)', fontFamily:F.display,
            fontSize:'var(--access-fs)',      /* ← change --access-fs in :root to resize */
            fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase',
            borderRadius:'var(--access-radius)',
            padding:'var(--access-py) var(--access-px)',
            cursor:'pointer', transition:'background .2s', whiteSpace:'nowrap',
            boxShadow:'0 0 22px var(--gold-glow), 0 4px 16px rgba(0,0,0,.3)',
          }}>
            ⬡ ACCESS PORTAL
          </button>
        </div>

        {/* ── POPUP OVERLAY ── */}
        {open && (
          <div onClick={e => { if (e.target === e.currentTarget) closePortal(); }} style={{
            position:'fixed', inset:0, zIndex:100,
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            padding:'var(--overlay-py) var(--overlay-px)',
            gap:'var(--overlay-gap)',
            background:'var(--bg-overlay)',
            backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
            animation:'overlayIn .32s ease', overflowY:'auto', transition:'background .3s',
          }}>

            {/* ANO MINI — above card */}
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              gap:'var(--ano-mini-gap)',
              animation:'popupIn .5s cubic-bezier(.34,1.56,.64,1)', flexShrink:0,
            }}>
              <AnoCircle mini={true} />
              <p style={{
                margin:0, fontFamily:F.display,
                fontSize:'var(--ano-mini-nfs)',
                fontWeight:600, color:'var(--text-primary)',
                letterSpacing:'0.06em', textAlign:'center',
              }}>
                Lt. Dr. G. Madhavaiah
              </p>
              <p style={{
                margin:0, fontFamily:F.mono,
                fontSize:'var(--ano-mini-nfs)',
                color:'var(--gold)', letterSpacing:'0.22em',
                textTransform:'uppercase', textAlign:'center',
              }}>
                ANO
              </p>
            </div>

            {/* CARD */}
            <div style={{
              width:'100%', maxWidth:'var(--card-maxw)',
              background:'var(--bg-card)',
              border:'1px solid var(--border-bright)',
              borderRadius:'var(--card-radius)',
              boxShadow:'0 0 50px var(--gold-glow), 0 28px 70px rgba(0,0,0,.52)',
              overflow:'hidden',
              animation:'popupIn .46s cubic-bezier(.34,1.56,.64,1)',
              flexShrink:0, transition:'background .3s, border-color .3s',
            }}>

              {/* Accent line */}
              <div style={{
                height:'var(--card-accent-h)',
                background:'linear-gradient(90deg, transparent 0%, var(--gold) 30%, var(--indigo-soft) 70%, transparent 100%)',
              }} />

              {/* Card Header */}
              <div style={{
                padding:`var(--card-py) var(--card-px) 0.8rem`,
                borderBottom:'1px solid var(--border-subtle)',
                display:'flex', justifyContent:'space-between', alignItems:'flex-start',
              }}>
                <div>
                  <h2 style={{
                    fontFamily:F.display, fontSize:'var(--card-title-fs)',
                    fontWeight:700, color:'var(--gold)',
                    letterSpacing:'0.1em', margin:'0 0 0.22rem', textTransform:'uppercase',
                  }}>{META[flow].title}</h2>
                  <p style={{
                    fontFamily:F.mono, fontSize:'var(--card-sub-fs)',
                    color:'var(--text-muted)', margin:0, letterSpacing:'0.04em',
                  }}>{META[flow].sub}</p>
                </div>
                {flow === 'login' && (
                  <button onClick={closePortal}
                    onMouseEnter={e => e.target.style.color='var(--gold)'}
                    onMouseLeave={e => e.target.style.color='var(--text-muted)'}
                    style={{
                      background:'none', border:'none', color:'var(--text-muted)',
                      fontSize:'1.3rem', cursor:'pointer', lineHeight:1,
                      padding:'0 0 0 0.5rem', flexShrink:0, transition:'color .15s',
                    }}>×</button>
                )}
              </div>

              {/* Card Body */}
              <div style={{ padding:'var(--card-py) var(--card-px)' }}>
                {flow === 'login' && fpMsg && (
                  <div style={{ marginBottom:'var(--field-gap)' }}>
                    <Alert type="success" msg={fpMsg} />
                  </div>
                )}

                {/* SIGN IN */}
                {flow === 'login' && (
                  <form onSubmit={doLogin} style={{ display:'flex', flexDirection:'column', gap:'var(--field-gap)' }}>
                    <Field label="Official Email">
                      <TInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
                    </Field>
                    <Field label="Password">
                      <TInput type={showPw?'text':'password'} value={pw} onChange={e => setPw(e.target.value)}
                        placeholder="••••••••"
                        right={<button type="button" onClick={() => setShowPw(v=>!v)} style={eyeBtn}>{showPw?'🙈':'👁'}</button>}
                      />
                    </Field>
                    <Alert type="error" msg={lErr} />
                    <button type="submit" disabled={lLd} className="ncc-btn" style={{ ...btnP, opacity:lLd?.7:1 }}>
                      {lLd ? 'Signing In…' : 'Sign In'}
                    </button>
                    <button type="button" className="ncc-link"
                      onClick={() => { setFlow('forgot'); setFpEm(email); setFpErr(null); }}
                      style={{ ...lnk, textAlign:'center' }}>
                      Forgot password?
                    </button>
                  </form>
                )}

                {/* FORGOT */}
                {flow === 'forgot' && (
                  <form onSubmit={doSendOtp} style={{ display:'flex', flexDirection:'column', gap:'var(--field-gap)' }}>
                    <Field label="Registered Email">
                      <TInput type="email" value={fpEm} onChange={e => setFpEm(e.target.value)} placeholder="your@email.com" />
                    </Field>
                    <Alert type="error" msg={fpErr} />
                    <button type="submit" disabled={fpLd} className="ncc-btn" style={{ ...btnP, opacity:fpLd?.7:1 }}>
                      {fpLd ? 'Sending…' : 'Send OTP'}
                    </button>
                    <button type="button" className="ncc-link" onClick={reset} style={{ ...lnk, textAlign:'center' }}>
                      ← Back to Sign In
                    </button>
                  </form>
                )}

                {/* OTP */}
                {flow === 'otp' && (
                  <form onSubmit={doVerify} style={{ display:'flex', flexDirection:'column', gap:'var(--field-gap)' }}>
                    {fpMsg && <Alert type="success" msg={fpMsg} />}
                    <OtpInput value={otp} onChange={setOtp} />
                    <Alert type="error" msg={fpErr} />
                    <button type="submit" disabled={fpLd||otp.length<8} className="ncc-btn"
                      style={{ ...btnP, opacity:(fpLd||otp.length<8)?.6:1 }}>
                      {fpLd ? 'Verifying…' : 'Verify OTP'}
                    </button>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <button type="button" className="ncc-link" onClick={() => setFlow('forgot')} style={lnk}>← Back</button>
                      <button type="button" className="ncc-link" onClick={doResend} disabled={cd>0}
                        style={{ ...lnk, color:cd>0?'var(--text-muted)':'var(--text-sub)', cursor:cd>0?'default':'pointer', textDecoration:cd>0?'none':'underline' }}>
                        {cd>0 ? `Resend in ${cd}s` : 'Resend OTP'}
                      </button>
                    </div>
                  </form>
                )}

                {/* NEW PASSWORD */}
                {flow === 'newpass' && (
                  <form onSubmit={doSetPass} style={{ display:'flex', flexDirection:'column', gap:'var(--field-gap)' }}>
                    <Field label="New Password">
                      <TInput type={showNp?'text':'password'} value={np} onChange={e => setNp(e.target.value)}
                        placeholder="Minimum 8 characters"
                        right={<button type="button" onClick={() => setShowNp(v=>!v)} style={eyeBtn}>{showNp?'🙈':'👁'}</button>}
                      />
                      <StrBar pw={np} />
                    </Field>
                    <Field label="Confirm Password">
                      <TInput type="password" value={cp} onChange={e => setCp(e.target.value)}
                        placeholder="Re-enter password"
                        overrideBorder={cp&&cp!==np?'var(--danger)':cp&&cp===np?'var(--success)':null}
                      />
                      {cp && cp!==np && (
                        <p style={{ margin:'0.22rem 0 0', fontSize:'0.6rem', color:'var(--danger)', fontFamily:F.mono }}>
                          Passwords do not match
                        </p>
                      )}
                    </Field>
                    <Alert type="error" msg={fpErr} />
                    <button type="submit" className="ncc-btn"
                      disabled={fpLd||np.length<8||np!==cp}
                      style={{ ...btnP, opacity:(fpLd||np.length<8||np!==cp)?.6:1 }}>
                      {fpLd ? 'Updating…' : 'Update Password'}
                    </button>
                  </form>
                )}
              </div>

              {/* Card Footer */}
              <div style={{
                padding:'var(--footer-py) var(--card-px)',
                borderTop:'1px solid var(--border-subtle)',
                textAlign:'center', transition:'border-color .3s',
              }}>
                <p style={{
                  fontFamily:F.mono, fontSize:'var(--footer-fs)',
                  color:'var(--text-muted)', letterSpacing:'0.12em', textTransform:'uppercase',
                }}>
                  एकता और अनुशासन &nbsp;·&nbsp; Unity &amp; Discipline
                </p>
              </div>

            </div>{/* end card */}
          </div>
        )}{/* end overlay */}

      </div>{/* end page wrapper */}
    </>
  );
}
