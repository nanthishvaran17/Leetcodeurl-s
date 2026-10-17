const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function smoothMove(page, targetX, targetY, steps = 15) {
  await page.mouse.move(targetX, targetY, { steps });
}

async function recordCleanClip(browser, options, actionFn) {
  const { clipName, outDir } = options;
  console.log(`\n========================================`);
  console.log(`🎬 Recording Clean Scene: ${clipName}`);
  console.log(`========================================`);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  const video = page.video();

  // Fresh login inside this context
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2200);

  // Perform scene action
  await actionFn(page);

  // Check for any vite-error-overlay
  const overlay = await page.$('vite-error-overlay');
  if (overlay) {
    throw new Error(`CRITICAL: vite-error-overlay detected in ${clipName}!`);
  }
  console.log(`Verified: Zero error overlay in ${clipName}`);

  await context.close();
  const rawPath = await video.path();
  const targetPath = path.join(outDir, `${clipName}.webm`);
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log(`✅ Saved ${clipName}.webm (${(fs.statSync(targetPath).size / 1024).toFixed(1)} KB)`);
  return targetPath;
}

async function main() {
  const outDir = path.join(__dirname, 'output', 'raw_clips_clean');
  const browser = await chromium.launch({ headless: true });

  // SCENE 07: Compare Arena
  await recordCleanClip(browser, { clipName: 'clip_07_compare', outDir }, async (page) => {
    await page.goto('http://localhost:3000/#/compare', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await smoothMove(page, 400, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 960, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 1400, 480);
    await page.waitForTimeout(1800);
  });

  // SCENE 09: Contest Integrity Monitor
  await recordCleanClip(browser, { clipName: 'clip_09_integrity', outDir }, async (page) => {
    await page.goto('http://localhost:3000/#/integrity-monitor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await smoothMove(page, 300, 320);
    await page.waitForTimeout(700);
    await smoothMove(page, 850, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 1300, 600);
    await page.waitForTimeout(1800);
  });

  // SCENE 11: HR Candidate Finder
  await recordCleanClip(browser, { clipName: 'clip_11_hr_finder', outDir }, async (page) => {
    await page.goto('http://localhost:3000/#/hr-candidate-finder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await smoothMove(page, 350, 320);
    await page.waitForTimeout(700);
    await smoothMove(page, 950, 450);
    await page.waitForTimeout(700);
    await smoothMove(page, 1400, 520);
    await page.waitForTimeout(1800);
  });

  await browser.close();
  console.log('\n🎉 ALL 3 SCENES RE-RECORDED CLEANLY WITHOUT OVERLAYS!');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
