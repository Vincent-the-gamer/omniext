<script lang="ts" setup>
import { LOCALES, localeLabel, type Locale } from "@/utils/i18n";
import { useLocale } from "@/composables/use-locale";

const props = defineProps<{ value: Locale }>();
const emit = defineEmits<{ change: [value: Locale] }>();

const { t } = useLocale();

/** 按钮上的短标签：中文显示“中文”，英文显示“EN”。 */
function shortLabel(locale: Locale): string {
  return locale === "zh" ? "中文" : "EN";
}
</script>

<template>
  <div class="segmented lang" role="radiogroup" :aria-label="t('language')">
    <button
      v-for="item in LOCALES"
      :key="item"
      type="button"
      role="radio"
      class="segmented__item lang__item"
      :aria-checked="props.value === item"
      :title="localeLabel[item]"
      @click="emit('change', item)"
    >
      {{ shortLabel(item) }}
    </button>
  </div>
</template>

<style scoped>
.lang {
  flex: none;
}

.lang__item {
  padding: 4px 9px;
  font-family: var(--mono);
  font-size: 12px;
}
</style>
