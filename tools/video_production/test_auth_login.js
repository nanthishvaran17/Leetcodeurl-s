const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testAuth() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('http://13.53.231.6/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="text"]').fill('admin');
  await page.locator('input[type="password"]').fill('AdminPass123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  console.log('Post-login URL:', page.url());
  const token = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('nec_auth_token'));
  console.log('Token exists:', !!token);

  if (page.url() !== 'http://13.53.231.6/') {
    const authState = await context.storageState();
    fs.writeFileSync(path.join(__dirname, 'output', 'live_auth_state.json'), JSON.stringify(authState, null, 2));
    console.log('Saved fresh live_auth_state.json!');
  } else {
    // Try nanthishvaran17
    console.log('Trying nanthishvaran17 with AdminPass123! ...');
    await page.locator('input[type="text"]').fill('nanthishvaran17');
    await page.locator('input[type="password"]').fill('AdminPass123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    console.log('Post-login URL 2:', page.url());
    const token2 = await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('nec_auth_token'));
    console.log('Token 2 exists:', !!token2);
    if (page.url() !== 'http://13.53.231.6/') {
      const authState = await context.storageState();
      fs.writeFileSync(path.join(__dirname, 'output', 'live_auth_state.json'), JSON.stringify(authState, null, 2));
      console.log('Saved fresh live_auth_state.json!');
    }
  }

  await browser.close();
}

testAuth().catch(console.error);
