/**
 * 把 B 站的 DASH 视频轨与音频轨合成一个 MP4。
 *
 * 两条轨都是分片 MP4（`ftyp` + `moov` + 若干 `moof`/`mdat`），所以不需要解码
 * 或重新编码，只要把两边的轨道信息拼到一起、再把分片按顺序接起来就行：
 *
 * - `moov` 用视频的，把音频的 `trak` 与 `mvex/trex` 并进去，轨道 ID 重新编号；
 * - 音频分片里的 `tfhd`（轨道 ID）与 `mfhd`（分片序号）跟着改；
 * - 分片数据本身按字节原样搬运，`trun` 里的偏移都是相对 `moof` 的，不会失效。
 *
 * 任何一步结构对不上（不是分片 MP4、缺 `moov` 等）就返回 `null`，
 * 由调用方退回到“分别下载两个文件”。
 */

interface Box {
  type: string;
  /** 盒子在数据里的起始偏移。 */
  start: number;
  /** 整个盒子（含头部）的长度。 */
  size: number;
  /** 头部长度：普通 8 字节，`size == 1` 时为 16 字节。 */
  header: number;
}

/** 需要递归进去找子盒子的容器类型。 */
const CONTAINERS = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'mvex',
  'moof',
  'traf',
  'edts',
  'dinf',
]);

function boxType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset] ?? 0,
    data[offset + 1] ?? 0,
    data[offset + 2] ?? 0,
    data[offset + 3] ?? 0,
  );
}

function readUint32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0);
}

function writeUint32(data: Uint8Array, offset: number, value: number): void {
  new DataView(data.buffer, data.byteOffset + offset, 4).setUint32(0, value);
}

/** 读出 [start, end) 范围内的同级盒子。 */
function readBoxes(data: Uint8Array, start = 0, end = data.length): Box[] {
  const boxes: Box[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = readUint32(data, offset);
    const type = boxType(data, offset + 4);
    let header = 8;

    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(
        new DataView(data.buffer, data.byteOffset + offset + 8, 8).getBigUint64(0),
      );
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }

    if (size < header || offset + size > end) break;

    boxes.push({ type, start: offset, size, header });
    offset += size;
  }

  return boxes;
}

/** 复制一个盒子（含头部），后续可以放心就地改字节。 */
function copyBox(data: Uint8Array, box: Box): Uint8Array {
  return data.slice(box.start, box.start + box.size);
}

/** 按 ISO BMFF 的结构拼一个新盒子。 */
function makeBox(type: string, ...parts: Uint8Array[]): Uint8Array {
  let length = 8;
  for (const part of parts) length += part.length;

  const out = new Uint8Array(length);
  writeUint32(out, 0, out.length);
  for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);

  let offset = 8;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

/** `tkhd` 里 track_ID 的位置（随 FullBox 版本变化）。 */
function tkhdTrackIdOffset(data: Uint8Array, box: Box): number {
  const version = data[box.start + box.header] ?? 0;
  return box.start + box.header + 4 + (version === 1 ? 16 : 8);
}

/** `mvhd` 里 next_track_ID 的位置（随 FullBox 版本变化）。 */
function mvhdNextTrackIdOffset(data: Uint8Array, box: Box): number {
  const version = data[box.start + box.header] ?? 0;
  return box.start + box.header + (version === 1 ? 108 : 96);
}

/** 在 [start, end) 里递归查找第一个 `type` 盒子。 */
function findBox(data: Uint8Array, start: number, end: number, type: string): Box | null {
  for (const box of readBoxes(data, start, end)) {
    if (box.type === type) return box;

    if (CONTAINERS.has(box.type)) {
      const found = findBox(data, box.start + box.header, box.start + box.size, type);
      if (found !== null) return found;
    }
  }

  return null;
}

/**
 * 就地改写盒子里的轨道 ID 与分片序号。
 *
 * `trackId` 与 `sequence` 传 `null` 表示这一项不改。
 */
function patchBoxes(
  data: Uint8Array,
  start: number,
  end: number,
  trackId: number | null,
  sequence: number | null,
): void {
  for (const box of readBoxes(data, start, end)) {
    const payload = box.start + box.header;

    if (box.type === 'tkhd' && trackId !== null) {
      writeUint32(data, tkhdTrackIdOffset(data, box), trackId);
      continue;
    }

    if ((box.type === 'trex' || box.type === 'tfhd') && trackId !== null) {
      writeUint32(data, payload + 4, trackId);
      continue;
    }

    if (box.type === 'mfhd' && sequence !== null) {
      writeUint32(data, payload + 4, sequence);
      continue;
    }

    if (CONTAINERS.has(box.type)) {
      patchBoxes(data, payload, box.start + box.size, trackId, sequence);
    }
  }
}

/** 读出一条流的主轨道 ID。 */
function readTrackId(data: Uint8Array, moov: Box): number | null {
  const tkhd = findBox(data, moov.start + moov.header, moov.start + moov.size, 'tkhd');
  if (tkhd === null) return null;

  const offset = tkhdTrackIdOffset(data, tkhd);
  if (offset + 4 > data.length) return null;

  return readUint32(data, offset);
}

/** 把一条流的分片按原顺序追加到 `parts`，必要时改写轨道 ID 与分片序号。 */
function pushFragments(
  data: Uint8Array,
  trackId: number | null,
  sequenceStart: number,
  parts: Uint8Array[],
): number {
  let sequence = sequenceStart;

  for (const box of readBoxes(data)) {
    if (box.type === 'moof') {
      const bytes = copyBox(data, box);
      patchBoxes(bytes, 8, bytes.length, trackId, sequence);
      parts.push(bytes);
      sequence += 1;
      continue;
    }

    if (box.type === 'mdat') {
      parts.push(data.subarray(box.start, box.start + box.size));
    }
  }

  return sequence;
}

/** 合成音视频轨的 `moov`；结构不符合预期时返回 `null`。 */
function mergeMoov(
  video: Uint8Array,
  videoMoov: Box,
  audio: Uint8Array,
  audioMoov: Box,
  audioTrackId: number,
): Uint8Array | null {
  const videoChildren = readBoxes(
    video,
    videoMoov.start + videoMoov.header,
    videoMoov.start + videoMoov.size,
  );
  const audioChildren = readBoxes(
    audio,
    audioMoov.start + audioMoov.header,
    audioMoov.start + audioMoov.size,
  );

  const mvhd = findBox(video, videoMoov.start + videoMoov.header, videoMoov.start + videoMoov.size, 'mvhd');
  if (mvhd === null) return null;

  const mvhdBytes = copyBox(video, mvhd);
  writeUint32(
    mvhdBytes,
    mvhdNextTrackIdOffset(video, mvhd) - mvhd.start,
    audioTrackId + 1,
  );

  const tracks: Uint8Array[] = [];
  const trexes: Uint8Array[] = [];
  const others: Uint8Array[] = [];

  for (const child of videoChildren) {
    if (child.type === 'trak') {
      tracks.push(copyBox(video, child));
      continue;
    }

    if (child.type === 'mvex') {
      for (const inner of readBoxes(video, child.start + child.header, child.start + child.size)) {
        if (inner.type === 'trex') trexes.push(copyBox(video, inner));
      }
      continue;
    }

    if (child.type !== 'mvhd') others.push(copyBox(video, child));
  }

  for (const child of audioChildren) {
    if (child.type === 'trak') {
      const bytes = copyBox(audio, child);
      patchBoxes(bytes, 8, bytes.length, audioTrackId, null);
      tracks.push(bytes);
      continue;
    }

    if (child.type === 'mvex') {
      for (const inner of readBoxes(audio, child.start + child.header, child.start + child.size)) {
        if (inner.type !== 'trex') continue;

        const bytes = copyBox(audio, inner);
        // trex：FullBox(4) 之后就是 track_ID
        writeUint32(bytes, 8 + 4, audioTrackId);
        trexes.push(bytes);
      }
    }
  }

  return makeBox('moov', mvhdBytes, ...tracks, ...others, makeBox('mvex', ...trexes));
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;

  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

/**
 * 合成一个可以单独播放的 MP4。
 *
 * @param video 视频轨的完整分片 MP4。
 * @param audio 音频轨的完整分片 MP4。
 * @returns 合并后的文件；结构不支持时返回 `null`。
 */
export function muxFragmentedMp4(video: Uint8Array, audio: Uint8Array): Uint8Array | null {
  const videoBoxes = readBoxes(video);
  const audioBoxes = readBoxes(audio);

  const ftyp = videoBoxes.find((box) => box.type === 'ftyp');
  const videoMoov = videoBoxes.find((box) => box.type === 'moov');
  const audioMoov = audioBoxes.find((box) => box.type === 'moov');

  if (ftyp === undefined || videoMoov === undefined || audioMoov === undefined) return null;

  // 只处理分片 MP4：普通 MP4（整段 moov）里没有 moof，合并没有意义
  if (!videoBoxes.some((box) => box.type === 'moof')) return null;
  if (!audioBoxes.some((box) => box.type === 'moof')) return null;

  const videoTrackId = readTrackId(video, videoMoov);
  const audioTrackId = readTrackId(audio, audioMoov);
  if (videoTrackId === null || audioTrackId === null) return null;

  const mergedAudioId = Math.max(videoTrackId, audioTrackId) + 1;

  const moov = mergeMoov(video, videoMoov, audio, audioMoov, mergedAudioId);
  if (moov === null) return null;

  const parts: Uint8Array[] = [
    video.subarray(ftyp.start, ftyp.start + ftyp.size),
    moov,
  ];

  // 先视频后音频：每个 moof 都紧跟着自己的 mdat，相对偏移仍然成立
  const nextSequence = pushFragments(video, null, 1, parts);
  pushFragments(audio, mergedAudioId, nextSequence, parts);

  return concat(parts);
}
