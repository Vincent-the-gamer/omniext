import type { FeatureDefinition } from '@/features/types';
import { applyWebRtcIpPolicy, getWebRtcIpPolicy } from './policy';

/**
 * WebRTC 防护：完全照 Google "WebRTC Network Limiter" 的做法 ——
 * 只有一个机制，但它是浏览器层面的，所以真正管用。
 *
 * Chrome 提供 `chrome.privacy.network.webRTCIPHandlingPolicy`，决定
 * WebRTC 允许使用哪些网络地址。开关开启期间收紧这个策略，网站就无法
 * 通过 WebRTC 读到真实 IP 或局域网 IP；开关关闭时恢复浏览器默认。
 *
 * 这是浏览器全局设置，无法按域名区分，所以这个功能标记为 `global`：
 * 界面里没有域名规则，只有策略选择。
 */
const webrtcGuard: FeatureDefinition = {
  id: 'webrtc-guard',
  name: {
    en: 'Block WebRTC leak',
    zh: '阻止 WebRTC 泄露',
  },
  icon: '🕸️',
  description: {
    en: 'Limits how WebRTC handles IP addresses at the browser level, so sites cannot read your real or local IP.',
    zh: '在浏览器层面限制 WebRTC 使用的网络地址，网站无法读到你的真实 IP 或局域网 IP。',
  },
  details: [
    {
      en: 'WebRTC reveals your IP address even when cookies and tracking are disabled. This feature uses Chrome’s built-in WebRTC IP policy — the same mechanism as Google’s WebRTC Network Limiter — to decide which network addresses WebRTC may use.',
      zh: '即使禁用 Cookie 和追踪，WebRTC 也能读出你的 IP。本功能使用 Chrome 内置的 WebRTC IP 策略（与 Google 的 WebRTC Network Limiter 同一机制），决定 WebRTC 可以使用哪些网络地址。',
    },
    {
      en: '“Proxy only” is the strictest mode: WebRTC UDP is disabled unless it goes through a proxy, so a leak test finds no WebRTC IP at all.',
      zh: '“只走代理”是最严格的模式：除非走代理，否则禁用 WebRTC 的 UDP，泄露检测网站读不到任何 WebRTC IP。',
    },
    {
      en: 'The policy is browser-wide: while the switch is on it applies to every tab. Turning the switch off restores the browser default.',
      zh: '策略是浏览器全局的：开关开启时对所有标签页生效；关闭开关会恢复浏览器默认。',
    },
    {
      en: 'The strictest mode also breaks WebRTC apps such as Meet, Zoom or Discord — choose “Public IP only” or turn the switch off when you need them.',
      zh: '最严格的模式会让 Meet、Zoom、Discord 这类 WebRTC 应用无法连接，需要时选“只用公网 IP”或关闭开关。',
    },
  ],
  options: [
    {
      key: 'ipPolicy',
      label: { en: 'WebRTC IP policy', zh: 'WebRTC IP 策略' },
      default: 'disable_non_proxied_udp',
      values: [
        {
          value: 'default',
          label: { en: 'No restriction (browser default)', zh: '不限制（浏览器默认）' },
        },
        {
          value: 'default_public_and_private_interfaces',
          label: { en: 'Default public + private interfaces', zh: '默认公网 + 私网地址' },
        },
        {
          value: 'default_public_interface_only',
          label: { en: 'Public IP only, hide local addresses', zh: '只用公网 IP，隐藏局域网地址' },
        },
        {
          value: 'disable_non_proxied_udp',
          label: { en: 'Proxy only — WebRTC UDP disabled', zh: '只走代理——禁用非代理 UDP' },
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
  // 界面用真实值确认策略是否落地（浏览器拒绝改动时会提示）。
  readBrowserState: async (): Promise<Record<string, string>> => {
    const value = await getWebRtcIpPolicy();
    return value ? { ipPolicy: value } : {};
  },
};

export default webrtcGuard;
