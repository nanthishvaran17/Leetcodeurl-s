const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const OUT_DIR = path.resolve(__dirname, 'fresh_snapshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

function getAdminCredentials() {
  try {
    const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
    const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
    return { username: output[0], password: output[1] };
  } catch (e) {
    return { username: 'admin', password: 'password123' };
  }
}

async function capture() {
  console.log('[CAPTURE] Launching Chromium to capture fresh authenticated app screens...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // 0. Login
  try {
    const creds = getAdminCredentials();
    console.log('[AUTH] Logging in with user:', creds.username);
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    
    // Check if on login page
    const userInput = page.locator('#userId, input[type="text"], input[name="username"]').first();
    if (await userInput.count() > 0) {
      await userInput.fill(creds.username);
      const passInput = page.locator('#password, input[type="password"]').first();
      await passInput.fill(creds.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      console.log('[AUTH] Logged in successfully!');
    }
  } catch (e) {
    console.error('[AUTH ERROR]:', e.message);
  }

  // 1. Dashboard
  try {
    await page.goto('http://localhost:3000/#/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const p1 = path.join(OUT_DIR, '01_dashboard.png');
    await page.screenshot({ path: p1 });
    console.log('[OK] Captured Dashboard ->', p1);
  } catch (e) {
    console.error('Error on Dashboard:', e.message);
  }

  // 2. Growth Intelligence
  try {
    await page.goto('http://localhost:3000/#/growth', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2500);
    const p2 = path.join(OUT_DIR, '02_growth.png');
    await page.screenshot({ path: p2 });
    console.log('[OK] Captured Growth ->', p2);
  } catch (e) {
    console.error('Error on Growth:', e.message);
  }

  // 3. Student Profile
  try {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    // Find first student row / view button
    const viewBtn = page.locator('text=View Profile, text=Details, button:has-text("View")').first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await page.waitForTimeout(2000);
    }
    const p3 = path.join(OUT_DIR, '03_profile.png');
    await page.screenshot({ path: p3 });
    console.log('[OK] Captured Profile ->', p3);
  } catch (e) {
    console.error('Error on Profile:', e.message);
  }

  // 4. Weekly Contest
  try {
    await page.goto('http://localhost:3000/#/contests', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const p4 = path.join(OUT_DIR, '04_contests.png');
    await page.screenshot({ path: p4 });
    console.log('[OK] Captured Contests ->', p4);
  } catch (e) {
    console.error('Error on Contests:', e.message);
  }

  // 5. Public Auditorium Kiosk / Leaderboard
  try {
    await page.goto('http://localhost:3000/#/public', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const p5 = path.join(OUT_DIR, '05_public_kiosk.png');
    await page.screenshot({ path: p5 });
    console.log('[OK] Captured Public Kiosk ->', p5);
  } catch (e) {
    console.error('Error on Public Kiosk:', e.message);
  }

  await browser.close();
  console.log('[DONE] Fresh authenticated snapshots complete!');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
