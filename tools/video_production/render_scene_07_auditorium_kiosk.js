const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const OUT_DIR = path.resolve(__dirname, 'output_apple_60s');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function renderScene07() {
  const outFile = path.join(OUT_DIR, 'seg_07_kiosk.mp4');
  console.log(`[SCENE 07] Rendering Live Auditorium Display & Authentic Hall of Fame (7.5s) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const TOP_10 = [
    { rank: 1, name: "NANTHISH S", reg: "732224CC031", dept: "CSE(CS)", solved: 907, rating: 1928, gold: true },
    { rank: 2, name: "RITHANYA S", reg: "732224CI044", dept: "CSE(IOT)", solved: 873, rating: 1923 },
    { rank: 3, name: "POOZANA G", reg: "732224IT071", dept: "IT", solved: 794, rating: 1641 },
    { rank: 4, name: "KANISKA N J", reg: "732223CC021", dept: "CSE(CS)", solved: 649, rating: 1502 },
    { rank: 5, name: "KAVINRAJAN K", reg: "732223CC023", dept: "CSE(CS)", solved: 605, rating: 1864 },
    { rank: 6, name: "WASIM M", reg: "732223CC059", dept: "CSE(CS)", solved: 585, rating: 1638 },
    { rank: 7, name: "STEFFY MARTINA P", reg: "732223CC052", dept: "CSE(CS)", solved: 580, rating: 1621 },
    { rank: 8, name: "PRAVEEN KUMAR J", reg: "732223CC038", dept: "CSE(CS)", solved: 568, rating: 1653 },
    { rank: 9, name: "HARISH .E", reg: "732224IT034", dept: "IT", solved: 529, rating: 1818 },
    { rank: 10, name: "KEERTHANA B", reg: "732225IT049", dept: "IT", solved: 503, rating: 1874 }
  ];

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 40%, #0c182c 0%, #050b14 60%, #010307 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 38px 60px 30px;
      position: relative;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 50%, black 50%, transparent 85%);
      pointer-events: none;
    }

    .kiosk-header {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hdr-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .live-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.45);
      color: #10b981;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 9999px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .hdr-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 24px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .hdr-title span { color: #38bdf8; }
    .hdr-meta {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 600;
      display: flex;
      gap: 20px;
    }

    .center-title-area {
      text-align: center;
      margin: 10px 0 16px;
      position: relative;
      z-index: 10;
    }
    .honor-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid rgba(251, 191, 36, 0.35);
      color: #fbbf24;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 4px 14px;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .big-heading {
      font-family: 'Montserrat', sans-serif;
      font-size: 42px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }
    .big-desc {
      font-size: 15px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* Top 10 Grid */
    .kiosk-grid {
      position: relative;
      z-index: 10;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      width: 100%;
    }
    .kiosk-card {
      background: rgba(11, 20, 38, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 18px;
      padding: 16px 18px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .kiosk-card.gold-hero {
      border: 2px solid #fbbf24;
      box-shadow: 0 18px 45px rgba(0,0,0,0.8), 0 0 30px rgba(251, 191, 36, 0.3);
      background: linear-gradient(180deg, rgba(251, 191, 36, 0.12) 0%, rgba(11, 20, 38, 0.94) 100%);
    }
    .card-hdr {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rank-tag {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 900;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .kiosk-card.gold-hero .rank-tag {
      background: #fbbf24;
      color: #000;
    }
    .dept-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
    }
    .stud-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #FFFFFF;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stud-reg {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .score-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .score-block {
      display: flex;
      flex-direction: column;
    }
    .score-lbl {
      font-size: 9px;
      color: #64748b;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .score-num {
      font-family: 'Montserrat', sans-serif;
      font-size: 22px;
      font-weight: 900;
      color: #38bdf8;
    }

    /* Bottom Ticker */
    .kiosk-footer {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 18px;
      background: rgba(11, 20, 38, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 10px 22px;
      font-size: 12px;
      color: #cbd5e1;
    }
    .news-badge {
      background: #fbbf24;
      color: #000;
      font-weight: 900;
      font-size: 10px;
      padding: 4px 10px;
      border-radius: 6px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>

  <div class="kiosk-header">
    <div class="hdr-left">
      <div class="live-pill">● LIVE AUDITORIUM DISPLAY</div>
      <div class="hdr-title">Nandha LeetCode Intelligence — <span>Hall of Fame</span></div>
    </div>
    <div class="hdr-meta">
      <div>Official Contest Telemetry • Week 524</div>
      <div style="color:#38bdf8;font-weight:800;">AUTONOMOUS AUDIT</div>
    </div>
  </div>

  <div class="center-title-area">
    <div class="honor-badge">🏆 GRANDMASTER HONOR ROLL</div>
    <h2 class="big-heading">Top 10 College-Wide Solvers</h2>
    <p class="big-desc">Recognizing exceptional consistency, algorithmic mastery, and verified institutional problem volume</p>
  </div>

  <div class="kiosk-grid" id="grid">
    ${TOP_10.map(s => `
      <div class="kiosk-card ${s.gold ? 'gold-hero' : ''}">
        <div class="card-hdr">
          <div class="rank-tag">#${s.rank}</div>
          <div class="dept-pill">${s.dept}</div>
        </div>
        <div>
          <div class="stud-name">${s.name}</div>
          <div class="stud-reg">${s.reg}</div>
        </div>
        <div class="score-row">
          <div class="score-block">
            <span class="score-lbl">SOLVED</span>
            <span class="score-num" style="${s.gold ? 'color:#10b981;' : ''}">${s.solved}</span>
          </div>
          <div class="score-block" style="text-align:right;">
            <span class="score-lbl">RATING</span>
            <span class="score-num" style="color:#fbbf24;">${s.rating}</span>
          </div>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="kiosk-footer">
    <div class="news-badge">CAMPUS TELEMETRY</div>
    <div>Live LeetCode Sunday Weekly Contest starts sharp at 08:00 AM IST • Automated Anti-Cheat & Forensic Plagiarism Engine is actively monitoring • Top solvers receive College Merit Citations</div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    window.updateFrame = function(sec) {
      // 3D subtle curved perspective
      const scale = lerp(0.95, 1.02, sec / 7.5);
      const rotX = lerp(6, 0, sec / 7.5);
      document.getElementById('grid').style.transform = \`perspective(1200px) scale(\${scale}) rotateX(\${rotX}deg)\`;

      // Master fade out at t=6.7s
      if (sec >= 6.7) {
        document.body.style.opacity = lerp(1, 0, (sec - 6.7) / 0.8);
      } else {
        document.body.style.opacity = 1;
      }
    };
  </script>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });

  const ffmpeg = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '16',
    '-pix_fmt', 'yuv420p',
    '-an',
    outFile
  ]);

  const totalFrames = Math.floor(7.5 * 30); // 225 frames
  for (let i = 0; i < totalFrames; i++) {
    const t = i / 30;
    await page.evaluate((sec) => window.updateFrame(sec), t);
    const buf = await page.screenshot({ type: 'png' });
    const ok = ffmpeg.stdin.write(buf);
    if (!ok) {
      await new Promise(res => ffmpeg.stdin.once('drain', res));
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  console.log(`[SUCCESS] Scene 07 rendered: ${outFile}`);
  await browser.close();
}

renderScene07().catch(err => {
  console.error(err);
  process.exit(1);
});
