# aw-gnome — Design

**Status:** Approved for v0.1 implementation planning
**Date:** 2026-05-19
**Author:** Ujjwal Sharma (@ryzokuken)

## Summary

`aw-gnome` is a GNOME Shell extension that replaces `aw-qt` for users running modern GNOME on Wayland. It serves as both the indicator/control surface and the watcher process — focused-window tracking and AFK detection happen inside the extension itself, eliminating the Qt tray, the broken-on-Wayland xprop watcher, and the need for a separate watcher daemon. The extension talks to a separately-installed `aw-server-rust` over HTTP on `localhost:5600`.

The project optimizes for execution speed and iteration quality over feature breadth. v0.1 is the minimum useful daily-driver replacement; v0.2 absorbs server lifecycle management; later versions iterate on UX based on real usage.

## Goals

- **Cohesive GNOME-native experience.** One extension, one install, no orphaned daemons. Reference model: GSConnect.
- **Zero Qt, zero X11 assumptions.** Pure GJS, Wayland-first, GNOME 45+ only.
- **Standards-compliant.** Upstream-compatible bucket names and event schemas so existing `aw-server` dashboards work unchanged.
- **Iterable.** Tight, well-bounded modules so any single piece can be replaced without rewriting the rest.
- **Testable from day one.** Pure-logic units mockable in `gjs`; one integration test against real `aw-server`; documented manual smoke for releases.

## Non-goals

- Supporting GNOME < 45 or X11 sessions.
- Per-app denylists, rich settings UI, custom dashboards. Deferred until empirically needed.
- Bundling or auto-installing `aw-server-rust`. Users install it themselves; v0.2 manages its lifetime via systemd.
- Replacing the upstream `aw-webui`. The "Open Dashboard" action just opens `http://localhost:5600`.

## Architecture

```
┌─ gnome-shell process ─────────────────────────────────────┐
│                                                            │
│  ┌─ aw-gnome extension ──────────────────────────────────┐ │
│  │                                                       │ │
│  │   WindowWatcher ──┐                                   │ │
│  │   (Shell.Global   │                                   │ │
│  │    focus signals) ├──► HeartbeatClient ──HTTP──►──┐   │ │
│  │                   │   (Soup.Session)              │   │ │
│  │   AfkWatcher ─────┘                               │   │ │
│  │   (core idle monitor, polled)                     │   │ │
│  │                                                   │   │ │
│  │   Indicator (PanelMenu.Button)                    │   │ │
│  │     ├─ status dot                                 │   │ │
│  │     ├─ Pause/Resume toggle ──► GSettings ─────────┤   │ │
│  │     └─ Open Dashboard ──► xdg-open                │   │ │
│  └───────────────────────────────────────────────────┼───┘ │
└──────────────────────────────────────────────────────┼─────┘
                                                       │
                                  ┌────────────────────▼──┐
                                  │  aw-server-rust       │
                                  │  localhost:5600       │
                                  │  (separately running) │
                                  └───────────────────────┘
```

Everything runs inside the `gnome-shell` process. No subprocesses, no IPC with ourselves, no Python bridge. The only external dependency at runtime is `aw-server-rust` reachable over HTTP.

## Components

### `WindowWatcher`

Subscribes to `global.display::notify::focus-window` and `notify::title` on the currently-focused `Meta.Window`. On either signal, builds an event and forwards it to `HeartbeatClient`, then repeats that event every 5 seconds until the next change.

App-id resolution priority (first non-empty wins):
1. `meta_window.get_sandboxed_app_id()` (Flatpak apps)
2. `meta_window.get_gtk_application_id()`
3. `meta_window.get_wm_class()`
4. literal `"unknown"`

- **Bucket:** `aw-watcher-window_<hostname>`
- **Event type:** `currentwindow`
- **Pulsetime:** `7.5` seconds — `max(interval × 1.5, interval + 1)` for the 5s repeat, as upstream `aw-watcher-window` computes it, so timer drift doesn't split events
- **Event shape:** `{ timestamp, duration, data: { app, title } }`

When the focused window or its title changes, the watcher first sends the *previous* window's event stamped now, extending it to the moment of change, then opens the new event 1ms later. Without that, each event would end at its last repeat and lose up to 5 seconds per change.

### `AfkWatcher`

Every 5 seconds, reads idle time from `global.backend.get_core_idle_monitor().get_idletime()` and derives the AFK state against the 180s threshold. This mirrors upstream `aw-watcher-afk`:

- Heartbeats are stamped at the last input (`now - idle time`), not at the poll.
- On becoming AFK: close `not-afk` at the last input, then open `afk` 1ms later with `duration` = idle time, so the whole idle period counts as AFK.
- While AFK: repeat `afk` at the last input + 1ms with a growing `duration`.
- On returning: close `afk` at the last input, then open `not-afk` 1ms later.

Idle time ignores idle inhibitors (Caffeine, media playback); Mutter's D-Bus idle watches do not, which is why they aren't used. See [ADR 0001](../../adr/0001-afk-ignores-idle-inhibitors.md).

- **Bucket:** `aw-watcher-afk_<hostname>`
- **Event type:** `afkstatus`
- **Pulsetime:** `185` seconds — threshold + poll interval, because heartbeats can be stamped up to the threshold in the past
- **Threshold:** `180` seconds (upstream default)

### `HeartbeatClient`

Thin wrapper around `Soup.Session` (libsoup3). The single seam through which all aw-server traffic flows — keeping it small and well-defined is what makes v0.2 (server lifecycle) and future buffering work cheap to add.

Methods:
- `createBucket(bucketId, eventType, hostname)` — `POST /api/0/buckets/{id}`. Resolves on 2xx, and on 304, which aw-server returns when the bucket already exists.
- `heartbeat(bucketId, event, pulsetime)` — `POST /api/0/buckets/{id}/heartbeat?pulsetime=N` with `event = { timestamp, duration, data }`. Heartbeats are sent one at a time in call order: aw-server only merges a heartbeat into the latest event, so a close-then-open pair arriving reversed would split the timeline. On error: `console.error()` and drop. No retry, no buffer.

Request building and status handling are pure exported functions; the class itself is exercised by the integration test.

### `Indicator`

A `PanelMenu.Button` in the top bar.

- **Icon:** symbolic SVG; filled = recording, hollow = paused.
- **Menu:**
  - `Pause tracking` / `Resume tracking` (toggle, reflects `paused` GSetting)
  - separator
  - `Open Dashboard` → `Gio.AppInfo.launch_default_for_uri("http://localhost:5600", null)`

Pause state lives in GSettings (`org.gnome.shell.extensions.aw-gnome.paused`) so it survives shell restarts.

### `extension.js`

`Extension` subclass. `enable()` constructs the four components and wires the watchers' heartbeat callbacks to `heartbeatClient.heartbeat(...)`. `disable()` tears everything down: each watcher disconnects its signal handlers and removes its timer, the indicator is destroyed, and the HTTP session is aborted.

**Invariant:** after `disable()`, no signal handlers and no timers remain alive. Verified manually by reload-the-extension smoke testing.

## Data flow

**Window event:**
```
notify::focus-window or notify::title fires (or the 5s repeat)
  ├─ resolve app id, read title
  ├─ if changed: heartbeat { previous window, now }, then { new window, now + 1ms }
  │  else:      heartbeat { same window, now }
  ├─ if paused (GSettings) → drop
  └─► HeartbeatClient.heartbeat(window_bucket, event, 7.5)
```

**AFK event:**
```
every 5s: read idle time
  ├─ not-afk, idle ≥ 180s → heartbeat not-afk @ last input, afk @ last input + 1ms (duration = idle)
  ├─ afk, idle < 180s     → heartbeat afk @ last input, not-afk @ last input + 1ms
  ├─ afk                  → heartbeat afk @ last input + 1ms (duration = idle)
  ├─ not-afk              → heartbeat not-afk @ last input
  ├─ if paused (GSettings) → drop
  └─► HeartbeatClient.heartbeat(afk_bucket, event, 185)
```

**Pause:**
```
Indicator toggle → GSettings.set_boolean("paused", true)
  └─► extension.js reads the setting on every heartbeat
       and drops it while paused
```

Pause does not tear down subscriptions; it only gates the outbound call. Resume is instantaneous.

**Server unreachable:** logged to journal via `console.error`, event dropped. No buffering in v0.1 (see v0.2 for why this becomes a non-issue).

## Versioning roadmap

The design is explicitly iterative. Each milestone is independently usable; later milestones extend the v0.1 seams without restructuring.

### v0.1 — POC daily driver

- `WindowWatcher`, `AfkWatcher`, `HeartbeatClient`, minimal `Indicator` (status dot, pause toggle, open dashboard).
- BYO `aw-server-rust`.
- Manual install via `make install`.
- **Definition of done:** author uses it as primary tracking solution on their work machine for one full week without falling back to upstream watchers.

### v0.2 — Server lifecycle

- New `ServerManager` component wraps `systemctl --user {start,stop,status,is-active} aw-server.service` via `Gio.Subprocess`.
- Repo ships `data/systemd/aw-server.service` (`Restart=on-failure`); `make install` deploys it to `~/.config/systemd/user/`.
- Indicator gains: "Server: ● running" status line, "Restart server" action, tri-state status dot (recording / paused / server-down).
- Server URL becomes a GSettings key.
- **Definition of done:** `aw-server` is never started manually again. Indicator surfaces all relevant state.

### v0.3+ — UX iteration

Driven by what the author actually misses while using v0.2. Candidates, none promised:
- Pause-for-duration submenu (15 min / 1 hr / until resume).
- Per-app denylist with simple preferences window.
- "Currently tracking: Firefox" live line in the menu.
- Workspace metadata in window events.
- Optional in-memory replay buffer in `HeartbeatClient`.
- e.go submission.

The seams that make these cheap are already in v0.1: `HeartbeatClient` is the only outbound traffic, `GSettings` is already wired for runtime config, the indicator already owns all UI mutation.

## Testing strategy

Designed for the iterative workflow: every change in any milestone should be verifiable in under a minute without launching a full GNOME session.

### Layer 1 — Unit tests (`tests/unit/`)

Pure-logic helpers tested with plain `gjs` and a minimal runner (`tests/run.js`). Run via `make test`. Target: <1s wall time. Runs in CI.

- `heartbeatClient.test.js` — URL construction, request payload shape, bucket-creation status handling, pulsetime formula.
- `windowWatcher.test.js` — app-id resolution priority (`Meta.Window` passed as plain JS stubs); heartbeats on focus and title changes.
- `afkWatcher.test.js` — AFK transitions and backdated heartbeats for a given idle time, including the threshold boundary.

Design rule: any module that needs `gnome-shell`-only globals to test is too coupled and should be refactored. This is the forcing function that keeps boundaries clean.

### Layer 2 — Integration test (`tests/integration/`)

One end-to-end test, run on demand (`make test-integration`), not in CI:

- Spawns `aw-server-rust --testing` (isolated dataset, port 5666).
- Waits for `/api/0/info` to respond.
- Drives `HeartbeatClient` against the real server: create a bucket twice (the second answers 304), send heartbeats, fetch events back, assert structure.
- Sends back-to-back close-then-open heartbeat pairs and asserts they merge into the expected events, which fails if requests arrive out of order.

Catches version-skew between our HTTP usage and `aw-server`'s actual API.

### Layer 3 — Manual smoke (`docs/SMOKE.md`)

One-page checklist. Run before tagging any release.

- `dbus-run-session -- gnome-shell --devkit --wayland` (GNOME 49+; `--nested` before) with the extension installed.
- Indicator appears, status dot recording.
- Focus three different apps; events visible in `localhost:5666` dashboard.
- Idle 3+ min, including with an idle inhibitor held; AFK event appears.
- Suspend and resume; AFK bucket shows no bogus events.
- Pause → focus changes produce no events → resume → events resume.
- Disable extension → clean log (no GJS warnings, no orphaned signals via `dbus-monitor`).
- Re-enable → no double subscriptions.

### Lint

`eslint` with the GNOME Shell extension config. Catches GJS-specific footguns (signal leaks, missing `await`, broken imports). Runs in CI.

## Repo layout

```
aw-gnome/
├── extension.js
├── metadata.json
├── lib/
│   ├── windowWatcher.js
│   ├── afkWatcher.js
│   ├── heartbeatClient.js
│   └── indicator.js
├── schemas/
│   └── org.gnome.shell.extensions.aw-gnome.gschema.xml
├── icons/
│   ├── aw-gnome-recording-symbolic.svg
│   └── aw-gnome-paused-symbolic.svg
├── tests/
│   ├── unit/
│   └── integration/
├── data/
│   └── systemd/aw-server.service     # added in v0.2
├── docs/
│   ├── SMOKE.md
│   └── superpowers/specs/
├── Makefile
├── LICENSE                            # GPL-2.0-or-later
└── README.md
```

## Decisions reference

| Topic | Decision |
|---|---|
| Extension/watcher split | Fused — extension is the watcher (no separate daemon, no self-IPC) |
| v0.1 scope | Window + AFK in extension, BYO `aw-server` |
| v0.2 scope | Add server lifecycle via systemd user unit |
| Indicator v0.1 | Status dot, pause toggle, open dashboard |
| GNOME version target | 45+ only, ES modules |
| Pause / server-down | Drop on the floor; no buffering |
| Server lifecycle approach | `systemctl --user` via `Gio.Subprocess` |
| License | GPL-2.0-or-later |
| Extension UUID | `aw-gnome@ryzokuken.dev` |
| Hostname source | `GLib.get_host_name()` |
| AFK threshold / pulsetime | 180s / 185s (upstream defaults) |
| AFK detection | Poll idle time every 5s; ignores idle inhibitors ([ADR 0001](../../adr/0001-afk-ignores-idle-inhibitors.md)) |
| Window pulsetime | 7.5s (upstream formula for a 5s repeat) |
| Build | Makefile + `gnome-extensions pack` + `glib-compile-schemas` |
| Distribution | `make install` for v0.1/v0.2; e.go submission deferred |
| CI | GitHub Actions: eslint + unit tests on push |
