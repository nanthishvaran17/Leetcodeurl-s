const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function auditAuth() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, 'output', 'live_auth_state.json')
  });
  const page = await context.newPage();

  console.log('1. Checking Dashboard...');
  await page.goto('http://13.53.231.6/#/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Dashboard URL:', page.url());

  const navLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('nav a, header a, nav button, header button')).map(el => {
      const r = el.getBoundingClientRect();
      return { text: el.innerText.trim(), x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height };
    });
  });
  console.log('Nav Links (center x,y):', navLinks);

  console.log('2. Checking Departments / Leaderboard...');
  await page.goto('http://13.53.231.6/#/departments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const searchBox = await page.evaluate(() => {
    const input = document.querySelector('input');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { placeholder: input.placeholder, cx: r.x + r.width/2, cy: r.y + r.height/2, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('Leaderboard Search Box:', searchBox);

  const studentRow = await page.evaluate(() => {
    // Find table row or student item
    const el = document.querySelector('table tbody tr') || document.querySelector('.student-row') || document.querySelector('[role="row"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: el.innerText.slice(0, 30), cx: r.x + r.width/2, cy: r.y + r.height/2, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('First Student Row:', studentRow);

  console.log('3. Checking Growth Intelligence...');
  await page.goto('http://13.53.231.6/#/growth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const growthSearch = await page.evaluate(() => {
    const input = document.querySelector('input');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { placeholder: input.placeholder, cx: r.x + r.width/2, cy: r.y + r.height/2, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  console.log('Growth Search Box:', growthSearch);

  await browser.close();
}

auditAuth().catch(console.error);
