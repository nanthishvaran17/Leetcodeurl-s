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

const profileShot = getBase64('live_audit_snapshots/05e_aakash_profile.png');

async function renderScene05() {
  const outFile = path.join(OUT_DIR, 'scene_05_profile.mp4');
  console.log(`[SCENE 05] Rendering Individual Student Intelligence (9.000s / 270 frames) -> ${outFile}...`);

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
      position: relative;
    }
    .pan-container {
      position: absolute;
      width: 1920px;
      height: 1080px;
      transform-origin: 50% 50%;
      will-change: transform;
    }
    .page-shot {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Subtle glowing highlight over DSA radar & contest rating */
    .radar-spotlight {
      position: absolute;
      top: 575px;
      left: 385px;
      width: 580px;
      height: 420px;
      border-radius: 24px;
      border: 1.5px solid rgba(99, 102, 241, 0.4);
      background: rgba(99, 102, 241, 0.03);
      box-shadow: 0 0 35px rgba(99, 102, 241, 0.12);
      opacity: 0;
      pointer-events: none;
    }
    .rating-spotlight {
      position: absolute;
      top: 310px;
      left: 1085px;
      width: 450px;
      height: 180px;
      border-radius: 24px;
      border: 1.5px solid rgba(139, 92, 246, 0.4);
      background: rgba(139, 92, 246, 0.03);
      box-shadow: 0 0 35px rgba(139, 92, 246, 0.12);
      opacity: 0;
      pointer-events: none;
    }
    /* Lower-Third Caption Pill */
    .caption-pill {
      position: absolute;
      bottom: 45px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255,255,255,0.8);
      padding: 14px 34px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      z-index: 200;
    }
    .caption-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #8B5CF6;
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.6);
    }
    .caption-text {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0F172A;
    }
    .white-fade {
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
  <div class="pan-container" id="panBox">
    <img src="${profileShot}" class="page-shot" alt="Student Profile Live" />
    <div class="radar-spotlight" id="radarSpot"></div>
    <div class="rating-spotlight" id="ratingSpot"></div>
  </div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">FROM RANK TO INSIGHT.</span>
  </div>

  <div class="white-fade" id="whiteFade"></div>

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
      } else if (sec >= 8.2) {
        // 8.2 - 9.0s: Outgoing white fade to contest analytics
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Camera choreography:
      // 0.0 - 3.0s: Full modal overview (scale 1.0 -> 1.05)
      // 3.0 - 6.0s: Gentle glide towards DSA Skill Radar & Contest Arena (scale 1.05 -> 1.12, translateY -35px, translateX 20px)
      // 6.0 - 9.0s: Settle back to full credential view
      let scale = 1.0;
      let transY = 0;
      let transX = 0;

      if (sec < 3.0) {
        const p = easeInOutCubic(sec / 3.0);
        scale = lerp(1.0, 1.05, p);
        transY = lerp(0, -10, p);
      } else if (sec >= 3.0 && sec < 6.5) {
        const p = easeInOutCubic((sec - 3.0) / 3.5);
        scale = lerp(1.05, 1.12, p);
        transY = lerp(-10, -50, p);
        transX = lerp(0, 40, p);
        document.getElementById('radarSpot').style.opacity = lerp(0, 0.9, Math.min(1, (sec - 3.2) / 0.8));
        document.getElementById('ratingSpot').style.opacity = lerp(0, 0.8, Math.min(1, (sec - 3.8) / 0.8));
      } else {
        const p = easeInOutCubic((sec - 6.5) / 2.5);
        scale = lerp(1.12, 1.02, p);
        transY = lerp(-50, -15, p);
        transX = lerp(40, 0, p);
        document.getElementById('radarSpot').style.opacity = lerp(0.9, 0, p);
        document.getElementById('ratingSpot').style.opacity = lerp(0.8, 0, p);
      }

      document.getElementById('panBox').style.transform = 'translate(' + transX + 'px, ' + transY + 'px) scale(' + scale + ')';

      // Caption timing
      if (sec >= 0.8 && sec <= 8.0) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 8.0) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 8.0) / 0.6);
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

  const totalFrames = 270; // 9.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 05 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

renderScene05().catch(err => {
  console.error(err);
  process.exit(1);
});
