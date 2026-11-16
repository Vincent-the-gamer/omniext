/**
 * B 站直链下载的界面：视频下方的入口按钮 + 直链面板。
 *
 * 入口按钮是挂在 `document.body` 上的一层浮层，位置对齐 B 站自己的工具栏，
 * 但从不往它的 DOM 里插入节点。面板同样是一张浮层。这里只碰 DOM，取流与
 * 下载都在页面侧脚本里。
 */

import { copyText, createElement, flashLabel, formatBytes } from '@/utils/dom';
import { translate, type Locale } from '@/utils/i18n';
import type { DownloadStage, FailureReason, StreamTrack, VideoSnapshot } from './protocol';

/** 入口浮层的固定 id：扩展重新加载后，用它清掉上一个实例留下的按钮。 */
export const ENTRY_ELEMENT_ID = 'omniext-bilibili-entry';

/** 工具栏入口按钮。 */
export interface EntryHandle {
  /** 浮层容器；挂在自己的 DOM 里，不碰页面的节点。 */
  element: HTMLElement;
  applyLocale(locale: Locale): void;
  setExpanded(expanded: boolean): void;
}

/**
 * 创建入口按钮。
 *
 * 按钮本身放在一个绝对定位的容器里，容器由调用方挂到 `document.body` 上 ——
 * B 站的视频页是 SSR + hydration 渲染的，往它自己的工具栏里插入节点会让
 * `bili-header` 的 hydration 失败（顶部导航栏直接空白），只能从外面“贴”上去。
 */
export function createEntryButton(locale: Locale, onToggle: () => void): EntryHandle {
  const host = createElement('div', 'oe-bili-entry-host');
  host.id = ENTRY_ELEMENT_ID;

  const element = createElement('button', 'oe-bili-entry');
  element.type = 'button';
  element.setAttribute('aria-haspopup', 'dialog');
  element.setAttribute('aria-expanded', 'false');

  const icon = createElement('span', 'oe-bili-entry__icon');
  icon.setAttribute('aria-hidden', 'true');
  // 内联 SVG：不会被页面 CSP 拦住，也不会出现破图。
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"></path><path d="m7.5 10 4.5 4.5L16.5 10"></path><path d="M4 18.5h16"></path></svg>';

  const text = createElement('span', 'oe-bili-entry__text');

  element.append(icon, text);
  element.addEventListener('click', (event) => {
    // 工具栏本身有点击/悬停逻辑，这里不让事件冒出去。
    event.preventDefault();
    event.stopPropagation();
    onToggle();
  });

  host.append(element);

  const handle: EntryHandle = {
    element: host,
    applyLocale(next) {
      text.textContent = translate(next, 'bili-entry');
      element.setAttribute('title', translate(next, 'bili-entry'));
    },
    setExpanded(expanded) {
      element.setAttribute('aria-expanded', String(expanded));
      element.classList.toggle('oe-bili-entry--on', expanded);
    },
  };

  handle.applyLocale(locale);
  return handle;
}

/** 面板与外部打交道的回调。 */
export interface PanelOptions {
  locale: Locale;
  /**
   * 下载一个轨道。
   *
   * `audio` 不为 null 时表示要把这条音轨一起下载并合成一个 MP4。
   */
  onDownload(track: StreamTrack, audio: StreamTrack | null, filename: string): void;
  onCancel(track: StreamTrack): void;
  onClose(): void;
}

export interface PanelHandle {
  element: HTMLElement;
  /** 扫描中：先占住位置，避免打开面板时闪一下空白。 */
  setLoading(): void;
  setSnapshot(snapshot: VideoSnapshot): void;
  setFailure(reason: FailureReason): void;
  setProgress(trackId: string, received: number, total: number, stage: DownloadStage): void;
  setFinished(trackId: string): void;
  setFailed(trackId: string, reason: FailureReason, detail: string): void;
  /** 切换插件语言时重建文案，保留每行的下载状态。 */
  applyLocale(locale: Locale): void;
}

interface RowView {
  copy: HTMLButtonElement;
  download: HTMLButtonElement;
  cancel: HTMLButtonElement;
  status: HTMLElement;
  /** 这一行是视频轨且能找到音轨，主按钮是“合并下载”。 */
  merges: boolean;
}

interface RowState {
  status: 'idle' | 'downloading' | 'done' | 'failed';
  received: number;
  total: number;
  stage: DownloadStage;
  /** 失败原因码，界面按当前语言翻译。 */
  reason: FailureReason | null;
  /** 失败细节（HTTP 状态码等）；有值时优先显示它。 */
  detail: string;
}

const GROUPS: readonly { kind: StreamTrack['kind']; titleKey: string }[] = [
  { kind: 'mp4', titleKey: 'bili-kind-mp4' },
  { kind: 'video', titleKey: 'bili-kind-video' },
  { kind: 'audio', titleKey: 'bili-kind-audio' },
];

const INVALID_FILENAME = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** 文件名里不能出现路径分隔符等字符；标题过长时截断，保留扩展名。 */
function buildFilename(snapshot: VideoSnapshot, track: StreamTrack): string {
  const extension = track.kind === 'audio' ? 'm4a' : 'mp4';
  const base = [snapshot.title, snapshot.part, track.label]
    .filter((part) => part !== '')
    .join(' - ')
    .replace(INVALID_FILENAME, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return `${base.slice(0, 120) || 'bilibili'}.${extension}`;
}

/** 轨道右侧的补充信息：码率与估算体积。 */
function trackDetail(track: StreamTrack, duration: number): string {
  const parts: string[] = [];

  if (typeof track.bandwidth === 'number' && track.bandwidth > 0) {
    parts.push(`${(track.bandwidth / 1_000_000).toFixed(2)} Mbps`);
    if (duration > 0) parts.push(`≈ ${formatBytes((track.bandwidth / 8) * duration)}`);
  }

  if (typeof track.size === 'number' && track.size > 0) parts.push(formatBytes(track.size));

  return parts.join(' · ');
}

export function createPanel({ locale: initialLocale, onDownload, onCancel, onClose }: PanelOptions): PanelHandle {
  let locale = initialLocale;
  let snapshot: VideoSnapshot | null = null;
  let failure: FailureReason | null = null;

  const rowViews = new Map<string, RowView>();
  const rowStates = new Map<string, RowState>();

  const root = createElement('div', 'oe-bili-panel');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'false');
  root.tabIndex = -1;

  const head = createElement('div', 'oe-bili-panel__head');
  const title = createElement('span', 'oe-bili-panel__title');
  const closeButton = createElement('button', 'oe-bili-panel__close');
  closeButton.type = 'button';
  closeButton.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
  closeButton.addEventListener('click', () => onClose());
  head.append(title, closeButton);

  const meta = createElement('div', 'oe-bili-panel__meta');
  const body = createElement('div', 'oe-bili-panel__body');
  const foot = createElement('div', 'oe-bili-panel__foot');

  root.append(head, meta, body, foot);

  function stateOf(trackId: string): RowState {
    const existing = rowStates.get(trackId);
    if (existing) return existing;

    const created: RowState = {
      status: 'idle',
      received: 0,
      total: 0,
      stage: 'download',
      reason: null,
      detail: '',
    };
    rowStates.set(trackId, created);
    return created;
  }

  function statusText(state: RowState): string {
    if (state.status === 'downloading') {
      if (state.stage === 'mux') return translate(locale, 'bili-muxing');

      if (state.total > 0) {
        const percent = Math.min(100, Math.round((state.received / state.total) * 100));
        return translate(locale, 'bili-progress', { percent, size: formatBytes(state.received) });
      }

      // 第一批数据还没到（或服务端没给 Content-Length）
      if (state.received > 0) return translate(locale, 'bili-received', { size: formatBytes(state.received) });
      return translate(locale, 'bili-preparing');
    }

    if (state.status === 'done') return translate(locale, 'bili-done');
    if (state.status === 'failed') {
      const translated = state.reason === null ? '' : translate(locale, `bili-reason-${state.reason}`);
      return translate(locale, 'bili-failed', { reason: state.detail !== '' ? state.detail : translated });
    }

    return '';
  }

  /** 只更新这一行的按钮与状态文字，进度事件不会重排整个面板。 */
  function applyRow(track: StreamTrack): void {
    const view = rowViews.get(track.id);
    if (!view) return;

    const state = stateOf(track.id);
    const downloading = state.status === 'downloading';

    view.copy.textContent = translate(locale, 'bili-copy');
    view.download.textContent = translate(locale, view.merges ? 'bili-download-mux' : 'bili-download');
    view.cancel.textContent = translate(locale, 'bili-cancel');
    view.status.textContent = statusText(state);

    view.copy.disabled = downloading;
    view.download.hidden = downloading;
    view.cancel.hidden = !downloading;
    view.status.hidden = state.status === 'idle';
    view.status.classList.toggle('oe-bili-row__status--error', state.status === 'failed');
    view.status.classList.toggle('oe-bili-row__status--done', state.status === 'done');
  }

  function createRow(track: StreamTrack, audio: StreamTrack | null): HTMLElement {
    const merges = track.kind === 'video' && audio !== null;

    const row = createElement('div', 'oe-bili-row');
    const info = createElement('div', 'oe-bili-row__info');
    const label = createElement('span', 'oe-bili-row__label', track.label);
    const detail = createElement('span', 'oe-bili-row__detail');
    const status = createElement('span', 'oe-bili-row__status');
    info.append(label);

    const detailText = trackDetail(track, snapshot?.duration ?? 0);
    if (detailText !== '') {
      detail.textContent = detailText;
      info.append(detail);
    }

    const actions = createElement('div', 'oe-bili-row__actions');

    const copy = createElement('button', 'oe-bili-btn');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      void copyText(track.url).then((copied) => {
        flashLabel(
          copy,
          translate(locale, copied ? 'bili-copied' : 'bili-copy'),
          translate(locale, 'bili-copy'),
        );
      });
    });

    const download = createElement('button', 'oe-bili-btn oe-bili-btn--primary');
    download.type = 'button';
    download.addEventListener('click', () => {
      if (!snapshot) return;
      onDownload(track, merges ? audio : null, buildFilename(snapshot, track));
    });

    const cancel = createElement('button', 'oe-bili-btn');
    cancel.type = 'button';
    cancel.hidden = true;
    cancel.addEventListener('click', () => onCancel(track));

    actions.append(copy, download, cancel);
    info.append(status);
    row.append(info, actions);

    rowViews.set(track.id, { copy, download, cancel, status, merges });

    return row;
  }

  function renderMessage(message: string): void {
    body.textContent = '';
    rowViews.clear();
    body.append(createElement('p', 'oe-bili-panel__message', message));
  }

  function render(): void {
    title.textContent = translate(locale, 'bili-panel-title');
    closeButton.setAttribute('aria-label', translate(locale, 'bili-close'));
    closeButton.setAttribute('title', translate(locale, 'bili-close'));

    meta.textContent = '';
    foot.textContent = '';
    rowViews.clear();

    if (failure !== null) {
      meta.hidden = true;
      renderMessage(translate(locale, `bili-reason-${failure}`));
      return;
    }

    if (snapshot === null) {
      meta.hidden = true;
      renderMessage(translate(locale, 'bili-loading'));
      return;
    }

    meta.hidden = false;
    const name = createElement('span', 'oe-bili-panel__name', snapshot.title);
    name.setAttribute('title', snapshot.title);
    const sub = createElement(
      'span',
      'oe-bili-panel__sub',
      [snapshot.part, snapshot.bvid].filter((part) => part !== '').join(' · '),
    );
    meta.append(name, sub);

    body.textContent = '';

    // 合并下载用码率最高的那条音轨，和视频轨逐行搭配
    const audio = snapshot.tracks.find((track) => track.kind === 'audio') ?? null;

    for (const group of GROUPS) {
      const tracks = snapshot.tracks.filter((track) => track.kind === group.kind);
      if (tracks.length === 0) continue;

      const section = createElement('section', 'oe-bili-group');
      section.append(createElement('h4', 'oe-bili-group__title', translate(locale, group.titleKey)));
      for (const track of tracks) section.append(createRow(track, audio));
      body.append(section);
    }

    for (const track of snapshot.tracks) applyRow(track);

    if (snapshot.needsMux) {
      foot.append(createElement('p', 'oe-bili-panel__note', translate(locale, 'bili-mux-note')));
    }
    foot.append(createElement('p', 'oe-bili-panel__note', translate(locale, 'bili-expire-note')));
  }

  render();

  return {
    element: root,
    setLoading() {
      snapshot = null;
      failure = null;
      render();
    },
    setSnapshot(next) {
      snapshot = next;
      failure = null;
      rowStates.clear();
      render();
    },
    setFailure(reason) {
      snapshot = null;
      failure = reason;
      render();
    },
    setProgress(trackId, received, total, stage) {
      const state = stateOf(trackId);
      state.status = 'downloading';
      state.stage = stage;
      state.received = received;
      state.total = total;

      const track = snapshot?.tracks.find((item) => item.id === trackId);
      if (track) applyRow(track);
    },
    setFinished(trackId) {
      const state = stateOf(trackId);
      state.status = 'done';
      state.received = state.total;

      const track = snapshot?.tracks.find((item) => item.id === trackId);
      if (track) applyRow(track);
    },
    setFailed(trackId, reason, detail) {
      const state = stateOf(trackId);
      state.status = 'failed';
      state.reason = reason;
      // 只有 HTTP 状态码这类具体信息值得直接展示，其余用翻译后的说明
      state.detail = reason === 'http-error' ? detail : '';

      const track = snapshot?.tracks.find((item) => item.id === trackId);
      if (track) applyRow(track);
    },
    applyLocale(next) {
      locale = next;
      render();
    },
  };
}
