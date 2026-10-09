// node _shot.js <url> <out.png> [full]
const fs = require('fs');
const BASE = 'http://127.0.0.1:9222';
async function main() {
  const url = process.argv[2], out = process.argv[3], full = process.argv[4] === 'full';
  const r = await fetch(BASE + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const tab = await r.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
  let loaded = false;
  await new Promise(res => {
    ws.onopen = res;
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
      else if (m.method === 'Page.loadEventFired') loaded = true;
    };
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  const t0 = Date.now(); while (!loaded && Date.now() - t0 < 15000) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 2200));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, fromSurface: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
  await fetch(BASE + '/json/close/' + tab.id); ws.close(); process.exit(0);
}
main().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
