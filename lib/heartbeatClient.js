import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

/**
 * Formats a date as the ISO 8601 UTC timestamp aw-server expects.
 *
 * @param {Date} date
 * @returns {string} e.g. `2026-05-19T12:00:00.000+00:00`
 */
export function formatTimestamp(date) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    const Y = date.getUTCFullYear();
    const M = pad(date.getUTCMonth() + 1);
    const D = pad(date.getUTCDate());
    const h = pad(date.getUTCHours());
    const m = pad(date.getUTCMinutes());
    const s = pad(date.getUTCSeconds());
    const ms = pad(date.getUTCMilliseconds(), 3);
    return `${Y}-${M}-${D}T${h}:${m}:${s}.${ms}+00:00`;
}

/**
 * @param {string} baseUrl aw-server origin, without trailing slash
 * @param {string} bucketId
 * @returns {string} URL of the bucket resource
 */
export function buildBucketUrl(baseUrl, bucketId) {
    return `${baseUrl}/api/0/buckets/${encodeURIComponent(bucketId)}`;
}

/**
 * @param {string} baseUrl aw-server origin, without trailing slash
 * @param {string} bucketId
 * @param {number} pulsetime seconds within which heartbeats merge
 * @returns {string} URL of the bucket's heartbeat endpoint
 */
export function buildHeartbeatUrl(baseUrl, bucketId, pulsetime) {
    return `${buildBucketUrl(baseUrl, bucketId)}/heartbeat?pulsetime=${pulsetime}`;
}

/**
 * @param {Date} timestamp
 * @param {object} data event payload, e.g. `{app, title}`
 * @returns {object} heartbeat event with zero duration
 */
export function buildHeartbeatBody(timestamp, data) {
    return {
        timestamp: formatTimestamp(timestamp),
        duration: 0,
        data,
    };
}

/**
 * @param {string} client watcher name reported to aw-server
 * @param {string} eventType e.g. `currentwindow` or `afkstatus`
 * @param {string} hostname
 * @returns {object} bucket creation payload
 */
export function buildBucketBody(client, eventType, hostname) {
    return {client, type: eventType, hostname};
}

const NOT_MODIFIED = 304;

/**
 * @param {number} status HTTP status code
 * @returns {boolean} whether the status is a 2xx success
 */
function isSuccess(status) {
    return status >= 200 && status < 300;
}

/**
 * aw-server answers 304 when the bucket already exists, which is as good as creating it.
 *
 * @param {number} status HTTP status of a bucket creation request
 * @returns {boolean} whether the bucket now exists
 */
export function isBucketCreated(status) {
    return isSuccess(status) || status === NOT_MODIFIED;
}

export class HeartbeatClient {
    constructor(baseUrl) {
        this._baseUrl = baseUrl;
        this._session = new Soup.Session();
        this._session.timeout = 5;
    }

    destroy() {
        this._session?.abort();
        this._session = null;
    }

    createBucket(bucketId, eventType, hostname) {
        const body = buildBucketBody('aw-watcher-gnome', eventType, hostname);
        return this._post(buildBucketUrl(this._baseUrl, bucketId), body, isBucketCreated);
    }

    heartbeat(bucketId, data, pulsetime, timestamp = new Date()) {
        const body = buildHeartbeatBody(timestamp, data);
        const url = buildHeartbeatUrl(this._baseUrl, bucketId, pulsetime);
        this._post(url, body).catch(e => {
            console.error(`aw-gnome: heartbeat failed: ${e.message}`);
        });
    }

    async _post(url, body, isAccepted = isSuccess) {
        const msg = Soup.Message.new('POST', url);
        const payload = new TextEncoder().encode(JSON.stringify(body));
        msg.set_request_body_from_bytes('application/json', new GLib.Bytes(payload));
        const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        const status = msg.get_status();
        if (!isAccepted(status)) {
            const text = new TextDecoder().decode(bytes.get_data());
            throw new Error(`HTTP ${status}: ${text}`);
        }
        return bytes;
    }
}
