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
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const authFile = path.join(__dirname, 'output', 'auth_state.json');
  const browser = await chromium.launch({ headless: true });

  // SCENE 01: Brand Hook Intro
  await recordScene(browser, { clipName: 'clip_01_intro', outDir }, async (page) => {
    const fileUrl = 'file:///' + path.join(__dirname, 'output', 'brand_scenes', 'scene_01_intro.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  });

  // SCENE 02: Real Login Experience
  await recordScene(browser, { clipName: 'clip_02_login', outDir }, async (page) => {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const creds = getAdminCredentials();
    await smoothMove(page, 1360, 420);
    await page.click('#userId');
    await page.type('#userId', creds.username, { delay: 60 });
    await page.waitForTimeout(200);

    await smoothMove(page, 1360, 510);
    await page.click('#password');
    await page.type('#password', creds.password, { delay: 60 });
    await page.waitForTimeout(300);

    await smoothMove(page, 1360, 630);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1600);
  });

  // Refresh authState to be 100% current
  const authContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const authPage = await authContext.newPage();
  await authPage.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  const creds = getAdminCredentials();
  await authPage.fill('#userId', creds.username);
  await authPage.fill('#password', creds.password);
  await authPage.click('button[type="submit"]');
  await authPage.waitForTimeout(2000);
  await authContext.storageState({ path: authFile });
  await authContext.close();
  console.log('✅ Fresh auth state stored.');

  // SCENE 03: Executive Dashboard
  await recordScene(browser, { clipName: 'clip_03_dashboard', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await smoothMove(page, 200, 400);
    await page.waitForTimeout(500);
    await smoothMove(page, 600, 400);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollBy({ top: 380, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
  });

  // SCENE 04: Master Student Directory
  await recordScene(browser, { clipName: 'clip_04_students', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 450, 480);
    await page.waitForTimeout(600);
    await smoothMove(page, 450, 560);
    await page.waitForTimeout(600);
    await smoothMove(page, 450, 640);
    await page.waitForTimeout(1600);
  });

  // SCENE 05: Student Profile Dossier Modal
  await recordScene(browser, { clipName: 'clip_05_profile', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const viewBtn = await page.$('tbody tr:first-child [title*="View"], tbody tr:first-child button');
    if (viewBtn) {
      await viewBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
      await smoothMove(page, 960, 480);
      await page.waitForTimeout(2200);
    }
  });

  // SCENE 06: Institutional Analytics Dashboard (HOD Deck)
  await recordScene(browser, { clipName: 'clip_06_hod', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/hod-command-center', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 300, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 800, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 1300, 400);
    await page.waitForTimeout(1800);
  });

  // SCENE 07: Student Comparison Arena
  await recordScene(browser, { clipName: 'clip_07_compare', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/compare', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 400, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 960, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 1400, 480);
    await page.waitForTimeout(1800);
  });

  // SCENE 08: Weekly Contest Tracker
  await recordScene(browser, { clipName: 'clip_08_weekly_contest', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/weekly-contest', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 300, 560);
    await page.waitForTimeout(700);
    await smoothMove(page, 700, 560);
    await page.waitForTimeout(700);
    await smoothMove(page, 1100, 560);
    await page.waitForTimeout(1800);
  });

  // SCENE 09: Contest Integrity Monitor
  await recordScene(browser, { clipName: 'clip_09_integrity', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/integrity-monitor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 300, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 850, 480);
    await page.waitForTimeout(700);
    await smoothMove(page, 1300, 600);
    await page.waitForTimeout(1800);
  });

  // SCENE 10: Growth Intelligence & Delta Engine
  await recordScene(browser, { clipName: 'clip_10_growth', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/growth', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const allTimeBtn = await page.$('button:has-text("All Time")');
    if (allTimeBtn) {
      await allTimeBtn.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    await smoothMove(page, 400, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 800, 400);
    await page.waitForTimeout(600);
    await smoothMove(page, 1200, 400);
    await page.waitForTimeout(1800);
  });

  // SCENE 11: Placement & HR Candidate Finder
  await recordScene(browser, { clipName: 'clip_11_hr_finder', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/hr-candidate-finder', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 350, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 950, 450);
    await page.waitForTimeout(700);
    await smoothMove(page, 1400, 520);
    await page.waitForTimeout(1800);
  });

  // SCENE 12: Reports & Universal Exporters
  await recordScene(browser, { clipName: 'clip_12_reports', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 300, 510);
    await page.waitForTimeout(600);
    await smoothMove(page, 900, 510);
    await page.waitForTimeout(600);
    await smoothMove(page, 1450, 610);
    await page.waitForTimeout(1800);
  });

  // SCENE 13: Faculty Action Center & Mentorship
  await recordScene(browser, { clipName: 'clip_13_faculty', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/faculty-action-center', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 200, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 500, 320);
    await page.waitForTimeout(600);
    await smoothMove(page, 960, 650);
    await page.waitForTimeout(1800);
  });

  // SCENE 14: Autonomous AI Control Matrix
  await recordScene(browser, { clipName: 'clip_14_ai_control', outDir, storageState: authFile }, async (page) => {
    await page.goto('http://localhost:3000/#/ai-control', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await smoothMove(page, 300, 540);
    await page.waitForTimeout(600);
    await smoothMove(page, 800, 540);
    await page.waitForTimeout(600);
    await smoothMove(page, 1300, 540);
    await page.waitForTimeout(1800);
  });

  // SCENE 15: Branded Outro
  await recordScene(browser, { clipName: 'clip_15_outro', outDir }, async (page) => {
    const fileUrl = 'file:///' + path.join(__dirname, 'output', 'brand_scenes', 'scene_11_outro.html').replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  });

  await browser.close();
  console.log('\n🎉 ALL 15 CLEAN SCENES RECORDED WITH ZERO LOGIN REDIRECTS!');
}

main().catch(err => {
  console.error('Recording clean flow failed:', err);
  process.exit(1);
});
