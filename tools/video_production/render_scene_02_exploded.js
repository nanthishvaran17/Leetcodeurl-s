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

const logoData = getBase64('tools/video_production/brand_assets/nec_25_years_logo.png') || 
                 getBase64('tools/video_production/brand_assets/round_logo.png');

async function renderScene02() {
  const outFile = path.join(OUT_DIR, 'seg_02_exploded.mp4');
  console.log(`[SCENE 02] Rendering 3D Exploded Layer Architecture (8.0s) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

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
      background: radial-gradient(circle at 50% 50%, #0a1324 0%, #040812 60%, #010308 100%);
      font-family: 'Inter', -apple-system, sans-serif;
      color: #FFFFFF;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1500px;
      position: relative;
    }
    .grid-floor {
      position: absolute;
      inset: -50%;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.07) 1px, transparent 1px);
      background-size: 80px 80px;
      transform: rotateX(60deg) translateY(200px);
      mask-image: radial-gradient(circle at 50% 50%, black 30%, transparent 75%);
      pointer-events: none;
    }
    .hud-title {
      position: absolute;
      top: 50px;
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
      background: rgba(14, 165, 233, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
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
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #FFFFFF;
    }
    .hud-desc {
      font-size: 14px;
      color: #94a3b8;
    }

    /* 3D Exploded Stage Container */
    .stage-3d {
      width: 1440px;
      height: 840px;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.1s ease-out;
    }

    /* Layer 1: Base Cyber Infrastructure */
    .layer-base {
      position: absolute;
      inset: 0;
      background: rgba(11, 20, 38, 0.95);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 24px;
      box-shadow: 0 40px 100px rgba(0, 0, 0, 0.9);
      padding: 30px;
      transform-style: preserve-3d;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .base-telemetry-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      padding: 20px;
      background: rgba(5, 11, 22, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
    }
    .tele-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tele-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .tele-val {
      font-size: 20px;
      font-weight: 800;
      color: #38bdf8;
    }

    /* Layer 2: Middle Metric & Component Cards */
    .layer-mid {
      position: absolute;
      top: 130px;
      left: 30px;
      right: 30px;
      height: 480px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transform-style: preserve-3d;
      pointer-events: none;
    }
    .mid-cards-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }
    .metric-card {
      background: rgba(15, 25, 48, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 20px;
      padding: 24px 22px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.15);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
    }
    .card-num {
      font-size: 40px;
      font-weight: 900;
      color: #FFFFFF;
      font-family: 'Montserrat', sans-serif;
    }
    .card-sub {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
    }

    .banner-card {
      background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 20px;
      padding: 24px 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 15px 35px rgba(0,0,0,0.5);
    }
    .banner-title {
      font-size: 22px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .banner-btn {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      padding: 10px 24px;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
    }

    /* Layer 3: Top Navigation Plane */
    .layer-top {
      position: absolute;
      top: 30px;
      left: 30px;
      right: 30px;
      height: 80px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 0 26px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(24px);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7);
      transform-style: preserve-3d;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nav-logo {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #FFFFFF;
      padding: 2px;
    }
    .nav-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 17px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .nav-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 9999px;
    }

    /* Magnetic Snap Shockwave */
    .shockwave {
      position: absolute;
      inset: -20px;
      border-radius: 36px;
      border: 2px solid #38bdf8;
      box-shadow: 0 0 60px #38bdf8;
      opacity: 0;
      pointer-events: none;
      transform: scale(0.95);
    }
  </style>
</head>
<body>
  <div class="grid-floor"></div>

  <div class="hud-title">
    <div class="hud-badge">DECONSTRUCTED ARCHITECTURE</div>
    <div class="hud-heading">3D LAYERED REVEAL</div>
    <div class="hud-desc">Synchronized Cloud Telemetry & Institutional Performance Grid</div>
  </div>

  <div class="stage-3d" id="stage">
    <!-- Layer 1: Base -->
    <div class="layer-base" id="layer1">
      <div class="base-telemetry-grid">
        <div class="tele-stat">
          <div class="tele-label">Engine Latency</div>
          <div class="tele-val">12 ms</div>
        </div>
        <div class="tele-stat">
          <div class="tele-label">Cache Memory</div>
          <div class="tele-val">64 MB Redis</div>
        </div>
        <div class="tele-stat">
          <div class="tele-label">Data Reconciliation</div>
          <div class="tele-val">Instant 100%</div>
        </div>
        <div class="tele-stat">
          <div class="tele-label">Integrity Status</div>
          <div class="tele-val" style="color:#10b981;">VERIFIED PASS</div>
        </div>
      </div>
    </div>

    <!-- Layer 2: Metric Hub -->
    <div class="layer-mid" id="layer2">
      <div class="mid-cards-row">
        <div class="metric-card">
          <div class="card-top">
            <span class="card-sub">ENROLLED ROSTER</span>
            <span class="card-badge">INSTITUTIONAL</span>
          </div>
          <div class="card-num">680</div>
          <div class="card-sub">Active Engineering Cohorts</div>
        </div>
        <div class="metric-card">
          <div class="card-top">
            <span class="card-sub">SYNCHRONIZED</span>
            <span class="card-badge" style="color:#10b981;background:rgba(16,185,129,0.15);">LIVE SYNC</span>
          </div>
          <div class="card-num" style="color:#10b981;">543</div>
          <div class="card-sub">79.9% Profile Coverage</div>
        </div>
        <div class="metric-card">
          <div class="card-top">
            <span class="card-sub">VERIFIED PROBLEMS</span>
            <span class="card-badge" style="color:#fbbf24;background:rgba(251,191,36,0.15);">AUTHENTIC</span>
          </div>
          <div class="card-num" style="color:#fbbf24;">57,181</div>
          <div class="card-sub">Historical Submissions</div>
        </div>
        <div class="metric-card">
          <div class="card-top">
            <span class="card-sub">TOP CONTEST RATING</span>
            <span class="card-badge" style="color:#a855f7;background:rgba(168,85,247,0.15);">GLOBAL</span>
          </div>
          <div class="card-num" style="color:#c084fc;">1,928</div>
          <div class="card-sub">Grandmaster Benchmark</div>
        </div>
      </div>

      <div class="banner-card">
        <div>
          <div class="banner-title">REAL-TIME GROWTH & DELTA ENGINE</div>
          <div class="card-sub" style="font-size:13px;margin-top:4px;">Multi-cohort historical tracking, time machine velocity, and institutional mastery.</div>
        </div>
        <div class="banner-btn">Launch Growth Engine →</div>
      </div>
    </div>

    <!-- Layer 3: Top Navigation -->
    <div class="layer-top" id="layer3">
      <div class="nav-left">
        <img src="${logoData}" class="nav-logo" alt="NEC Logo" />
        <div class="nav-title">NANDHA INTELLIGENCE • 680 STUDENTS</div>
      </div>
      <div class="nav-right">
        <div class="status-pill">● Sync Engine Active</div>
        <div style="font-size:13px;font-weight:700;color:#94a3b8;">Administrator</div>
      </div>
    </div>

    <div class="shockwave" id="shockwave"></div>
  </div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    window.updateFrame = function(sec) {
      // Camera 3D Orbit: rotateX 20deg -> 10deg, rotateY -18deg -> -6deg
      const rotX = lerp(20, 8, sec / 7.0);
      const rotY = lerp(-18, -4, sec / 7.0);
      const scale = lerp(0.9, 1.02, sec / 7.0);
      document.getElementById('stage').style.transform = \`rotateX(\${rotX}deg) rotateY(\${rotY}deg) scale(\${scale})\`;

      // 0.0 - 4.5s: Exploded Layer Separation
      // 4.5 - 5.3s: Magnetic Snap together
      let zTop = 110;
      let zMid = 55;
      if (sec >= 4.5 && sec <= 5.3) {
        const snapT = (sec - 4.5) / 0.8;
        // Ease-in snap
        const easeSnap = Math.pow(snapT, 3);
        zTop = lerp(110, 0, easeSnap);
        zMid = lerp(55, 0, easeSnap);
      } else if (sec > 5.3) {
        zTop = 0;
        zMid = 0;
      }

      document.getElementById('layer3').style.transform = \`translateZ(\${zTop}px)\`;
      document.getElementById('layer2').style.transform = \`translateZ(\${zMid}px)\`;

      // Shockwave at t=5.3s
      if (sec >= 5.2 && sec <= 5.8) {
        const swProgress = (sec - 5.2) / 0.6;
        document.getElementById('shockwave').style.opacity = lerp(1, 0, swProgress);
        document.getElementById('shockwave').style.transform = \`scale(\${lerp(0.95, 1.08, swProgress)})\`;
      } else {
        document.getElementById('shockwave').style.opacity = 0;
      }

      // 7.2 - 8.0s: Master fade out
      if (sec >= 7.2) {
        document.body.style.opacity = lerp(1, 0, (sec - 7.2) / 0.8);
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

  const totalFrames = Math.floor(8.0 * 30); // 240 frames
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

  console.log(`[SUCCESS] Scene 02 rendered: ${outFile}`);
  await browser.close();
}

renderScene02().catch(err => {
  console.error(err);
  process.exit(1);
});
