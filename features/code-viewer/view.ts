import { copyText, createElement, flashLabel, formatBytes } from '@/utils/dom';
import { translate, type Locale } from '@/utils/i18n';
import { createViewerBar } from '@/utils/viewer-bar';
import { highlightToLines, type Language } from './highlight';

interface CodeViewOptions {
  /** 要展示的源码；JSON 传入的是格式化后的文本。 */
  text: string;
  language: Language;
  locale: Locale;
  /** 顶栏显示的语言名；不传则按 `language` 取默认值。 */
  label?: string;
}

export interface CodeViewHandle {
  element: HTMLElement;
  /** 插件语言变化时刷新按钮文案。 */
  applyLocale(locale: Locale): void;
}

const BADGE: Readonly<Record<Language, string>> = {
  js: 'JavaScript',
  shell: 'Shell',
  json: 'JSON',
};

/**
 * 把高亮结果渲染成“行号 + 代码”的页面。
 *
 * JSON、JavaScript 与 Shell 共用同一个组件：同样的品牌顶栏、深色底、行号与
 * 语法配色。行号是独立一列，横向滚动只作用于代码，长行不会把行号顶走。
 */
export function createCodeView({
  text,
  language,
  locale: initialLocale,
  label,
}: CodeViewOptions): CodeViewHandle {
  let locale = initialLocale;

  const root = createElement('div', 'oe-code');

  const copyButton = createElement(
    'button',
    'oe-btn oe-btn--primary',
    translate(locale, 'viewer-copy'),
  );
  copyButton.type = 'button';
  copyButton.addEventListener('click', () => {
    void copyText(text).then((copied) => {
      flashLabel(
        copyButton,
        translate(locale, copied ? 'viewer-copied' : 'viewer-copy'),
        translate(locale, 'viewer-copy'),
      );
    });
  });

  const bar = createViewerBar({
    badge: label ?? BADGE[language],
    meta: formatBytes(new Blob([text]).size),
    actions: [copyButton],
  });

  const lines = highlightToLines(text, language);

  const body = createElement('div', 'oe-code__body');

  const gutter = createElement('div', 'oe-code__gutter');
  gutter.textContent = lines.map((_, index) => String(index + 1)).join('\n');
  gutter.setAttribute('aria-hidden', 'true');

  const scroll = createElement('div', 'oe-code__scroll');
  const pre = createElement('pre', 'oe-code__pre');
  // 每一段文本都在 highlightToLines 里转义过，这里只负责拼装。
  pre.innerHTML = lines.join('\n');
  scroll.appendChild(pre);

  body.append(gutter, scroll);
  root.append(bar, body);

  function applyLocale(next: Locale): void {
    locale = next;
    copyButton.textContent = translate(locale, 'viewer-copy');
  }

  return { element: root, applyLocale };
}
