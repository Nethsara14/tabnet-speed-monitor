# Privacy Policy: TabNet Live Speed Monitor

**Last updated:** November 25, 2026

TabNet Live Speed Monitor ("the extension") is an open-source Chrome extension that shows real-time upload and download speed for each browser tab.

## Summary

**The extension does not collect, store remotely, sell, or share any personal data. Nothing leaves your browser.**

## What the extension accesses

To do its job, the extension reads the following information **locally, inside your browser**:

- **HTTP header sizes** (the `Content-Length` header of requests and responses) to estimate how much data each tab uses. It never reads page content or request/response bodies.
- **Titles and icons (favicons) of your open tabs**, only to show them in the all-tabs list when you open it, and to let you switch to a tab by clicking it.

This information is kept in memory only while it is needed to draw the widget. It is not written to disk, not logged, and not sent anywhere.

## What the extension stores

The extension saves exactly three settings on your device using `chrome.storage.local`:

1. Whether the speed overlay is turned on or off
2. Whether the widget's move mode is on or off
3. The position of the widget on the screen

These settings never leave your device.

## What the extension does not do

- It does not send data to any server (the extension makes no network requests of its own)
- It does not use analytics, tracking, advertising, or cookies
- It does not load or run remote code
- It does not sell or share data with third parties
- It does not use data for any purpose other than showing you network speed

## Favicons

When the all-tabs list is open, your browser loads each tab's favicon from the website it belongs to, the same way it normally does when it shows that tab. The extension does not send this information anywhere else.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `webRequest` | To observe request and response headers and estimate per-tab traffic |
| `tabs` | To read tab titles and icons for the all-tabs list, and to switch tabs |
| `storage` | To save the three settings listed above |
| `scripting` | To add the widget to tabs that were already open when the extension was installed or updated |
| Host access (`<all_urls>`) | To measure traffic and show the widget on every website |

## Children's privacy

The extension does not collect any data from anyone, including children.

## Changes to this policy

If this policy changes, the new version will be published in this repository with an updated date at the top.

## Open source

The full source code is available at https://github.com/Nethsara14/tabnet-speed-monitor under the MIT License, so you can verify everything described here.

## Contact

For questions about this policy, please open an issue: https://github.com/Nethsara14/tabnet-speed-monitor/issues
