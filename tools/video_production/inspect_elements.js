const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('--- 1. LOGIN PAGE ---');
  await page.goto('http://13.53.231.6/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const loginInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(el => {
      const r = el.getBoundingClientRect();
      return {
        id: el.id,
        placeholder: el.placeholder,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        centerX: r.x + r.width / 2,
        centerY: r.y + r.height / 2
      };
    });
  });
  console.log('Login Inputs:', JSON.stringify(loginInputs, null, 2));

  const loginButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(el => {
      const r = el.getBoundingClientRect();
      return {
        text: el.innerText.trim(),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        centerX: r.x + r.width / 2,
        centerY: r.y + r.height / 2
      };
    });
  });
  console.log('Login Buttons:', JSON.stringify(loginButtons, null, 2));

  // Perform login
  await page.fill('input[placeholder*="username" i], input[type="text"], input[type="email"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Sign In"), button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('--- 2. DEPARTMENTS / LEADERBOARD PAGE ---');
  await page.goto('http://13.53.231.6/#/departments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const deptInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(el => {
      const r = el.getBoundingClientRect();
      return {
        placeholder: el.placeholder,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        centerX: r.x + r.width / 2,
        centerY: r.y + r.height / 2
      };
    });
  });
  console.log('Dept Inputs:', JSON.stringify(deptInputs, null, 2));

  // Check Nanthish row and action buttons
  const rows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'));
    return trs.slice(0, 3).map((tr, idx) => {
      const r = tr.getBoundingClientRect();
      const buttons = Array.from(tr.querySelectorAll('button, svg, a')).map(b => {
        const br = b.getBoundingClientRect();
        return {
          tag: b.tagName,
          title: b.getAttribute('title') || b.innerText || '',
          x: br.x,
          y: br.y,
          centerX: br.x + br.width / 2,
          centerY: br.y + br.height / 2
        };
      });
      return {
        idx,
        text: tr.innerText.split('\n').filter(Boolean).slice(0, 4).join(' | '),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        buttons: buttons.filter(b => b.centerX > 1500) // action buttons
      };
    });
  });
  console.log('Top Rows:', JSON.stringify(rows, null, 2));

  await browser.close();
})();
