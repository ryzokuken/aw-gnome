import GLib from 'gi://GLib';

import {chainPulsetime} from './heartbeatClient.js';

const HEARTBEAT_INTERVAL_S = 5;
export const WINDOW_PULSETIME = chainPulsetime(HEARTBEAT_INTERVAL_S);

export class WindowWatcher {
    constructor({onHeartbeat}) {
        this._onHeartbeat = onHeartbeat;
        this._display = globalThis.global?.display ?? null;
        this._focusHandlerId = 0;
        this._titleHandlerId = 0;
        this._currentWindow = null;
        this._timerId = 0;
        this._lastWindow = null;
    }

    enable() {
        if (!this._display)
            throw new Error('WindowWatcher requires gnome-shell global.display');

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
        this._lastWindow = null;
    }

    _disconnectTitle() {
        if (this._titleHandlerId && this._currentWindow)
            this._currentWindow.disconnect(this._titleHandlerId);

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
                this._send(this._lastWindow);
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
        if (!w)
            return;
        this._send({
            app: resolveAppId(w),
            title: w.get_title?.() ?? '',
        });
        this._restartTimer();
    }

    _send(focused) {
        if (!focused)
            return;
        for (const heartbeat of windowHeartbeats(this._lastWindow, focused, new Date()))
            this._onHeartbeat(heartbeat);
        this._lastWindow = focused;
    }
}

/**
 * Heartbeats that record the focused window. When it changes, the previous window's event is first
 * extended to now, so no time is lost between its last repeat and the change.
 *
 * @param {{app: string, title: string}|null} previous focused window last reported, if any
 * @param {{app: string, title: string}} focused focused window now
 * @param {Date} now
 * @returns {object[]} heartbeat events to send, in order
 */
export function windowHeartbeats(previous, focused, now) {
    const open = {timestamp: now, duration: 0, data: focused};
    if (!previous || isSameWindow(previous, focused))
        return [open];

    return [
        {timestamp: now, duration: 0, data: previous},
        {...open, timestamp: new Date(now.getTime() + 1)},
    ];
}

function isSameWindow(a, b) {
    return a.app === b.app && a.title === b.title;
}

/**
 * Picks the most specific app id a window exposes: sandboxed, then GTK, then WM class.
 *
 * @param {object|null} window a `Meta.Window` or a stub with the same getters
 * @returns {string} app id, or `unknown`
 */
export function resolveAppId(window) {
    if (!window)
        return 'unknown';
    const candidates = [
        window.get_sandboxed_app_id?.(),
        window.get_gtk_application_id?.(),
        window.get_wm_class?.(),
    ];
    for (const c of candidates) {
        if (c && c.length > 0)
            return c;
    }

    return 'unknown';
}
