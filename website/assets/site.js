/* Ocean Fishing — site behaviour: live schedule, search, filters, planner.
   Data comes from assets/data.js (window.OF_SITE). No external requests. */
(function () {
  "use strict";
  var S = window.OF_SITE || {};
  var TWO = 7200000;
  var DEST = { B: "Bloodbrine Sea", T: "Rothlyt Sound", N: "Northern Strait of Merlthor", R: "Rhotano Sea" };
  var TOD = { D: "Day", S: "Sunset", N: "Night" };

  function vn(ms) { return Math.floor(ms / TWO); }
  function pat(p, v) { if (!p || !p.length) return null; return p[((v % p.length) + p.length) % p.length]; }
  function indigoAt(ms) {
    var c = pat(S.indigoPattern, (S.indigoOffset || 0) + vn(ms));
    if (!c) return { fam: "indigo", label: "—" };
    return { fam: "indigo", code: c, dest: DEST[c[0]], time: TOD[c[1]], label: DEST[c[0]] + " · " + TOD[c[1]] };
  }
  function rubyAt(ms) { var n = pat(S.rubyPattern, vn(ms)); return { fam: "ruby", name: n, label: n || "—" }; }
  function at(ms, fam) { return fam === "indigo" ? indigoAt(ms) : rubyAt(ms); }
  function nextMs() { return (vn(Date.now()) + 1) * TWO; }
  function fmtLocal(d) {
    return d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  function fmtUTC(d) { return d.toISOString().slice(5, 16).replace("T", " ") + " UTC"; }
  function cd(ms) {
    var s = Math.max(0, Math.round((ms - Date.now()) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + "h " : "") + m + "m " + (x < 10 ? "0" : "") + x + "s";
  }

  /* ---------- voyage stops for the planner ---------- */
  function indigoStops(info) {
    var r = (S.indigoRoutes || []).filter(function (x) { return x.code === info.code; })[0];
    if (!r) return [];
    return (r.stops || []).map(function (st) {
      var w = (S.indigo && S.indigo.waters || []).filter(function (x) { return x.water === st.name; })[0];
      return { name: st.name, time: st.time, normal: (w && w.normal) || [], spectral: (w && w.spectral) || [] };
    });
  }
  function rubyStops(info) {
    var key = function (s) { return String(s == null ? "" : s).replace(/\s*\/\s*/g, "/"); };
    var r = (S.ruby || []).filter(function (x) { return key(x.name) === key(info.name); })[0];
    if (!r) return [];
    return (r.meta || []).map(function (m) {
      var kw = m[0].replace(/^The /, "");
      var hits = (r.stops || []).filter(function (s) { return s.name.indexOf(kw) >= 0; });
      var normal = [], spectral = [];
      hits.forEach(function (s) {
        (/Spectral Current/.test(s.name) ? spectral : normal).push.apply(
          /Spectral Current/.test(s.name) ? spectral : normal, s.fish || []);
      });
      if (!normal.length && !spectral.length && (r.stops || []).length) {
        normal = (r.stops[0].fish || []);
      }
      return { name: m[0], time: m[1], normal: normal.concat(spectral), spectral: [] };
    });
  }
  function stopsFor(fam, info) { return fam === "indigo" ? indigoStops(info) : rubyStops(info); }

  function intuitionSet() {
    var s = {};
    ((S.indigo && S.indigo.intuition) || []).forEach(function (i) { s[i.fish] = i; });
    return s;
  }
  var INTU = null;
  function isIntu(f, fam) {
    if (fam === "indigo") { INTU = INTU || intuitionSet(); return !!INTU[f.name]; }
    return /intuition/i.test(f.notes || "");
  }
  function bestBait(f) {
    if (f.best) return f.best;
    var bites = f.bites || {}, bb = null, bv = 1e9;
    Object.keys(bites).forEach(function (k) {
      var v = bites[k], mn = Array.isArray(v) ? v[0] : parseFloat(String(v)) || 1e9;
      if (mn < bv) { bv = mn; bb = k; }
    });
    return bb;
  }
  function biteText(f) {
    var b = bestBait(f); if (!b) return "";
    var v = (f.bites || {})[b];
    if (v == null) return "";
    var r = Array.isArray(v) ? (v[0] + "–" + v[1] + "s") : (String(v) + "s");
    return b + " " + r;
  }
  function topTargets(stop, fam) {
    var all = (stop.normal || []).slice();
    var out = all.filter(function (f) { return isIntu(f, fam); });
    all.sort(function (a, b) { return (b.points || 0) - (a.points || 0); });
    all.slice(0, 4).forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); });
    return out;
  }

  /* ---------- live ticker ---------- */
  function tick() {
    var now = Date.now(), nx = nextMs();
    var q = function (sel, val) { Array.prototype.forEach.call(document.querySelectorAll(sel), function (e) { e.textContent = val; }); };
    q("[data-clock]", fmtLocal(new Date(now)));
    q("[data-next]", cd(nx));
    q("[data-nextroute]", indigoAt(nx).label);
    q("[data-nextruby]", rubyAt(nx).label);
    q("[data-nowdep]", fam => fam);
  }

  /* ---------- planner ----------
     Note on innerHTML below: this page is a local, offline tool. The only data
     it renders is window.OF_SITE from assets/data.js (this project's own JSON),
     and every interpolated value passes through esc() first. There is no user
     input, no network fetch and no third-party content, so this is not an XSS
     vector. */
  function el(tag, cls, html) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function stars(n) { return "★".repeat(n || 0); }
  function renderStop(stop, fam) {
    var c = el("div", "stopcard");
    var h = "<h4>" + esc(stop.name) + "</h4><div class='tod'>" + esc(stop.time || "") + "</div>";
    var tg = topTargets(stop, fam);
    if (tg.length) {
      h += "<div style='margin-top:8px'>";
      tg.forEach(function (f) {
        var tag = isIntu(f, fam) ? "<span class='tag intu'>INT</span> " : "";
        h += "<div class='tgt'><span>" + tag + esc(f.name) + " <span class='b'>" +
             esc(biteText(f)) + "</span></span><span class='count'>" + (f.points || "") + "</span></div>";
      });
      h += "</div>";
    }
    c.innerHTML = h;
    return c;
  }
  function renderVoyage(ms, fam, isNext) {
    var info = at(ms, fam);
    var card = el("div", "card voyage" + (isNext ? " next" : ""));
    var d = new Date(ms);
    card.innerHTML = "<div class='when'><span class='fam " + fam + "'>" + fam + "</span>" +
      "<span class='t'>" + esc(info.label) + "</span>" +
      "<span class='u'>" + esc(fmtLocal(d)) + " · " + esc(fmtUTC(d)) + "</span>" +
      (isNext ? "<span class='count' data-voycd>sails in " + cd(ms) + "</span>" : "") + "</div>";
    var row = el("div", "grid g3");
    row.style.marginTop = "10px";
    stopsFor(fam, info).forEach(function (s) { row.appendChild(renderStop(s, fam)); });
    card.appendChild(row);
    return card;
  }
  var planFam = "both", planN = 6;
  function renderPlanner() {
    var host = document.getElementById("planner"); if (!host) return;
    host.innerHTML = "";
    var first = vn(Date.now()) + 1, made = 0, i = 0;
    while (made < planN && i < Math.max(planN * 2, 12)) {
      var ms = (first + i) * TWO;
      var fams = planFam === "both" ? ["indigo", "ruby"] : [planFam];
      for (var k = 0; k < fams.length && made < planN; k++) {
        host.appendChild(renderVoyage(ms, fams[k], made === 0));
        made++;
      }
      i++;
    }
  }
  function initPlanner() {
    var chips = document.getElementById("planfam");
    if (chips) chips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-fam]"); if (!b) return;
      Array.prototype.forEach.call(chips.querySelectorAll("[data-fam]"), function (x) { x.classList.toggle("on", x === b); });
      planFam = b.getAttribute("data-fam"); renderPlanner();
    });
    var sel = document.getElementById("plann");
    if (sel) sel.addEventListener("change", function () { planN = parseInt(this.value, 10) || 6; renderPlanner(); });
    renderPlanner();
  }

  /* ---------- fish reference: tabs, search, availability ---------- */
  var fam = "indigo", av = "all";
  function applyFish() {
    var q = (document.getElementById("fishq") || {}).value || "";
    q = q.trim().toLowerCase();
    var total = 0, shown = 0;
    Array.prototype.forEach.call(document.querySelectorAll("details.rowblock"), function (d) {
      var dfam = d.getAttribute("data-fam");
      var famOK = fam === "all" || dfam === fam;
      var hits = 0;
      Array.prototype.forEach.call(d.querySelectorAll("tbody tr"), function (tr) {
        total++;
        var avOK = av === "all" || (tr.getAttribute("data-av") || "DSN").indexOf(av) >= 0;
        var txt = tr.textContent.toLowerCase();
        var sum = (d.querySelector("summary") || {}).textContent || "";
        var m = avOK && (!q || txt.indexOf(q) >= 0 || sum.toLowerCase().indexOf(q) >= 0);
        tr.classList.toggle("hide", !m);
        if (m) { hits++; shown++; }
      });
      d.classList.toggle("hide", !famOK || (hits === 0 && !!q));
      if (!famOK) shown += 0;
      if (q && hits) d.open = true;
    });
    var c = document.getElementById("fishcount");
    if (c) c.textContent = shown + " of " + total + " fish" + (q ? " matching “" + q + "”" : "");
  }
  function initFish() {
    var host = document.getElementById("fishtabs");
    if (host) host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      fam = b.getAttribute("data-tab");
      Array.prototype.forEach.call(host.querySelectorAll("[data-tab]"), function (x) { x.classList.toggle("on", x === b); });
      Array.prototype.forEach.call(document.querySelectorAll("section[data-fam-group]"), function (s) {
        s.classList.toggle("hide", fam !== "all" && s.getAttribute("data-fam-group") !== fam);
      });
      applyFish();
    });
    var chips = document.getElementById("availchips");
    if (chips) chips.addEventListener("click", function (e) {
      var b = e.target.closest("[data-av]"); if (!b) return;
      av = b.getAttribute("data-av");
      Array.prototype.forEach.call(chips.querySelectorAll("[data-av]"), function (x) { x.classList.toggle("on", x === b); });
      applyFish();
    });
    var q = document.getElementById("fishq");
    if (q) q.addEventListener("input", applyFish);
    var open = document.getElementById("openall"), close = document.getElementById("closeall");
    if (open) open.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("details.rowblock"), function (d) { if (!d.classList.contains("hide")) d.open = true; });
    });
    if (close) close.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("details.rowblock"), function (d) { d.open = false; });
    });
    applyFish();
  }

  /* ---------- pattern grids (schedules page) ---------- */
  function initPatterns() {
    var now = vn(Date.now());
    var grids = [["patindigo", S.indigoPattern, (S.indigoOffset || 0)], ["patruby", S.rubyPattern, 0]];
    grids.forEach(function (g) {
      var host = document.getElementById(g[0]); if (!host) return;
      var idx = ((now + g[2]) % (g[1] || [1]).length + (g[1] || [1]).length) % (g[1] || [1]).length;
      Array.prototype.forEach.call(host.querySelectorAll("span"), function (s, i) {
        s.classList.toggle("sun", i === idx);
      });
      var lab = document.getElementById(g[0] + "-now");
      if (lab) lab.textContent = (g[1] || [])[idx] || "";
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    tick(); setInterval(tick, 1000);
    initPlanner(); initFish(); initPatterns();
    setInterval(function () {
      var c = document.querySelector("[data-voycd]");
      if (c) c.textContent = "sails in " + cd(nextMs());
    }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.OF = { vn: vn, indigoAt: indigoAt, rubyAt: rubyAt, at: at, nextMs: nextMs, cd: cd,
                stopsFor: stopsFor, topTargets: topTargets, biteText: biteText, bestBait: bestBait,
                renderPlanner: renderPlanner, applyFish: applyFish };
})();
