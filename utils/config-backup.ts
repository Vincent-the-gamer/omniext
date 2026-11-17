/**
 * 设置备份：把所有功能的设置和界面语言导出成一个 JSON 文件，需要时再导回去。
 *
 * 浏览器会把扩展的存储按扩展 ID 隔离，并在扩展被移除时清空（`local` 与
 * `sync` 都一样）。所以重装、换浏览器或换 profile 测试之前，备份文件是
 * 最可靠的兜底。
 */
import { features } from '@/features/registry';
import {
  featureSettings,
  normalizeSettings,
  type FeatureSettings,
} from '@/utils/feature-settings';
import { isValidLocale, localeItem, type Locale } from '@/utils/i18n';

/** 文件里的格式标记，用来确认导入的确实是本扩展的备份。 */
const BACKUP_FORMAT = 'omniext/config';
/** 备份结构版本；结构变化时用它判断兼容性。 */
const BACKUP_VERSION = 1;

export interface ConfigBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** 界面语言偏好。 */
  locale: Locale;
  /** 键为功能 ID，值为该功能的完整设置。 */
  features: Record<string, FeatureSettings>;
}

export interface ImportResult {
  /** 真正写入存储的功能数量。 */
  applied: number;
  /** 备份里有、但当前版本不认识的功能 ID。 */
  skipped: string[];
}

export class BackupError extends Error {
  constructor(readonly code: 'unreadable' | 'unknown-format') {
    super(code);
    this.name = 'BackupError';
  }
}

/** 读取所有功能当前的设置和语言，组成一份备份。 */
export async function createBackup(): Promise<ConfigBackup> {
  const [locale, entries] = await Promise.all([
    localeItem.getValue(),
    Promise.all(
      features.map(
        async (feature) =>
          [feature.id, await featureSettings(feature).getValue()] as const,
      ),
    ),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    locale,
    features: Object.fromEntries(entries),
  };
}

/** 把备份保存成本地文件；扩展页面里没有别的落盘方式。 */
export function saveBackup(backup: ConfigBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `omniext-config-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();

  // 立刻回收会让部分浏览器在下载开始前就取消，等一拍再释放。
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface ParsedBackup {
  /** 原样保留：导入时只接受当前版本认识的值。 */
  locale: unknown;
  features: Record<string, unknown>;
}

/** 解析备份；结构不对就抛错，避免把半个文件写进存储。 */
function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('unreadable');
  }

  const source = raw as Partial<ConfigBackup> | null;
  if (
    !source ||
    typeof source !== 'object' ||
    source.format !== BACKUP_FORMAT ||
    typeof source.features !== 'object' ||
    source.features === null
  ) {
    throw new BackupError('unknown-format');
  }

  return {
    locale: source.locale,
    features: source.features as Record<string, unknown>,
  };
}

/**
 * 把备份写回存储。
 *
 * 只覆盖备份里出现过的功能，未出现的保持原样；文件里的未知功能会被忽略并
 * 报告出来，这样旧版本也能读新版本导出的文件。
 */
export async function importBackup(text: string): Promise<ImportResult> {
  const backup = parseBackup(text);
  const known = new Set(features.map((feature) => feature.id));
  let applied = 0;

  // 语言先落地：使用 `local:locale` 的界面会通过 watch 立即跟着切换。
  if (isValidLocale(backup.locale)) {
    await localeItem.setValue(backup.locale);
  }

  for (const feature of features) {
    const stored = backup.features[feature.id];
    if (stored === undefined) continue;

    // 和界面里的保存走同一条路径：先归一化并应用到浏览器，再写入存储。
    const settings = normalizeSettings(stored, feature);
    feature.applySettings?.(settings);
    await featureSettings(feature).setValue(settings);
    applied += 1;
  }

  return {
    applied,
    skipped: Object.keys(backup.features).filter((id) => !known.has(id)),
  };
}
