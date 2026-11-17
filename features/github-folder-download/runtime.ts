import type { FeatureRuntime } from '@/features/types';
import { isValidLocale, localeItem, readLocale, translate, type Locale } from '@/utils/i18n';

const GITHUB_HOST = 'github.com';
const BUTTON_ID = 'oe-gh-folder-download';
const BUTTON_CLASS = 'oe-gh-folder-download';
const SYNC_INTERVAL_MS = 400;
const DOWNLOAD_SERVICE = 'https://download-directory.github.io/';

const FOLDER_DOWN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m15 13-3 3-3-3"/></svg>`;

/** 判断当前地址是否为仓库的文件夹视图（`/owner/repo/tree/…`）。 */
function isFolderView(): boolean {
  if (location.hostname !== GITHUB_HOST) return false;

  const parts = location.pathname.split('/').filter(Boolean);
  // 至少 owner / repo / tree / ref
  if (parts.length < 4) return false;
  if (parts[2] !== 'tree') return false;

  return true;
}

/** 顶层框架才挂按钮，避免 iframe 里重复出现。 */
function isTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

export function createGitHubFolderDownloadRuntime(): FeatureRuntime {
  let active = false;
  let locale: Locale = 'en';

  let downloadFrame: HTMLIFrameElement | null = null;
  let downloadTimer: number | null = null;

  let button: HTMLButtonElement | null = null;
  let syncTimer: number | null = null;
  let unwatchLocale: (() => void) | null = null;

  function triggerDownload(): void {
    // 复用上一次的隐藏 iframe，避免连续点击堆积多个下载任务。
    if (downloadFrame !== null) {
      downloadFrame.remove();
      downloadFrame = null;
    }
    if (downloadTimer !== null) {
      window.clearTimeout(downloadTimer);
      downloadTimer = null;
    }

    const frame = document.createElement('iframe');
    frame.src = `${DOWNLOAD_SERVICE}?url=${encodeURIComponent(location.href)}`;
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    (document.body ?? document.documentElement).append(frame);
    downloadFrame = frame;

    // 服务端在浏览器里抓取并打包，耗时不定；给足时间后再清理。
    downloadTimer = window.setTimeout(() => {
      frame.remove();
      if (downloadFrame === frame) downloadFrame = null;
      downloadTimer = null;
    }, 90000);
  }

  function ensureStyles(): void {
    if (document.getElementById(`${BUTTON_ID}-style`) !== null) return;

    const style = document.createElement('style');
    style.id = `${BUTTON_ID}-style`;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 40px;
        padding: 0 16px;
        border: 1px solid transparent;
        border-radius: 12px;
        background: #00dc82;
        color: #041611;
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
        cursor: pointer;
        user-select: none;
        transition: background 160ms ease, transform 120ms ease, opacity 120ms ease, box-shadow 160ms ease;
      }
      #${BUTTON_ID}:hover {
        background: #2fe89d;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.32);
      }
      #${BUTTON_ID}:active {
        transform: translateY(0);
      }
      #${BUTTON_ID}:focus-visible {
        outline: 2px solid #00dc82;
        outline-offset: 2px;
      }
      #${BUTTON_ID}[data-hidden="true"] {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.96);
      }
      #${BUTTON_ID} svg {
        flex: 0 0 auto;
      }
      #${BUTTON_ID} .oe-gh-label {
        display: inline-block;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  }

  function createButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = BUTTON_CLASS;
    btn.type = 'button';

    const text = translate(locale, 'gh-folder-download');
    btn.setAttribute('aria-label', text);
    btn.title = text;

    const icon = document.createElement('span');
    icon.innerHTML = FOLDER_DOWN_ICON;
    btn.append(icon);

    const label = document.createElement('span');
    label.className = 'oe-gh-label';
    label.textContent = text;
    btn.append(label);

    btn.addEventListener('click', () => {
      triggerDownload();
    });

    return btn;
  }

  function applyLocaleToButton(): void {
    if (button === null) return;

    const text = translate(locale, 'gh-folder-download');
    button.setAttribute('aria-label', text);
    button.title = text;

    const label = button.querySelector<HTMLElement>('.oe-gh-label');
    if (label !== null) label.textContent = text;
  }

  function removeButton(): void {
    button?.remove();
    button = null;
  }

  function sync(): void {
    if (!active || !isTopFrame()) return;

    if (!isFolderView()) {
      if (button !== null) button.setAttribute('data-hidden', 'true');
      return;
    }

    if (button === null) {
      ensureStyles();
      button = createButton();
      (document.body ?? document.documentElement).append(button);
    } else if (!button.isConnected) {
      (document.body ?? document.documentElement).append(button);
    }

    button.removeAttribute('data-hidden');
    applyLocaleToButton();
  }

  function startSyncLoop(): void {
    if (syncTimer !== null) return;
    syncTimer = window.setInterval(sync, SYNC_INTERVAL_MS);
    sync();
  }

  function stopSyncLoop(): void {
    if (syncTimer !== null) {
      window.clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  return {
    activate() {
      if (active) return;
      if (!isTopFrame()) return;

      active = true;
      ensureStyles();
      startSyncLoop();

      void readLocale().then((value) => {
        if (!active) return;
        locale = value;
        applyLocaleToButton();
      });

      unwatchLocale = localeItem.watch((value) => {
        if (!active || !isValidLocale(value)) return;
        locale = value;
        applyLocaleToButton();
      });
    },
    deactivate() {
      if (!active) return;
      active = false;
      stopSyncLoop();
      removeButton();
      if (downloadFrame !== null) {
        downloadFrame.remove();
        downloadFrame = null;
      }
      if (downloadTimer !== null) {
        window.clearTimeout(downloadTimer);
        downloadTimer = null;
      }

      unwatchLocale?.();
      unwatchLocale = null;
    },
  };
}
