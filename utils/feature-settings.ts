import { storage } from '#imports';
import { filterMatchingRules, matchesAnyRule, matchesRule } from '@/utils/host';

/** 功能的作用范围。 */
export type FeatureScope = 'all' | 'whitelist' | 'blacklist';

/** 单个功能的设置。 */
export interface FeatureSettings {
  /** 功能总开关。 */
  enabled: boolean;
  /** `all`：所有域名；`whitelist`：只在命中规则的域名；`blacklist`：命中规则的域名除外。 */
  scope: FeatureScope;
  /** 域名规则，支持后缀通配与 IP。 */
  rules: string[];
}

const SCOPES: readonly FeatureScope[] = ['all', 'whitelist', 'blacklist'];

type FeatureLike = { id: string; defaultEnabled: boolean };

/** 未知结构一律收敛成合法设置，避免旧数据把界面搞崩。 */
export function normalizeSettings(value: unknown, feature: FeatureLike): FeatureSettings {
  const source = (value ?? {}) as Partial<FeatureSettings>;

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : feature.defaultEnabled,
    scope: SCOPES.includes(source.scope as FeatureScope) ? (source.scope as FeatureScope) : 'all',
    rules: Array.isArray(source.rules)
      ? source.rules.filter((rule): rule is string => typeof rule === 'string' && rule.trim() !== '')
      : [],
  };
}

/**
 * 兼容第一版设置（`{ enabled, pausedHosts }`）。
 *
 * 旧数据没有写入版本号，所以这里按结构判断：已经是新结构的直接归一化，
 * 只有存在 `pausedHosts` 的旧数据才转换。
 */
function migrateSettings(value: unknown, feature: FeatureLike): FeatureSettings {
  const source = (value ?? {}) as Record<string, unknown>;

  if (typeof source.scope === 'string') return normalizeSettings(source, feature);

  const pausedHosts = Array.isArray(source.pausedHosts)
    ? source.pausedHosts.filter((host): host is string => typeof host === 'string' && host !== '')
    : [];

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : feature.defaultEnabled,
    scope: pausedHosts.length > 0 ? 'blacklist' : 'all',
    rules: pausedHosts,
  };
}

/**
 * 设置按功能分开存储（`local:feature:<id>`），新增功能不需要迁移整体设置。
 */
function defineFeatureSettings(feature: FeatureLike) {
  return storage.defineItem<FeatureSettings>(`local:feature:${feature.id}`, {
    fallback: { enabled: feature.defaultEnabled, scope: 'all', rules: [] },
    version: 2,
    migrations: { 2: (value) => migrateSettings(value, feature) },
  });
}

type FeatureSettingsItem = ReturnType<typeof defineFeatureSettings>;

/** `defineItem` 会注册监听，按功能缓存，避免重复定义。 */
const cache = new Map<string, FeatureSettingsItem>();

export function featureSettings(feature: FeatureLike): FeatureSettingsItem {
  const existing = cache.get(feature.id);
  if (existing) return existing;

  const item = defineFeatureSettings(feature);
  cache.set(feature.id, item);
  return item;
}

/** 读取并归一化设置。 */
export async function readFeatureSettings(feature: FeatureLike): Promise<FeatureSettings> {
  return normalizeSettings(await featureSettings(feature).getValue(), feature);
}

/** 域名是否落在该功能的作用范围内（不考虑总开关）。 */
export function matchesScope(settings: FeatureSettings, hostname: string): boolean {
  if (settings.scope === 'all') return true;

  const matched = matchesAnyRule(hostname, settings.rules);
  return settings.scope === 'whitelist' ? matched : !matched;
}

/** 该功能此刻是否应当在这个域名上生效。 */
export function isFeatureActive(settings: FeatureSettings, hostname: string): boolean {
  if (!settings.enabled) return false;
  // 取不到域名（about:blank 等）时只看总开关
  if (hostname.trim() === '') return true;

  return matchesScope(settings, hostname);
}

/** 命中当前域名的规则，用于弹窗展示。 */
export function matchedRules(settings: FeatureSettings, hostname: string): string[] {
  return filterMatchingRules(hostname, settings.rules);
}

/**
 * 在当前域名上翻转“是否生效”，返回新的设置（弹窗的快捷开关使用）。
 *
 * 全部网站模式下暂停某个站点，会切到黑名单并带上该站点；其余情况只改规则列表。
 */
export function settingsForHost(settings: FeatureSettings, hostname: string): FeatureSettings {
  if (hostname.trim() === '') return settings;

  const active = isFeatureActive(settings, hostname);
  const withoutHost = settings.rules.filter((rule) => !matchesRule(hostname, rule));

  if (active) {
    // 让它在当前站点不生效
    if (settings.scope === 'whitelist') return { ...settings, rules: withoutHost };
    return { ...settings, scope: 'blacklist', rules: [...withoutHost, hostname] };
  }

  // 让它在当前站点生效
  if (settings.scope === 'blacklist') return { ...settings, rules: withoutHost };
  return { ...settings, scope: 'whitelist', rules: [...withoutHost, hostname] };
}
