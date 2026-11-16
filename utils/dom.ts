/**
 * 查看器共用的 DOM 小工具。
 *
 * JSON 与代码高亮两个查看器各自接管整个页面，这里只放两边都会用到的最小
 * 集合：建元素、复制文本、显示文件大小。
 */

/** 创建元素并设置类名；第三个参数直接作为文本内容，避免手写 textContent。 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== '') node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 复制按钮的短暂提示：先改成“已复制”，过一会儿再恢复。 */
const flashTimers = new WeakMap<HTMLElement, number>();

export function flashLabel(
  element: HTMLElement,
  temporary: string,
  restore: string,
  duration = 1200,
): void {
  const existing = flashTimers.get(element);
  if (existing !== undefined) window.clearTimeout(existing);

  element.textContent = temporary;

  const timer = window.setTimeout(() => {
    element.textContent = restore;
    flashTimers.delete(element);
  }, duration);

  flashTimers.set(element, timer);
}

/**
 * 把文本写入剪贴板。
 *
 * 优先用异步 API；页面没有焦点或不是安全上下文时会失败，退回
 * `execCommand('copy')`，这样本地 file:// 页面也能复制。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 继续尝试旧接口
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.left = '-1000px';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** 把字节数写成 `1.2 KB` 这类短标签。 */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit] ?? 'B'}`;
}
