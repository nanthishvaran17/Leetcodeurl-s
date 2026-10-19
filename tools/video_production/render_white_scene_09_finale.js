const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FFMPEG = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe';
const OUT_DIR = path.resolve(__dirname, 'output_white_70s');
fs.mkdirSync(OUT_DIR, { recursive: true });

function getBase64(filePath) {
  let fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) return '';
  const ext = path.extname(fullPath).slice(1);
  const data = fs.readFileSync(fullPath).toString('base64');
  return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}`;
}

const logoData = getBase64('brand_assets/logo.png') || getBase64('brand_assets/round_logo.png');
const shotDash = getBase64('live_audit_snapshots/04_dashboard.png');
const shotRoster = getBase64('live_audit_snapshots/09_departments.png');
const shotProfile = getBase64('live_audit_snapshots/05e_aakash_profile.png');
const shotKiosk = getBase64('live_audit_snapshots/10_public_kiosk.png');

async function renderScene09() {
  const outFile = path.join(OUT_DIR, 'scene_09_finale.mp4');
  console.log(`[SCENE 09] Rendering Grand Finale (7.000s / 210 frames) -> ${outFile}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      background: #FFFFFF;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    /* Subtle Soft Studio Radial Lighting */
    .studio-glow {
      position: absolute;
      width: 1600px;
      height: 900px;
      background: radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 0.6) 60%, rgba(255, 255, 255, 1) 100%);
      pointer-events: none;
    }
    /* Layered Floating Product Canvas Panels */
    .layered-stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      perspective: 1600px;
      transform-style: preserve-3d;
    }
    .panel-card {
      position: absolute;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 30px 60px -12px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(226, 232, 240, 0.8);
      background: #FFFFFF;
      transition: transform 0.1s linear, opacity 0.1s linear;
    }
    .panel-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    #panelCenter {
      width: 1100px;
      height: 618px;
      z-index: 10;
      opacity: 0.9;
    }
    #panelLeft {
      width: 820px;
      height: 461px;
      z-index: 15;
      opacity: 0.85;
    }
    #panelRight {
      width: 780px;
      height: 438px;
      z-index: 20;
      opacity: 0.88;
    }
    #panelTop {
      width: 680px;
      height: 382px;
      z-index: 12;
      opacity: 0.8;
    }

    /* Foreground Institutional Monolith Title */
    .monolith-card {
      position: relative;
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(24px);
      padding: 44px 70px;
      border-radius: 32px;
      box-shadow: 0 25px 60px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.9);
      opacity: 0;
      transform: scale(0.94);
    }
    .logo-frame {
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 12px 28px -6px rgba(15, 23, 42, 0.15), 0 0 0 1px #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 22px;
    }
    .logo-frame img {
      width: 88px;
      height: 88px;
      object-fit: contain;
      border-radius: 50%;
    }
    .monolith-title {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #0F172A;
      margin-bottom: 10px;
      line-height: 1.1;
    }
    .monolith-title span {
      color: #2563EB;
    }
    .monolith-motto-1 {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #1E293B;
      margin-bottom: 8px;
    }
    .monolith-motto-2 {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #2563EB;
      margin-bottom: 16px;
    }
    .monolith-inst {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 18px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #475569;
    }
    .inst-pulse {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 6px #10B981;
    }

    .white-fadeout {
      position: absolute;
      inset: 0;
      background: #FFFFFF;
      opacity: 0;
      z-index: 300;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="studio-glow"></div>

  <div class="layered-stage">
    <!-- Center Panel: Dashboard -->
    <div class="panel-card" id="panelCenter">
      <img src="${shotDash}" alt="Dashboard Panel" />
    </div>
    <!-- Top-Right Panel: Contest Podium -->
    <div class="panel-card" id="panelTop">
      <img src="${shotKiosk}" alt="Contest Podium" />
    </div>
    <!-- Left Layered Panel: Roster Table -->
    <div class="panel-card" id="panelLeft">
      <img src="${shotRoster}" alt="Roster Panel" />
    </div>
    <!-- Right Layered Panel: Student Profile -->
    <div class="panel-card" id="panelRight">
      <img src="${shotProfile}" alt="Profile Panel" />
    </div>
  </div>

  <div class="monolith-card" id="monolithCard">
    <div class="logo-frame">
      <img src="${logoData}" alt="Nandha Logo" />
    </div>
    <h1 class="monolith-title">NANDHA <span>LEETCODE INTELLIGENCE</span></h1>
    <p class="monolith-motto-1">BUILT FOR CLARITY. POWERED BY DATA.</p>
    <div class="monolith-inst">
      <span class="inst-pulse"></span>
      NANDHA ENGINEERING COLLEGE &bull; AUTONOMOUS
    </div>
  </div>

  <div class="white-fadeout" id="whiteFade"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    window.updateFrame = function(sec) {
      // 0.0 - 0.5s: Ingoing white fade
      if (sec < 0.5) {
        document.getElementById('whiteFade').style.opacity = lerp(0.8, 0, sec / 0.5);
      } else if (sec >= 6.2) {
        // 6.2 - 7.0s: Final smooth white fade and musical resolution
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 6.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Parallax convergence of panels (0.0s -> 4.5s)
      const p = easeInOutCubic(Math.min(1, sec / 4.0));

      // Center panel
      const cZ = lerp(-120, -50, p);
      const cScale = lerp(0.88, 0.95, p);
      document.getElementById('panelCenter').style.transform = 'translateZ(' + cZ + 'px) scale(' + cScale + ')';

      // Left panel
      const lX = lerp(-650, -480, p);
      const lY = lerp(80, 50, p);
      const lRotY = lerp(16, 8, p);
      document.getElementById('panelLeft').style.transform = 'translate3d(' + lX + 'px, ' + lY + 'px, 60px) rotateY(' + lRotY + 'deg)';

      // Right panel
      const rX = lerp(620, 460, p);
      const rY = lerp(90, 60, p);
      const rRotY = lerp(-16, -8, p);
      document.getElementById('panelRight').style.transform = 'translate3d(' + rX + 'px, ' + rY + 'px, 80px) rotateY(' + rRotY + 'deg)';

      // Top panel
      const tX = lerp(350, 220, p);
      const tY = lerp(-280, -220, p);
      document.getElementById('panelTop').style.transform = 'translate3d(' + tX + 'px, ' + tY + 'px, 10px)';

      // Monolith reveal at 1.2s - 2.8s
      if (sec >= 1.2) {
        const mProg = easeInOutCubic(Math.min(1, (sec - 1.2) / 1.4));
        document.getElementById('monolithCard').style.opacity = mProg;
        document.getElementById('monolithCard').style.transform = 'scale(' + lerp(0.92, 1.0, mProg) + ')';
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

  const totalFrames = 210; // 7.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 09 rendered: ${outFile} (exact 210 frames / 7.000s)`);
  await browser.close();
}

renderScene09().catch(err => {
  console.error(err);
  process.exit(1);
});
