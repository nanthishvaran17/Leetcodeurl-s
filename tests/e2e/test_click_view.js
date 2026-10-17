const { chromium } = require('playwright');
const path = require('path');

async function testClick() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: path.join(__dirname, 'output', 'auth_state.json'),
    viewport: { width: 1920, height: 1080 }
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);

  const btns = await p.locator('button[title="View"]').count();
  console.log('View buttons count:', btns);

  if (btns > 0) {
    const btn = p.locator('button[title="View"]').first();
    console.log('Clicking first view button...');
    await btn.click({ force: true });
    await p.waitForTimeout(2000);

    const dialogCount = await p.locator('.fixed.inset-0').count();
    console.log('Fixed overlay count:', dialogCount);

    await p.screenshot({ path: path.join(__dirname, 'output', 'preview_snapshots', 'test_modal_click.png') });
  }

  await ctx.close();
  await browser.close();
}

testClick().catch(console.error);
