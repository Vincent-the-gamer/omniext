/** 弹窗与内容脚本之间传递的消息定义。 */

/** 弹窗询问当前标签页的页面信息。 */
export const PAGE_INFO_MESSAGE = 'omniext:page-info';

/** 内容脚本返回的页面信息。 */
export interface PageInfo {
  url: string;
  hostname: string;
}

export function isPageInfoRequest(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === PAGE_INFO_MESSAGE
  );
}

/** 界面询问某个全局功能在浏览器里的真实状态（由后台回答）。 */
export const BROWSER_STATE_MESSAGE = 'omniext:browser-state';

/** 后台对 `BROWSER_STATE_MESSAGE` 的应答，见 `features/types.ts` 的 `BrowserState`。 */
export interface BrowserStateRequest {
  type: typeof BROWSER_STATE_MESSAGE;
  featureId: string;
}

export function isBrowserStateRequest(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === BROWSER_STATE_MESSAGE
  );
}
