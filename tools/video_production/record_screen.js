const path = require('path');
const fs = require('fs');

// Add ffmpeg to PATH so Playwright video recording flushes properly
const ffmpegDir = 'C:\\Users\\Nanth\\AppData\\Roaming\\Python\\Python314\\site-packages\\imageio_ffmpeg\\binaries';
if (fs.existsSync(ffmpegDir)) {
  process.env.PATH = `${ffmpegDir};${process.env.PATH}`;
}

const { chromium } = require('playwright');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

// Smooth cursor simulator
async function smoothMove(page, targetX, targetY, steps = 18) {
  await page.mouse.move(targetX, targetY, { steps });
}

async function recordSession() {
  const rawDir = path.join(__dirname, 'output', 'raw');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

  console.log('Launching Chromium with Playwright video recorder at 1920x1080...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  console.log('--- SCENE 1: Real Login Page ---');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Smooth hover over branding and live badges
  await smoothMove(page, 220, 95);
  await page.waitForTimeout(800);
  await smoothMove(page, 160, 410);
  await page.waitForTimeout(800);

  // Enter credentials securely
  const creds = getAdminCredentials();
  console.log('Typing credentials into authorized inputs...');
  await smoothMove(page, 1360, 420);
  await page.click('#userId');
  await page.type('#userId', creds.username, { delay: 90 });
  await page.waitForTimeout(400);

  await smoothMove(page, 1360, 510);
  await page.click('#password');
  await page.type('#password', creds.password, { delay: 90 });
  await page.waitForTimeout(500);

  console.log('Submitting login form...');
  await smoothMove(page, 1360, 630);
  await page.click('button[type="submit"]');

  console.log('--- SCENE 2: Executive Dashboard ---');
  await page.waitForTimeout(4500); // Allow transition and data to settle
  await smoothMove(page, 960, 180);
  await page.waitForTimeout(800);

  // Hover over the 4 primary KPI cards
  await smoothMove(page, 130, 400);
  await page.waitForTimeout(600);
  await smoothMove(page, 380, 400);
  await page.waitForTimeout(600);
  await smoothMove(page, 620, 400);
  await page.waitForTimeout(600);
  await smoothMove(page, 860, 400);
  await page.waitForTimeout(800);

  // Smooth scroll down to Performance Trajectory
  await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  console.log('--- SCENE 3: Student Master Directory & Profiles ---');
  await page.goto('http://localhost:3000/#/students', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await smoothMove(page, 300, 240);
  await page.waitForTimeout(600);

  // Hover over top leaderboard rows
  await smoothMove(page, 500, 545);
  await page.waitForTimeout(700);
  await smoothMove(page, 500, 615);
  await page.waitForTimeout(700);

  // Open Student Profile Modal
  console.log('Inspecting top student profile...');
  const viewButton = await page.$('tbody tr:first-child [title*="View"], tbody tr:first-child button, tbody tr:first-child svg');
  if (viewButton) {
    const box = await viewButton.boundingBox();
    if (box) {
      await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2);
      await viewButton.click().catch(() => {});
      await page.waitForTimeout(2500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
    }
  }

  console.log('--- SCENE 4: Weekly Contest Tracker ---');
  await page.goto('http://localhost:3000/#/weekly-contest', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await smoothMove(page, 300, 140);
  await page.waitForTimeout(700);
  await smoothMove(page, 300, 560);
  await page.waitForTimeout(1000);
  await smoothMove(page, 960, 560);
  await page.waitForTimeout(1000);

  console.log('--- SCENE 5: Growth Intelligence & Solved Trends ---');
  await page.goto('http://localhost:3000/#/growth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const allTimeBtn = await page.$('button:has-text("All Time")');
  if (allTimeBtn) {
    const box = await allTimeBtn.boundingBox();
    if (box) {
      await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2);
      await allTimeBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }
  } else {
    await page.waitForTimeout(2000);
  }

  console.log('--- SCENE 6: Reports & Export Center ---');
  await page.goto('http://localhost:3000/#/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await smoothMove(page, 960, 500);
  await page.waitForTimeout(1500);

  console.log('--- SCENE 7: Faculty Action Center & Mentorship ---');
  await page.goto('http://localhost:3000/#/faculty-action-center', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await smoothMove(page, 300, 320);
  await page.waitForTimeout(1000);
  await smoothMove(page, 960, 650);
  await page.waitForTimeout(1500);

  console.log('--- SCENE 8: Institutional AI Control Center ---');
  await page.goto('http://localhost:3000/#/ai-control', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await smoothMove(page, 450, 540);
  await page.waitForTimeout(1000);
  await smoothMove(page, 1350, 540);
  await page.waitForTimeout(1500);

  console.log('--- SCENE 9: Placement & Hiring Portal ---');
  await page.goto('http://localhost:3000/#/hr-candidate-finder', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await smoothMove(page, 960, 450);
  await page.waitForTimeout(1200);

  console.log('Closing page and flushing video recording...');
  const videoObj = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    console.log(`Video flushed successfully to: ${videoPath}`);
    return videoPath;
  }

  const files = fs.readdirSync(rawDir);
  const webm = files.find(f => f.endsWith('.webm'));
  if (webm) return path.join(rawDir, webm);
  throw new Error('Video recording file not found');
}

recordSession().then(file => {
  console.log('Screen recording completed successfully:', file);
}).catch(err => {
  console.error('Recording error:', err);
  process.exit(1);
});
