import type { FeatureDefinition } from '@/features/types';
import { applyWebRtcIpPolicy, getWebRtcIpPolicy } from './policy';
import { createWebRtcGuardRuntime } from './runtime';

/**
 * WebRTC 防护：彻底禁用 WebRTC，不留任何泄露途径。
 *
 * 两层兜底，和 "WebRTC Control" 一类插件的思路一致：
 *
 * 1. 页面层：把 `RTCPeerConnection`、`getUserMedia`、`navigator.mediaDevices`
 *    等 WebRTC 相关的全局对象全部置为 undefined，页面连连接都创建不了，
 *    视频/音频采集也一并禁用。
 * 2. 浏览器层：收紧 `chrome.privacy.network.webRTCIPHandlingPolicy`（Google
 *    "WebRTC Network Limiter" 的机制），覆盖内容脚本碰不到的地方，例如 Web
 *    Worker 和其它标签页。
 *
 * 这是浏览器全局设置，无法按域名区分，所以功能标记为 `global`：界面里没有
 * 域名规则，只有开关和策略选择。
 */
const webrtcGuard: FeatureDefinition = {
  id: 'webrtc-guard',
  name: {
    en: 'Disable WebRTC',
    zh: '禁用 WebRTC',
  },
  icon: '🕸️',
  description: {
    en: 'Turns WebRTC off completely: pages cannot create WebRTC connections, camera and microphone access through WebRTC is removed, and the browser’s WebRTC IP policy is set to the strictest mode.',
    zh: '彻底禁用 WebRTC：页面无法建立 WebRTC 连接，通过 WebRTC 的摄像头和麦克风访问也被移除，同时把浏览器的 WebRTC IP 策略设为最严格模式。',
  },
  details: [
    {
      en: 'WebRTC can read your real and local IP address even with cookies and tracking disabled. With the switch on, WebRTC is disabled outright: `RTCPeerConnection`, `RTCSessionDescription`, `MediaStreamTrack`, `getUserMedia` and `navigator.mediaDevices` are removed from every page.',
      zh: '即使禁用 Cookie 和追踪，WebRTC 也能读出你的真实 IP 和局域网 IP。开关开启后 WebRTC 直接被禁用：页面里的 `RTCPeerConnection`、`RTCSessionDescription`、`MediaStreamTrack`、`getUserMedia`、`navigator.mediaDevices` 都被移除。',
    },
    {
      en: 'The browser-level IP policy is applied at the same time, so WebRTC inside Web Workers or other tabs cannot reach your IP either. “Proxy only” is the strictest mode and leaves no WebRTC IP at all.',
      zh: '同时收紧浏览器层面的 IP 策略，所以 Web Worker 或其它标签页里的 WebRTC 也读不到你的 IP。“只走代理”是最严格的模式，完全不给 WebRTC 任何 IP。',
    },
    {
      en: 'Audio and video through WebRTC are disabled too — WebRTC camera, microphone and media streams are gone. Turning the switch off restores everything.',
      zh: 'WebRTC 的音视频也一并禁用——摄像头、麦克风与媒体流都不可用。关闭开关后一切恢复正常。',
    },
    {
      en: 'The setting is browser-wide, so it has no domain rules. It also breaks WebRTC apps such as Meet, Zoom or Discord; turn the switch off when you need them.',
      zh: '设置是浏览器全局的，没有域名规则。它会让 Meet、Zoom、Discord 这类 WebRTC 应用无法连接，需要时请关闭开关。',
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
          label: { en: 'Proxy only — WebRTC disabled', zh: '只走代理——禁用 WebRTC' },
        },
      ],
      note: {
        en: 'Browser-wide: it applies to every tab while the switch is on, including pages the page-level patch cannot reach. Reload the page you are testing after changing it.',
        zh: '浏览器全局生效：开关开启时对所有标签页有效，包括页面层补丁覆盖不到的地方；改动后请刷新正在测试的页面。',
      },
    },
  ],
  // 浏览器全局设置，不按域名区分。
  global: true,
  // 首次安装时所有开关都是关闭的，由用户主动开启。
  defaultEnabled: false,
  createRuntime: createWebRtcGuardRuntime,
  applySettings: applyWebRtcIpPolicy,
  // 界面用真实值确认策略是否落地（浏览器拒绝改动时会提示）。
  readBrowserState: async (): Promise<Record<string, string>> => {
    const value = await getWebRtcIpPolicy();
    return value ? { ipPolicy: value } : {};
  },
};

export default webrtcGuard;
