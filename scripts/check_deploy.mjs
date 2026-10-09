async function checkDeploy() {
  const previousBundle = 'index-CobtsIqx.js';
  console.log(`Polling https://instachat07.netlify.app for deployment of commit d7bc4d6 (replacing ${previousBundle})...`);

  for (let i = 0; i < 35; i++) {
    try {
      const res = await fetch('https://instachat07.netlify.app/?_t=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const html = await res.text();
      const match = html.match(/\/assets\/index-[a-zA-Z0-9_\-]+\.js/);
      const current = match ? match[0] : 'unknown';
      console.log(`[Attempt ${i+1}] Current live bundle: ${current}`);
      if (!current.includes(previousBundle) && current !== 'unknown') {
        console.log('\n>>> NEW DEPLOYMENT DETECTED ON NETLIFY! <<<');
        console.log(`Deployed Bundle: ${current}`);
        process.exit(0);
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
  console.log('Timeout waiting for Netlify deploy');
  process.exit(1);
}

checkDeploy();
