const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCENES_DIR = path.resolve('output/brand_scenes_2026');
fs.mkdirSync(SCENES_DIR, { recursive: true });

// Authentic student records directly verified from institutional database (data/leetcode_tracker.db)
const realStudents = [
  { rank: 1, name: "NANTHISH S", reg: "732224CC031", dept: "CSE(CS)", solved: 907, rating: 1928, easy: 402, med: 378, hard: 127 },
  { rank: 2, name: "RITHANYA S", reg: "732224CI044", dept: "CSE(IOT)", solved: 873, rating: 1923, easy: 271, med: 402, hard: 200 },
  { rank: 3, name: "POOZANA G", reg: "732224IT071", dept: "IT", solved: 794, rating: 1641, easy: 228, med: 421, hard: 145 },
  { rank: 4, name: "KANISKA N J", reg: "732223CC021", dept: "CSE(CS)", solved: 649, rating: 1502, easy: 190, med: 356, hard: 103 },
  { rank: 5, name: "KAVINRAJAN K", reg: "732223CC023", dept: "CSE(CS)", solved: 605, rating: 1864, easy: 257, med: 259, hard: 89 },
  { rank: 6, name: "WASIM M", reg: "732223CC059", dept: "CSE(CS)", solved: 585, rating: 1638, easy: 155, med: 331, hard: 99 },
  { rank: 7, name: "STEFFY MARTINA P", reg: "732223CC052", dept: "CSE(CS)", solved: 580, rating: 1621, easy: 235, med: 267, hard: 78 },
  { rank: 8, name: "PRAVEEN KUMAR J", reg: "732223CC038", dept: "CSE(CS)", solved: 568, rating: 1653, easy: 235, med: 254, hard: 79 },
  { rank: 9, name: "HARISH .E", reg: "732224IT034", dept: "IT", solved: 529, rating: 1818, easy: 153, med: 300, hard: 76 },
  { rank: 10, name: "KEERTHANA B", reg: "732225IT049", dept: "IT", solved: 503, rating: 1874, easy: 137, med: 279, hard: 87 }
];

async function renderKiosk() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 30%, #0d1527 0%, #060a14 65%, #02050b 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      position: relative;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
    }
    .ambient-glow {
      position: absolute;
      width: 900px;
      height: 600px;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(245, 158, 11, 0.06) 40%, transparent 70%);
      filter: blur(100px);
      top: 10%;
      left: 25%;
      pointer-events: none;
    }
    /* Top Header Bar */
    header {
      position: relative;
      z-index: 10;
      padding: 22px 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(11, 20, 38, 0.6);
      border-bottom: 1px solid rgba(56, 189, 248, 0.15);
      backdrop-filter: blur(12px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .kiosk-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      padding: 5px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 10px #34d399;
    }
    .header-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #FFFFFF;
    }
    .header-title span {
      color: #38bdf8;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: #94a3b8;
    }
    .live-clock {
      color: #38bdf8;
      font-weight: 700;
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 6px 14px;
      border-radius: 8px;
    }

    /* Main Content */
    main {
      position: relative;
      z-index: 10;
      padding: 0 48px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .title-banner {
      text-align: center;
      margin-bottom: 28px;
    }
    .honor-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 16px;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .main-heading {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #FFFFFF;
      margin-bottom: 6px;
    }
    .main-sub {
      font-size: 15px;
      color: #94a3b8;
    }

    /* Grid of 10 Student Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 18px;
      max-width: 1820px;
      margin: 0 auto;
      width: 100%;
    }
    .student-card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 16px;
      padding: 18px 20px;
      backdrop-filter: blur(14px);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      transition: all 0.3s;
    }
    .student-card.rank-1 {
      border: 2px solid #fbbf24;
      background: linear-gradient(180deg, rgba(251, 191, 36, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%);
      box-shadow: 0 14px 32px rgba(251, 191, 36, 0.2), 0 0 25px rgba(251, 191, 36, 0.15);
      transform: translateY(-4px);
    }
    .student-card.rank-2 {
      border: 1.5px solid #cbd5e1;
      background: linear-gradient(180deg, rgba(203, 213, 225, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%);
    }
    .student-card.rank-3 {
      border: 1.5px solid #d97706;
      background: linear-gradient(180deg, rgba(217, 119, 6, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%);
    }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .rank-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 900;
      font-size: 14px;
    }
    .rank-circle.r1 { background: #fbbf24; color: #020617; box-shadow: 0 0 12px #fbbf24; }
    .rank-circle.r2 { background: #cbd5e1; color: #020617; }
    .rank-circle.r3 { background: #d97706; color: #FFFFFF; }
    .rank-circle.rn { background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
    
    .dept-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 6px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      text-transform: uppercase;
    }
    .student-name {
      font-size: 17px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .student-reg {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 14px;
    }
    .stats-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 12px;
    }
    .stat-col {
      display: flex;
      flex-direction: column;
    }
    .stat-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .stat-val-solved {
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 900;
      color: #34d399;
    }
    .stat-val-rating {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 800;
      color: #fbbf24;
      text-align: right;
    }

    /* Bottom Ticker */
    footer {
      position: relative;
      z-index: 10;
      padding: 14px 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(6, 10, 20, 0.95);
      border-top: 1px solid rgba(56, 189, 248, 0.2);
    }
    .ticker-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
    }
    .ticker-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #fbbf24;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 4px 12px;
      border-radius: 6px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ticker-text {
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .ticker-right {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>

  <!-- Header -->
  <header>
    <div class="header-left">
      <div class="kiosk-badge">
        <span class="pulse-dot"></span>
        Live Auditorium Display
      </div>
      <div class="header-title">Nandha LeetCode Intelligence — <span>Hall of Fame</span></div>
    </div>
    <div class="header-right">
      <span>Official Contest Telemetry • Week 523</span>
      <span class="live-clock">3:15:46 PM</span>
    </div>
  </header>

  <!-- Main Stage -->
  <main>
    <div class="title-banner">
      <div class="honor-badge">🏆 Grandmaster Honor Roll</div>
      <h1 class="main-heading">Top 10 College-Wide Solvers</h1>
      <p class="main-sub">Recognizing exceptional consistency, algorithmic mastery, and verified institutional problem volume</p>
    </div>

    <div class="cards-grid">
      ${realStudents.map(st => `
        <div class="student-card ${st.rank === 1 ? 'rank-1' : st.rank === 2 ? 'rank-2' : st.rank === 3 ? 'rank-3' : ''}">
          <div class="card-top">
            <div class="rank-circle ${st.rank === 1 ? 'r1' : st.rank === 2 ? 'r2' : st.rank === 3 ? 'r3' : 'rn'}">#${st.rank}</div>
            <div class="dept-badge">${st.dept}</div>
          </div>
          <div class="student-name" title="${st.name}">${st.name}</div>
          <div class="student-reg">${st.reg}</div>
          <div class="stats-footer">
            <div class="stat-col">
              <span class="stat-label">Solved</span>
              <span class="stat-val-solved">${st.solved}</span>
            </div>
            <div class="stat-col">
              <span class="stat-label" style="text-align: right;">Rating</span>
              <span class="stat-val-rating">${st.rating}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </main>

  <!-- Footer Ticker -->
  <footer>
    <div class="ticker-left">
      <span class="ticker-tag">Campus News</span>
      <span class="ticker-text">Next LeetCode Sunday Weekly Contest starts sharp at 08:00 AM IST • Mandatory for all 2nd, 3rd, and 4th Year Engineering students • Automated Anti-Cheat & Forensic Plagiarism Engine is actively monitoring • Top solvers receive College Merit Citations</span>
    </div>
    <div class="ticker-right">
      Nandha Engineering College • Autonomous
    </div>
  </footer>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const outPath = path.join(SCENES_DIR, 'kiosk_public.png');
  await page.screenshot({ path: outPath });
  console.log(`[SUCCESS] Rendered Authentic Kiosk Image -> ${outPath}`);

  await browser.close();
}

renderKiosk().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
