<script lang="ts" setup>
import { computed } from "vue";
import RuleEditor from "@/components/RuleEditor.vue";
import ToggleSwitch from "@/components/ToggleSwitch.vue";
import type { FeatureDefinition } from "@/features/types";
import type { FeatureScope, FeatureSettings } from "@/utils/feature-settings";

const props = defineProps<{
    feature: FeatureDefinition;
    settings: FeatureSettings;
}>();

const emit = defineEmits<{ change: [patch: Partial<FeatureSettings>] }>();

const SCOPES: ReadonlyArray<{
    value: FeatureScope;
    label: string;
    hint: string;
}> = [
    { value: "all", label: "全部网站", hint: "所有网站都生效。" },
    { value: "whitelist", label: "白名单", hint: "只在命中规则的网站生效。" },
    {
        value: "blacklist",
        label: "黑名单",
        hint: "命中规则的网站不生效，其余照常。",
    },
];

const scopeHint = computed(
    () =>
        SCOPES.find((scope) => scope.value === props.settings.scope)?.hint ??
        "",
);

const rulesInactive = computed(
    () => props.settings.scope === "all" && props.settings.rules.length > 0,
);
</script>

<template>
    <article
        class="card feature"
        :class="{ 'feature--off': !settings.enabled }"
    >
        <header class="feature__head">
            <span class="feature__icon" aria-hidden="true">{{
                feature.icon
            }}</span>

            <div class="feature__intro">
                <h3 class="feature__name">{{ feature.name }}</h3>
                <p class="feature__desc">{{ feature.description }}</p>
            </div>

            <ToggleSwitch
                :model-value="settings.enabled"
                :label="`${feature.name} 总开关`"
                @update:model-value="emit('change', { enabled: $event })"
            />
        </header>

        <div class="feature__body">
            <div v-if="feature.details?.length" class="feature__row">
                <span class="field-label">功能说明</span>
                <ul class="feature__details">
                    <li v-for="detail in feature.details" :key="detail">
                        {{ detail }}
                    </li>
                </ul>
            </div>

            <div class="feature__row">
                <span class="field-label">作用范围</span>
                <div>
                    <div
                        class="segmented"
                        role="radiogroup"
                        :aria-label="`${feature.name} 的作用范围`"
                    >
                        <button
                            v-for="scope in SCOPES"
                            :key="scope.value"
                            type="button"
                            role="radio"
                            class="segmented__item"
                            :aria-checked="settings.scope === scope.value"
                            @click="emit('change', { scope: scope.value })"
                        >
                            {{ scope.label }}
                        </button>
                    </div>
                    <p class="hint">{{ scopeHint }}</p>
                </div>
            </div>

            <div class="feature__row">
                <span class="field-label">域名规则</span>
                <div>
                    <RuleEditor
                        :model-value="settings.rules"
                        @update:model-value="emit('change', { rules: $event })"
                    />
                    <p v-if="rulesInactive" class="error">
                        当前是“全部网站”，这
                        {{ settings.rules.length }} 条规则暂不生效。
                    </p>
                </div>
            </div>
        </div>
    </article>
</template>

<style scoped>
.feature {
    padding: 20px 22px 22px;
}

.feature--off .feature__body {
    opacity: 0.5;
}

.feature__head {
    display: flex;
    align-items: flex-start;
    gap: 14px;
}

.feature__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 38px;
    height: 38px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    font-size: 17px;
    line-height: 1;
}

.feature__intro {
    flex: 1;
    min-width: 0;
}

.feature__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
}

.feature__desc {
    margin: 4px 0 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text-muted);
}

.feature__head .toggle {
    margin-top: 8px;
}

.feature__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
}

.feature__row {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.feature__details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    background: var(--inset);
    list-style: none;
    font-size: 13px;
    line-height: 1.65;
    color: var(--text-muted);
}

.feature__details li {
    position: relative;
    padding-left: 16px;
}

.feature__details li::before {
    content: "";
    position: absolute;
    top: 9px;
    left: 0;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.75;
}

@media (min-width: 820px) {
    .feature__row {
        display: grid;
        grid-template-columns: 120px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
    }

    .feature__row .field-label {
        padding-top: 8px;
    }
}
</style>
