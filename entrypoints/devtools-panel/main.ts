import { createApp } from 'vue';

import '@/assets/theme.css';
import App from './App.vue';
import { initLocale } from '@/composables/use-locale';

async function bootstrap(): Promise<void> {
  await initLocale();
  createApp(App).mount('#app');
}

void bootstrap();
