const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OVERLAYS_DIR = path.resolve('output/overlays_2min');
fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

const SCENES_META = [
  {
    id: "01",
    slogan: "ONE PLATFORM. 563 MINDS.",
    title: "BRAND HOOK • INSTITUTIONAL CREST",
    tamil: "563 மாணவர்களின் எதிர்காலம் • ஒரு கிளிக் கண்காணிப்பு",
    badge: "[01/23]",
    progress: 4.3,
    callout: "AUTONOMOUS CODING ANALYTICS"
  },
  {
    id: "02",
    slogan: "SEAMLESS ACCESS. ZERO FRICTION.",
    title: "ENTERPRISE SSO • 563 STUDENTS CONNECTED",
    tamil: null,
    badge: "[02/23]",
    progress: 8.6,
    callout: "FACULTY & ADMIN SECURE AUTHENTICATION"
  },
  {
    id: "03",
    slogan: "EXECUTIVE COMMAND. REAL-TIME DATA.",
    title: "COMMAND CENTER • 15+ LIVE KPIS",
    tamil: null,
    badge: "[03/23]",
    progress: 13.0,
    callout: "LIVE SOLVES • HOURLY TRAJECTORY TRACKING"
  },
  {
    id: "04",
    slogan: "EVERY SOLVE. VERIFIED & TRACKED.",
    title: "STUDENT DIRECTORY • 563 PROFILES",
    tamil: null,
    badge: "[04/23]",
    progress: 17.5,
    callout: "INSTANT SEARCH • REAL LEETCODE RANKS"
  },
  {
    id: "05",
    slogan: "6-AXIS RADAR. RATING 1526.",
    title: "STUDENT 360 • INDIVIDUAL DOSSIER",
    tamil: null,
    badge: "[05/23]",
    progress: 22.0,
    callout: "★ VERIFIED RATING: 1526 • 6-AXIS DSA MASTERY"
  },
  {
    id: "06",
    slogan: "CSE • IT • AI&DS • BENCHMARKED.",
    title: "DEPARTMENT MATRIX • COHORT TIERS",
    tamil: null,
    badge: "[06/23]",
    progress: 26.5,
    callout: "INTER-DEPARTMENTAL PERFORMANCE METRICS"
  },
  {
    id: "07",
    slogan: "STRATEGIC OVERSIGHT. ACTIONABLE LEVERS.",
    title: "HOD DECK • INTERVENTION TARGETS",
    tamil: null,
    badge: "[07/23]",
    progress: 31.0,
    callout: "AT-RISK STUDENT EARLY ALERT SYSTEM"
  },
  {
    id: "08",
    slogan: "HEAD-TO-HEAD. CODING DUELS.",
    title: "VERSUS ARENA • SKILL SHOWDOWN",
    tamil: null,
    badge: "[08/23]",
    progress: 35.5,
    callout: "⚡ 1V1 PEER COMPARISON & SKILL MATRIX"
  },
  {
    id: "09",
    slogan: "CONTEST TELEMETRY. ZERO MISSING SOLVES.",
    title: "WEEKLY CONTESTS • Q1–Q4 ANALYSIS",
    tamil: null,
    badge: "[09/23]",
    progress: 40.0,
    callout: "ATTENDANCE RECONCILIATION & SOLVE TIMESTAMPS"
  },
  {
    id: "10",
    slogan: "ZERO CHEATING. TOTAL TRUST.",
    title: "INTEGRITY MONITOR • FORENSIC SCANNER",
    tamil: null,
    badge: "[10/23]",
    progress: 44.5,
    callout: "🛡️ FORENSIC DUAL-ID AUDIT • ZERO TAMPERING"
  },
  {
    id: "11",
    slogan: "VELOCITY ENGINE. EXPONENTIAL GAINS.",
    title: "GROWTH ENGINE • 7D / 30D DELTAS",
    tamil: null,
    badge: "[11/23]",
    progress: 49.0,
    callout: "MOMENTUM TRACKING • EASY/MED/HARD SOLVE SURGE"
  },
  {
    id: "12",
    slogan: "HEALTH CHECKS. AUTO-REPAIRED.",
    title: "DATA QUALITY • ANOMALY SHIELD",
    tamil: null,
    badge: "[12/23]",
    progress: 53.5,
    callout: "✓ 100% VERIFIED PROFILES • ZERO BROKEN IDS"
  },
  {
    id: "13",
    slogan: "NIGHT OWLS. RELENTLESS GRIND.",
    title: "AFTER-HOURS • NIGHT OWL DISCIPLINE",
    tamil: null,
    badge: "[13/23]",
    progress: 58.0,
    callout: "🌙 POST 9:30 PM TELEMETRY • CONSISTENT GRIND"
  },
  {
    id: "14",
    slogan: "FIND TOP TALENT. ZERO HASSLE.",
    title: "RECRUITER FINDER • RECRUITMENT CRM",
    tamil: null,
    badge: "[14/23]",
    progress: 62.5,
    callout: "🎯 ONE-CLICK FILTERING: RATING > 1500 + 200+ SOLVES"
  },
  {
    id: "15",
    slogan: "TARGETED MENTORING. INSTANT DISPATCH.",
    title: "FACULTY HUB • MENTORSHIP QUEUE",
    tamil: null,
    badge: "[15/23]",
    progress: 67.0,
    callout: "DATA-DRIVEN FACULTY ADVISORY INTERVENTIONS"
  },
  {
    id: "16",
    slogan: "AI THAT NEVER SLEEPS. 24/7.",
    title: "AUTONOMOUS AI • CONTEST SCHEDULER",
    tamil: null,
    badge: "[16/23]",
    progress: 71.5,
    callout: "⚙️ 24/7 BACKGROUND CRON SYNC & DATA PIPELINE"
  },
  {
    id: "17",
    slogan: "99.9% UPTIME. 12MS LATENCY.",
    title: "SYSTEM TELEMETRY • LIVE CLUSTER",
    tamil: null,
    badge: "[17/23]",
    progress: 76.0,
    callout: "ENTERPRISE SCALABILITY • FASTAPI HIGH CONCURRENCY"
  },
  {
    id: "18",
    slogan: "IMMUTABLE AUDIT. TAMPER-PROOF TRAIL.",
    title: "AUDIT TRAIL • FORENSIC LOGS",
    tamil: null,
    badge: "[18/23]",
    progress: 80.5,
    callout: "🔒 COMPLETE INSTITUTIONAL ACCOUNTABILITY"
  },
  {
    id: "19",
    slogan: "ONE-CLICK EXCEL. AUDIT READY.",
    title: "REPORTS HUB • ACCREDITATION EXPORTS",
    tamil: null,
    badge: "[19/23]",
    progress: 85.0,
    callout: "📊 NBA/NAAC COMPLIANT CONTEST WORKBOOKS"
  },
  {
    id: "20",
    slogan: "ONE-CLICK FIX. INSTANT SYNC.",
    title: "RESOLUTION ENGINE • PROFILE REPAIR",
    tamil: null,
    badge: "[20/23]",
    progress: 89.5,
    callout: "AUTOMATED SELF-HEALING DATA RECONCILIATION"
  },
  {
    id: "21",
    slogan: "ENTERPRISE POLICY. TOTAL CONTROL.",
    title: "SYSTEM SETTINGS • ACCESS CONTROL",
    tamil: null,
    badge: "[21/23]",
    progress: 94.0,
    callout: "ROLE-BASED GOVERNANCE & CONTEST THRESHOLDS"
  },
  {
    id: "22",
    slogan: "CAMPUS HALL OF FAME. RANK #1.",
    title: "KIOSK DISPLAY • LEADERBOARD STAGE",
    tamil: null,
    badge: "[22/23]",
    progress: 98.0,
    callout: "🏆 PUBLIC AUDITORIUM & LOBBY LIVE DISPLAY"
  },
  {
    id: "23",
    slogan: "LEARN • SERVE • SUCCEED.",
    title: "NANDHA ENGINEERING COLLEGE • ERODE",
    tamil: "நந்தா பொறியியல் கல்லூரி • கற்போம் • சாதிப்போம் • வெல்வோம்",
    badge: "[23/23]",
    progress: 100.0,
    callout: "AUTONOMOUS INSTITUTIONAL EXCELLENCE"
  }
];

function generateHtml(meta) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;600;700;800&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: transparent;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #FFFFFF;
      position: relative;
    }

    /* Cyber Corner Reticles */
    .hud-corner {
      position: absolute;
      font-family: 'Inter', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: rgba(56, 189, 248, 0.65);
      display: flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      z-index: 40;
    }
    .hud-tl { top: 12px; left: 24px; }
    .hud-tr { top: 12px; right: 24px; }
    .hud-bl { bottom: 12px; left: 24px; }
    .hud-br { bottom: 12px; right: 24px; }

    .crosshair {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-left: 2px solid #38bdf8;
      border-top: 2px solid #38bdf8;
    }

    /* Top Kinetic Typography Slogan */
    .slogan-container {
      position: absolute;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      z-index: 50;
      text-align: center;
    }

    .slogan-box {
      background: rgba(3, 7, 18, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 9999px;
      padding: 7px 28px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 18px rgba(56, 189, 248, 0.25);
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .slogan-text {
      font-family: 'Montserrat', sans-serif;
      font-size: 21px;
      font-weight: 900;
      letter-spacing: 1px;
      background: linear-gradient(135deg, #FFFFFF 0%, #38bdf8 50%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 20px rgba(56, 189, 248, 0.35);
    }

    .tamil-text {
      font-family: 'Nirmala UI', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #fbbf24;
      background: rgba(15, 23, 42, 0.9);
      padding: 3px 16px;
      border-radius: 9999px;
      border: 1px solid rgba(251, 191, 36, 0.45);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      letter-spacing: 0.4px;
    }

    /* Callout Badge (Top Sub-Anchor) */
    .callout-badge {
      position: absolute;
      top: 66px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      color: #94a3b8;
      background: rgba(15, 23, 42, 0.75);
      padding: 3px 14px;
      border-radius: 9999px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      z-index: 45;
    }

    /* Modern Bottom Glassmorphism Lower-Third Pill */
    .lower-third {
      position: absolute;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      width: 980px;
      background: rgba(3, 7, 18, 0.90);
      border: 1px solid rgba(56, 189, 248, 0.5);
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(56, 189, 248, 0.25);
      border-radius: 20px;
      padding: 10px 24px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      z-index: 50;
      backdrop-filter: blur(18px);
    }

    .pill-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .left-side {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .scene-badge {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 9999px;
      box-shadow: 0 0 12px rgba(14, 165, 233, 0.6);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      background: #38bdf8;
      border-radius: 50%;
      box-shadow: 0 0 8px #38bdf8;
    }

    .scene-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #F8FAFC;
    }

    .right-tag {
      font-family: 'Inter', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 3px 10px;
      border-radius: 9999px;
    }

    /* Overall Timeline Progress Bar */
    .progress-track {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      width: ${meta.progress}%;
      background: linear-gradient(90deg, #38bdf8, #818cf8, #fbbf24);
      box-shadow: 0 0 8px #38bdf8;
      border-radius: 9999px;
    }
  </style>
</head>
<body>
  <!-- HUD Corners -->
  <div class="hud-corner hud-tl"><span class="crosshair"></span> SYS: LIVE TELEMETRY // 563 COHORTS</div>
  <div class="hud-corner hud-tr">LATENCY: 12ms // UPTIME: 99.9% <span class="crosshair" style="transform: rotate(90deg);"></span></div>
  <div class="hud-corner hud-bl"><span class="crosshair" style="transform: rotate(270deg);"></span> NANDHA ENGINEERING COLLEGE</div>
  <div class="hud-corner hud-br">AUTONOMOUS ENGINE v2.8 <span class="crosshair" style="transform: rotate(180deg);"></span></div>

  <!-- Slogan & Header -->
  <div class="slogan-container">
    <div class="slogan-box">
      <span class="slogan-text">${meta.slogan}</span>
    </div>
    ${meta.tamil ? `<div class="tamil-text">${meta.tamil}</div>` : ''}
  </div>

  <div class="callout-badge">${meta.callout}</div>

  <!-- Lower Third Progress Bar -->
  <div class="lower-third">
    <div class="pill-content">
      <div class="left-side">
        <div class="scene-badge"><span class="pulse-dot"></span> ${meta.badge}</div>
        <div class="scene-title">${meta.title}</div>
      </div>
      <div class="right-tag">REC 1080P</div>
    </div>
    <div class="progress-track">
      <div class="progress-fill"></div>
    </div>
  </div>
</body>
</html>`;
}

async function renderAll() {
  console.log(`[START] Re-rendering 23 Ultra-Polished Cinematic Overlays into ${OVERLAYS_DIR}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  for (const meta of SCENES_META) {
    const html = generateHtml(meta);
    await page.setContent(html, { waitUntil: 'load' });
    const outPath = path.join(OVERLAYS_DIR, `overlay_${meta.id}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
  }

  await browser.close();
  console.log('[SUCCESS] All 23 Ultra-Polished Cinematic Overlays Generated!');
}

renderAll().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
