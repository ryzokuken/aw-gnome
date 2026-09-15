# aw-gnome

GNOME Shell extension (GJS, ES modules, GNOME 45+) that tracks the focused window and AFK state and
posts heartbeats to a separately running `aw-server-rust`. Design: `docs/superpowers/specs/`.

## Development

| task | command |
|------|---------|
| install lint deps | `pnpm install` |
| lint | `pnpm lint` |
| unit tests | `make test` (plain `gjs`, no Node) |
| integration test | `make test-integration` (needs `aw-server-rust` on `$PATH`) |
| all hooks | `prek run --all-files` |
| deploy locally | `make install`, then reload via nested shell or re-login |

Nested shell for manual checks: `dbus-run-session -- gnome-shell --devkit --wayland` (GNOME 49+;
older releases use `--nested`). Release checklist: `docs/SMOKE.md`.

## Conventions

- **Pure vs wiring.** Each `lib/` module exports pure helpers (unit-tested) plus a class that touches
  GNOME APIs (verified only by smoke test). Keep new logic in the pure half so it can be tested.
- **Relative imports are required.** GNOME Shell loads extensions from their install directory, so
  `./lib/...` imports are the only option; the global absolute-imports rule does not apply here.
- **Lint config is GNOME's.** `eslint-config-gnome` is pinned by git SHA (it is not on npm), with
  `eslint-plugin-jsdoc` overridden in `pnpm-workspace.yaml` for eslint 10 support.
- **Disable must leave nothing behind.** Every signal handler, GLib source, and D-Bus watch created
  in `enable()` is released in `disable()`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `ryzokuken/aw-gnome`, managed via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
