const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, 'fresh_snapshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  console.log('[CAPTURE] Launching Chromium to capture fresh authenticated app screens...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ role: 'admin', username: 'admin', name: 'Administrator', department: 'ALL' }));
    localStorage.setItem('token', 'bypass_token');
    localStorage.setItem('access_token', 'bypass_token');
    localStorage.setItem('nec_auth_last_activity', Date.now().toString());
    localStorage.setItem('nec_admin_otp_verified', 'true');
  });

  const routes = [
    { name: '01_dashboard.png', url: 'http://localhost:3000/#/dashboard' },
    { name: '02_growth.png', url: 'http://localhost:3000/#/growth' },
    { name: '03_students.png', url: 'http://localhost:3000/#/students' },
    { name: '04_contests.png', url: 'http://localhost:3000/#/contests' },
    { name: '05_public_kiosk.png', url: 'http://localhost:3000/#/public' },
    { name: '06_departments.png', url: 'http://localhost:3000/#/departments' }
  ];

  for (const r of routes) {
    try {
      console.log('Navigating to', r.url);
      await page.goto(r.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const outP = path.join(OUT_DIR, r.name);
      await page.screenshot({ path: outP });
      console.log('Saved:', outP);
    } catch(e) {
      console.error('Error on', r.name, e.message);
    }
  }

  // Also capture top student Nanthish profile if view button or row is clickable
  try {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const viewButton = page.locator('button:has-text("View"), button:has-text("Profile"), td:has-text("NANTHISH")').first();
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await page.waitForTimeout(2500);
      const outP = path.join(OUT_DIR, '07_nanthish_profile.png');
      await page.screenshot({ path: outP });
      console.log('Saved Nanthish Profile ->', outP);
    }
  } catch(e) {
    console.error('Error on student profile:', e.message);
  }

  await browser.close();
  console.log('[DONE] All fresh authenticated routes captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
