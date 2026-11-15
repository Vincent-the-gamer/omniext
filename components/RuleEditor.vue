<script lang="ts" setup>
import { ref } from "vue";
import { useLocale } from "@/composables/use-locale";
import { isValidRule, normalizeRule } from "@/utils/host";

const props = defineProps<{
    modelValue: readonly string[];
    placeholder?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

const { t } = useLocale();

const draft = ref("");
/** 存文案键而不是文案，切换语言时提示也跟着变。 */
const errorKey = ref("");

function add(): void {
    const rule = normalizeRule(draft.value);
    if (rule === "") return;

    if (!isValidRule(rule)) {
        errorKey.value = "rule-invalid";
        return;
    }

    if (props.modelValue.some((item) => normalizeRule(item) === rule)) {
        errorKey.value = "rule-duplicate";
        return;
    }

    errorKey.value = "";
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
                    :aria-label="t('remove-rule-aria', { rule })"
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
                :placeholder="placeholder ?? t('rule-placeholder')"
                :aria-label="t('add-rule-aria')"
                autocomplete="off"
                spellcheck="false"
                @input="errorKey = ''"
            />
            <button class="btn" type="submit">{{ t("add-rule") }}</button>
        </form>

        <p v-if="errorKey" class="error" role="alert">{{ t(errorKey) }}</p>
        <p v-else class="hint">{{ t("rule-hint") }}</p>
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
