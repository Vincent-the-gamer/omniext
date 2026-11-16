/**
 * 页面侧脚本（MAIN world）：负责"取流"和"下载"。
 *
 * 它跑在页面自己的环境里，因此：
 * - 直接读得到 `window.__playinfo__` 这类页面变量；
 * - `fetch` 用的是当前站点的身份 —— Cookie、Referer 都与播放器一致，
 *   视频 CDN 才会放行。
 *
 * 内容脚本通过 `window.postMessage` 发指令、收进度，界面与逻辑由此分开。
 */

import { formatBytes } from '@/utils/dom';
import {
  HOST_SOURCE,
  PAGE_SOURCE,
  isHostCommand,
  type DownloadStage,
  type FailureReason,
  type PageEvent,
} from './protocol';
import { muxFragmentedMp4 } from './mux';
import { readPlayInfo } from './playinfo';

/**
 * 面板里是“整段读进内存再保存”，太大的文件会拖垮标签页。
 * 超过这个体积就让用户复制直链，用专门的下载器去下。
 */
const MAX_BLOB_BYTES = 1.5 * 1024 ** 3;

/** 合并下载要同时把两条流放在内存里，上限收得更紧一些。 */
const MAX_MERGE_BYTES = 700 * 1024 ** 2;

/** 进度事件的最小间隔，避免每读一块就发一条消息。 */
const PROGRESS_INTERVAL_MS = 200;

/** 下载结束前一直留着的 object URL，提前回收会让下载中断。 */
const OBJECT_URL_LIFETIME_MS = 60_000;

class DownloadError extends Error {
  readonly reason: FailureReason;
  readonly detail: string;

  constructor(reason: FailureReason, detail: string) {
    super(detail === '' ? reason : `${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
}

type BridgeWindow = Window & { __omniextBilibiliBridge?: boolean };

function post(event: PageEvent): void {
  window.postMessage(event, '*');
}

/**
 * 装上指令监听。重复注入时（例如关掉开关又打开）直接返回，
 * 避免同一条指令被处理两次。
 */
export function installPageBridge(): void {
  const page = window as BridgeWindow;
  if (page.__omniextBilibiliBridge) return;
  page.__omniextBilibiliBridge = true;

  const downloads = new Map<string, AbortController>();

  window.addEventListener('message', (event: MessageEvent) => {
    // 只接受本窗口的消息，页面里嵌的 iframe 发来的指令一律忽略。
    if (event.source !== window) return;

    const command = event.data;
    if (!isHostCommand(command)) return;

    if (command.type === 'scan') {
      post({
        source: PAGE_SOURCE,
        type: 'snapshot',
        requestId: command.requestId,
        result: readPlayInfo(),
      });
      return;
    }

    if (command.type === 'download') {
      void runDownload(
        command.downloadId,
        command.urls,
        command.audioUrls ?? [],
        command.filename,
        downloads,
      );
      return;
    }

    downloads.get(command.downloadId)?.abort();
  });
}

async function runDownload(
  downloadId: string,
  urls: readonly string[],
  audioUrls: readonly string[],
  filename: string,
  downloads: Map<string, AbortController>,
): Promise<void> {
  // 同一个轨道重复点击时先停掉上一次，避免两份进度互相覆盖。
  downloads.get(downloadId)?.abort();

  const controller = new AbortController();
  downloads.set(downloadId, controller);

  let lastReport = 0;
  const report = (received: number, total: number, stage: DownloadStage): void => {
    const now = performance.now();
    if (received < total && now - lastReport < PROGRESS_INTERVAL_MS) return;

    lastReport = now;
    post({ source: PAGE_SOURCE, type: 'progress', downloadId, received, total, stage });
  };

  try {
    await downloadFile(urls, audioUrls, controller.signal, report, filename);
    post({ source: PAGE_SOURCE, type: 'finished', downloadId });
  } catch (error) {
    const failure = toDownloadError(error, controller.signal);
    post({
      source: PAGE_SOURCE,
      type: 'failed',
      downloadId,
      reason: failure.reason,
      detail: failure.detail,
    });
  } finally {
    downloads.delete(downloadId);
  }
}

/**
 * 下载并保存。
 *
 * 没有音轨就直存一个文件；给了音轨就把两条流都取回来，合成一个 MP4 再保存。
 */
async function downloadFile(
  urls: readonly string[],
  audioUrls: readonly string[],
  signal: AbortSignal,
  report: (received: number, total: number, stage: DownloadStage) => void,
  filename: string,
): Promise<void> {
  const video = await fetchFirst(urls, signal, (received, total) =>
    report(received, total, 'download'),
  );

  if (audioUrls.length === 0) {
    saveBlob(video, filename);
    return;
  }

  // 合并时要同时把两条流放在内存里，视频轨已经过大就不必再拉音轨了
  if (video.size > MAX_MERGE_BYTES) throw new DownloadError('too-large', formatBytes(video.size));

  const audio = await fetchFirst(audioUrls, signal, (received, total) =>
    report(video.size + received, video.size + total, 'download'),
  );

  const total = video.size + audio.size;
  if (total > MAX_MERGE_BYTES) throw new DownloadError('too-large', formatBytes(total));

  report(total, total, 'mux');

  const merged = muxFragmentedMp4(
    new Uint8Array(await video.arrayBuffer()),
    new Uint8Array(await audio.arrayBuffer()),
  );

  if (merged === null) {
    // 合成不了也别浪费已经下载的流量：两条轨分开存下来，用户自己合并
    saveBlob(video, withSuffix(filename, 'video'));
    saveBlob(audio, withSuffix(filename, 'audio', 'm4a'));
    throw new DownloadError('mux-failed', '');
  }

  saveBlob(new Blob([merged], { type: 'video/mp4' }), filename);
}

/** 把一个文件名拆出主体，再拼上后缀与扩展名。 */
function withSuffix(filename: string, suffix: string, extension?: string): string {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = extension ?? (dot > 0 ? filename.slice(dot + 1) : 'mp4');
  return `${base}-${suffix}.${ext}`;
}

/** 主地址失败时依次尝试备用地址（B 站每条轨都会给几个镜像）。 */
async function fetchFirst(
  urls: readonly string[],
  signal: AbortSignal,
  report: (received: number, total: number) => void,
): Promise<Blob> {
  let lastError = new DownloadError('network', '');

  for (const url of urls) {
    if (signal.aborted) throw new DownloadError('cancelled', '');

    try {
      return await fetchOne(url, signal, report);
    } catch (error) {
      const failure = error instanceof DownloadError ? error : new DownloadError('network', describe(error));

      // 体积超限换镜像也一样，没必要再试。
      if (failure.reason === 'too-large') throw failure;
      if (signal.aborted) throw new DownloadError('cancelled', '');

      lastError = failure;
    }
  }

  throw lastError;
}

async function fetchOne(
  url: string,
  signal: AbortSignal,
  report: (received: number, total: number) => void,
): Promise<Blob> {
  // 视频 CDN 对媒体请求返回 `Access-Control-Allow-Origin: *`，
  // 这种响应不允许带 Cookie（`include` 会直接变成 “Failed to fetch”）。
  // 直链本身已经带签名，不需要凭据。
  const response = await fetch(url, { signal, credentials: 'omit' });

  if (!response.ok) throw new DownloadError('http-error', `HTTP ${response.status}`);

  const total = Number(response.headers.get('content-length') ?? 0);
  if (total > MAX_BLOB_BYTES) throw new DownloadError('too-large', formatBytes(total));

  const type = response.headers.get('content-type') ?? 'application/octet-stream';

  if (!response.body) {
    const blob = await response.blob();
    report(blob.size, blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.byteLength;
    report(received, total);
  }

  return new Blob(chunks, { type });
}

/** 用页面的身份触发一次普通下载，浏览器不会拦（有用户点击）。 */
function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  (document.body ?? document.documentElement).appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_LIFETIME_MS);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toDownloadError(error: unknown, signal: AbortSignal): DownloadError {
  if (error instanceof DownloadError) return error;
  if (signal.aborted) return new DownloadError('cancelled', '');

  return new DownloadError('network', describe(error));
}
