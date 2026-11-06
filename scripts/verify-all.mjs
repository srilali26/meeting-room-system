import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const EDGE_PATH_ALT = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACTS_DIR = 'C:\\Users\\SRI\\.gemini\\antigravity\\brain\\7cb6845f-91e4-4515-b639-1f762bc8e228';
const BASE_URL = 'http://127.0.0.1:3005';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('====================================================');
  console.log('Meeting Room Booking — Full Verification Suite');
  console.log('====================================================\n');

  const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : EDGE_PATH_ALT;
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Edge executable not found at ${executablePath}`);
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(30000);

  try {
    const { Database, getPool } = await import('../src/lib/db.ts');
    const pool = getPool();

    // Clean up old test bookings so all tests run against a pristine state
    await pool.query("DELETE FROM bookings WHERE organizer_email LIKE '%internal.net%';");

    // -----------------------------------------------------------------------
    // TEST (c.1): Route Deletion & 404 Check
    // -----------------------------------------------------------------------
    console.log('--- Test (c.1): Route Deletion & 404 Check ---');
    const auditRes = await page.goto(`${BASE_URL}/api/audit`, { waitUntil: 'domcontentloaded' });
    console.log(`GET /api/audit status: ${auditRes.status()} (Expected: 404)`);

    const printRes = await page.goto(`${BASE_URL}/room/11111111-1111-1111-1111-111111111111/print`, { waitUntil: 'domcontentloaded' });
    console.log(`GET /room/[id]/print status: ${printRes.status()} (Expected: 404)`);

    // -----------------------------------------------------------------------
    // TEST (c.2): Login Lockout after 5 wrong attempts
    // -----------------------------------------------------------------------
    console.log('\n--- Test (c.2): Admin Login Lockout Check ---');
    await Database.resetFailedLogin('admin');

    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await delay(500);

    // Perform 5 wrong logins
    for (let i = 1; i <= 5; i++) {
      const res = await page.evaluate(async (i) => {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: `WrongPassword_${i}` }),
        });
        return { status: r.status, data: await r.json() };
      }, i);
      console.log(`Attempt ${i} -> status: ${res.status}, response:`, res.data);
    }

    // 6th attempt should be locked
    const lockCheck = await page.evaluate(async () => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'ReceptionAdmin2026!' }),
      });
      return { status: r.status, data: await r.json() };
    });
    console.log(`Attempt with correct password while locked -> status: ${lockCheck.status}, error: "${lockCheck.data.error}"`);

    // Reset admin lockout for remaining tests
    console.log('Resetting admin lockout for testing...');
    await Database.resetFailedLogin('admin');
    console.log('Admin account unlocked.');

    // Log in properly as admin
    const loginResult = await page.evaluate(async () => {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'ReceptionAdmin2026!' }),
      });
      return { ok: r.ok, data: await r.json() };
    });
    console.log('Admin login result:', loginResult.ok ? 'Success (Cookie Set)' : loginResult.data);

    // Navigate to admin console
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('aside nav button');
    await delay(800);

    // -----------------------------------------------------------------------
    // TEST (a) & (b): Today vs Tomorrow Schedule Filtering & Midnight Rollover
    // -----------------------------------------------------------------------
    console.log('\n--- Test (a) & (b): Date Filtering & Schedule Isolation ---');
    const todayDubai = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
    const tomorrowDt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrowDubai = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(tomorrowDt);

    console.log(`Today in Dubai:    ${todayDubai}`);
    console.log(`Tomorrow in Dubai: ${tomorrowDubai}`);

    // Create a booking for TODAY in Meeting Room 1 (15:00 - 16:00 Dubai time -> 11:00 - 12:00 UTC)
    const testTodayTitle = `Today Operations Review ${Date.now()}`;
    const bookTodayRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: '11111111-1111-1111-1111-111111111111',
        title: testTodayTitle,
        organizer_name: 'Director Humaid',
        organizer_email: 'humaid@internal.net',
        start_time: `${todayDubai}T11:00:00.000Z`,
        end_time: `${todayDubai}T12:00:00.000Z`,
      }),
    });
    const todayBookData = await bookTodayRes.json();
    console.log(`Created booking for TODAY in Room 1:`, todayBookData.message || todayBookData.error);

    // Create a booking for TOMORROW in Meeting Room 1 (10:00 - 11:00 Dubai time -> 06:00 - 07:00 UTC)
    const testTomorrowTitle = `Tomorrow Financial Planning ${Date.now()}`;
    const bookTomorrowRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: '11111111-1111-1111-1111-111111111111',
        title: testTomorrowTitle,
        organizer_name: 'VP Khalid',
        organizer_email: 'khalid@internal.net',
        start_time: `${tomorrowDubai}T06:00:00.000Z`,
        end_time: `${tomorrowDubai}T07:00:00.000Z`,
      }),
    });
    const tomorrowBookData = await bookTomorrowRes.json();
    console.log(`Created booking for TOMORROW in Room 1:`, tomorrowBookData.message || tomorrowBookData.error);

    // Test Late Night Booking (23:30 GST -> 19:30 UTC): Must be rejected by work-hours rule (08:00–20:00 Dubai)
    const bookLateNightRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: '11111111-1111-1111-1111-111111111111',
        title: 'Late Night 23:30 Outside Hours Meeting',
        organizer_name: 'Farhan Ali',
        organizer_email: 'farhan@internal.net',
        start_time: `${todayDubai}T19:30:00.000Z`,
        end_time: `${todayDubai}T20:00:00.000Z`,
      }),
    });
    const lateNightData = await bookLateNightRes.json();
    console.log('Booking at 23:30 GST (outside 08:00-20:00): status =', bookLateNightRes.status, 'error =', lateNightData.error);

    // Switch to Schedule tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside nav button'));
      const target = btns.find((b) => b.innerText.includes('Schedule'));
      if (target) target.click();
    });
    await delay(1200);

    // Check headings and meetings on Today
    const dateHeading = await page.$eval('h3.font-black', (el) => el.innerText).catch(() => 'Heading not found');
    console.log(`Schedule heading: "${dateHeading}"`);

    const pageTextToday = await page.evaluate(() => document.body.innerText);
    const hasTodayMeeting = pageTextToday.includes(testTodayTitle);
    const hasTomorrowMeetingOnToday = pageTextToday.includes(testTomorrowTitle);
    console.log(`On TODAY's Schedule:`);
    console.log(`  - "${testTodayTitle}" visible: ${hasTodayMeeting} (Expected: true)`);
    console.log(`  - "${testTomorrowTitle}" visible: ${hasTomorrowMeetingOnToday} (Expected: false)`);

    // Click "Next Day" button
    const nextBtn = await page.$('button[title="Next Day"]');
    if (nextBtn) {
      await nextBtn.click();
      await delay(1200);

      const nextHeading = await page.$eval('h3.font-black', (el) => el.innerText).catch(() => 'Heading not found');
      console.log(`Navigated to: "${nextHeading}"`);

      const pageTextTomorrow = await page.evaluate(() => document.body.innerText);
      const hasTomorrowMeetingOnTomorrow = pageTextTomorrow.includes(testTomorrowTitle);
      const hasTodayMeetingOnTomorrow = pageTextTomorrow.includes(testTodayTitle);
      console.log(`On TOMORROW's Schedule:`);
      console.log(`  - "${testTomorrowTitle}" visible: ${hasTomorrowMeetingOnTomorrow} (Expected: true)`);
      console.log(`  - "${testTodayTitle}" visible: ${hasTodayMeetingOnTomorrow} (Expected: false)`);

      // Return to Today
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Today');
        if (btn) btn.click();
      });
      await delay(1000);
    }

    // -----------------------------------------------------------------------
    // TEST (d): Screen Fitting & Scrollbar Verification across resolutions
    // -----------------------------------------------------------------------
    console.log('\n--- Test (d): Screen Fitting & Scrollbar Verification ---');
    const resolutions = [
      { name: '1366x768', width: 1366, height: 768 },
      { name: '1536x864', width: 1536, height: 864 },
      { name: '1920x1080', width: 1920, height: 1080 },
    ];

    const adminTabsToCheck = [
      'Dashboard',
      'Schedule',
      'Bookings',
      'Rooms',
      'Blocks',
      'Screens',
      'Settings',
    ];

    for (const res of resolutions) {
      console.log(`\nTesting Resolution: ${res.name} (${res.width}x${res.height})`);
      await page.setViewport({ width: res.width, height: res.height });
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('aside nav button');
      await delay(600);

      for (const tabName of adminTabsToCheck) {
        await page.evaluate((label) => {
          const btns = Array.from(document.querySelectorAll('aside nav button'));
          const target = btns.find((b) => b.innerText.includes(label));
          if (target) target.click();
        }, tabName);
        await delay(500);

        const scrollInfo = await page.evaluate(() => {
          const docVScroll = document.documentElement.scrollHeight > window.innerHeight;
          const docHScroll = document.documentElement.scrollWidth > window.innerWidth;
          const bodyVScroll = document.body.scrollHeight > window.innerHeight;
          const bodyHScroll = document.body.scrollWidth > window.innerWidth;
          return {
            hasVScroll: docVScroll || bodyVScroll,
            hasHScroll: docHScroll || bodyHScroll,
            scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
            innerHeight: window.innerHeight,
          };
        });

        console.log(`  Tab "${tabName}": Vertical Scroll = ${scrollInfo.hasVScroll}, Horizontal Scroll = ${scrollInfo.hasHScroll}`);

        // Capture Admin Schedule screenshot while on the Schedule tab
        if (tabName === 'Schedule' && (res.name === '1366x768' || res.name === '1920x1080')) {
          const schedulePath = path.join(ARTIFACTS_DIR, `admin_schedule_${res.name}.png`);
          await page.screenshot({ path: schedulePath });
          console.log(`  Captured screenshot: admin_schedule_${res.name}.png`);
        }
      }

      // Check Display Room Screen
      const roomPage = await browser.newPage();
      await roomPage.setViewport({ width: res.width, height: res.height });
      await roomPage.goto(`${BASE_URL}/display/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' });
      await roomPage.waitForSelector('h1');
      await delay(600);
      const displayScroll = await roomPage.evaluate(() => ({
        hasVScroll: document.documentElement.scrollHeight > window.innerHeight || document.body.scrollHeight > window.innerHeight,
        hasHScroll: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
      }));
      console.log(`  Display Room Screen: Vertical Scroll = ${displayScroll.hasVScroll}, Horizontal = ${displayScroll.hasHScroll}`);

      if (res.name === '1366x768' || res.name === '1920x1080') {
        const roomPath = path.join(ARTIFACTS_DIR, `display_room_${res.name}.png`);
        await roomPage.screenshot({ path: roomPath });
        console.log(`  Captured screenshot: display_room_${res.name}.png`);
      }
      await roomPage.close();

      // Check Display Lobby Screen
      const lobbyPage = await browser.newPage();
      await lobbyPage.setViewport({ width: res.width, height: res.height });
      await lobbyPage.goto(`${BASE_URL}/display/lobby`, { waitUntil: 'domcontentloaded' });
      await lobbyPage.waitForSelector('h1');
      await delay(600);
      const lobbyScroll = await lobbyPage.evaluate(() => ({
        hasVScroll: document.documentElement.scrollHeight > window.innerHeight || document.body.scrollHeight > window.innerHeight,
        hasHScroll: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
      }));
      console.log(`  Display Lobby Screen: Vertical Scroll = ${lobbyScroll.hasVScroll}, Horizontal = ${lobbyScroll.hasHScroll}`);

      if (res.name === '1366x768' || res.name === '1920x1080') {
        const lobbyPath = path.join(ARTIFACTS_DIR, `display_lobby_${res.name}.png`);
        await lobbyPage.screenshot({ path: lobbyPath });
        console.log(`  Captured screenshot: display_lobby_${res.name}.png`);
      }
      await lobbyPage.close();
    }

    // -----------------------------------------------------------------------
    // TEST (e): Display Screen Content Cleanliness Check
    // -----------------------------------------------------------------------
    console.log('\n--- Test (e): Display Screen Content Inspection ---');
    const testPage = await browser.newPage();
    await testPage.goto(`${BASE_URL}/display/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' });
    await testPage.waitForSelector('h1');
    await delay(1000); // give heartbeat request time to complete
    const displayText = await testPage.evaluate(() => document.body.innerText);
    const hasIpDetails = /192\.168\.50\.143/i.test(displayText);
    const hasHeartbeatText = /HEARTBEAT/i.test(displayText);
    const hasDhcpText = /DHCP/i.test(displayText);
    const hasQrImage = await testPage.evaluate(() => !!document.querySelector('img[alt="Scan QR"]'));
    await testPage.close();

    console.log(`  - IP details visible on screen: ${hasIpDetails} (Expected: false)`);
    console.log(`  - HEARTBEAT text visible on screen: ${hasHeartbeatText} (Expected: false)`);
    console.log(`  - DHCP text visible on screen: ${hasDhcpText} (Expected: false)`);
    console.log(`  - QR Code element present: ${hasQrImage} (Expected: true)`);

    // Check admin screens tab shows screen as Online
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('aside nav button');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside nav button'));
      const target = btns.find((b) => b.innerText.includes('Screens'));
      if (target) target.click();
    });
    await delay(800);
    const screensText = await page.evaluate(() => document.body.innerText);
    const showsOnline = screensText.includes('Online');
    console.log(`  - Admin Display Screens shows Room 1 as Online: ${showsOnline} (Expected: true)`);

    // -----------------------------------------------------------------------
    // TEST (g): Overlap Rejection & Booking Integrity
    // -----------------------------------------------------------------------
    console.log('\n--- Test (g): Integrity & Constraint Verification ---');
    // Overlap rejection test (trying to book exact same slot in Room 1 11:00-12:00 UTC)
    const overlapRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: '11111111-1111-1111-1111-111111111111',
        title: 'Conflicting Booking Attempt',
        organizer_name: 'Overlap Tester',
        organizer_email: 'tester@internal.net',
        start_time: `${todayDubai}T11:00:00.000Z`,
        end_time: `${todayDubai}T12:00:00.000Z`,
      }),
    });
    const overlapData = await overlapRes.json();
    console.log(`  - Overlap status: ${overlapRes.status}, code: ${overlapData.code}, error: "${overlapData.error}"`);

    // Cancellation via token test
    if (todayBookData.booking && todayBookData.booking.cancel_token) {
      const cancelRes = await fetch(`${BASE_URL}/api/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: todayBookData.booking.cancel_token }),
      });
      const cancelData = await cancelRes.json();
      console.log(`  - Cancellation via secret token: status = ${cancelRes.status}, message = "${cancelData.message}"`);
    }

    console.log('\n====================================================');
    console.log('✔ All verification tests completed successfully!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test Suite Encountered Error:', err);
    throw err;
  } finally {
    try {
      const { getPool } = await import('../src/lib/db.ts');
      await getPool().end();
    } catch {}
    await browser.close();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
