const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function main() {
  const outDir = path.join(__dirname, 'output', 'preview_snapshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Capturing Login Page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '01_login.png') });

  console.log('Logging in...');
  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const routes = [
    { name: '02_dashboard', tab: 'dashboard' },
    { name: '03_students', tab: 'students' },
    { name: '04_weekly_contest', tab: 'weekly-contest' },
    { name: '05_growth', tab: 'growth' },
    { name: '06_reports', tab: 'reports' },
    { name: '07_faculty_action', tab: 'faculty-action-center' },
    { name: '08_ai_control', tab: 'ai-control' },
    { name: '09_hod_command', tab: 'hod-command-center' },
    { name: '10_integrity_monitor', tab: 'integrity-monitor' },
    { name: '11_hr_candidate_finder', tab: 'hr-candidate-finder' }
  ];

  for (const r of routes) {
    console.log(`Navigating to ${r.tab}...`);
    await page.goto(`http://localhost:3000/#/${r.tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, `${r.name}.png`) });
  }

  await browser.close();
  console.log('Screenshots captured successfully in', outDir);
}

main().catch(console.error);
