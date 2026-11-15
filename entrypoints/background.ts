import { features } from '@/features/registry';
import {
  featureSettings,
  normalizeSettings,
  readFeatureSettings,
} from '@/utils/feature-settings';
import { isBrowserStateRequest } from '@/utils/messaging';

export default defineBackground(() => {
  // 跨页面的后台逻辑（右键菜单、定时任务、通知等）放在这里；
  // 与具体功能相关的代码请放到 `features/<id>/` 中。
  //
  // 部分功能需要改动浏览器全局设置（例如 WebRTC 的 IP 处理策略）。
  // 后台在启动时应用一次，之后每次设置变化都重新应用，保证开关与
  // 浏览器策略始终一致，也不会被其它页面的改动丢掉。
  for (const feature of features) {
    const apply = feature.applySettings;
    if (!apply) continue;

    const item = featureSettings(feature);
    item.watch((value) => apply(normalizeSettings(value, feature)));
    void readFeatureSettings(feature).then(apply);
  }

  // 界面（弹窗 / 设置页）询问全局功能的真实状态时，由后台回答：
  // 浏览器 API 在扩展页面里不一定可用，后台进程里则一定可用（前提是
  // manifest 声明了对应的权限），而且后台才知道自己实际写入了什么。
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isBrowserStateRequest(message)) return;

    const feature = features.find(
      (item) => item.id === (message as { featureId: string }).featureId,
    );
    const read = feature?.readBrowserState;

    if (!read) {
      sendResponse({ supported: false, values: {}, error: 'no state reader' });
      return;
    }

    void read()
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          supported: false,
          values: {},
          error: error instanceof Error ? error.message : String(error),
        }),
      );

    // 返回 true 表示 sendResponse 会异步调用。
    return true;
  });
});
