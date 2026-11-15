<script lang="ts" setup>
import { computed } from "vue";
import CursorGlow from "@/components/CursorGlow.vue";
import FeatureCard from "@/components/FeatureCard.vue";
import { useFeatures } from "@/composables/use-features";
import { APP_AUTHOR, APP_VERSION } from "@/utils/app";

const { rows, ready, update } = useFeatures();

const version = APP_VERSION;
const author = APP_AUTHOR;
const enabledCount = computed(
    () => rows.value.filter((row) => row.settings.enabled).length,
);
const ruleCount = computed(() =>
    rows.value.reduce((total, row) => total + row.settings.rules.length, 0),
);
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
                <span class="nav__name">Omniext</span>
                <span class="nav__version">v{{ version }}</span>
                <span class="nav__author">by {{ author }}</span>
            </div>
            <span class="nav__state"
                >{{ enabledCount }} / {{ rows.length }} 个功能已启用</span
            >
        </header>

        <main class="main">
            <section class="hero">
                <span class="badge" data-enter>
                    <span class="badge__dot" aria-hidden="true" />
                    {{
                        ruleCount > 0
                            ? `${ruleCount} 条域名规则`
                            : "当前不限制域名"
                    }}
                </span>

                <h1 class="hero__title" data-enter>
                    功能<br /><span>控制台</span>
                </h1>

                <p class="hero__lede" data-enter>
                    每个功能单独开关，按域名规则决定在哪些网站上生效。改动即时保存，已经打开的页面无需刷新。
                </p>
            </section>

            <section
                class="features"
                data-enter
                aria-labelledby="features-title"
            >
                <div class="features__head">
                    <h2 id="features-title">功能</h2>
                    <span>{{ rows.length }} 项</span>
                </div>

                <p v-if="!ready" class="loading">正在读取设置…</p>

                <div v-else class="features__list">
                    <FeatureCard
                        v-for="row in rows"
                        :key="row.feature.id"
                        :feature="row.feature"
                        :settings="row.settings"
                        @change="update(row, $event)"
                    />
                </div>
            </section>
        </main>

        <footer class="footer">
            <span>设置保存在浏览器本地，不会上传</span>
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
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
}

.features__head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
}

.features__head span {
    font-size: 12.5px;
    color: var(--text-faint);
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
