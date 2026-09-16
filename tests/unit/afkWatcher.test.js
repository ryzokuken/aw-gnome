import {assertEqual} from '../assert.js';
import {afkHeartbeats} from '../../lib/afkWatcher.js';

const NOW = new Date(Date.UTC(2026, 8, 17, 12, 0, 0, 0));
const before = ms => new Date(NOW.getTime() - ms);

export const tests = {
    'stays not-afk just below the threshold, stamped at the last input': () => {
        assertEqual(
            afkHeartbeats('not-afk', 179999, NOW),
            {
                state: 'not-afk',
                heartbeats: [
                    {timestamp: before(179999), duration: 0, data: {status: 'not-afk'}},
                ],
            }
        );
    },

    'becomes afk at the threshold: closes not-afk, then opens afk 1ms later': () => {
        assertEqual(
            afkHeartbeats('not-afk', 180000, NOW),
            {
                state: 'afk',
                heartbeats: [
                    {timestamp: before(180000), duration: 0, data: {status: 'not-afk'}},
                    {timestamp: before(179999), duration: 180, data: {status: 'afk'}},
                ],
            }
        );
    },

    'stays afk while idle, extending the afk event to now': () => {
        assertEqual(
            afkHeartbeats('afk', 200000, NOW),
            {
                state: 'afk',
                heartbeats: [
                    {timestamp: before(199999), duration: 200, data: {status: 'afk'}},
                ],
            }
        );
    },

    'returns to not-afk on input: closes afk, then opens not-afk 1ms later': () => {
        assertEqual(
            afkHeartbeats('afk', 500, NOW),
            {
                state: 'not-afk',
                heartbeats: [
                    {timestamp: before(500), duration: 0, data: {status: 'afk'}},
                    {timestamp: before(499), duration: 0, data: {status: 'not-afk'}},
                ],
            }
        );
    },

    'stays afk at exactly the threshold': () => {
        assertEqual(afkHeartbeats('afk', 180000, NOW).state, 'afk');
    },
};
