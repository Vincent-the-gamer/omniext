import type { FeatureRuntime } from '@/features/types';

/**
 * 页面拿来拦截复制的事件类型。
 *
 * 做法是在 `window` 的捕获阶段抢先 `stopImmediatePropagation()`：事件不再继续
 * 传给页面自己的监听器，但**不会取消浏览器默认行为**，所以选中、复制、右键
 * 菜单依然照常工作。内容脚本在 `document_start` 注入，监听器注册早于页面脚本，
 * 因此能稳定抢到最前面。
 */
const SHADOWED_EVENTS = [
  'copy',
  'cut',
  'beforecopy',
  'selectstart',
  'contextmenu',
  'dragstart',
] as const;

/** 常见的键盘拦截方式：Ctrl / Cmd + C、X、A。 */
const COPY_SHORTCUTS = new Set(['c', 'x', 'a']);

/** 覆盖页面的 `user-select: none`，其余样式一律不碰。 */
const UNLOCK_STYLES = `
*, *::before, *::after {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  user-select: text !important;
}
`;

export function createUnlockCopyRuntime(): FeatureRuntime {
  let active = false;
  let installed = false;
  let styleElement: HTMLStyleElement | null = null;

  /** 页面在 mouseup 时清空选区是最常见的反复制手段之一。 */
  const hasSelectedText = (): boolean => {
    const selection = window.getSelection();
    return selection !== null && !selection.isCollapsed && selection.toString().trim() !== '';
  };

  const onBlockableEvent: EventListener = (event) => {
    if (!active) return;
    event.stopImmediatePropagation();
  };

  const onKeyDown: EventListener = (event) => {
    if (!active) return;

    const { ctrlKey, metaKey, altKey, key } = event as KeyboardEvent;
    if (!(ctrlKey || metaKey) || altKey) return;
    if (!COPY_SHORTCUTS.has(key.toLowerCase())) return;

    event.stopImmediatePropagation();
  };

  /** 只有在确实选中了文字时才拦截 mouseup，避免影响页面的正常点击逻辑。 */
  const onMouseUp: EventListener = (event) => {
    if (!active || !hasSelectedText()) return;
    event.stopImmediatePropagation();
  };

  /**
   * 监听器装上后不再移除，只由 `active` 开关决定是否生效。
   *
   * 如果停用后再启用时重新 `addEventListener`，监听器会排到页面监听器之后，
   * 就失去了“先于页面拦截”的优势。
   */
  const installListeners = () => {
    if (installed) return;
    installed = true;

    const options: AddEventListenerOptions = { capture: true };
    for (const type of SHADOWED_EVENTS) {
      window.addEventListener(type, onBlockableEvent, options);
    }
    window.addEventListener('keydown', onKeyDown, options);
    window.addEventListener('mouseup', onMouseUp, options);
  };

  const injectStyles = () => {
    if (!active || styleElement?.isConnected) return;

    // document_start 时 <head> 可能还没有，退回到 <html> 上。
    const parent = document.head ?? document.documentElement;
    if (!parent) {
      document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
      return;
    }

    const style = document.createElement('style');
    style.textContent = UNLOCK_STYLES;
    parent.appendChild(style);
    styleElement = style;
  };

  const removeStyles = () => {
    styleElement?.remove();
    styleElement = null;
  };

  return {
    activate() {
      if (active) return;
      active = true;
      installListeners();
      injectStyles();
    },
    deactivate() {
      if (!active) return;
      active = false;
      removeStyles();
    },
  };
}
