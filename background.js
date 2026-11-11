// TheaterSplit — Background Service Worker (Manifest V3)
// Developed by sinary.org

const SETTINGS_KEY = 'theaterSplitSettings';

const DEFAULT_SETTINGS = {
  enabled: true,
  rememberSplitState: true,
  splitActive: false,
  defaultTab: 'comments', // 'comments' | 'related'
  sidebarWidth: 420,      // 340 - 560 px
  showPlayerButton: true,
  showInlinePill: true,
  skipLiveStreams: true,
  enableAltS: true
};

function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'www.youtube.com' || host === 'youtube.com');
  } catch {
    return false;
  }
}

function isYouTubeWatchUrl(url) {
  if (!isYouTubeUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/watch';
  } catch {
    return false;
  }
}

async function getMergedSettings() {
  try {
    const data = await chrome.storage.sync.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(data?.[SETTINGS_KEY] || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveMergedSettings(partialOrFull) {
  const current = await getMergedSettings();
  const next = { ...current, ...partialOrFull };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

async function broadcastToYouTubeTabs(message) {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://www.youtube.com/*', 'https://youtube.com/*']
    });
    await Promise.allSettled(
      tabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) => chrome.tabs.sendMessage(tab.id, message))
    );
  } catch {
    // Ignore tabs without active receivers
  }
}

async function ensureInjected(tabId) {
  try {
    const status = await chrome.tabs.sendMessage(tabId, { type: 'PING_THEATER_SPLIT' });
    if (status && status.ok) return true;
  } catch {
    // Content script not injected yet on pre-existing tab
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    return true;
  } catch {
    return false;
  }
}

async function injectIntoOpenYouTubeTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: ['https://www.youtube.com/*', 'https://youtube.com/*']
    });
    await Promise.allSettled(
      tabs
        .filter((tab) => typeof tab.id === 'number' && !tab.discarded)
        .map((tab) => ensureInjected(tab.id))
    );
  } catch {
    // Best-effort injection for already-open tabs
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const merged = await getMergedSettings();
    await chrome.storage.sync.set({ [SETTINGS_KEY]: merged });
  } catch {
    // Storage write fallback handled gracefully
  }
  await injectIntoOpenYouTubeTabs();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-theater-split') return;
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || typeof activeTab.id !== 'number' || !isYouTubeWatchUrl(activeTab.url)) {
      return;
    }
    const ready = await ensureInjected(activeTab.id);
    if (!ready) return;
    await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_SPLIT_VIEW' });
  } catch {
    // Ignore errors if tab navigated away
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'GET_SETTINGS') {
    (async () => {
      const settings = await getMergedSettings();
      sendResponse({ ok: true, settings });
    })();
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    (async () => {
      try {
        const settings = await saveMergedSettings(message.settings || {});
        await broadcastToYouTubeTabs({
          type: 'THEATER_SPLIT_SETTINGS_CHANGED',
          settings
        });
        sendResponse({ ok: true, settings });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Failed to save settings' });
      }
    })();
    return true;
  }

  if (message.type === 'RESET_SETTINGS') {
    (async () => {
      try {
        await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
        await broadcastToYouTubeTabs({
          type: 'THEATER_SPLIT_SETTINGS_CHANGED',
          settings: DEFAULT_SETTINGS
        });
        sendResponse({ ok: true, settings: DEFAULT_SETTINGS });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Failed to reset settings' });
      }
    })();
    return true;
  }

  if (message.type === 'GET_ACTIVE_TAB_STATUS') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || typeof activeTab.id !== 'number') {
          sendResponse({ ok: true, isYouTube: false, isWatchPage: false });
          return;
        }
        const isYouTube = isYouTubeUrl(activeTab.url);
        const isWatchPage = isYouTubeWatchUrl(activeTab.url);
        if (!isYouTube) {
          sendResponse({ ok: true, isYouTube: false, isWatchPage: false });
          return;
        }

        const ready = await ensureInjected(activeTab.id);
        if (!ready) {
          sendResponse({
            ok: true,
            isYouTube: true,
            isWatchPage,
            injected: false,
            isSplitActive: false
          });
          return;
        }

        try {
          const status = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SPLIT_STATUS' });
          sendResponse({
            ok: true,
            isYouTube: true,
            isWatchPage: status?.isWatchPage ?? isWatchPage,
            injected: true,
            isSplitActive: !!status?.isSplitActive,
            activeTab: status?.activeTab || 'comments',
            hasLiveChat: !!status?.hasLiveChat
          });
        } catch {
          sendResponse({
            ok: true,
            isYouTube: true,
            isWatchPage,
            injected: false,
            isSplitActive: false
          });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Status lookup failed' });
      }
    })();
    return true;
  }

  if (message.type === 'TOGGLE_ACTIVE_TAB_SPLIT') {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || typeof activeTab.id !== 'number' || !isYouTubeWatchUrl(activeTab.url)) {
          sendResponse({ ok: false, reason: 'Not a YouTube watch page' });
          return;
        }
        const ready = await ensureInjected(activeTab.id);
        if (!ready) {
          sendResponse({ ok: false, reason: 'Refresh the YouTube tab once to activate' });
          return;
        }
        const result = await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_SPLIT_VIEW' });
        sendResponse({
          ok: true,
          isSplitActive: !!result?.isSplitActive,
          isWatchPage: !!result?.isWatchPage,
          hasLiveChat: !!result?.hasLiveChat
        });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'Unable to toggle split view' });
      }
    })();
    return true;
  }

  return false;
});
