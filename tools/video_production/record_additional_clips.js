const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function smoothMove(page, targetX, targetY, steps = 18) {
  await page.mouse.move(targetX, targetY, { steps });
}

async function recordScene(browser, options, actionFn) {
  const { clipName, outDir, storageState } = options;
  console.log(`\n========================================`);
  console.log(`Recording Scene: ${clipName}`);
  console.log(`========================================`);

  const contextOptions = {
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  };

  if (storageState && fs.existsSync(storageState)) {
    contextOptions.storageState = storageState;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const video = page.video();

  try {
    await actionFn(page);
  } catch (err) {
    console.error(`Error in ${clipName}:`, err);
  }

  await context.close();
  const rawPath = await video.path();
  const targetPath = path.join(outDir, `${clipName}.webm`);
  
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log(`Saved ${clipName}.webm (${(fs.statSync(targetPath).size / 1024).toFixed(1)} KB)`);
  return targetPath;
}

async function main() {
  const outDir = path.join(__dirname, 'output', 'raw_clips');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const authState = path.join(__dirname, 'output', 'auth_state.json');
  const browser = await chromium.launch({ headless: true });

  // SCENE A: Department Analytics (#/departments)
  await recordScene(browser, { clipName: 'clip_new_departments', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/departments', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Pan across department benchmark cards and graphs
    await smoothMove(page, 300, 360);
    await page.waitForTimeout(700);
    await smoothMove(page, 700, 360);
    await page.waitForTimeout(700);
    await smoothMove(page, 1100, 360);
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await page.waitForTimeout(2200);
  });

  // SCENE B: Head-to-Head Compare (#/compare)
  await recordScene(browser, { clipName: 'clip_new_compare', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/compare', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Pan over compare inputs, radar comparison, delta stats
    await smoothMove(page, 400, 280);
    await page.waitForTimeout(700);
    await smoothMove(page, 960, 480);
    await page.waitForTimeout(800);
    await smoothMove(page, 1400, 480);
    await page.waitForTimeout(2200);
  });

  // SCENE C: Contest Integrity & Forensics (#/integrity-monitor)
  await recordScene(browser, { clipName: 'clip_new_integrity', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/integrity-monitor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Hover over audit counters and forensic verification feed
    await smoothMove(page, 300, 320);
    await page.waitForTimeout(700);
    await smoothMove(page, 850, 480);
    await page.waitForTimeout(800);
    await smoothMove(page, 1300, 600);
    await page.waitForTimeout(2200);
  });

  // SCENE D: Placement & HR Candidate Finder (#/hr-candidate-finder)
  await recordScene(browser, { clipName: 'clip_new_hr_finder', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/hr-candidate-finder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Pan across recruitment criteria, candidate pool, shortlist
    await smoothMove(page, 350, 320);
    await page.waitForTimeout(700);
    await smoothMove(page, 950, 450);
    await page.waitForTimeout(800);
    await smoothMove(page, 1400, 520);
    await page.waitForTimeout(2200);
  });

  await browser.close();
  console.log('\nALL 4 NEW SCENES RECORDED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Recording failed:', err);
  process.exit(1);
});
