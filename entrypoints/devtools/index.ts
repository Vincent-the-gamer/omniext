/// <reference types="chrome" />
import { readLocale, translate } from '@/utils/i18n';

async function createPanel(): Promise<void> {
  // 面板标题在创建时固定，先读取已保存的界面语言再注册。
  const locale = await readLocale();
  chrome.devtools.panels.create(
    translate(locale, 'devtools-panel-name'),
    'icon/32.png',
    'devtools-panel.html',
  );
}

void createPanel();
