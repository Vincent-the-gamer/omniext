import { onMounted, onUnmounted, ref } from 'vue';
import { features } from '@/features/registry';
import type { FeatureDefinition } from '@/features/types';
import {
  featureSettings,
  normalizeSettings,
  readFeatureSettings,
  type FeatureSettings,
} from '@/utils/feature-settings';

export interface FeatureRow {
  feature: FeatureDefinition;
  settings: FeatureSettings;
}

/**
 * 读取所有功能的设置，并跟随其它页面（弹窗、设置页、其它标签页）的修改实时更新。
 */
export function useFeatures() {
  const rows = ref<FeatureRow[]>([]);
  const ready = ref(false);
  const unwatchers: Array<() => void> = [];

  onMounted(async () => {
    const loaded: FeatureRow[] = [];

    for (const feature of features) {
      loaded.push({ feature, settings: await readFeatureSettings(feature) });

      unwatchers.push(
        featureSettings(feature).watch((value) => {
          const row = rows.value.find((item) => item.feature.id === feature.id);
          if (row) row.settings = normalizeSettings(value, feature);
        }),
      );
    }

    rows.value = loaded;
    ready.value = true;
  });

  onUnmounted(() => {
    for (const unwatch of unwatchers.splice(0)) unwatch();
  });

  /** 保存设置：界面立即更新，存储写入在后台完成。 */
  async function update(row: FeatureRow, patch: Partial<FeatureSettings>): Promise<void> {
    // 写入前归一化（统一写法、去重），保证存下来的规则完整、可复用。
    const settings = normalizeSettings({ ...row.settings, ...patch }, row.feature);
    row.settings = settings;

    // 全局功能（例如 WebRTC 的 IP 策略）直接在这里应用到浏览器，
    // 不依赖后台服务工作线程是否已经唤醒；后台的 watch 也会再确认一次。
    row.feature.applySettings?.(settings);

    await featureSettings(row.feature).setValue(settings);
  }

  return { rows, ready, update };
}
