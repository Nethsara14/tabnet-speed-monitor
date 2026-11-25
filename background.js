'use strict';

/*
 * TabNet background service worker.
 *
 * Design notes (MV3):
 *  - No setInterval. The content script of the visible tab polls once per second
 *    (POLL message). That wakes/keeps the worker alive only while a tab is visible,
 *    and speeds are computed from real elapsed time (Date.now), not from a "1 tick = 1s" assumption.
 *  - The all-tabs list (titles, favicons) is only sent when the popover is open (wantAllTabs).
 *  - Traffic numbers are ESTIMATES: header-only webRequest data (Content-Length + fixed overhead).
 */

const tabStats = new Map(); // tabId -> { upBytes, downBytes, upSpeed, downSpeed }
const EMPTY = Object.freeze({ upSpeed: 0, downSpeed: 0 });

const MIN_ROLL_MS = 800; // don't roll the window more often than this
const STALE_MS = 3000; // if nobody polled for this long, the window is stale -> reset instead of averaging
const PRUNE_EVERY_MS = 60000;

let enabled = true;
let lastRoll = Date.now();
let lastPrune = Date.now();

chrome.action.setBadgeBackgroundColor({ color: '#0284c7' });

// ---------- settings ----------

chrome.storage.local.get('isEnabled').then(({ isEnabled }) => {
    enabled = isEnabled !== false;
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.isEnabled) return;
    enabled = changes.isEnabled.newValue !== false;
    if (enabled) {
        resetWindow();
    } else {
        clearAllBadges();
    }
});

function resetWindow() {
    lastRoll = Date.now();
    for (const s of tabStats.values()) {
        s.upBytes = s.downBytes = s.upSpeed = s.downSpeed = 0;
    }
}

async function clearAllBadges() {
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.id == null) continue;
            chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {});
        }
    } catch (_) {
        /* ignore */
    }
}

// ---------- install / existing tabs ----------

// After install or update, tabs that were already open have no content script (or an orphaned old one).
// content.js tears down any previous instance by itself, so re-injecting is safe.
async function injectIntoExistingTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'], discarded: false });
        for (const tab of tabs) {
            if (tab.id == null) continue;
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => {});
        }
    } catch (_) {
        /* ignore */
    }
}

chrome.runtime.onInstalled.addListener((details) => {
    // NOTE: we no longer write isEnabled here. A missing value already means "enabled",
    // and writing it on every update used to re-enable the widget for users who had turned it off.
    if (details.reason === 'install' || details.reason === 'update') {
        injectIntoExistingTabs();
    }
});

// ---------- stats ----------

chrome.tabs.onRemoved.addListener((tabId) => {
    tabStats.delete(tabId);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    tabStats.delete(removedTabId);
});

function getOrCreateStat(tabId) {
    let stat = tabStats.get(tabId);
    if (!stat) {
        stat = { upBytes: 0, downBytes: 0, upSpeed: 0, downSpeed: 0 };
        tabStats.set(tabId, stat);
    }
    return stat;
}

function headerBytes(headers, name) {
    if (!headers) return 0;
    const h = headers.find((x) => x.name.toLowerCase() === name);
    if (!h || !h.value) return 0;
    const n = Number.parseInt(h.value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// Upload (estimate): fixed request overhead + Content-Length when the browser exposes it.
// Header-only on purpose: the request body is never inspected.
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (!enabled || details.tabId < 0) return;
        getOrCreateStat(details.tabId).upBytes += 350 + headerBytes(details.requestHeaders, 'content-length');
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders'],
);

// Download (estimate): fixed response overhead + Content-Length when the server sends it.
chrome.webRequest.onCompleted.addListener(
    (details) => {
        if (!enabled || details.tabId < 0 || details.fromCache) return;
        getOrCreateStat(details.tabId).downBytes += 400 + headerBytes(details.responseHeaders, 'content-length');
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
);

// Turn the bytes collected since the last roll into bytes/second using the real elapsed time.
function rollover() {
    const now = Date.now();
    const dt = now - lastRoll;
    if (dt < MIN_ROLL_MS) return;

    if (dt > STALE_MS) {
        // Nobody was polling (no visible tab). The old window says nothing about "right now".
        for (const s of tabStats.values()) {
            s.upBytes = s.downBytes = s.upSpeed = s.downSpeed = 0;
        }
    } else {
        const secs = dt / 1000;
        for (const s of tabStats.values()) {
            s.upSpeed = Math.round(s.upBytes / secs);
            s.downSpeed = Math.round(s.downBytes / secs);
            s.upBytes = 0;
            s.downBytes = 0;
        }
    }
    lastRoll = now;
}

async function pruneStats(tabs) {
    const now = Date.now();
    if (now - lastPrune < PRUNE_EVERY_MS) return;
    lastPrune = now;
    const live = new Set(tabs.map((t) => t.id));
    for (const id of tabStats.keys()) {
        if (!live.has(id)) tabStats.delete(id);
    }
}

// Max 4 characters (what the toolbar badge can show).
function formatBadge(bytes) {
    const b = Math.max(0, Math.round(bytes));
    if (b < 1000) return `${b}B`;
    const k = b / 1024;
    if (k < 9.95) return `${k.toFixed(1)}K`;
    if (Math.round(k) < 1000) return `${Math.round(k)}K`;
    const m = b / (1024 * 1024);
    if (m < 9.95) return `${m.toFixed(1)}M`;
    return `${Math.min(Math.round(m), 999)}M`;
}

async function handlePoll(msg, tab) {
    if (!enabled) return { disabled: true };

    rollover();

    const current = getOrCreateStat(tab.id);
    chrome.action.setBadgeText({ tabId: tab.id, text: formatBadge(current.downSpeed) }).catch(() => {});

    let totalDown = 0;
    let totalUp = 0;
    for (const s of tabStats.values()) {
        totalDown += s.downSpeed;
        totalUp += s.upSpeed;
    }

    const response = {
        currentTab: { upSpeed: current.upSpeed, downSpeed: current.downSpeed },
        totalSpeed: { downSpeed: totalDown, upSpeed: totalUp },
    };

    // Titles / favicons of other tabs only leave the worker when the popover is actually open.
    if (msg.wantAllTabs === true) {
        const tabs = await chrome.tabs.query({});
        pruneStats(tabs);
        response.allTabs = tabs
            .filter((t) => t.id != null)
            .map((t) => {
                const s = tabStats.get(t.id) || EMPTY;
                return {
                    id: t.id,
                    title: t.title || 'Untitled Tab',
                    favIconUrl: t.favIconUrl || '',
                    active: !!t.active,
                    upSpeed: s.upSpeed,
                    downSpeed: s.downSpeed,
                };
            });
    }
    return response;
}

async function switchToTab(tabId) {
    try {
        const tab = await chrome.tabs.update(tabId, { active: true });
        if (tab && tab.windowId != null) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
    } catch (_) {
        /* tab may have been closed */
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !sender.tab || !msg || typeof msg !== 'object') return;

    if (msg.type === 'POLL') {
        handlePoll(msg, sender.tab)
            .then(sendResponse)
            .catch(() => sendResponse(undefined));
        return true; // async response
    }

    if (msg.type === 'SWITCH_TAB' && Number.isInteger(msg.tabId)) {
        switchToTab(msg.tabId);
    }
});
