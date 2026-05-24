import GLib from 'gi://GLib';

const HEARTBEAT_INTERVAL_S = 5;

export class WindowWatcher {
    constructor({ onEvent }) {
        this._onEvent = onEvent;
        this._display = globalThis.global?.display ?? null;
        this._focusHandlerId = 0;
        this._titleHandlerId = 0;
        this._currentWindow = null;
        this._timerId = 0;
        this._lastEvent = null;
    }

    enable() {
        if (!this._display) {
            throw new Error('WindowWatcher requires gnome-shell global.display');
        }
        this._focusHandlerId = this._display.connect(
            'notify::focus-window',
            () => this._onFocusChanged()
        );
        this._onFocusChanged();
    }

    disable() {
        this._clearTimer();
        if (this._focusHandlerId) {
            this._display.disconnect(this._focusHandlerId);
            this._focusHandlerId = 0;
        }
        this._disconnectTitle();
        this._currentWindow = null;
        this._lastEvent = null;
    }

    _disconnectTitle() {
        if (this._titleHandlerId && this._currentWindow) {
            this._currentWindow.disconnect(this._titleHandlerId);
        }
        this._titleHandlerId = 0;
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
                if (this._lastEvent) this._onEvent(this._lastEvent);
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _onFocusChanged() {
        this._disconnectTitle();
        this._currentWindow = this._display.focus_window;
        if (this._currentWindow) {
            this._titleHandlerId = this._currentWindow.connect(
                'notify::title',
                () => this._emit()
            );
        }
        this._emit();
    }

    _emit() {
        const w = this._currentWindow;
        if (!w) return;
        const event = {
            app: resolveAppId(w),
            title: w.get_title?.() ?? '',
        };
        this._lastEvent = event;
        this._onEvent(event);
        this._restartTimer();
    }
}

export function resolveAppId(window) {
    if (!window) return 'unknown';
    const candidates = [
        window.get_sandboxed_app_id?.(),
        window.get_gtk_application_id?.(),
        window.get_wm_class?.(),
    ];
    for (const c of candidates) {
        if (c && c.length > 0) return c;
    }
    return 'unknown';
}
