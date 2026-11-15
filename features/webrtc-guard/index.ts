import type { FeatureDefinition } from '@/features/types';
import { applyWebRtcIpPolicy, getWebRtcIpPolicy } from './policy';

/**
 * WebRTC 防护：完全复刻 Google 的 "WebRTC Network Limiter"（官方插件，
 * 只有一条机制 —— 改 Chrome 内置的 `chrome.privacy.network.webRTCIPHandlingPolicy`）。
 *
 * 这个策略决定 WebRTC 允许使用哪些网络地址，是浏览器级别的设置，覆盖所有
 * 标签页和 Web Worker，所以功能标记为 `global`：没有域名规则，只有开关和
 * 四个策略选项，顺序与原文插件的四个单选按钮一致。
 *
 * 开关关闭时策略回到 `default`（浏览器默认，不做任何限制），等同于插件里
 * 第一个选项，不留副作用。
 */
const webrtcGuard: FeatureDefinition = {
  id: 'webrtc-guard',
  name: {
    en: 'WebRTC Network Limiter',
    zh: 'WebRTC 网络限制器',
  },
  icon: '🕸️',
  description: {
    en: 'Configures how WebRTC traffic is routed by changing Chrome’s built-in privacy setting, exactly like Google’s WebRTC Network Limiter. The strictest mode leaves WebRTC with no network path at all, so a leak test finds no WebRTC IP.',
    zh: '通过 Chrome 内置的隐私设置决定 WebRTC 流量怎么走，做法与 Google 官方 “WebRTC Network Limiter” 完全一致。最严格的模式下 WebRTC 没有任何可用网络路径，泄露检测找不到任何 WebRTC IP。',
  },
  details: [
    {
      en: 'This feature is a straight copy of Google’s WebRTC Network Limiter: it only changes Chrome’s `webRTCIPHandlingPolicy`, the setting that decides which addresses WebRTC is allowed to use. Nothing else is patched, hidden or disabled.',
      zh: '这个功能完全照搬 Google 的 WebRTC Network Limiter：只改 Chrome 的 `webRTCIPHandlingPolicy`，也就是决定 WebRTC 允许使用哪些地址的内置设置。不做任何其它拦截或修改。',
    },
    {
      en: 'The browser default (“Give me the best media experience”) lets WebRTC explore every network path, so leak tests still see your real and local IP. Pick “Use my proxy server (if present)” to disable WebRTC’s UDP entirely when there is no proxy — that is the mode that stops the leak.',
      zh: '浏览器默认（“给我最好的媒体体验”）允许 WebRTC 探索所有网络路径，所以泄露检测仍然能看到你的真实 IP 和局域网 IP。选“使用我的代理服务器（如果有）”会在没有代理时彻底禁用 WebRTC 的 UDP —— 这是能止住泄露的那一档。',
    },
    {
      en: 'The policy is browser-wide and applies to every tab, including Web Workers. Turning the switch off restores the browser default, so the setting is never left behind.',
      zh: '策略是浏览器全局的，对所有标签页（包括 Web Worker）生效。关闭开关会恢复浏览器默认策略，不会留下副作用。',
    },
    {
      en: 'Strict modes break WebRTC apps such as Meet, Zoom or Discord. The panel shows the value Chrome actually reports, so you can confirm the change landed.',
      zh: '严格模式会让 Meet、Zoom、Discord 这类 WebRTC 应用无法连接。面板会显示浏览器当前实际生效的策略，方便确认改动已经落地。',
    },
  ],
  options: [
    {
      key: 'ipPolicy',
      label: { en: 'WebRTC IP handling policy', zh: 'WebRTC IP 处理策略' },
      default: 'disable_non_proxied_udp',
      values: [
        {
          value: 'default',
          label: { en: 'Give me the best media experience', zh: '给我最好的媒体体验' },
          description: {
            en: 'This option allows Chrome to explore all network paths to find the best way to send and receive media, which may be different from normal web traffic.',
            zh: 'Chrome 可以探索所有网络路径，寻找收发媒体的最佳方式，这条路径可能与普通网页流量不同。',
          },
        },
        {
          value: 'default_public_and_private_interfaces',
          label: { en: 'Use my default public and private IP addresses', zh: '使用我的默认公网和私网 IP 地址' },
          description: {
            en: 'This option forces Chrome to use the same network path for media as for normal web traffic, except when a web proxy is present. For machines behind a NAT, Chrome will also use the default private address to enhance connectivity. To prevent degraded performance, Chrome will attempt to send media directly instead of using the proxy.',
            zh: 'Chrome 会用与普通网页流量相同的网络路径传输媒体（有 Web 代理时除外）。位于 NAT 之后的设备还会使用默认私网地址以提升连通性；为避免性能下降，Chrome 会尽量直接发送媒体而不走代理。',
          },
        },
        {
          value: 'default_public_interface_only',
          label: { en: 'Use only my default public IP address', zh: '只用我的默认公网 IP 地址' },
          description: {
            en: 'This option is the same as “Use my default public and private IP addresses” except that Chrome will not use the private default address.',
            zh: '与“使用我的默认公网和私网 IP 地址”相同，只是 Chrome 不再使用默认私网地址。',
          },
        },
        {
          value: 'disable_non_proxied_udp',
          label: { en: 'Use my proxy server (if present)', zh: '使用我的代理服务器（如果有）' },
          description: {
            en: 'This option forces Chrome to use the same network path for media as for normal web traffic, including use of a web proxy. Chrome will always attempt to send media through the proxy, which will typically hurt media performance and increase the load on the proxy; furthermore, this behavior may be incompatible with some applications. With no proxy, WebRTC has no network path at all — the strictest mode.',
            zh: 'Chrome 会用与普通网页流量相同的网络路径传输媒体，包括使用 Web 代理。Chrome 总会尝试通过代理发送媒体，这通常会降低媒体性能并增加代理负载，而且可能与某些应用不兼容。没有代理时 WebRTC 完全没有网络路径 —— 这是最严格的模式。',
          },
        },
      ],
      note: {
        en: 'Browser-wide: it applies to every tab while the switch is on. Reload the page you are testing after changing it.',
        zh: '浏览器全局生效：开关开启时对所有标签页有效；改动后请刷新正在测试的页面。',
      },
    },
  ],
  // 浏览器全局设置，不按域名区分。
  global: true,
  // 首次安装时所有开关都是关闭的，由用户主动开启。
  defaultEnabled: false,
  applySettings: applyWebRtcIpPolicy,
  // 界面用真实值确认策略是否落地（浏览器不支持时会提示）。
  readBrowserState: async (): Promise<Record<string, string>> => {
    const value = await getWebRtcIpPolicy();
    return value ? { ipPolicy: value } : {};
  },
};

export default webrtcGuard;
