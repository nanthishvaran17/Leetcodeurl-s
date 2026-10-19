const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testFullRender() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/students...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  
  // Wait explicitly for the page title to be in DOM
  console.log('Waiting for Student Master Directory header...');
  await page.waitForSelector('h1:has-text("Student Master")', { timeout: 30000 });
  console.log('Header rendered!');

  // Wait for the students directory loader to finish
  console.log('Waiting for loading directory to finish...');
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Loading student directory...') && 
           document.querySelectorAll('[style*="position: absolute"]').length > 0;
  }, { timeout: 30000 }).catch(e => console.log('WaitFunction note:', e.message));

  await page.waitForTimeout(2000);
  const shotPath = path.join(__dirname, 'live_audit_snapshots', '05_students_fully_loaded.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved 05_students_fully_loaded.png');

  // Check student rows text
  const studentNames = await page.$$eval('[class*="group"] p, [class*="group"] span', els => 
    els.map(e => e.innerText.trim()).filter(t => t.length > 2 && t === t.toUpperCase())
  );
  console.log('Loaded student names in view:', studentNames.slice(0, 10));

  await browser.close();
}

testFullRender().catch(console.error);
