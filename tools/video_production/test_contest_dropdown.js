const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testContestDropdown() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/contests...');
  await page.goto('http://13.53.231.6/#/contests', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Look for the session selector dropdown button
  const sessionDropdown = page.locator('button:has-text("[ Select Session ]"), button:has-text("Session"), button:has-text("Weekly Contest")').first();
  if (await sessionDropdown.count() > 0) {
    console.log('Clicking session dropdown...');
    await sessionDropdown.click();
    await page.waitForTimeout(1000);
    const options = await page.$$eval('[role="option"], [role="menuitem"], li, button', els => els.map(e => e.innerText.trim()).filter(t => t.includes('Weekly') || t.includes('Contest')));
    console.log('Available contest options:', options.slice(0, 15));
    
    // Select one that has data if available
    const itemToClick = page.locator('button:has-text("Weekly Contest"), li:has-text("Weekly Contest")').first();
    if (await itemToClick.count() > 0) {
      await itemToClick.click();
      await page.waitForTimeout(3000);
    }
  }

  await page.screenshot({ path: path.join(__dirname, 'live_audit_snapshots', '06_contests_active.png') });
  console.log('Saved 06_contests_active.png');

  await browser.close();
}

testContestDropdown().catch(console.error);
