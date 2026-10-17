const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function verifyAllRoutes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('1. Performing fresh login...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  const authFile = path.join(__dirname, 'output', 'auth_state.json');
  await context.storageState({ path: authFile });
  console.log('Saved fresh authState with valid JWT to:', authFile);

  const routes = [
    { name: '03_dashboard', url: 'http://localhost:3000/#/dashboard' },
    { name: '04_students', url: 'http://localhost:3000/#/students' },
    { name: '06_departments', url: 'http://localhost:3000/#/departments' },
    { name: '07_compare', url: 'http://localhost:3000/#/compare' },
    { name: '08_weekly_contest', url: 'http://localhost:3000/#/weekly-contest' },
    { name: '09_integrity', url: 'http://localhost:3000/#/integrity-monitor' },
    { name: '10_growth', url: 'http://localhost:3000/#/growth' },
    { name: '11_hr_finder', url: 'http://localhost:3000/#/hr-candidate-finder' },
    { name: '12_reports', url: 'http://localhost:3000/#/reports' },
    { name: '13_faculty', url: 'http://localhost:3000/#/faculty-action-center' },
    { name: '14_ai_control', url: 'http://localhost:3000/#/ai-control' }
  ];

  const snapDir = path.join(__dirname, 'output', 'preview_snapshots', 'verified');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });

  for (const r of routes) {
    await page.goto(r.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const snapPath = path.join(snapDir, `${r.name}.png`);
    await page.screenshot({ path: snapPath });
    const isLogin = await page.$('#userId');
    console.log(`Route ${r.name}: isLogin = ${!!isLogin} (saved ${snapPath})`);
  }

  await context.close();
  await browser.close();
}

verifyAllRoutes().catch(console.error);
