import {assertEqual} from '../assert.js';
import {resolveAppId, windowHeartbeats} from '../../lib/windowWatcher.js';

const win = overrides => ({
    get_sandboxed_app_id: () => null,
    get_gtk_application_id: () => null,
    get_wm_class: () => null,
    ...overrides,
});

const NOW = new Date(Date.UTC(2026, 8, 17, 12, 0, 0, 0));
const LATER = new Date(NOW.getTime() + 1);
const editor = {app: 'org.gnome.TextEditor', title: 'notes.md'};
const browser = {app: 'firefox', title: 'GitHub'};

export const tests = {
    'first focused window opens an event now': () => {
        assertEqual(
            windowHeartbeats(null, editor, NOW),
            [{timestamp: NOW, duration: 0, data: editor}]
        );
    },

    'unchanged focused window repeats its event': () => {
        assertEqual(
            windowHeartbeats(editor, {...editor}, NOW),
            [{timestamp: NOW, duration: 0, data: editor}]
        );
    },

    'focus change closes the previous event now, then opens the next 1ms later': () => {
        assertEqual(
            windowHeartbeats(editor, browser, NOW),
            [
                {timestamp: NOW, duration: 0, data: editor},
                {timestamp: LATER, duration: 0, data: browser},
            ]
        );
    },

    'title change within an app closes the old title': () => {
        const renamed = {...editor, title: 'todo.md'};
        assertEqual(
            windowHeartbeats(editor, renamed, NOW),
            [
                {timestamp: NOW, duration: 0, data: editor},
                {timestamp: LATER, duration: 0, data: renamed},
            ]
        );
    },

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
        const w = win({get_wm_class: () => 'Alacritty'});
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
