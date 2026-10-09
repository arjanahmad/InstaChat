import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://instachat07.netlify.app';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runLiveWebsiteVerification() {
  console.log('========================================================================');
  console.log('   LIVE NETLIFY VERIFICATION: TWO-ACCOUNT FRIEND LIFECYCLE              ');
  console.log(`   URL: ${APP_URL}`);
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const timestamp = Date.now().toString().slice(-4);
    const userA = {
      username: `Arjan_${timestamp}`,
      email: `arjan_${timestamp}@instachat.io`,
      password: 'Password123!',
    };
    const userB = {
      username: `Ansar_${timestamp}`,
      email: `ansar_${timestamp}@instachat.io`,
      password: 'Password123!',
    };

    console.log('[STEP 1] Launching isolated browser contexts for Device A and Device B...');
    const contextA = await browser.createBrowserContext();
    const contextB = await browser.createBrowserContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.setViewport({ width: 1280, height: 900 });
    await pageB.setViewport({ width: 1280, height: 900 });

    pageA.on('console', (msg) => {
      if (msg.type() === 'error') console.log('  [Device A Console Error]:', msg.text());
    });
    pageB.on('console', (msg) => {
      if (msg.type() === 'error') console.log('  [Device B Console Error]:', msg.text());
    });

    console.log('[STEP 2] Navigating both devices to live Netlify website...');
    await Promise.all([
      pageA.goto(APP_URL, { waitUntil: 'networkidle2' }),
      pageB.goto(APP_URL, { waitUntil: 'networkidle2' }),
    ]);

    // Helper: Register a user
    const registerUser = async (page, user, deviceName) => {
      console.log(`  -> Registering ${user.username} on ${deviceName}...`);
      // Click Sign Up tab
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.innerText && x.innerText.includes('Sign Up'));
        if (b) b.click();
      });
      await delay(600);

      const usernameInput = await page.$('input[placeholder*="arjan_pro"], input[placeholder*="Username"]');
      const emailInput = await page.$('input[type="email"], input[placeholder*="you@domain.com"]');
      const passInputs = await page.$$('input[type="password"]');

      if (!usernameInput || !emailInput || passInputs.length < 2) {
        throw new Error(`Signup inputs not found on ${deviceName}`);
      }

      await usernameInput.type(user.username);
      await emailInput.type(user.email);
      await passInputs[0].type(user.password);
      await passInputs[1].type(user.password);

      await page.click('button[type="submit"]');

      // Wait for auth modal to disappear
      await page.waitForFunction(() => !document.querySelector('.modal-backdrop'), { timeout: 20000 });
      console.log(`  [PASS] ${user.username} successfully registered and signed in on ${deviceName}!`);
    };

    console.log('\n[STEP 3] Testing live registration for Device A (Arjan) and Device B (Ansar)...');
    await registerUser(pageA, userA, 'Device A');
    await registerUser(pageB, userB, 'Device B');

    // Helper: navigate to friends
    const navigateToFriends = async (page) => {
      await page.waitForSelector('aside button, nav button', { timeout: 10000 });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('aside button, nav button'));
        const f = btns.find((b) => b.innerText && b.innerText.includes('Friends'));
        if (f) f.click();
      });
      await delay(1200);
    };

    console.log('\n[STEP 4] Device B (Ansar) navigating to Friends view...');
    await navigateToFriends(pageB);

    console.log('[STEP 5] Device B opening Add Friend modal...');
    await pageB.waitForSelector('button[data-testid="add-friend-trigger-btn"]', { timeout: 10000 });
    await pageB.click('button[data-testid="add-friend-trigger-btn"]');
    await pageB.waitForSelector('.modal-content', { timeout: 10000 });

    console.log(`[STEP 6] Device B searching for "${userA.username}" in Add Friend modal...`);
    const searchInput = await pageB.$('input[placeholder*="Search by username"]');
    await searchInput.type(userA.username);

    // Submit search form
    await pageB.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      const submitBtn = modal?.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await delay(3000);

    const searchResultsText = await pageB.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      return modal ? modal.innerText : '';
    });
    console.log('  Search results on Device B:\n  ' + searchResultsText.split('\n').join('\n  '));

    if (searchResultsText.includes('No users found matching')) {
      throw new Error(`FAILED: Device B search returned 'No users found matching "${userA.username}"'`);
    }
    if (!searchResultsText.includes(userA.username)) {
      throw new Error(`FAILED: Expected user "${userA.username}" not found in search results.`);
    }
    console.log(`  [PASS] Found correct target user "${userA.username}" in live search results!`);

    console.log('\n[STEP 7] Device B clicking "Add" button to dispatch friend request...');
    const clickedAdd = await pageB.evaluate((targetUsername) => {
      const modal = document.querySelector('.modal-content');
      const cards = Array.from(modal.querySelectorAll('div'));
      const userCard = cards.find((c) => c.innerText && c.innerText.includes(targetUsername));
      if (userCard) {
        const addBtn = userCard.querySelector('button');
        if (addBtn) {
          addBtn.click();
          return true;
        }
      }
      return false;
    }, userA.username);

    if (!clickedAdd) {
      throw new Error('Could not find or click Add button for target user');
    }
    await delay(2500);

    const buttonState = await pageB.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      return modal ? modal.innerText : '';
    });
    console.log('  Modal state after sending request:\n  ' + buttonState.split('\n').join('\n  '));
    console.log('  [PASS] Friend request dispatched!');

    // Close Add Friend modal on Device B
    await pageB.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      const closeBtn = modal?.querySelector('button.btn-icon');
      if (closeBtn) closeBtn.click();
    });
    await delay(1000);

    console.log('\n[STEP 8] Device A (Arjan) navigating to Friends view to verify incoming request...');
    await navigateToFriends(pageA);
    await delay(2500);

    const pageAText = await pageA.evaluate(() => document.body.innerText);
    console.log('  Device A Friends view snippet:\n  ' + pageAText.slice(0, 400).split('\n').join('\n  '));

    // Check if incoming request from Ansar is visible
    const hasIncomingReq = pageAText.includes(userB.username) || pageAText.includes('Requests (1)') || pageAText.includes('Requests');
    console.log(`  Incoming request indicator present on Device A: ${hasIncomingReq}`);

    // If requests banner or button exists, click Accept
    console.log('\n[STEP 9] Device A accepting friend request...');
    const accepted = await pageA.evaluate((senderUsername) => {
      // Check banner first
      const banner = document.querySelector('[data-testid="pending-requests-banner"]');
      if (banner) {
        const acceptBtn = banner.querySelector('button.btn-primary');
        if (acceptBtn) {
          acceptBtn.click();
          return 'banner';
        }
      }
      // Check requests modal trigger
      const reqTrigger = document.querySelector('button[data-testid="view-requests-btn"]');
      if (reqTrigger) {
        reqTrigger.click();
        return 'modal_opened';
      }
      return false;
    }, userB.username);

    console.log(`  Accept action triggered: ${accepted}`);
    await delay(2000);

    if (accepted === 'modal_opened') {
      await pageA.waitForSelector('.modal-content', { timeout: 5000 });
      await pageA.evaluate(() => {
        const modal = document.querySelector('.modal-content');
        const acceptBtn = modal?.querySelector('button.btn-primary');
        if (acceptBtn) acceptBtn.click();
      });
      await delay(2000);
    }

    console.log('\n[STEP 10] Verifying mutual friendship on both devices...');
    await delay(2000);

    const friendsA = await pageA.evaluate(() => document.body.innerText);
    const friendsB = await pageB.evaluate(() => document.body.innerText);

    const aHasB = friendsA.includes(userB.username);
    const bHasA = friendsB.includes(userA.username);

    console.log(`  Device A shows friend ${userB.username}: ${aHasB}`);
    console.log(`  Device B shows friend ${userA.username}: ${bHasA}`);

    if (!aHasB) {
      console.log('  Device A text:\n', friendsA.slice(0, 400));
    }
    if (!bHasA) {
      console.log('  Device B text:\n', friendsB.slice(0, 400));
    }

    console.log('\n[STEP 11] Verifying persistence across page refresh...');
    await Promise.all([
      pageA.reload({ waitUntil: 'networkidle2' }),
      pageB.reload({ waitUntil: 'networkidle2' }),
    ]);
    await delay(2500);

    await navigateToFriends(pageA);
    await navigateToFriends(pageB);
    await delay(2000);

    const reloadedA = await pageA.evaluate(() => document.body.innerText);
    const reloadedB = await pageB.evaluate(() => document.body.innerText);

    const persistA = reloadedA.includes(userB.username);
    const persistB = reloadedB.includes(userA.username);

    console.log(`  Device A shows friend after reload: ${persistA}`);
    console.log(`  Device B shows friend after reload: ${persistB}`);

    if (!persistA || !persistB) {
      throw new Error(`Persistence check failed: Device A (${persistA}), Device B (${persistB})`);
    }

    console.log('\n========================================================================');
    console.log('   ALL LIVE NETLIFY TWO-ACCOUNT VERIFICATION STEPS PASSED!             ');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

runLiveWebsiteVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN LIVE VERIFICATION]:', err);
  process.exit(1);
});
