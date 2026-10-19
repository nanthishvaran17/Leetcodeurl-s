const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const OUT_DIR = path.resolve(__dirname, 'output_apple_60s');
fs.mkdirSync(OUT_DIR, { recursive: true });

function getBase64(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const radarImg = getBase64('tools/video_production/output/preview_snapshots_2min/snap_02_radar_profile.png') || 
                 getBase64('reports/assets/screenshots/snap_02_radar_profile.png');
const studentPhoto = getBase64('tools/video_production/team_photos/lead_dev_nanthish_s.jpg');

async function renderScene05() {
  const outFile = path.join(OUT_DIR, 'seg_05_radar.mp4');
  console.log(`[SCENE 05] Rendering Student Deep Analytics & 3D Holographic Radar (7.5s) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Montserrat:wght@800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: radial-gradient(circle at 50% 50%, #0d1a33 0%, #050b16 60%, #010308 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1400px;
      position: relative;
    }
    .hud-title {
      position: absolute;
      top: 45px;
      left: 70px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hud-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.4);
      color: #c084fc;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 2px;
      padding: 5px 14px;
      border-radius: 9999px;
      width: fit-content;
      text-transform: uppercase;
    }
    .hud-heading {
      font-family: 'Montserrat', sans-serif;
      font-size: 26px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .hud-desc {
      font-size: 14px;
      color: #94a3b8;
    }

    .canvas-3d {
      width: 1600px;
      height: 900px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 35px 80px rgba(0,0,0,0.85), 0 0 40px rgba(168, 85, 247, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      background: #0f172a;
      transform-style: preserve-3d;
    }
    .bg-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
    }

    /* Floating Holographic Radar Card */
    .radar-holo-card {
      position: absolute;
      bottom: 50px;
      left: 70px;
      width: 520px;
      background: rgba(11, 20, 38, 0.94);
      border: 1px solid rgba(56, 189, 248, 0.45);
      border-radius: 24px;
      padding: 24px 28px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.3);
      backdrop-filter: blur(25px);
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .holo-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .holo-avatar {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      border: 2px solid #38bdf8;
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.6);
      overflow: hidden;
      object-fit: cover;
    }
    .holo-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .holo-sub {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
    }
    .stat-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .stat-box {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
    }
    .box-val {
      font-family: 'Montserrat', sans-serif;
      font-size: 20px;
      font-weight: 900;
      color: #FFFFFF;
    }
    .box-lbl {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    /* SVG 6-Axis Radar Graphic */
    .radar-svg-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 0;
    }
  </style>
</head>
<body>
  <div class="hud-title">
    <div class="hud-badge">ALGORITHMIC MASTERY</div>
    <div class="hud-heading">6-AXIS DSA SKILL RADAR</div>
    <div class="hud-desc">Granular Topic Mastery & Individual Performance Dossier</div>
  </div>

  <div class="canvas-3d" id="canvas">
    <img src="${radarImg}" class="bg-img" alt="Student Profile" />
  </div>

  <div class="radar-holo-card" id="holoCard">
    <div class="holo-header">
      <img src="${studentPhoto}" class="holo-avatar" alt="NANTHISH S" />
      <div>
        <div class="holo-title">NANTHISH S • CSE(CS)</div>
        <div class="holo-sub">Reg: 732224CC031 • Grandmaster Solver</div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-box">
        <div class="box-val" style="color:#10b981;">907</div>
        <div class="box-lbl">Solved</div>
      </div>
      <div class="stat-box">
        <div class="box-val" style="color:#fbbf24;">1,928</div>
        <div class="box-lbl">Contest Rating</div>
      </div>
      <div class="stat-box">
        <div class="box-val" style="color:#38bdf8;">#1</div>
        <div class="box-lbl">College Rank</div>
      </div>
    </div>

    <div class="radar-svg-wrap">
      <svg width="220" height="150" viewBox="0 0 220 150">
        <!-- Polygon Grid -->
        <polygon points="110,15 190,45 190,105 110,135 30,105 30,45" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.2"/>
        <polygon points="110,35 160,55 160,95 110,115 60,95 60,55" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <!-- Animated Active Skill Polygon -->
        <polygon id="radarPoly" points="110,20 185,48 175,100 110,128 35,100 40,48" fill="rgba(56, 189, 248, 0.28)" stroke="#38bdf8" stroke-width="2.4"/>
        <!-- Nodes -->
        <circle cx="110" cy="20" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
        <circle cx="185" cy="48" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
        <circle cx="175" cy="100" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
        <circle cx="110" cy="128" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
        <circle cx="35" cy="100" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
        <circle cx="40" cy="48" r="4" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)"/>
      </svg>
    </div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }

    window.updateFrame = function(sec) {
      // 3D Isometric Dolly Zoom
      const rotX = lerp(10, 3, sec / 7.5);
      const rotY = lerp(-14, 2, sec / 7.5);
      const zoom = lerp(0.96, 1.04, sec / 7.5);
      document.getElementById('canvas').style.transform = \`rotateX(\${rotX}deg) rotateY(\${rotY}deg) scale(\${zoom})\`;

      // Holo card smooth rise
      const cardProgress = Math.min(1, Math.max(0, (sec - 0.8) / 1.2));
      const cardY = lerp(60, 0, cardProgress);
      const cardOp = lerp(0, 1, cardProgress);
      document.getElementById('holoCard').style.opacity = cardOp;
      document.getElementById('holoCard').style.transform = \`translateY(\${cardY}px)\`;

      // Pulse radar mesh
      const pulse = 1 + Math.sin(sec * 4) * 0.03;
      document.getElementById('radarPoly').style.transformOrigin = '110px 75px';
      document.getElementById('radarPoly').style.transform = \`scale(\${pulse})\`;

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

  console.log(`[SUCCESS] Scene 05 rendered: ${outFile}`);
  await browser.close();
}

renderScene05().catch(err => {
  console.error(err);
  process.exit(1);
});
