<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
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

/** 全局功能（如 WebRTC 的 IP 策略）没有域名规则，只有浏览器级开关。 */
const isGlobal = computed(() => props.feature.global === true);

/** 浏览器里该功能的真实状态，用来确认改动是否落地。 */
const browserState = ref<Record<string, string>>({});
const stateRead = ref(false);
let stateTimer: number | undefined;

function refreshBrowserState(): void {
    const read = props.feature.readBrowserState;
    if (!read) return;

    // 稍等一下再读，避免刚写入就读到旧值而产生误报。
    window.clearTimeout(stateTimer);
    stateTimer = window.setTimeout(async () => {
        try {
            browserState.value = await read();
        } catch {
            browserState.value = {};
        }
        stateRead.value = true;
    }, 400);
}

onMounted(refreshBrowserState);
watch(() => props.settings, refreshBrowserState);

/** 浏览器没有这个隐私 API（例如 Firefox）时给出提示。 */
const policyUnsupported = computed(
    () =>
        Boolean(props.feature.readBrowserState) &&
        stateRead.value &&
        Object.keys(browserState.value).length === 0,
);

/** 功能自带的可选参数（下拉菜单）。 */
const options = computed(() =>
    (props.feature.options ?? []).map((option) => {
        const selected = props.settings.options?.[option.key] ?? option.default;
        const actual = browserState.value[option.key];
        const actualLabel = option.values.find(
            (value) => value.value === actual,
        )?.label;
        const chosen = option.values.find((value) => value.value === selected);

        return {
            key: option.key,
            label: localized(option.label, locale.value),
            note: option.note ? localized(option.note, locale.value) : "",
            default: option.default,
            // 选中项的完整说明，和浏览器原生的策略描述一致。
            selectedDescription: chosen?.description
                ? localized(chosen.description, locale.value)
                : "",
            values: option.values.map((value) => ({
                value: value.value,
                label: localized(value.label, locale.value),
            })),
            mismatch:
                // 开关关闭时浏览器回到默认策略，所以实际值应当是 default。
                actual &&
                actual !== (props.settings.enabled ? selected : "default")
                    ? t(
                        "policy-mismatch",
                        {
                            value: actualLabel
                                ? localized(actualLabel, locale.value)
                                : actual,
                        },
                    )
                    : "",
        };
    }),
);

function setOption(key: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    emit("change", {
        options: { ...props.settings.options, [key]: select.value },
    });
}
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
                        v-if="!isGlobal"
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
                    <p class="hint">
                        {{ isGlobal ? t("hint-global") : scopeHint }}
                    </p>
                </div>
            </div>

            <div v-if="!isGlobal" class="feature__row">
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

            <div v-if="options.length > 0" class="feature__row">
                <span class="field-label">{{ t("feature-options") }}</span>
                <div class="option" v-for="option in options" :key="option.key">
                    <span class="option__label">{{ option.label }}</span>
                    <select
                        class="select"
                        :aria-label="option.label"
                        :value="settings.options?.[option.key] ?? option.default"
                        @change="setOption(option.key, $event)"
                    >
                        <option
                            v-for="choice in option.values"
                            :key="choice.value"
                            :value="choice.value"
                        >
                            {{ choice.label }}
                        </option>
                    </select>
                    <p v-if="option.selectedDescription" class="option__detail">
                        {{ option.selectedDescription }}
                    </p>
                    <p v-if="option.note" class="hint">{{ option.note }}</p>
                    <p v-if="policyUnsupported" class="error">
                        {{ t("policy-not-supported") }}
                    </p>
                    <p v-if="option.mismatch" class="error">
                        {{ option.mismatch }}
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

.option {
    display: grid;
    gap: 6px;
}

.option__label {
    color: var(--text-muted);
    font-size: 12.5px;
}

.option__detail {
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-muted);
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
