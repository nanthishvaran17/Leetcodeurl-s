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

const reportShot = getBase64('live_audit_snapshots/07_reports.png');

async function renderScene07() {
  const outFile = path.join(OUT_DIR, 'scene_07_reports.mp4');
  console.log(`[SCENE 07] Rendering Reporting & Evidence (9.000s / 270 frames) -> ${outFile}...`);

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
    /* Simulated Live Report Preview Drawer */
    .preview-drawer {
      position: absolute;
      bottom: 40px;
      left: 20px;
      width: 1880px;
      height: 380px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 20px;
      box-shadow: 0 20px 50px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(0,0,0,0.02);
      display: flex;
      flex-direction: column;
      padding: 20px 28px;
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 60;
    }
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 14px;
      border-bottom: 1px solid #F1F5F9;
    }
    .drawer-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 800;
      color: #0F172A;
    }
    .drawer-badge {
      padding: 3px 10px;
      border-radius: 999px;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      color: #059669;
      font-size: 11px;
      font-weight: 700;
    }
    .export-btns {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .exp-chip {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .chip-excel { background: #ECFDF5; color: #047857; border: 1px solid #6EE7B7; }
    .chip-pdf { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }
    .chip-docx { background: #EFF6FF; color: #1D4ED8; border: 1px solid #93C5FD; }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 12px;
    }
    .preview-table th {
      text-align: left;
      padding: 8px 12px;
      background: #F8FAFC;
      color: #64748B;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
      border-radius: 6px;
    }
    .preview-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #F1F5F9;
      font-weight: 600;
      color: #1E293B;
    }
    .preview-table tr:hover td {
      background: #F8FAFC;
    }
    /* Cursor */
    .mouse-cursor {
      position: absolute;
      width: 22px;
      height: 22px;
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
    }
    .click-ripple {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(124, 58, 237, 0.4);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      pointer-events: none;
      z-index: 99;
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
      background: #059669;
      box-shadow: 0 0 8px rgba(5, 150, 105, 0.6);
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
    <img src="${reportShot}" class="page-shot" alt="Reports Live" />
    
    <!-- Real Live Generated Report Drawer -->
    <div class="preview-drawer" id="previewDrawer">
      <div class="drawer-header">
        <div class="drawer-title">
          <span>Weekly Student Performance Export</span>
          <span class="drawer-badge">Verified Roster &bull; 563 Records</span>
        </div>
        <div class="export-btns">
          <div class="exp-chip chip-excel">&#128196; EXCEL (XLSX)</div>
          <div class="exp-chip chip-pdf">&#128196; EXECUTIVE PDF</div>
          <div class="exp-chip chip-docx">&#128196; WORD (DOCX)</div>
        </div>
      </div>
      <table class="preview-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Roll / Reg No</th>
            <th>Student Name</th>
            <th>Department</th>
            <th>Solved Total</th>
            <th>Contest Rating</th>
            <th>Audit Verification</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:900; color:#F59E0B;">#1</td>
            <td style="font-family:'JetBrains Mono';">732224CC031</td>
            <td style="font-weight:800;">NANTHISH S</td>
            <td>CSE(CS) - III Yr</td>
            <td style="font-weight:900; color:#059669;">914 Solved</td>
            <td>1,928</td>
            <td style="color:#059669; font-weight:700;">&check; Live Synchronized</td>
          </tr>
          <tr>
            <td style="font-weight:900; color:#64748B;">#2</td>
            <td style="font-family:'JetBrains Mono';">732224CI044</td>
            <td style="font-weight:800;">RITHANYA S</td>
            <td>CSE(IOT) - III Yr</td>
            <td style="font-weight:900; color:#059669;">897 Solved</td>
            <td>1,923</td>
            <td style="color:#059669; font-weight:700;">&check; Live Synchronized</td>
          </tr>
          <tr>
            <td style="font-weight:900; color:#B45309;">#3</td>
            <td style="font-family:'JetBrains Mono';">732224IT071</td>
            <td style="font-weight:800;">POOZANA G</td>
            <td>IT - III Yr</td>
            <td style="font-weight:900; color:#059669;">820 Solved</td>
            <td>1,609</td>
            <td style="color:#059669; font-weight:700;">&check; Live Synchronized</td>
          </tr>
          <tr>
            <td style="font-weight:800; color:#64748B;">#4</td>
            <td style="font-family:'JetBrains Mono';">23CC021</td>
            <td style="font-weight:800;">KANISKA N J</td>
            <td>CSE(CS) - IV Yr</td>
            <td style="font-weight:900; color:#059669;">652 Solved</td>
            <td>1,474</td>
            <td style="color:#059669; font-weight:700;">&check; Live Synchronized</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <svg class="mouse-cursor" id="cursor" viewBox="0 0 24 24" fill="none">
    <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>
  <div class="click-ripple" id="ripple"></div>

  <div class="caption-pill" id="caption">
    <span class="caption-dot"></span>
    <span class="caption-text">DATA INTO ACTION.</span>
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
        // 8.2 - 9.0s: Outgoing white fade to sync modal
        document.getElementById('whiteFade').style.opacity = lerp(0, 1, (sec - 8.2) / 0.8);
      } else {
        document.getElementById('whiteFade').style.opacity = 0;
      }

      // Camera orchestration:
      // 0.0 - 3.0s: Overview of Reports & Export Center
      // 3.0 - 6.0s: Focus on Generate Preview and preview reveal
      let scale = 1.0;
      let transY = 0;

      if (sec < 3.2) {
        const p = easeInOutCubic(sec / 3.2);
        scale = lerp(1.0, 1.04, p);
        transY = lerp(0, -10, p);
      } else if (sec >= 3.2 && sec < 6.5) {
        const p = easeInOutCubic((sec - 3.2) / 3.3);
        scale = lerp(1.04, 1.08, p);
        transY = lerp(-10, -25, p);
      } else {
        const p = easeInOutCubic((sec - 6.5) / 2.5);
        scale = lerp(1.08, 1.02, p);
        transY = lerp(-25, -10, p);
      }

      document.getElementById('panBox').style.transform = 'translateY(' + transY + 'px) scale(' + scale + ')';

      // Cursor movement towards "Generate Preview" button (x ~ 1720, y ~ 610)
      let curX = 1400;
      let curY = 480;

      if (sec < 2.5) {
        const p = easeInOutCubic(sec / 2.5);
        curX = lerp(1200, 1720, p);
        curY = lerp(700, 610, p);
      } else if (sec >= 2.5 && sec < 3.3) {
        curX = 1720;
        curY = 610;
        // Click at 2.8s
        if (sec >= 2.8 && sec < 3.2) {
          const ripProg = (sec - 2.8) / 0.4;
          const ripple = document.getElementById('ripple');
          ripple.style.left = '1720px';
          ripple.style.top = '610px';
          ripple.style.opacity = lerp(0.8, 0, ripProg);
          ripple.style.transform = 'translate(-50%, -50%) scale(' + lerp(0, 2.5, ripProg) + ')';
        }
      } else if (sec >= 3.3 && sec < 5.0) {
        // Move towards Excel chip
        const p = easeInOutCubic((sec - 3.3) / 1.7);
        curX = lerp(1720, 1600, p);
        curY = lerp(610, 720, p);
      } else {
        curX = 1600;
        curY = 720;
      }

      document.getElementById('cursor').style.left = curX + 'px';
      document.getElementById('cursor').style.top = curY + 'px';

      // Reveal preview drawer after click
      if (sec >= 3.1) {
        const dProg = easeInOutCubic(Math.min(1, (sec - 3.1) / 0.8));
        const drawer = document.getElementById('previewDrawer');
        drawer.style.opacity = dProg;
        drawer.style.transform = 'translateY(' + lerp(30, 0, dProg) + 'px)';
      }

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

  console.log(`[SUCCESS] Scene 07 rendered: ${outFile} (exact 270 frames / 9.000s)`);
  await browser.close();
}

renderScene07().catch(err => {
  console.error(err);
  process.exit(1);
});
