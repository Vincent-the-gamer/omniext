/**
 * 界面语言：默认英文，可切换到中文。
 *
 * 所有界面文案集中在这份字典里。语言偏好保存在 `local:locale`（浏览器本地
 * 存储），关闭浏览器或重启电脑后依然保留；未设置时退回英文。
 */

import { storage } from '#imports';

export type Locale = 'en' | 'zh';

/** 兜底语言：没有保存过选择时用英文。 */
export const DEFAULT_LOCALE: Locale = 'en';

/** 可选语言，顺序即界面上的顺序。 */
export const LOCALES: readonly Locale[] = ['en', 'zh'];

/** 语言在界面上的显示名。 */
export const localeLabel: Readonly<Record<Locale, string>> = {
  en: 'English',
  zh: '中文',
};

/** 功能自带的文案（名称、说明、细节）按语言给出。 */
export interface LocalizedText {
  en: string;
  zh: string;
}

/** 模板变量，例如 `{count}`。 */
export type Vars = Readonly<Record<string, string | number>>;

const dictionary: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  en: {
    settings: 'Settings',
    language: 'Language',
    'current-site': 'Current site',
    'browser-page': 'Browser page',
    'active-count': '{active}/{total} active',
    'status-off': 'Off',
    'status-not-applicable': 'Not applicable on this page',
    'status-active': 'Active on this page',
    'status-active-global': 'Active in the browser',
    'status-paused': 'Paused on this page',
    'scope-all': 'All sites',
    'scope-global': 'Browser-wide',
    'scope-whitelist': 'Whitelist',
    'scope-blacklist': 'Blacklist',
    'no-rule-match': 'No matching rules',
    'pause-here': 'Pause on this page',
    'enable-here': 'Enable on this page',
    'auto-save-note': 'Settings are saved automatically and apply instantly.',
    'master-switch': '{name} master switch',
    'scope-of': '{name} scope',
    'features-enabled': '{enabled} of {total} features enabled',
    'rule-count': '{count} domain rules',
    'no-rule-limit': 'No domain restrictions',
    'hero-line1': 'Feature',
    'hero-line2': 'Console',
    lede: 'Each feature has its own switch and domain rules that decide where it runs. Changes are saved instantly — open pages do not need a refresh.',
    'features-label': 'Features',
    'feature-count': '{count} items',
    loading: 'Loading settings…',
    'stored-note': 'Settings live in your browser local storage and are never uploaded.',
    details: 'Details',
    scope: 'Scope',
    'domain-rules': 'Domain rules',
    'hint-all': 'Runs on every site.',
    'hint-whitelist': 'Only runs on sites matched by the rules.',
    'hint-blacklist': 'Sites matched by the rules are skipped; everything else works as usual.',
    'hint-global': 'This is a browser-level setting, so there are no per-site rules: it applies to every tab while the switch is on.',
    'rules-inactive': 'Scope is “All sites”, so these {count} rules are not used yet.',
    'rule-placeholder': 'example.com, *.example.com or 192.168.1.10',
    'add-rule': 'Add',
    'add-rule-aria': 'Add domain rule',
    'remove-rule-aria': 'Remove rule {rule}',
    'rule-invalid': 'Use a domain, a *.domain wildcard or an IP address.',
    'rule-duplicate': 'That rule already exists.',
    'rule-hint': 'example.com also matches all of its subdomains; IPs can be written as 192.168.1.10 or 192.168.1.*.',
    'feature-options': 'Extra options',
    'policy-mismatch': 'The browser currently reports “{value}”, so the change did not take effect. Toggle the switch off and on again.',
    'policy-not-supported': 'This browser does not offer Chrome’s WebRTC IP policy, so the mode selector has no effect here.',
  },
  zh: {
    settings: '设置',
    language: '语言',
    'current-site': '当前网站',
    'browser-page': '浏览器内置页面',
    'active-count': '{active}/{total} 生效',
    'status-off': '已关闭',
    'status-not-applicable': '此页面不适用',
    'status-active': '本页生效',
    'status-active-global': '浏览器内生效',
    'status-paused': '本页暂停',
    'scope-all': '全部网站',
    'scope-global': '浏览器全局',
    'scope-whitelist': '白名单',
    'scope-blacklist': '黑名单',
    'no-rule-match': '未命中规则',
    'pause-here': '暂停本页',
    'enable-here': '在本页启用',
    'auto-save-note': '设置自动保存，页面即时生效',
    'master-switch': '{name} 总开关',
    'scope-of': '{name} 的作用范围',
    'features-enabled': '{enabled} / {total} 个功能已启用',
    'rule-count': '{count} 条域名规则',
    'no-rule-limit': '当前不限制域名',
    'hero-line1': '功能',
    'hero-line2': '控制台',
    lede: '每个功能都有独立的开关与域名规则，决定它在哪些页面生效。修改即时保存，已打开的页面无需刷新。',
    'features-label': '功能',
    'feature-count': '{count} 项',
    loading: '正在读取设置…',
    'stored-note': '设置保存在浏览器本地，不会上传',
    details: '功能说明',
    scope: '作用范围',
    'domain-rules': '域名规则',
    'hint-all': '所有网站都生效。',
    'hint-whitelist': '只在命中规则的网站生效。',
    'hint-blacklist': '命中规则的网站不生效，其余照常。',
    'hint-global': '这是浏览器级别的设置，没有按站点规则：开关开启时对所有标签页生效。',
    'rules-inactive': '当前是“全部网站”，这 {count} 条规则暂不生效。',
    'rule-placeholder': 'example.com 或 *.example.com 或 192.168.1.10',
    'add-rule': '添加',
    'add-rule-aria': '添加域名规则',
    'remove-rule-aria': '删除规则 {rule}',
    'rule-invalid': '只支持域名、*.域名 后缀通配或 IP 地址',
    'rule-duplicate': '这条规则已经存在',
    'rule-hint': 'example.com 会同时命中它的所有子域名；IP 可写成 192.168.1.10 或 192.168.1.*。',
    'feature-options': '额外选项',
    'policy-mismatch': '浏览器当前实际策略是“{value}”，说明改动没有落地；请把开关关闭再打开一次。',
    'policy-not-supported': '当前浏览器没有 Chrome 的 WebRTC IP 策略设置，这里的选择不会生效。',
  },
};

/** 当前语言的文案；缺失时退回英文，再缺失时原样返回键名。 */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  const template = dictionary[locale]?.[key] ?? dictionary[DEFAULT_LOCALE][key] ?? key;

  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** 取功能文案在当前语言的写法，缺翻译时退回英文。 */
export function localized(value: LocalizedText | string, locale: Locale): string {
  if (typeof value === 'string') return value;
  return value[locale] || value.en || '';
}

/** 语言偏好的存储项：浏览器本地存储，重启后仍然保留。 */
export const localeItem = storage.defineItem<Locale>('local:locale', {
  fallback: DEFAULT_LOCALE,
});

export function isValidLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
