#!/usr/bin/env python3
"""Generate the Ocean Fishing website (static, offline) into website/."""
import json, html, os, re

P = "D:/ocean-fishing"; W = P + "/website"
S = json.loads(open(W + "/assets/data.js", encoding="utf-8").read()[len("window.OF_SITE = "):].rstrip().rstrip(";"))
E = lambda s: html.escape(str(s if s is not None else ""), quote=True)

NAV = [("index.html", "Home"), ("schedules.html", "Schedule"), ("fish.html", "Fish"),
       ("rewards.html", "Rewards"), ("planner.html", "Planner"), ("notes.html", "Notes")]

def page(slug, title, body, blurb=""):
    nav = "".join(f'<a href="{h}"{" class=\'on\'" if h == slug else ""}>{t}</a>' for h, t in NAV)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title) + " · Ocean Fishing" if title != "Ocean Fishing" else "Ocean Fishing"}</title>
<meta name="description" content="{E(blurb or title)}">
<link rel="stylesheet" href="assets/theme.css">
</head>
<body>
<header class="top"><div class="bar">
  <a class="brand" href="index.html"><span class="mark"></span><span>Ocean Fishing<small>FFXIV reference</small></span></a>
  <nav class="main">{nav}</nav>
  <span class="live"><span class="dot"></span><span data-clock>—</span></span>
</div></header>
<div class="wrap">
{body}
</div>
<footer><div class="bar">
  <span>Ocean Fishing reference &amp; planner — private use. Schedule verified against the live tracker; fish data from the community spreadsheet.</span>
  <span style="margin-left:auto">Next voyage in <b data-next>—</b></span>
</div></footer>
<script src="assets/data.js"></script>
<script src="assets/site.js"></script>
</body>
</html>
"""

def stars(n):
    n = int(n or 0)
    return f'<span class="stars" title="{n} star{"s" if n != 1 else ""}">{"★" * n}</span>' if n else "—"

def tug(n):
    try: n = int(n)
    except Exception: return ""
    return "❗" * n if n else "—"

def rng(v):
    if isinstance(v, list) and len(v) == 2:
        return f"{v[0]}–{v[1]}"
    if isinstance(v, str):
        return v.replace(" - ", "–")
    return str(v)

def dhtext(v):
    if isinstance(v, list) and len(v) == 2:
        return f"{v[0]}" if v[0] == v[1] else f"{v[0]}–{v[1]}"
    return "—" if v is None else str(v)

def avail_html(times, note=""):
    t = set(times or ["D", "S", "N"])
    out = []
    for k, emo, lbl in (("D", "☀️", "Day"), ("S", "🌅", "Sunset"), ("N", "🌙", "Night")):
        out.append(f'<span class="{"off" if k not in t else ""}" title="{lbl}: {"yes" if k in t else "no"}">{emo}</span>')
    return f'<span class="av">{"" .join(out)}</span>'

def tbl(head, rows):
    h = "".join(f"<th>{x}</th>" for x in head)
    return f'<div class="tblwrap"><table><thead><tr>{h}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'

# ---------------------------------------------------------------- fish tables
IND_HEAD = ["Fish", "★", "Pts", "Tug", "Hookset", "Bait (bite seconds)", "Avail", "DH / TH", "Notes"]

def indigo_row(f):
    bites = f.get("bites") or []
    best = next((b for b in bites if b.get("best")), None)
    btxt = f'<span class="best">{E(best["bait"])}</span> {best["min"]}–{best["max"]}s' if best else "—"
    others = " · ".join(f'{E(b["bait"])} {b["min"]}–{b["max"]}s' for b in bites if not b.get("best")) or "—"
    tags = []
    if f.get("intuition"): tags.append('<span class="tag intu">INT</span>')
    if f.get("moochOnly"): tags.append('<span class="tag">mooch only</span>')
    elif f.get("mooched"): tags.append('<span class="tag">mooched</span>')
    if f.get("bonus"): tags.append(f'<span class="tag bonus">+{f["bonus"]["pct"]}%</span>')
    notes = []
    if f.get("intuition"):
        trig = ", ".join(f'{t["count"]}× {E(t["name"])}' for t in (f.get("intuitionFish") or []))
        notes.append(f'<b>Intuition</b> — {trig} ({f.get("intuitionDuration")}s)')
    if f.get("moochable"): notes.append("Moochable")
    if f.get("moochFrom"): notes.append("Mooched from " + ", ".join(E(x) for x in f["moochFrom"]))
    if f.get("bonus"): notes.append(f'{E(f["bonus"]["name"])}: {E(f["bonus"]["req"])}')
    if f.get("desc"): notes.append(f'<div class="desc" title="{E(f["desc"])}">{E(f["desc"])}</div>')
    return ("<tr data-av=\"" + "".join(t for t in ("D", "S", "N") if t in set(f.get("time") or ["D", "S", "N"])) + "\">"
            f'<td><b>{E(f["name"])}</b> {" ".join(tags)}</td>'
            f'<td>{stars(f.get("stars"))}</td>'
            f'<td class="num">{E(f.get("points"))}</td>'
            f'<td class="num">{tug(f.get("tug"))}</td>'
            f'<td>{E(f.get("hookset"))}</td>'
            f'<td class="bait">{btxt}<div class="small muted">{others}</div></td>'
            f'<td>{avail_html(f.get("time"))}</td>'
            f'<td class="num">{dhtext(f.get("dh"))} / {dhtext(f.get("th"))}</td>'
            f'<td class="notes">{"<br>".join(notes) or ""}</td></tr>')

def num(v):
    """First number in a bite string ('Mooch only, 6' -> 6.0); 999 when absent."""
    m = re.search(r"\d+(?:\.\d+)?", str(v))
    return float(m.group()) if m else 999.0

def ruby_row(f):
    bites = f.get("bites") or {}
    best = None
    for k, v in bites.items():
        mn = num(v)
        if best is None or mn < best[1]: best = (k, mn)
    btxt = f'<span class="best">{E(best[0])}</span> {E(bites[best[0]]).replace(" - ", "–")}s' if best else "—"
    others = " · ".join(f'{E(k)} {E(v).replace(" - ", "–")}s' for k, v in bites.items() if best and k != best[0]) or "—"
    notes = [E(f.get("notes"))] if f.get("notes") else []
    return ("<tr data-av=\"" + "".join(t for t in ("D", "S", "N") if (f.get("avail") or {}).get(t)) + "\">"
            f'<td><b>{E(f["name"])}</b>{" <span class=\'tag intu\'>INT</span>" if "intuition" in str(f.get("notes", "")).lower() else ""}</td>'
            f'<td>{stars(f.get("stars"))}</td>'
            f'<td class="num">{E(f.get("points"))}</td>'
            f'<td class="num">{tug(f.get("tug"))}</td>'
            f'<td>{E(f.get("hookset"))}</td>'
            f'<td class="bait">{btxt}<div class="small muted">{others}</div></td>'
            f'<td>{avail_html([t for t in ("D", "S", "N") if (f.get("avail") or {}).get(t)])}</td>'
            f'<td class="num">{E(f.get("dh"))} / {E(f.get("th"))}</td>'
            f'<td class="notes">{"<br>".join(notes)}</td></tr>')

# ---------------------------------------------------------------- index
def build_index():
    m = S["mechanics"]
    facts = "".join(f'<div class="fact"><span>{E(f["k"])}</span><b>{E(f["v"])}</b></div>' for f in S["facts"])
    tone = {"spectral": "spectral", "sun": "sun", "sky": "sky", "muted": "muted2"}
    msgs = "".join(
        f'<div class="msg {tone.get(x.get("tone"), "")}"><h3>{E(x["name"])}</h3><ul>' +
        "".join(f"<li>{ln}</li>" for ln in x["lines"]) + "</ul></div>" for x in m["messages"])
    intu = S["indigo"]["intuition"]
    intu_rows = "".join(
        "<tr><td><b>" + E(i["fish"]) + "</b></td><td>" + E(i["water"]) + '</td><td class="notes">' +
        ", ".join(f'{t["count"]}× ' + E(t["name"]) for t in i["triggers"]) +
        '</td><td class="num">' + str(i["dur"]) + "s</td></tr>" for i in intu)
    return page("index.html", "Ocean Fishing", f"""
<section class="hero">
  <h1>Ocean Fishing</h1>
  <p>{m["voyage"]}</p>
  <div class="kpis">
    <div class="kpi live-kpi"><b data-nextroute>—</b><span>Next Indigo voyage</span></div>
    <div class="kpi live-kpi"><b data-nextruby>—</b><span>Next Ruby voyage</span></div>
    <div class="kpi live-kpi"><b data-next>—</b><span>Until departure</span></div>
    <div class="kpi"><b>3 stops</b><span>Day · Sunset · Night</span></div>
  </div>
</section>

<h2>At a glance</h2>
<div class="grid g4">{facts}</div>

<h2>The messages you will see</h2>
<p class="muted">Ocean Fishing talks to you constantly — every buff and line has a meaning. These are the ones that matter.</p>
<div class="grid g2">{msgs}</div>

<h2>Points &amp; content bonuses</h2>
<div class="card"><p>{m["points"]}</p>
<p class="small muted">Full list on the <a href="rewards.html">Rewards</a> page — {len(S["bonuses"])} content bonuses and {len(S["achievements"])} achievements.</p></div>

<h2>Fisher's Intuition — every chain</h2>
<p class="muted">Catch the listed common fish at that stop and the rare fish joins the pool for <b>{S["indigo"]["intuition"][0]["dur"] if intu else 60}&nbsp;s</b> or so. Indigo chains:</p>
{tbl(["Rare fish", "Where", "Trigger", "Window"], intu_rows)}

<h2>Where to go next</h2>
<div class="grid g3">
  <a class="fact" href="schedules.html" style="text-decoration:none"><span>Schedule</span><b>Both route families, hour by hour</b></a>
  <a class="fact" href="fish.html" style="text-decoration:none"><span>Fish</span><b>Every stop, every fish, bite times</b></a>
  <a class="fact" href="planner.html" style="text-decoration:none"><span>Planner</span><b>What is up next and what to catch</b></a>
</div>
""", "Everything about FFXIV Ocean Fishing: mechanics, schedules, fish and rewards.")

# ---------------------------------------------------------------- schedules
def build_schedules():
    ir = "".join(
        "<tr><td><b>" + E(r["code"]) + "</b></td><td>" + E(r["dest"]) + "</td><td>" + E(r["time"]) +
        '</td><td class="notes">' +
        " → ".join(E(s["name"]) + " <span class=muted>(" + E(s["time"]) + ")</span>" for s in r["stops"]) +
        "</td></tr>" for r in S["indigoRoutes"])
    rb = "".join(
        f'<tr><td><b>{E(r["name"])}</b></td><td class="notes">{" → ".join(f"{E(n)} <span class=muted>({E(t)})</span>" for n, t in (r["meta"] or []))}</td>'
        f'<td class="notes">{E(r.get("stops_desc") or "")}</td></tr>' for r in S["ruby"])
    ipat = "".join(f'<span data-i="{i}">{E(c)}</span>' for i, c in enumerate(S["indigoPattern"]))
    rpat = "".join(f'<span data-i="{i}">{E(c)}</span>' for i, c in enumerate(S["rubyPattern"]))
    return page("schedules.html", "Schedule", f"""
<h1>The schedule</h1>
<p class="muted">Voyages depart <b>every 2 hours, on odd hours JST</b> — which is <b>even hours UTC</b>. Both families follow a deterministic <b>144-voyage (12-day)</b> cycle, so they can be computed exactly rather than guessed.</p>

<h2>Indigo — Eorzea</h2>
<div class="card">
<p><code>vn = unix_ms // 7_200_000</code><br><code>route = INDIGO[(88 + vn) % 144]</code></p>
<p class="small muted">Destinations <b>B</b> Bloodbrine Sea · <b>T</b> Rothlyt Sound · <b>N</b> Northern Strait of Merlthor · <b>R</b> Rhotano Sea; times <b>D</b>/<b>S</b>/<b>N</b>. Each 12-entry day-block is the previous block rotated left by one.</p>
</div>
{tbl(["Code", "Destination", "Arrives", "Stops (with their time of day)"], ir)}
<h3>144-voyage pattern</h3>
<p class="small muted">Highlighted cell is the route running now: <b id="patindigo-now">—</b></p>
<div class="pat" id="patindigo">{ipat}</div>

<h2>Ruby — Far East</h2>
<div class="card">
<p><code>vn = unix_ms // 7_200_000</code><br><code>route = RUBY[vn % 144]</code></p>
<p class="small muted">Nine routes = 3 voyage paths × 3 time-variants. The three paths are <b>One River</b>, <b>Ruby Price</b> and <b>Thavnairian coast</b>. Ships from Kugane (needs <i>Stormblood</i>); the Thavnairian coast also needs <i>Endwalker</i>.</p>
</div>
{tbl(["Route", "Stops (time of day)", "Also known as"], rb)}
<h3>144-voyage pattern</h3>
<p class="small muted">Highlighted cell is the route running now: <b id="patruby-now">—</b></p>
<div class="pat" id="patruby">{rpat}</div>

<div class="notice" style="margin-top:22px"><b>Verified.</b> Every occurrence of all 9 Ruby routes was pulled from the tracker's own time calculator and a clean 317-voyage run reproduces the 144-entry pattern exactly; the Indigo pattern was checked against the live schedule. <code>scripts/route.py</code> in the project reproduces both.</div>
""", "Ocean Fishing departure schedule for both route families.")

# ---------------------------------------------------------------- fish
def build_fish():
    iblocks = []
    for wi, w in enumerate(S["indigo"]["waters"]):
        nrm = "".join(indigo_row(f) for f in w["normal"])
        spe = "".join(indigo_row(f) for f in w["spectral"])
        iblocks.append(f"""<details class="rowblock" data-fam="indigo"{" open" if wi == 0 else ""}><summary>{E(w["water"])}
          <span class="muted small">{len(w["normal"])} normal · {len(w["spectral"])} spectral</span></summary>
          <div class="dbody">
            <div class="sub">Normal</div>{tbl(IND_HEAD, nrm)}
            <div class="sub">Spectral Current</div>{tbl(IND_HEAD, spe)}
          </div></details>""")
    rblocks = []
    for ri, r in enumerate(S["ruby"]):
        body = []
        for st in r["stops"]:
            body.append(f'<div class="sub">{E(st["name"])}{" <span class=\'tag spec\'>spectral</span>" if st.get("spectral") else ""}</div>')
            body.append(tbl(IND_HEAD, "".join(ruby_row(f) for f in st["fish"])))
        rblocks.append(f"""<details class="rowblock" data-fam="ruby"{" open" if ri == 0 else ""}><summary>{E(r["name"])}
          <span class="muted small">{E(r.get("stops_desc") or "")}</span></summary>
          <div class="dbody">{''.join(body)}</div></details>""")
    return page("fish.html", "Fish", f"""
<h1>Fish reference</h1>
<p class="muted">Every stop of both route families with every fish: points, tug, hookset, bite times per bait (best bait underlined), day/sunset/night availability, double- and triple-hook yields, and the sheet's notes — achievements, intuition chains and mooch routes.</p>

<div class="controls no-print">
  <span class="chips" id="fishtabs">
    <button class="chip on" data-tab="indigo">Indigo</button>
    <button class="chip" data-tab="ruby">Ruby</button>
    <button class="chip" data-tab="all">Both</button>
  </span>
  <input class="search" id="fishq" type="search" placeholder="Search a fish, bait or note…">
  <span class="chips" id="availchips">
    <button class="chip on" data-av="all">Any time</button>
    <button class="chip" data-av="D">☀️ Day</button>
    <button class="chip" data-av="S">🌅 Sunset</button>
    <button class="chip" data-av="N">🌙 Night</button>
  </span>
  <button class="btn ghost" id="openall">Expand all</button>
  <button class="btn ghost" id="closeall">Collapse all</button>
  <span class="small muted" id="fishcount"></span>
</div>

<p class="small muted"><b>Tug</b> ❗ = how hard it bites (hook prompt). <b>Best bait</b> is underlined. <b>DH / TH</b> = yields under Double/Triple Hook. <b>Avail</b> ☀️🌅🌙 = allowed times, greyed means no.</p>

<h2>Indigo — stops &amp; fish</h2>
<section data-fam-group="indigo">{''.join(iblocks)}</section>

<h2>Ruby — stops &amp; fish</h2>
<section data-fam-group="ruby">{''.join(rblocks)}</section>
""", "Every Ocean Fishing stop and fish with bite times.")

# ---------------------------------------------------------------- rewards
def build_rewards():
    bon = "".join(f'<tr><td class="num"><b>{E(b.get("bonus"))}%</b></td><td><b>{E(b.get("en"))}</b></td>'
                  f'<td class="notes">{E(b.get("req_en"))}</td></tr>' for b in S["bonuses"])
    ach = "".join(f'<tr><td><b>{E(a.get("en"))}</b></td><td class="notes">{E(a.get("reward") or "—")}</td></tr>'
                  for a in S["achievements"])
    return page("rewards.html", "Rewards", f"""
<h1>Rewards &amp; bonuses</h1>
<p class="muted">Your catch points are multiplied by the voyage's content bonuses — objectives completed by the boat as a whole, the star rating of those objectives, and whether a party of three or more is aboard.</p>
<div class="card"><p><b>The rules:</b> 105 % / 110 % / 120 % for completing 1 / 2 / 3 mission objectives · <b>150 %</b> when a party of 3+ clears all ★★★★★ objectives · <b>+130 %</b> for the shark / octopus / fugu / crab category goals.</p></div>

<h2>Content bonuses <span class="pill sun">{len(S["bonuses"])}</span></h2>
{tbl(["Bonus", "Objective", "Requirement"], bon)}

<h2>Achievements <span class="pill sun">{len(S["achievements"])}</span></h2>
{tbl(["Achievement", "Reward"], ach)}
""", "Ocean Fishing content bonuses and achievements.")

# ---------------------------------------------------------------- planner
def build_planner():
    return page("planner.html", "Planner", f"""
<h1>Planner</h1>
<p class="muted">The next voyages for both families, with each stop's time of day and the targets worth fishing for. Everything updates live from the same schedule the game uses.</p>

<div class="controls no-print">
  <span class="chips" id="planfam">
    <button class="chip on" data-fam="both">Both</button>
    <button class="chip" data-fam="indigo">Indigo</button>
    <button class="chip" data-fam="ruby">Ruby</button>
  </span>
  <label class="small muted">show
    <select id="plann">
      <option>3</option><option selected>6</option><option>9</option><option>15</option>
    </select> voyages</label>
</div>

<div id="planner"></div>

<div class="notice sea" style="margin-top:24px"><b>Reading a card:</b> the badge on the left is the route family, the big text is the route, then its local and UTC departure time. Each stop shows the time of day you will fish it and its best targets — <span class="tag intu">INT</span> marks a Fisher's Intuition fish, and the number on the right is its points.</div>
""", "Live Ocean Fishing planner: next voyages and what to catch.")

# ---------------------------------------------------------------- notes
def build_notes():
    return page("notes.html", "Notes", f"""
<h1>Notes &amp; method</h1>
<p class="muted">How this reference was built, what is verified, and the traps to avoid.</p>

<h2>Schedule</h2>
<div class="card">
<p>Voyages leave every 2 hours on odd JST hours = even UTC hours, and the destination/time sequence is fully deterministic, so the route can be computed from a Unix timestamp:</p>
<p><code>vn = floor(unix_ms / 7200000)</code><br>
<code>Indigo: INDIGO[(88 + vn) % 144]</code><br>
<code>Ruby:   RUBY[vn % 144]</code></p>
<p class="small muted">Both cycles are 144 voyages = 12 days. Indigo's day-blocks rotate one left each day; Ruby is a flat 144-entry table of 9 routes.</p>
</div>

<h2>Bite times</h2>
<div class="card">
<p>Bite times are the <b>whiskers of a boxplot</b> over Teamcraft's sample data: compute quartiles with R's <b>type-7</b> quantile algorithm, then discard samples more than <b>1.5 × IQR</b> from the median. That makes them a stable “normal range”, not a hard limit — player-tested timings can be tighter.</p>
<p class="small muted">Ranges are per fish <i>per bait</i>; the underlined bait is the sheet's recommended pick (usually the fish's desynthesis bait, preferring ocean-fishing baits unless the goal is Fisher's Intuition).</p>
</div>

<h2>Availability</h2>
<div class="card"><p>☀️🌅🌙 mark the times of day a fish can be caught. Indigo stops are labelled by time; on Ruby the time varies by route, so the availability column tells you what still bites when a stop lands on a different hour.</p></div>

<h2>Traps &amp; corrections</h2>
<div class="notice"><b>Timezone.</b> The tracker's own example schedule renders in the <i>viewer's</i> timezone. Always compute from UTC milliseconds — never hard-code a local time.</div>
<div class="notice" style="margin-top:10px"><b>Pre-7.5 data is a trap.</b> The older community site predates Patch 7.5 (2026-04-28), which added the <b>Thavnairian coast</b> Ruby route. Its dataset has 23 fishing spots and none of the Unnamed Island / Thavnair fish. Its 6-route Ruby model still describes the One River and Ruby Price paths correctly, but it is incomplete: Ruby is <b>9 routes</b>.</div>
<div class="notice sea" style="margin-top:10px"><b>Point values vs. real score.</b> “Points” here are the base per-fish value; your voyage total is those points multiplied by the content bonuses on the <a href="rewards.html">Rewards</a> page.</div>

<h2>What is in this site</h2>
<div class="card"><ul>
<li><b>{sum(len(w["normal"]) + len(w["spectral"]) for w in S["indigo"]["waters"])} Indigo fish</b> across 11 waters, each with a normal and a Spectral Current list.</li>
<li><b>{sum(len(s["fish"]) for r in S["ruby"] for s in r["stops"])} Ruby fish rows</b> across all 9 routes and their stops.</li>
<li><b>{len(S["indigo"]["intuition"])} Indigo Intuition chains</b> with trigger fish and window length.</li>
<li><b>{len(S["bonuses"])} content bonuses</b> and <b>{len(S["achievements"])} achievements</b>.</li>
<li>Both 144-voyage patterns, the route tables, and the live planner.</li>
</ul>
<p class="small muted">Scope: built for private use — English names only, no localised strings.</p></div>
""", "Method, verification and pitfalls behind this Ocean Fishing reference.")

PAGES = {"index.html": build_index, "schedules.html": build_schedules, "fish.html": build_fish,
         "rewards.html": build_rewards, "planner.html": build_planner, "notes.html": build_notes}
for name, fn in PAGES.items():
    open(W + "/" + name, "w", encoding="utf-8").write(fn())
    print(f"  {name:18s} {os.path.getsize(W + '/' + name) / 1024:8.0f} KB")
print("done")
