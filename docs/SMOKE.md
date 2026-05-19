# Smoke Checklist

Run before tagging any release. Uses a nested shell so it doesn't disturb your live session.

## Setup

```bash
make install
aw-server-rust &
dbus-run-session -- gnome-shell --nested --wayland
```

In the nested shell:

```bash
gnome-extensions enable aw-gnome@ryzokuken.dev
```

## Checks

- [ ] Indicator appears in the top bar (filled circle icon).
- [ ] Focus three different apps in sequence. Visit `http://localhost:5600` → window bucket shows events for each app with correct titles.
- [ ] Click indicator → "Open Dashboard" launches the browser at `localhost:5600`.
- [ ] Click "Pause tracking". Icon changes to hollow circle. Switch focus to a new app. No new event appears in the dashboard.
- [ ] Click "Resume tracking". Icon returns to filled. New focus events appear.
- [ ] Leave the nested shell untouched for >3 minutes. AFK bucket shows an `afk` event. Move the mouse — a `not-afk` event follows.
- [ ] `gnome-extensions disable aw-gnome@ryzokuken.dev` followed by `journalctl --user -b 0 | grep aw-gnome` — no warnings about leaked handlers, no GJS errors.
- [ ] Re-enable. Focus a single app once. Only one event appears in the dashboard (would indicate a duplicate subscription otherwise).
