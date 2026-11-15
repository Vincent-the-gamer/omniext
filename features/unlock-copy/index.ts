import type { FeatureDefinition } from '@/features/types';
import { createUnlockCopyRuntime } from './runtime';

/**
 * 解除复制限制：放开选中、复制、右键菜单。
 *
 * 界面文案按语言给出，缺翻译时退回英文（见 `utils/i18n.ts`）。
 */
const unlockCopy: FeatureDefinition = {
  id: 'unlock-copy',
  name: {
    en: 'Unlock copy restrictions',
    zh: '解除复制限制',
  },
  icon: '📋',
  description: {
    en: 'Removes a site’s ban on selecting, copying and right-clicking.',
    zh: '移除网站的禁止选中、禁止复制、禁止右键限制。',
  },
  details: [
    {
      en: 'Intercepts copy, cut and contextmenu events before the page scripts run, so sites can no longer block copying.',
      zh: '抢在页面脚本之前拦截 copy、cut、contextmenu 等事件，网站无法再阻止复制。',
    },
    {
      en: 'Overrides `user-select: none` so text can be selected again.',
      zh: '覆盖 user-select: none，恢复正常选中文字。',
    },
    {
      en: 'Only intercepts mouseup when text is actually selected, leaving normal clicks alone.',
      zh: '只在确实选中文字时拦截 mouseup，不影响页面本身的点击操作。',
    },
  ],
  // 首次安装时所有开关都是关闭的，由用户主动开启。
  defaultEnabled: false,
  createRuntime: createUnlockCopyRuntime,
};

export default unlockCopy;
