const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function debugStudentsPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure() ? req.failure().errorText : ''));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('HTTP ERROR:', resp.status(), resp.url());
    }
  });

  console.log('Visiting #/students...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Check what HTML is inside the main container
  const html = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.innerHTML.slice(0, 1000) : document.body.innerHTML.slice(0, 1000);
  });
  console.log('MAIN HTML EXCERPT:', html);

  await browser.close();
}

debugStudentsPage().catch(console.error);
