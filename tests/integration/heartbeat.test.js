// Run with: make test-integration
// Requires aw-server-rust in $PATH. Uses --testing flag (separate DB, port 5666).
// Skips cleanly with exit 0 if aw-server-rust is not installed.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import System from 'system';
import { HeartbeatClient } from '../../lib/heartbeatClient.js';

const TEST_PORT = 5666;
const TEST_URL = `http://localhost:${TEST_PORT}`;

function which(cmd) {
    const [ok, stdout] = GLib.spawn_command_line_sync(`which ${cmd}`);
    return ok && stdout && stdout.length > 0;
}

function sleep(ms) {
    return new Promise(resolve => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            resolve();
            return GLib.SOURCE_REMOVE;
        });
    });
}

async function waitForServer(timeoutMs = 5000) {
    const session = new Soup.Session();
    session.timeout = 1;
    const start = GLib.get_monotonic_time();
    while ((GLib.get_monotonic_time() - start) / 1000 < timeoutMs) {
        try {
            const msg = Soup.Message.new('GET', `${TEST_URL}/api/0/info`);
            await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
            if (msg.get_status() === 200) return;
        } catch {
            // keep waiting
        }
        await sleep(100);
    }
    throw new Error(`aw-server-rust did not start within ${timeoutMs}ms`);
}

async function fetchEvents(bucketId) {
    const session = new Soup.Session();
    const msg = Soup.Message.new('GET', `${TEST_URL}/api/0/buckets/${bucketId}/events`);
    const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
    return JSON.parse(new TextDecoder().decode(bytes.get_data()));
}

async function main() {
    if (!which('aw-server-rust')) {
        print('SKIP: aw-server-rust not in PATH');
        return 0;
    }

    const proc = Gio.Subprocess.new(
        ['aw-server-rust', '--testing', '--port', String(TEST_PORT)],
        Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
    );

    try {
        await waitForServer();

        const client = new HeartbeatClient(TEST_URL);
        const bucket = 'aw-watcher-test_ci';
        await client.createBucket(bucket, 'currentwindow', 'ci');

        client.heartbeat(bucket, { app: 'firefox', title: 'GitHub' }, 2.0);
        await sleep(500);

        const events = await fetchEvents(bucket);
        if (events.length < 1) throw new Error(`expected >=1 event, got ${events.length}`);
        if (events[0].data.app !== 'firefox') {
            throw new Error(`expected app=firefox, got ${events[0].data.app}`);
        }

        print('  ok   integration :: heartbeat round-trips through aw-server-rust');
        client.destroy();
        return 0;
    } finally {
        proc.force_exit();
    }
}

try {
    const code = await main();
    System.exit(code);
} catch (e) {
    print(`  FAIL integration :: ${e.message}`);
    System.exit(1);
}
