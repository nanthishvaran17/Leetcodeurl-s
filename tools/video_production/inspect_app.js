const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "import sys, os; sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), '../..'))); from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8', cwd: __dirname }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

const SNAPSHOTS_DIR = path.resolve(__dirname, 'live_audit_snapshots');
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

async function inspect() {
  console.log('--- Inspecting live application at http://13.53.231.6/ ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // 1. Visit Login Page
  console.log('[1] Loading Login page...');
  await page.goto('http://13.53.231.6/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '01_login_page.png') });
  console.log('Saved 01_login_page.png');
  console.log('Current URL:', page.url());

  // Check inputs
  const inputs = await page.$$eval('input', els => els.map(e => ({ id: e.id, name: e.name, type: e.type, placeholder: e.placeholder })));
  console.log('Inputs found:', inputs);

  // 2. Perform Login
  const creds = getAdminCredentials();
  console.log('[2] Filling credentials...');
  
  // Try locating inputs by id or placeholder or type
  const userInput = (await page.$('#userId')) || (await page.$('input[name="username"]')) || (await page.$('input[type="text"]'));
  const passInput = (await page.$('#password')) || (await page.$('input[name="password"]')) || (await page.$('input[type="password"]'));
  const submitBtn = (await page.$('button[type="submit"]')) || (await page.$('button:has-text("Sign In")')) || (await page.$('button:has-text("Login")'));

  if (userInput && passInput && submitBtn) {
    await userInput.fill(creds.username);
    await passInput.fill(creds.password);
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '02_login_filled.png') });
    console.log('Clicking submit...');
    await submitBtn.click();
    await page.waitForTimeout(4000);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  } else {
    console.log('Could not find standard login elements directly, checking DOM...');
  }

  console.log('Post-login URL:', page.url());
  await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '03_after_login.png') });

  // 3. Inspect navigation & accessible pages
  const navItems = await page.$$eval('nav a, aside a, header a, [role="navigation"] a, button', els => 
    els.map(e => ({ text: e.innerText.trim(), href: e.getAttribute('href') })).filter(e => e.text.length > 0)
  );
  console.log('Navigation elements found:', navItems.slice(0, 25));

  // Check local storage
  const storage = await page.evaluate(() => {
    const s = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      s[k] = localStorage.getItem(k);
    }
    return s;
  });
  console.log('LocalStorage keys:', Object.keys(storage));

  // Save auth state for subsequent recordings
  const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');
  fs.mkdirSync(path.dirname(authStatePath), { recursive: true });
  await context.storageState({ path: authStatePath });
  console.log('Auth state saved to:', authStatePath);

  // 4. Test key URLs:
  const routesToTest = [
    { name: '04_dashboard', url: 'http://13.53.231.6/#/dashboard' },
    { name: '05_leaderboard_students', url: 'http://13.53.231.6/#/students' },
    { name: '06_contests', url: 'http://13.53.231.6/#/contests' },
    { name: '07_reports', url: 'http://13.53.231.6/#/reports' },
    { name: '08_growth', url: 'http://13.53.231.6/#/growth' },
    { name: '09_departments', url: 'http://13.53.231.6/#/departments' },
    { name: '10_public_kiosk', url: 'http://13.53.231.6/#/public' },
    { name: '11_settings', url: 'http://13.53.231.6/#/settings' }
  ];

  for (const r of routesToTest) {
    try {
      console.log(`Navigating to ${r.name}: ${r.url}`);
      await page.goto(r.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2500);
      const shotPath = path.join(SNAPSHOTS_DIR, `${r.name}.png`);
      await page.screenshot({ path: shotPath });
      console.log(`Saved screenshot: ${shotPath}`);
    } catch (e) {
      console.log(`Failed navigating to ${r.name}:`, e.message);
    }
  }

  await browser.close();
  console.log('Inspection complete!');
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
