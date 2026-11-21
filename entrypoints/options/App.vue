<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import CursorGlow from "@/components/CursorGlow.vue";
import FeatureCard from "@/components/FeatureCard.vue";
import LanguageSwitch from "@/components/LanguageSwitch.vue";
import SearchField from "@/components/SearchField.vue";
import { useFeatures } from "@/composables/use-features";
import { useLocale } from "@/composables/use-locale";
import { APP_AUTHOR, APP_REPO_URL, APP_VERSION } from "@/utils/app";
import {
    BackupError,
    createBackup,
    importBackup,
    saveBackup,
} from "@/utils/config-backup";
import { matchesFeatureQuery } from "@/utils/feature-search";

const { locale, setLocale, t } = useLocale();
const { rows, ready, update } = useFeatures();

const version = APP_VERSION;
const author = APP_AUTHOR;
const repoUrl = APP_REPO_URL;
const enabledCount = computed(
    () => rows.value.filter((row) => row.settings.enabled).length,
);
const ruleCount = computed(() =>
    rows.value.reduce((total, row) => total + row.settings.rules.length, 0),
);

/** 搜索关键词，只过滤列表，不影响任何已保存的设置。 */
const query = ref("");
const visibleRows = computed(() =>
    rows.value.filter((row) =>
        matchesFeatureQuery(row.feature, locale.value, query.value),
    ),
);

/** 浏览器标签上的标题也要跟随语言。 */
function applyTitle(): void {
    document.title = `Omniext — ${t("settings")}`;
}
applyTitle();
watch(locale, applyTitle);

/** 导出/导入操作的提示；空字符串表示还没操作过。 */
const backupNote = ref("");
const backupFailed = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function setBackupNote(text: string, failed: boolean): void {
    backupNote.value = text;
    backupFailed.value = failed;
}

/** 导出：把当前设置写成 JSON 文件，重装或换浏览器后可以导回来。 */
async function exportConfig(): Promise<void> {
    try {
        const backup = await createBackup();
        saveBackup(backup);
        setBackupNote(
            t("config-exported", {
                count: Object.keys(backup.features).length,
            }),
            false,
        );
    } catch (error) {
        setBackupNote(
            t("config-failed", { reason: errorMessage(error) }),
            true,
        );
    }
}

function pickImport(): void {
    fileInput.value?.click();
}

async function importConfig(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // 清空 value，否则连续选同一个文件不会再触发 change。
    input.value = "";
    if (!file) return;

    try {
        const result = await importBackup(await file.text());
        setBackupNote(
            result.applied > 0
                ? t("config-imported", { count: result.applied })
                : t("config-import-empty"),
            false,
        );
    } catch (error) {
        if (error instanceof BackupError) {
            setBackupNote(
                t(
                    error.code === "unreadable"
                        ? "config-invalid-json"
                        : "config-invalid-format",
                ),
                true,
            );
            return;
        }
        setBackupNote(
            t("config-failed", { reason: errorMessage(error) }),
            true,
        );
    }
}
</script>

<template>
    <div class="page">
        <CursorGlow />

        <header class="nav">
            <div class="nav__brand">
                <img
                    class="nav__logo"
                    src="/icon/48.png"
                    alt=""
                    width="24"
                    height="24"
                />
                <a
                    class="nav__name"
                    :href="repoUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >Omniext</a
                >
                <span class="nav__version">v{{ version }}</span>
                <span class="nav__author">by {{ author }}</span>
            </div>
            <span class="nav__state">{{
                t("features-enabled", {
                    enabled: enabledCount,
                    total: rows.length,
                })
            }}</span>
            <LanguageSwitch :value="locale" @change="setLocale" />
        </header>

        <main class="main">
            <section class="hero">
                <span class="badge" data-enter>
                    <span class="badge__dot" aria-hidden="true" />
                    {{
                        ruleCount > 0
                            ? t("rule-count", { count: ruleCount })
                            : t("no-rule-limit")
                    }}
                </span>

                <h1 class="hero__title" data-enter>
                    {{ t("hero-line1") }}<br /><span>{{
                        t("hero-line2")
                    }}</span>
                </h1>

                <p class="hero__lede" data-enter>
                    {{ t("lede") }}
                </p>
            </section>

            <section
                class="features"
                data-enter
                aria-labelledby="features-title"
            >
                <div class="features__head">
                    <h2 id="features-title">{{ t("features-label") }}</h2>
                    <div class="features__tools">
                        <SearchField v-model="query" class="features__search" />
                        <span class="features__count">{{
                            query
                                ? t("search-match", {
                                      matched: visibleRows.length,
                                      total: rows.length,
                                  })
                                : t("feature-count", { count: rows.length })
                        }}</span>
                        <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            :disabled="!ready"
                            @click="exportConfig"
                        >
                            {{ t("config-export") }}
                        </button>
                        <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            :disabled="!ready"
                            @click="pickImport"
                        >
                            {{ t("config-import") }}
                        </button>
                        <input
                            ref="fileInput"
                            type="file"
                            accept="application/json,.json"
                            hidden
                            @change="importConfig"
                        />
                    </div>
                </div>

                <p
                    v-if="backupNote"
                    class="features__note"
                    :class="{ 'features__note--error': backupFailed }"
                    role="status"
                >
                    {{ backupNote }}
                </p>

                <p v-if="!ready" class="loading">{{ t("loading") }}</p>

                <div v-else class="features__list">
                    <FeatureCard
                        v-for="row in visibleRows"
                        :key="row.feature.id"
                        :feature="row.feature"
                        :settings="row.settings"
                        @change="update(row, $event)"
                    />
                </div>

                <div
                    v-if="ready && query && visibleRows.length === 0"
                    class="features__empty"
                    role="status"
                >
                    <p>{{ t("search-empty", { query }) }}</p>
                    <button
                        type="button"
                        class="btn btn--ghost btn--sm"
                        @click="query = ''"
                    >
                        {{ t("search-clear") }}
                    </button>
                </div>
            </section>
        </main>

        <footer class="footer">
            <span>{{ t("stored-note") }}</span>
            <span>Omniext v{{ version }}</span>
        </footer>
    </div>
</template>

<style scoped>
.page {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    max-width: 940px;
    margin: 0 auto;
    padding: 0 28px;
}

/* ---------- 顶栏 ---------- */

.nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 64px;
    flex: none;
}

.nav__brand {
    display: flex;
    align-items: center;
    gap: 9px;
}

.nav__logo {
    border-radius: 6px;
}

.nav__name {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-decoration: none;
    color: inherit;
}

.nav__name:hover {
    color: var(--accent);
}

.nav__version {
    padding: 1px 7px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: var(--text-faint);
}

.nav__state {
    font-size: 12.5px;
    color: var(--text-faint);
}

.nav__author {
    font-size: 12px;
    color: var(--text-faint);
}

/* ---------- Hero ---------- */

.main {
    flex: 1;
}

.hero {
    padding: 56px 0 44px;
}

.badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 12px;
    border: 1px solid rgba(0, 220, 130, 0.3);
    border-radius: 999px;
    background: var(--accent-soft);
    font-size: 12.5px;
    color: #63eda9;
}

.badge__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 3px rgba(0, 220, 130, 0.18);
}

.hero__title {
    margin: 22px 0 0;
    font-size: clamp(38px, 5.4vw, 60px);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.03em;
}

.hero__title span {
    color: var(--accent);
}

.hero__lede {
    max-width: 560px;
    margin: 20px 0 0;
    font-size: 15.5px;
    line-height: 1.75;
    color: var(--text-muted);
}

/* ---------- 功能 ---------- */

.features__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.features__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}

.features__tools .btn:disabled {
    opacity: 0.45;
    cursor: default;
}

.features__tools .btn:disabled:hover {
    background: transparent;
}

.features__count {
    margin-right: 2px;
    font-size: 12.5px;
    color: var(--text-faint);
}

.features__search {
    width: 200px;
}

.features__empty {
    margin-top: 18px;
    padding: 32px 20px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius);
    text-align: center;
}

.features__empty p {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
}

.features__empty .btn {
    margin-top: 10px;
}

.features__note {
    margin: 12px 0 0;
    font-size: 12.5px;
    color: var(--accent);
}

.features__note--error {
    color: var(--amber);
}

.features__head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
}

.features__list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 18px;
}

.loading {
    margin: 20px 0 0;
    font-size: 13px;
    color: var(--text-faint);
}

/* ---------- 页脚 ---------- */

.footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px;
    margin-top: 56px;
    padding: 20px 0 28px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-faint);
}

/* ---------- 入场动效 ---------- */

[data-enter] {
    animation: rise 560ms cubic-bezier(0.22, 0.7, 0.2, 1) both;
}

[data-enter]:nth-child(2) {
    animation-delay: 70ms;
}

[data-enter]:nth-child(3) {
    animation-delay: 140ms;
}

@keyframes rise {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: none;
    }
}

@media (max-width: 720px) {
    .page {
        padding: 0 18px;
    }

    .hero {
        padding: 40px 0 32px;
    }

    .nav__state {
        display: none;
    }

    .nav__author {
        display: none;
    }
}
</style>
