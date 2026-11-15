import { browser } from '#imports';
import { featureSettings, isFeatureActive, normalizeSettings } from '@/utils/feature-settings';
import { PAGE_INFO_MESSAGE, isPageInfoRequest, type PageInfo } from '@/utils/messaging';
import { features } from './registry';
import type { FeatureRuntime } from './types';

interface RuntimeEntry {
  runtime: FeatureRuntime;
  active: boolean;
}

/**
 * 在当前页面（含 iframe）启动所有已注册功能。
 *
 * 宿主在 `document_start` 同步创建并激活运行实例，让需要拦截页面事件的功能
 * 抢在页面脚本之前注册监听器；随后读取真实设置与域名规则对齐状态。设置变化时
 *（弹窗、设置页里的开关或域名规则）通过 `storage.watch` 实时生效，无需刷新。
 */
export function startFeatureHost(): void {
  const { hostname } = location;
  const runtimes = new Map<string, RuntimeEntry>();

  function applyState(id: string, shouldBeActive: boolean): void {
    const entry = runtimes.get(id);
    if (!entry || entry.active === shouldBeActive) return;

    entry.active = shouldBeActive;
    if (shouldBeActive) entry.runtime.activate();
    else entry.runtime.deactivate();
  }

  for (const feature of features) {
    // 全局功能（如 WebRTC 的 IP 策略）由后台改浏览器设置，不需要页面运行实例。
    if (!feature.createRuntime) continue;

    const runtime = feature.createRuntime({ hostname });
    const active = feature.defaultEnabled;
    runtimes.set(feature.id, { runtime, active });

    // 先按默认值启动，避免读取设置的异步等待期间被页面脚本抢先。
    if (active) runtime.activate();
  }

  async function applyStoredSettings(): Promise<void> {
    await Promise.all(
      features.map(async (feature) => {
        const settings = await featureSettings(feature).getValue();
        applyState(feature.id, isFeatureActive(normalizeSettings(settings, feature), hostname));
      }),
    );
  }

  for (const feature of features) {
    featureSettings(feature).watch((value) => {
      applyState(feature.id, isFeatureActive(normalizeSettings(value, feature), hostname));
    });
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isPageInfoRequest(message)) return;
    // 只有顶层框架能代表整个标签页，iframe 汇报的是它自己的域名。
    if (window.top !== window) return;

    sendResponse({ url: location.href, hostname } satisfies PageInfo);
  });

  void applyStoredSettings();
}
