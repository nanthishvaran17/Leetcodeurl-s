const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function dump() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, 'output', 'live_auth_state.json')
  });
  const page = await context.newPage();

  await page.goto('http://13.53.231.6/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(__dirname, 'output', 'debug_dashboard.png') });
  console.log('Saved debug_dashboard.png');

  const links = await page.$$eval('a', els => els.map(e => ({ text: e.innerText.trim(), href: e.href, rect: e.getBoundingClientRect() })));
  console.log('All links:', links.slice(0, 15));

  const buttons = await page.$$eval('button', els => els.map(e => ({ text: e.innerText.trim(), rect: e.getBoundingClientRect() })));
  console.log('All buttons:', buttons.slice(0, 15));

  await browser.close();
}

dump().catch(console.error);
