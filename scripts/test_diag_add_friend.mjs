import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://instachat07.netlify.app';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runDiag() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  try {
    const timestamp = Date.now().toString().slice(-5);
    const userA = { username: `Alpha_${timestamp}`, email: `alpha_${timestamp}@test.com`, password: 'password123' };
    const userB = { username: `Beta_${timestamp}`, email: `beta_${timestamp}@test.com`, password: 'password123' };

    const contextA = await browser.createBrowserContext();
    const contextB = await browser.createBrowserContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageA.on('console', (msg) => console.log('[A console]:', msg.type(), msg.text()));
    pageB.on('console', (msg) => console.log('[B console]:', msg.type(), msg.text()));

    pageA.on('response', async (res) => {
      if (res.url().includes('/api/')) {
        console.log(`[A response]: ${res.status()} ${res.url()}`);
      }
    });

    console.log('1. Loading app...');
    await Promise.all([
      pageA.goto(APP_URL, { waitUntil: 'networkidle2' }),
      pageB.goto(APP_URL, { waitUntil: 'networkidle2' }),
    ]);

    const clickBtn = async (page, text) => {
      return await page.evaluate((t) => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes(t));
        if (btn) { btn.click(); return true; }
        return false;
      }, text);
    };

    console.log('2. Sign up A & B...');
    await clickBtn(pageA, 'Sign Up');
    await delay(300);
    await pageA.type('input[placeholder="e.g. arjan_pro"]', userA.username);
    await pageA.type('input[type="email"]', userA.email);
    const pA = await pageA.$$('input[type="password"]');
    await pA[0].type(userA.password);
    await pA[1].type(userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForSelector('h2', { timeout: 15000 });

    await clickBtn(pageB, 'Sign Up');
    await delay(300);
    await pageB.type('input[placeholder="e.g. arjan_pro"]', userB.username);
    await pageB.type('input[type="email"]', userB.email);
    const pB = await pageB.$$('input[type="password"]');
    await pB[0].type(userB.password);
    await pB[1].type(userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForSelector('h2', { timeout: 15000 });

    console.log('3. Open Friends & Add Friend on A...');
    await clickBtn(pageA, 'Friends');
    await delay(1200);

    await pageA.click('button[data-testid="add-friend-trigger-btn"]');
    await delay(1000);

    await pageA.type('input[placeholder="Search by username..."]', userB.username);
    await delay(500);

    console.log('4. Submitting search form...');
    // Type into form and click search
    const modalContentBefore = await pageA.evaluate(() => document.querySelector('.modal-content')?.innerText);
    console.log('Modal text before search:\n', modalContentBefore);

    await pageA.evaluate(() => {
      const modal = document.querySelector('.modal-content');
      const form = modal?.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });

    await delay(3000);
    const modalContentAfter = await pageA.evaluate(() => document.querySelector('.modal-content')?.innerText);
    console.log('Modal text after search:\n', modalContentAfter);

  } catch (err) {
    console.error('Diag err:', err);
  } finally {
    await browser.close();
  }
}

runDiag();
