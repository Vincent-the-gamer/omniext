import type { FeatureRuntime } from '@/features/types';
import { isValidLocale, localeItem, readLocale, translate, type Locale } from '@/utils/i18n';

const GITHUB_HOST = 'github.com';
const BUTTON_ID = 'oe-gh-folder-download';
const BUTTON_CLASS = 'oe-gh-folder-download';
const SYNC_INTERVAL_MS = 400;
const DOWNLOAD_SERVICE = 'https://download-directory.github.io/';

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

  let button: HTMLButtonElement | null = null;
  let syncTimer: number | null = null;
  let unwatchLocale: (() => void) | null = null;

  function ensureStyles(): void {
    if (document.getElementById(`${BUTTON_ID}-style`) !== null) return;

    const style = document.createElement('style');
    style.id = `${BUTTON_ID}-style`;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border: none;
        border-radius: 50%;
        background: #0969da;
        color: #ffffff;
        font-size: 22px;
        line-height: 1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        user-select: none;
        transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
      }
      #${BUTTON_ID}:hover {
        background: #0550ae;
        transform: translateY(-2px);
      }
      #${BUTTON_ID}:active {
        transform: translateY(0);
      }
      #${BUTTON_ID}[data-hidden="true"] {
        opacity: 0;
        pointer-events: none;
        transform: scale(0.9);
      }
      #${BUTTON_ID} .oe-gh-label {
        position: absolute;
        right: 56px;
        top: 50%;
        transform: translateY(-50%);
        white-space: nowrap;
        background: rgba(0, 0, 0, 0.8);
        color: #ffffff;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease;
      }
      #${BUTTON_ID}:hover .oe-gh-label {
        opacity: 1;
      }
    `;
    (document.head ?? document.documentElement).append(style);
  }

  function createButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = BUTTON_CLASS;
    btn.type = 'button';
    btn.setAttribute('aria-label', translate(locale, 'gh-folder-download'));
    btn.title = translate(locale, 'gh-folder-download');

    const icon = document.createElement('span');
    icon.textContent = '📥';
    btn.append(icon);

    const label = document.createElement('span');
    label.className = 'oe-gh-label';
    label.textContent = translate(locale, 'gh-folder-download');
    btn.append(label);

    btn.addEventListener('click', () => {
      const url = `${DOWNLOAD_SERVICE}?url=${encodeURIComponent(location.href)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
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
      // 保留节点以便快速复用，但隐藏；离开页面时再移除。
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

      unwatchLocale?.();
      unwatchLocale = null;
    },
  };
}
