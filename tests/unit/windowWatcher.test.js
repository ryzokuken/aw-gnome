import { assertEqual } from '../assert.js';
import { resolveAppId } from '../../lib/windowWatcher.js';

const win = (overrides) => ({
    get_sandboxed_app_id: () => null,
    get_gtk_application_id: () => null,
    get_wm_class: () => null,
    ...overrides,
});

export const tests = {
    'prefers sandboxed app id (Flatpak)': () => {
        const w = win({
            get_sandboxed_app_id: () => 'org.mozilla.firefox',
            get_gtk_application_id: () => 'firefox',
            get_wm_class: () => 'Firefox',
        });
        assertEqual(resolveAppId(w), 'org.mozilla.firefox');
    },

    'falls back to gtk application id': () => {
        const w = win({
            get_gtk_application_id: () => 'org.gnome.Nautilus',
            get_wm_class: () => 'Nautilus',
        });
        assertEqual(resolveAppId(w), 'org.gnome.Nautilus');
    },

    'falls back to wm_class': () => {
        const w = win({ get_wm_class: () => 'Alacritty' });
        assertEqual(resolveAppId(w), 'Alacritty');
    },

    'returns "unknown" when all sources empty': () => {
        assertEqual(resolveAppId(win({})), 'unknown');
    },

    'ignores empty strings (treats as null)': () => {
        const w = win({
            get_sandboxed_app_id: () => '',
            get_gtk_application_id: () => '',
            get_wm_class: () => 'Term',
        });
        assertEqual(resolveAppId(w), 'Term');
    },

    'tolerates null window': () => {
        assertEqual(resolveAppId(null), 'unknown');
    },
};
