const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SNAPSHOTS_DIR = path.resolve(__dirname, 'live_audit_snapshots');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function checkStudentModal() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  console.log('Navigating to http://13.53.231.6/#/students');
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check rows in student table
  const studentRows = await page.$$eval('tbody tr, [role="row"]', rows => rows.map(r => r.innerText.trim().replace(/\n+/g, ' | ')));
  console.log('Found student rows (top 5):', studentRows.slice(0, 5));

  // Look for clickable student name or View button
  const firstStudent = await page.$('tbody tr:first-child td button, tbody tr:first-child td a, tbody tr:first-child');
  if (firstStudent) {
    console.log('Clicking first student record...');
    await firstStudent.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '05b_student_detail_modal.png') });
    console.log('Saved 05b_student_detail_modal.png');
  }

  // Check sync engine or system health page
  console.log('Checking Sync Engine status click...');
  await page.goto('http://13.53.231.6/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const syncBtn = await page.$('button:has-text("Sync Engine Status"), button:has-text("Sync")');
  if (syncBtn) {
    await syncBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '08b_sync_engine_modal.png') });
    console.log('Saved 08b_sync_engine_modal.png');
  }

  await browser.close();
  console.log('Student & Sync modal inspection complete!');
}

checkStudentModal().catch(console.error);
