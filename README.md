# Conky NextGen Layer (GNOME 50 / 51 Wayland Extension)

A lightweight GNOME Shell extension providing native desktop pinning and pixel-perfect positioning for **Conky** under **Wayland** on **GNOME 50 and 51**.

---

## Why this extension?

Under GNOME Shell on Wayland, the compositor (Mutter) does not support the `wlr-layer-shell` protocol. As a result:
- Conky cannot position itself via standard `gap_x` / `gap_y` coordinates.
- Normal windows float, appear in Alt+Tab, and show up in the Activities Overview.
- Clicking on a widget raises it over normal application windows.

Modeled after the architecture of **Desktop Icons NG (DING)**, this extension bridges that gap from inside Mutter using internal GNOME Shell / Mutter C APIs:
1. Places the Conky window on the true desktop layer (`Meta.WindowType.DESKTOP` / `META_LAYER_DESKTOP = 0`). This natively hides it from Win+D ("Show Desktop") and the taskbar.
2. Fixes coordinates using Mutter's internal `move_frame(true, x, y)`.
3. Pins widgets across all virtual workspaces (`stick()`).
4. Completely removes widgets from **Alt+Tab** and the **Activities Overview**.
5. Automatically pushes widgets back down if clicked (`raised` signal handler).

---

## Installation

### 1. Link or copy into GNOME Shell extensions directory

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/
ln -s ~/.conky/gnome-extension ~/.local/share/gnome-shell/extensions/conky-layer@molnar
```

*(Alternatively, copy the `gnome-extension` folder to `~/.local/share/gnome-shell/extensions/conky-layer@molnar`)*

### 2. Enable the extension

Restart GNOME Shell (or log in to a new session), then enable:

```bash
gnome-extensions enable conky-layer@molnar
```

Or enable it visually via the **Extensions** app (`gnome-extensions-app`).

---

## Conky Configuration (`.conf`)

In your Conky `.conf` file, set the standard Wayland window parameters and encode the target coordinates into `own_window_title`.

### Essential Conky window settings:

```lua
conky.config = {
  -- Enable Wayland output
  out_to_wayland = true,
  out_to_x = false,

  -- Window management
  own_window = true,
  own_window_type = 'normal',   -- Wayland xdg-toplevel surface
  own_window_class = 'conky',

  -- Desktop coordinate definition in window title (see syntax below):
  own_window_title = 'Conky_Left @!DESKTOP:x=10,y=40',

  -- Transparent background
  own_window_argb_visual = true,
  own_window_argb_value = 0,
  own_window_transparent = true,

  -- Dimensions
  minimum_width = 360,
  minimum_height = 800,
}
```

---

## `own_window_title` Syntax & Examples

The extension identifies Conky windows by looking for the word **`conky`** (case-insensitive) in the title, and then extracts coordinates following the `@!` marker.

### Supported formats:

#### 1. Key-Value Syntax (Recommended)
You can specify `x` and `y` using `x=<number>` and `y=<number>`. Spaces around `=`, `,`, and `:` are fully tolerated:

```lua
-- Left panel pinned at X=10, Y=40
own_window_title = 'Conky_Left @!DESKTOP:x=10,y=40',

-- Right-hand weather widget with spaces for readability
own_window_title = 'Conky Weather @!DESKTOP: x=1540, y=40',

-- Top system monitor
own_window_title = 'Conky - Top Bar @!x=380, y=10',
```

#### 2. Short Coordinate Syntax
You can also specify coordinates simply as `X,Y` after the `@!` marker:

```lua
-- Short format: X=20, Y=50
own_window_title = 'Conky_Widget @!20,50',
own_window_title = 'Conky_Clock @!380,380',
```

### Format Summary:
- **Title Prefix:** Must contain `conky` (e.g. `Conky`, `conky_left`, `Conky - System`).
- **Tag Marker:** `@!` separates the widget name from coordinate instructions.
- **Coordinates:** `x=<val>, y=<val>` or `<x>,<y>`.
- **Dynamic Updates:** If the title changes at runtime (e.g. via Lua), the extension detects `notify::title` and automatically updates the window position without restarting.

---

## Technical Details

| Feature | Mutter C Mechanism | Result |
|---|---|---|
| **Layer Stacking** | `meta_window_set_type(win, META_WINDOW_DESKTOP)` | Window is placed into `META_LAYER_DESKTOP` (layer `0`), sitting below all application windows. |
| **Taskbar / Dock** | Auto-calculated by Mutter | Setting type to `DESKTOP` automatically enforces `skip_taskbar = TRUE` and excludes it from Win+D (Show Desktop). |
| **Alt+Tab** | JS filter wrapper on `global.display.get_tab_list` | Safely excludes the widget from the Alt+Tab window cycler (as a fallback). |
| **Positioning** | `meta_window_move_frame(win, true, x, y)` | Bypasses Wayland's client-side positioning prohibition directly from inside the compositor. |
| **Click Behavior** | `raised` GObject signal listener | Re-lowers the widget instantly if clicked (`window.lower()`), preventing it from covering applications. |

---

## Compatibility & Known Issues

- **Desktop Icons NG (DING):** ⚠️ **Known conflict with mouse interaction.**
  DING operates by stretching a massive, transparent "desktop" window over the background to handle icon rendering and drag-to-select boxes. Because DING's input region spans the entire screen, it intercepts and captures all mouse clicks intended for the desktop layer. If you use DING, **mouse interaction (clicks, hover effects) with Conky widgets will not work**. 
  - *Workaround:* If you require interactive Conky widgets (e.g., clicking to change music/weather), you must disable DING and use GNOME's clean desktop. If your widgets are display-only (no clicking required), they will run together perfectly.
