const fs = require('fs');
const path = require('path');

const brandScenesDir = path.join(__dirname, 'output', 'brand_scenes');
if (!fs.existsSync(brandScenesDir)) fs.mkdirSync(brandScenesDir, { recursive: true });

const introHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nandha LeetCode Intelligence - Intro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 35%, #111e38 0%, #080c16 65%, #04060b 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      position: relative;
    }
    /* Subtle geometric grid */
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 45%, black 40%, transparent 80%);
    }
    .ambient-glow {
      position: absolute;
      width: 750px;
      height: 750px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%);
      filter: blur(80px);
      pointer-events: none;
      top: 15%;
    }
    .content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      animation: fadeInScale 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeInScale {
      0% { opacity: 0; transform: scale(0.94) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 24px;
      border-radius: 9999px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38BDF8;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-bottom: 36px;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.2);
    }
    .badge-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #38BDF8;
      box-shadow: 0 0 10px #38BDF8;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.6; }
    }
    .logo-container {
      margin-bottom: 24px;
      filter: drop-shadow(0 0 35px rgba(56, 189, 248, 0.35));
    }
    h1 {
      font-size: 64px;
      font-weight: 900;
      letter-spacing: -1px;
      line-height: 1.1;
      margin-bottom: 18px;
      background: linear-gradient(135deg, #FFFFFF 30%, #BAE6FD 70%, #7DD3FC 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .tagline {
      font-size: 26px;
      font-weight: 500;
      color: #94A3B8;
      letter-spacing: 0.5px;
      margin-bottom: 40px;
    }
    .tagline strong {
      color: #38BDF8;
      font-weight: 700;
    }
    .footer-institution {
      display: flex;
      align-items: center;
      gap: 16px;
      color: #64748B;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 24px;
      width: 580px;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>
  <div class="content">
    <div class="logo-container">
      <svg width="105" height="105" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="48" fill="#0A192F" stroke="#38BDF8" stroke-width="2.5" />
        <circle cx="50" cy="50" r="45" stroke="#FFFFFF" stroke-width="1.5" />
        <text x="50" y="44" fill="#FFFFFF" font-size="32" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="-1">25</text>
        <text x="50" y="52" fill="#38BDF8" font-size="4.2" font-weight="bold" font-family="sans-serif" text-anchor="middle" letter-spacing="0.2">YEARS OF EXCELLENCE</text>
        <text x="50" y="65" fill="#FFFFFF" font-size="12" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="0.5">NEC</text>
        <text x="50" y="75" fill="#E0F2FE" font-size="4.5" font-weight="800" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="0.8">RISING HIGHER</text>
        <text x="50" y="82" fill="#FFFFFF" font-size="5" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="1">EVERYDAY</text>
      </svg>
    </div>
    <div class="badge">
      <span class="badge-dot"></span>
      INSTITUTIONAL TRACKING SYSTEM
    </div>
    <h1>NANDHA LEETCODE INTELLIGENCE</h1>
    <p class="tagline">Every Contest. <strong>Every Insight.</strong> Every Opportunity.</p>
    <div class="footer-institution">
      <span>Nandha Engineering College (Autonomous)</span>
      <span>•</span>
      <span>Erode, Tamil Nadu</span>
    </div>
  </div>
</body>
</html>`;

const outroHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nandha LeetCode Intelligence - Outro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 40%, #0d1a33 0%, #060a14 65%, #030408 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      position: relative;
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(circle at 50% 50%, black 45%, transparent 85%);
    }
    .ambient-glow {
      position: absolute;
      width: 850px;
      height: 850px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 70%);
      filter: blur(90px);
      pointer-events: none;
      top: 12%;
    }
    .content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      animation: fadeInScale 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeInScale {
      0% { opacity: 0; transform: scale(0.95) translateY(15px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .logo-container {
      margin-bottom: 28px;
      filter: drop-shadow(0 0 40px rgba(56, 189, 248, 0.4));
    }
    .motto {
      display: inline-flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 28px;
    }
    .motto-word {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #38BDF8;
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 8px 20px;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.15);
    }
    h1 {
      font-size: 60px;
      font-weight: 900;
      letter-spacing: -0.8px;
      line-height: 1.1;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #FFFFFF 25%, #E0F2FE 60%, #38BDF8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    .subtext {
      font-size: 24px;
      font-weight: 500;
      color: #94A3B8;
      letter-spacing: 0.5px;
      margin-bottom: 44px;
    }
    .pills-container {
      display: flex;
      gap: 20px;
      margin-bottom: 40px;
    }
    .pill {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      color: #CBD5E1;
      font-weight: 600;
    }
    .pill-icon {
      color: #10B981;
    }
    .footer {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 24px;
      width: 600px;
      display: flex;
      justify-content: center;
      gap: 16px;
      color: #64748B;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="ambient-glow"></div>
  <div class="content">
    <div class="logo-container">
      <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="48" fill="#0A192F" stroke="#38BDF8" stroke-width="2.5" />
        <circle cx="50" cy="50" r="45" stroke="#FFFFFF" stroke-width="1.5" />
        <text x="50" y="44" fill="#FFFFFF" font-size="32" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="-1">25</text>
        <text x="50" y="52" fill="#38BDF8" font-size="4.2" font-weight="bold" font-family="sans-serif" text-anchor="middle" letter-spacing="0.2">YEARS OF EXCELLENCE</text>
        <text x="50" y="65" fill="#FFFFFF" font-size="12" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="0.5">NEC</text>
        <text x="50" y="75" fill="#E0F2FE" font-size="4.5" font-weight="800" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="0.8">RISING HIGHER</text>
        <text x="50" y="82" fill="#FFFFFF" font-size="5" font-weight="900" font-family="Times New Roman, serif" text-anchor="middle" letter-spacing="1">EVERYDAY</text>
      </svg>
    </div>
    <div class="motto">
      <span class="motto-word">CODE</span>
      <span class="motto-word">COMPETE</span>
      <span class="motto-word">IMPROVE</span>
    </div>
    <h1>NANDHA LEETCODE INTELLIGENCE</h1>
    <p class="subtext">Smarter Institutional Coding Progress Tracking</p>
    <div class="pills-container">
      <div class="pill">
        <span class="pill-icon">✓</span>
        <span>560+ Active Student Profiles</span>
      </div>
      <div class="pill">
        <span class="pill-icon">✓</span>
        <span>Verified Sunday Contest Telemetry</span>
      </div>
      <div class="pill">
        <span class="pill-icon">✓</span>
        <span>Zero Mock Data • 100% On-Record</span>
      </div>
    </div>
    <div class="footer">
      <span>Nandha Engineering College (Autonomous)</span>
      <span>•</span>
      <span>Erode, Tamil Nadu</span>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(brandScenesDir, 'scene_01_intro.html'), introHtml);
fs.writeFileSync(path.join(brandScenesDir, 'scene_11_outro.html'), outroHtml);

console.log('Brand scenes HTML generated successfully in', brandScenesDir);
