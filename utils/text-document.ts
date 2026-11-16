/**
 * 浏览器把纯文本文件直接展示成页面时的公共判断与宿主操作。
 *
 * 这类页面的 DOM 极其简单：`<body>` 里只有一个 `<pre>`。JSON 格式化与代码
 * 高亮两个功能共用这里的判断，避免各自去猜 content type 和扩展名。
 */

export type TextDocumentKind = 'json' | 'js' | 'shell';

/** 服务器经常把脚本当 text/plain 返回，所以扩展名也要认。 */
const JS_PATH = /\.(?:[mc]?[jt]sx?)$/i;
const SHELL_PATH = /\.(?:sh|bash|zsh|ksh)$/i;
const SHELL_DOTFILE =
  /\/(?:\.(?:bashrc|bash_profile|bash_login|zshrc|zprofile|zshenv|profile))$/i;

/** 解码路径，失败时原样返回，避免非法 % 转义让功能失效。 */
function currentPath(): string {
  try {
    return decodeURIComponent(location.pathname).toLowerCase();
  } catch {
    return location.pathname.toLowerCase();
  }
}

/**
 * 判断当前页面属于哪种“纯文本文件”，普通网页一律返回 null。
 *
 * `text/html` 的页面（例如 GitHub 的文件页面）不能只看扩展名，否则会把
 * 正常的网页误当成脚本文件。URL 没有扩展名时返回 null，交给
 * `sniffCodeLanguage` 按内容判断。
 */
export function detectTextDocumentKind(): TextDocumentKind | null {
  const contentType = document.contentType.toLowerCase();

  if (contentType.includes('json')) return 'json';
  if (contentType.includes('javascript') || contentType.includes('ecmascript')) return 'js';
  if (contentType.includes('shellscript') || contentType.includes('x-sh')) return 'shell';

  if (!isPlainTextDocument()) return null;

  const path = currentPath();

  if (path.endsWith('.json')) return 'json';
  if (JS_PATH.test(path)) return 'js';
  if (SHELL_PATH.test(path) || SHELL_DOTFILE.test(path)) return 'shell';

  return null;
}

/** 页面是否是浏览器按纯文本展示的文档（而不是 HTML 页面）。 */
export function isPlainTextDocument(): boolean {
  const contentType = document.contentType.toLowerCase();
  return contentType === '' || contentType === 'text/plain';
}

/** 内容嗅探只看开头这么多个字符，足够判断语言，又不会拖慢大文件。 */
const SNIFF_LIMIT = 8000;

/** Shell 的结构信号：控制块结尾、变量赋值、测试方括号、行首注释等。 */
const SHELL_SIGNALS: readonly RegExp[] = [
  /^\s*(?:fi|esac|done)\s*$/m,
  /^\s*(?:if|elif|while|until)\b[^\n]*;\s*then\b/m,
  /^\s*(?:for|select)\b[^\n]*\b(?:in|do)\b/m,
  /^\s*case\b[^\n]*\bin\b/m,
  /;;/,
  /^\s*(?:export|local|readonly|declare|typeset)\s+[A-Za-z_]/m,
  /^\s*[A-Za-z_][A-Za-z0-9_]*=/m,
  /\b(?:echo|printf|source|trap|shift)\b/,
  /\[\[\s|\s\]\]/,
  /(?:^|\s)\[\s+-[A-Za-z]\s/,
  /^\s*#(?!!)/m,
];

/** JavaScript / TypeScript 的结构信号：箭头函数、声明、严格比较、模块语法等。 */
const JS_SIGNALS: readonly RegExp[] = [
  /=>/,
  /\bconsole\.\w+\s*\(/,
  /^\s*import\b/m,
  /^\s*export\s+(?:default|const|let|var|function|class|async|\{|\*)/m,
  /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/,
  /\bfunction\b\s*[A-Za-z_$]*\s*\(/,
  /===|!==/,
  /\brequire\s*\(/,
  /\bmodule\.exports\b/,
  /\bclass\s+[A-Za-z_$]/,
  /\b(?:document|window)\.\w+/,
  /\b(?:interface|type|enum)\s+[A-Za-z_$]/,
  /\bnull\b|\bundefined\b/,
];

/**
 * URL 与 content type 都没有线索时（例如 `https://bun.sh/install` 这种没有
 * 扩展名的地址），按内容特征猜一下是 JavaScript 还是 Shell。
 *
 * 只认明确的结构信号：shebang、`fi` / `done` 结尾的控制块、`=>`、`const`
 * 之类。散文或 Markdown 通常凑不够分数，宁可不着色也不乱改页面。
 */
export function sniffCodeLanguage(text: string): 'js' | 'shell' | null {
  const sample = text.slice(0, SNIFF_LIMIT);
  const lineEnd = sample.indexOf('\n');
  const firstLine = (lineEnd === -1 ? sample : sample.slice(0, lineEnd)).toLowerCase();

  if (firstLine.startsWith('#!')) {
    if (/\b(?:ba|z|k|da)?sh\b/.test(firstLine)) return 'shell';
    if (/\b(?:node|deno|bun|ts-node|qjs)\b/.test(firstLine)) return 'js';
  }

  const shellScore = SHELL_SIGNALS.filter((pattern) => pattern.test(sample)).length;
  const jsScore = JS_SIGNALS.filter((pattern) => pattern.test(sample)).length;

  if (shellScore >= 2 && shellScore > jsScore) return 'shell';
  if (jsScore >= 2 && jsScore > shellScore) return 'js';

  return null;
}

/**
 * 取出浏览器直接渲染出来的纯文本。
 *
 * 只接受“body 里只有一个 `<pre>`”这种原始文本页面。
 */
function readPlainText(): string | null {
  const body = document.body;
  if (!body) return null;

  const { children } = body;
  if (children.length > 1) return null;
  if (children.length === 1 && children[0]?.tagName !== 'PRE') return null;

  return (body.textContent ?? '').replace(/^\uFEFF/, '');
}

/**
 * 取出页面上的源码文本。
 *
 * 优先用浏览器直接渲染的纯文本。如果页面已经被浏览器自带的 JSON 查看器
 * （例如 Chrome 的“美观输出”）改造成“工具栏 + 内容”的结构，就退回到页面里
 * 最长的 `<pre>`，这样仍然能拿到源码并用我们自己的页面接管。
 */
export function readDocumentText(): string | null {
  const plain = readPlainText();
  if (plain !== null) return plain;

  let best: string | null = null;

  for (const pre of document.querySelectorAll('pre')) {
    const text = pre.textContent ?? '';
    if (best === null || text.length > best.length) best = text;
  }

  return best !== null && best.trim() !== '' ? best : null;
}

/**
 * 等 `document.body` 可用后执行。
 *
 * 功能在 `document_start` 被激活时页面还没解析完，必须等 DOM 就绪；返回的
 * 取消函数用于功能在等待期间被关掉的情况。
 */
export function whenDocumentReady(callback: () => void): () => void {
  if (document.readyState !== 'loading' && document.body) {
    callback();
    return () => {};
  }

  const listener = (): void => callback();
  document.addEventListener('DOMContentLoaded', listener, { once: true });

  return () => document.removeEventListener('DOMContentLoaded', listener);
}

/**
 * 用查看器接管整个页面，返回恢复函数。
 *
 * 原来的节点不会被复制，而是暂存进 `DocumentFragment`；功能关闭时原样放回，
 * 这样大文件不会额外占用一份文本。
 */
export function mountDocumentView(root: HTMLElement): () => void {
  const body = document.body;
  const original = document.createDocumentFragment();

  while (body.firstChild) original.appendChild(body.firstChild);

  document.documentElement.classList.add('oe-viewer');
  body.classList.add('oe-viewer-body');
  body.appendChild(root);

  let restored = false;

  return () => {
    if (restored) return;
    restored = true;

    root.remove();
    document.documentElement.classList.remove('oe-viewer');
    body.classList.remove('oe-viewer-body');
    body.appendChild(original);
  };
}
