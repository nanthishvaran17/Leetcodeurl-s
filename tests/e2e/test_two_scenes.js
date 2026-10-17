const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return { username: output[0], password: output[1] };
}

async function testTwoScenes() {
  const outDir = path.join(__dirname, 'output', 'test_two');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Testing two scenes recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  const video = page.video();

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const creds = getAdminCredentials();
  await page.fill('#userId', creds.username);
  await page.fill('#password', creds.password);
  await page.click('button[type="submit"]');

  console.log('Navigating to dashboard...');
  await page.waitForTimeout(3000);

  console.log('Closing context...');
  await context.close();
  await browser.close();

  const videoPath = await video.path();
  console.log('Video recorded successfully at:', videoPath, 'Size:', fs.statSync(videoPath).size);
}

testTwoScenes().catch(console.error);
