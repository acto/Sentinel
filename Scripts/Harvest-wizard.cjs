/**
 * Harvest-wizard.cjs
 * Browser-based intake wizard for the Harvest-read-jira agent.
 *
 * Flow:
 *   1. Always opens in Chrome.
 *   2. Shows a splash screen (light gray background, Harvest.png centered).
 *   3. Splash polls /ready; once the agent signals /instructions-ready the
 *      splash navigates to /wizard where the user enters a Jira issue key.
 *   4. On submit: writes $TEMP/jira-wizard-answers.json, logs RESULT:bevestigd.
 *   5. Shows a /working spinner while the agent fetches Jira data.
 *   6. Renders /summary when the agent writes $TEMP/jira-summary.md.
 *   7. User confirms or cancels; writes $TEMP/jira-action.txt accordingly.
 *
 * Stdout signals (read by agent via get_terminal_output):
 *   RESULT:bevestigd   — user submitted a valid Jira key
 *   RESULT:cancelled   — user cancelled
 *   CONFIRMED:ok       — user accepted the summary
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const cp   = require('child_process');
const path = require('path');

const PORT         = 3133;
const TEMP         = process.env.TEMP || require('os').tmpdir();
const WORKSPACE    = path.resolve(__dirname, '..');
const SPLASH_STANDARD_PATH = path.join(WORKSPACE, 'Scripts', 'splashscreen-standard.json');

const SPLASH_STANDARD_DEFAULTS = {
  durationMs: 5000,
  backgroundColor: '#faf8ec',
  logoBlendMode: 'darken',
  logoBackgroundColor: 'transparent',
  cornerBlendMode: 'multiply',
  cornerBackgroundColor: '#faf8ec',
  cornerWidthPx: 112,
  cornerMaxWidthVw: 14,
  cornerOpacity: 1,
  cornerFilter: 'contrast(1.04) saturate(1.03)',
  imagesFolderName: 'Sentinel',
  mainImageCandidates: ['Harvest.png', 'harvest.png', 'Sentinel.png'],
  cornerImageCandidates: ['AI generated.jpg', 'AI generated.png', 'AI generated - dark.png']
};

function loadSplashStandard() {
  try {
    const loaded = JSON.parse(fs.readFileSync(SPLASH_STANDARD_PATH, 'utf8'));
    return Object.assign({}, SPLASH_STANDARD_DEFAULTS, loaded || {});
  } catch (_) {
    return SPLASH_STANDARD_DEFAULTS;
  }
}

const SPLASH_STANDARD = loadSplashStandard();
const JIRA_LOGO = 'data:image/png;base64,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';
const answersPath  = path.join(TEMP, 'jira-wizard-answers.json');
const actionPath   = path.join(TEMP, 'jira-action.txt');
const summaryPath  = path.join(TEMP, 'jira-summary.md');
const warningPath  = path.join(TEMP, 'jira-existing-warning.json');
const fetchedPath      = path.join(TEMP, 'jira-fetched.json');
const dorCheckPath = path.join(TEMP, 'jira-dor-check.json');
const testabilityCheckPath = path.join(TEMP, 'jira-testability-check.json');
const redirectHtml = path.join(TEMP, 'Harvest-wizard-redirect.html');
const chromeProfileDir = path.join(TEMP, 'SentinelChrome', 'Harvest');

// IMPORTANT: each terminal/shell session on this machine may resolve process.env.TEMP
// to a different session-specific subfolder (e.g. Temp\2, Temp\7, ...). The agent MUST
// write all state files (jira-summary.md, jira-fetched.json, jira-dor-check.json,
// jira-testability-check.json, jira-wizard-answers.json) to THIS exact path — never
// assume TEMP resolved in another terminal is the same directory.
console.log('TEMP=' + TEMP);

// Route all crash output to stdout so the agent can detect it.
process.on('uncaughtException', function(e) {
  console.log('CRASH:', e && (e.stack || e.message));
  process.exit(1);
});

// Kill any stale process holding the port.
try {
  cp.execSync(
    'for /f "tokens=5" %a in (\'netstat -ano ^| findstr " :' + PORT + ' "\') do taskkill /f /pid %a',
    { shell: 'cmd.exe', stdio: 'ignore' }
  );
} catch (_) {}

// ---------------------------------------------------------------------------
// Splash image — prefer Pictures\Sentinel\Harvest.png, fallback to first image in folder
// ---------------------------------------------------------------------------
const splashImagesDir = path.join(process.env.USERPROFILE || '', 'Pictures', SPLASH_STANDARD.imagesFolderName);
const splashImageCandidates = SPLASH_STANDARD.mainImageCandidates;
const splashCornerImageCandidates = SPLASH_STANDARD.cornerImageCandidates;

function buildDataUrlFromFile(filePath) {
  if (!filePath) {
    return '';
  }

  try {
    const imgBuf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp'
      : ext === '.gif' ? 'image/gif'
      : 'image/png';
    return 'data:' + mime + ';base64,' + imgBuf.toString('base64');
  } catch (_) {
    return '';
  }
}

function resolveSplashImagePath() {
  for (const name of splashImageCandidates) {
    const candidatePath = path.join(splashImagesDir, name);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  try {
    const files = fs.readdirSync(splashImagesDir);
    const firstImage = files.find(function(fileName) {
      return /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    });
    if (firstImage) {
      return path.join(splashImagesDir, firstImage);
    }
  } catch (_) {}

  return '';
}

const splashImgPath = resolveSplashImagePath();
const splashImgSrc = buildDataUrlFromFile(splashImgPath);

function resolveSplashCornerImagePath() {
  for (const name of splashCornerImageCandidates) {
    const candidatePath = path.join(splashImagesDir, name);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return '';
}

const splashCornerImgPath = resolveSplashCornerImagePath();
const splashCornerImgSrc = buildDataUrlFromFile(splashCornerImgPath);

// Acto logo (used in summary page header)
// ---------------------------------------------------------------------------
const LOGO = 'data:image/png;base64,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';

// ---------------------------------------------------------------------------
// Open Chrome (always Chrome, never the default browser)
// ---------------------------------------------------------------------------
function openChrome(url) {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];

  // Close only prior Harvest wizard browser sessions (profile-isolated),
  // so a new run starts with one clear window.
  try {
    const ps = "$p='" + chromeProfileDir.replace(/'/g, "''") + "';"
      + "Get-CimInstance Win32_Process -Filter \"name = 'chrome.exe'\" | "
      + "Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) } | "
      + "ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }";
    cp.spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
  } catch (_) {}
  // Reset the dedicated profile between runs to avoid Chrome session-restore warnings.
  try { fs.rmSync(chromeProfileDir, { recursive: true, force: true }); } catch (_) {}
  try { fs.mkdirSync(chromeProfileDir, { recursive: true }); } catch (_) {}

  // Write a tiny redirect page so Chrome opens the local server URL.
  const redirectContent = '<!DOCTYPE html><html><head>'
    + '<meta http-equiv="refresh" content="0; url=' + url + '">'
    + '</head><body></body></html>';
  fs.writeFileSync(redirectHtml, redirectContent, 'utf8');

  const fileUrl = 'file:///' + redirectHtml.replace(/\\/g, '/');

  let launched = false;
  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      cp.exec('"' + chromePath + '" --user-data-dir="' + chromeProfileDir + '" --new-window --start-maximized --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble "' + fileUrl + '"');
      launched = true;
      break;
    }
  }
  if (!launched) {
    // Last-resort fallback: rely on `chrome` being in PATH.
    cp.exec('start "" /max chrome --user-data-dir="' + chromeProfileDir + '" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble "' + fileUrl + '"');
  }

  // Bring the Chrome window to front after it has had time to open.
  setTimeout(function() {
    cp.exec(
      'powershell -NoProfile -NonInteractive -Command "'
      + 'Add-Type -AssemblyName Microsoft.VisualBasic;'
      + 'try{[Microsoft.VisualBasic.Interaction]::AppActivate(\'chrome\')}catch{}"'
    );
  }, 2000);
}

// ---------------------------------------------------------------------------
// Shared CSS
// ---------------------------------------------------------------------------
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#ebebeb;color:#1a1a1a;min-height:100vh}

/* Card / form */
.card{background:#fff;border:1px solid #dde;border-radius:12px;padding:32px 40px;
  width:100%;max-width:520px;margin-top:40px}
.page-title{font-size:.8rem;font-weight:700;color:#0052cc;text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:8px}
h1{font-size:1.3rem;color:#1a1a1a;margin-bottom:24px;font-weight:600}
label{display:block;font-size:.82rem;font-weight:600;color:#555;
  text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
input[type=text]{width:100%;padding:10px 14px;font-size:1rem;border:2px solid #dde;
  border-radius:8px;font-family:inherit;outline:none;transition:border-color .15s;
  text-transform:uppercase;letter-spacing:.05em}
input[type=text]:focus{border-color:#0052cc}
.hint{font-size:.82rem;color:#888;margin-top:6px}
.error{font-size:.82rem;color:#c0392b;margin-top:8px;display:none}
.actions{display:flex;gap:12px;margin-top:28px;align-items:center}
.btn{padding:10px 24px;background:#0052cc;color:#fff;border:none;border-radius:8px;
  font-family:inherit;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s}
.btn:hover{background:#0041a8}
.btn:disabled{background:#aac;cursor:not-allowed}
.btn-cancel{background:#c8c8c8;color:#333}
.btn-cancel:hover{background:#b0b0b0}
/* Center wrapper for wizard pages */
.page-wrap{display:flex;flex-direction:column;align-items:center;padding:24px}

/* Working / summary pages */
.working{display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:60vh;gap:16px;text-align:center}
.working h2{color:#0052cc;font-size:1.2rem}
.working p{color:#666;font-size:.9rem}
.summary-wrap{max-width:800px;width:100%;margin:32px auto;padding:0 24px 100px}
.summary-wrap h1{font-size:1.4rem;color:#0052cc;margin:24px 0 8px}
.summary-wrap h2{font-size:1rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;color:#555;margin:20px 0 6px;padding-bottom:4px;
  border-bottom:1px solid #eee}
.summary-wrap p{line-height:1.7;margin-bottom:8px;white-space:pre-wrap}
.summary-wrap ul{padding-left:20px;margin-bottom:8px}
.summary-wrap li{line-height:1.7}
.summary-footer{position:fixed;bottom:0;left:0;right:0;background:#ebebeb;
  border-top:1px solid #dde;padding:12px 24px;display:flex;gap:12px;justify-content:center}

/* Splash */
.splash{position:fixed;inset:0;background:${SPLASH_STANDARD.backgroundColor};display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:24px;isolation:isolate}
.splash-logo{position:absolute;top:16px;left:24px;height:48px;width:auto;
  mix-blend-mode:${SPLASH_STANDARD.logoBlendMode};background:${SPLASH_STANDARD.logoBackgroundColor};border-radius:0;padding:0}
.splash-img{max-width:360px;max-height:360px;width:auto;height:auto;
  object-fit:contain;border-radius:12px}
.splash-corner{position:absolute;right:24px;bottom:18px;display:flex;align-items:flex-end}
.splash-corner-img{width:${SPLASH_STANDARD.cornerWidthPx}px;max-width:${SPLASH_STANDARD.cornerMaxWidthVw}vw;height:auto;object-fit:contain;
  mix-blend-mode:${SPLASH_STANDARD.cornerBlendMode};background:${SPLASH_STANDARD.cornerBackgroundColor};border-radius:0;padding:0;opacity:${SPLASH_STANDARD.cornerOpacity};filter:${SPLASH_STANDARD.cornerFilter}}
.splash-placeholder{width:180px;height:180px;background:#dde;border-radius:50%;
  display:flex;align-items:center;justify-content:center;color:#aaa;font-size:.9rem}
.splash-footer{display:flex;flex-direction:column;align-items:center;gap:10px}
.splash-title{font-size:1.1rem;font-weight:600;color:#0052cc}
.splash-sub{font-size:.88rem;color:#999}
.spinner{width:36px;height:36px;border:4px solid #dde;border-top-color:#0052cc;
  border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;

// ---------------------------------------------------------------------------
// Minimal markdown → HTML
// ---------------------------------------------------------------------------
function mdToHtml(md) {
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    return s;
  }
  const lines = md.split('\n');
  let out = '', inUl = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (inUl) { out += '</ul>\n'; inUl = false; } continue; }
    if (/^#{1,2} /.test(t)) {
      if (inUl) { out += '</ul>\n'; inUl = false; }
      const m = t.match(/^(#{1,2}) (.+)$/);
      out += '<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>\n';
      continue;
    }
    if (/^[-*] /.test(t)) {
      if (!inUl) { out += '<ul>\n'; inUl = true; }
      out += '<li>' + inline(t.slice(2)) + '</li>\n';
      continue;
    }
    if (inUl) { out += '</ul>\n'; inUl = false; }
    out += '<p>' + inline(t) + '</p>\n';
  }
  if (inUl) out += '</ul>\n';
  return out;
}



// ---------------------------------------------------------------------------

// Summary page CSS -- matches wizard-serve.cjs visual style

// ---------------------------------------------------------------------------

const SUMMARY_CSS = `

*{box-sizing:border-box}

body{font-family:Segoe UI,sans-serif;max-width:860px;margin:0 auto;padding:0 24px 100px;color:#1a1a1a;background:#ebebeb;overflow-y:auto}

h2{font-size:.9rem;color:#555;margin-top:28px;text-transform:uppercase;letter-spacing:.06em}

.top-header{display:flex;align-items:center;padding:16px 0 12px;margin-bottom:28px;border-bottom:2px solid #0052cc;position:sticky;top:0;background:#ebebeb;z-index:50}

.issue-header{display:flex;flex-direction:column;gap:4px}

.issue-title{font-size:1.3rem;color:#0052cc;margin:0;font-weight:600}

.logo{height:auto;max-height:80px;width:auto;margin-right:16px;flex-shrink:0}

.badge{display:inline-block;background:#e3efff;color:#0052cc;border-radius:4px;padding:2px 10px;font-size:.85rem;font-weight:600;margin-bottom:4px;align-self:flex-start}

.h-item{display:flex;align-items:baseline;gap:10px;padding:8px 14px;background:#fff;border:1px solid #dde;border-radius:6px;margin-bottom:6px}

.h-label{font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#888;min-width:160px}

.h-value{font-weight:600;color:#0052cc}

p{line-height:1.65;margin-bottom:8px}

ul{padding-left:20px;margin-bottom:8px}

li{line-height:1.7}

.empty{color:#999;font-style:italic}

details.collapsible-section{margin:16px 0;border:1px solid #dde;border-radius:8px;background:#fff;padding:0}

details.collapsible-section summary{cursor:pointer;padding:12px 16px;user-select:none;list-style:none;display:flex;align-items:center;font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#555}

details.collapsible-section summary::-webkit-details-marker{display:none}

details.collapsible-section summary::before{content:"▶";font-size:.8rem;margin-right:10px;color:#0052cc;transition:transform .2s}

details.collapsible-section[open] summary::before{transform:rotate(90deg)}

details.collapsible-section .section-body{padding:0 16px 16px}

.actions{position:fixed;bottom:0;left:0;right:0;background:#ebebeb;border-top:1px solid #dde;padding:12px 24px;display:flex;gap:12px;justify-content:center}

.btn{padding:10px 22px;background:#0052cc;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:.95rem;cursor:pointer;font-weight:600}

.btn:hover{background:#0041a8}

.btn:disabled{background:#aac;cursor:not-allowed}

.btn-cancel{background:#c8c8c8;color:#333}

.btn-cancel:hover{background:#b0b0b0}

`;

// ---------------------------------------------------------------------------

// HTML escape helper (for summary page)

// ---------------------------------------------------------------------------

function escHtml(s) {

  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

}



// ---------------------------------------------------------------------------

// Rich markdown -> HTML for the summary page (sections, h-items, collapsible)

// ---------------------------------------------------------------------------

function mdToHtmlSummary(md) {

  function inline(s) {

    s = escHtml(s);

    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    return s;

  }



  // Parse into sections by ## headings (h1 is shown in the page header)

  var sections = [];

  var cur = null;

  md.split('\n').forEach(function(raw) {

    var t = raw.trim();

    if (/^# /.test(t)) return;

    if (/^## /.test(t)) {

      if (cur) sections.push(cur);

      cur = { heading: t.replace(/^## /, '').trim(), lines: [] };

      return;

    }

    if (cur) { cur.lines.push(raw); }

    else if (t) {

      if (!sections.length || sections[sections.length - 1].heading !== null) {

        sections.push({ heading: null, lines: [] });

      }

      sections[sections.length - 1].lines.push(raw);

    }

  });

  if (cur) sections.push(cur);



  function renderLines(lines) {

    var out = '', inUl = false;

    lines.forEach(function(raw) {

      var t = raw.trim();

      if (!t) { if (inUl) { out += '</ul>\n'; inUl = false; } return; }

      if (/^[-*] /.test(t)) {

        if (!inUl) { out += '<ul>\n'; inUl = true; }

        out += '<li>' + inline(t.slice(2)) + '</li>\n';

        return;

      }

      if (inUl) { out += '</ul>\n'; inUl = false; }

      out += '<p>' + inline(t) + '</p>\n';

    });

    if (inUl) out += '</ul>\n';

    return out;

  }



  function renderStatusLines(lines) {

    // "**Key:** Value | **Key2:** Value2" -> .h-item rows

    var content = lines.map(function(l) { return l.trim(); }).filter(Boolean).join(' ');

    var parts = content.split(/\s*\|\s*/);

    var out = '';

    parts.forEach(function(part) {

      var m = part.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);

      if (m) {

        out += '<div class="h-item"><span class="h-label">' + escHtml(m[1]) + '</span>'

             + '<span class="h-value">' + escHtml(m[2].trim()) + '</span></div>\n';

      } else if (part.trim()) {

        out += '<p>' + inline(part) + '</p>\n';

      }

    });

    return out || '<span class="empty">Geen statusinfo.</span>';

  }



  var html = '';

  sections.forEach(function(sec) {

    if (sec.heading === null) {

      html += renderLines(sec.lines);

    } else if (/^status$/i.test(sec.heading)) {

      html += '<div style="margin:16px 0">' + renderStatusLines(sec.lines) + '</div>\n';

    } else {

      var isOpen = !/gerelateerde/i.test(sec.heading);
      html += '<details class="collapsible-section"' + (isOpen ? ' open' : '') + '>\n'

            + '<summary>' + escHtml(sec.heading) + '</summary>\n'

            + '<div class="section-body">' + renderLines(sec.lines) + '</div>\n'

            + '</details>\n';

    }

  });

  return html || '<span class="empty">Geen inhoud gevonden.</span>';

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

// ---------------------------------------------------------------------------
// Request body reader
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise(function(resolve) {
    let data = '';
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function() { resolve(data); });
  });
}

function parseForm(body) {
  const params = {};
  for (const pair of body.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = decodeURIComponent(pair.slice(0, idx));
    const v = decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    params[k] = v;
  }
  return params;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let instructionsReady = false;

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async function(req, res) {
  const url = (req.url || '/').split('?')[0];

  // ── Splash ──────────────────────────────────────────────────────────────
  if (url === '/' || url === '/splash') {
    const imgHtml = splashImgSrc
      ? '<img src="' + splashImgSrc + '" class="splash-img" alt="Harvest">'
      : '<div class="splash-placeholder">Harvest</div>';
    const cornerImgHtml = splashCornerImgSrc
      ? '<div class="splash-corner"><img src="' + splashCornerImgSrc + '" class="splash-corner-img" alt="AI generated"></div>'
      : '';

    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><meta name="google" content="notranslate">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div class="splash">'
      + '<img src="' + LOGO + '" class="splash-logo" alt="Acto">'
      + imgHtml
      + cornerImgHtml
      + '<div class="splash-footer">'
      + '<div class="spinner"></div>'
      + '<div class="splash-title">Harvest wordt geladen\u2026</div>'
      + '<div class="splash-sub">Even geduld\u2026</div>'
      + '</div>'
      + '</div>'
      + '<script>setTimeout(function(){location.href="/wizard";},' + SPLASH_STANDARD.durationMs + ');<\/script>'
      + '</body></html>';

    return send(res, 200, 'text/html', html);
  }

  // ── Agent signals instruction files are loaded ───────────────────────────
  if (url === '/instructions-ready' && req.method === 'POST') {
    instructionsReady = true;
    res.writeHead(200); res.end('ok');
    return;
  }

  // ── Polled by splash to know when to navigate to /wizard ────────────────
  if (url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: instructionsReady }));
    return;
  }

  // ── Wizard form ─────────────────────────────────────────────────────────
  if (url === '/wizard') {
    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><meta name="google" content="notranslate">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div class="page-wrap">'
      + '<div class="card">'
      + '<div class="page-title">Jira issue ophalen</div>'
      + '<h1>Wat is het Jira nummer?</h1>'
      + '<form id="f" action="/submit" method="POST" novalidate>'
      + '<input type="text" id="jiraKey" name="jiraKey" placeholder="bijv. RB-1234"'
      + ' autocomplete="off" autofocus spellcheck="false" required>'
      + '<div class="error" id="err-required">Dit veld is verplicht. Vul een Jira-issuenummer in.</div>'
      + '<div class="error" id="err-format">Ongeldig formaat. Gebruik bijv. RB-1234 (letters gevolgd door een koppelteken en cijfers).</div>'
      + '<div class="actions">'
      + '<button type="submit" class="btn" id="sub" style="display:none">Volgende &#8594;</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '</form>'
      + '</div>'
      + '</div>'
      + '<script>'
      + 'var KEY_RE=/^[A-Z]{2,}-\\d+$/;'
      // Force uppercase and normalize dash as user types
      + 'var inp=document.getElementById("jiraKey");'
      + 'var sub=document.getElementById("sub");'
      + 'function updateNextVisibility(){'
      + '  var v=inp.value.trim();'
      + '  sub.style.display=KEY_RE.test(v)?"inline-flex":"none";'
      + '}'
      + 'function normalizeKey(v){'
      + '  v=v.toUpperCase();'
      + '  v=v.replace(/^([A-Z]+)-?(\\d+)$/,"$1-$2");'
      + '  return v;'
      + '}'
      + 'inp.addEventListener("input",function(){'
      + '  var pos=this.selectionStart;'
      + '  var norm=normalizeKey(this.value);'
      + '  var added=norm.length-this.value.length;'
      + '  this.value=norm;'
      + '  this.setSelectionRange(pos+added,pos+added);'
      + '  updateNextVisibility();'
      + '});'
      + 'inp.addEventListener("keydown",function(e){'
      + '  if(e.key==="Enter"){e.preventDefault();}'
      + '});'
      // Validate on submit
      + 'updateNextVisibility();'
      + 'document.getElementById("f").addEventListener("submit",function(e){'
      + '  var v=inp.value.trim();'
      + '  inp.value=v;'
      + '  document.getElementById("err-required").style.display="none";'
      + '  document.getElementById("err-format").style.display="none";'
      + '  if(v===""){e.preventDefault();document.getElementById("err-required").style.display="block";inp.focus();return;}'
      + '  if(!KEY_RE.test(v)){e.preventDefault();document.getElementById("err-format").style.display="block";inp.focus();return;}'
      + '  document.getElementById("sub").disabled=true;'
      + '  document.getElementById("sub").textContent="Bezig\u2026";'
      + '});'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Form submit ──────────────────────────────────────────────────────────
  if (url === '/submit' && req.method === 'POST') {
    const body = await readBody(req);
    const params = parseForm(body);
    const jiraKey = (params.jiraKey || '').trim().toUpperCase().replace(/^([A-Z]+)-?(\d+)$/, '$1-$2');

    if (!/^[A-Z]{2,}-\d+$/.test(jiraKey)) {
      res.writeHead(302, { Location: '/wizard' }); res.end();
      return;
    }

    const answers = { jiraKey: jiraKey };
    fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');
    fs.writeFileSync(actionPath, '', 'utf8');

    // Clear any stale summary and DoR check from a previous run so /working waits for fresh data
    if (fs.existsSync(fetchedPath))          fs.unlinkSync(fetchedPath);
    if (fs.existsSync(summaryPath))          fs.unlinkSync(summaryPath);
    if (fs.existsSync(dorCheckPath))         fs.unlinkSync(dorCheckPath);
    if (fs.existsSync(testabilityCheckPath)) fs.unlinkSync(testabilityCheckPath);

    console.log('RESULT:bevestigd');

    // Check immediately if a harvest file already exists for this key
    const harvestFile = path.join(WORKSPACE, '01-Harvest-Jira-Summaries', 'Harvest-' + jiraKey + '.md');
    if (fs.existsSync(harvestFile)) {
      fs.writeFileSync(warningPath, JSON.stringify({ jiraKey: jiraKey }), 'utf8');
      res.writeHead(302, { Location: '/existing-warning' }); res.end();
    } else {
      try { if (fs.existsSync(warningPath)) fs.unlinkSync(warningPath); } catch(_){}
      res.writeHead(302, { Location: '/working' }); res.end();
    }
    return;
  }

  // ── Working — progress bar while agent fetches Jira data ──────────────
  if (url === '/working') {
    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.watermark{position:fixed;bottom:24px;right:24px;width:180px;opacity:0.08;pointer-events:none;z-index:0;}'
      + '.progress-wrap{width:100%;max-width:420px;margin:20px 0 6px;}'
      + '.progress-track{width:100%;height:10px;background:#dde3f0;border-radius:6px;overflow:hidden;}'
      + '.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#0052cc,#2684ff);'
      + 'border-radius:6px;transition:width 0.4s ease;}'
      + '.progress-pct{font-size:.85rem;color:#0052cc;font-weight:600;margin-top:6px;text-align:right;}'
      + '<\/style>'
      + '</head><body>'
      + '<img src="' + JIRA_LOGO + '" alt="" class="watermark" aria-hidden="true">'
      + '<div class="working">'
      + '<h2 id="status-text">Jira-gegevens worden opgehaald\u2026</h2>'
      + '<div class="progress-wrap">'
      + '  <div class="progress-track"><div class="progress-fill" id="pbar"></div></div>'
      + '  <div class="progress-pct" id="pct">0%</div>'
      + '</div>'
      + '<p>Even geduld</p>'
      + '<div id="stuck-help" style="display:none;margin-top:18px;padding:12px 16px;'
      + 'background:#fff8e6;border:1px solid #f0d98c;border-radius:8px;font-size:.88rem;color:#6b5400;">'
      + 'Dit duurt langer dan verwacht. De achtergrondverwerking loopt mogelijk nog door.&nbsp; '
      + '<a href="javascript:location.reload()">Vernieuwen</a>'
      + '</div>'
      + '</div>'
      + '<script>'
      // Progress animation — fast approach to 60%, then slow crawl to 99%, snaps to 100% when ready
      + 'var pv=0;'
      + 'var pb=document.getElementById("pbar");'
      + 'var pt=document.getElementById("pct");'
      + 'function setP(v){'
      + '  pv=v;'
      + '  pb.style.width=v.toFixed(1)+"%";'
      + '  pt.textContent=Math.round(v)+"%";'
      + '}'
      + 'function advance(){'
      + '  if(pv<99){'
      + '    var step=pv<60?Math.max((60-pv)*0.04,0.15):0.1;'
      + '    setP(Math.min(pv+step,99));'
      + '  }'
      + '  setTimeout(advance,350);'
      + '}'
      + 'advance();'
      + 'var statusEl=document.getElementById("status-text");'
      + 'function setStatus(t){if(statusEl)statusEl.textContent=t;}'
      // If no progress/state-change is observed within ~60s, show a manual recovery option
      // instead of spinning silently forever (this is the safeguard for the "stuck on
      // working page" class of bug — even if the underlying cause recurs, the user always
      // gets a visible, actionable way out).
      + 'var phaseStart=Date.now();'
      + 'var phase="waiting";'
      + 'function setPhase(next){if(next!==phase){phase=next;phaseStart=Date.now();}}'
      + 'function poll(){'
      + '  fetch("/status-all?ts="+Date.now(),{cache:"no-store"}).then(function(r){return r.json();})'
      + '  .then(function(d){'
      + '    if(d.summary){setP(100);setTimeout(function(){location.href="/summary";},400);return;}'
      + '    else if(d.testability){setPhase("testability");setStatus("Samenvatting wordt opgesteld\u2026");}'
      + '    else if(d.dor){setPhase("dor");setStatus("Testbaarheid controleren\u2026");}'
      + '    else if(d.fetched){setPhase("fetched");setStatus("Jira-gegevens analyseren\u2026");}'
      + '    else{setPhase("waiting");setStatus("Jira-gegevens worden opgehaald\u2026");}'
      + '    if(phase==="waiting" && Date.now()-phaseStart>120000){'
      + '      var h=document.getElementById("stuck-help");if(h)h.style.display="block";'
      + '    }'
      + '    setTimeout(poll,1000);'
      + '  }).catch(function(){'
      + '    if(Date.now()-phaseStart>120000){'
      + '      var h=document.getElementById("stuck-help");if(h)h.style.display="block";'
      + '    }'
      + '    setTimeout(poll,2000);'
      + '  });'
      + '}'
      + 'setTimeout(poll,800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Polled by /working to detect when jira-dor-check.json is written ───────
  if (url === '/dor-ready') {
    const ready = fs.existsSync(dorCheckPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── Polled by /working to detect when jira-testability-check.json is written ──
  if (url === '/testability-ready') {
    const ready = fs.existsSync(testabilityCheckPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── DoR check — renders jira-dor-check.json as a checklist ───────────────
  if (url === '/dor-check') {
    var dorData = { items: [], allPassed: false };
    try { dorData = JSON.parse(fs.readFileSync(dorCheckPath, 'utf8')); } catch (_) {
      res.writeHead(302, { Location: '/working' }); res.end(); return;
    }

    var iconMap = { ok: '&#10003;', warning: '&#9888;', fail: '&#10007;' };
    var colorMap = { ok: '#36b37e', warning: '#ff991f', fail: '#de350b' };
    var bgMap    = { ok: '#f0faf4', warning: '#fffbe6', fail: '#fff0ee' };

    var itemsHtml = '';
    (dorData.items || []).forEach(function(item) {
      var st = item.status || 'warning';
      var icon = iconMap[st] || '?';
      var color = colorMap[st] || '#888';
      var bg = bgMap[st] || '#fff';
      itemsHtml += '<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;'
        + 'background:' + bg + ';border:1px solid #dde;border-left:4px solid ' + color + ';'
        + 'border-radius:8px;margin-bottom:10px;">'
        + '<span style="font-size:1.3rem;color:' + color + ';flex-shrink:0;margin-top:1px;">' + icon + '</span>'
        + '<div><div style="font-weight:700;color:#1a1a1a;margin-bottom:3px;">'
        + escHtml(item.labelNl || item.label || '') + '</div>'
        + '<div style="color:#555;font-size:.9rem;">' + escHtml(item.notes || '') + '</div>'
        + '</div></div>\n';
    });

    var warningBanner = '';
    if (!dorData.allPassed) {
      warningBanner = '<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#7c5914;font-size:.9rem;">'
        + '&#9888;&nbsp; Niet alle DoR-criteria zijn aantoonbaar vervuld. '
        + 'Je kunt toch doorgaan, maar wees je bewust van de risico\'s.</div>';
    }

    var logoHtml = '<img src="' + LOGO + '" class="logo" alt="Logo" style="height:auto;max-height:60px;width:auto;margin-right:16px;">';
    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">' + logoHtml
      + '<div class="issue-header">'
      + '<span class="issue-title">Definition of Ready \u2014 Controle</span>'
      + '</div></div>'
      + '<div style="padding:8px 0 100px">'
      + warningBanner
      + itemsHtml
      + '</div>'
      + '<div class="actions">'
      + '<button class="btn" id="btnOk" onclick="bevestig()">Doorgaan &#8594;</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '<script>'
      + 'function bevestig(){'
      + '  document.getElementById("btnOk").disabled=true;'
      + '  document.getElementById("btnOk").textContent="Bezig\u2026";'
      + '  fetch("/confirm-dor",{method:"POST"}).then(function(){location.href="/working-summary";});'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── User acknowledges DoR check ───────────────────────────────────────────
  if (url === '/confirm-dor' && req.method === 'POST') {
    console.log('RESULT:dor-ok');
    res.writeHead(200); res.end('ok');
    return;
  }

  // ── Working-summary — progress bar while agent builds summary ────────────
  if (url === '/working-summary') {
    const html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.watermark{position:fixed;bottom:24px;right:24px;width:180px;opacity:0.08;pointer-events:none;z-index:0;}'
      + '.progress-wrap{width:100%;max-width:420px;margin:20px 0 6px;}'
      + '.progress-track{width:100%;height:10px;background:#dde3f0;border-radius:6px;overflow:hidden;}'
      + '.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#0052cc,#2684ff);'
      + 'border-radius:6px;transition:width 0.4s ease;}'
      + '.progress-pct{font-size:.85rem;color:#0052cc;font-weight:600;margin-top:6px;text-align:right;}'
      + '<\/style>'
      + '</head><body>'
      + '<img src="' + JIRA_LOGO + '" alt="" class="watermark" aria-hidden="true">'
      + '<div class="working">'
      + '<h2 id="status-text">Samenvatting wordt opgesteld\u2026</h2>'
      + '<div class="progress-wrap">'
      + '  <div class="progress-track"><div class="progress-fill" id="pbar"></div></div>'
      + '  <div class="progress-pct" id="pct">0%</div>'
      + '</div>'
      + '<p>Even geduld</p>'
      + '</div>'
      + '<script>'
      + 'var pv=0;'
      + 'var pb=document.getElementById("pbar");'
      + 'var pt=document.getElementById("pct");'
      + 'function setP(v){'
      + '  pv=v;'
      + '  pb.style.width=v.toFixed(1)+"%";'
      + '  pt.textContent=Math.round(v)+"%";'
      + '}'
      + 'function advance(){'
      + '  if(pv<92){'
      + '    var step=Math.max((92-pv)*0.025,0.08);'
      + '    setP(Math.min(pv+step,92));'
      + '  }'
      + '  setTimeout(advance,350);'
      + '}'
      + 'advance();'
      + 'function poll(){'
      + '  fetch("/summary-ready?ts="+Date.now(),{cache:"no-store"}).then(function(r){return r.json();})'
      + '  .then(function(d){'
      + '    if(d.ready){setP(100);setTimeout(function(){location.href="/summary";},400);}'
      + '    else{setTimeout(poll,1000);}'
      + '  })'
      + '  .catch(function(){setTimeout(poll,2000);});'
      + '}'
      + 'setTimeout(poll,800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Polled by /working to detect when jira-summary.md is written ─────────
  if (url === '/summary-ready') {
    const ready = fs.existsSync(summaryPath);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({ ready: ready }));
    return;
  }

  // ── Single-request status check (replaces 3 separate /dor-ready, /testability-ready, /summary-ready calls) ──
  if (url === '/status-all') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(JSON.stringify({
      fetched:     fs.existsSync(fetchedPath),
      dor:         fs.existsSync(dorCheckPath),
      testability: fs.existsSync(testabilityCheckPath),
      summary:     fs.existsSync(summaryPath)
    }));
    return;
  }

  // ── Summary — renders jira-summary.md ────────────────────────────────────
  if (url === '/summary') {
    let md = '';
    try { md = fs.readFileSync(summaryPath, 'utf8'); } catch (_) {
      res.writeHead(302, { Location: '/working' }); res.end(); return;
    }

    // Extract issue key and title from first H1 line (e.g. "# RB-5656 — Titel")
    var titleMatch = md.match(/^#\s+(.+)$/m);
    var fullTitle  = titleMatch ? titleMatch[1].trim() : 'Jira Samenvatting';
    var keyMatch   = fullTitle.match(/^([A-Z]+-\d+)/);
    var issueKey   = keyMatch ? keyMatch[1] : '';
    var issueTitle = keyMatch
      ? fullTitle.replace(issueKey, '').replace(/^\s*[\u2014\-]\s*/, '').trim()
      : fullTitle;

    var logoHtml = '<img src="' + LOGO + '" class="logo" alt="Logo">';
    var bodyHtml = mdToHtmlSummary(md);

    // Unchanged banner — shown if the Analyse section states nothing changed since the last harvest
    var unchangedBanner = '';
    var unchangedMatch = md.match(/Geen wijzigingen vastgesteld sinds de vorige harvest op ([^.\n]+)\./);
    if (unchangedMatch) {
      unchangedBanner = '<div style="background:#f0faf4;border:1px solid #b7ebc6;border-radius:8px;'
        + 'padding:12px 16px;margin-bottom:20px;color:#1f6f43;font-size:.9rem;">'
        + '&#10003;&nbsp; Geen wijzigingen vastgesteld sinds de vorige harvest op ' + escHtml(unchangedMatch[1]) + '.</div>';
    }

    // DoR warning — fail-safe: also warn when check data is missing/unreadable.
    var dorWarningHtml = '';
    var dorKnown = false;
    var dorFailed = true;
    try {
      var dorData = JSON.parse(fs.readFileSync(dorCheckPath, 'utf8'));
      dorKnown = true;
      dorFailed = !dorData.allPassed;
    } catch (_) {}
    if (dorFailed) {
      dorWarningHtml = '<div style="background:#fff0ee;border-left:5px solid #de350b;'
        + 'border-radius:6px;padding:14px 18px;margin-bottom:24px;">'
        + '<strong style="color:#de350b;font-size:1rem;">'
        + '⚠️&nbsp; Dit item voldoet niet aan alle DoR/DoD-criteria. '
        + 'Controleer de vereisten voordat je verdergaat met het opstellen van testscripts.'
        + '</strong>'
        + (!dorKnown ? '<div style="margin-top:8px;color:#6b778c;font-size:.88rem;">DoR/DoD-statusbestand ontbreekt; waarschuwing wordt uit voorzorg getoond.</div>' : '')
        + '</div>';
    }

    // Testability warning — fail-safe: also warn when check data is missing/unreadable.
    var testabilityWarningHtml = '';
    var testabilityKnown = false;
    var testabilityFailed = true;
    try {
      var testData = JSON.parse(fs.readFileSync(testabilityCheckPath, 'utf8'));
      testabilityKnown = true;
      testabilityFailed = !testData.isTestable;
    } catch (_) {}
    if (testabilityFailed) {
      testabilityWarningHtml = '<div style="background:#fff0ee;border-left:5px solid #de350b;'
        + 'border-radius:6px;padding:14px 18px;margin-bottom:24px;">'
        + '<strong style="color:#de350b;font-size:1rem;">'
        + '⚠️&nbsp; Dit item is (nog) niet testbaar. '
        + 'Er is onvoldoende informatie beschikbaar om testscenario&#39;s op te stellen.'
        + '</strong>'
        + (!testabilityKnown ? '<div style="margin-top:8px;color:#6b778c;font-size:.88rem;">Testability-statusbestand ontbreekt; waarschuwing wordt uit voorzorg getoond.</div>' : '')
        + '</div>';
    }

    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + SUMMARY_CSS + '</style></head><body>'
      + '<div class="top-header">'
      + logoHtml
      + '<div class="issue-header">'
      + (issueKey ? '<span class="badge">' + escHtml(issueKey) + '</span>' : '')
      + '<span class="issue-title">' + escHtml(issueTitle) + '</span>'
      + '</div>'
      + '</div>'
      + unchangedBanner
      + dorWarningHtml
      + testabilityWarningHtml
      + bodyHtml
      + '<div class="actions">'
      + '<button class="btn" id="btnOk" onclick="bevestig()">Bevestigen</button>'
      + '<button type="button" class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '<script>'
      + 'function bevestig(){'
      + '  document.getElementById("btnOk").disabled=true;'
      + '  document.getElementById("btnOk").textContent="Bezig\u2026";'
      + '  fetch("/bevestigen").then(function(){'
      + '    document.body.innerHTML=\'<div style="text-align:center;padding:80px 24px">\'+'
      + '\'<h2 style="color:#0052cc">Samenvatting bevestigd!</h2>\'+'
      + '\'<p style="color:#666">Harvest is afgerond. Je kunt nu terug naar VS Code.</p></div>\';'
      + '  });'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── User confirms the summary ─────────────────────────────────────────────
  if (url === '/bevestigen') {
    fs.writeFileSync(actionPath, 'bevestigd', 'utf8');

    // Re-write answers JSON with the harvest file path for downstream use.
    let answers = {};
    try { answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')); } catch (_) {}
    const confirmedKey = answers.jiraKey || '';
    if (confirmedKey) {
      answers.harvestFile = path.join(WORKSPACE, '01-Harvest-Jira-Summaries', 'Harvest-' + confirmedKey + '.md');
      fs.writeFileSync(answersPath, JSON.stringify(answers, null, 2), 'utf8');
    }

    console.log('CONFIRMED:ok');

    res.writeHead(200); res.end('ok');
    return;
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  if (url === '/cancel') {
    fs.writeFileSync(actionPath, 'cancelled', 'utf8');
    try { if (fs.existsSync(warningPath)) fs.unlinkSync(warningPath); } catch(_){}
    console.log('RESULT:cancelled');

    // Close the Chrome window from the server side after a short delay,
    // so the browser has time to render the farewell page first.
    setTimeout(function() {
      cp.exec(
        'powershell -NoProfile -NonInteractive -Command "'
        + 'Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force"'
      );
    }, 1200);

    const html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">'
      + '<style>' + CSS + '</style></head><body>'
      + '<div style="text-align:center;padding:80px 24px">'
      + '<h2 style="color:#0052cc;margin-bottom:12px">Sessie be&euml;indigd</h2>'
      + '<p style="color:#666">Het proces is gestopt. Dit venster wordt gesloten.</p>'
      + '</div>'
      // JS close attempts — belt-and-suspenders
      + '<script>'
      + 'function tryClose(){'
      + '  try{window.open("","_self","");window.close();}catch(_){}'
      + '  try{window.close();}catch(_){}'
      + '}'
      + 'setTimeout(tryClose, 800);'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Existing-check — polled by /working to detect overwrite warning ──────
  if (url === '/existing-check') {
    var warn = false; var wKey = '';
    if (fs.existsSync(warningPath)) {
      try { var w = JSON.parse(fs.readFileSync(warningPath,'utf8')); wKey = w.jiraKey||''; warn=true; } catch(_){}
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({warn:warn,jiraKey:wKey}));
    return;
  }

  // ── Existing-warning — Dutch confirmation page ─────────────────────────
  if (url === '/existing-warning') {
    var wJiraKey = ''; var wHarvestedAt = '';
    try { var wf = JSON.parse(fs.readFileSync(warningPath,'utf8')); wJiraKey = wf.jiraKey||''; wHarvestedAt = wf.harvestedAt||''; } catch(_){}
    var harvestDateStr = '';
    if (wHarvestedAt) {
      try {
        var d = new Date(wHarvestedAt);
        harvestDateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
          + ' om ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      } catch(_) {}
    }
    var html = '<!DOCTYPE html><html lang="nl" translate="no"><head>'
      + '<meta charset="UTF-8"><style>' + CSS + '</style>'
      + '<style>'
      + '.warn-box{max-width:520px;margin:80px auto;padding:32px 28px;background:#fff;border-radius:10px;'
      + 'box-shadow:0 2px 16px rgba(0,0,0,.12);text-align:center;}'
      + '.warn-box h2{color:#0052cc;margin:0 0 16px;}'
      + '.warn-box p{color:#444;margin:0 0 12px;line-height:1.5;}'
      + '.warn-key{display:inline-block;background:#e8f0fe;color:#0052cc;font-weight:700;'
      + 'padding:3px 10px;border-radius:4px;font-size:1rem;margin:0 4px;}'
      + '.warn-date{font-size:.85rem;color:#888;margin:4px 0 16px;}'
      + '.warn-actions{display:flex;gap:12px;justify-content:center;margin-top:24px;}'
      + '<\/style>'
      + '</head><body>'
      + '<div class="warn-box">'
      + '<h2>Bestaand bestand gevonden</h2>'
      + '<p>Er bestaat al een samenvatting voor <span class="warn-key">' + escHtml(wJiraKey) + '</span>.</p>'
      + (harvestDateStr ? '<p class="warn-date">Laatste harvest: ' + escHtml(harvestDateStr) + '</p>' : '')
      + '<p>Wil je doorgaan en de samenvatting bijwerken met de laatste Jira-gegevens?</p>'
      + '<div class="warn-actions">'
      + '<button class="btn" id="btnJa" onclick="doorgaan()">Bijwerken</button>'
      + '<button class="btn btn-cancel" onclick="location.href=\'/cancel\'">Annuleren</button>'
      + '</div>'
      + '</div>'
      + '<script>'
      + 'function doorgaan(){'
      + '  document.getElementById("btnJa").disabled=true;'
      + '  document.getElementById("btnJa").textContent="Bezig\u2026";'
      + '  fetch("/confirm-overwrite",{method:"POST"})'
      + '  .then(function(){location.href="/working";});'
      + '}'
      + '<\/script>'
      + '</body></html>';
    return send(res, 200, 'text/html', html);
  }

  // ── Confirm overwrite — user chose Ja ──────────────────────────────────
  if (url === '/confirm-overwrite' && req.method === 'POST') {
    try { fs.unlinkSync(warningPath); } catch(_){}
    console.log('RESULT:doorgaan');
    res.writeHead(200); res.end('ok');
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  console.log('Wizard listening on http://127.0.0.1:' + PORT);
  openChrome('http://127.0.0.1:' + PORT + '/splash');
});
