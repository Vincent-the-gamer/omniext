import { browser } from '#imports';
import type { BrowserState } from '@/features/types';
import type { FeatureSettings } from '@/utils/feature-settings';

interface PolicyDetails {
  value?: string;
  levelOfControl?: string;
}

interface PolicyApi {
  set: (detail: { value: string }) => void;
  get: (callback: (details: PolicyDetails) => void) => void;
}

/** 该 API 是 Chrome 特有的，其它浏览器（如 Firefox）没有。 */
function webRtcPolicy(): PolicyApi | undefined {
  const privacy = (browser as {
    privacy?: { network?: { webRTCIPHandlingPolicy?: PolicyApi } };
  }).privacy;

  return privacy?.network?.webRTCIPHandlingPolicy;
}

/** manifest 里声明的权限，用于排查“API 不可用”是不是权限缺失。 */
function declaredPermissions(): string[] {
  try {
    const manifest = browser.runtime.getManifest() as { permissions?: string[] };
    return manifest.permissions ?? [];
  } catch {
    return [];
  }
}

/**
 * 浏览器里 WebRTC 策略的真实状态：是否可用、当前生效的值、控制级别。
 *
 * `not_controllable` 表示这个值由 Chrome 的启动参数或企业策略设定，
 * 扩展的 `set()` 会被静默忽略 —— 这种情况不能写成“浏览器不支持”。
 */
export async function readWebRtcIpState(): Promise<BrowserState> {
  const policy = webRtcPolicy();

  if (!policy) {
    return {
      supported: false,
      values: {},
      error: 'chrome.privacy.network.webRTCIPHandlingPolicy',
      permissions: declaredPermissions(),
    };
  }

  try {
    const details = await new Promise<PolicyDetails>((resolve, reject) => {
      try {
        policy.get((result) => resolve(result ?? {}));
      } catch (error) {
        reject(error);
      }
    });

    return {
      supported: true,
      values: details.value ? { ipPolicy: details.value } : {},
      levelOfControl: details.levelOfControl,
    };
  } catch (error) {
    return {
      supported: true,
      values: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
    // 浏览器拒绝访问隐私设置时忽略；界面会通过 readWebRtcIpState 显示原因。
  }
}
