/**
 * 语言状态：一份响应式偏好 + 一份持久化存储。
 *
 * 语言选择写入 `local:locale`（浏览器本地存储），关闭浏览器或关机后不会丢失；
 * 未选择时退回英文。弹窗与设置页各自挂载时调用 `initLocale()`，之后
 * `useLocale()` 里的 `t()` 会自动跟随当前语言。
 */

import { shallowRef } from 'vue';
import {
  DEFAULT_LOCALE,
  isValidLocale,
  localeItem,
  translate,
  type Locale,
  type Vars,
} from '@/utils/i18n';

/** 当前语言，所有界面共用同一个响应式值。 */
const locale = shallowRef<Locale>(DEFAULT_LOCALE);
let started = false;

function applyLocale(value: unknown): void {
  const next = isValidLocale(value) ? value : DEFAULT_LOCALE;
  locale.value = next;

  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  }
}

/**
 * 读取已保存的语言并监听后续改动。
 * 在 `main.ts` 挂载应用之前调用，避免先渲染英文再切换的闪烁。
 */
export async function initLocale(): Promise<void> {
  if (started) return;
  started = true;

  applyLocale(await localeItem.getValue());
  localeItem.watch((value) => applyLocale(value));
}

export function useLocale() {
  const setLocale = (next: Locale): void => {
    if (!isValidLocale(next) || next === locale.value) return;
    applyLocale(next);
    void localeItem.setValue(next);
  };

  const t = (key: string, vars?: Vars): string => translate(locale.value, key, vars);

  return { locale, setLocale, t };
}
