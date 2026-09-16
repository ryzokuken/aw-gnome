import GLib from 'gi://GLib';

const AFK_THRESHOLD_MS = 180000;
const POLL_INTERVAL_S = 5;

// AFK heartbeats are stamped at the last input, up to the threshold in the past, so they need a
// pulsetime of at least threshold + interval to keep merging (same as upstream aw-watcher-afk).
export const AFK_PULSETIME = AFK_THRESHOLD_MS / 1000 + POLL_INTERVAL_S;

/**
 * Polls the compositor's idle time and reports AFK heartbeats. Idle time ignores idle inhibitors;
 * see docs/adr/0001-afk-ignores-idle-inhibitors.md.
 */
export class AfkWatcher {
    constructor({onHeartbeat}) {
        this._onHeartbeat = onHeartbeat;
        this._state = 'not-afk';
        this._monitor = null;
        this._timerId = 0;
    }

    enable() {
        this._monitor = global.backend.get_core_idle_monitor();
        this._poll();
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            POLL_INTERVAL_S,
            () => {
                this._poll();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    disable() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        this._monitor = null;
        this._state = 'not-afk';
    }

    _poll() {
        const next = afkHeartbeats(this._state, this._monitor.get_idletime(), new Date());
        this._state = next.state;
        for (const heartbeat of next.heartbeats)
            this._onHeartbeat(heartbeat);
    }
}

/**
 * Decides the AFK state for the current idle time and the heartbeats that record it.
 *
 * @param {'afk'|'not-afk'} current AFK state after the previous poll
 * @param {number} idleMs idle time in milliseconds
 * @param {Date} now when idle time was read
 * @returns {{state: 'afk'|'not-afk', heartbeats: object[]}} new state and heartbeats to send
 */
export function afkHeartbeats(current, idleMs, now) {
    const lastInput = new Date(now.getTime() - idleMs);
    const afterLastInput = new Date(lastInput.getTime() + 1);
    const idleS = idleMs / 1000;

    if (current === 'not-afk' && idleMs >= AFK_THRESHOLD_MS) {
        return {
            state: 'afk',
            heartbeats: [
                afkEvent('not-afk', lastInput, 0),
                afkEvent('afk', afterLastInput, idleS),
            ],
        };
    }

    if (current === 'afk' && idleMs < AFK_THRESHOLD_MS) {
        return {
            state: 'not-afk',
            heartbeats: [
                afkEvent('afk', lastInput, 0),
                afkEvent('not-afk', afterLastInput, 0),
            ],
        };
    }

    if (current === 'afk')
        return {state: 'afk', heartbeats: [afkEvent('afk', afterLastInput, idleS)]};

    return {state: 'not-afk', heartbeats: [afkEvent('not-afk', lastInput, 0)]};
}

function afkEvent(status, timestamp, duration) {
    return {timestamp, duration, data: {status}};
}
