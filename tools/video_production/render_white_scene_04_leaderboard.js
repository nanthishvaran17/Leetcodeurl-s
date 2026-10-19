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

const rosterShot = getBase64('live_audit_snapshots/09_departments.png');

async function renderScene04() {
  const outFile = path.join(OUT_DIR, 'scene_04_leaderboard.mp4');
  console.log(`[SCENE 04] Rendering Leaderboard Experience (10.000s / 300 frames, Search Typing & Profile Click) -> ${outFile}...`);

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
    .page-container {
      position: absolute;
      inset: 0;
      width: 1920px;
      height: 1080px;
    }
    .page-shot {
      width: 1920px;
      height: 1080px;
      object-fit: cover;
      display: block;
    }
    /* Simulated Live Search Bar Overlay at top-right of table */
    .search-input-box {
      position: absolute;
      top: 156px;
      right: 320px;
      width: 260px;
      height: 38px;
      background: #FFFFFF;
      border: 1.5px solid #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      border-radius: 8px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 13px;
      font-weight: 600;
      color: #0F172A;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .search-text {
      white-space: nowrap;
      overflow: hidden;
    }
    .search-cursor {
      display: inline-block;
      width: 2px;
      height: 16px;
      background: #2563EB;
      margin-left: 2px;
      animation: blink 0.8s infinite;
    }
    /* Rank 1 Student Highlight Box (Nanthish S) */
    .rank1-highlight {
      position: absolute;
      top: 310px;
      left: 280px;
      width: 1360px;
      height: 64px;
      border-radius: 10px;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.04);
      box-shadow: 0 8px 24px -4px rgba(37, 99, 235, 0.18);
      opacity: 0;
      pointer-events: none;
      z-index: 90;
      transition: opacity 0.3s ease;
    }
    /* Badge Tag on Rank 1 */
    .rank1-tag {
      position: absolute;
      top: -12px;
      right: 40px;
      background: #2563EB;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 999px;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.4);
    }
    /* Authentic Cursor */
    .mouse-cursor {
      position: absolute;
      width: 24px;
      height: 24px;
      z-index: 150;
      pointer-events: none;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3));
    }
    /* Ripple Effect on Click */
    .click-ripple {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.5);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      pointer-events: none;
      z-index: 140;
    }
    /* Lower-Third Caption */
    .caption-pill {
      position: absolute;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(226, 232, 240, 0.9);
      box-shadow: 0 16px 40px -8px rgba(15, 23, 42, 0.12);
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
      background: #2563EB;
      box-shadow: 0 0 8px rgba(37, 99, 235, 0.6);
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
  <div class="page-container" id="pageBox">
    <img src="${rosterShot}" class="page-shot" alt="Leaderboard Roster" />
    <div class="search-input-box" id="searchBox">
      <span class="search-text" id="searchText"></span>
      <span class="search-cursor"></span>
    </div>
    <div class="rank1-highlight" id="rank1Box">
      <span class="rank1-tag">Top Institutional Rank #1</span>
    </div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">EVERY SOLVER COUNTS.</span>
  </div>

  <div class="white-fade" id="whiteFade"></div>

  <script>
    function lerp(a, b, t) {
      return a + (b - a) * Math.min(1, Math.max(0, t));
    }
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    const queryStr = "Nanthish S";

    window.updateFrame = function(sec) {
      // 0.0 - 0.5s: Ingoing white fade
      if (sec < 0.5) {
        document.getElementById('whiteFade').style.opacity = lerp(0.8, 0, sec / 0.5);
      } else if (sec >= 9.2) {
        // 9.2 - 10.0s: Outgoing white transition to Student Profile Modal
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 9.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Cursor choreography:
      // 0.0 - 1.8s: Cursor glides from center-bottom to Search Input (right: 450, top: 175)
      // 1.8 - 4.2s: Types "Nanthish S" into search box
      // 4.2 - 5.5s: Rank 1 row highlights with blue container
      // 5.5 - 8.2s: Cursor glides smoothly down to Rank 1 row action (x: 1540, y: 342)
      // 8.2s: Clicks "View Profile", ripple plays, triggers profile open
      let curX = 960;
      let curY = 540;

      if (sec < 1.8) {
        const p = easeInOutCubic(sec / 1.8);
        curX = lerp(750, 1450, p);
        curY = lerp(450, 175, p);
      } else if (sec >= 1.8 && sec < 4.2) {
        curX = 1450;
        curY = 175;
        document.getElementById('searchBox').style.opacity = 1;
        const typeProgress = (sec - 1.8) / 2.0;
        const charCount = Math.floor(lerp(0, queryStr.length, Math.min(1, typeProgress)));
        document.getElementById('searchText').innerText = queryStr.slice(0, charCount);
      } else if (sec >= 4.2 && sec < 5.8) {
        curX = 1450;
        curY = 175;
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = easeInOutCubic((sec - 4.2) / 0.8);
      } else if (sec >= 5.8 && sec < 8.2) {
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = 1;
        // Cursor moves to click action on Rank 1 row
        const p = easeInOutCubic((sec - 5.8) / 2.2);
        curX = lerp(1450, 1540, p);
        curY = lerp(175, 342, p);
      } else {
        curX = 1540;
        curY = 342;
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = 1;
        // Ripple click at 8.3s
        if (sec >= 8.3 && sec < 8.8) {
          const ripProg = (sec - 8.3) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1540px';
          ripple.style.top = '342px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Caption timing
      if (sec >= 0.8 && sec <= 8.8) {
        const capProg = easeInOutCubic(Math.min(1, (sec - 0.8) / 0.8));
        document.getElementById('caption').style.opacity = capProg;
        document.getElementById('caption').style.transform = 'translateX(-50%) translateY(' + lerp(20, 0, capProg) + 'px)';
      } else if (sec > 8.8) {
        document.getElementById('caption').style.opacity = lerp(1, 0, (sec - 8.8) / 0.5);
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

  const totalFrames = 300; // 10.0 seconds @ 30fps
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

  console.log(`[SUCCESS] Scene 04 rendered: ${outFile} (exact 300 frames / 10.000s)`);
  await browser.close();
}

if (require.main === module) {
  renderScene04().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { renderScene04 };
