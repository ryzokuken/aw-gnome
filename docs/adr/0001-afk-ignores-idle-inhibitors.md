# AFK state ignores idle inhibitors

AFK state is derived by polling idle time every few seconds rather than from Mutter's idle watches
(`org.gnome.Mutter.IdleMonitor.AddIdleWatch`). Mutter silences those watches while any
session-manager idle inhibitor is held, so with Caffeine, a video player, or a browser playing
media, the user never became `afk`. Idle time itself ignores inhibitors, and so does upstream
`aw-watcher-afk`, which measures input rather than whether the screen may blank. Polling works on
every supported GNOME release; Mutter 50's uninhibitable watches would have needed a second code
path for GNOME 45–49.

## Consequences

Watching a long video without touching the keyboard counts as `afk`, as it does upstream.
