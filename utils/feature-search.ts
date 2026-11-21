/**
 * 功能搜索：把用户输入的关键词和功能自带的文案做匹配。
 *
 * 弹窗和设置页共用这套规则，保证同一个关键词在两处搜到的是同一批功能。
 */

import type { FeatureDefinition } from '@/features/types';
import { localized, type Locale } from '@/utils/i18n';

/** 参与检索的文本：ID、名称、说明与补充说明，都按当前语言取。 */
function searchableText(feature: FeatureDefinition, locale: Locale): string {
  return [
    feature.id,
    localized(feature.name, locale),
    localized(feature.description, locale),
    ...(feature.details ?? []).map((detail) => localized(detail, locale)),
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * 关键词是否命中功能。
 *
 * 空格分隔的多个关键词按“同时包含”处理（例如 `github 下载`），
 * 空关键词视为全部命中。
 */
export function matchesFeatureQuery(
  feature: FeatureDefinition,
  locale: Locale,
  query: string,
): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0) return true;

  const haystack = searchableText(feature, locale);
  return terms.every((term) => haystack.includes(term));
}
