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
