const { chromium } = require('playwright');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Now navigate to integrity-monitor
  await page.goto('http://localhost:3000/#/integrity-monitor', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const overlay = await page.$('vite-error-overlay');
  console.log('vite-error-overlay present on logged-in integrity-monitor?', !!overlay);
  await page.screenshot({ path: 'output/preview_snapshots/check_live_integrity_logged_in.png' });
  await browser.close();
})();
