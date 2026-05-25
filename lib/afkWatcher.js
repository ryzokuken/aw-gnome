import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const IDLE_THRESHOLD_MS = 180000;
const HEARTBEAT_INTERVAL_S = 5;

const IdleMonitorIface = `
<node>
  <interface name="org.gnome.Mutter.IdleMonitor">
    <method name="GetIdletime"><arg type="t" direction="out"/></method>
    <method name="AddIdleWatch">
      <arg type="t" direction="in"/>
      <arg type="u" direction="out"/>
    </method>
    <method name="AddUserActiveWatch">
      <arg type="u" direction="out"/>
    </method>
    <method name="RemoveWatch"><arg type="u" direction="in"/></method>
    <signal name="WatchFired"><arg type="u"/></signal>
  </interface>
</node>`;

const IdleMonitorProxy = Gio.DBusProxy.makeProxyWrapper(IdleMonitorIface);

export class AfkWatcher {
    constructor({ onStateChange }) {
        this._onStateChange = onStateChange;
        this._state = 'not-afk';
        this._proxy = null;
        this._idleWatchId = 0;
        this._activeWatchId = 0;
        this._signalId = 0;
        this._timerId = 0;
    }

    enable() {
        this._disabled = false;
        IdleMonitorProxy(
            Gio.DBus.session,
            'org.gnome.Mutter.IdleMonitor',
            '/org/gnome/Mutter/IdleMonitor/Core',
            (proxy, error) => {
                if (this._disabled) return;
                if (error) {
                    console.error(`aw-gnome: IdleMonitor proxy failed: ${error.message}`);
                    return;
                }
                this._proxy = proxy;
                this._signalId = this._proxy.connectSignal(
                    'WatchFired',
                    (_p, _s, [id]) => this._onWatch(id)
                );
                this._armIdleWatch();
                this._onStateChange(this._state);
                this._restartTimer();
            }
        );
    }

    disable() {
        this._clearTimer();
        this._disabled = true;
        if (this._signalId && this._proxy) {
            this._proxy.disconnectSignal(this._signalId);
        }
        this._removeWatchesAsync();
        this._proxy = null;
        this._signalId = 0;
    }

    _clearTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    }

    _restartTimer() {
        this._clearTimer();
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            HEARTBEAT_INTERVAL_S,
            () => {
                this._onStateChange(this._state);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _armIdleWatch() {
        this._proxy.AddIdleWatchAsync(IDLE_THRESHOLD_MS, (res, err) => {
            if (this._disabled || err) {
                if (err) console.error(`aw-gnome: AddIdleWatch failed: ${err.message}`);
                return;
            }
            this._idleWatchId = res[0];
        });
    }

    _armActiveWatch() {
        this._proxy.AddUserActiveWatchAsync((res, err) => {
            if (this._disabled || err) {
                if (err) console.error(`aw-gnome: AddUserActiveWatch failed: ${err.message}`);
                return;
            }
            this._activeWatchId = res[0];
        });
    }

    _removeWatchesAsync() {
        for (const id of [this._idleWatchId, this._activeWatchId]) {
            if (id && this._proxy) {
                this._proxy.RemoveWatchRemote(id, () => {});
            }
        }
        this._idleWatchId = 0;
        this._activeWatchId = 0;
    }

    _onWatch(id) {
        let event = null;
        if (id === this._idleWatchId) {
            event = 'idle';
            this._idleWatchId = 0;
            this._armActiveWatch();
        } else if (id === this._activeWatchId) {
            event = 'active';
            this._activeWatchId = 0;
            this._armIdleWatch();
        }
        if (!event) return;

        const next = nextAfkState(this._state, event);
        this._state = next.state;
        if (next.emit) {
            this._onStateChange(next.state);
            this._restartTimer();
        }
    }
}

export function nextAfkState(current, event) {
    if (event === 'idle' && current === 'not-afk') {
        return { state: 'afk', emit: true };
    }
    if (event === 'active' && current === 'afk') {
        return { state: 'not-afk', emit: true };
    }
    return { state: current, emit: false };
}
