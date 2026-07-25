# C.A.T. Personal Data Assistant

A task organiser and reminder PWA for iPhone, built as a working replica of the
PDA terminal from *Routine*. Menu, typography, striped panel and boot sequence
follow the in-game unit.

Two intentional departures: a display setting that lets the square 1:1 panel
fill the phone screen, and a pure white-on-black palette. The reference
screenshots show the unit projected onto an olive wall at one save station —
the panel itself is monochrome, which is also what an AMOLED phone wants.

---

## Getting it onto the phone

```bash
node tools/make-cert.js
```

```bash
node serve.js
```

The server prints a LAN address. Open it in Safari on the phone, accept the
self-signed certificate warning, then **Share → Add to Home Screen**.

HTTPS matters: service workers (and therefore offline use) only register in a
secure context, and `http://<lan-ip>` is not one. Plain HTTP still works for a
quick look — `serve.js` falls back to it automatically when `certs/` is absent —
you just don't get offline mode.

Once installed, launch it from the home-screen icon, not from Safari. The
viewport fix and the fullscreen canvas only apply in standalone mode.

## Boot sequence

| phase | duration | screen |
|---|---|---|
| 1 | 1.05 s | animated static, `WIRELESS ACCESS POINT` on a lit plate |
| 2 | 0.30 s | static falls away to the olive field |
| 3 | 1.20 s | `JOUST.` in the condensed display face, grey ghost split |
| 4 | 0.35 s | fade through to the menu — no static from here on |

Tap anywhere to skip. `HARDWARE → BOOT SEQUENCE` turns it off entirely, and
`REPLAY BOOT` runs it on demand.

The type is not a font file. A 5×7 bitmap face is defined as glyph data in the
source and rasterised to canvas at the current display scale, so it stays crisp
at any size and works with no network. The logo uses the same glyphs with cells
1.42× taller than wide, which is what gives it the heavy horizontal bars.

## The menu

Kept exactly as the unit ships it.

**TASKS** — the list, grouped OVERDUE / TODAY / UPCOMING / NO DATE, sortable by
due date, priority or entry order. Tasks carry notes, a due date and time,
priority, one tag, and a checklist of steps. Repeating tasks (daily, weekdays,
weekly, monthly) never "complete" — ticking one rolls its due date forward to
the next occurrence.

**DATABASE** — full-text search across every task and note, tag filters,
statistics, purge-completed, and bulk calendar export.

**MEDIA** — text notes, photo captures (rendered through the panel's palette),
and voice memos. Blobs live in IndexedDB alongside everything else.

**HARDWARE** — display aspect, backlight, scanlines, boot options, sound and
haptics, alerts, backup/restore, erase, and a diagnostics readout.

**SAVE DATA** — the footer panel is live: open tasks, count due, media files,
completed, and the timestamp of the last manual store. Pressing it writes a
full JSON backup. It appears on the menu screen only; elsewhere it was just
eating a sixth of the panel.

Below the four menu entries, any leftover bands are filled with a **priority
queue** — overdue first, then priority, then soonest — in the same pixel face,
each row tapping through to its task. The rows are real elements rather than a
repeating background, so the stripes stop where the content stops instead of
tiling empty white bars down the screen. In SQUARE mode there is no room for
them and the menu matches the in-game unit exactly.

## Display aspect

`HARDWARE → ASPECT` switches between:

- **SQUARE 1:1** — the in-game proportion, letterboxed on the dark surround.
- **FIT SCREEN** — the panel fills the phone.

The setting persists.

## Saving

Everything is written to IndexedDB the moment it changes; there is no save step
to forget. `navigator.storage.persist()` is requested on first run so iOS won't
evict the database under storage pressure (`HARDWARE → DIAGNOSTICS → PERSIST`
reports whether it was granted).

`EXPORT BACKUP` writes a single JSON file containing tasks, settings, and media
with blobs inlined as data URLs. `IMPORT BACKUP` merges by record id, so
restoring onto a unit that already has data adds rather than replaces, and
importing the same file twice changes nothing.

## About reminders on iOS

iOS freezes a web app's JavaScript as soon as it is backgrounded. No purely
local web app can wake itself to fire a notification — that needs a push server.

So there are two layers:

- **While the unit is open**, a watcher checks every 30 s and raises a tone,
  haptic, toast, and a Web Notification if you armed them under
  `HARDWARE → ALERTS`.
- **For alarms that fire with the app closed**, open a task and use
  `ADD TO CALENDAR`. That writes an `.ics` with a 10-minute `VALARM` and the
  right recurrence rule, and hands ownership of the reminder to iOS Calendar,
  which does have the OS-level permission to interrupt you.

`DATABASE → EXPORT ALL TO CALENDAR` does the same for every dated open task.

## Layout notes

The shell follows a specific architecture for iOS standalone mode, where the
layout viewport, `100dvh`, `innerHeight` and `visualViewport.height` can all
report ~93 pt short while the canvas is genuinely fullscreen:

- `html` has an explicit height and `overflow:hidden`
- `body` is `position:fixed; inset:0`, a flex column, with no height units
- `#main` is the only scroller; the document itself never scrolls
- the footer is a flex item at the end of the shell, never fixed or absolute
- a grow-only healer runs on a 1 s interval (resize events are unreliable in
  standalone) and targets `screen.width/height`, the only values iOS does not
  misreport
- `body.vfix` adds explicit home-indicator clearance, because the bottom safe
  area inset reports `0` in exactly that state

Don't replace any of it with `dvh` or `innerHeight` sizing.

One related trap: the home screen rebuilds when the panel resizes, and that
check keys on panel **height as well as `--u`**. `--u` derives from width, and
square → fit on a portrait phone changes only the height, so watching `--u`
alone silently misses it.

Pixel text stores a palette *key* (`ink`, `ink2`, `lite`, `mid`, `base`) in
`data-color`, not a hex value, so repaints follow the CSS variables. Change the
palette in `:root` and everything including the canvas type follows.

## After changing anything

Bump `APP_VER` in `index.html` **and** `CACHE` in `sw.js`. The phone will
otherwise keep serving the cached copy, and iOS resumes standalone webviews
without reloading them. The running version is shown at
`HARDWARE → DIAGNOSTICS → FIRMWARE`; check it there before assuming a fix
didn't work.

## Files

```
index.html            the whole app
sw.js                 network-first service worker
manifest.webmanifest
serve.js              LAN dev server, HTTPS when certs/ exists
tools/make-cert.js    self-signed cert for this machine's LAN IPs
tools/make-icons.js   regenerates icons from the app's own glyph table
icon-*.png
```

`window.__pda` exposes state and internals for debugging, including
`bootAt(ms)` which paints a single deterministic boot frame.
