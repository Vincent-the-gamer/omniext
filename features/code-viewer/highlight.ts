/**
 * JavaScript、Shell 与 JSON 的轻量语法着色。
 *
 * 目标只是“看清结构”，不是完整的编译器前端：注释、字符串、数字、关键字、
 * 字面量、正则（JS）以及变量、操作符（Shell）；JSON 则以键、字符串、数字、
 * 字面量区分。所有文本都会被转义后再拼成 HTML，因此可以安全地交给
 * `innerHTML`。
 */

export type Language = 'js' | 'shell' | 'json';

type TokenKind =
  | 'comment'
  | 'string'
  | 'key'
  | 'number'
  | 'keyword'
  | 'literal'
  | 'regex'
  | 'variable'
  | 'operator';

interface Token {
  /** null 表示原样输出（空白、普通标识符、标点等）。 */
  kind: TokenKind | null;
  text: string;
}

type Push = (kind: TokenKind | null, text: string) => void;

/**
 * 把源码切成带类型的片段，再按行拼成带 `<span>` 的 HTML。
 * 返回值每一行对应一个数组元素，行号由调用方按顺序生成。
 */
export function highlightToLines(source: string, language: Language): string[] {
  // 浏览器里偶尔会遇到 CRLF；统一成 LF 才能让行号与视觉行数一致。
  const normalized = source.replace(/\r\n?/g, '\n');

  const tokens =
    language === 'js'
      ? tokenizeJs(normalized)
      : language === 'shell'
        ? tokenizeShell(normalized)
        : tokenizeJson(normalized);

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const parts = token.text.split('\n');

    parts.forEach((part, index) => {
      if (index > 0) {
        lines.push(current);
        current = '';
      }

      if (part === '') return;

      const escaped = escapeHtml(part);
      current +=
        token.kind === null ? escaped : `<span class="oe-t-${token.kind}">${escaped}</span>`;
    });
  }

  lines.push(current);
  return lines;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** 收集片段并合并相邻的原样文本，减少最终生成的 DOM 节点。 */
function createTokenList(): { tokens: Token[]; push: Push } {
  const tokens: Token[] = [];

  const push: Push = (kind, text) => {
    if (text === '') return;

    const last = tokens[tokens.length - 1];
    if (kind === null && last !== undefined && last.kind === null) {
      last.text += text;
      return;
    }

    tokens.push({ kind, text });
  };

  return { tokens, push };
}

/* ---------------- JavaScript ---------------- */

const JS_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'of',
  'return',
  'set',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  // 严格模式与类字段里的保留字
  'enum',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
]);

const JS_LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

/** 这些字符后面出现的 `/` 更可能是正则开头，而不是除号。 */
const REGEX_BEFORE_CHARS = new Set('(,=:[!&|?{};+-*%~^<>'.split(''));

/** 这些关键字后面也可以直接跟正则字面量。 */
const REGEX_BEFORE_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

const JS_NUMBER =
  /(?:0[xX][\dA-Fa-f_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)n?/y;

const LETTER = /[a-z]/i;

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || isDigit(char);
}

function tokenizeJs(source: string): Token[] {
  const { tokens, push } = createTokenList();
  const length = source.length;

  let index = 0;
  /** 上一个有意义的字符或关键字，用来区分除号与正则字面量。 */
  let previous = '';

  while (index < length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? length : end;
      push('comment', source.slice(index, stop));
      index = stop;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? length : end + 2;
      push('comment', source.slice(index, stop));
      index = stop;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const stop = scanString(source, index, char);
      push('string', source.slice(index, stop));
      index = stop;
      previous = ')';
      continue;
    }

    if (char === '/' && canStartRegex(previous)) {
      const stop = scanRegex(source, index);

      if (stop !== -1) {
        push('regex', source.slice(index, stop));
        index = stop;
        previous = ')';
        continue;
      }
    }

    if (isDigit(char) || (char === '.' && isDigit(next))) {
      const stop = scanNumber(source, index);
      push('number', source.slice(index, stop));
      index = stop;
      previous = ')';
      continue;
    }

    if (isIdentifierStart(char)) {
      let stop = index + 1;
      while (stop < length && isIdentifierPart(source.charAt(stop))) stop += 1;

      const word = source.slice(index, stop);

      if (JS_KEYWORDS.has(word)) {
        push('keyword', word);
        previous = word;
      } else if (JS_LITERALS.has(word)) {
        push('literal', word);
        previous = ')';
      } else {
        push(null, word);
        previous = ')';
      }

      index = stop;
      continue;
    }

    if (!/\s/.test(char)) previous = char;
    push(null, char);
    index += 1;
  }

  return tokens;
}

function canStartRegex(previous: string): boolean {
  if (previous === '') return true;
  if (REGEX_BEFORE_KEYWORDS.has(previous)) return true;
  return previous.length === 1 && REGEX_BEFORE_CHARS.has(previous);
}

/** 扫描字符串；普通引号不跨行，模板字符串可以跨行。 */
function scanString(source: string, start: number, quote: string): number {
  let index = start + 1;

  while (index < source.length) {
    const char = source.charAt(index);

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === quote) return index + 1;
    if (quote !== '`' && char === '\n') return index;

    index += 1;
  }

  return source.length;
}

/** 扫描正则字面量；看起来不像正则时返回 -1，让调用方按除号处理。 */
function scanRegex(source: string, start: number): number {
  let index = start + 1;
  let inCharacterClass = false;

  while (index < source.length) {
    const char = source.charAt(index);

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === '\n') return -1;
    if (char === '[') inCharacterClass = true;
    else if (char === ']') inCharacterClass = false;
    else if (char === '/' && !inCharacterClass) {
      index += 1;
      while (index < source.length && LETTER.test(source.charAt(index))) index += 1;
      return index;
    }

    index += 1;
  }

  return -1;
}

function scanNumber(source: string, start: number): number {
  JS_NUMBER.lastIndex = start;
  const match = JS_NUMBER.exec(source);
  return match ? JS_NUMBER.lastIndex : start + 1;
}

/* ---------------- Shell ---------------- */

const SHELL_KEYWORDS = new Set([
  'alias',
  'break',
  'case',
  'continue',
  'declare',
  'do',
  'done',
  'elif',
  'else',
  'esac',
  'eval',
  'exec',
  'export',
  'fi',
  'for',
  'function',
  'if',
  'in',
  'local',
  'readonly',
  'return',
  'select',
  'set',
  'shift',
  'source',
  'then',
  'trap',
  'typeset',
  'unalias',
  'unset',
  'until',
  'while',
]);

function isShellWordChar(char: string): boolean {
  return (
    isIdentifierPart(char) ||
    char === '-' ||
    char === '.' ||
    char === '/' ||
    char === ':' ||
    char === '=' ||
    char === '@' ||
    char === '%'
  );
}

function tokenizeShell(source: string): Token[] {
  const { tokens, push } = createTokenList();
  const length = source.length;

  let index = 0;
  /** 只有词首的 `#` 才是注释，`foo#bar` 里的 `#` 是普通字符。 */
  let atWordStart = true;

  while (index < length) {
    const char = source.charAt(index);

    if (char === '#' && atWordStart) {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? length : end;
      push('comment', source.slice(index, stop));
      index = stop;
      continue;
    }

    if (char === "'") {
      const stop = scanSingleQuote(source, index);
      push('string', source.slice(index, stop));
      index = stop;
      atWordStart = false;
      continue;
    }

    if (char === '"') {
      index = scanDoubleQuote(source, index, push);
      atWordStart = false;
      continue;
    }

    if (char === '`') {
      const stop = scanBacktick(source, index);
      push('string', source.slice(index, stop));
      index = stop;
      atWordStart = false;
      continue;
    }

    if (char === '$') {
      const stop = scanVariable(source, index);

      if (stop > index + 1) {
        push('variable', source.slice(index, stop));
        index = stop;
        atWordStart = false;
        continue;
      }
    }

    if (char === '\\') {
      const stop = Math.min(index + 2, length);
      push('operator', source.slice(index, stop));
      index = stop;
      atWordStart = false;
      continue;
    }

    if (isDigit(char)) {
      let stop = index + 1;
      while (stop < length && /[\d.]/.test(source.charAt(stop))) stop += 1;
      push('number', source.slice(index, stop));
      index = stop;
      atWordStart = false;
      continue;
    }

    if (isShellWordChar(char)) {
      let stop = index + 1;
      while (stop < length && isShellWordChar(source.charAt(stop))) stop += 1;

      const word = source.slice(index, stop);
      push(SHELL_KEYWORDS.has(word) ? 'keyword' : null, word);

      index = stop;
      atWordStart = false;
      continue;
    }

    if ('|&;<>()'.includes(char)) {
      push('operator', char);
      index += 1;
      atWordStart = true;
      continue;
    }

    atWordStart = /\s/.test(char);
    push(null, char);
    index += 1;
  }

  return tokens;
}

function scanSingleQuote(source: string, start: number): number {
  const end = source.indexOf("'", start + 1);
  return end === -1 ? source.length : end + 1;
}

function scanBacktick(source: string, start: number): number {
  let index = start + 1;

  while (index < source.length) {
    const char = source.charAt(index);
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '`') return index + 1;
    index += 1;
  }

  return source.length;
}

/** 双引号里的 `$变量` 单独着色，其余部分仍算字符串。 */
function scanDoubleQuote(source: string, start: number, push: Push): number {
  let index = start + 1;
  let segmentStart = start;

  while (index < source.length) {
    const char = source.charAt(index);

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === '"') {
      index += 1;
      push('string', source.slice(segmentStart, index));
      return index;
    }

    if (char === '$') {
      const stop = scanVariable(source, index);

      if (stop > index + 1) {
        push('string', source.slice(segmentStart, index));
        push('variable', source.slice(index, stop));
        index = stop;
        segmentStart = index;
        continue;
      }
    }

    index += 1;
  }

  push('string', source.slice(segmentStart, index));
  return index;
}

/** 识别 `$NAME`、`${...}`、`$1`、`$@` 这类变量；单独的 `$` 返回起始位置。 */
function scanVariable(source: string, start: number): number {
  let index = start + 1;
  if (index >= source.length) return start + 1;

  const char = source.charAt(index);

  if (char === '{') {
    index += 1;
    let depth = 1;

    while (index < source.length && depth > 0) {
      const current = source.charAt(index);

      if (current === '\\') {
        index += 2;
        continue;
      }

      if (current === '{') depth += 1;
      else if (current === '}') depth -= 1;
      index += 1;
    }

    return index;
  }

  if ('0123456789@*?$!#-'.includes(char)) return index + 1;

  if (isIdentifierStart(char)) {
    index += 1;
    while (index < source.length && isIdentifierPart(source.charAt(index))) index += 1;
    return index;
  }

  return start + 1;
}

/* ---------------- JSON ---------------- */

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function tokenizeJson(source: string): Token[] {
  const { tokens, push } = createTokenList();
  const length = source.length;

  let index = 0;

  while (index < length) {
    const char = source.charAt(index);

    if (char === '"') {
      const stop = scanJsonString(source, index);
      const raw = source.slice(index, stop);

      // 字符串后面紧跟冒号就是对象的键
      let lookahead = stop;
      while (lookahead < length && /\s/.test(source.charAt(lookahead))) lookahead += 1;

      push(source.charAt(lookahead) === ':' ? 'key' : 'string', raw);
      index = stop;
      continue;
    }

    if (isDigit(char) || char === '-') {
      const stop = scanJsonNumber(source, index);

      if (stop > index) {
        push('number', source.slice(index, stop));
        index = stop;
        continue;
      }
    }

    if (char === 't' && source.startsWith('true', index)) {
      push('literal', 'true');
      index += 4;
      continue;
    }

    if (char === 'f' && source.startsWith('false', index)) {
      push('literal', 'false');
      index += 5;
      continue;
    }

    if (char === 'n' && source.startsWith('null', index)) {
      push('literal', 'null');
      index += 4;
      continue;
    }

    if ('{}[]:,'.includes(char)) {
      push('operator', char);
      index += 1;
      continue;
    }

    push(null, char);
    index += 1;
  }

  return tokens;
}

function scanJsonString(source: string, start: number): number {
  let index = start + 1;

  while (index < source.length) {
    const char = source.charAt(index);

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === '"') return index + 1;

    index += 1;
  }

  return source.length;
}

function scanJsonNumber(source: string, start: number): number {
  JSON_NUMBER.lastIndex = start;
  const match = JSON_NUMBER.exec(source);
  return match ? JSON_NUMBER.lastIndex : start;
}
