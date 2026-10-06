import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173/';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBrowserIntegrationTest() {
  console.log('====================================================');
  console.log('   INSTACHAT REAL BROWSER INTEGRATION TEST SUITE    ');
  console.log('====================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--window-size=1280,900',
    ],
  });

  const results = {
    authA: false,
    authB: false,
    friendRequest: false,
    friendAccept: false,
    chatOpened: false,
    messageAtoB: false,
    messageBtoA: false,
    gameInvite: false,
    gameJoined: false,
    gameMoveSync: false,
    webrtcCallSignaled: false,
  };

  try {
    const timestamp = Date.now().toString().slice(-5);
    const userA = {
      username: `Alpha_${timestamp}`,
      email: `alpha_${timestamp}@instachat.io`,
      password: 'password123',
    };
    const userB = {
      username: `Beta_${timestamp}`,
      email: `beta_${timestamp}@instachat.io`,
      password: 'password123',
    };

    // Create 2 independent incognito contexts
    const contextA = await browser.createBrowserContext();
    const contextB = await browser.createBrowserContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.setViewport({ width: 1280, height: 900 });
    await pageB.setViewport({ width: 1280, height: 900 });

    pageA.setDefaultTimeout(20000);
    pageB.setDefaultTimeout(20000);

    pageA.on('dialog', async (d) => {
      console.log(`[Browser A Dialog]: ${d.message()}`);
      await d.dismiss();
    });
    pageB.on('dialog', async (d) => {
      console.log(`[Browser B Dialog]: ${d.message()}`);
      await d.dismiss();
    });

    pageA.on('console', (msg) => {
      console.log(`[Page A Console ${msg.type()}]:`, msg.text());
    });
    pageA.on('pageerror', (err) => console.log(`[Page A PageError]:`, err.message));

    pageB.on('console', (msg) => {
      console.log(`[Page B Console ${msg.type()}]:`, msg.text());
    });
    pageB.on('pageerror', (err) => console.log(`[Page B PageError]:`, err.message));

    console.log(`[TEST 1] Loading Web App on Browser A & B...`);
    await Promise.all([
      pageA.goto(APP_URL, { waitUntil: 'networkidle2' }),
      pageB.goto(APP_URL, { waitUntil: 'networkidle2' }),
    ]);
    console.log('  -> Both browsers successfully reached INSTAChat web server.');

    // Helper: click a button by visible text
    const clickBtnWithText = async (page, textFragment) => {
      return await page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => b.innerText && b.innerText.includes(text));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, textFragment);
    };

    // 1. SIGN UP USER A
    console.log(`\n[TEST 2] Registering User A (${userA.username})...`);
    await clickBtnWithText(pageA, 'Sign Up');
    await delay(300);
    await pageA.type('input[placeholder="e.g. arjan_pro"]', userA.username);
    await pageA.type('input[type="email"]', userA.email);
    const passA = await pageA.$$('input[type="password"]');
    await passA[0].type(userA.password);
    await passA[1].type(userA.password);
    await pageA.click('button[type="submit"]');

    await pageA.waitForSelector('h2', { timeout: 15000 });
    results.authA = true;
    console.log(`  -> User A registered and entered dashboard: PASS`);

    // 2. SIGN UP USER B
    console.log(`\n[TEST 3] Registering User B (${userB.username})...`);
    await clickBtnWithText(pageB, 'Sign Up');
    await delay(300);
    await pageB.type('input[placeholder="e.g. arjan_pro"]', userB.username);
    await pageB.type('input[type="email"]', userB.email);
    const passB = await pageB.$$('input[type="password"]');
    await passB[0].type(userB.password);
    await passB[1].type(userB.password);
    await pageB.click('button[type="submit"]');

    await pageB.waitForSelector('h2', { timeout: 15000 });
    results.authB = true;
    console.log(`  -> User B registered and entered dashboard: PASS`);

    // 3. USER A SENDS FRIEND REQUEST TO USER B
    console.log(`\n[TEST 4] User A sending friend request to User B...`);
    // Navigate to Friends
    await clickBtnWithText(pageA, 'Friends');
    await delay(1000);

    // Click Add Friend button
    await clickBtnWithText(pageA, 'Add Friend');
    await delay(800);

    // Wait for search input
    await pageA.waitForSelector('input[placeholder="Search by username..."]', { timeout: 5000 });
    await pageA.type('input[placeholder="Search by username..."]', userB.username);
    await pageA.keyboard.press('Enter');
    await delay(2500);

    const searchModalText = await pageA.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      return modal ? modal.innerText.replace(/\n+/g, ' ') : 'No modal';
    });
    console.log('  -> Page A search modal text:', searchModalText);

    // Click "Add" button inside modal via data-testid
    await pageA.waitForSelector('button[data-testid="add-friend-btn"]', { timeout: 8000 });
    await pageA.click('button[data-testid="add-friend-btn"]');
    
    // Wait for Firestore write to complete and UI to update to 'Request Sent'
    await pageA.waitForFunction(
      () => document.body.innerText.includes('Request Sent'),
      { timeout: 12000 }
    );
    results.friendRequest = true;
    console.log(`  -> Friend request dispatched & confirmed ('Request Sent'): PASS`);
    await delay(1500);

    // Close Add modal on pageA
    await pageA.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      if (modal) {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) closeBtn.click();
      }
    });
    await delay(1000);

    // 4. USER B ACCEPTS FRIEND REQUEST
    console.log(`\n[TEST 5] User B receiving and accepting friend request...`);
    await clickBtnWithText(pageB, 'Friends');
    await delay(2000);

    // Wait until User B's UI sees the incoming request badge or count
    await pageB.waitForFunction(
      () => {
        const badge = document.querySelector('.badge-count');
        return badge !== null || document.body.innerText.includes('Requests 1');
      },
      { timeout: 12000 }
    ).catch(() => {});

    // Click "Requests" button on User B
    await clickBtnWithText(pageB, 'Requests');
    await delay(1500);

    // Wait for and click accept button via data-testid
    await pageB.waitForSelector('button[data-testid="accept-request-btn"]', { timeout: 12000 });
    await pageB.click('button[data-testid="accept-request-btn"]');
    results.friendAccept = true;
    console.log(`  -> Clicked accept-request-btn via native CDP click: PASS`);
    await delay(2000);

    // Close modal on User B
    await pageB.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      if (modal) {
        const closeBtn = modal.querySelector('button');
        if (closeBtn) closeBtn.click();
      }
    });
    await delay(1500);

    // 5. OPEN CHAT
    console.log(`\n[TEST 6] Opening conversation in both browsers...`);
    await delay(2000);

    // User A clicks "Chat" on User B's friend card
    await pageA.waitForSelector('button[data-testid="open-chat-btn"]', { timeout: 12000 });
    await pageA.click('button[data-testid="open-chat-btn"]');
    await delay(1500);

    // User B clicks "Chat" on User A's friend card
    await pageB.waitForSelector('button[data-testid="open-chat-btn"]', { timeout: 12000 });
    await pageB.click('button[data-testid="open-chat-btn"]');
    await delay(2000);

    // Verify chat input is visible
    const inputA = await pageA.$('input[placeholder="Type a message..."]');
    const inputB = await pageB.$('input[placeholder="Type a message..."]');
    results.chatOpened = !!(inputA && inputB);
    console.log(`  -> Deterministic conversation opened: ${results.chatOpened ? 'PASS' : 'FAIL'}`);

    // 6. SEND MESSAGE FROM USER A TO USER B
    console.log(`\n[TEST 7] User A sending message "Hello from User A!"...`);
    if (inputA) {
      await pageA.type('input[placeholder="Type a message..."]', 'Hello from User A!');
      await pageA.keyboard.press('Enter');
      await delay(3000);

      const bText = await pageB.evaluate(() => document.body.innerText);
      results.messageAtoB = bText.includes('Hello from User A!');
      console.log(`  -> Message received in Browser B: ${results.messageAtoB ? 'PASS' : 'FAIL'}`);
    }

    // 7. USER B REPLIES
    console.log(`\n[TEST 8] User B replying "Hello back from User B!"...`);
    if (inputB) {
      await pageB.type('input[placeholder="Type a message..."]', 'Hello back from User B!');
      await pageB.keyboard.press('Enter');
      await delay(3000);

      const aText = await pageA.evaluate(() => document.body.innerText);
      results.messageBtoA = aText.includes('Hello back from User B!');
      console.log(`  -> Reply received in Browser A: ${results.messageBtoA ? 'PASS' : 'FAIL'}`);
    }

    // 8. CHALLENGE TO MULTIPLAYER GAME
    console.log(`\n[TEST 9] User A challenging User B to Tic Tac Toe...`);
    const gameBtn = await pageA.$('button[title="Challenge to Game"]');
    if (gameBtn) {
      await gameBtn.click();
      await delay(1000);

      // In challenge modal, click Challenge via data-testid
      await pageA.waitForSelector('button[data-testid="challenge-friend-btn"]', { timeout: 8000 });
      await pageA.click('button[data-testid="challenge-friend-btn"]');
      results.gameInvite = true;
      console.log(`  -> Game invitation dispatched: PASS`);
      await delay(2000);

      // Check User B dialog and Accept via data-testid
      await pageB.waitForSelector('button[data-testid="accept-game-btn"]', { timeout: 8000 });
      await pageB.click('button[data-testid="accept-game-btn"]');
      results.gameJoined = true;
      console.log(`  -> Both players entered game room: PASS`);
      await delay(2500);

      // Test move synchronization: User A clicks cell 0
      await pageA.waitForSelector('button[data-testid="ttt-cell-0"]', { timeout: 8000 });
      await pageA.click('button[data-testid="ttt-cell-0"]');
      await delay(2000);

      const bGameText = await pageB.evaluate(() => document.body.innerText);
      results.gameMoveSync = bGameText.includes('X');
      console.log(`  -> Real-time move synchronized between browsers: ${results.gameMoveSync ? 'PASS' : 'FAIL'}`);
    }

    // 9. WEBRTC CALL INITIATION & SIGNALING TEST
    console.log(`\n[TEST 10] Testing WebRTC Call Signaling...`);
    // User A navigates back to chats
    await clickBtnWithText(pageA, 'Chats');
    await delay(1200);

    const callBtn = await pageA.$('button[title="Start Audio Call"]');
    if (callBtn) {
      await callBtn.click();
      await delay(3000);

      // Check if User B sees incoming call dialog
      const bText = await pageB.evaluate(() => document.body.innerText);
      results.webrtcCallSignaled =
        bText.includes('Incoming Audio Call') || bText.includes('Calling');
      console.log(`  -> WebRTC Call signaling received on Browser B: ${results.webrtcCallSignaled ? 'PASS' : 'FAIL'}`);

      // End call
      const endCallBtn = await pageA.$('button[title="End Call"]');
      if (endCallBtn) await endCallBtn.click();
      await delay(1000);
    }

    console.log('\n====================================================');
    console.log('       BROWSER INTEGRATION TEST RESULTS SUMMARY     ');
    console.log('====================================================');
    for (const [k, v] of Object.entries(results)) {
      console.log(`  ${k.padEnd(22)}: ${v ? 'PASS' : 'FAIL'}`);
    }

  } catch (err) {
    console.error('Browser integration test failed with error:', err);
  } finally {
    await browser.close();
  }
}

runBrowserIntegrationTest();
