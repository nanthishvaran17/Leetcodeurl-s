const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const authState = path.join(__dirname, 'output', 'live_auth_state.json');
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: fs.existsSync(authState) ? authState : undefined
  });
  const page = await context.newPage();

  console.log('Navigating to departments page...');
  await page.goto('http://13.53.231.6/#/departments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());

  // Check if we are logged in or on login page
  if (page.url().includes('login')) {
    console.log('On login page! Performing native login...');
    await page.fill('input[id="userId"], input[placeholder*="username" i]', 'admin');
    await page.fill('input[id="password"]', 'admin123');
    await page.screenshot({ path: path.join(__dirname, 'real_01_login_filled.png') });
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(4000);
    console.log('After login URL:', page.url());
  }

  // Go to departments
  await page.goto('http://13.53.231.6/#/departments', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(__dirname, 'real_02_departments.png') });

  // Locate the real search input
  const searchInput = await page.$('input[placeholder*="search" i], input[type="text"]');
  if (searchInput) {
    const box = await searchInput.boundingBox();
    console.log('Search input bounding box:', box);
    
    // Click and type natively!
    await searchInput.click();
    await searchInput.type('Nanthish', { delay: 100 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(__dirname, 'real_03_typed.png') });

    // Look for Nanthish row and eye icon
    const eyeBtn = await page.$('button[title*="View Profile" i], tr:has-text("NANTHISH") button:has(svg), tr:has-text("NANTHISH") svg');
    console.log('Found eye button?', !!eyeBtn);
    if (eyeBtn) {
      const eyeBox = await eyeBtn.boundingBox();
      console.log('Eye button bounding box:', eyeBox);
      await eyeBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(__dirname, 'real_04_profile_opened.png') });
    }
  } else {
    console.log('Could not find search input!');
  }

  await browser.close();
  console.log('Done!');
})();
