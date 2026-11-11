// TheaterSplit — Settings Popup Controller
// Developed by sinary.org

document.addEventListener('DOMContentLoaded', async () => {
  const SETTINGS_KEY = 'theaterSplitSettings';

  const DEFAULT_SETTINGS = {
    enabled: true,
    rememberSplitState: true,
    splitActive: false,
    defaultTab: 'comments',
    sidebarWidth: 420,
    showPlayerButton: true,
    showInlinePill: true,
    skipLiveStreams: true,
    enableAltS: true
  };

  // Elements
  const headerVersionBadge = document.getElementById('headerVersionBadge');
  const enableToggle = document.getElementById('enableToggle');

  const statusDot = document.getElementById('statusDot');
  const statusTitle = document.getElementById('statusTitle');
  const statusSubtitle = document.getElementById('statusSubtitle');
  const quickActionBtn = document.getElementById('quickActionBtn');
  const configureShortcutBtn = document.getElementById('configureShortcutBtn');

  const defaultTabGroup = document.getElementById('defaultTabGroup');
  const rememberSplitToggle = document.getElementById('rememberSplitToggle');
  const skipLiveToggle = document.getElementById('skipLiveToggle');
  const sumBehavior = document.getElementById('sumBehavior');

  const sidebarWidthSlider = document.getElementById('sidebarWidthSlider');
  const valSidebarWidth = document.getElementById('valSidebarWidth');
  const showPlayerButtonToggle = document.getElementById('showPlayerButtonToggle');
  const showInlinePillToggle = document.getElementById('showInlinePillToggle');
  const enableAltSToggle = document.getElementById('enableAltSToggle');
  const sumControls = document.getElementById('sumControls');

  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');

  let settings = { ...DEFAULT_SETTINGS };
  let tabState = { isYouTube: false, isWatchPage: false, isSplitActive: false, hasLiveChat: false };

  // Set version badge from manifest
  try {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version) {
      headerVersionBadge.textContent = `v${manifest.version}`;
    }
  } catch {
    // Fallback to HTML default
  }

  function updateSummaries() {
    const tabLabel = settings.defaultTab === 'related' ? 'Up Next' : 'Comments';
    const modeLabel = settings.rememberSplitState ? 'Auto' : 'Manual';
    sumBehavior.textContent = `${tabLabel} • ${modeLabel}`;
    sumControls.textContent = `${sidebarWidthSlider.value}px`;
  }

  function renderSettingsUI() {
    enableToggle.checked = settings.enabled !== false;

    const currentTab = settings.defaultTab === 'related' ? 'related' : 'comments';
    defaultTabGroup.querySelectorAll('.pill-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.val === currentTab);
    });

    rememberSplitToggle.checked = settings.rememberSplitState !== false;
    skipLiveToggle.checked = settings.skipLiveStreams !== false;

    const width = Math.min(560, Math.max(340, Number(settings.sidebarWidth) || 420));
    sidebarWidthSlider.value = String(width);
    valSidebarWidth.textContent = `${width}px`;

    showPlayerButtonToggle.checked = settings.showPlayerButton !== false;
    showInlinePillToggle.checked = settings.showInlinePill !== false;
    enableAltSToggle.checked = settings.enableAltS !== false;

    updateSummaries();
    renderTabStatusUI();
  }

  function renderTabStatusUI() {
    statusDot.className = 'status-dot';
    quickActionBtn.classList.remove('is-active');

    if (!settings.enabled) {
      statusDot.classList.add('warn');
      statusTitle.textContent = 'TheaterSplit is paused';
      statusSubtitle.textContent = 'Turn on the top switch to enable on YouTube';
      quickActionBtn.textContent = 'Disabled';
      quickActionBtn.disabled = true;
      return;
    }

    if (tabState.isWatchPage) {
      if (tabState.isSplitActive) {
        statusDot.classList.add('active');
        statusTitle.textContent = 'Theater Split View active';
        statusSubtitle.textContent = 'Video left • Comments & Up Next right';
        quickActionBtn.textContent = 'Exit Split';
        quickActionBtn.classList.add('is-active');
        quickActionBtn.disabled = false;
      } else if (tabState.hasLiveChat && settings.skipLiveStreams) {
        statusDot.classList.add('warn');
        statusTitle.textContent = 'Live chat detected';
        statusSubtitle.textContent = 'Auto-skipped to keep Live Chat visible';
        quickActionBtn.textContent = 'Force Split';
        quickActionBtn.disabled = false;
      } else {
        statusDot.classList.add('ready');
        statusTitle.textContent = 'YouTube watch page ready';
        statusSubtitle.textContent = 'Click below or press Alt + S on the page';
        quickActionBtn.textContent = 'Enter Split';
        quickActionBtn.disabled = false;
      }
      return;
    }

    if (tabState.isYouTube) {
      statusDot.classList.add('ready');
      statusTitle.textContent = 'On YouTube';
      statusSubtitle.textContent = 'Open any regular video to use Split View';
      quickActionBtn.textContent = 'Watch Only';
      quickActionBtn.disabled = true;
      return;
    }

    statusTitle.textContent = 'Not on a YouTube tab';
    statusSubtitle.textContent = 'Switch to or open YouTube to use Split View';
    quickActionBtn.textContent = 'Open YouTube';
    quickActionBtn.disabled = false;
  }

  async function loadSettings() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (resp?.ok && resp.settings) {
        settings = { ...DEFAULT_SETTINGS, ...resp.settings };
      } else {
        const data = await chrome.storage.sync.get(SETTINGS_KEY);
        settings = { ...DEFAULT_SETTINGS, ...(data?.[SETTINGS_KEY] || {}) };
      }
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  async function refreshActiveTabStatus() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_STATUS' });
      if (resp?.ok) {
        tabState = {
          isYouTube: !!resp.isYouTube,
          isWatchPage: !!resp.isWatchPage,
          isSplitActive: !!resp.isSplitActive,
          hasLiveChat: !!resp.hasLiveChat
        };
      }
    } catch {
      tabState = { isYouTube: false, isWatchPage: false, isSplitActive: false, hasLiveChat: false };
    }
    renderTabStatusUI();
  }

  async function saveSettings() {
    settings.enabled = enableToggle.checked;
    settings.defaultTab = defaultTabGroup.querySelector('.pill-btn.active')?.dataset.val || 'comments';
    settings.rememberSplitState = rememberSplitToggle.checked;
    settings.skipLiveStreams = skipLiveToggle.checked;
    settings.sidebarWidth = parseInt(sidebarWidthSlider.value, 10) || 420;
    settings.showPlayerButton = showPlayerButtonToggle.checked;
    settings.showInlinePill = showInlinePillToggle.checked;
    settings.enableAltS = enableAltSToggle.checked;

    updateSummaries();
    renderTabStatusUI();

    try {
      await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings });
    } catch {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    }
  }

  // Accordion expand/collapse
  document.querySelectorAll('.accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const isOpen = item.classList.toggle('open');
      header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  // Quick Action Button (Enter/Exit Split View or Open YouTube)
  quickActionBtn.addEventListener('click', async () => {
    if (!tabState.isYouTube) {
      await chrome.tabs.create({ url: 'https://www.youtube.com' });
      window.close();
      return;
    }
    if (!tabState.isWatchPage) return;

    quickActionBtn.disabled = true;
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'TOGGLE_ACTIVE_TAB_SPLIT' });
      if (resp?.ok) {
        tabState.isSplitActive = !!resp.isSplitActive;
        settings.splitActive = tabState.isSplitActive;
      }
    } catch {
      // Ignore transient errors
    } finally {
      renderTabStatusUI();
    }
  });

  // Open browser extension shortcuts settings (Chrome or Edge)
  configureShortcutBtn.addEventListener('click', async () => {
    const isEdge = navigator.userAgent.includes('Edg/');
    const shortcutsUrl = isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
    try {
      await chrome.tabs.create({ url: shortcutsUrl });
    } catch {
      // Fallback ignored if restricted
    }
  });

  // Setting listeners
  enableToggle.addEventListener('change', saveSettings);
  rememberSplitToggle.addEventListener('change', saveSettings);
  skipLiveToggle.addEventListener('change', saveSettings);
  showPlayerButtonToggle.addEventListener('change', saveSettings);
  showInlinePillToggle.addEventListener('change', saveSettings);
  enableAltSToggle.addEventListener('change', saveSettings);

  defaultTabGroup.querySelectorAll('.pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      defaultTabGroup.querySelectorAll('.pill-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      saveSettings();
    });
  });

  sidebarWidthSlider.addEventListener('input', () => {
    valSidebarWidth.textContent = `${sidebarWidthSlider.value}px`;
    updateSummaries();
  });
  sidebarWidthSlider.addEventListener('change', saveSettings);

  resetDefaultsBtn.addEventListener('click', async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' });
      if (resp?.ok && resp.settings) {
        settings = { ...resp.settings };
      } else {
        settings = { ...DEFAULT_SETTINGS };
        await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      }
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
    renderSettingsUI();
    await refreshActiveTabStatus();
  });

  // Initialize
  await loadSettings();
  renderSettingsUI();
  await refreshActiveTabStatus();
});
