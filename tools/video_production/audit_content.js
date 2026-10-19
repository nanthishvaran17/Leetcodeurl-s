const { chromium } = require('playwright');
const path = require('path');
const authStatePath = path.join(__dirname, 'output', 'live_auth_state.json');

async function auditContent() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authStatePath
  });
  const page = await context.newPage();

  // Test Dashboard
  await page.goto('http://13.53.231.6/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const dashInfo = await page.evaluate(() => {
    return {
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim()).filter(Boolean),
      kpiCards: Array.from(document.querySelectorAll('.stat-card, [class*="card"], [class*="StatCard"]')).map(c => c.innerText.trim().replace(/\n+/g, ' ')).slice(0, 10),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
    };
  });
  console.log('--- DASHBOARD AUDIT ---');
  console.log('Headings:', dashInfo.headings.slice(0, 8));
  console.log('Buttons:', dashInfo.buttons.slice(0, 10));

  // Test Students/Leaderboard
  await page.goto('http://13.53.231.6/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const studentsInfo = await page.evaluate(() => {
    return {
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean),
      tableHeaders: Array.from(document.querySelectorAll('th')).map(th => th.innerText.trim()),
      tableRows: Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.innerText.trim().replace(/\n+/g, ' | ')).slice(0, 5)
    };
  });
  console.log('--- STUDENTS LEADERBOARD AUDIT ---');
  console.log('Headings:', studentsInfo.headings);
  console.log('Headers:', studentsInfo.tableHeaders);
  console.log('Sample Rows:', studentsInfo.tableRows);

  // Test Contests
  await page.goto('http://13.53.231.6/#/contests', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const contestInfo = await page.evaluate(() => {
    return {
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean),
      cards: Array.from(document.querySelectorAll('[class*="card"]')).map(c => c.innerText.trim().replace(/\n+/g, ' ')).slice(0, 5)
    };
  });
  console.log('--- CONTESTS AUDIT ---');
  console.log('Headings:', contestInfo.headings);

  // Test Reports
  await page.goto('http://13.53.231.6/#/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const reportsInfo = await page.evaluate(() => {
    return {
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
    };
  });
  console.log('--- REPORTS AUDIT ---');
  console.log('Headings:', reportsInfo.headings);
  console.log('Buttons:', reportsInfo.buttons.slice(0, 10));

  // Test System Health
  await page.goto('http://13.53.231.6/#/system-health', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const healthInfo = await page.evaluate(() => {
    return {
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()).filter(Boolean),
      text: document.body.innerText.slice(0, 500).replace(/\n+/g, ' ')
    };
  });
  console.log('--- SYSTEM HEALTH AUDIT ---');
  console.log('Headings:', healthInfo.headings);

  await browser.close();
}

auditContent().catch(console.error);
