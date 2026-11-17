import type { FeatureRuntime } from '@/features/types';
import { isValidLocale, localeItem, readLocale } from '@/utils/i18n';
import {
  detectTextDocumentKind,
  isPlainTextDocument,
  mountDocumentView,
  readDocumentText,
  sniffCodeLanguage,
  whenDocumentReady,
} from '@/utils/text-document';
import type { Language } from './highlight';
import { formatJson, parseJson } from './json';
import { createCodeView } from './view';

/**
 * 代码查看器的运行时。
 *
 * 只在页面本身就是源码文本时接管：
 * - JSON：接口地址、`.json` 文件，包括已被浏览器自带 JSON 查看器接管的页面；
 * - JavaScript / Shell：`.js`、`.sh` 等文件，或返回对应 content type 的地址。
 *
 * JSON 先格式化再交给代码高亮组件，因此三类页面最终是同一套外观。普通网页
 * 一律不碰。
 */
export function createCodeViewerRuntime(): FeatureRuntime {
  let active = false;
  let generation = 0;
  let cancelReady: (() => void) | null = null;
  let unwatchLocale: (() => void) | null = null;
  let restore: (() => void) | null = null;

  async function mount(token: number): Promise<void> {
    if (!active || token !== generation) return;

    const text = readDocumentText();
    if (text === null) return;

    const detected = detectTextDocumentKind();
    // 普通 HTML 页面（博客、文档站等）里即使有 <pre> 代码块，也不是源码文件，
    // 绝不能接管。detectTextDocumentKind 对 HTML 已经返回 null，这里再做一次兜底。
    if (detected === null && !isPlainTextDocument()) return;

    let language: Language | null = detected;
    let display = text;

    if (detected === 'json' || (detected === null && isPlainTextDocument() && startsWithJson(text))) {
      const parsed = parseJson(text);

      if (parsed.ok) {
        language = 'json';
        // 数字保持原文，只补缩进；展示与复制都用格式化后的文本。
        display = formatJson(parsed.value);
      } else if (detected === 'json') {
        // 资源声明是 JSON 但内容不合法（例如 JSONP），保持页面原样。
        return;
      }
    }

    // URL 没有扩展名、content type 也只是 text/plain 时，按内容特征判断语言；
    // 只在纯文本页面上做，避免影响普通网页里的代码块。
    if (language === null && isPlainTextDocument()) {
      language = sniffCodeLanguage(text);
    }

    if (language === null) return;

    const locale = await readLocale();
    if (!active || token !== generation) return;

    const label = language === 'js' && isTypeScript(location.pathname) ? 'TypeScript' : undefined;
    const view = createCodeView({ text: display, language, locale, label });
    restore = mountDocumentView(view.element);

    // 弹窗里切换语言后，已经打开的页面立即跟着变，无需刷新。
    unwatchLocale = localeItem.watch((value) => {
      if (isValidLocale(value)) view.applyLocale(value);
    });
  }

  return {
    activate() {
      if (active) return;
      active = true;
      generation += 1;

      const token = generation;
      cancelReady = whenDocumentReady(() => {
        cancelReady = null;
        void mount(token);
      });
    },
    deactivate() {
      if (!active) return;
      active = false;
      generation += 1;

      cancelReady?.();
      cancelReady = null;

      unwatchLocale?.();
      unwatchLocale = null;

      restore?.();
      restore = null;
    },
  };
}

/** 没有扩展名时，`{` / `[` 开头的文本优先按 JSON 尝试。 */
function startsWithJson(text: string): boolean {
  const head = text.trimStart();
  return head.startsWith('{') || head.startsWith('[');
}

/** TypeScript 与 JavaScript 共用一套着色，只是顶栏标签不同。 */
const TYPE_SCRIPT_PATH = /\.(?:[mc]?tsx?)$/i;

function isTypeScript(pathname: string): boolean {
  return TYPE_SCRIPT_PATH.test(pathname);
}
