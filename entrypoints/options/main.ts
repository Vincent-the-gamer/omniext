import { createApp } from 'vue';

import '@/assets/theme.css';
import './style.css';
import App from './App.vue';
import { initLocale } from '@/composables/use-locale';

/** 先恢复语言偏好，再挂载，避免文案先英文再切换的闪烁。 */
async function bootstrap(): Promise<void> {
  await initLocale();
  createApp(App).mount('#app');
}

void bootstrap();
