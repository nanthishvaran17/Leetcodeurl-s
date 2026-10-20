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
    
    /* Pixel-Perfect Overlay directly covering the real "Search by name, reg no..." input box */
    /* Exact verified bounding box: left: 38px, top: 555px, width: 605px, height: 42px */
    .search-input-box {
      position: absolute;
      top: 555px;
      left: 38px;
      width: 605px;
      height: 42px;
      background: #FFFFFF;
      border: 1.5px solid #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      border-radius: 8px;
      display: flex;
      align-items: center;
      padding: 0 14px;
      font-size: 14px;
      font-weight: 600;
      color: #0F172A;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .search-icon-svg {
      width: 16px;
      height: 16px;
      color: #2563EB;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .search-text {
      white-space: nowrap;
      overflow: hidden;
    }
    .search-cursor {
      display: inline-block;
      width: 2px;
      height: 18px;
      background: #2563EB;
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 0.8s infinite;
    }

    /* Pixel-Perfect Highlight Box over Rank 1 (Nanthish S) */
    /* Exact verified row bounding box: top: 770px, left: 14px, width: 1890px, height: 60px */
    .rank1-highlight {
      position: absolute;
      top: 770px;
      left: 14px;
      width: 1890px;
      height: 60px;
      border-radius: 8px;
      border: 2px solid #2563EB;
      background: rgba(37, 99, 235, 0.05);
      box-shadow: 0 4px 18px rgba(37, 99, 235, 0.18);
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
      padding: 3px 12px;
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
      <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
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

      // Exact verified element coordinates:
      // Search input box center: (341, 576), typing start: (140, 576)
      // Rank 1 row action (Eye icon / View Profile): (1746.5, 800.5)
      let curX = 960;
      let curY = 640;

      if (sec < 1.6) {
        // Cursor glides smoothly from center to inside the search input box
        const p = easeInOutCubic(sec / 1.6);
        curX = lerp(850, 140, p);
        curY = lerp(680, 576, p);
      } else if (sec >= 1.6 && sec < 4.2) {
        // Clicks inside the real search input and types "Nanthish S"
        curX = 140;
        curY = 576;
        document.getElementById('searchBox').style.opacity = 1;
        const typeProgress = (sec - 1.6) / 2.0;
        const charCount = Math.floor(lerp(0, queryStr.length, Math.min(1, typeProgress)));
        document.getElementById('searchText').innerText = queryStr.slice(0, charCount);
      } else if (sec >= 4.2 && sec < 5.8) {
        curX = 140;
        curY = 576;
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = easeInOutCubic((sec - 4.2) / 0.8);
      } else if (sec >= 5.8 && sec < 8.2) {
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = 1;
        // Cursor glides smoothly across the row directly to the Eye icon (View Profile) at (1746.5, 800.5)
        const p = easeInOutCubic((sec - 5.8) / 2.2);
        curX = lerp(140, 1746.5, p);
        curY = lerp(576, 800.5, p);
      } else {
        curX = 1746.5;
        curY = 800.5;
        document.getElementById('searchBox').style.opacity = 1;
        document.getElementById('searchText').innerText = queryStr;
        document.getElementById('rank1Box').style.opacity = 1;
        // Ripple click on Eye icon at 8.3s
        if (sec >= 8.3 && sec < 8.8) {
          const ripProg = (sec - 8.3) / 0.5;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1746.5px';
          ripple.style.top = '800.5px';
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
    '-loglevel', 'error',
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
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

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
