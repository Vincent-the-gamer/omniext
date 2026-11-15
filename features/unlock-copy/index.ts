import type { FeatureDefinition } from '@/features/types';
import { createUnlockCopyRuntime } from './runtime';

/**
 * 解除复制限制：放开选中、复制、右键菜单。
 */
const unlockCopy: FeatureDefinition = {
  id: 'unlock-copy',
  name: '解除复制限制',
  icon: '📋',
  description: '移除网站的禁止选中、禁止复制、禁止右键限制。',
  details: [
    '抢在页面脚本之前拦截 copy、cut、contextmenu 等事件，网站无法再阻止复制。',
    '覆盖 user-select: none，恢复正常选中文字。',
    '只在确实选中文字时拦截 mouseup，不影响页面本身的点击操作。',
  ],
  defaultEnabled: true,
  createRuntime: createUnlockCopyRuntime,
};

export default unlockCopy;
