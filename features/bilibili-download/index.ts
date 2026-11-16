import type { FeatureDefinition } from '@/features/types';
import { createBilibiliDownloadRuntime } from './runtime';

/**
 * B 站直链下载：在视频信息行右端加一个入口，列出当前视频的直链。
 *
 * 播放信息直接读页面自带的 `window.__playinfo__`，不经过第三方解析服务，也不
 * 额外请求接口；下载由页面侧脚本发起，Referer 与 Cookie 与播放器一致。
 */
const bilibiliDownload: FeatureDefinition = {
  id: 'bilibili-download',
  name: {
    en: 'Bilibili direct download',
    zh: 'B 站直链下载',
  },
  icon: '📺',
  description: {
    en: 'Adds a download entry to Bilibili video pages that lists the direct video and audio links.',
    zh: '在 B 站视频页加一个下载入口，列出视频与音频的直链。',
  },
  details: [
    {
      en: 'Only runs on video pages of `www.bilibili.com`; other Bilibili subdomains and pages without a player are left alone.',
      zh: '只在 `www.bilibili.com` 的视频页生效；其它 B 站子域名、没有播放器的页面都不改动。',
    },
    {
      en: 'The entry sits at the right end of the stats line above the video — views, danmaku, publish date — so it never covers Bilibili’s own buttons; clicking it lists every stream Bilibili has prepared for you.',
      zh: '入口放在视频上方播放量、弹幕数、发布时间那一行的右端，不压 B 站自己的按钮；点开就是 B 站已经为当前账号准备好的全部视频流。',
    },
    {
      en: 'Playback info is read from the page itself, so there is no third-party parsing service and no extra request: quality and access follow your current login and membership.',
      zh: '播放信息直接取自页面本身，不经过第三方解析服务，也不额外请求接口；清晰度与权限等同当前账号。',
    },
    {
      en: '“Merge & download” combines the video and audio tracks into one MP4 right in the browser — no re-encoding, no external tools. If the tracks cannot be combined, download them separately.',
      zh: '“合并下载”会在浏览器里直接把视频轨与音频轨合成一个 MP4：不重新编码，也不需要外部工具；实在合不了时会退回分别下载。',
    },
    {
      en: 'Downloads are streamed through the page and saved with your browser, so no extra permission is needed. Files over 1.5 GB (over 700 MB when merging) are refused — copy the link instead.',
      zh: '下载经由页面请求后交给浏览器保存，不需要额外权限。超过 1.5 GB（合并下载超过 700 MB）的文件会被拒绝，请改用复制直链。',
    },
    {
      en: 'Direct links expire after a couple of hours and only work while you are logged in to Bilibili.',
      zh: '直链有效期约两小时，并且只在当前登录状态下可用。',
    },
  ],
  // 首次安装时所有开关都是关闭的，由用户主动开启。
  defaultEnabled: false,
  createRuntime: createBilibiliDownloadRuntime,
};

export default bilibiliDownload;
