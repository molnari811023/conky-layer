import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Workspace } from 'resource:///org/gnome/shell/ui/workspace.js';
import Meta from 'gi://Meta';
import GLib from 'gi://GLib';

export default class ConkyNextGenExtension extends Extension {
    enable() {
        this._trackedWindows = new Map();
        this._timeouts = [];

        // 1. ALT+TAB FILTER: Safe C-level wrapper to exclude Conky windows
        this._origGetTabList = global.display.get_tab_list;
        global.display.get_tab_list = (type, workspace) => {
            let windows = this._origGetTabList.call(global.display, type, workspace);
            if (!windows) return [];
            return windows.filter(win => win && !win._isConkyWidget);
        };



        // 3. MONITOR NEW WINDOWS: window-created signal (MetaDisplay C API)
        this._windowCreatedId = global.display.connect(
            'window-created',
            (display, window) => {
                this._setupWindowListeners(window);
            }
        );

        // 4. LIST ALREADY RUNNING WINDOWS: global.display.list_all_windows() (GNOME 50/51 C API)
        let existingWindows = global.display.list_all_windows ? global.display.list_all_windows() : [];
        existingWindows.forEach(win => {
            if (win) this._setupWindowListeners(win);
        });
    }

    disable() {
        // Restore original Alt+Tab and Overview functions
        if (this._origGetTabList) {
            global.display.get_tab_list = this._origGetTabList;
            this._origGetTabList = null;
        }

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._timeouts) {
            this._timeouts.forEach(id => GLib.source_remove(id));
            this._timeouts = [];
        }

        // Safely disconnect signals and clean flags
        for (let [window, ids] of this._trackedWindows.entries()) {
            if (window && window.get_compositor_private()) {
                ids.forEach(id => {
                    try { window.disconnect(id); } catch (e) {}
                });
                delete window._isConkyWidget;
            }
        }
        this._trackedWindows.clear();
    }

    _setupWindowListeners(window) {
        this._handleWindow(window);

        // Monitor title changes (in case coordinates update dynamically)
        let titleId = window.connect('notify::title', () => {
            this._handleWindow(window);
        });

        // Clean up when window is destroyed (Mutter unmanaged signal)
        let unmanagedId = window.connect('unmanaged', () => {
            this._trackedWindows.delete(window);
        });

        this._trackedWindows.set(window, [titleId, unmanagedId]);
    }

    _handleWindow(window) {
        let title = window.get_title();
        if (!title) return;

        // 1. Filter: only inspect Conky windows
        if (!title.toLowerCase().includes('conky')) return;

        // 2. COORDINATE PARSING: Safe regex (avoids false-matching version numbers)
        // Handles: "x=10, y=40", "@!DESKTOP:x=10,y=40" and "@!10,40" formats
        let x = null;
        let y = null;

        let xMatch = title.match(/\bx\s*=\s*(-?\d+)/i);
        let yMatch = title.match(/\by\s*=\s*(-?\d+)/i);

        if (xMatch && yMatch) {
            x = parseInt(xMatch[1], 10);
            y = parseInt(yMatch[1], 10);
        } else {
            let altMatch = title.match(/@!.*?(-?\d+)[\s,_\-]+(-?\d+)/);
            if (altMatch) {
                x = parseInt(altMatch[1], 10);
                y = parseInt(altMatch[2], 10);
            }
        }

        // If no coordinates are present, leave it untouched
        if (x === null || y === null) return;

        // If already processed and only coordinates changed in title, reposition immediately
        if (window._isConkyWidget) {
            window.move_frame(true, x, y);
            return;
        }

        // Mark window for custom filters
        window._isConkyWidget = true;

        // 3. TASKBAR / DOCK FILTER: Invoke C-setter if present (though DESKTOP type sets this automatically)
        try {
            if (typeof window.set_skip_taskbar === 'function') {
                window.set_skip_taskbar(true);
            }
        } catch (e) {}

        // 4. WAYLAND SURFACE INITIALIZATION: 200ms delay modeled after DING
        // Waits for the first buffer commit so Mutter places the frame accurately
        let timeoutId = GLib.timeout_add(GLib.PRIORITY_LOW, 200, () => {
            let idx = this._timeouts ? this._timeouts.indexOf(timeoutId) : -1;
            if (idx > -1) this._timeouts.splice(idx, 1);

            if (!window || !window.get_compositor_private()) return GLib.SOURCE_REMOVE;

            // Keep it as NORMAL type (so it stays in META_LAYER_NORMAL above DING's DESKTOP layer).
            // But push it to the absolute bottom of NORMAL so all standard apps cover it.
            // window.set_type(Meta.WindowType.DESKTOP); // REMOVED!

            // Pin across all virtual workspaces
            window.stick();

            // Pixel-perfect positioning and push to lowest layer of NORMAL
            window.move_frame(true, x, y);
            window.lower();

            // ON CLICK: Mutter's "raised" signal fires. We must push it back down!
            let raisedId = window.connect('raised', () => {
                if (window && window.get_compositor_private()) {
                    window.lower();
                }
            });

            let ids = this._trackedWindows.get(window) || [];
            ids.push(raisedId);
            this._trackedWindows.set(window, ids);

            console.log(`[Conky-NextGen] Pinned to desktop: "${title}" -> X:${x} Y:${y}`);
            return GLib.SOURCE_REMOVE;
        });
        
        if (!this._timeouts) this._timeouts = [];
        this._timeouts.push(timeoutId);
    }
}
