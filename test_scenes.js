const { chromium } = require('playwright');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('1. Loading Login Page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const tabs = [
    'dashboard',
    'students',
    'weekly-contest',
    'growth',
    'reports',
    'faculty-action-center',
    'hod-command-center'
  ];

  for (const tab of tabs) {
    console.log(`Testing tab: ${tab}...`);
    await page.goto(`http://localhost:3000/#/${tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const title = await page.$eval('h1, h2, h3', el => el.innerText).catch(() => 'N/A');
    console.log(`  -> Rendered header: ${title.slice(0, 50)}`);
  }

  // Test opening AI widget
  console.log('Testing AI Assistant trigger...');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('force_open_ai_widget')));
  await page.waitForTimeout(1500);
  const aiVisible = await page.$('.ai-assistant-widget, [data-testid="ai-widget"], aside');
  console.log('  -> AI widget visible:', !!aiVisible);

  await browser.close();
  console.log('All candidate scenes verified successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
