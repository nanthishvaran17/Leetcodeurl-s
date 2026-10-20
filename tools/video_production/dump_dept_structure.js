const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function dumpDept() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, 'output', 'live_auth_state.json')
  });
  const page = await context.newPage();

  await page.goto('http://13.53.231.6/#/departments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(__dirname, 'output', 'debug_departments.png') });
  console.log('Saved debug_departments.png');

  const inputs = await page.$$eval('input', els => els.map(e => ({ placeholder: e.placeholder, rect: e.getBoundingClientRect() })));
  console.log('Dept inputs:', inputs);

  const buttons = await page.$$eval('button', els => els.map(e => ({ text: e.innerText.trim(), rect: e.getBoundingClientRect() })));
  console.log('Dept buttons:', buttons.slice(0, 15));

  await browser.close();
}

dumpDept().catch(console.error);
