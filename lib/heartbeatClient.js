import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

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

export function buildBucketUrl(baseUrl, bucketId) {
    return `${baseUrl}/api/0/buckets/${encodeURIComponent(bucketId)}`;
}

export function buildHeartbeatUrl(baseUrl, bucketId, pulsetime) {
    return `${buildBucketUrl(baseUrl, bucketId)}/heartbeat?pulsetime=${pulsetime}`;
}

export function buildHeartbeatBody(timestamp, data) {
    return {
        timestamp: formatTimestamp(timestamp),
        duration: 0,
        data,
    };
}

export function buildBucketBody(client, eventType, hostname) {
    return { client, type: eventType, hostname };
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

    async createBucket(bucketId, eventType, hostname) {
        const body = buildBucketBody('aw-watcher-gnome', eventType, hostname);
        return this._post(buildBucketUrl(this._baseUrl, bucketId), body);
    }

    heartbeat(bucketId, data, pulsetime, timestamp = new Date()) {
        const body = buildHeartbeatBody(timestamp, data);
        const url = buildHeartbeatUrl(this._baseUrl, bucketId, pulsetime);
        this._post(url, body).catch(e => {
            console.error(`aw-gnome: heartbeat failed: ${e.message}`);
        });
    }

    async _post(url, body) {
        const msg = Soup.Message.new('POST', url);
        const payload = new TextEncoder().encode(JSON.stringify(body));
        msg.set_request_body_from_bytes('application/json', new GLib.Bytes(payload));
        const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        const status = msg.get_status();
        if (status < 200 || status >= 300) {
            const text = new TextDecoder().decode(bytes.get_data());
            throw new Error(`HTTP ${status}: ${text}`);
        }
        return bytes;
    }
}
