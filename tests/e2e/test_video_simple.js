const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function test() {
  const outDir = path.join(__dirname, 'output', 'test_video');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('Testing video recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: outDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('Closing page...');
  await page.close();
  console.log('Closing context...');
  await context.close();
  console.log('Closing browser...');
  await browser.close();

  const files = fs.readdirSync(outDir);
  console.log('Generated files:', files);
}

test().catch(err => {
  console.error('Test error:', err);
});
