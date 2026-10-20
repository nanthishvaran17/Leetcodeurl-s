const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testInteractions() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, 'output', 'live_auth_state.json')
  });
  const page = await context.newPage();

  console.log('1. Loading Dashboard...');
  await page.goto('http://13.53.231.6/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Click Sync Engine Status
  console.log('2. Clicking Sync Engine Status button...');
  const syncBtn = page.locator('button:has-text("Sync Engine Status")');
  const syncBox = await syncBtn.boundingBox();
  console.log('Sync Button Box:', syncBox);
  if (syncBox) {
    await syncBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(__dirname, 'output', 'test_sync_modal_live.png') });
    console.log('Saved test_sync_modal_live.png!');
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Go to Growth page
  console.log('3. Loading Growth Intelligence Page...');
  await page.goto('http://13.53.231.6/#/growth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Locate Search Input on Growth Page
  const searchInput = page.locator('input[placeholder*="Search"]');
  const searchBox = await searchInput.boundingBox();
  console.log('Growth Search Box:', searchBox);
  if (searchBox) {
    await searchInput.click();
    await searchInput.type('Nanthish', { delay: 100 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(__dirname, 'output', 'test_growth_search_live.png') });
    console.log('Saved test_growth_search_live.png!');
  }

  // Go to Kiosk
  console.log('4. Loading Kiosk / Hall of Fame Page...');
  await page.goto('http://13.53.231.6/#/kiosk', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(__dirname, 'output', 'test_kiosk_live.png') });
  console.log('Saved test_kiosk_live.png!');

  await browser.close();
}

testInteractions().catch(console.error);
