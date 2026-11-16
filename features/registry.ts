import type { FeatureDefinition } from '@/features/types';
import codeViewer from './code-viewer';
import unlockCopy from './unlock-copy';
import webrtcGuard from './webrtc-guard';

/**
 * 所有已启用功能的清单，同时决定弹窗中的显示顺序。
 * 新增功能时在这里追加一项即可。
 */
export const features: readonly FeatureDefinition[] = [
  unlockCopy,
  codeViewer,
  webrtcGuard,
];
