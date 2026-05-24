import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { HeartbeatClient } from './lib/heartbeatClient.js';
import { WindowWatcher } from './lib/windowWatcher.js';
import { AfkWatcher } from './lib/afkWatcher.js';
import { Indicator } from './lib/indicator.js';

const SERVER_URL = 'http://localhost:5600';
const PULSETIME = 6.0;

export default class AwGnomeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._hostname = GLib.get_host_name();
        this._client = new HeartbeatClient(SERVER_URL);

        const windowBucket = `aw-watcher-window_${this._hostname}`;
        const afkBucket = `aw-watcher-afk_${this._hostname}`;

        this._client.createBucket(windowBucket, 'currentwindow', this._hostname)
            .catch(e => console.error(`aw-gnome: createBucket(window) failed: ${e.message}`));
        this._client.createBucket(afkBucket, 'afkstatus', this._hostname)
            .catch(e => console.error(`aw-gnome: createBucket(afk) failed: ${e.message}`));

        this._windowWatcher = new WindowWatcher({
            onEvent: (event) => {
                if (this._settings.get_boolean('paused')) return;
                this._client.heartbeat(windowBucket, event, PULSETIME);
            },
        });
        this._windowWatcher.enable();

        this._afkWatcher = new AfkWatcher({
            onStateChange: (state) => {
                if (this._settings.get_boolean('paused')) return;
                this._client.heartbeat(afkBucket, { status: state }, PULSETIME);
            },
        });
        this._afkWatcher.enable();

        this._indicator = new Indicator(this._settings, this.path);
        Main.panel.addToStatusArea('aw-gnome', this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;

        this._windowWatcher?.disable();
        this._windowWatcher = null;

        this._afkWatcher?.disable();
        this._afkWatcher = null;

        this._client?.destroy();
        this._client = null;

        this._settings = null;
    }
}
