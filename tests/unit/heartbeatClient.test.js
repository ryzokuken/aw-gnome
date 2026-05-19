import { assertEqual } from '../assert.js';
import {
    formatTimestamp,
    buildHeartbeatUrl,
    buildBucketUrl,
    buildHeartbeatBody,
    buildBucketBody,
} from '../../lib/heartbeatClient.js';

export const tests = {
    'formatTimestamp produces ISO 8601 UTC with milliseconds': () => {
        const d = new Date(Date.UTC(2026, 4, 19, 12, 34, 56, 789));
        assertEqual(formatTimestamp(d), '2026-05-19T12:34:56.789+00:00');
    },

    'buildHeartbeatUrl includes pulsetime as query param': () => {
        assertEqual(
            buildHeartbeatUrl('http://localhost:5600', 'aw-watcher-window_host', 2.0),
            'http://localhost:5600/api/0/buckets/aw-watcher-window_host/heartbeat?pulsetime=2'
        );
    },

    'buildHeartbeatUrl preserves fractional pulsetime': () => {
        assertEqual(
            buildHeartbeatUrl('http://localhost:5600', 'b', 185.5),
            'http://localhost:5600/api/0/buckets/b/heartbeat?pulsetime=185.5'
        );
    },

    'buildBucketUrl points at bucket resource': () => {
        assertEqual(
            buildBucketUrl('http://localhost:5600', 'aw-watcher-afk_host'),
            'http://localhost:5600/api/0/buckets/aw-watcher-afk_host'
        );
    },

    'buildHeartbeatBody wraps data in canonical event shape': () => {
        const d = new Date(Date.UTC(2026, 4, 19, 0, 0, 0, 0));
        assertEqual(
            buildHeartbeatBody(d, { app: 'firefox', title: 'GitHub' }),
            {
                timestamp: '2026-05-19T00:00:00.000+00:00',
                duration: 0,
                data: { app: 'firefox', title: 'GitHub' },
            }
        );
    },

    'buildBucketBody includes client, type, hostname': () => {
        assertEqual(
            buildBucketBody('aw-gnome', 'currentwindow', 'wkstn'),
            { client: 'aw-gnome', type: 'currentwindow', hostname: 'wkstn' }
        );
    },
};
