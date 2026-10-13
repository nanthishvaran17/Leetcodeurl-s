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

  console.log('Navigating to students directory...');
  await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  console.log('Clicking on student View button with force...');
  const viewBtn = page.locator('button[title="View"]').first();
  await viewBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Smooth hover over the modal elements
  console.log('Panning across student profile modal...');
  await page.mouse.move(500, 380, { steps: 18 });
  await page.waitForTimeout(800);
  await page.mouse.move(750, 380, { steps: 18 });
  await page.waitForTimeout(800);
  await page.mouse.move(500, 750, { steps: 18 });
  await page.waitForTimeout(800);
  await page.mouse.move(1100, 750, { steps: 18 });
  await page.waitForTimeout(2000);

  await context.close();
  await browser.close();

  const rawPath = await video.path();
  const targetPath = path.join(outDir, 'clip_05_profile.webm');
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log('✅ clip_05_profile.webm recorded successfully, size:', fs.statSync(targetPath).size);
}

reRecordProfile().catch(console.error);
