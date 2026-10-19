const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testEyeClick() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/students...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  
  await page.waitForSelector('h1:has-text("Student Master")', { timeout: 30000 });
  console.log('Waiting for visible desktop student row...');
  const desktopStudent = page.locator('button:has-text("AAKASH SHIVA KB"):visible, p:has-text("AAKASH SHIVA KB"):visible').first();
  await desktopStudent.waitFor({ state: 'visible', timeout: 30000 });
  console.log('AAKASH SHIVA KB desktop row visible!');

  console.log('Clicking AAKASH name / eye button...');
  await desktopStudent.click();

  await page.waitForTimeout(3000);
  const profileShot = path.join(__dirname, 'live_audit_snapshots', '05e_aakash_profile.png');
  await page.screenshot({ path: profileShot });
  console.log('Saved 05e_aakash_profile.png! URL is:', page.url());

  // Also check flip card mode!
  console.log('Testing CARDS view mode...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button:has-text("Cards")', { timeout: 30000 });
  await page.click('button:has-text("Cards")');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'live_audit_snapshots', '05f_student_cards_view.png') });
  console.log('Saved 05f_student_cards_view.png');

  await browser.close();
}

testEyeClick().catch(console.error);
