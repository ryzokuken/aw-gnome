# aw-gnome

Native GNOME indicator and watchers for [ActivityWatch](https://activitywatch.net/). Tracks focused window and AFK state on Wayland and posts heartbeats to `aw-server-rust`. A drop-in replacement for `aw-qt` + the X11-only `aw-watcher-window` for GNOME 45+ users.

## Status

v0.1 — minimum-viable daily driver. Window watcher, AFK watcher, indicator with pause toggle and dashboard launcher. Bring your own `aw-server-rust`.

See [`docs/superpowers/specs/2026-05-19-aw-gnome-design.md`](docs/superpowers/specs/2026-05-19-aw-gnome-design.md) for the design and [`docs/superpowers/plans/2026-05-19-aw-gnome-v0.1.md`](docs/superpowers/plans/2026-05-19-aw-gnome-v0.1.md) for the implementation plan.

## Requirements

- GNOME Shell 45 or newer (tested on 50.1)
- Wayland session (X11 untested, may work)
- [`aw-server-rust`](https://github.com/ActivityWatch/aw-server-rust) running on `localhost:5600`

## Install

```bash
git clone https://github.com/ryzokuken/aw-gnome.git
cd aw-gnome
make install
gnome-extensions enable aw-gnome@ryzokuken.dev
```

On Wayland, log out and back in for the extension to load. Open the dashboard via the indicator menu, or visit `http://localhost:5600`.

## Develop

```bash
make test               # unit tests (zero dependencies beyond gjs)
make test-integration   # round-trip test against aw-server-rust on port 5666
make install            # deploy to ~/.local/share/gnome-shell/extensions
```

For faster iteration than logging out, run a nested shell:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

See [`docs/SMOKE.md`](docs/SMOKE.md) for the manual release checklist.

## License

GPL-2.0-or-later
