# aw-gnome

A GNOME Shell extension that watches what the user is doing on the desktop and reports it to
ActivityWatch, using ActivityWatch's own vocabulary so existing dashboards work unchanged.

## Activity

**Idle time**:
How long it has been since the user last gave keyboard or pointer input, as the compositor counts
it. Idle inhibitors (e.g. Caffeine, video players) do not reset or pause it.
_Avoid_: inactivity, idle watch

**AFK state**:
Whether the user is away from the keyboard: `afk` once idle time reaches the AFK threshold,
`not-afk` otherwise.
_Avoid_: idle/active, away, presence

**AFK threshold**:
The idle time at which the user becomes `afk` (180 seconds, the upstream default).
_Avoid_: timeout

**Focused window**:
The window receiving keyboard input, described by its app id and title.
_Avoid_: active window, current window

## ActivityWatch

**Bucket**:
aw-server's store of events for one watcher on one host, named with upstream conventions
(`aw-watcher-window_<host>`, `aw-watcher-afk_<host>`).

**Heartbeat**:
An event sent to a bucket that aw-server merges into the latest event when the data matches and it
arrives within the pulsetime.
_Avoid_: ping, update

**Pulsetime**:
The longest gap between a bucket's latest event and a heartbeat that still lets them merge.
_Avoid_: merge window
