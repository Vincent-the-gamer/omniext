<script lang="ts" setup>
import { computed } from "vue";
import RuleEditor from "@/components/RuleEditor.vue";
import ToggleSwitch from "@/components/ToggleSwitch.vue";
import { useLocale } from "@/composables/use-locale";
import type { FeatureDefinition } from "@/features/types";
import type { FeatureScope, FeatureSettings } from "@/utils/feature-settings";
import { localized } from "@/utils/i18n";

const props = defineProps<{
    feature: FeatureDefinition;
    settings: FeatureSettings;
}>();

const emit = defineEmits<{ change: [patch: Partial<FeatureSettings>] }>();

const { locale, t } = useLocale();

/** 功能文案与界面文案都跟随当前语言。 */
const name = computed(() => localized(props.feature.name, locale.value));
const description = computed(
    () => localized(props.feature.description, locale.value),
);
const details = computed(() =>
    (props.feature.details ?? []).map((detail) =>
        localized(detail, locale.value),
    ),
);

const SCOPES: ReadonlyArray<{ value: FeatureScope; label: string; hint: string }> =
    [
        { value: "all", label: "scope-all", hint: "hint-all" },
        {
            value: "whitelist",
            label: "scope-whitelist",
            hint: "hint-whitelist",
        },
        {
            value: "blacklist",
            label: "scope-blacklist",
            hint: "hint-blacklist",
        },
    ];

const scopes = computed(() =>
    SCOPES.map((scope) => ({
        value: scope.value,
        label: t(scope.label),
        hint: t(scope.hint),
    })),
);

const scopeHint = computed(
    () =>
        scopes.value.find((scope) => scope.value === props.settings.scope)?.hint ??
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
                <h3 class="feature__name">{{ name }}</h3>
                <p class="feature__desc">{{ description }}</p>
            </div>

            <ToggleSwitch
                :model-value="settings.enabled"
                :label="t('master-switch', { name })"
                @update:model-value="emit('change', { enabled: $event })"
            />
        </header>

        <div class="feature__body">
            <div v-if="details.length > 0" class="feature__row">
                <span class="field-label">{{ t("details") }}</span>
                <ul class="feature__details">
                    <li v-for="detail in details" :key="detail">
                        {{ detail }}
                    </li>
                </ul>
            </div>

            <div class="feature__row">
                <span class="field-label">{{ t("scope") }}</span>
                <div>
                    <div
                        class="segmented"
                        role="radiogroup"
                        :aria-label="t('scope-of', { name })"
                    >
                        <button
                            v-for="scope in scopes"
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
                <span class="field-label">{{ t("domain-rules") }}</span>
                <div>
                    <RuleEditor
                        :model-value="settings.rules"
                        @update:model-value="emit('change', { rules: $event })"
                    />
                    <p v-if="rulesInactive" class="error">
                        {{
                            t("rules-inactive", {
                                count: settings.rules.length,
                            })
                        }}
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
