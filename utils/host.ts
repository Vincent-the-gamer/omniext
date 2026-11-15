/**
 * 域名规则匹配。
 *
 * 规则写法：
 * - `example.com`：命中该域名及所有子域名；
 * - `*.example.com`：后缀通配，含义同上；
 * - `192.168.1.10`、`[::1]`：IP 精确匹配；
 * - `192.168.1.*`：IP 段通配（通配符可出现在任意位置）；
 * - `*`：匹配任意域名。
 */

/** RFC 允许的最长域名长度。 */
const MAX_RULE_LENGTH = 253;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 统一规则写法：去掉协议、路径、端口、结尾的点，全部转小写。 */
export function normalizeRule(raw: string): string {
  let value = raw.trim().toLowerCase();

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.split(/[/?#]/)[0] ?? '';
  value = value.replace(/:\d+$/, '');
  value = value.replace(/^\[|\]$/g, '');
  value = value.replace(/\.+$/, '');

  return value;
}

/** 统一 hostname 写法：小写、去掉 IPv6 方括号与结尾的点。 */
export function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

/** 规则是否可保存（避免把整段 URL 或非法字符写进设置）。 */
export function isValidRule(raw: string): boolean {
  const value = normalizeRule(raw);

  if (value === '' || value.length > MAX_RULE_LENGTH) return false;
  if (value === '*') return true;
  // 只有字母/数字/点/连字符/通配符/冒号（IPv6）是合法的
  if (!/^[a-z0-9.*:\-]+$/.test(value)) return false;
  if (value.includes('..')) return false;
  // 至少包含一个字母、数字或通配符，防止录入 "..." 这类空规则
  return /[a-z0-9*]/.test(value);
}

/** 判断 hostname 是否命中单条规则。 */
export function matchesRule(hostname: string, rule: string): boolean {
  const host = normalizeHost(hostname);
  const pattern = normalizeRule(rule);

  if (host === '' || pattern === '') return false;
  if (pattern === '*') return true;

  // `*.example.com` 视为后缀通配：同时命中 example.com 本身
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return suffix !== '' && (host === suffix || host.endsWith(`.${suffix}`));
  }

  if (!pattern.includes('*')) {
    // 普通域名/IP：命中自身及子域名
    return host === pattern || host.endsWith(`.${pattern}`);
  }

  const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
  return regex.test(host);
}

/** 判断 hostname 是否命中规则列表中的任意一条。 */
export function matchesAnyRule(hostname: string, rules: readonly string[]): boolean {
  return rules.some((rule) => matchesRule(hostname, rule));
}

/** 取出命中当前 hostname 的规则，供界面展示。 */
export function filterMatchingRules(hostname: string, rules: readonly string[]): string[] {
  return rules.filter((rule) => matchesRule(hostname, rule));
}
