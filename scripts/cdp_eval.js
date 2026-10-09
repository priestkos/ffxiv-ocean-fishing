// Minimal CDP driver: node _cdp.js <url> <js-expression-file>
// Opens url in the already-running headless Chrome (port 9222), evaluates the JS
// from the given file in the page, prints the JSON result. Real DOM, real layout.
const fs = require('fs');
const BASE = 'http://127.0.0.1:9222';

async function main() {
  const url = process.argv[2];
  const exprFile = process.argv[3];
  const expr = fs.readFileSync(exprFile, 'utf8');
  const r = await fetch(BASE + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const tab = await r.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  let loaded = false;
  await new Promise((resolve) => {
    ws.onopen = resolve;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      } else if (msg.method === 'Page.loadEventFired') { loaded = true; }
    };
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  // re-navigate so we catch the load event deterministically
  await send('Page.navigate', { url });
  const t0 = Date.now();
  while (!loaded && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 1500));
  const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) {
    console.log('PAGE ERROR: ' + (out.exceptionDetails.exception?.description || out.exceptionDetails.text));
  } else {
    console.log(typeof out.result.value === 'string' ? out.result.value : JSON.stringify(out.result.value, null, 1));
  }
  await fetch(BASE + '/json/close/' + tab.id);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error('DRIVER ERROR ' + e.message); process.exit(1); });
