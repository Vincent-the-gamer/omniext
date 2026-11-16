/**
 * 从页面自带的播放信息里整理出可下载的直链。
 *
 * B 站在视频页的 HTML 里直接内联了 `window.__playinfo__`（播放轨地址）和
 * `window.__INITIAL_STATE__`（标题、bvid、分 P 等），所以这里不需要再请求接口，
 * 也不用处理签名，读到的就是当前账号、当前清晰度和当前分 P 的地址。
 */

import type { ScanResult, StreamTrack, VideoSnapshot } from './protocol';

interface DashTrack {
  id?: number;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
  bandwidth?: number;
  codecs?: string;
  height?: number;
}

interface DurlSegment {
  url?: string;
  backup_url?: string[];
  size?: number;
}

interface SupportFormat {
  quality?: number;
  new_description?: string;
  display_desc?: string;
}

interface PlayData {
  dash?: { video?: DashTrack[]; audio?: DashTrack[] };
  durl?: DurlSegment[];
  quality?: number;
  timelength?: number;
  support_formats?: SupportFormat[];
  accept_quality?: number[];
  accept_description?: string[];
}

interface InitialState {
  bvid?: string;
  cid?: number;
  videoData?: {
    title?: string;
    bvid?: string;
    cid?: number;
    duration?: number;
    pages?: { cid?: number; part?: string }[];
  };
}

/** 页面上的 B 站全局变量；两者都可能不存在（例如页面还没加载完）。 */
type BilibiliWindow = Window & {
  __playinfo__?: { data?: PlayData };
  __INITIAL_STATE__?: InitialState;
};

/** 播放信息里没有清晰度名称时用的兜底表（B 站的清晰度代码是固定的）。 */
const QUALITY_FALLBACK: Readonly<Record<number, string>> = {
  16: '360P',
  32: '480P',
  64: '720P',
  74: '720P60',
  80: '1080P',
  112: '1080P+',
  116: '1080P60',
  120: '4K',
  125: 'HDR',
  126: 'Dolby',
  127: '8K',
};

/** 同一个清晰度有多种编码时，优先挑兼容性最好的那种。 */
const CODEC_RANK: Readonly<Record<string, number>> = {
  AVC: 0,
  HEVC: 1,
  AV1: 2,
};

/** 从 `codecs` 字段（例如 `avc1.640032`）读出编码名称。 */
function codecName(codecs: string | undefined): string {
  const value = (codecs ?? '').toLowerCase();
  if (value.startsWith('avc')) return 'AVC';
  if (value.startsWith('hev') || value.startsWith('hvc')) return 'HEVC';
  if (value.startsWith('av01')) return 'AV1';
  return '';
}

function trackUrl(track: DashTrack): string {
  return track.baseUrl ?? track.base_url ?? '';
}

function trackBackup(track: DashTrack): string[] {
  return track.backupUrl ?? track.backup_url ?? [];
}

/** 清晰度代码 → 展示名，优先用页面给出的名称。 */
function qualityLabels(data: PlayData): Map<number, string> {
  const labels = new Map<number, string>();

  for (const format of data.support_formats ?? []) {
    if (typeof format.quality !== 'number') continue;
    const text = format.new_description ?? format.display_desc;
    if (text) labels.set(format.quality, text);
  }

  const ids = data.accept_quality ?? [];
  const names = data.accept_description ?? [];
  ids.forEach((id, index) => {
    const text = names[index];
    if (text && !labels.has(id)) labels.set(id, text);
  });

  return labels;
}

function describeQuality(quality: number, labels: Map<number, string>): string {
  return labels.get(quality) ?? QUALITY_FALLBACK[quality] ?? `Q${quality}`;
}

/**
 * DASH 视频轨：同一清晰度会有 AVC / HEVC / AV1 多个版本，只保留兼容性最好的
 * 那条，按清晰度从高到低排列。
 */
function buildVideoTracks(videos: readonly DashTrack[], labels: Map<number, string>): StreamTrack[] {
  const best = new Map<number, { track: DashTrack; rank: number }>();

  for (const track of videos) {
    if (trackUrl(track) === '') continue;

    const quality = track.id ?? 0;
    const rank = CODEC_RANK[codecName(track.codecs)] ?? 3;
    const current = best.get(quality);

    if (
      current === undefined ||
      rank < current.rank ||
      (rank === current.rank && (track.bandwidth ?? 0) > (current.track.bandwidth ?? 0))
    ) {
      best.set(quality, { track, rank });
    }
  }

  return [...best.entries()]
    .sort(([left], [right]) => right - left)
    .map(([quality, { track }]) => {
      const codec = codecName(track.codecs);
      const label = describeQuality(quality, labels);

      return {
        id: `video:${quality}`,
        kind: 'video',
        label: codec === '' ? label : `${label} · ${codec}`,
        bandwidth: track.bandwidth,
        url: trackUrl(track),
        backup: trackBackup(track),
      } satisfies StreamTrack;
    });
}

/** DASH 音频轨：B 站一般会提供 132K / 192K 等几档，按码率从高到低排列。 */
function buildAudioTracks(audios: readonly DashTrack[]): StreamTrack[] {
  return audios
    .filter((track) => trackUrl(track) !== '')
    .sort((left, right) => (right.bandwidth ?? 0) - (left.bandwidth ?? 0))
    .map((track, index) => {
      const kilo = Math.round((track.bandwidth ?? 0) / 1000);
      const label = kilo > 0 ? `${kilo} kbps` : `Audio ${index + 1}`;

      return {
        id: `audio:${track.id ?? index}`,
        kind: 'audio',
        label,
        bandwidth: track.bandwidth,
        url: trackUrl(track),
        backup: trackBackup(track),
      } satisfies StreamTrack;
    });
}

/** 老接口返回的合并 MP4（音视频在同一文件里）。 */
function buildMp4Tracks(segments: readonly DurlSegment[], data: PlayData, labels: Map<number, string>): StreamTrack[] {
  const usable = segments.filter((segment) => typeof segment.url === 'string' && segment.url !== '');
  const quality = data.quality;

  return usable.map((segment, index) => {
    const qualityLabel = typeof quality === 'number' ? describeQuality(quality, labels) : '';
    const label = usable.length > 1 ? `MP4 ${index + 1}/${usable.length}` : 'MP4';

    return {
      id: `mp4:${index}`,
      kind: 'mp4',
      label: qualityLabel === '' ? label : `${label} · ${qualityLabel}`,
      size: segment.size,
      url: segment.url ?? '',
      backup: segment.backup_url ?? [],
    } satisfies StreamTrack;
  });
}

function readTitle(state: InitialState | undefined): string {
  const title = state?.videoData?.title?.trim();
  if (title) return title;

  // 页面标题形如「标题_哔哩哔哩_bilibili」
  return document.title.replace(/\s*_\s*哔哩哔哩.*$/, '').trim();
}

/** 当前分 P 的标题；只有一个分 P 时不显示。 */
function readPart(state: InitialState | undefined, cid: number): string {
  const pages = state?.videoData?.pages ?? [];
  if (pages.length <= 1) return '';

  const current = pages.find((page) => page.cid === cid) ?? pages[0];
  return current?.part?.trim() ?? '';
}

/**
 * 读取当前页面的播放信息。
 *
 * 页面还没写入 `__playinfo__`（例如视频尚未开始加载、需要付费）时会返回原因码，
 * 界面据此给出具体提示，而不是一个空面板。
 */
export function readPlayInfo(): ScanResult {
  const page = window as BilibiliWindow;
  const playInfo = page.__playinfo__;
  const state = page.__INITIAL_STATE__;

  if (!playInfo || typeof playInfo !== 'object') return { ok: false, reason: 'no-playinfo' };

  const data = playInfo.data;
  if (!data || typeof data !== 'object') return { ok: false, reason: 'no-data' };

  const labels = qualityLabels(data);

  const mp4 = buildMp4Tracks(data.durl ?? [], data, labels);
  const video = buildVideoTracks(data.dash?.video ?? [], labels);
  const audio = buildAudioTracks(data.dash?.audio ?? []);

  const tracks = [...mp4, ...video, ...audio];
  if (tracks.length === 0) return { ok: false, reason: 'no-streams' };

  const cid = state?.cid ?? state?.videoData?.cid ?? 0;
  const duration =
    typeof data.timelength === 'number'
      ? Math.round(data.timelength / 1000)
      : Math.round(state?.videoData?.duration ?? 0);

  const snapshot: VideoSnapshot = {
    title: readTitle(state),
    bvid: state?.bvid ?? state?.videoData?.bvid ?? '',
    part: readPart(state, cid),
    duration,
    tracks,
    needsMux: mp4.length === 0 && video.length > 0 && audio.length > 0,
  };

  return { ok: true, snapshot };
}
