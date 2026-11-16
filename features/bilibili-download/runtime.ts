import { injectScript } from 'wxt/utils/inject-script';
import type { FeatureRuntime } from '@/features/types';
import { isValidLocale, localeItem, readLocale, type Locale } from '@/utils/i18n';
import {
  HOST_SOURCE,
  isPageEvent,
  PAGE_SOURCE,
  type HostCommand,
  type ScanResult,
  type StreamTrack,
} from './protocol';
import {
  createEntryButton,
  createPanel,
  ENTRY_ELEMENT_ID,
  type EntryHandle,
  type PanelHandle,
} from './view';

/** 只在 www.bilibili.com 下工作：其它子域名（player、m 站等）的页面结构不同，
 * 也不在本次支持的范围内。 */
const BILIBILI_HOST = 'www.bilibili.com';

/** 带播放器的页面；其它路径不插入按钮。 */
const PLAYER_PATHS = ['/video/', '/list/', '/bangumi/play/'] as const;

/**
 * 入口按钮的落点，按 B 站当前与历史版本的 DOM 依次尝试。
 * 都找不到时退回到整个工具栏容器，按钮会排在右侧。
 */
const TOOLBAR_SELECTORS = [
  '#arc_toolbar_report .video-toolbar-left',
  '.video-toolbar-left',
  '#arc_toolbar_report .left',
  '#arc_toolbar_report',
] as const;

/** 整行工具栏（包着左右两组按钮），定位时以它为准。 */
const TOOLBAR_ROW_SELECTORS = ['#arc_toolbar_report', '.video-toolbar', '.video-toolbar-container'] as const;

/** 与工具栏最右边留出的距离，避开它自己的「更多」按钮。 */
const TOOLBAR_RIGHT_GAP = 44;

/** 页面侧脚本没回应时的等待上限。 */
const SCAN_TIMEOUT_MS = 4000;

/** 面板与按钮之间的间距。 */
const PANEL_MARGIN = 8;

/**
 * 页面加载完成后，隔多久校对一次按钮与面板。
 *
 * 这里刻意不用 MutationObserver：B 站页面的弹幕、播放量会让 DOM 一直在变，
 * 全文档监听既费性能，又会在页面还在 hydration 时往它的容器里塞节点，
 * 很容易和它自己的渲染互相干扰。低频校对足以跟上 SPA 换页和重渲染。
 */
const SYNC_INTERVAL_MS = 1000;

/** 页面彻底加载完成后再等一小会儿，确保它的首屏渲染已经结束。 */
const MOUNT_DELAY_MS = 300;

export function createBilibiliDownloadRuntime(): FeatureRuntime {
  let active = false;
  let locale: Locale = 'en';

  let entry: EntryHandle | null = null;
  let panel: PanelHandle | null = null;
  let panelAnchor: HTMLElement | null = null;
  /** 面板打开时的地址，SPA 切到别的视频后据此关掉旧面板。 */
  let panelUrl = '';

  let syncTimer: number | null = null;
  let mountTimer: number | null = null;
  let onLoad: (() => void) | null = null;
  let detachPanelListeners: (() => void) | null = null;
  let unwatchLocale: (() => void) | null = null;

  let bridge: Promise<void> | null = null;
  let scanCounter = 0;
  let pendingScan: { requestId: string; timer: number; resolve(result: ScanResult): void } | null = null;

  function send(command: HostCommand): void {
    window.postMessage(command, '*');
  }

  /** 注入页面侧脚本；重复调用共用同一个 Promise。 */
  function ensureBridge(): Promise<void> {
    if (bridge === null) {
      bridge = injectScript('/bilibili-page.js').then(
        () => undefined,
        (error: unknown) => {
          // 注入失败（极少见）时允许下次重试
          bridge = null;
          throw error;
        },
      );
    }

    return bridge;
  }

  async function scan(): Promise<ScanResult> {
    try {
      await ensureBridge();
    } catch {
      return { ok: false, reason: 'no-playinfo' };
    }

    if (!active) return { ok: false, reason: 'no-playinfo' };

    const requestId = `scan-${(scanCounter += 1)}`;

    return new Promise<ScanResult>((resolve) => {
      const timer = window.setTimeout(() => {
        if (pendingScan?.requestId === requestId) pendingScan = null;
        resolve({ ok: false, reason: 'timeout' });
      }, SCAN_TIMEOUT_MS);

      pendingScan = { requestId, timer, resolve };
      send({ source: HOST_SOURCE, type: 'scan', requestId });
    });
  }

  function onPageEvent(event: MessageEvent): void {
    if (event.source !== window) return;
    if (!isPageEvent(event.data)) return;

    const message = event.data;

    if (message.type === 'snapshot') {
      if (pendingScan === null || pendingScan.requestId !== message.requestId) return;

      const { resolve, timer } = pendingScan;
      pendingScan = null;
      window.clearTimeout(timer);
      resolve(message.result);
      return;
    }

    if (panel === null) return;

    if (message.type === 'progress') {
      panel.setProgress(message.downloadId, message.received, message.total, message.stage);
      return;
    }

    if (message.type === 'finished') {
      panel.setFinished(message.downloadId);
      return;
    }

    panel.setFailed(message.downloadId, message.reason, message.detail);
  }

  function isSupportedPage(): boolean {
    if (location.hostname !== BILIBILI_HOST) return false;

    return PLAYER_PATHS.some((prefix) => location.pathname.startsWith(prefix));
  }

  function findToolbar(): HTMLElement | null {
    for (const selector of TOOLBAR_SELECTORS) {
      const node = document.querySelector<HTMLElement>(selector);
      if (node !== null) return node;
    }

    return null;
  }

  /** 包着左右两组按钮的整行容器，用它的最右边作为定位基准。 */
  function findToolbarRow(): HTMLElement | null {
    for (const selector of TOOLBAR_ROW_SELECTORS) {
      const node = document.querySelector<HTMLElement>(selector);
      if (node !== null) return node;
    }

    const leftGroup = document.querySelector<HTMLElement>('.video-toolbar-left');
    return leftGroup?.parentElement ?? findToolbar();
  }

  /**
   * 把入口按钮停到工具栏最右边。
   *
   * 按钮在自己的浮层里（不属于页面 DOM），所以用文档坐标定位：滚动时页面
   * 内容与按钮一起移动，不需要逐帧重算；布局变化由低频校对和 resize 事件跟上。
   *
   * B 站把点赞、分享、稿件举报这些操作都排在工具栏里，我们的节点不在它的
   * 层叠上下文里，只能靠位置避开 —— 所以统一贴在整行的最右侧。
   */
  function positionEntry(): void {
    if (entry === null) return;

    const row = findToolbarRow();
    if (row === null) return;

    const rect = row.getBoundingClientRect();
    const width = entry.element.offsetWidth;
    const height = entry.element.offsetHeight;

    const left = Math.max(rect.left, rect.right - width - TOOLBAR_RIGHT_GAP);
    const top = rect.top + (rect.height - height) / 2;

    entry.element.style.left = `${Math.round(left + window.scrollX)}px`;
    entry.element.style.top = `${Math.round(top + window.scrollY)}px`;
  }

  /** 面板贴着按钮显示；下方放不下时翻到按钮上方。 */
  function positionPanel(): void {
    if (panel === null || panelAnchor === null) return;

    const rect = panelAnchor.getBoundingClientRect();
    const width = panel.element.offsetWidth;
    const height = panel.element.offsetHeight;

    const left = Math.max(
      PANEL_MARGIN,
      Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN),
    );

    let top = rect.bottom + PANEL_MARGIN;
    if (top + height > window.innerHeight - PANEL_MARGIN && rect.top - PANEL_MARGIN - height > PANEL_MARGIN) {
      top = rect.top - PANEL_MARGIN - height;
    }

    panel.element.style.left = `${Math.round(left)}px`;
    panel.element.style.top = `${Math.round(Math.max(PANEL_MARGIN, top))}px`;
  }

  function startDownload(track: StreamTrack, audio: StreamTrack | null, filename: string): void {
    if (panel === null) return;

    // 立刻给出反馈，第一批数据到达后再显示百分比。
    panel.setProgress(track.id, 0, 0, 'download');
    send({
      source: HOST_SOURCE,
      type: 'download',
      downloadId: track.id,
      urls: [track.url, ...track.backup],
      audioUrls: audio === null ? [] : [audio.url, ...audio.backup],
      filename,
    });
  }

  function closePanel(): void {
    if (panel === null) return;

    panel.element.remove();
    panel = null;
    panelAnchor = null;
    panelUrl = '';
    entry?.setExpanded(false);

    detachPanelListeners?.();
    detachPanelListeners = null;
  }

  function attachPanelListeners(): void {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel?.element.contains(target)) return;
      if (entry?.element.contains(target)) return;

      closePanel();
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel();
    };

    const onViewportChange = (): void => positionPanel();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('scroll', onViewportChange, { capture: true, passive: true });

    detachPanelListeners = () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('scroll', onViewportChange, true);
    };
  }

  async function openPanel(anchor: HTMLElement): Promise<void> {
    if (panel !== null) return;

    panelAnchor = anchor;
    panelUrl = location.href;
    entry?.setExpanded(true);

    const handle = createPanel({
      locale,
      onClose: closePanel,
      onDownload: startDownload,
      onCancel: (track) => send({ source: HOST_SOURCE, type: 'cancel', downloadId: track.id }),
    });

    panel = handle;
    (document.body ?? document.documentElement).append(handle.element);
    handle.setLoading();
    positionPanel();
    attachPanelListeners();

    const result = await scan();
    // 等待期间面板可能已经关掉，或者是另一次打开的面板。
    if (panel !== handle) return;

    if (result.ok) handle.setSnapshot(result.snapshot);
    else handle.setFailure(result.reason);

    positionPanel();
  }

  function togglePanel(): void {
    if (panel !== null) {
      closePanel();
      return;
    }

    if (entry !== null) void openPanel(entry.element);
  }

  function removeEntry(): void {
    entry?.element.remove();
    entry = null;
  }

  /**
   * 清掉上一个实例留下的入口。
   *
   * 开发时经常出现「扩展重新加载了但页面还开着」：旧的内容脚本已经失去扩展
   * 上下文，它的按钮却还留在页面上，于是会看到两个下载按钮。这里在挂载前
   * 把旧的入口节点全部拿掉。
   */
  function removeStaleEntry(): void {
    const selectors = [`.oe-bili-entry`, `#${ENTRY_ELEMENT_ID}`].join(', ');

    for (const node of document.querySelectorAll<HTMLElement>(selectors)) {
      if (node.closest('.oe-bili-panel') !== null) continue;
      node.remove();
    }
  }

  /**
   * 让入口按钮和页面状态对齐：视频页且工具栏存在时贴上按钮，离开视频页时移除。
   * 由低频定时器驱动，不监听页面 DOM，也不会往页面自己的容器里插节点。
   */
  function sync(): void {
    if (!active) return;

    if (panel !== null && panelUrl !== location.href) {
      closePanel();
    }

    if (panel !== null && panelAnchor !== null && !panelAnchor.isConnected) {
      closePanel();
    }

    if (!isSupportedPage()) {
      removeEntry();
      return;
    }

    if (entry === null) {
      // 工具栏还没渲染出来时先不动，等下一轮校对
      if (findToolbar() === null) return;

      removeStaleEntry();
      entry = createEntryButton(locale, togglePanel);
      entry.applyLocale(locale);
      (document.body ?? document.documentElement).append(entry.element);
    } else if (!entry.element.isConnected) {
      (document.body ?? document.documentElement).append(entry.element);
    }

    positionEntry();
  }

  /** 页面加载完成后再开始校对，避免和 B 站首屏渲染抢 DOM。 */
  function startSyncLoop(): void {
    if (!active || syncTimer !== null) return;

    syncTimer = window.setInterval(sync, SYNC_INTERVAL_MS);
    sync();
  }

  function scheduleSyncLoop(): void {
    if (!active || syncTimer !== null || onLoad !== null || mountTimer !== null) return;

    const begin = (): void => {
      mountTimer = window.setTimeout(() => {
        mountTimer = null;
        startSyncLoop();
      }, MOUNT_DELAY_MS);
    };

    if (document.readyState === 'complete') {
      begin();
      return;
    }

    onLoad = begin;
    window.addEventListener('load', begin, { once: true });
  }

  function stopSyncLoop(): void {
    if (syncTimer !== null) {
      window.clearInterval(syncTimer);
      syncTimer = null;
    }

    if (mountTimer !== null) {
      window.clearTimeout(mountTimer);
      mountTimer = null;
    }

    if (onLoad !== null) {
      window.removeEventListener('load', onLoad);
      onLoad = null;
    }
  }

  return {
    activate() {
      if (active) return;
      // 只处理顶层框架：iframe 里的播放器由它自己所在页面的实例负责。
      if (window.top !== window) return;

      active = true;

      window.addEventListener('message', onPageEvent);
      window.addEventListener('resize', positionEntry);
      scheduleSyncLoop();

      void readLocale().then((value) => {
        if (!active) return;

        locale = value;
        entry?.applyLocale(locale);
        panel?.applyLocale(locale);
        positionPanel();
      });

      unwatchLocale = localeItem.watch((value) => {
        if (!active || !isValidLocale(value)) return;

        locale = value;
        entry?.applyLocale(locale);
        panel?.applyLocale(locale);
        positionPanel();
      });
    },
    deactivate() {
      if (!active) return;

      active = false;
      closePanel();
      removeEntry();
      stopSyncLoop();

      unwatchLocale?.();
      unwatchLocale = null;

      window.removeEventListener('message', onPageEvent);
      window.removeEventListener('resize', positionEntry);

      if (pendingScan !== null) {
        window.clearTimeout(pendingScan.timer);
        pendingScan = null;
      }
    },
  };
}
