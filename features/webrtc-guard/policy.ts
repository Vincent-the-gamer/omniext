import { browser } from '#imports';
import type { FeatureSettings } from '@/utils/feature-settings';

/**
 * WebRTC 的 IP 处理策略，取值与 `chrome.privacy.IPHandlingPolicy` 一致：
 *
 * - `default`：不做限制（浏览器默认）
 * - `default_public_and_private_interfaces`：只用默认公网地址 + 默认私网地址
 * - `default_public_interface_only`：只用默认公网地址，不暴露局域网 IP
 * - `disable_non_proxied_udp`：WebRTC 的 UDP 必须走代理，没有代理时几乎等于
 *   禁用 WebRTC —— 这是最严格的选项，真实 IP 不会泄露
 */
export type WebRtcIpPolicy =
  | 'default'
  | 'default_public_and_private_interfaces'
  | 'default_public_interface_only'
  | 'disable_non_proxied_udp';

interface PolicyApi {
  set: (detail: { value: string }) => void;
  get: (callback: (details: { value: string }) => void) => void;
}

/** 该 API 是 Chrome 特有的，其它浏览器（如 Firefox）没有。 */
function webRtcPolicy(): PolicyApi | undefined {
  const privacy = (browser as {
    privacy?: { network?: { webRTCIPHandlingPolicy?: PolicyApi } };
  }).privacy;

  return privacy?.network?.webRTCIPHandlingPolicy;
}

/**
 * 把策略写入浏览器的全局隐私设置。
 *
 * 这是浏览器层面的开关，不能按域名区分：功能开启期间全局生效，
 * 关闭时恢复浏览器默认策略，不留副作用。
 */
export function applyWebRtcIpPolicy(settings: FeatureSettings): void {
  const policy = webRtcPolicy();
  if (!policy) return;

  const value: string = settings.enabled
    ? settings.options.ipPolicy ?? 'disable_non_proxied_udp'
    : 'default';

  try {
    policy.set({ value });
  } catch {
    // 浏览器拒绝访问隐私设置时忽略，不影响其它功能。
  }
}

/**
 * 读取浏览器当前实际生效的策略，用于界面里确认改动是否真的落地。
 * 不支持时返回 `undefined`。
 */
export function getWebRtcIpPolicy(): Promise<string | undefined> {
  const policy = webRtcPolicy();
  if (!policy) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    try {
      policy.get((details) => resolve(details?.value));
    } catch {
      resolve(undefined);
    }
  });
}
