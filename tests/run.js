// Minimal test runner. Each test file exports a `tests` object:
//   export const tests = { 'name of test': () => { ... } };
// Test functions throw on failure (use helpers from ./assert.js).

import GLib from 'gi://GLib';
import System from 'system';

const TEST_FILES = [
    './unit/heartbeatClient.test.js',
    './unit/windowWatcher.test.js',
    './unit/afkWatcher.test.js',
];

let passed = 0;
let failed = 0;

for (const file of TEST_FILES) {
    let mod;
    try {
        // eslint-disable-next-line no-await-in-loop -- files run in order for readable output
        mod = await import(file);
    } catch (e) {
        print(`FAIL ${file} (import error: ${e.message})`);
        failed++;
        continue;
    }
    if (!mod.tests) {
        print(`FAIL ${file} (no \`tests\` export)`);
        failed++;
        continue;
    }
    for (const [name, fn] of Object.entries(mod.tests)) {
        try {
            fn();
            print(`  ok   ${file} :: ${name}`);
            passed++;
        } catch (e) {
            print(`  FAIL ${file} :: ${name}`);
            print(`       ${e.message}`);
            failed++;
        }
    }
}

print(`\n${passed} passed, ${failed} failed`);
if (failed > 0 && !GLib.getenv('FORCE_OK'))
    System.exit(1);
