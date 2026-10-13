const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function reRecordProfile() {
  const outDir = path.join(__dirname, 'output', 'raw_clips');
  const authState = path.join(__dirname, 'output', 'auth_state.json');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    storageState: authState,
    recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } }
  });

  const page = await context.newPage();
  const video = page.video();

  console.log('Navigating to students...');
  await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  console.log('Clicking on student View button...');
  const viewBtn = page.locator('button[title="View"]').first();
  await viewBtn.click();
  await page.waitForTimeout(1500);

  // Smooth hover over the opened student profile
  await page.mouse.move(960, 400, { steps: 20 });
  await page.waitForTimeout(1000);
  await page.mouse.move(960, 600, { steps: 20 });
  await page.waitForTimeout(2500);

  await context.close();
  await browser.close();

  const rawPath = await video.path();
  const targetPath = path.join(outDir, 'clip_05_profile.webm');
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log('Successfully recorded clip_05_profile.webm, size:', fs.statSync(targetPath).size);
}

reRecordProfile().catch(console.error);
