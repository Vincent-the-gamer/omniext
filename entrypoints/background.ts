import { features } from '@/features/registry';
import {
  featureSettings,
  normalizeSettings,
  readFeatureSettings,
} from '@/utils/feature-settings';

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
});
