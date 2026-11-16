import { defineUnlistedScript } from '#imports';
import { installPageBridge } from '@/features/bilibili-download/page-bridge';

/**
 * B 站直链下载的页面侧脚本（MAIN world）。
 *
 * 内容脚本处在隔离环境里，看不到页面自己的 `window.__playinfo__`，请求视频 CDN
 * 时也带不上页面的 Referer 与 Cookie，因此由这个脚本负责取流和下载。它通过
 * `injectScript` 注入，所以需要写在 `web_accessible_resources` 里。
 */
export default defineUnlistedScript(() => {
  installPageBridge();
});
