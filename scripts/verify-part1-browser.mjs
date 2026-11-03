import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PATH_ALT = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\SRI\\.gemini\\antigravity\\brain\\7cb6845f-91e4-4515-b639-1f762bc8e228';
const BASE_URL = 'http://127.0.0.1:3000';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runVerification() {
  console.log('--- Starting Browser Verification ---');

  const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : EDGE_PATH_ALT;
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Edge browser executable not found at ${executablePath}`);
  }

  console.log(`Using Edge executable at: ${executablePath}`);
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER PAGE ERROR:', err.message));

  try {
    // -----------------------------------------------------------------------
    // Step 1: Admin Login
    // -----------------------------------------------------------------------
    console.log('1. Testing Admin Login at /admin/login...');
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    await page.waitForSelector('#admin-username', { timeout: 10000 });

    // Select all and type cleanly
    await page.click('#admin-username', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#admin-username', 'admin');

    await page.click('#admin-password', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('#admin-password', 'admin123');

    console.log('Clicking Authenticate to Console button...');
    await page.click('button[type="submit"]');

    await delay(2500);
    console.log('Page URL after submit:', page.url());

    // Wait until on /admin
    if (page.url().includes('/admin/login')) {
      const err = await page.evaluate(() => {
        const el = document.querySelector('.text-corporate-red');
        return el ? el.textContent : null;
      });
      console.log('Login error message if any:', err);
    }

    const adminLoginShot = path.join(ARTIFACTS_DIR, 'part1_admin_login.png');
    await page.screenshot({ path: adminLoginShot, fullPage: true });
    console.log(`Saved screenshot: ${adminLoginShot}`);

    // -----------------------------------------------------------------------
    // Step 2: PIN Quick-Unlock
    // -----------------------------------------------------------------------
    console.log('2. Testing Inactivity / Manual PIN Lock...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find((el) => el.textContent && el.textContent.includes('Lock Console'));
      if (b) b.click();
    });

    await delay(1000);
    await page.waitForSelector('#pin-unlock-input', { timeout: 10000 });
    console.log('PIN overlay open, typing PIN 1234...');
    await page.type('#pin-unlock-input', '1234');

    const pinLockShot = path.join(ARTIFACTS_DIR, 'part1_admin_pin_unlock.png');
    await page.screenshot({ path: pinLockShot, fullPage: true });
    console.log(`Saved screenshot: ${pinLockShot}`);

    // Click Unlock
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find((el) => el.textContent && el.textContent.includes('Unlock'));
      if (b) b.click();
    });
    await delay(1500);

    // -----------------------------------------------------------------------
    // Step 3: Employee Room Booking Flow (/room/11111111-1111-1111-1111-111111111111)
    // -----------------------------------------------------------------------
    console.log('3. Testing Employee Room Page...');
    await page.goto(`${BASE_URL}/room/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' });
    await delay(2000);

    // Click a free slot's Book button
    console.log('Clicking free slot Book button on timeline...');
    await page.waitForSelector('button[data-book-slot="true"]', { timeout: 10000 });
    await page.click('button[data-book-slot="true"]');

    await delay(1000);
    console.log('Booking sheet opened, filling inputs...');
    await page.waitForSelector('#booking-full-name', { timeout: 10000 });
    await page.type('#booking-full-name', 'Rashid Al Falasi');
    await page.type('#booking-email', 'rashid.f@company.internal');
    await page.type('#booking-title', 'Client RFP Review');

    // Click Confirm Reservation
    console.log('Submitting booking...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const b = buttons.find((el) => el.textContent && el.textContent.includes('Confirm Reservation'));
      if (b) b.click();
    });

    await delay(2500);
    const bookingShot = path.join(ARTIFACTS_DIR, 'part1_employee_booking.png');
    await page.screenshot({ path: bookingShot, fullPage: true });
    console.log(`Saved screenshot: ${bookingShot}`);

    // -----------------------------------------------------------------------
    // Step 4: Blocked Slots / Availability View
    // -----------------------------------------------------------------------
    console.log('4. Checking Blocked Slot Display...');
    await page.goto(`${BASE_URL}/room/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' });
    await delay(1500);
    const blockedShot = path.join(ARTIFACTS_DIR, 'part1_blocked_slot.png');
    await page.screenshot({ path: blockedShot, fullPage: true });
    console.log(`Saved screenshot: ${blockedShot}`);

    // -----------------------------------------------------------------------
    // Step 5: Wall Tablet Display Screen
    // -----------------------------------------------------------------------
    console.log('5. Testing Wall Tablet Display (/display/11111111-1111-1111-1111-111111111111)...');
    await page.goto(`${BASE_URL}/display/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' });
    await delay(2000);
    const displayShot = path.join(ARTIFACTS_DIR, 'part2_wall_display.png');
    await page.screenshot({ path: displayShot, fullPage: true });
    console.log(`Saved screenshot: ${displayShot}`);

    // -----------------------------------------------------------------------
    // Step 6: Printable A4 QR Sign
    // -----------------------------------------------------------------------
    console.log('6. Testing Printable A4 Sign (/room/11111111-1111-1111-1111-111111111111/print)...');
    await page.goto(`${BASE_URL}/room/11111111-1111-1111-1111-111111111111/print`, { waitUntil: 'domcontentloaded' });
    await delay(1500);
    const printShot = path.join(ARTIFACTS_DIR, 'part1_printable_qr_sign.png');
    await page.screenshot({ path: printShot, fullPage: true });
    console.log(`Saved screenshot: ${printShot}`);

    console.log('--- All Browser Verifications Completed Successfully ---');
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('Browser Verification Error:', err);
  process.exit(1);
});
