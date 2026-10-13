const { chromium } = require('playwright');
const path = require('path');

async function checkNewRoutes() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, 'output', 'auth_state.json'),
    viewport: { width: 1920, height: 1080 }
  });
  const page = await ctx.newPage();

  const newRoutes = [
    { name: 'departments', tab: 'departments' },
    { name: 'compare', tab: 'compare' },
    { name: 'integrity', tab: 'integrity-monitor' }
  ];

  for (const r of newRoutes) {
    console.log(`Checking route: ${r.tab}...`);
    await page.goto(`http://localhost:3000/#/${r.tab}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const snapPath = path.join(__dirname, 'output', 'preview_snapshots', `check_${r.name}.png`);
    await page.screenshot({ path: snapPath });
    console.log(`Saved screenshot to ${snapPath}`);
  }

  await ctx.close();
  await browser.close();
}

checkNewRoutes().catch(console.error);
