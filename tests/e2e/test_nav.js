const { chromium } = require('playwright');
const { execSync } = require('child_process');

// Fetch credentials securely from backend settings without hardcoding secrets
function getAdminCredentials() {
  const pyCmd = `python -c "from backend.config import settings; print(settings.ADMIN_USERNAME); print(settings.ADMIN_PASSWORD)"`;
  const output = execSync(pyCmd, { encoding: 'utf-8' }).trim().split(/\r?\n/);
  return {
    username: output[0],
    password: output[1]
  };
}

async function main() {
  console.log('Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  
  const title = await page.title();
  console.log('Page title:', title);

  const userIdInput = await page.$('#userId');
  const passwordInput = await page.$('#password');
  console.log('Inputs found:', { userId: !!userIdInput, password: !!passwordInput });

  if (userIdInput && passwordInput) {
    const creds = getAdminCredentials();
    console.log(`Entering username: ${creds.username}`);
    await userIdInput.fill(creds.username);
    await passwordInput.fill(creds.password);

    console.log('Clicking Sign In button...');
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();

    // Wait for login to complete
    await page.waitForTimeout(3000);
    console.log('Current URL after login:', page.url());

    // Check if dashboard or navigation appeared
    const heading = await page.$eval('h1, h2', el => el.innerText).catch(() => 'No heading found');
    console.log('Heading found:', heading);
  }

  await browser.close();
  console.log('Test completed successfully.');
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
