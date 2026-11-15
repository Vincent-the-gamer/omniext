<script lang="ts" setup>
import { ref } from "vue";
import { isValidRule, normalizeRule } from "@/utils/host";

const props = defineProps<{
    modelValue: readonly string[];
    placeholder?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

const draft = ref("");
const error = ref("");

function add(): void {
    const rule = normalizeRule(draft.value);
    if (rule === "") return;

    if (!isValidRule(rule)) {
        error.value = "只支持域名、*.域名 后缀通配或 IP 地址";
        return;
    }

    if (props.modelValue.some((item) => normalizeRule(item) === rule)) {
        error.value = "这条规则已经存在";
        return;
    }

    error.value = "";
    draft.value = "";
    emit("update:modelValue", [...props.modelValue, rule]);
}

function remove(rule: string): void {
    emit(
        "update:modelValue",
        props.modelValue.filter((item) => item !== rule),
    );
}
</script>

<template>
    <div class="rules">
        <ul v-if="modelValue.length > 0" class="rules__list">
            <li
                v-for="rule in modelValue"
                :key="rule"
                class="chip chip--accent"
            >
                <span>{{ rule }}</span>
                <button
                    type="button"
                    class="chip__remove"
                    :aria-label="`删除规则 ${rule}`"
                    @click="remove(rule)"
                >
                    ×
                </button>
            </li>
        </ul>

        <form class="rules__form" @submit.prevent="add">
            <input
                v-model="draft"
                class="input"
                type="text"
                :placeholder="
                    placeholder ??
                    'example.com 或 *.example.com 或 192.168.1.10'
                "
                aria-label="添加域名规则"
                autocomplete="off"
                spellcheck="false"
                @input="error = ''"
            />
            <button class="btn" type="submit">添加</button>
        </form>

        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-else class="hint">
            example.com 会同时命中它的所有子域名；IP 可写成 192.168.1.10 或
            192.168.1.*。
        </p>
    </div>
</template>

<style scoped>
.rules {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.rules__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.rules__form {
    display: flex;
    gap: 8px;
}

.rules__form .input {
    flex: 1;
    min-width: 0;
}
</style>
