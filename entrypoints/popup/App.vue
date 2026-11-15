<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { browser } from "#imports";
import ToggleSwitch from "@/components/ToggleSwitch.vue";
import { useFeatures, type FeatureRow } from "@/composables/use-features";
import { APP_AUTHOR, APP_VERSION } from "@/utils/app";
import {
    isFeatureActive,
    matchedRules,
    settingsForHost,
    type FeatureSettings,
} from "@/utils/feature-settings";
import { PAGE_INFO_MESSAGE, type PageInfo } from "@/utils/messaging";

const manifest = browser.runtime.getManifest() as {
    version: string;
    author?: string;
};
const { rows, update } = useFeatures();

const version = APP_VERSION;
const author = APP_AUTHOR;

const page = ref<PageInfo | null>(null);
const hostname = computed(() => page.value?.hostname ?? "");
const activeCount = computed(
    () =>
        rows.value.filter((row) =>
            isFeatureActive(row.settings, hostname.value),
        ).length,
);

onMounted(async () => {
    page.value = await requestPageInfo();
});

async function requestPageInfo(): Promise<PageInfo | null> {
    try {
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (tab?.id === undefined) return null;

        const info = await browser.tabs.sendMessage(
            tab.id,
            { type: PAGE_INFO_MESSAGE },
            { frameId: 0 },
        );

        const result = (info as PageInfo | undefined) ?? null;
        return result?.hostname ? result : null;
    } catch {
        // 浏览器内置页面、扩展商店等没有内容脚本
        return null;
    }
}

function isActiveHere(settings: FeatureSettings): boolean {
    return isFeatureActive(settings, hostname.value);
}

function statusOf(settings: FeatureSettings): string {
    if (!settings.enabled) return "已关闭";
    if (!hostname.value) return "此页面不适用";
    return isActiveHere(settings) ? "本页生效" : "本页暂停";
}

function statusTone(settings: FeatureSettings): string {
    if (!settings.enabled) return "off";
    if (!hostname.value) return "muted";
    return isActiveHere(settings) ? "on" : "paused";
}

function scopeLabel(settings: FeatureSettings): string {
    if (settings.scope === "whitelist") return "白名单";
    if (settings.scope === "blacklist") return "黑名单";
    return "全部网站";
}

/** 当前域名命中的规则，只显示真正起作用的那些。 */
function hitRules(settings: FeatureSettings): string[] {
    if (settings.scope === "all") return [];
    return matchedRules(settings, hostname.value);
}

function toggleHere(row: FeatureRow): void {
    if (!hostname.value) return;
    void update(row, settingsForHost(row.settings, hostname.value));
}

async function openOptions(): Promise<void> {
    try {
        await browser.runtime.openOptionsPage();
    } catch {
        // openOptionsPage 不可用时，退回到直接打开扩展内的设置页
        await browser.tabs.create({
            url: browser.runtime.getURL("/options.html"),
        });
    } finally {
        // 必须等浏览器处理完打开请求再关闭弹窗，
        // 否则弹窗上下文先被销毁，请求会被丢弃。
        window.close();
    }
}
</script>

<template>
    <div class="popup">
        <header class="head">
            <img
                class="head__logo"
                src="/icon/48.png"
                alt=""
                width="30"
                height="30"
            />

            <div class="head__text">
                <div class="head__title">
                    <span class="head__name">Omniext</span>
                    <span class="head__version">v{{ version }}</span>
                </div>
                <span v-if="author" class="head__author">{{ author }}</span>
            </div>

            <button
                class="btn btn--sm head__settings"
                type="button"
                @click="openOptions"
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="3" />
                    <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    />
                </svg>
                设置
            </button>
        </header>

        <div class="site">
            <span class="site__label">当前网站</span>
            <span v-if="hostname" class="site__host" :title="page?.url">{{
                hostname
            }}</span>
            <span v-else class="site__host site__host--muted"
                >浏览器内置页面</span
            >
            <span v-if="hostname" class="site__count"
                >{{ activeCount }}/{{ rows.length }} 生效</span
            >
        </div>

        <div class="scroll">
            <ul class="list">
                <li
                    v-for="row in rows"
                    :key="row.feature.id"
                    class="card feature"
                >
                    <div class="feature__head">
                        <span class="feature__icon" aria-hidden="true">{{
                            row.feature.icon
                        }}</span>

                        <div class="feature__intro">
                            <h2 class="feature__name">
                                {{ row.feature.name }}
                            </h2>
                            <p class="feature__desc">
                                {{ row.feature.description }}
                            </p>
                        </div>

                        <ToggleSwitch
                            :model-value="row.settings.enabled"
                            :label="`${row.feature.name} 总开关`"
                            @update:model-value="
                                update(row, { enabled: $event })
                            "
                        />
                    </div>

                    <div class="feature__meta">
                        <span
                            class="state"
                            :class="`state--${statusTone(row.settings)}`"
                        >
                            {{ statusOf(row.settings) }}
                        </span>
                        <span class="dot" aria-hidden="true">·</span>
                        <span class="scope">{{
                            scopeLabel(row.settings)
                        }}</span>
                        <span
                            v-for="rule in hitRules(row.settings)"
                            :key="rule"
                            class="chip chip--accent"
                        >
                            {{ rule }}
                        </span>
                        <span
                            v-if="
                                row.settings.scope !== 'all' &&
                                hitRules(row.settings).length === 0
                            "
                            class="scope"
                        >
                            未命中规则
                        </span>

                        <button
                            v-if="hostname && row.settings.enabled"
                            class="link feature__action"
                            type="button"
                            @click="toggleHere(row)"
                        >
                            {{
                                isActiveHere(row.settings)
                                    ? "暂停本页"
                                    : "在本页启用"
                            }}
                        </button>
                    </div>
                </li>
            </ul>
        </div>

        <footer class="foot">
            <span>设置自动保存，页面即时生效</span>
        </footer>
    </div>
</template>

<style scoped>
.popup {
    display: flex;
    flex-direction: column;
    height: 100%;
}

/* ---------- 顶栏 ---------- */

.head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
}

.head__logo {
    flex: none;
    border-radius: 8px;
}

.head__text {
    flex: 1;
    min-width: 0;
}

.head__title {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.head__name {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
}

.head__version {
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--text-faint);
}

.head__author {
    display: block;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-faint);
}

.head__settings {
    flex: none;
}

/* ---------- 当前网站 ---------- */

.site {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    margin: 12px 16px 0;
    padding: 8px 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.02);
}

.site__label {
    flex: none;
    font-size: 11.5px;
    color: var(--text-faint);
}

.site__host {
    flex: 1;
    min-width: 0;
    font-size: 12.5px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.site__host--muted {
    color: var(--text-faint);
    font-weight: 400;
}

.site__count {
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-faint);
}

/* ---------- 功能列表（内容多了在这里滚动） ---------- */

.scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 16px 14px;
}

.list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.feature {
    padding: 13px 14px;
}

.feature__head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
}

.feature__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.04);
    font-size: 15px;
    line-height: 1;
}

.feature__intro {
    flex: 1;
    min-width: 0;
}

.feature__name {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
}

.feature__desc {
    margin: 3px 0 0;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-muted);
}

.feature__head :deep(.toggle) {
    margin-top: 5px;
}

.feature__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 11px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
}

.state {
    font-size: 11.5px;
    font-weight: 500;
}

.state--on {
    color: var(--accent);
}

.state--paused {
    color: var(--amber);
}

.state--off,
.state--muted {
    color: var(--text-faint);
}

.dot {
    font-size: 11px;
    color: var(--text-faint);
}

.scope {
    font-size: 11.5px;
    color: var(--text-faint);
}

.feature__action {
    margin-left: auto;
}

.link {
    padding: 0;
    border: 0;
    background: none;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 160ms ease;
}

.link:hover {
    color: var(--accent);
}

/* ---------- 页脚 ---------- */

.foot {
    flex: none;
    padding: 10px 16px 12px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    text-align: center;
    color: var(--text-faint);
}
</style>
