const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function smoothMove(page, targetX, targetY, steps = 18) {
  await page.mouse.move(targetX, targetY, { steps });
}

async function recordScene(browser, options, actionFn) {
  const { clipName, outDir, storageState } = options;
  console.log(`\n========================================`);
  console.log(`🎬 Recording Scene: ${clipName}`);
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

  // Close context to finish recording
  await context.close();
  const rawPath = await video.path();
  const targetPath = path.join(outDir, `${clipName}.webm`);
  
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(rawPath, targetPath);
  console.log(`✅ Saved ${clipName}.webm (${(fs.statSync(targetPath).size / 1024).toFixed(1)} KB)`);
  return targetPath;
}

async function main() {
  const outDir = path.join(__dirname, 'output', 'raw_clips');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const authState = path.join(__dirname, 'output', 'auth_state.json');
  const browser = await chromium.launch({ headless: true });

  // SCENE 1: Brand Hook Intro
  await recordScene(browser, { clipName: 'clip_01_intro', outDir }, async (page) => {
    const fileUrl = 'file:///' + path.join(__dirname, 'output', 'brand_scenes', 'scene_01_intro.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  });

  // SCENE 2: Real Login Experience
  await recordScene(browser, { clipName: 'clip_02_login', outDir }, async (page) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Smooth hover over institutional portal branding
    await smoothMove(page, 200, 100);
    await page.waitForTimeout(400);

    const creds = getAdminCredentials();
    await smoothMove(page, 1360, 420);
    await page.click('#userId');
    await page.type('#userId', creds.username, { delay: 80 });
    await page.waitForTimeout(300);

    await smoothMove(page, 1360, 510);
    await page.click('#password');
    await page.type('#password', creds.password, { delay: 80 });
    await page.waitForTimeout(400);

    await smoothMove(page, 1360, 630);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1600);
  });

  // SCENE 3: Executive Dashboard
  await recordScene(browser, { clipName: 'clip_03_dashboard', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Smooth pan over KPI cards
    await smoothMove(page, 200, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 500, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 800, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 1100, 400);
    await page.waitForTimeout(700);

    // Smooth scroll down to reveal Real-Time Performance Trajectory
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
  });

  // SCENE 4: Student Master Directory
  await recordScene(browser, { clipName: 'clip_04_students', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Smooth hover over table header & top rows
    await smoothMove(page, 400, 320);
    await page.waitForTimeout(500);
    await smoothMove(page, 450, 545);
    await page.waitForTimeout(700);
    await smoothMove(page, 450, 615);
    await page.waitForTimeout(700);
    await smoothMove(page, 450, 685);
    await page.waitForTimeout(1600);
  });

  // SCENE 5: Student Profile Detail & Evidence
  await recordScene(browser, { clipName: 'clip_05_profile', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);

    // Click View on top student row to open detailed student profile modal
    const viewBtn = await page.$('tbody tr:first-child [title*="View"], tbody tr:first-child button, tbody tr:first-child svg');
    if (viewBtn) {
      const box = await viewBtn.boundingBox();
      if (box) {
        await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2);
        await viewBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
        await smoothMove(page, 960, 480);
        await page.waitForTimeout(2200);
      }
    }
  });

  // SCENE 6: Weekly Contest Tracker
  await recordScene(browser, { clipName: 'clip_06_weekly_contest', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/weekly-contest', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await smoothMove(page, 200, 140);
    await page.waitForTimeout(600);
    await smoothMove(page, 300, 560);
    await page.waitForTimeout(800);
    await smoothMove(page, 700, 560);
    await page.waitForTimeout(800);
    await smoothMove(page, 1100, 560);
    await page.waitForTimeout(1800);
  });

  // SCENE 7: Growth Intelligence & Delta Engine
  await recordScene(browser, { clipName: 'clip_07_growth', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/growth', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const allTimeBtn = await page.$('button:has-text("All Time")');
    if (allTimeBtn) {
      const box = await allTimeBtn.boundingBox();
      if (box) {
        await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2);
        await allTimeBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    await smoothMove(page, 300, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 700, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 1100, 400);
    await page.waitForTimeout(1800);
  });

  // SCENE 8: Reports & Export Center
  await recordScene(browser, { clipName: 'clip_08_reports', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await smoothMove(page, 300, 510);
    await page.waitForTimeout(700);
    await smoothMove(page, 900, 510);
    await page.waitForTimeout(700);
    await smoothMove(page, 1450, 610);
    await page.waitForTimeout(1600);
  });

  // SCENE 9: Faculty Action Center & Mentorship
  await recordScene(browser, { clipName: 'clip_09_faculty', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/faculty-action-center', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await smoothMove(page, 200, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 500, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 960, 650);
    await page.waitForTimeout(1800);
  });

  // SCENE 10: Institutional AI Control Center
  await recordScene(browser, { clipName: 'clip_10_ai_control', outDir, storageState: authState }, async (page) => {
    await page.goto('http://localhost:3000/#/ai-control', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    await smoothMove(page, 300, 540);
    await page.waitForTimeout(600);
    await smoothMove(page, 800, 540);
    await page.waitForTimeout(600);
    await smoothMove(page, 1300, 540);
    await page.waitForTimeout(1300);
  });

  // SCENE 11: Branded Outro
  await recordScene(browser, { clipName: 'clip_11_outro', outDir }, async (page) => {
    const fileUrl = 'file:///' + path.join(__dirname, 'output', 'brand_scenes', 'scene_11_outro.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  });

  await browser.close();
  console.log('\n🎉 ALL 11 SCENES RECORDED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('Master recording failed:', err);
  process.exit(1);
});
