# FFXIV Ocean Fishing — knowledge base

Working reference for a future project. Started 2026-10-05; schedules verified against live sources.
**Ruby content is post-7.5** (see the correction note below).

## What the activity is

- FSH-only group duty aboard **The Endeavor**, Limsa Lominsa Lower Decks; **every 2 hours**, 3 stops,
  ~25–30 min. Matchmade to 24, solo-friendly. Gathering/Perception ignored — **GP is the only stat**.
- Two route families: **Indigo** (Eorzea) and **Ruby** (Far East). Ruby ships from Kugane and needs
  "Stormblood"; the **Thavnairian coast** Ruby route also needs "Endwalker".
- Each stop is locked to a time of day (Day / Sunset / Night) that decides what bites.
- **Indigo** = 4 route types × 3 time-variants = 12; **Ruby** = 3 routes × 3 variants = 9.

## Mechanics cheat-sheet

- **Spectral Current** — instance-wide weather flip when anyone lands a "Spectral"/"Spectresaur" fish
  (higher chance on smaller boats). One per stop, 2 min (up to 3), always cut at 0:30 left. Fish bite
  faster, score more, exclusive fish appear.
- **Fisher's Intuition** — buff from catching a set of common fish at a stop; adds that stop's rare fish
  to the pool (uncatchable without it). Heartbeat SFX + fish-specific screen line + timed icon.
  60 s outside a current, 15 s (some 45 s) inside. On timeout a "departure" line shows — **unless the
  buff lapsed during a cast already locked to bite, then no line (= guaranteed bite)**.
- **Wildlife buffs** — Seagulls → Gullstorm (90s, +large fish); Dolphins → Cetaceous Speed (90s, +GP)
  and Auroral Flipper (120s, +Spectral proc, only before a current).
- Voyage **content bonuses** (mission completions, ★ count, party categories) multiply the whole run.

## Indigo schedule — VERIFIED

Voyages at odd hours JST = even hours UTC.
```
vn = unix_ms // 7_200_000
route = INDIGO[(88 + vn) % 144]        # 'BS' -> dest B, time S ; pattern in route-pattern.json
```
Destinations `B`=Bloodbrine Sea, `T`=Rothlyt Sound, `N`=Northern Strait of Merlthor, `R`=Rhotano Sea;
times `D`/`S`/`N`. 144-voyage (12-day) cycle; each 12-entry day-block is the previous rotated left by one.

## Ruby schedule — VERIFIED (post-7.5)

```
vn = unix_ms // 7_200_000
route = RUBY[vn % 144]                 # 144-voyage (12-day) cycle, 9 routes
```
There are **9 Ruby routes** (3 voyage paths × 3 time-variants), `ruby-schedule.json`:

| Route (community name) | Stops (in order, with time of day) |
|---|---|
| Shellfish/Shrimp | Sirensong Sea (Night) → Kugane (Day) → One River (Sunset) |
| Shrimp/Hells' Claw | Sirensong Sea (Night) → Kugane (Day) → Ruby Sea (Sunset) |
| Shellfish/Taniwha | Sirensong Sea (Day) → Kugane (Sunset) → One River (Night) |
| Squid/Taniwha | Sirensong Sea (Day) → Kugane (Sunset) → Ruby Sea (Night) |
| Squid/Glass Dragon | Sirensong Sea (Sunset) → Kugane (Night) → Ruby Sea (Day) |
| Glass Dragon & Jewel | Sirensong Sea (Sunset) → Kugane (Night) → One River (Day) |
| Mantis/Taniwha | **Unnamed Island (Night) → Sirensong Sea (Day) → Thavnair (Sunset)** |
| Mantis/Manasvin | **Unnamed Island (Day) → Sirensong Sea (Sunset) → Thavnair (Night)** |
| Prehistoric/Akupara | **Unnamed Island (Sunset) → Sirensong Sea (Night) → Thavnair (Day)** |

Verified by pulling every occurrence of all 9 routes from the tracker's time calculator and checking a
clean 317-voyage run reproduces the 144 pattern exactly. `scripts/route.py` matches the live schedule.

Destination labels: fieldcraft calls the three Ruby routes **One River**, **Ruby Price**, **Thavnairian
coast** (the last = Unnamed Island → Sirensong Sea → Thavnair).

## ⚠ Correction: the "pf-n.co" site is LEGACY (pre-7.5)

An earlier pass derived Ruby from **ffxiv.pf-n.co** and got a 6-route / 6-day model. That site's dataset
predates **Patch 7.5 (2026-04-28)**, which added the **Thavnairian coast** route — its `window.OceanFishingData`
contains none of the Unnamed Island / Thavnair fish and only 23 fishing spots. The current tracker is
**ffxiv.oceanfishing.boats** (the author's new site) and **ffxiv-fieldcraft.com**. Use those for anything
post-7.5. The 6-route model still correctly describes the One River + Ruby Price paths.

## Bite times

`bite-times.json` / `.csv` — per fish × bait min/max bite in seconds, best/usable flags (220 fish, 860
rows; the **legacy** dataset, so it lacks the 7.5 stops). The spreadsheet below covers the Ruby stops
including the 7.5 ones.

## The community spreadsheet (this project's richest source)

Tyo'to Tayuun's "Ocean Fishing Spreadsheet" (gid 1246028214) is organised as **9 Ruby route blocks**,
each with its stops and a fish table: per-bait bite times, Points Average, DH/TH yields, hooking bite
(tug), hookset, availability, stars, and **Notes** (achievement membership, intuition chains, mooch info).

- `spreadsheet-routes.json` — parsed, structured (9 routes → stops → fish).
- `spreadsheet-fish.csv` — flat table (442 rows across routes; 118 unique fish).

Notable Notes it carries: achievement membership ("Counts for Maximum Mussel / Squid Squadron / Shrimp
Smorgasbord / Prehistoric Professionals / Time Waits for No Mantis"); intuition chains with durations
(e.g. Manasvin: 3× Satrapsaurus (15 s); Akupara: 2× Cieldalaes Roosterfish (20 s)); mooch chains
(e.g. Akupara mooched from Cieldalaes Roosterfish; Tylosaurus from Captain's Pen / Cieldalaes Roosterfish).

## Files

| File | What |
|---|---|
| `website/` | **The website** — multi-page, themed (Ocean Blue & Sunshine). Open `website/index.html`. |
| `ocean-fishing-reference.html` | **Static reference** — schedules, every stop & fish (bite times, points, DH/TH, notes), bonuses, achievements; live search + family filter, printable. Self-contained. |
| `ocean-fishing-planner.html` | **Planner** — live countdown, upcoming voyages for both routes with each stop's time-of-day and top targets (best bait + points, intuition flagged). Self-contained. |
| `scripts/route.py` | Runnable calculator — Indigo + Ruby (9 routes) |
| `route-pattern.json` | Indigo 144-route pattern |
| `ruby-schedule.json` | Ruby 144-voyage pattern + the 9 route definitions |
| `spreadsheet-routes.json` / `spreadsheet-fish.csv` | Parsed community spreadsheet |
| `intuition-fish.json` | 22 legacy intuition fish (EN/JA, triggers, timers) |
| `bite-times.json` / `.csv` | 860 legacy fish×bait bite-time rows |
| `ocean-fishing-normalized.json` | Legacy baits/spots/bonuses/achievements (EN/JA) |
| `site-data/OceanFishingData.json` | Legacy (pre-7.5) site snapshot — **keep for Indigo** |
| `ruby-route-times.json` | Raw per-route occurrence times used to derive the Ruby pattern |
| `data/*.json` | 2023 GitHub snapshot |

## The website

`website/` is a six-page static site — no build step to view it, just open `website/index.html`.

| Page | What |
|---|---|
| `index.html` | Home — what the activity is, the buffs & log messages, points and content bonuses, and all 22 Indigo Intuition chains |
| `schedules.html` | Both 144-voyage patterns with the current position highlighted, plus every route's stops and times |
| `fish.html` | All 662 fish rows (Indigo 220 + Ruby 442) with bite times, availability, DH/TH, mooch and intuition notes; search, family tabs, time filters |
| `rewards.html` | All 54 content bonuses and 40 achievements |
| `planner.html` | Live planner — the next voyages for both families and what to catch at each stop |
| `notes.html` | Method, the bite-time definition, and the pre-7.5 / timezone traps |

Shared assets are `website/assets/{theme.css,site.js,data.js}`. The theme is Ocean Blue & Sunshine (deep ocean blues + sunshine gold).

Regenerate after any data change: `python scripts/gen_website.py`. Verify in a real browser with `scripts/cdp_eval.js <url> <js-file>` and screenshot with `scripts/cdp_shot.js <url> <out.png> [full]` (headless Chrome over CDP — the agent's browser tool cannot reach `file://` or `localhost`).

## Open items for the project

- Decide the tool shape (tracker / planner / guide).
- Optionally normalise double/triple-hook yields (present in both datasets, not unified).

Scope note: **private use only** — no localised (JP/DE/FR) names or shareable build needed, so the
7.5 stops are fully covered by the spreadsheet's EN names and bite times.
