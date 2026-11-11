/**
 * TheaterSplit — YouTube Theater Split View (Video Left + Comments Right)
 * Developed by sinary.org
 */
(() => {
  if (window.__sinaryYtTheaterSplitLoaded) return;
  window.__sinaryYtTheaterSplitLoaded = true;

  if (!window.location) return;
  const host = (window.location.hostname || '').toLowerCase();
  const isLocalTestHarness =
    document.documentElement?.dataset?.sinaryYtTest === 'watch' &&
    (window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1');
  if (!isLocalTestHarness && host !== 'www.youtube.com' && host !== 'youtube.com') return;

  const SETTINGS_KEY = 'theaterSplitSettings';
  const LOCAL_PREF_KEY = '__sinary_yt_theater_split';

  const BTN_ID = 'sinary-yt-split-btn';
  const INLINE_BTN_ID = 'sinary-yt-inline-open-btn';
  const PANEL_ID = 'sinary-yt-split-panel';
  const HEADER_ID = 'sinary-yt-split-header';
  const SCROLL_ID = 'sinary-yt-comments-scroll';
  const ANCHOR_ID = 'sinary-yt-comments-anchor';

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

  let settings = { ...DEFAULT_SETTINGS };
  let isSplitActive = false;
  let activeTab = 'comments'; // 'comments' | 'related'
  let flexyObserver = null;
  let ensureTimer = null;
  let resizeTimer = null;
  let observerTimer = null;
  let lastSavedScrollY = null;
  let scrollGuardUntil = 0;
  let autoExitingTheater = false;
  let settingsLoaded = false;

  function isWatchPage() {
    if (isLocalTestHarness) return true;
    return window.location.pathname === '/watch';
  }

  function getLocalSplitPref() {
    try {
      return window.localStorage.getItem(LOCAL_PREF_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setLocalSplitPref(enabled) {
    try {
      window.localStorage.setItem(LOCAL_PREF_KEY, enabled ? '1' : '0');
    } catch {
      // Ignore restricted storage contexts
    }
  }

  async function persistSplitState(enabled) {
    setLocalSplitPref(enabled);
    settings.splitActive = !!enabled;
    try {
      if (chrome?.storage?.sync) {
        await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      }
    } catch {
      // Ignore transient storage errors
    }
  }

  function applySidebarWidthVar() {
    const width = Math.min(560, Math.max(340, Number(settings.sidebarWidth) || 420));
    document.documentElement.style.setProperty('--sinary-yt-sidebar-width', `${width}px`);
  }

  function hasOpenLiveChat(flexy) {
    if (!flexy) return false;
    const chatFrame = flexy.querySelector('#chat ytd-live-chat-frame');
    return !!(chatFrame && !chatFrame.hasAttribute('collapsed'));
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    return el;
  }

  function buildSplitIconSvg(size = '100%') {
    const svg = createSvgEl('svg', {
      height: size,
      width: size,
      viewBox: '0 0 36 36',
      fill: 'none'
    });

    svg.appendChild(createSvgEl('rect', {
      x: '7',
      y: '10',
      width: '22',
      height: '16',
      rx: '2.2',
      stroke: 'currentColor',
      'stroke-width': '2'
    }));

    svg.appendChild(createSvgEl('rect', {
      x: '20',
      y: '11',
      width: '8',
      height: '14',
      rx: '1',
      fill: 'currentColor',
      class: 'sinary-yt-split-pane-fill'
    }));

    svg.appendChild(createSvgEl('line', {
      x1: '20',
      y1: '10.5',
      x2: '20',
      y2: '25.5',
      stroke: 'currentColor',
      'stroke-width': '1.8'
    }));

    for (const y of ['14.5', '18', '21.5']) {
      svg.appendChild(createSvgEl('line', {
        x1: '22.3',
        y1: y,
        x2: '26.7',
        y2: y,
        stroke: 'currentColor',
        'stroke-width': '1.6',
        'stroke-linecap': 'round'
      }));
    }

    svg.appendChild(createSvgEl('rect', {
      x: '11',
      y: '28.5',
      width: '14',
      height: '2.2',
      rx: '1.1',
      class: 'sinary-yt-split-underline'
    }));

    return svg;
  }

  function dispatchPlayerResize() {
    clearTimeout(resizeTimer);
    window.dispatchEvent(new Event('resize'));
    resizeTimer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 220);
    }, 100);
  }

  function updateButtonsUI() {
    const btn = document.getElementById(BTN_ID);
    if (btn) {
      btn.classList.toggle('sinary-yt-split-btn-on', isSplitActive);
      btn.setAttribute('aria-pressed', isSplitActive ? 'true' : 'false');
      const shortcutHint = settings.enableAltS ? ' (Alt+S)' : '';
      btn.title = isSplitActive
        ? `Exit Theater Split View${shortcutHint}`
        : `Theater Split View — Comments beside video${shortcutHint}`;
    }

    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      const cBtn = panel.querySelector('[data-sinary-tab-btn="comments"]');
      const rBtn = panel.querySelector('[data-sinary-tab-btn="related"]');
      if (cBtn) cBtn.setAttribute('aria-selected', activeTab === 'comments' ? 'true' : 'false');
      if (rBtn) rBtn.setAttribute('aria-selected', activeTab === 'related' ? 'true' : 'false');
    }

    const secondaryInner = document.querySelector('ytd-watch-flexy #secondary-inner');
    if (secondaryInner) {
      if (isSplitActive) {
        secondaryInner.setAttribute('data-sinary-tab', activeTab);
      } else {
        secondaryInner.removeAttribute('data-sinary-tab');
      }
    }
  }

  function nudgeCommentsLoad() {
    const scrollEl = document.getElementById(SCROLL_ID);
    const comments = scrollEl && scrollEl.querySelector('ytd-comments#comments');
    if (!comments) return;

    setTimeout(() => {
      try {
        window.dispatchEvent(new Event('scroll'));
        window.dispatchEvent(new Event('resize'));
      } catch {
        // Ignore synthetic event restrictions
      }
    }, 120);
  }

  function setActiveSidebarTab(tab) {
    activeTab = tab === 'related' ? 'related' : 'comments';
    updateButtonsUI();
    if (activeTab === 'comments') {
      nudgeCommentsLoad();
    }
  }

  function ensureSplitPanel(secondaryInner) {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      if (panel.parentElement !== secondaryInner) {
        secondaryInner.insertBefore(panel, secondaryInner.firstChild);
      }
      return panel;
    }

    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'sinary-yt-split-panel';

    const header = document.createElement('div');
    header.id = HEADER_ID;

    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'sinary-yt-tabs';
    tabsWrap.setAttribute('role', 'tablist');
    tabsWrap.setAttribute('aria-label', 'Sidebar view');

    const commentsTabBtn = document.createElement('button');
    commentsTabBtn.type = 'button';
    commentsTabBtn.className = 'sinary-yt-tab-btn';
    commentsTabBtn.setAttribute('role', 'tab');
    commentsTabBtn.setAttribute('aria-selected', activeTab === 'comments' ? 'true' : 'false');
    commentsTabBtn.setAttribute('data-sinary-tab-btn', 'comments');
    commentsTabBtn.textContent = 'Comments';
    commentsTabBtn.addEventListener('click', () => setActiveSidebarTab('comments'));

    const relatedTabBtn = document.createElement('button');
    relatedTabBtn.type = 'button';
    relatedTabBtn.className = 'sinary-yt-tab-btn';
    relatedTabBtn.setAttribute('role', 'tab');
    relatedTabBtn.setAttribute('aria-selected', activeTab === 'related' ? 'true' : 'false');
    relatedTabBtn.setAttribute('data-sinary-tab-btn', 'related');
    relatedTabBtn.textContent = 'Up Next';
    relatedTabBtn.addEventListener('click', () => setActiveSidebarTab('related'));

    tabsWrap.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = activeTab === 'comments' ? 'related' : 'comments';
      setActiveSidebarTab(next);
      const targetBtn = next === 'comments' ? commentsTabBtn : relatedTabBtn;
      targetBtn.focus();
    });

    tabsWrap.appendChild(commentsTabBtn);
    tabsWrap.appendChild(relatedTabBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'sinary-yt-close-btn';
    closeBtn.title = settings.enableAltS ? 'Exit Theater Split View (Alt+S)' : 'Exit Theater Split View';
    closeBtn.setAttribute('aria-label', 'Exit Theater Split View');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => setSplitEnabled(false, true));

    header.appendChild(tabsWrap);
    header.appendChild(closeBtn);

    const scrollBox = document.createElement('div');
    scrollBox.id = SCROLL_ID;

    // Relay internal scroll events so YouTube's infinite comments continuation triggers reliably
    let scrollTick = false;
    scrollBox.addEventListener('scroll', () => {
      if (scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        scrollTick = false;
        window.dispatchEvent(new Event('scroll'));
      });
    }, { passive: true });

    // Prevent YouTube's timestamp-click handler from scrolling the whole window back up
    scrollBox.addEventListener('click', (e) => {
      const link = e.target && e.target.closest ? e.target.closest('a[href*="t="]') : null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!/[?&]t=\d+/.test(href)) return;
      lastSavedScrollY = window.scrollY;
      scrollGuardUntil = Date.now() + 300;
    }, true);

    panel.appendChild(header);
    panel.appendChild(scrollBox);
    secondaryInner.insertBefore(panel, secondaryInner.firstChild);
    return panel;
  }

  function restoreComments(removePanel = true) {
    isSplitActive = false;
    document.documentElement.classList.remove('sinary-yt-split-active');

    const flexy = document.querySelector('ytd-watch-flexy');
    if (flexy) {
      flexy.classList.remove('sinary-yt-split-active');
    }

    const scrollBox = document.getElementById(SCROLL_ID);
    const comments = (scrollBox && scrollBox.querySelector('ytd-comments#comments')) || document.querySelector('ytd-comments#comments');
    const anchor = document.getElementById(ANCHOR_ID);

    if (comments && anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(comments, anchor);
      anchor.remove();
    } else if (comments && scrollBox && scrollBox.contains(comments)) {
      const below = document.querySelector('ytd-watch-flexy #below');
      if (below) below.appendChild(comments);
      if (anchor) anchor.remove();
    } else if (anchor) {
      anchor.remove();
    }

    if (removePanel) {
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.remove();
    }

    updateButtonsUI();
    dispatchPlayerResize();
  }

  function removeInjectedButtons() {
    const playerBtn = document.getElementById(BTN_ID);
    if (playerBtn) playerBtn.remove();
    const inlineBtn = document.getElementById(INLINE_BTN_ID);
    if (inlineBtn) inlineBtn.remove();
  }

  function watchFlexyAttributes(flexy) {
    if (!flexy) return;
    if (flexyObserver) {
      if (flexyObserver._target === flexy) return;
      flexyObserver.disconnect();
    }
    flexyObserver = new MutationObserver(() => {
      if (!isSplitActive || autoExitingTheater) return;
      // If user explicitly switched back to YouTube full-width Theater mode, exit Split cleanly
      if (flexy.hasAttribute('theater')) {
        setSplitEnabled(false, true);
      }
    });
    flexyObserver._target = flexy;
    flexyObserver.observe(flexy, { attributes: true, attributeFilter: ['theater'] });
  }

  function dockComments() {
    if (!settings.enabled || !isWatchPage()) return false;
    const flexy = document.querySelector('ytd-watch-flexy');
    const secondaryInner = flexy && flexy.querySelector('#secondary-inner');
    const comments = flexy && flexy.querySelector('ytd-comments#comments');
    if (!flexy || !secondaryInner || !comments) return false;

    // Exit native YouTube full-bleed theater mode so video aligns left in #primary
    if (flexy.hasAttribute('theater')) {
      const sizeBtn = document.querySelector('#movie_player .ytp-size-button');
      if (sizeBtn) {
        autoExitingTheater = true;
        sizeBtn.click();
        setTimeout(() => {
          autoExitingTheater = false;
          if (isSplitActive) dockComments();
        }, 90);
        return true;
      }
    }

    applySidebarWidthVar();
    const panel = ensureSplitPanel(secondaryInner);
    const scrollBox = panel.querySelector('#' + SCROLL_ID);

    if (scrollBox && comments.parentElement !== scrollBox) {
      let anchor = document.getElementById(ANCHOR_ID);
      if (!anchor && comments.parentNode) {
        anchor = document.createElement('div');
        anchor.id = ANCHOR_ID;
        anchor.style.display = 'none';
        comments.parentNode.insertBefore(anchor, comments);
      }
      scrollBox.appendChild(comments);
    }

    document.documentElement.classList.add('sinary-yt-split-active');
    flexy.classList.add('sinary-yt-split-active');
    watchFlexyAttributes(flexy);
    updateButtonsUI();
    dispatchPlayerResize();
    nudgeCommentsLoad();
    return true;
  }

  function setSplitEnabled(enabled, persist = true) {
    if (!settings.enabled && enabled) {
      return;
    }

    if (persist) {
      persistSplitState(enabled);
    }

    if (!enabled || !isWatchPage()) {
      restoreComments(true);
      return;
    }

    isSplitActive = true;
    activeTab = settings.defaultTab === 'related' ? 'related' : 'comments';
    if (!dockComments()) {
      scheduleEnsure();
    }
  }

  function ensurePlayerButton() {
    if (!settings.enabled || !settings.showPlayerButton) {
      const existing = document.getElementById(BTN_ID);
      if (existing) existing.remove();
      return;
    }
    if (!isWatchPage()) return;

    const player = document.querySelector('#movie_player');
    if (!player) return;

    const sizeBtn = player.querySelector('.ytp-right-controls .ytp-size-button') || player.querySelector('.ytp-size-button');
    const rightControls = (sizeBtn && sizeBtn.parentElement) || player.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    if (document.getElementById(BTN_ID)) {
      updateButtonsUI();
      return;
    }

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'ytp-button sinary-yt-split-btn';
    btn.setAttribute('aria-label', 'Theater Split View');
    btn.appendChild(buildSplitIconSvg('100%'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSplitEnabled(!isSplitActive, true);
    });

    if (sizeBtn && sizeBtn.parentElement === rightControls) {
      rightControls.insertBefore(btn, sizeBtn);
    } else {
      rightControls.insertBefore(btn, rightControls.firstChild);
    }
    updateButtonsUI();
  }

  function ensureInlineCommentsButton() {
    if (!settings.enabled || !settings.showInlinePill) {
      const existing = document.getElementById(INLINE_BTN_ID);
      if (existing) existing.remove();
      return;
    }
    if (!isWatchPage() || isSplitActive) return;

    const titleEl = document.querySelector('ytd-comments#comments ytd-comments-header-renderer #title');
    if (!titleEl || document.getElementById(INLINE_BTN_ID)) return;

    const chip = document.createElement('button');
    chip.id = INLINE_BTN_ID;
    chip.type = 'button';
    chip.title = settings.enableAltS ? 'Move comments beside video (Alt+S)' : 'Move comments beside video';

    const iconWrap = createSvgEl('svg', { width: '16', height: '16', viewBox: '0 0 36 36', fill: 'none' });
    iconWrap.appendChild(createSvgEl('rect', {
      x: '4', y: '8', width: '28', height: '20', rx: '3',
      stroke: 'currentColor', 'stroke-width': '2.4'
    }));
    iconWrap.appendChild(createSvgEl('line', {
      x1: '20', y1: '9', x2: '20', y2: '27',
      stroke: 'currentColor', 'stroke-width': '2.2'
    }));

    const label = document.createElement('span');
    label.textContent = 'Split beside video';

    chip.appendChild(iconWrap);
    chip.appendChild(label);
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      setSplitEnabled(true, true);
    });

    titleEl.appendChild(chip);
  }

  function syncWatchPageState() {
    if (!settings.enabled) {
      if (isSplitActive) restoreComments(true);
      removeInjectedButtons();
      return;
    }

    if (!isWatchPage()) {
      if (isSplitActive) restoreComments(true);
      return;
    }

    applySidebarWidthVar();
    ensurePlayerButton();
    ensureInlineCommentsButton();

    const flexy = document.querySelector('ytd-watch-flexy');
    const shouldAutoOpen = settings.rememberSplitState && (settingsLoaded ? settings.splitActive : getLocalSplitPref());
    const blockedByLive = settings.skipLiveStreams && hasOpenLiveChat(flexy);

    if (isSplitActive) {
      dockComments();
    } else if (shouldAutoOpen && flexy && !blockedByLive) {
      isSplitActive = true;
      activeTab = settings.defaultTab === 'related' ? 'related' : 'comments';
      dockComments();
    }
  }

  function scheduleEnsure() {
    clearTimeout(ensureTimer);
    if (!settings.enabled || !isWatchPage()) {
      syncWatchPageState();
      return;
    }

    let attempts = 0;
    const tick = () => {
      attempts++;
      syncWatchPageState();
      const needsBtn = settings.showPlayerButton && !document.getElementById(BTN_ID);
      const needsDock = isSplitActive && !document.querySelector(`#${SCROLL_ID} ytd-comments#comments`);
      if ((needsBtn || needsDock) && attempts < 20 && isWatchPage() && settings.enabled) {
        ensureTimer = setTimeout(tick, 250);
      }
    };
    ensureTimer = setTimeout(tick, 120);
  }

  function applySettingsUpdate(nextSettings) {
    const prevDefaultTab = settings.defaultTab;
    settings = { ...DEFAULT_SETTINGS, ...(nextSettings || {}) };
    settingsLoaded = true;
    applySidebarWidthVar();

    if (!settings.enabled) {
      restoreComments(true);
      removeInjectedButtons();
      return;
    }

    if (isSplitActive && nextSettings && nextSettings.defaultTab && nextSettings.defaultTab !== prevDefaultTab) {
      activeTab = nextSettings.defaultTab === 'related' ? 'related' : 'comments';
    }

    ensurePlayerButton();
    ensureInlineCommentsButton();
    updateButtonsUI();
    if (isWatchPage()) {
      scheduleEnsure();
    }
  }

  async function loadInitialSettings() {
    try {
      if (chrome?.storage?.sync) {
        const data = await chrome.storage.sync.get(SETTINGS_KEY);
        if (data && data[SETTINGS_KEY]) {
          settings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
        }
      }
    } catch {
      // Fallback to defaults if storage unavailable
    } finally {
      settingsLoaded = true;
      applySidebarWidthVar();
      scheduleEnsure();
    }
  }

  // Listen to storage changes across popup/tabs
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync' || !changes[SETTINGS_KEY]) return;
      applySettingsUpdate(changes[SETTINGS_KEY].newValue);
    });
  } catch {
    // Ignore if unavailable
  }

  // Listen to messages from popup or background service worker
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message.type !== 'string') return false;

      if (message.type === 'PING_THEATER_SPLIT') {
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === 'THEATER_SPLIT_SETTINGS_CHANGED') {
        applySettingsUpdate(message.settings);
        sendResponse({ ok: true });
        return false;
      }

      if (message.type === 'GET_SPLIT_STATUS') {
        const flexy = document.querySelector('ytd-watch-flexy');
        sendResponse({
          ok: true,
          isWatchPage: isWatchPage(),
          isSplitActive,
          activeTab,
          hasLiveChat: hasOpenLiveChat(flexy)
        });
        return false;
      }

      if (message.type === 'TOGGLE_SPLIT_VIEW') {
        if (!isWatchPage()) {
          sendResponse({ ok: false, isWatchPage: false, isSplitActive: false });
          return false;
        }
        if (!settings.enabled) {
          settings.enabled = true;
          persistSplitState(true);
        }
        const targetState = typeof message.forceState === 'boolean' ? message.forceState : !isSplitActive;
        setSplitEnabled(targetState, true);
        const flexy = document.querySelector('ytd-watch-flexy');
        sendResponse({
          ok: true,
          isWatchPage: true,
          isSplitActive,
          hasLiveChat: hasOpenLiveChat(flexy)
        });
        return false;
      }

      return false;
    });
  } catch {
    // Ignore if runtime messaging unavailable
  }

  // Keep page scroll steady when clicking comment timestamps while Split Mode is open
  window.addEventListener('scroll', () => {
    if (isSplitActive && lastSavedScrollY !== null && Date.now() < scrollGuardUntil) {
      if (Math.abs(window.scrollY - lastSavedScrollY) > 4) {
        window.scrollTo({ top: lastSavedScrollY, behavior: 'instant' });
      }
    } else if (Date.now() >= scrollGuardUntil) {
      lastSavedScrollY = null;
    }
  }, { passive: true });

  // In-page shortcut: Alt+S toggles Theater Split View on YouTube watch pages
  window.addEventListener('keydown', (e) => {
    if (!settings.enabled || !settings.enableAltS || !isWatchPage()) return;
    if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
    if (e.key !== 's' && e.key !== 'S' && e.code !== 'KeyS') return;
    const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) return;

    e.preventDefault();
    e.stopPropagation();
    setSplitEnabled(!isSplitActive, true);
  }, true);

  window.addEventListener('yt-navigate-start', () => {
    clearTimeout(ensureTimer);
    if (isSplitActive) {
      restoreComments(true);
    }
  });

  window.addEventListener('yt-navigate-finish', () => {
    scheduleEnsure();
  });

  window.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isSplitActive) {
      dispatchPlayerResize();
    }
  });

  // Lightweight throttled observer for dynamic player/comments mounting on initial load
  const domObserver = new MutationObserver(() => {
    if (!settings.enabled || !isWatchPage() || observerTimer) return;
    const missingPlayerBtn = settings.showPlayerButton && !document.getElementById(BTN_ID);
    const missingInlineBtn = settings.showInlinePill && !isSplitActive && !document.getElementById(INLINE_BTN_ID);
    if (missingPlayerBtn || missingInlineBtn) {
      observerTimer = setTimeout(() => {
        observerTimer = null;
        syncWatchPageState();
      }, 250);
    }
  });

  function startObserver() {
    const rootTarget = document.body || document.documentElement;
    if (rootTarget) {
      domObserver.observe(rootTarget, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      loadInitialSettings();
    });
  } else {
    startObserver();
    loadInitialSettings();
  }
})();
