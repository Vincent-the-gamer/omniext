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
