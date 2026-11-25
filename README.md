# TabNet Live Speed Monitor

A lightweight Chrome extension (Manifest V3) that shows **real-time upload and download speed for each tab**, plus an overview of network usage across all your open tabs.

No accounts, no analytics, no servers. **Nothing ever leaves your browser.**

## Features

- **Live speed chip** on every page showing the current tab's download (↓) and upload (↑) speed.
- **All-tabs overview:** click the chip to see every open tab with its own speed. Click a tab in the list to jump to it.
- **Toolbar badge** with the current tab's download speed at a glance.
- **Movable widget:** unlock it from the popup, drag it anywhere, and reset it to the default corner any time.
- **Light and dark theme** (follows your system setting).
- Can be switched off completely from the popup.

## Install

### From source (developer mode)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/Nethsara14/tabnet-speed-monitor.git
   ```
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder (the one that contains `manifest.json`).

Requires **Chrome 110 or newer**. Other Chromium-based browsers (Edge, Brave, ...) should work too, but they have not been tested.

## Usage

| Action | How |
| --- | --- |
| See current tab speed | Look at the chip in the bottom-right corner of the page, or at the toolbar badge |
| See all tabs | Click the chip |
| Switch to a tab | Click it in the list |
| Hide the widget | Toolbar icon → turn off **Show speed overlay** |
| Move the widget | Toolbar icon → turn on **Unlock widget position**, drag the chip, then turn it off again |
| Reset position | Toolbar icon → **Reset to default corner** |

The widget is not shown on pages where Chrome does not allow extensions to run (for example `chrome://` pages and the Chrome Web Store).

## How it works (and why speeds are estimates)

The extension uses the `webRequest` API and reads **only HTTP header information**. It never reads page content or request/response bodies.

- **Download:** counted when a request finishes, using the response `Content-Length` header plus a small fixed overhead.
- **Upload:** counted per request, using a small fixed overhead plus `Content-Length` when the browser exposes it.

Because of this, the numbers are **approximations** and can differ from your real network usage:

- Responses without a `Content-Length` header (chunked / streamed responses) are counted at their small fixed overhead only.
- A single large download shows up as one spike when it finishes, not as a smooth speed curve.
- WebSocket frames, and traffic that does not belong to a tab, are not counted.

It is great for spotting *which tab is busy*; it is not a replacement for a network analyzer.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `webRequest` | To observe request/response headers and estimate per-tab traffic |
| `tabs` | To read tab titles/icons for the all-tabs list and to switch tabs |
| `storage` | To save your 3 settings: overlay on/off, move mode, widget position |
| `scripting` | To add the widget to tabs that were already open when the extension was installed or updated |
| Host access (`<all_urls>`) | To measure traffic and show the widget on every website |

## Privacy

- No data is collected, stored remotely, sold, or shared.
- Tab titles, icons and request sizes are used only to draw the widget and are never saved.
- The only thing stored (locally, via `chrome.storage.local`) is your settings.
- When the all-tabs list is open, your browser loads each tab's favicon, as it normally does.

Full policy: [Privacy Policy](https://nethsara14.github.io/tabnet-speed-monitor/privacy.html)

## Project structure

```
manifest.json    Extension manifest (MV3)
background.js    Service worker: collects per-tab traffic, computes speeds, badge
content.js       The on-page widget (closed Shadow DOM) and all-tabs list
popup.html/js    Toolbar popup (settings)
icons/           Extension icons
```

## Contributing

Issues and pull requests are welcome. If you are reporting a bug, please include your Chrome version and the page where it happened.

## License

[MIT](LICENSE) © 2026 Sasindu Nethsara Karanayaka
