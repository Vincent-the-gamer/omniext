<script lang="ts" setup>
import { ref } from "vue";
import { useLocale } from "@/composables/use-locale";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { t } = useLocale();
const input = ref<HTMLInputElement | null>(null);

function onInput(event: Event): void {
    emit("update:modelValue", (event.target as HTMLInputElement).value);
}

function clear(): void {
    emit("update:modelValue", "");
    input.value?.focus();
}

/** Esc 清空关键词，再按一次就把焦点交还给页面。 */
function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !props.modelValue) return;
    event.preventDefault();
    clear();
}
</script>

<template>
    <div class="search">
        <svg
            class="search__icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
        </svg>

        <input
            ref="input"
            class="search__input"
            type="search"
            autocomplete="off"
            spellcheck="false"
            :value="modelValue"
            :placeholder="t('search-placeholder')"
            :aria-label="t('search-features')"
            @input="onInput"
            @keydown="onKeydown"
        />

        <button
            v-if="modelValue"
            type="button"
            class="search__clear"
            :title="t('search-clear')"
            :aria-label="t('search-clear')"
            @click="clear"
        >
            ×
        </button>
    </div>
</template>

<style scoped>
.search {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    height: 32px;
    padding: 0 8px 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--inset);
    transition:
        border-color 160ms ease,
        box-shadow 160ms ease;
}

.search:focus-within {
    border-color: rgba(0, 220, 130, 0.5);
    box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.12);
}

.search__icon {
    flex: none;
    color: var(--text-faint);
}

.search__input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--text);
    font-family: var(--sans);
    font-size: 12.5px;
}

.search__input::placeholder {
    color: var(--text-faint);
}

/* 用自定义的清空按钮，关掉 WebKit 自带的那个。 */
.search__input::-webkit-search-cancel-button {
    display: none;
}

.search__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    transition:
        background 160ms ease,
        color 160ms ease;
}

.search__clear:hover {
    background: rgba(255, 255, 255, 0.16);
    color: var(--text);
}
</style>
