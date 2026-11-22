<template>
    <div ref="root" class="ts" @keydown.esc="open = false">
        <button
            class="ts__trigger"
            type="button"
            :title="label"
            :aria-label="label"
            aria-haspopup="listbox"
            :aria-expanded="open"
            @click.stop="open = !open"
        >
            <img
                v-if="current?.icon"
                class="ts__icon"
                :src="iconUrl(current.icon)"
                alt=""
            />
            <span class="ts__label">{{ current?.label ?? "" }}</span>
            <span class="ts__caret" aria-hidden="true">▾</span>
        </button>

        <ul v-if="open" class="ts__menu" role="listbox">
            <li v-for="target in targets" :key="target.id">
                <button
                    class="ts__option"
                    :class="{
                        'ts__option--active': target.id === modelValue,
                    }"
                    type="button"
                    role="option"
                    :aria-selected="target.id === modelValue"
                    @click.stop="choose(target.id)"
                >
                    <img
                        v-if="target.icon"
                        class="ts__icon"
                        :src="iconUrl(target.icon)"
                        alt=""
                    />
                    <span>{{ target.label }}</span>
                    <span
                        v-if="target.id === modelValue"
                        class="ts__check"
                        aria-hidden="true"
                        >✓</span
                    >
                </button>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ExportTarget } from "./exporters";

const props = defineProps<{
    modelValue: string;
    targets: readonly ExportTarget[];
    label?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);

const current = computed(
    () =>
        props.targets.find((target) => target.id === props.modelValue) ??
        props.targets[0] ??
        null,
);

function iconUrl(path: string): string {
    if (/^(https?:|data:)/.test(path)) return path;
    const runtime = (globalThis as any).chrome?.runtime;
    return typeof runtime?.getURL === "function" ? runtime.getURL(path) : path;
}

function choose(id: string): void {
    emit("update:modelValue", id);
    open.value = false;
}

function onDocumentClick(event: MouseEvent): void {
    if (root.value && !root.value.contains(event.target as Node)) {
        open.value = false;
    }
}

watch(open, (value) => {
    if (value) document.addEventListener("click", onDocumentClick);
    else document.removeEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", onDocumentClick);
});
</script>

<style scoped>
.ts {
    position: relative;
}

.ts__trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--ni-border);
    border-radius: 8px;
    background: var(--ni-surface);
    color: var(--ni-text);
    font-family: inherit;
    font-size: 12.5px;
    cursor: pointer;
    outline: none;
    transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease;
}

.ts__trigger:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--ni-border-strong);
}

.ts__trigger:focus-visible {
    border-color: rgba(0, 220, 130, 0.5);
    box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.12);
}

.ts__icon {
    width: 14px;
    height: 14px;
    flex: none;
    object-fit: contain;
}

.ts__label {
    line-height: 1;
}

.ts__caret {
    color: var(--ni-faint);
    font-size: 10px;
    line-height: 1;
}

.ts__menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    min-width: 100%;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--ni-surface-2);
    border: 1px solid var(--ni-border-strong);
    border-radius: 8px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
}

.ts__option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ni-text);
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
}

.ts__option:hover {
    background: rgba(255, 255, 255, 0.06);
}

.ts__option--active {
    background: var(--ni-accent-soft);
    color: var(--ni-accent);
}

.ts__check {
    margin-left: auto;
    font-size: 11px;
}
</style>
