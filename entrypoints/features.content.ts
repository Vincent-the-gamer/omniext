import { defineContentScript } from '#imports';
import { startFeatureHost } from '@/features/host';

/**
 * 所有功能共用的内容脚本入口。
 *
 * 一个入口、匹配所有网站，具体跑哪些功能由 `features/registry.ts` 和用户设置
 * 决定 —— 新增功能不需要再声明内容脚本。
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  // 越早注入越好：抢在页面脚本之前注册事件监听器。
  runAt: 'document_start',
  // 弹窗、内嵌阅读器常把正文放在 iframe 里，一并处理。
  allFrames: true,
  matchAboutBlank: true,
  main() {
    startFeatureHost();
  },
});
