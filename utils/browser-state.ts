import { browser } from '#imports';
import type { BrowserState, FeatureDefinition } from '@/features/types';
import { BROWSER_STATE_MESSAGE } from '@/utils/messaging';

/**
 * 读取一个全局功能在浏览器里的真实状态。
 *
 * 优先问后台 service worker：`chrome.privacy` 之类的 API 只在扩展进程里可靠，
 * 而且后台是唯一持续应用浏览器设置的一方，由它回答能保证界面显示的是它实际
 * 写入的值。后台未运行或消息通道不通时，退回当前上下文直接读取。
 */
export async function readFeatureBrowserState(
  feature: FeatureDefinition,
): Promise<BrowserState> {
  const read = feature.readBrowserState;
  if (!read) return { supported: true, values: {} };

  try {
    const reply = await browser.runtime.sendMessage({
      type: BROWSER_STATE_MESSAGE,
      featureId: feature.id,
    });

    if (reply && typeof reply === 'object' && typeof reply.supported === 'boolean') {
      return reply as BrowserState;
    }
  } catch {
    // 后台没有注册（例如服务 worker 出错），直接读本地上下文。
  }

  try {
    return await read();
  } catch (error) {
    return {
      supported: false,
      values: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
