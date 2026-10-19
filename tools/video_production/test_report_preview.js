const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testReportPreview() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/reports...');
  await page.goto('http://13.53.231.6/#/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const previewBtn = page.locator('button:has-text("Generate Preview"), button:has-text("Preview")').first();
  if (await previewBtn.count() > 0) {
    console.log('Clicking Generate Preview...');
    await previewBtn.click();
    await page.waitForTimeout(4000);
    const shotPath = path.join(__dirname, 'live_audit_snapshots', '07_reports_preview_generated.png');
    await page.screenshot({ path: shotPath });
    console.log('Saved 07_reports_preview_generated.png');
  }

  await browser.close();
}

testReportPreview().catch(console.error);
