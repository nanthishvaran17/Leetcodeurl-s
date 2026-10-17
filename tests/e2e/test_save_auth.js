const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function testAuthSave() {
  const authFile = path.join(__dirname, 'output', 'auth_state.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('Logging in to capture auth state...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  await context.storageState({ path: authFile });
  await context.close();
  await browser.close();

  console.log('Saved auth state successfully to:', authFile);
}

testAuthSave().catch(console.error);
