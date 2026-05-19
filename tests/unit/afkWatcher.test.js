import { assertEqual } from '../assert.js';
import { nextAfkState } from '../../lib/afkWatcher.js';

export const tests = {
    'not-afk + idle → afk (emit)': () => {
        assertEqual(
            nextAfkState('not-afk', 'idle'),
            { state: 'afk', emit: true }
        );
    },

    'afk + active → not-afk (emit)': () => {
        assertEqual(
            nextAfkState('afk', 'active'),
            { state: 'not-afk', emit: true }
        );
    },

    'not-afk + active → not-afk (no emit, redundant)': () => {
        assertEqual(
            nextAfkState('not-afk', 'active'),
            { state: 'not-afk', emit: false }
        );
    },

    'afk + idle → afk (no emit, redundant)': () => {
        assertEqual(
            nextAfkState('afk', 'idle'),
            { state: 'afk', emit: false }
        );
    },
};
