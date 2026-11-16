import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Omniext',
    description: 'Omnipotent browser extension.',
    permissions: ['storage', 'privacy'],
    // 内容脚本要把产品图标放进页面顶栏；页面侧的请求必须显式声明。
    web_accessible_resources: [
      {
        resources: ['icon/32.png'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
