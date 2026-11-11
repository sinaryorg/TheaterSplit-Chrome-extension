# Chrome Web Store & Edge Add-ons Listing — TheaterSplit — by Sinary

> Last Updated: 2026-11-11

## Store Listing

**Extension Name**
TheaterSplit — by Sinary

**Short Description**
Watch YouTube videos on the left while reading and scrolling comments on the right in a clean Theater Split View.

**Detailed Description**
TheaterSplit brings side-by-side video and comment viewing to regular YouTube videos in Google Chrome and Microsoft Edge, inspired by YouTube's live-stream sidebar layout.

Key Features
- Video Left, Comments Right: Keep the video player anchored on the left while reading, replying, and scrolling through comments in a dedicated right-hand panel.
- Native Player Bar Button & Comments Quick Pill: Toggle Theater Split View directly from YouTube's bottom-right player bar (beside Theater Mode) or via the "Split beside video" pill above the comments header.
- Comments / Up Next Switcher: Switch cleanly between Comments and Up Next recommendations inside the right sidebar, or close Split View with one click.
- Smart Timestamp Seeking: Click timestamps inside comments (such as 04:12) to jump the video without losing your place in the comment thread.
- Automatic Edge-Case Handling: Remembers your split preference across regular videos, automatically preserves native Live Chat on active livestreams, and exits cleanly when switching to Fullscreen or Theater Mode.
- Customizable Sidebar Width & Shortcuts: Resize the comments sidebar (340px–560px) from the toolbar popup and toggle instantly with Alt + S (in-page) or Alt + Shift + S (global shortcut).

How to Use It
1. Open any regular video on YouTube (youtube.com/watch).
2. Click the new Split View icon in the YouTube player bar, click "Split beside video" next to Comments, or press Alt + S.
3. Use the Comments / Up Next tabs at the top of the right panel, or click the TheaterSplit toolbar icon to customize width and behavior.

Privacy & Permissions
TheaterSplit runs 100% locally in your browser on YouTube pages only. It never collects, logs, or transmits watch history, comments, or personal data.

Support & Source Code
https://github.com/sinaryorg/TheaterSplit---Chrome-extension
https://sinary.org

**Category**
Productivity

**Single Purpose**
Displays YouTube video comments in a scrollable side-by-side panel next to the video player on YouTube watch pages.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Screenshot 1 | Live YouTube Comments Split | ✅ Ready | `assets/preview-comments.jpg` |
| Screenshot 2 | Live YouTube Up Next Switcher | ✅ Ready | `assets/preview-up-next.jpg` |
| Screenshot 3 | Extension Settings Popup | ✅ Ready | `assets/settings-popup.png` |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Stores and syncs the user's local TheaterSplit preferences (panel width, default sidebar tab, auto-remember toggle, live chat skip, and shortcut toggle) via `chrome.storage.sync`. |
| `scripting` | permissions | Injects TheaterSplit styles and controls into already-open YouTube tabs right after installation or when invoked from a keyboard shortcut so users do not have to reload open video tabs manually. |
| `https://www.youtube.com/*`, `https://youtube.com/*` | host_permissions | Scoped strictly to YouTube so the extension can place the player bar toggle button and rearrange the YouTube watch page layout into a side-by-side split view. |

## Privacy & Data Use

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
`https://github.com/sinaryorg/TheaterSplit---Chrome-extension/blob/main/PRIVACY_POLICY.md`

## Distribution

**Visibility**: Public  
**Regions**: All regions

## Developer Info

**Publisher Name**: sinary.org  
**Support URL**: https://github.com/sinaryorg/TheaterSplit---Chrome-extension/issues  
**Homepage URL**: https://sinary.org

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-11-11 | Initial release for Google Chrome and Microsoft Edge featuring YouTube Theater Split View (Video Left + Comments Right), Comments/Up Next switcher, timestamp scroll guard, and popup customization. | Draft |
