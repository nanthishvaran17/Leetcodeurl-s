const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function testStudents() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/students...');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  
  // Wait for table rows to appear
  console.log('Waiting for table rows...');
  try {
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    console.log('Table rows found!');
  } catch (e) {
    console.log('Selector table tbody tr timeout:', e.message);
  }

  await page.waitForTimeout(2000);
  const rows = await page.$$eval('table tbody tr', els => els.map(e => e.innerText.replace(/\n+/g, ' | ')));
  console.log(`Found ${rows.length} rows.`);
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    console.log(`Row ${i+1}:`, rows[i]);
  }

  await page.screenshot({ path: path.join(__dirname, 'live_audit_snapshots', '05_students_loaded.png') });
  console.log('Saved 05_students_loaded.png');

  // Try clicking a student row or view button to open profile
  const firstRow = await page.$('table tbody tr:first-child');
  if (firstRow) {
    console.log('Clicking first student row...');
    await firstRow.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(__dirname, 'live_audit_snapshots', '05c_student_profile_clicked.png') });
    console.log('Saved 05c_student_profile_clicked.png');
  }

  await browser.close();
}

testStudents().catch(console.error);
