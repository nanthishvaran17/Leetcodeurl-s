const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  console.log('1. Auditing Login Page...');
  await page.goto('http://13.53.231.6/', { waitUntil: 'networkidle' });
  
  const userBox = await page.locator('input[type="text"]').boundingBox();
  const passBox = await page.locator('input[type="password"]').boundingBox();
  const btnBox = await page.locator('button[type="submit"]').boundingBox();

  console.log('Login Elements:');
  console.log('  Username Input:', userBox);
  console.log('  Password Input:', passBox);
  console.log('  Sign In Button:', btnBox);

  // Authenticate
  await page.locator('input[type="text"]').fill('nanthishvaran17');
  await page.locator('input[type="password"]').fill('admin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log('2. Auditing Dashboard Page...');
  console.log('  URL:', page.url());

  const navLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav a, header a, nav button, header button')).map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.innerText.trim(), x: r.x, y: r.y, w: r.width, h: r.height };
    });
  });
  console.log('  Nav Links:', navLinks);

  // Go to Leaderboard / Departments
  console.log('3. Auditing Leaderboard / Student Roster Page...');
  await page.goto('http://13.53.231.6/departments', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const searchBox = await page.evaluate(() => {
    const input = document.querySelector('input[type="text"], input[placeholder*="Search"], input[placeholder*="search"]');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { placeholder: input.placeholder, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('  Search Box on Leaderboard:', searchBox);

  const firstStudentRow = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr') || document.querySelector('.student-row') || document.querySelector('[role="row"]');
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return { text: row.innerText.slice(0, 50), x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('  First Student Row:', firstStudentRow);

  await browser.close();
}

audit().catch(console.error);
