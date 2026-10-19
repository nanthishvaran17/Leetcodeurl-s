const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testStudentGrid() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/students...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  
  // Wait for the loader to disappear
  console.log('Waiting for loader to disappear...');
  await page.waitForSelector('text=Loading student directory...', { state: 'detached', timeout: 20000 });
  console.log('Loader disappeared! Content rendered.');

  await page.waitForTimeout(1000);
  const shotPath = path.join(__dirname, 'live_audit_snapshots', '05_students_verified.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved 05_students_verified.png');

  // Find clickable student row or button
  const studentBtn = page.locator('button:has-text("Profile"), div:has-text("AAKASH")').first();
  if (await studentBtn.count() > 0) {
    console.log('Clicking student profile...');
    await studentBtn.click();
    await page.waitForTimeout(3000);
    const profileShot = path.join(__dirname, 'live_audit_snapshots', '05d_profile_verified.png');
    await page.screenshot({ path: profileShot });
    console.log('Saved 05d_profile_verified.png');
  }

  await browser.close();
  console.log('Done testStudentGrid');
}

testStudentGrid().catch(console.error);
