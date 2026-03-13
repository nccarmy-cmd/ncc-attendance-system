/* ============================================================
   NBKRIST NCC — Cadets Records System
   Launch Page Script
   Password is hashed — NEVER stored in plaintext
   ============================================================ */

/* ── UNIT CONFIGURATION ─────────────────────────────────────
   Change values here. Password is stored as SHA-256 hash.
   To change password: go to https://emn178.github.io/online-tools/sha256.html
   type your new password and paste the hash into ANO_PASS_HASH below.
   ──────────────────────────────────────────────────────────── */
const UNIT = {
  name        : "2(A) EME UNIT NCC NBKRIST",
  college     : "NBKRIST, Vidyanagar",
  established : "2017",
  initialCount: "10",
  currentCount: "104",
  ano         : "Lt Dr G. Madhavaiah",
  anoDesig    : "Associate NCC Officer",
  developer   : "SGT M. Nanda Kishore",
  devBatch    : "Batch 07 · 2023–2026",
  appVersion  : "v1.0.9",
  apkUrl      : "https://github.com/nccarmy-cmd/ncc-attendance-system/releases/download/v1.0.0/EME-NCC-Unit-v1.0.9.apk",
  webUrl      : "https://ists-projects.vercel.app",

  // ── LOGIN (change these) ──
  ANO_USER      : "ano",
  // SHA-256 hash of "2ame@ncc2024"
  // To change password: hash your new password at https://emn178.github.io/online-tools/sha256.html
  ANO_PASS_HASH : "e23f5eb174be21df42b806a0dfa2bebe6413aa3a5e5990e3381d6d3f428e8d8e",
};

/* ── SHA-256 via Web Crypto API (native browser, no library) ─ */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Fill all config text into DOM ──────────────────────────── */
function fillConfig() {
  const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const h = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

  // Login gate
  s('lg-unit', UNIT.name);

  // Header bar
  s('tb-unit', UNIT.name);
  s('tb-version', UNIT.appVersion);

  // Hero stage
  s('hs-est', UNIT.established);
  s('hs-count', UNIT.currentCount);
  s('hs-initial', UNIT.initialCount);
  s('ano-name', UNIT.ano);
  s('ano-desig', UNIT.anoDesig);

  // Sentences
  h('s1', `The <strong>${UNIT.name}</strong>, Vidyanagar was established in ${UNIT.established}, with a founding strength of <strong>${UNIT.initialCount} cadets</strong>.`);
  h('s2', `Under the guidance of <strong>${UNIT.ano}</strong>, ${UNIT.anoDesig} — the unit has grown to a strength of <strong>${UNIT.currentCount} cadets</strong> across SD and SW divisions.`);
  h('s3', `The Cadets Records System brings parade management, attendance tracking, permission monitoring, and unit reporting into a single platform — built exclusively for <strong>${UNIT.name}</strong> cadets.`);
  h('s4', `<span class="gold">★</span>&nbsp; <strong>${UNIT.developer}</strong> &nbsp;·&nbsp; ${UNIT.devBatch}`);

  // Deployed stage
  s('dep-ver', `Version ${UNIT.appVersion} · ${UNIT.college}`);

  // Poster
  s('pt-unit', UNIT.name);
  s('pt-college', UNIT.college);
  s('pt-ver', `Version ${UNIT.appVersion}`);
  s('pt-dev', UNIT.developer);
  s('pt-batch', UNIT.devBatch);
  s('pt-foot', `${UNIT.name} · ${UNIT.college} · ${UNIT.appVersion}`);

  // Notice card
  s('nc-unit', UNIT.name);
  s('nc-college', UNIT.college);
  s('nc-dev', UNIT.developer);
  s('nc-batch', UNIT.devBatch);
  s('nc-ver', UNIT.appVersion);
}

/* ── LOGIN ───────────────────────────────────────────────────── */
let loginLocked = false;
let loginAttempts = 0;

async function attemptLogin() {
  if (loginLocked) return;

  const uEl  = document.getElementById('lg-user');
  const pEl  = document.getElementById('lg-pass');
  const errEl = document.getElementById('lg-error');
  const btn   = document.getElementById('lg-btn');

  const user = uEl.value.trim();
  const pass = pEl.value;

  if (!user || !pass) {
    showLoginError('⚠ Enter credentials to proceed');
    return;
  }

  btn.disabled = true;
  btn.querySelector('span').textContent = 'VERIFYING...';

  const hash = await sha256(pass);

  if (user === UNIT.ANO_USER && hash === UNIT.ANO_PASS_HASH) {
    // Success
    errEl.textContent = '';
    const gate = document.getElementById('login-gate');
    gate.style.transition = 'opacity 0.5s ease';
    gate.style.opacity = '0';
    setTimeout(() => {
      gate.style.display = 'none';
      document.getElementById('main-page').classList.add('visible');
      startBriefing();
    }, 500);
  } else {
    loginAttempts++;
    pEl.value = '';
    btn.disabled = false;
    btn.querySelector('span').textContent = 'AUTHENTICATE';

    if (loginAttempts >= 3) {
      loginLocked = true;
      showLoginError('✗ Too many attempts. Wait 30 seconds.');
      btn.disabled = true;
      setTimeout(() => {
        loginLocked = false;
        loginAttempts = 0;
        btn.disabled = false;
        errEl.textContent = '';
      }, 30000);
    } else {
      showLoginError(`✗ Invalid credentials. ${3 - loginAttempts} attempt(s) remaining.`);
      // Shake animation
      const box = document.querySelector('.login-box');
      box.style.animation = 'none';
      box.offsetHeight;
      box.style.animation = 'shakeBox 0.4s ease';
    }
  }
}

function showLoginError(msg) {
  const errEl = document.getElementById('lg-error');
  errEl.textContent = msg;
}

// ── STAGE 1 — BRIEFING ──────────────────────────────────────
function startBriefing() {
  // Play description audio
  playAudio('./launch-assets/description.mp3');

  // Pop sentences in sequence
  const ids = ['s1', 's2', 's3', 's4'];
  ids.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('visible');
    }, i * 1500 + 400);
  });
}

// ── LAUNCH: go to countdown ──────────────────────────────────
function initiateLaunch() {
  document.getElementById('stage-hero').style.display = 'none';
  const cd = document.getElementById('stage-countdown');
  cd.classList.add('active');
  playAudio('./launch-assets/countdown.mp3');
  runCountdown(5);
}

function runCountdown(n) {
  const numEl = document.getElementById('cd-num');
  numEl.textContent = n;

  // Re-trigger animation
  numEl.style.animation = 'none';
  numEl.offsetHeight;
  numEl.style.animation = 'countIn 0.7s cubic-bezier(0.16,1,0.3,1)';

  if (n <= 0) {
    setTimeout(doTriFlash, 300);
    return;
  }

  setTimeout(() => runCountdown(n - 1), 1000);
}

function doTriFlash() {
  const flash = document.getElementById('triflash');
  const cd    = document.getElementById('stage-countdown');

  flash.classList.add('active');

  setTimeout(() => {
    cd.classList.remove('active');
    flash.classList.remove('active');
    showDeployed();
  }, 920);
}

// ── STAGE 3 — DEPLOYED ──────────────────────────────────────
let qrDone = false;

function showDeployed() {
  const dep = document.getElementById('stage-deployed');
  dep.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (!qrDone) {
    genQR('qr-apk',        UNIT.apkUrl, '#002147', '#ffffff');
    genQR('qr-web',        UNIT.webUrl, '#002147', '#ffffff');
    genQR('poster-qr-apk', UNIT.apkUrl, '#002147', '#0b1220');
    genQR('poster-qr-web', UNIT.webUrl, '#002147', '#0b1220');
    genQR('notice-qr-apk', UNIT.apkUrl, '#002147', '#ffffff');
    genQR('notice-qr-web', UNIT.webUrl, '#002147', '#ffffff');
    qrDone = true;
  }
}

function genQR(containerId, text, dark, light) {
  const el = document.getElementById(containerId);
  if (!el || typeof QRCode === 'undefined') return;
  el.innerHTML = '';
  const size = parseInt(el.style.width) || 168;
  new QRCode(el, {
    text,
    width : size,
    height: size,
    colorDark : dark  || '#000000',
    colorLight: light || '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

// ── AUDIO (silent fail) ───────────────────────────────────────
function playAudio(src) {
  try {
    const a = new Audio(src);
    a.play().catch(() => {});
  } catch (e) {}
}

// ── SAVE POSTER ───────────────────────────────────────────────
async function savePoster() {
  const btn = event.currentTarget;
  btn.disabled = true;
  const orig = btn.querySelector('span').textContent;
  btn.querySelector('span').textContent = 'GENERATING...';

  try {
    const el = document.getElementById('poster-target');
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#04080f',
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `NBKRIST-NCC-CRS-Poster-${UNIT.appVersion}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    alert('Poster generation failed. Try again.');
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = orig;
}

// ── SAVE NOTICE CARD ──────────────────────────────────────────
async function saveNotice() {
  const btn = event.currentTarget;
  btn.disabled = true;
  const orig = btn.querySelector('span').textContent;
  btn.querySelector('span').textContent = 'GENERATING...';

  try {
    const el = document.getElementById('notice-target');
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `NBKRIST-NCC-CRS-Notice-${UNIT.appVersion}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch(e) {
    alert('Notice card generation failed. Try again.');
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = orig;
}

// ── KEYBOARD BINDINGS ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  fillConfig();

  document.getElementById('lg-user').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('lg-pass').focus();
  });

  document.getElementById('lg-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptLogin();
  });
});
