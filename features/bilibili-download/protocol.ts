/**
 * B 站直链下载：内容脚本与页面侧脚本之间的消息协议。
 *
 * 内容脚本处在隔离环境里，读不到页面自己的 `window.__playinfo__`，也无法用页面
 * 的身份去请求视频 CDN（Referer、Cookie 都会不对）。所以"取流"和"下载"都放在
 * 页面侧脚本里做，内容脚本只负责界面，两边通过 `window.postMessage` 通信。
 *
 * 每种消息都带 `source` 字段，两端只处理自己认识的那一份，页面上的其它
 * postMessage 流量不受影响。
 */

/** 页面侧脚本发出的消息。 */
export const PAGE_SOURCE = 'omniext:bilibili-page';

/** 内容脚本发出的消息。 */
export const HOST_SOURCE = 'omniext:bilibili-host';

/** 请求失败的原因码，文案由界面按当前语言翻译。 */
export type FailureReason =
  | 'no-playinfo'
  | 'no-data'
  | 'no-streams'
  | 'timeout'
  | 'cancelled'
  | 'too-large'
  | 'http-error'
  | 'network'
  | 'mux-failed';

/** 下载阶段：先把两条轨读进内存，再合成一个文件。 */
export type DownloadStage = 'download' | 'mux';

/** 一条可以直接下载的媒体流。 */
export interface StreamTrack {
  /** 同一次扫描内唯一，下载进度靠它找回对应的行。 */
  id: string;
  /** `mp4` 是合并好音轨的文件；`video` / `audio` 是 DASH 分离轨道。 */
  kind: 'mp4' | 'video' | 'audio';
  /** 展示名，例如 `1080P 高清 · AVC`。 */
  label: string;
  /** 带宽（bps），界面用它估算体积。 */
  bandwidth?: number;
  /** 已知体积（字节），合并好的 MP4 才有。 */
  size?: number;
  /** 主地址，页面侧下载失败时会依次尝试 `backup`。 */
  url: string;
  backup: string[];
}

/** 一次扫描拿到的整页信息。 */
export interface VideoSnapshot {
  title: string;
  bvid: string;
  /** 分 P 标题；单 P 视频为空字符串。 */
  part: string;
  /** 时长（秒）。 */
  duration: number;
  tracks: StreamTrack[];
  /** DASH 的视频与音频是分开的文件，下载后需要自行合并。 */
  needsMux: boolean;
}

/** 扫描结果：成功时带整页信息，失败时只带原因码。 */
export type ScanResult =
  | { ok: true; snapshot: VideoSnapshot }
  | { ok: false; reason: FailureReason };

export type PageEvent =
  | { source: typeof PAGE_SOURCE; type: 'snapshot'; requestId: string; result: ScanResult }
  | {
      source: typeof PAGE_SOURCE;
      type: 'progress';
      downloadId: string;
      received: number;
      total: number;
      stage: DownloadStage;
    }
  | { source: typeof PAGE_SOURCE; type: 'finished'; downloadId: string }
  | {
      source: typeof PAGE_SOURCE;
      type: 'failed';
      downloadId: string;
      reason: FailureReason;
      detail: string;
    };

export type HostCommand =
  | { source: typeof HOST_SOURCE; type: 'scan'; requestId: string }
  | {
      source: typeof HOST_SOURCE;
      type: 'download';
      downloadId: string;
      /** 主轨地址（视频或合并好的 MP4）。 */
      urls: string[];
      /** 音轨地址；给了就先下载再合成一个 MP4。 */
      audioUrls: string[];
      filename: string;
    }
  | { source: typeof HOST_SOURCE; type: 'cancel'; downloadId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPageEvent(value: unknown): value is PageEvent {
  if (!isRecord(value) || value.source !== PAGE_SOURCE) return false;

  switch (value.type) {
    case 'snapshot':
      return typeof value.requestId === 'string';
    case 'progress':
      return typeof value.downloadId === 'string';
    case 'finished':
      return typeof value.downloadId === 'string';
    case 'failed':
      return typeof value.downloadId === 'string';
    default:
      return false;
  }
}

export function isHostCommand(value: unknown): value is HostCommand {
  if (!isRecord(value) || value.source !== HOST_SOURCE) return false;

  switch (value.type) {
    case 'scan':
      return typeof value.requestId === 'string';
    case 'download':
      return typeof value.downloadId === 'string' && Array.isArray(value.urls);
    case 'cancel':
      return typeof value.downloadId === 'string';
    default:
      return false;
  }
}
