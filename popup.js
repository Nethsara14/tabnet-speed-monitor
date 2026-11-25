const toggleEnabled = document.getElementById('toggle-enabled');
const toggleMove = document.getElementById('toggle-move');
const resetBtn = document.getElementById('reset-pos');
const versionEl = document.getElementById('version');

versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

chrome.storage.local.get(['isEnabled', 'isMoveMode']).then((res) => {
    toggleEnabled.checked = res.isEnabled !== false;
    toggleMove.checked = res.isMoveMode === true;
});

toggleEnabled.addEventListener('change', () => {
    chrome.storage.local.set({ isEnabled: toggleEnabled.checked });
});

toggleMove.addEventListener('change', () => {
    chrome.storage.local.set({ isMoveMode: toggleMove.checked });
});

resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('widgetPos');
    await chrome.storage.local.set({ isMoveMode: false });
    toggleMove.checked = false;
});
