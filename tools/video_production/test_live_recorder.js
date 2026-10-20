const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function getCredentials() {
  try {
    const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
    const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
    return { username: output[0], password: output[1] };
  } catch (e) {
    return { username: 'nanthishvaran17', password: 'password' };
  }
}

// Inject smooth visual cursor overlay into real browser DOM
async function injectMouseHelper(page) {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const box = document.createElement('div');
      box.id = 'cursor-helper-box';
      box.style.position = 'fixed';
      box.style.top = '0';
      box.style.left = '0';
      box.style.width = '24px';
      box.style.height = '24px';
      box.style.pointerEvents = 'none';
      box.style.zIndex = '999999';
      box.style.transform = 'translate(-2px, -2px)';
      box.style.transition = 'transform 0.05s ease';
      box.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5.5 3.5L18.5 11.5L12 13.5L9.5 20.5L5.5 3.5Z" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
        <div id="cursor-ripple" style="position: absolute; top: 0; left: 0; width: 36px; height: 36px; border-radius: 50%; background: rgba(37,99,235,0.4); transform: translate(-50%, -50%) scale(0); opacity: 0; transition: transform 0.4s ease, opacity 0.4s ease;"></div>
      `;
      document.body.appendChild(box);

      window.addEventListener('mousemove', (e) => {
        box.style.left = e.clientX + 'px';
        box.style.top = e.clientY + 'px';
      });

      window.addEventListener('mousedown', (e) => {
        const rip = document.getElementById('cursor-ripple');
        if (rip) {
          rip.style.transform = 'translate(-50%, -50%) scale(2.2)';
          rip.style.opacity = '1';
        }
      });
      window.addEventListener('mouseup', (e) => {
        const rip = document.getElementById('cursor-ripple');
        if (rip) {
          rip.style.opacity = '0';
          setTimeout(() => { rip.style.transform = 'translate(-50%, -50%) scale(0)'; }, 300);
        }
      });
    });
  });
}

async function testLiveRecording() {
  const outDir = path.resolve(__dirname, 'test_rec_output');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: outDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  await injectMouseHelper(page);

  console.log('Visiting live login page...');
  await page.goto('http://13.53.231.6/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Move mouse to username field and type
  const userBox = await page.locator('input[type="text"]').boundingBox();
  console.log('Username box:', userBox);
  if (userBox) {
    const targetX = userBox.x + userBox.width / 2;
    const targetY = userBox.y + userBox.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 25 });
    await page.mouse.down();
    await page.mouse.up();
    await page.locator('input[type="text"]').type('nanthishvaran17', { delay: 80 });
  }

  // Move mouse to password field and type
  const passBox = await page.locator('input[type="password"]').boundingBox();
  console.log('Password box:', passBox);
  if (passBox) {
    const targetX = passBox.x + passBox.width / 2;
    const targetY = passBox.y + passBox.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.down();
    await page.mouse.up();
    await page.locator('input[type="password"]').type('password', { delay: 80 });
  }

  // Move mouse to Sign In button and click
  const btnBox = await page.locator('button[type="submit"]').boundingBox();
  console.log('Button box:', btnBox);
  if (btnBox) {
    const targetX = btnBox.x + btnBox.width / 2;
    const targetY = btnBox.y + btnBox.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
  }

  await page.waitForTimeout(2000);
  await context.close();
  await browser.close();
  console.log('Recording completed. Saved to:', outDir);
}

testLiveRecording().catch(console.error);
