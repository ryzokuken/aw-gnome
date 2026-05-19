import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const DASHBOARD_URL = 'http://localhost:5600';

export const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(settings, extensionPath) {
        super._init(0.0, 'aw-gnome');
        this._settings = settings;
        this._extensionPath = extensionPath;

        this._icon = new St.Icon({ style_class: 'system-status-icon' });
        this.add_child(this._icon);
        this._updateIcon();

        this._pauseItem = new PopupMenu.PopupSwitchMenuItem(
            'Pause tracking',
            this._settings.get_boolean('paused')
        );
        this._pauseItem.connect('toggled', (_item, state) => {
            this._settings.set_boolean('paused', state);
        });
        this.menu.addMenuItem(this._pauseItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const dashItem = new PopupMenu.PopupMenuItem('Open Dashboard');
        dashItem.connect('activate', () => {
            Gio.AppInfo.launch_default_for_uri(DASHBOARD_URL, null);
        });
        this.menu.addMenuItem(dashItem);

        this._settingsHandlerId = this._settings.connect(
            'changed::paused',
            () => {
                this._pauseItem.setToggleState(this._settings.get_boolean('paused'));
                this._updateIcon();
            }
        );
    }

    _updateIcon() {
        const name = this._settings.get_boolean('paused')
            ? 'aw-gnome-paused-symbolic'
            : 'aw-gnome-recording-symbolic';
        const file = Gio.File.new_for_path(`${this._extensionPath}/icons/${name}.svg`);
        this._icon.gicon = new Gio.FileIcon({ file });
    }

    destroy() {
        if (this._settingsHandlerId) {
            this._settings.disconnect(this._settingsHandlerId);
            this._settingsHandlerId = 0;
        }
        super.destroy();
    }
});
