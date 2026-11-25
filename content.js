(() => {
    'use strict';

    // Replace any previous instance (double injection, or the extension was reloaded/updated).
    try {
        if (typeof window.__tabnetTeardown === 'function') window.__tabnetTeardown();
    } catch (_) {
        /* ignore */
    }
    document.getElementById('tabnet-speed-host')?.remove();

    const root = document.documentElement;
    if (!root || !/html/i.test(document.contentType || 'text/html')) return;
    if (!chrome.runtime?.id) return;

    // ---------- DOM (built with createElement/textContent only; nothing from the web is parsed as HTML) ----------

    const host = document.createElement('div');
    host.id = 'tabnet-speed-host';
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; pointer-events: none;';

    // "closed": page scripts cannot reach into the widget and read other tabs' titles.
    const shadow = host.attachShadow({ mode: 'closed' });

    const CSS = `
      :host {
        all: initial;
        font-size: 16px !important;
        line-height: 1 !important;
        letter-spacing: normal !important;
        text-transform: none !important;
        -webkit-text-size-adjust: 100% !important;
        --bg-surface: #ffffff;
        --bg-elevated: #f8f9fa;
        --bg-hover: #f1f3f4;
        --bg-active: #e8f0fe;
        --border-color: #dadce0;
        --text-primary: #202124;
        --text-secondary: #5f6368;
        --accent-down: #1a73e8;
        --accent-up: #1e8e3e;
        --shadow-bar: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
        --shadow-menu: 0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3);
      }

      @media (prefers-color-scheme: dark) {
        :host {
          --bg-surface: #202124;
          --bg-elevated: #292a2d;
          --bg-hover: #35363a;
          --bg-active: rgba(138, 180, 248, 0.14);
          --border-color: #3c4043;
          --text-primary: #e8eaed;
          --text-secondary: #9aa0a6;
          --accent-down: #8ab4f8;
          --accent-up: #81c995;
          --shadow-bar: 0 1px 3px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35);
          --shadow-menu: 0 4px 12px rgba(0, 0, 0, 0.55), 0 0 0 1px #3c4043;
        }
      }

      * { box-sizing: border-box; }

      .wrapper {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        line-height: 1;
        position: fixed;
        bottom: 8px;
        right: 10px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column-reverse;
        align-items: flex-end;
        gap: 6px;
        pointer-events: auto;
      }

      .bar {
        height: 22px;
        min-height: 22px;
        max-height: 22px;
        width: fit-content;
        background: var(--bg-surface);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 0 7px;
        font-size: 11px;
        font-weight: 500;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: var(--shadow-bar);
        user-select: none;
        white-space: nowrap;
        transition: background-color 0.12s ease;
      }
      .bar:hover { background: var(--bg-hover); }
      .bar:focus-visible, .tab-item:focus-visible, .close-btn:focus-visible {
        outline: 2px solid var(--accent-down);
        outline-offset: -2px;
      }
      .bar.move-unlocked {
        cursor: move;
        touch-action: none;
        border: 1.5px dashed var(--accent-down);
        background: var(--bg-elevated);
      }
      .drag-grip {
        display: none;
        color: var(--accent-down);
        font-size: 10px;
        letter-spacing: -1px;
      }
      .bar.move-unlocked .drag-grip { display: inline; }

      .stat { display: inline-flex; align-items: center; gap: 2px; }
      .d-arrow { color: var(--accent-down); font-weight: 700; font-size: 10.5px; }
      .u-arrow { color: var(--accent-up); font-weight: 700; font-size: 10.5px; }
      .val { color: var(--text-primary); }
      .divider { width: 1px; height: 11px; background: var(--border-color); }

      .popover {
        display: none;
        width: 290px;
        max-height: 320px;
        background: var(--bg-elevated);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: var(--shadow-menu);
        color: var(--text-primary);
        overflow: hidden;
        flex-direction: column;
      }
      .popover.open { display: flex; }
      .popover-header {
        padding: 8px 12px;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-title { font-size: 12px; font-weight: 600; line-height: 1.2; color: var(--text-primary); }
      .header-total {
        font-size: 11px;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        color: var(--text-secondary);
        margin-top: 2px;
      }
      .close-btn {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
      .tab-list { overflow-y: auto; padding: 4px 0; display: flex; flex-direction: column; }
      .tab-list::-webkit-scrollbar { width: 6px; }
      .tab-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
      .tab-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 6px 12px;
        cursor: pointer;
        background: transparent;
      }
      .tab-item:hover { background: var(--bg-hover); }
      .tab-item.active-tab { background: var(--bg-active); }
      .tab-info { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
      .tab-icon {
        width: 14px;
        height: 14px;
        border-radius: 2px;
        flex-shrink: 0;
        background: var(--border-color);
        overflow: hidden;
      }
      .tab-icon.loaded { background: transparent; }
      .tab-icon img { width: 100%; height: 100%; display: block; }
      .tab-title {
        font-size: 11.5px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text-primary);
      }
      .tab-speeds {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        font-variant-numeric: tabular-nums;
        font-size: 10.5px;
        line-height: 1.3;
        flex-shrink: 0;
      }
      .sp-d { color: var(--accent-down); font-weight: 500; }
      .sp-u { color: var(--accent-up); font-weight: 500; }
    `;

    function h(tag, props = {}, children = []) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key === 'class') el.className = value;
            else if (key === 'text') el.textContent = value;
            else el.setAttribute(key, value);
        }
        for (const child of children) el.appendChild(child);
        return el;
    }

    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;

    const grip = h('span', { class: 'drag-grip', text: '⋮⋮' });
    const currDown = h('span', { class: 'val', text: '0 B/s' });
    const currUp = h('span', { class: 'val', text: '0 B/s' });
    const bar = h(
        'div',
        { class: 'bar', role: 'button', tabindex: '0', title: 'Click to view open tabs network usage' },
        [
            grip,
            h('div', { class: 'stat' }, [h('span', { class: 'd-arrow', text: '↓' }), currDown]),
            h('div', { class: 'divider' }),
            h('div', { class: 'stat' }, [h('span', { class: 'u-arrow', text: '↑' }), currUp]),
        ],
    );

    const totalSpeedEl = h('div', { class: 'header-total', text: 'Total: ↓ 0 B/s • ↑ 0 B/s' });
    const closeBtn = h('button', { class: 'close-btn', type: 'button', title: 'Close', 'aria-label': 'Close', text: '✕' });
    const tabList = h('div', { class: 'tab-list' });
    const popover = h('div', { class: 'popover' }, [
        h('div', { class: 'popover-header' }, [
            h('div', {}, [h('div', { class: 'header-title', text: 'Open Tabs Network Usage' }), totalSpeedEl]),
            closeBtn,
        ]),
        tabList,
    ]);
    const wrapper = h('div', { class: 'wrapper' }, [bar, popover]);
    wrapper.style.display = 'none'; // shown once settings are loaded (no flash for users who disabled it)

    shadow.append(styleEl, wrapper);

    // ---------- helpers ----------

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const vw = () => root.clientWidth || window.innerWidth;
    const vh = () => window.innerHeight;

    function formatSpeed(bytes) {
        const b = Number.isFinite(Number(bytes)) ? Math.max(0, Number(bytes)) : 0;
        if (b < 1024) return `${Math.round(b)} B/s`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB/s`;
        return `${(b / (1024 * 1024)).toFixed(2)} MB/s`;
    }

    function safeIconUrl(url) {
        if (typeof url !== 'string' || !url) return '';
        try {
            const u = new URL(url);
            if (u.protocol === 'https:' || u.protocol === 'http:') return url;
            if (u.protocol === 'data:' && /^data:image\//i.test(url)) return url;
        } catch (_) {
            /* invalid URL */
        }
        return '';
    }

    // ---------- mounting ----------

    function normalizePageZoom() {
        const z = parseFloat(getComputedStyle(root).zoom) || 1;
        host.style.zoom = z !== 1 ? String(1 / z) : '1';
    }

    function mountHost() {
        if (!host.isConnected && document.documentElement) {
            document.documentElement.appendChild(host);
            normalizePageZoom();
        }
    }

    // Keep the widget mounted if page scripts rebuild the DOM. An orphaned instance
    // (extension reloaded) must NOT re-add itself, so it cleans up instead.
    const observer = new MutationObserver(() => {
        if (!chrome.runtime?.id) {
            teardown();
            return;
        }
        mountHost();
    });

    // ---------- position (anchored to the nearest corner so the popover never pushes the bar off-screen) ----------

    const DEFAULT_POS = { ax: 'right', ay: 'bottom', x: 10, y: 8 };
    let currentPos = DEFAULT_POS;

    function posFromBox(left, top, w, hgt) {
        const ax = left + w / 2 < vw() / 2 ? 'left' : 'right';
        const ay = top + hgt / 2 < vh() / 2 ? 'top' : 'bottom';
        return {
            ax,
            ay,
            x: ax === 'left' ? left : vw() - (left + w),
            y: ay === 'top' ? top : vh() - (top + hgt),
        };
    }

    function normalizePos(p) {
        if (!p || typeof p !== 'object') return DEFAULT_POS;
        if ((p.ax === 'left' || p.ax === 'right') && (p.ay === 'top' || p.ay === 'bottom') && Number.isFinite(p.x) && Number.isFinite(p.y)) {
            return p;
        }
        if (Number.isFinite(p.left) && Number.isFinite(p.top)) {
            return posFromBox(p.left, p.top, 90, 22); // position saved by v1.1
        }
        return DEFAULT_POS;
    }

    function applyPos(pos) {
        const p = normalizePos(pos);
        const bw = bar.offsetWidth || 90;
        const bh = bar.offsetHeight || 22;
        const x = clamp(p.x, 6, Math.max(6, vw() - bw - 6));
        const y = clamp(p.y, 6, Math.max(6, vh() - bh - 6));
        const s = wrapper.style;
        s.left = p.ax === 'left' ? `${x}px` : 'auto';
        s.right = p.ax === 'right' ? `${x}px` : 'auto';
        s.top = p.ay === 'top' ? `${y}px` : 'auto';
        s.bottom = p.ay === 'bottom' ? `${y}px` : 'auto';
        s.flexDirection = p.ay === 'bottom' ? 'column-reverse' : 'column';
        s.alignItems = p.ax === 'left' ? 'flex-start' : 'flex-end';
        currentPos = { ax: p.ax, ay: p.ay, x, y };
    }

    // ---------- state: enabled / move mode ----------

    let enabled = true;
    let isMoveMode = false;

    function setMoveState(unlocked) {
        isMoveMode = unlocked;
        bar.classList.toggle('move-unlocked', unlocked);
        if (unlocked) {
            bar.title = "Drag to reposition • Turn off 'Unlock widget position' to lock";
            setPopover(false);
        } else {
            bar.title = 'Click to view open tabs network usage';
        }
    }

    function setEnabled(value) {
        enabled = value;
        wrapper.style.display = enabled ? 'flex' : 'none';
        if (!enabled) setPopover(false);
        syncPolling();
    }

    // ---------- polling (1 request / second, only while this tab is visible and the widget is enabled) ----------

    let pollTimer = null;
    let polling = false;

    async function send(msg) {
        try {
            return await chrome.runtime.sendMessage(msg);
        } catch (_) {
            if (!chrome.runtime?.id) teardown();
            return undefined;
        }
    }

    async function poll() {
        if (!chrome.runtime?.id) {
            teardown();
            return;
        }
        if (polling || !enabled || document.hidden) return;
        polling = true;
        try {
            const res = await send({ type: 'POLL', wantAllTabs: popover.classList.contains('open') });
            if (res && !res.disabled) render(res);
        } finally {
            polling = false;
        }
    }

    function syncPolling() {
        if (enabled && !document.hidden) {
            if (!pollTimer) {
                poll();
                pollTimer = setInterval(poll, 1000);
            }
        } else if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function render(res) {
        currDown.textContent = formatSpeed(res.currentTab?.downSpeed);
        currUp.textContent = formatSpeed(res.currentTab?.upSpeed);
        if (!popover.classList.contains('open')) return;
        if (res.totalSpeed) {
            totalSpeedEl.textContent = `Total: ↓ ${formatSpeed(res.totalSpeed.downSpeed)} • ↑ ${formatSpeed(res.totalSpeed.upSpeed)}`;
        }
        if (Array.isArray(res.allTabs)) renderTabs(res.allTabs);
    }

    // ---------- popover tab list (updated in place: scroll position, hover and clicks survive each refresh) ----------

    const tabRows = new Map(); // tabId -> row
    let tabOrder = [];
    let needSort = true; // sort by activity once, when the popover opens; then keep the order stable

    function createRow(id) {
        const iconBox = h('span', { class: 'tab-icon' });
        const title = h('span', { class: 'tab-title' });
        const down = h('span', { class: 'sp-d' });
        const up = h('span', { class: 'sp-u' });
        const el = h('div', { class: 'tab-item', role: 'button', tabindex: '0' }, [
            h('div', { class: 'tab-info' }, [iconBox, title]),
            h('div', { class: 'tab-speeds' }, [down, up]),
        ]);
        const go = () => send({ type: 'SWITCH_TAB', tabId: id });
        el.addEventListener('click', go);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                go();
            }
        });
        return { el, iconBox, title, down, up, iconUrl: null };
    }

    function setIcon(row, url) {
        const safe = safeIconUrl(url);
        if (row.iconUrl === safe) return;
        row.iconUrl = safe;
        row.iconBox.textContent = '';
        row.iconBox.classList.remove('loaded');
        if (!safe) return;
        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer'; // don't leak this page's URL to other sites' favicon servers
        img.addEventListener('load', () => row.iconBox.classList.add('loaded'));
        img.addEventListener('error', () => img.remove()); // blocked by page CSP / broken -> grey placeholder stays
        img.src = safe;
        row.iconBox.appendChild(img);
    }

    function renderTabs(allTabs) {
        const byId = new Map(allTabs.map((t) => [t.id, t]));

        if (needSort) {
            tabOrder = allTabs
                .slice()
                .sort((a, b) => b.downSpeed + b.upSpeed - (a.downSpeed + a.upSpeed))
                .map((t) => t.id);
            needSort = false;
        } else {
            tabOrder = tabOrder.filter((id) => byId.has(id));
            const known = new Set(tabOrder);
            for (const t of allTabs) if (!known.has(t.id)) tabOrder.push(t.id);
        }

        for (const [id, row] of tabRows) {
            if (!byId.has(id)) {
                row.el.remove();
                tabRows.delete(id);
            }
        }

        tabOrder.forEach((id, i) => {
            const t = byId.get(id);
            let row = tabRows.get(id);
            if (!row) {
                row = createRow(id);
                tabRows.set(id, row);
            }
            row.el.classList.toggle('active-tab', !!t.active);
            const title = String(t.title || 'Untitled Tab');
            if (row.title.textContent !== title) {
                row.title.textContent = title;
                row.el.title = title;
            }
            row.down.textContent = `↓ ${formatSpeed(t.downSpeed)}`;
            row.up.textContent = `↑ ${formatSpeed(t.upSpeed)}`;
            setIcon(row, t.favIconUrl);
            if (tabList.children[i] !== row.el) tabList.insertBefore(row.el, tabList.children[i] || null);
        });
    }

    function setPopover(open) {
        const isOpen = popover.classList.contains('open');
        if (open === isOpen) return;
        popover.classList.toggle('open', open);
        tabRows.clear();
        tabOrder = [];
        tabList.textContent = '';
        needSort = true;
        if (open) poll();
    }

    // ---------- events ----------

    function toggleFromBar() {
        if (isMoveMode) return;
        setPopover(!popover.classList.contains('open'));
    }

    bar.addEventListener('click', toggleFromBar);
    bar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFromBar();
        }
    });
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPopover(false);
    });

    // Dragging with pointer capture: keeps working over iframes and when the cursor leaves the bar.
    let drag = null;

    bar.addEventListener('pointerdown', (e) => {
        if (!isMoveMode || e.button !== 0) return;
        const r = bar.getBoundingClientRect();
        drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
        try {
            bar.setPointerCapture(e.pointerId);
        } catch (_) {
            /* ignore */
        }
        e.preventDefault();
    });

    bar.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const left = clamp(e.clientX - drag.dx, 6, Math.max(6, vw() - drag.w - 6));
        const top = clamp(e.clientY - drag.dy, 6, Math.max(6, vh() - drag.h - 6));
        applyPos(posFromBox(left, top, drag.w, drag.h));
    });

    function endDrag(e) {
        if (!drag || e.pointerId !== drag.id) return;
        drag = null;
        try {
            chrome.storage.local.set({ widgetPos: currentPos });
        } catch (_) {
            if (!chrome.runtime?.id) teardown();
        }
    }
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    function onStorageChanged(changes, area) {
        if (area !== 'local') return;
        if (changes.isEnabled) setEnabled(changes.isEnabled.newValue !== false);
        if (changes.isMoveMode) setMoveState(changes.isMoveMode.newValue === true);
        if (changes.widgetPos) applyPos(changes.widgetPos.newValue);
    }
    chrome.storage.onChanged.addListener(onStorageChanged);

    function onVisibility() {
        if (!document.hidden) normalizePageZoom();
        syncPolling();
    }
    function onResize() {
        applyPos(currentPos);
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('load', normalizePageZoom);
    window.addEventListener('resize', onResize);

    // ---------- teardown ----------

    function teardown() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('load', normalizePageZoom);
        window.removeEventListener('resize', onResize);
        try {
            chrome.storage.onChanged.removeListener(onStorageChanged);
        } catch (_) {
            /* context already invalidated */
        }
        host.remove();
        if (window.__tabnetTeardown === teardown) delete window.__tabnetTeardown;
    }
    window.__tabnetTeardown = teardown;

    // ---------- start ----------

    mountHost();
    observer.observe(root, { childList: true });
    applyPos(DEFAULT_POS);

    try {
        chrome.storage.local.get(['isEnabled', 'isMoveMode', 'widgetPos'], (res) => {
            void chrome.runtime.lastError; // read it so Chrome doesn't log "Unchecked runtime.lastError"
            setMoveState(res?.isMoveMode === true);
            applyPos(res?.widgetPos);
            setEnabled(res?.isEnabled !== false);
        });
    } catch (_) {
        teardown();
    }
})();
