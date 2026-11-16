/**
 * 只保留原文的 JSON 解析器。
 *
 * 之所以不直接用 `JSON.parse` 的结果：它会把超出安全整数范围的数字转成浮点数，
 * 雪花 ID、纳秒时间戳这类长整数会直接失真。这里记录数字与字符串的原文，展示时
 * 原样输出；同时做一遍严格语法校验，保证只处理合法 JSON。
 */

/** 解析后的节点。对象/数组保留层叠结构，基本类型保留原始写法。 */
export type JsonNode =
  | { type: 'object'; entries: readonly JsonEntry[] }
  | { type: 'array'; items: readonly JsonNode[] }
  | { type: 'string'; value: string }
  | { type: 'number'; raw: string }
  | { type: 'boolean'; raw: string }
  | { type: 'null' };

export interface JsonEntry {
  key: string;
  value: JsonNode;
}

export type ParseResult =
  | { ok: true; value: JsonNode }
  | { ok: false; reason: 'invalid' | 'too-large' };

/** 防止超深或超大的 JSON 把页面拖死；超过上限时保持页面原样。 */
const MAX_DEPTH = 400;
const MAX_NODES = 60_000;

/** 数字用贪婪匹配定位原文，不做任何数值转换。 */
const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

const HEX_PATTERN = /^[\dA-Fa-f]{4}$/;

const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0d]);

class ParseError extends Error {}

class LimitError extends Error {}

export function parseJson(source: string): ParseResult {
  try {
    const parser = new Parser(source);
    return { ok: true, value: parser.parseDocument() };
  } catch (error) {
    return { ok: false, reason: error instanceof LimitError ? 'too-large' : 'invalid' };
  }
}

class Parser {
  private index = 0;
  private nodes = 0;

  constructor(private readonly text: string) {}

  parseDocument(): JsonNode {
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) this.fail();
    return value;
  }

  private fail(): never {
    throw new ParseError();
  }

  private skipWhitespace(): void {
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (!WHITESPACE.has(code)) return;
      this.index += 1;
    }
  }

  private peek(): string {
    return this.text.charAt(this.index);
  }

  private parseValue(depth: number): JsonNode {
    if (depth > MAX_DEPTH) throw new LimitError();

    this.nodes += 1;
    if (this.nodes > MAX_NODES) throw new LimitError();

    this.skipWhitespace();

    switch (this.peek()) {
      case '{':
        return this.parseObject(depth);
      case '[':
        return this.parseArray(depth);
      case '"':
        return { type: 'string', value: this.parseString() };
      case 't':
        this.expectWord('true');
        return { type: 'boolean', raw: 'true' };
      case 'f':
        this.expectWord('false');
        return { type: 'boolean', raw: 'false' };
      case 'n':
        this.expectWord('null');
        return { type: 'null' };
      default:
        return this.parseNumber();
    }
  }

  private parseObject(depth: number): JsonNode {
    this.index += 1; // {
    this.skipWhitespace();

    const entries: JsonEntry[] = [];

    if (this.peek() === '}') {
      this.index += 1;
      return { type: 'object', entries };
    }

    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') this.fail();

      const key = this.parseString();
      this.skipWhitespace();
      if (this.peek() !== ':') this.fail();
      this.index += 1;

      entries.push({ key, value: this.parseValue(depth + 1) });

      this.skipWhitespace();
      const next = this.peek();

      if (next === ',') {
        this.index += 1;
        continue;
      }

      if (next === '}') {
        this.index += 1;
        return { type: 'object', entries };
      }

      this.fail();
    }
  }

  private parseArray(depth: number): JsonNode {
    this.index += 1; // [
    this.skipWhitespace();

    const items: JsonNode[] = [];

    if (this.peek() === ']') {
      this.index += 1;
      return { type: 'array', items };
    }

    for (;;) {
      items.push(this.parseValue(depth + 1));

      this.skipWhitespace();
      const next = this.peek();

      if (next === ',') {
        this.index += 1;
        continue;
      }

      if (next === ']') {
        this.index += 1;
        return { type: 'array', items };
      }

      this.fail();
    }
  }

  /** 扫描带引号的字符串，返回解码后的值（转义已经在 JSON 层面处理掉）。 */
  private parseString(): string {
    const start = this.index;
    this.index += 1; // 开头的引号

    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);

      if (code === 0x22) {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          return this.fail();
        }
      }

      if (code === 0x5c) {
        const escape = this.text.charAt(this.index + 1);

        if (escape === 'u') {
          const hex = this.text.slice(this.index + 2, this.index + 6);
          if (!HEX_PATTERN.test(hex)) this.fail();
          this.index += 6;
          continue;
        }

        if (!'"\\/bfnrt'.includes(escape)) this.fail();
        this.index += 2;
        continue;
      }

      // 原始控制字符在 JSON 字符串里非法
      if (code < 0x20) this.fail();

      this.index += 1;
    }

    return this.fail();
  }

  private parseNumber(): JsonNode {
    NUMBER_PATTERN.lastIndex = this.index;
    const match = NUMBER_PATTERN.exec(this.text);

    if (!match || match[0] === '') this.fail();

    this.index = NUMBER_PATTERN.lastIndex;
    return { type: 'number', raw: match[0] };
  }

  private expectWord(word: string): void {
    if (!this.text.startsWith(word, this.index)) this.fail();
    this.index += word.length;
  }
}

/** 把解析结果序列化成格式化文本：数字保持原文，字符串重新转义。 */
export function formatJson(node: JsonNode, indent = '  '): string {
  return writeNode(node, indent, 0);
}

function writeNode(node: JsonNode, indent: string, depth: number): string {
  switch (node.type) {
    case 'string':
      return JSON.stringify(node.value);
    case 'number':
    case 'boolean':
      return node.raw;
    case 'null':
      return 'null';
    case 'array': {
      if (node.items.length === 0) return '[]';

      const inner = node.items
        .map((item) => `${indent.repeat(depth + 1)}${writeNode(item, indent, depth + 1)}`)
        .join(',\n');

      return `[\n${inner}\n${indent.repeat(depth)}]`;
    }
    case 'object': {
      if (node.entries.length === 0) return '{}';

      const inner = node.entries
        .map(
          (entry) =>
            `${indent.repeat(depth + 1)}${JSON.stringify(entry.key)}: ${writeNode(entry.value, indent, depth + 1)}`,
        )
        .join(',\n');

      return `{\n${inner}\n${indent.repeat(depth)}}`;
    }
  }
}
