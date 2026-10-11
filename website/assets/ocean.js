/* Ocean Fishing — "The Descent": the living sea behind the page.
   A fixed canvas draws a single water column. Scrolling is diving:
   sunlit shallows with schools of fish -> twilight (rays, sharks, jellyfish)
   -> midnight (things that are only half-seen, revealed by your lantern).
   Pure canvas, no network, no dependencies. Text/content is never touched. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var doc = document, root = doc.documentElement;

  /* ---------------------------------------------------------------- util */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mixRGB(c1, c2, t) { return [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)]; }
  function rgb(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a == null ? 1 : a) + ")"; }

  /* depth palette: [t, rgb] */
  var STOPS = [
    [0.00, [18, 150, 178]],
    [0.14, [10, 112, 152]],
    [0.30, [8, 80, 124]],
    [0.48, [6, 48, 88]],
    [0.68, [3, 26, 52]],
    [0.86, [2, 13, 28]],
    [1.00, [1, 6, 14]]
  ];
  function pal(t) {
    t = clamp(t, 0, 1);
    for (var i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i];
        return mixRGB(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return STOPS[STOPS.length - 1][1];
  }

  /* ---------------------------------------------------------------- DOM */
  var cv = doc.createElement("canvas");
  cv.id = "sea"; cv.setAttribute("aria-hidden", "true");
  doc.body.insertBefore(cv, doc.body.firstChild);
  var ctx = cv.getContext("2d");

  var gauge = doc.createElement("div");
  gauge.className = "depthgauge"; gauge.setAttribute("aria-hidden", "true");
  var gem = doc.createElement("i"); gauge.appendChild(gem);
  doc.body.appendChild(gauge);

  var foot = doc.querySelector("footer");
  if (foot) {
    var bed = doc.createElement("div"); bed.className = "seabed"; bed.setAttribute("aria-hidden", "true");
    var h = "<div class='rock'></div>", i;
    for (i = 0; i < 54; i++) {
      var ht = rnd(26, 118), lf = (i / 54) * 100 + rnd(-1, 1);
      h += "<div class='blade' style='left:" + lf.toFixed(2) + "%;height:" + ht.toFixed(0) + "px;--sw:" + rnd(3.6, 7).toFixed(1) + "s;--sd:-" + rnd(0, 6).toFixed(1) + "s;opacity:" + rnd(.4, .9).toFixed(2) + "'></div>";
    }
    for (i = 0; i < 14; i++) {
      var s = rnd(2, 5);
      h += "<div class='glowdot' style='left:" + rnd(2, 98).toFixed(1) + "%;bottom:" + rnd(4, 70).toFixed(0) + "px;width:" + s.toFixed(1) + "px;height:" + s.toFixed(1) + "px;--sw:" + rnd(2.6, 6).toFixed(1) + "s'></div>";
    }
    bed.innerHTML = h; foot.appendChild(bed);
  }

  /* scroll reveal — class is added here so no-JS readers still see everything */
  (function () {
    var sel = ".hero p,.hero .kpi,.wrap > h1,.wrap > p,h2,.card,.fact,.msg,.controls,.tblwrap,details.rowblock,.notice,.pat";
    var nodes = doc.querySelectorAll(sel);
    if (!("IntersectionObserver" in window) || reduce) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    Array.prototype.forEach.call(nodes, function (n, k) {
      if (n.closest(".dbody")) return;
      n.classList.add("rv");
      if (n.matches(".tblwrap,details,.pat,.controls")) n.classList.add("soft");
      var sib = n.parentNode ? Array.prototype.indexOf.call(n.parentNode.children, n) : 0;
      n.style.setProperty("--d", ((sib % 6) * 0.07).toFixed(2) + "s");
      io.observe(n);
    });
  })();

  /* ------------------------------------------------------------- state */
  var W = 0, H = 0, DPR = 1;
  var scrollY = 0, cur = 0, curS = 0, Hs = 4200, lastScroll = 0;
  var px = -999, py = -999, tx = -999, ty = -999, hasPtr = false, ptrAt = 0;
  var T = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function readScroll() {
    scrollY = window.pageYOffset || root.scrollTop || 0;
    var full = Math.max(root.scrollHeight, H + 1);
    var max = Math.max(full - H, 1);
    cur = clamp(scrollY / max, 0, 1);
    Hs = clamp(full * 0.8, 3300, 6800);
  }
  window.addEventListener("resize", function () { resize(); readScroll(); if (reduce) frame(0); });
  window.addEventListener("scroll", function () { readScroll(); if (reduce) frame(0); }, { passive: true });
  window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; hasPtr = true; ptrAt = performance.now(); if (px < -500) { px = tx; py = ty; } }, { passive: true });
  window.addEventListener("pointerdown", function (e) { burst(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("pointerleave", function () { hasPtr = false; });

  function yAt(d) { return H * 0.5 + (d - curS) * Hs; }

  /* ----------------------------------------------------- drawing: fish */
  function fish(x, y, L, dir, ph, c1, c2, a, fin) {
    var wag = Math.sin(ph) * L * 0.13;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.globalAlpha = a;
    // tail
    ctx.fillStyle = c2; ctx.beginPath();
    ctx.moveTo(-L * 0.36, wag * 0.4); ctx.lineTo(-L * 0.62, -L * 0.2 + wag); ctx.quadraticCurveTo(-L * 0.52, wag * 0.8, -L * 0.62, L * 0.2 + wag); ctx.closePath(); ctx.fill();
    if (fin) { ctx.beginPath(); ctx.moveTo(L * 0.05, -L * 0.2); ctx.lineTo(-L * 0.12, -L * (0.2 + fin)); ctx.lineTo(-L * 0.22, -L * 0.17); ctx.closePath(); ctx.fill(); }
    // body
    var g = ctx.createLinearGradient(0, -L * 0.25, 0, L * 0.25);
    g.addColorStop(0, c1); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.bezierCurveTo(L * 0.3, -L * 0.28, -L * 0.18, -L * 0.24, -L * 0.38, wag * 0.4);
    ctx.bezierCurveTo(-L * 0.18, L * 0.22, L * 0.3, L * 0.26, L * 0.5, 0); ctx.fill();
    // eye
    ctx.fillStyle = "rgba(4,18,30,.85)"; ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.04, Math.max(L * 0.035, 0.8), 0, 6.3); ctx.fill();
    ctx.restore();
  }

  /* --------------------------------------------------------- creatures */
  var schools = [], jellies = [], mantas = [], sharks = [], watchers = [], flakes = [], bubbles = [], puffs = [];
  var serpents = [], krakens = [], anglers = [], eyesPair;

  function makeSchool(d, n, dir, c1, c2, L) {
    var s = { d: d, dir: dir, x: rnd(0, 1) * 1400, sp: rnd(26, 52) * dir, f: [], c1: c1, c2: c2, L: L };
    for (var i = 0; i < n; i++) s.f.push({ ox: rnd(-130, 130), oy: rnd(-60, 60), ph: rnd(0, 6.3), k: rnd(0.8, 1.25), dx: 0, dy: 0 });
    return s;
  }
  function build() {
    schools = [
      makeSchool(0.03, 16, 1, "#ffe6a0", "#e8933a", 22),
      makeSchool(0.075, 12, -1, "#cdeff7", "#59b6d4", 26),
      makeSchool(0.12, 18, 1, "#ffd27a", "#d9772a", 19),
      makeSchool(0.17, 14, -1, "#e4f6ff", "#4fa5cf", 24),
      makeSchool(0.225, 20, 1, "#9fe0ee", "#2a8bb5", 18),
      makeSchool(0.285, 12, -1, "#bfe8f4", "#3b96bd", 28),
      makeSchool(0.345, 16, 1, "#7fcfe6", "#1f78a8", 20),
      makeSchool(0.40, 10, -1, "#8fd8ec", "#2a82ad", 24)
    ];
    mantas = [{ d: 0.30, x: -200, dir: 1, sp: 30, L: 190, ph: 0 }, { d: 0.52, x: W + 200, dir: -1, sp: 22, L: 250, ph: 2 }];
    sharks = [
      { d: 0.20, x: W * 1.2, dir: -1, sp: 18, L: 760, a: 0.34, fin: 0.34, col: ["#2b7fa6", "#1b5f87"] },
      { d: 0.375, x: -400, dir: 1, sp: 40, L: 320, a: 0.55, fin: 0.3, col: ["#143f60", "#0c2c47"] },
      { d: 0.57, x: W * 0.7, dir: -1, sp: 46, L: 360, a: 0.7, fin: 0.28, col: ["#0a2640", "#06192c"] }
    ];
    var jc = [[190, 120, 255], [90, 230, 255], [255, 120, 190], [140, 255, 200]];
    jellies = [];
    for (var i = 0; i < 12; i++) {
      jellies.push({ d: 0.40 + (i / 12) * 0.5 + rnd(-0.02, 0.02), x: rnd(0.05, 0.95) * 1400, r: rnd(22, 58), ph: rnd(0, 6.3), c: jc[i % jc.length], vx: rnd(-6, 6), dep: rnd(.9, 1.1) });
    }
    serpents = [
      { d: 0.63, x: -200, dir: 1, sp: 34, L: 1250, R: 34, amp: 46, f: 1.5, N: 38, tone: [26, 92, 118] },
      { d: 0.905, x: W + 200, dir: -1, sp: 22, L: 1700, R: 48, amp: 70, f: 1.0, N: 44, tone: [34, 70, 112] }
    ];
    krakens = [{ d: 0.80, side: 1 }, { d: 0.985, side: -1 }];
    anglers = [{ d: 0.715, x: W * 0.8, dir: -1, sp: 14, L: 260 }, { d: 0.935, x: W * 0.2, dir: 1, sp: 11, L: 330 }];
    eyesPair = { d: 0.96 };
    watchers = [];
    var wc = [[255, 190, 70], [255, 80, 70], [110, 255, 200], [255, 190, 70], [200, 120, 255]];
    for (i = 0; i < 16; i++) watchers.push({ d: 0.66 + Math.random() * 0.33, x: rnd(0.06, 0.94), dy: rnd(-300, 300), s: rnd(2.2, 6), gap: rnd(9, 26), per: rnd(6, 14), off: rnd(0, 14), c: wc[i % wc.length] });
    flakes = [];
    for (i = 0; i < 120; i++) flakes.push({ x: rnd(0, 1), y: rnd(0, 1), z: rnd(0.3, 1), ph: rnd(0, 6.3) });
    bubbles = [];
    for (i = 0; i < 26; i++) bubbles.push({ x: rnd(0, 1), y: rnd(0, 1), r: rnd(1.4, 5), v: rnd(22, 60), ph: rnd(0, 6.3) });
  }

  /* torch reveal: pointer lantern (or a wandering one for touch users) */
  var lx = 0, ly = 0;
  function reveal(x, y, R) {
    var d = Math.hypot(x - lx, y - ly), t = clamp(1 - d / R, 0, 1);
    return t * t * (3 - 2 * t);
  }
  function monsterFill(rv, tone, bgc) {
    return rgb(mixRGB([bgc[0] * 0.92, bgc[1] * 0.92, bgc[2] * 0.96], tone, rv));
  }

  /* -------------------------------------------------------- scene parts */
  function drawBackground() {
    var top = pal(curS - 0.02), bot = pal(curS + 0.16);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawSun() {
    var shallow = 1 - sm(0.0, 0.34, curS);
    if (shallow <= 0.01) return;
    var sx = W * 0.5 + Math.sin(T * 0.07) * W * 0.04, sy = 30 - scrollY * 0.42;
    var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(255,246,206," + (0.62 * shallow) + ")");
    g.addColorStop(0.18, "rgba(255,224,150," + (0.26 * shallow) + ")");
    g.addColorStop(0.5, "rgba(130,230,245," + (0.09 * shallow) + ")");
    g.addColorStop(1, "rgba(130,230,245,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // god rays
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var n = 11, len = Math.max(W, H) * 1.7;
    for (var i = 0; i < n; i++) {
      var a = Math.PI / 2 + (i - (n - 1) / 2) * 0.115 + Math.sin(T * 0.12 + i * 1.7) * 0.035;
      var wdt = 0.03 + 0.022 * Math.sin(T * 0.21 + i * 2.3);
      var al = (0.05 + 0.04 * Math.sin(T * 0.35 + i * 1.3)) * shallow;
      var x1 = sx + Math.cos(a - wdt) * len, y1 = sy + Math.sin(a - wdt) * len;
      var x2 = sx + Math.cos(a + wdt) * len, y2 = sy + Math.sin(a + wdt) * len;
      var rg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len * 0.8, sy + Math.sin(a) * len * 0.8);
      rg.addColorStop(0, "rgba(255,240,190," + al + ")"); rg.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // caustic shimmer drifting at the very top
    var cs = 1 - sm(0.0, 0.2, curS);
    if (cs > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 1.2;
      for (var k = 0; k < 9; k++) {
        var yy = 20 + k * 44 - scrollY * (0.25 + k * 0.01);
        if (yy < -20 || yy > H * 0.8) continue;
        ctx.strokeStyle = "rgba(220,250,255," + (0.07 * cs) + ")"; ctx.beginPath();
        for (var xx = 0; xx <= W; xx += 22) { var yv = yy + Math.sin(xx * 0.012 + T * 0.9 + k) * 6 + Math.sin(xx * 0.031 - T * 0.6 + k * 2) * 3; if (xx === 0) ctx.moveTo(xx, yv); else ctx.lineTo(xx, yv); }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawSchools(dt) {
    for (var s = 0; s < schools.length; s++) {
      var sc = schools[s], y = yAt(sc.d);
      sc.x += sc.sp * dt;
      var span = W + 500;
      if (sc.dir > 0 && sc.x > W + 250) sc.x = -250 - rnd(0, 200);
      if (sc.dir < 0 && sc.x < -250) sc.x = W + 250 + rnd(0, 200);
      if (y < -240 || y > H + 240) continue;
      var vis = 0.95 - sm(0.45, 0.62, curS) * 0.6;
      var bgc = pal(curS);
      for (var i = 0; i < sc.f.length; i++) {
        var f = sc.f[i];
        var fx = sc.x + f.ox + Math.sin(T * 0.8 + i) * 16 + f.dx;
        var fy = y + f.oy + Math.cos(T * 0.6 + i * 1.3) * 12 + f.dy;
        var dxp = fx - px, dyp = fy - py, dd = Math.hypot(dxp, dyp);
        if (dd < 150 && hasPtr) { var push = (150 - dd) / 150 * 4; f.dx += dxp / (dd + 1) * push; f.dy += dyp / (dd + 1) * push; }
        f.dx *= 0.965; f.dy *= 0.965;
        // fade with depth into the blue (colour pulled toward the water)
        fish(fx, fy, sc.L * f.k, sc.dir, T * 7 * f.k + f.ph, sc.c1, sc.c2, vis);
      }
    }
  }

  function drawMantas(dt) {
    for (var i = 0; i < mantas.length; i++) {
      var m = mantas[i]; m.x += m.sp * m.dir * dt;
      if (m.dir > 0 && m.x > W + 300) m.x = -300; if (m.dir < 0 && m.x < -300) m.x = W + 300;
      var y = yAt(m.d) + Math.sin(T * 0.3 + i) * 26; if (y < -260 || y > H + 260) continue;
      var f = 0.62 + 0.38 * Math.sin(T * 1.4 + m.ph), L = m.L, Wd = L * 0.95;
      ctx.save(); ctx.translate(m.x, y); ctx.scale(m.dir, 1); ctx.rotate(Math.sin(T * 0.4 + i) * 0.05);
      var bg = pal(curS), col = mixRGB(bg, [60, 150, 190], 0.28);
      ctx.fillStyle = rgb(col, 0.78); ctx.beginPath();
      ctx.moveTo(L * 0.5, 0);
      ctx.quadraticCurveTo(L * 0.15, -Wd * f * 0.55, -L * 0.22, -Wd * f * 0.5);
      ctx.quadraticCurveTo(-L * 0.08, -Wd * 0.08, -L * 0.34, 0);
      ctx.quadraticCurveTo(-L * 0.08, Wd * 0.08, -L * 0.22, Wd * f * 0.5);
      ctx.quadraticCurveTo(L * 0.15, Wd * f * 0.55, L * 0.5, 0); ctx.fill();
      ctx.strokeStyle = rgb(col, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-L * 0.34, 0);
      ctx.quadraticCurveTo(-L * 0.7, Math.sin(T * 2) * 14, -L * 1.0, Math.sin(T * 2 + 1) * 26); ctx.stroke();
      ctx.restore();
    }
  }

  function drawSharks(dt) {
    for (var i = 0; i < sharks.length; i++) {
      var s = sharks[i]; s.x += s.sp * s.dir * dt;
      if (s.dir > 0 && s.x > W + s.L) s.x = -s.L; if (s.dir < 0 && s.x < -s.L) s.x = W + s.L;
      var y = yAt(s.d) + Math.sin(T * 0.25 + i * 2) * 20;
      if (y < -s.L * 0.4 || y > H + s.L * 0.4) continue;
      var bgc = pal(curS), rv = Math.max(0.0, reveal(s.x, y, 280)) * sm(0.3, 0.6, curS);
      var c1 = rgb(mixRGB(mixRGB(bgc, [40, 110, 150], 0.2 + 0.0), [90, 190, 220], rv * 0.7)),
        c2 = rgb(mixRGB(bgc, [30, 90, 130], 0.15 + rv * 0.3));
      fish(s.x, y, s.L, s.dir, T * 1.6 + i, c1, c2, s.a, s.fin);
    }
  }

  function drawJellies(dt) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < jellies.length; i++) {
      var j = jellies[i];
      var y = yAt(j.d) + Math.sin(T * 0.5 + j.ph) * 30;
      j.x += (j.vx + Math.sin(T * 0.3 + j.ph) * 9) * dt;
      var wx = ((j.x % (W + 200)) + (W + 200)) % (W + 200) - 100;
      if (y < -220 || y > H + 220) continue;
      var pulse = 1 + 0.1 * Math.sin(T * 1.7 + j.ph), r = j.r * pulse * j.dep, c = j.c;
      var vis = (sm(0.36, 0.5, curS) * 0.9 + 0.1) * 0.7;
      var halo = ctx.createRadialGradient(wx, y, 0, wx, y, r * 3.2);
      halo.addColorStop(0, rgb(c, 0.28 * vis)); halo.addColorStop(1, rgb(c, 0));
      ctx.fillStyle = halo; ctx.fillRect(wx - r * 3.3, y - r * 3.3, r * 6.6, r * 6.6);
      // tentacles
      ctx.lineWidth = 1.4;
      for (var k = 0; k < 8; k++) {
        var ox = (k / 7 - 0.5) * r * 1.6;
        ctx.strokeStyle = rgb(c, 0.38 * vis); ctx.beginPath(); ctx.moveTo(wx + ox, y + r * 0.12);
        for (var q = 1; q <= 9; q++) {
          var f = q / 9;
          ctx.lineTo(wx + ox + Math.sin(T * 1.3 + q * 0.7 + k) * r * 0.22 * f, y + r * 0.12 + f * r * (2.1 + (k % 3) * 0.5));
        }
        ctx.stroke();
      }
      // bell
      ctx.fillStyle = rgb(c, 0.34 * vis); ctx.strokeStyle = rgb(mixRGB(c, [255, 255, 255], 0.4), 0.55 * vis); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(wx - r, y + r * 0.1);
      ctx.bezierCurveTo(wx - r, y - r * 1.15, wx + r, y - r * 1.15, wx + r, y + r * 0.1);
      ctx.quadraticCurveTo(wx + r * 0.5, y + r * 0.34, wx, y + r * 0.14);
      ctx.quadraticCurveTo(wx - r * 0.5, y + r * 0.34, wx - r, y + r * 0.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgb([255, 255, 255], 0.16 * vis); ctx.beginPath(); ctx.ellipse(wx - r * 0.25, y - r * 0.5, r * 0.28, r * 0.14, -0.5, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }

  /* ---- the things in the dark ---- */
  function drawSerpents(dt) {
    var bgc = pal(Math.min(1, curS + 0.05));
    for (var s = 0; s < serpents.length; s++) {
      var m = serpents[s];
      m.x += m.sp * m.dir * dt;
      if (m.dir > 0 && m.x - m.L > W + 120) m.x = -160;
      if (m.dir < 0 && m.x + m.L < -120) m.x = W + 160;
      var y = yAt(m.d);
      if (y < -m.amp - 160 || y > H + m.amp + 160) continue;
      var N = m.N, sp = m.L / N, P = [], i;
      for (i = -1; i < N; i++) {
        var f = Math.max(i, 0) / N;
        P.push({ x: m.x - m.dir * i * sp, y: y + Math.sin(T * m.f - i * 0.27) * m.amp * (0.45 + f * 0.8), r: m.R * (i < 0 ? 0.55 : (1 - 0.9 * Math.pow(f, 0.85)) * (i < 3 ? 1.05 : 1)) });
      }
      var mx = P[2].x, my = P[2].y;
      var rv = Math.max(reveal(mx, my, 300), reveal(P[8].x, P[8].y, 260), reveal(P[16].x, P[16].y, 260)) * sm(0.35, 0.7, curS);
      var base = 0.2; rv = Math.max(rv, base);
      var A = [], B = [];
      for (i = 0; i < P.length; i++) {
        var p0 = P[Math.max(i - 1, 0)], p1 = P[Math.min(i + 1, P.length - 1)];
        var tx2 = p1.x - p0.x, ty2 = p1.y - p0.y, ln = Math.hypot(tx2, ty2) || 1, nx = -ty2 / ln, ny = tx2 / ln;
        A.push([P[i].x + nx * P[i].r, P[i].y + ny * P[i].r]); B.push([P[i].x - nx * P[i].r, P[i].y - ny * P[i].r]);
      }
      // dorsal spines
      ctx.fillStyle = monsterFill(rv * 0.9, m.tone, bgc);
      for (i = 3; i < P.length - 2; i += 2) {
        var sa = A[i], sb = A[i + 1], tipx = (sa[0] + sb[0]) / 2 + (A[i][0] - P[i].x) * 1.0, tipy = (sa[1] + sb[1]) / 2 + (A[i][1] - P[i].y) * 1.0;
        ctx.beginPath(); ctx.moveTo(sa[0], sa[1]); ctx.lineTo(tipx, tipy); ctx.lineTo(sb[0], sb[1]); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = monsterFill(rv, m.tone, bgc);
      ctx.beginPath(); ctx.moveTo(A[0][0], A[0][1]);
      for (i = 1; i < A.length; i++) ctx.lineTo(A[i][0], A[i][1]);
      for (i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgb([110, 235, 255], 0.05 + rv * 0.5); ctx.lineWidth = 1.2; ctx.stroke();
      // head jaw glint + bioluminescent flank
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (i = 3; i < P.length - 3; i += 2) {
        var pl = 0.35 + 0.65 * Math.abs(Math.sin(T * 1.1 + i * 0.5));
        var bx = P[i].x, by = P[i].y + P[i].r * 0.45;
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, 9);
        g.addColorStop(0, rgb([90, 255, 230], (0.3 + rv * 0.5) * pl)); g.addColorStop(1, rgb([90, 255, 230], 0));
        ctx.fillStyle = g; ctx.fillRect(bx - 9, by - 9, 18, 18);
      }
      // eyes: always alive
      var ex = P[2].x + m.dir * m.R * 0.45, ey = P[2].y - m.R * 0.3;
      var eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 26);
      eg.addColorStop(0, "rgba(255,120,60,.95)"); eg.addColorStop(0.25, "rgba(255,70,40,.45)"); eg.addColorStop(1, "rgba(255,40,20,0)");
      ctx.fillStyle = eg; ctx.fillRect(ex - 26, ey - 26, 52, 52);
      ctx.restore();
      ctx.fillStyle = "#ffd9a0"; ctx.beginPath(); ctx.ellipse(ex, ey, 5.5, 3.6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#220400"; ctx.fillRect(ex - 1, ey - 3.5, 2, 7);
    }
  }

  function tentacle(x0, y0, ang, len, w0, curl, ph, col, rvv, dirX) {
    var N = 26, seg = len / N, x = x0, y = y0, a = ang;
    ctx.lineCap = "round";
    for (var i = 0; i < N; i++) {
      a += curl * 0.05 + Math.sin(T * 0.7 + i * 0.32 + ph) * 0.055;
      var nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, w0 * Math.pow(1 - i / N, 0.9));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      if (i > 3 && i % 2 === 0 && i < N - 3) {
        ctx.fillStyle = "rgba(150,255,235," + (0.04 + rvv * 0.5) + ")"; ctx.beginPath(); ctx.arc(x + Math.sin(a) * 0, y + 0, Math.max(1.2, w0 * 0.12 * (1 - i / N)), 0, 6.3); ctx.fill();
      }
      x = nx; y = ny;
    }
  }
  function drawKrakens() {
    var bgc = pal(Math.min(1, curS + 0.05));
    for (var k = 0; k < krakens.length; k++) {
      var m = krakens[k], y = yAt(m.d);
      if (y < -520 || y > H + 520) continue;
      var left = m.side < 0, hx = left ? -60 : W + 60, dir = left ? 1 : -1;
      var rv = Math.max(reveal(left ? 160 : W - 160, y, 360), reveal(left ? 330 : W - 330, y + 40, 280)) * sm(0.45, 0.8, curS);
      rv = Math.max(rv, 0.2);
      var col = monsterFill(rv, [34, 78, 110], bgc), breath = Math.sin(T * 0.4 + k) * 10;
      // tentacles reach in from the edge
      for (var i = 0; i < 8; i++) {
        var spread = (i / 7 - 0.5) * 1.5;
        var ang = (left ? 0 : Math.PI) + spread * (left ? 1 : -1);
        var len = (440 + (i % 3) * 120 + Math.sin(T * 0.25 + i) * 40) * (0.9 + 0.1 * Math.sin(T * 0.2 + k));
        tentacle(hx, y + (i / 7 - 0.5) * 300 + breath, ang, len, 46 - (i % 3) * 6, (spread > 0 ? 1 : -1) * (left ? 1 : -1) * 0.9 * (i % 2 ? 1 : -1.3), i * 1.3, col, rv, dir);
      }
      // mantle / head
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(hx + dir * 40, y + breath * 0.5, 290, 250, 0, 0, 6.3); ctx.fill();
      // eye
      var ex = left ? 200 : W - 200, ey = y - 50 + breath * 0.5;
      var open = sm(-0.25, 0.35, Math.sin(T * 0.16 + k * 2.1));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      var eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 130);
      eg.addColorStop(0, "rgba(255,170,60," + (0.5 * open) + ")"); eg.addColorStop(0.35, "rgba(255,90,40," + (0.2 * open) + ")"); eg.addColorStop(1, "rgba(255,60,20,0)");
      ctx.fillStyle = eg; ctx.fillRect(ex - 130, ey - 130, 260, 260); ctx.restore();
      if (open > 0.04) {
        ctx.fillStyle = "rgba(255,196,96,.9)"; ctx.beginPath(); ctx.ellipse(ex, ey, 56, 36 * open, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#1a0300"; ctx.beginPath(); ctx.ellipse(ex, ey, 7, 32 * open, 0, 0, 6.3); ctx.fill();
      }
    }
  }

  function drawAnglers(dt) {
    var bgc = pal(Math.min(1, curS + 0.05));
    for (var i = 0; i < anglers.length; i++) {
      var a = anglers[i]; a.x += a.sp * a.dir * dt;
      if (a.dir > 0 && a.x > W + 400) a.x = -400; if (a.dir < 0 && a.x < -400) a.x = W + 400;
      var y = yAt(a.d) + Math.sin(T * 0.35 + i * 3) * 24; if (y < -340 || y > H + 340) continue;
      var L = a.L, rv = Math.max(reveal(a.x, y, 260), 0.22) * Math.max(0.35, sm(0.5, 0.8, curS));
      var col = monsterFill(rv, [30, 72, 96], bgc);
      ctx.save(); ctx.translate(a.x, y); ctx.scale(a.dir, 1);
      var sway = Math.sin(T * 1.2 + i) * L * 0.05;
      // tail
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-L * 0.32, 0); ctx.lineTo(-L * 0.68, -L * 0.22 + sway); ctx.lineTo(-L * 0.6, sway * 0.4); ctx.lineTo(-L * 0.68, L * 0.22 + sway); ctx.closePath(); ctx.fill();
      // body
      ctx.beginPath(); ctx.ellipse(0, 0, L * 0.42, L * 0.33, 0, 0, 6.3); ctx.fill();
      // jaw (lower)
      ctx.beginPath(); ctx.moveTo(L * 0.4, L * 0.02); ctx.lineTo(L * 0.58, L * 0.2); ctx.lineTo(L * 0.1, L * 0.34); ctx.closePath(); ctx.fill();
      // teeth
      ctx.fillStyle = rgb([220, 245, 255], 0.18 + rv * 0.7);
      for (var t = 0; t < 7; t++) {
        var tx3 = L * (0.5 - t * 0.058), ty3 = L * (0.07 + t * 0.045);
        ctx.beginPath(); ctx.moveTo(tx3, ty3); ctx.lineTo(tx3 - L * 0.012, ty3 - L * 0.07); ctx.lineTo(tx3 - L * 0.03, ty3); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx3 + L * 0.01, ty3 - L * 0.09); ctx.lineTo(tx3 - L * 0.004, ty3 - L * 0.17); ctx.lineTo(tx3 - L * 0.028, ty3 - L * 0.09); ctx.closePath(); ctx.fill();
      }
      // eye
      ctx.fillStyle = "rgba(255,210,120,.9)"; ctx.beginPath(); ctx.arc(L * 0.3, -L * 0.1, L * 0.034, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#120300"; ctx.beginPath(); ctx.arc(L * 0.307, -L * 0.1, L * 0.016, 0, 6.3); ctx.fill();
      // stalk + lure
      var lxs = L * 0.62, lys = -L * 0.5 + Math.sin(T * 1.6 + i) * 10;
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L * 0.22, -L * 0.3);
      ctx.bezierCurveTo(L * 0.3, -L * 0.7, L * 0.58, -L * 0.72, lxs, lys); ctx.stroke();
      ctx.restore();
      // lure light (screen-space, additive) — always visible, it's the bait
      var wx = a.x + a.dir * lxs, wy = y + lys;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      var pul = 0.75 + 0.25 * Math.sin(T * 2.3 + i);
      var lg = ctx.createRadialGradient(wx, wy, 0, wx, wy, 90);
      lg.addColorStop(0, "rgba(255,255,220," + (0.95 * pul) + ")"); lg.addColorStop(0.12, "rgba(160,255,230," + (0.55 * pul) + ")");
      lg.addColorStop(0.4, "rgba(60,220,210," + (0.14 * pul) + ")"); lg.addColorStop(1, "rgba(40,200,200,0)");
      ctx.fillStyle = lg; ctx.fillRect(wx - 90, wy - 90, 180, 180);
      ctx.restore();
    }
  }

  function drawEyes() {
    // the big one: opens slowly in the abyss
    var y = yAt(eyesPair.d);
    if (y > -200 && y < H + 200) {
      var o = sm(0.1, 0.75, Math.sin(T * 0.17 + 1)) * sm(0.8, 0.95, curS);
      if (o > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        [[W * 0.34, y], [W * 0.34 + 200, y + 14]].forEach(function (e) {
          var g = ctx.createRadialGradient(e[0], e[1], 0, e[0], e[1], 190);
          g.addColorStop(0, "rgba(255,170,50," + (0.42 * o) + ")"); g.addColorStop(0.4, "rgba(255,80,30," + (0.13 * o) + ")"); g.addColorStop(1, "rgba(255,40,10,0)");
          ctx.fillStyle = g; ctx.fillRect(e[0] - 190, e[1] - 190, 380, 380);
        });
        ctx.restore();
        [[W * 0.34, y], [W * 0.34 + 200, y + 14]].forEach(function (e) {
          ctx.fillStyle = "rgba(255,190,80," + (0.92 * o) + ")"; ctx.beginPath(); ctx.ellipse(e[0], e[1], 64, 44 * o, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = "rgba(20,3,0," + o + ")"; ctx.beginPath(); ctx.ellipse(e[0], e[1], 8, 40 * o, 0, 0, 6.3); ctx.fill();
        });
      }
    }
    // small watchers
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < watchers.length; i++) {
      var w = watchers[i], wy = yAt(w.d) + w.dy; if (wy < -40 || wy > H + 40) continue;
      var ph = ((T + w.off) % w.per) / w.per, o2 = sm(0.08, 0.2, ph) * (1 - sm(0.72, 0.84, ph));
      var wx = w.x * W;
      var near = reveal(wx, wy, 170); o2 *= 1 - near * 0.9;   // they look away from your lantern
      if (o2 < 0.02) continue;
      var c = w.c;
      for (var e = -1; e <= 1; e += 2) {
        var ex = wx + e * w.gap;
        var g = ctx.createRadialGradient(ex, wy, 0, ex, wy, w.s * 5);
        g.addColorStop(0, rgb(c, 0.9 * o2)); g.addColorStop(0.3, rgb(c, 0.3 * o2)); g.addColorStop(1, rgb(c, 0));
        ctx.fillStyle = g; ctx.fillRect(ex - w.s * 5, wy - w.s * 5, w.s * 10, w.s * 10);
      }
    }
    ctx.restore();
  }

  function drawFlakes(dt, dScroll) {
    var deep = sm(0.1, 0.7, curS);
    ctx.fillStyle = "rgba(200,240,255,1)";
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += (6 + f.z * 12) * dt / H; f.y -= dScroll * 0.28 * f.z / H;
      f.x += Math.sin(T * 0.4 + f.ph) * 0.0002;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } if (f.y < -0.02) { f.y = 1.02; f.x = Math.random(); }
      var tw = 0.5 + 0.5 * Math.sin(T * 1.1 + f.ph);
      ctx.globalAlpha = (0.1 + 0.4 * f.z * tw) * (0.35 + deep * 0.65);
      ctx.beginPath(); ctx.arc(f.x * W, f.y * H, 0.5 + f.z * 1.3, 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y) {
    for (var i = 0; i < 9; i++) puffs.push({ x: x + rnd(-8, 8), y: y + rnd(-6, 6), r: rnd(1.5, 5), v: rnd(30, 90), life: 1, w: rnd(0, 6) });
  }
  function drawBubbles(dt, dScroll) {
    ctx.lineWidth = 1;
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.y -= b.v * dt / H; b.y += dScroll * 0.1 / H;
      if (b.y < -0.03) { b.y = 1.03; b.x = Math.random(); }
      var x = b.x * W + Math.sin(T * 1.2 + b.ph) * 8, y = b.y * H;
      ctx.strokeStyle = "rgba(210,248,255," + (0.28 * (1 - sm(0.5, 0.9, curS) * 0.6)) + ")";
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.3); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.22, 0, 6.3); ctx.fill();
    }
    for (var k = puffs.length - 1; k >= 0; k--) {
      var p = puffs[k]; p.y -= p.v * dt; p.life -= dt * 0.7; p.x += Math.sin(T * 3 + p.w) * 0.4;
      if (p.life <= 0) { puffs.splice(k, 1); continue; }
      ctx.strokeStyle = "rgba(220,250,255," + (0.5 * p.life) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.stroke();
    }
  }

  function drawLantern() {
    var deep = sm(0.18, 0.55, curS);
    if (deep <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var R = 300, g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
    g.addColorStop(0, "rgba(140,235,255," + (0.14 * deep) + ")"); g.addColorStop(0.45, "rgba(90,200,235," + (0.05 * deep) + ")"); g.addColorStop(1, "rgba(60,170,220,0)");
    ctx.fillStyle = g; ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
    ctx.restore();
  }

  function drawVignette() {
    var a = 0.18 + sm(0.2, 0.95, curS) * 0.5;
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, "rgba(0,4,10,0)"); g.addColorStop(1, "rgba(0,4,10," + a + ")");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /* ----------------------------------------------------------- loop */
  var lastT = 0, prevScroll = 0;
  function frame(now) {
    var dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0.016; lastT = now;
    if (reduce) { dt = 0; }
    T += dt;
    var dScroll = scrollY - prevScroll; prevScroll = scrollY;
    curS += (cur - curS) * (reduce ? 1 : 0.075);
    px += (tx - px) * 0.25; py += (ty - py) * 0.25;
    // lantern: pointer when present, otherwise a slow wandering light
    var wantX = hasPtr ? px : W * (0.5 + 0.32 * Math.sin(T * 0.21)), wantY = hasPtr ? py : H * (0.5 + 0.28 * Math.sin(T * 0.29 + 1));
    lx += (wantX - lx) * 0.12; ly += (wantY - ly) * 0.12;

    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawSun();
    drawFlakes(dt, dScroll);
    drawSchools(dt);
    drawSharks(dt);
    drawMantas(dt);
    drawJellies(dt);
    drawSerpents(dt);
    drawKrakens();
    drawAnglers(dt);
    drawEyes();
    drawBubbles(dt, dScroll);
    drawLantern();
    drawVignette();
    gem.style.top = (curS * 100).toFixed(2) + "%";
    if (!reduce && !doc.hidden) requestAnimationFrame(frame);
  }
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden && !reduce) { lastT = 0; requestAnimationFrame(frame); } });

  resize(); readScroll(); curS = cur; build();
  window.addEventListener("load", function () { readScroll(); });
  if (reduce) frame(0); else requestAnimationFrame(frame);
})();
