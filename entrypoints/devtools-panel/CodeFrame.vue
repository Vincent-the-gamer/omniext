<template>
    <div class="code-frame">
        <div ref="body" class="code-frame__body">
            <slot />
            <div v-if="ticks.length" class="code-frame__rail">
                <button
                    v-for="(tick, index) in ticks"
                    :key="tick.key"
                    class="code-frame__tick"
                    :class="{
                        'code-frame__tick--active': index === activeTick,
                    }"
                    type="button"
                    :style="{ top: tick.top + '%' }"
                    :title="tick.title"
                    :aria-label="tick.title"
                    @click="jumpHit(tick.hitStart, true)"
                ></button>
            </div>
        </div>
        <div v-if="hits.length" class="code-frame__nav">
            <button
                class="code-frame__step"
                type="button"
                :title="t('devtools-match-prev')"
                :aria-label="t('devtools-match-prev')"
                @click="step(-1)"
            >
                ▲
            </button>
            <span
                class="code-frame__count"
                :title="t('devtools-match-total', { total: hits.length })"
                >{{ current }} / {{ hits.length }}</span
            >
            <button
                class="code-frame__step"
                type="button"
                :title="t('devtools-match-next')"
                :aria-label="t('devtools-match-next')"
                @click="step(1)"
            >
                ▼
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
} from "vue";
import { useLocale } from "@/composables/use-locale";

/**
 * 带「命中刻度」的代码块容器。
 *
 * 槽位里放 `<pre class="code-block">`，关键词由父组件的 `markInHtml`
 * 包成 `<mark class="hl">`。组件会在代码块自己的滚动条上，按每处命中在
 * 全文里的相对位置叠上一根刻度：看到刻度就知道命中在哪一段，点一下就能
 * 跳过去，不必再自己一路翻。代码块下方还会给出「第几处 / 共几处」和
 * 上下跳转按钮。
 *
 * 刻度直接覆盖在原生滚动条上（`pointer-events` 只开在刻度本体），因此
 * 不会额外占用代码宽度，也不会挡住滚动条其余部分的拖拽。
 */
const props = defineProps<{ query?: string }>();

interface Hit {
    top: number;
    mark: HTMLElement;
}

interface Tick {
    key: number;
    /** 相对全文高度的百分比。 */
    top: number;
    title: string;
    /** 这根刻度覆盖的命中区间（同一行上的多个命中合并成一根）。 */
    hitStart: number;
    hitEnd: number;
}

/** 间距小于这个百分比的命中合并成一根刻度，避免糊成一条线。 */
const MIN_GAP = 1;
/** 刻度上限，防止超大正文里画几千根刻度拖慢渲染。 */
const MAX_TICKS = 400;
/** 测量时最多检查这么多处命中，超出部分不再采样。 */
const MAX_SCAN = 6000;

const { t } = useLocale();

const body = ref<HTMLElement | null>(null);
const pre = ref<HTMLElement | null>(null);
const hits = shallowRef<Hit[]>([]);
const ticks = shallowRef<Tick[]>([]);
const active = ref(-1);

let observer: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let measureFrame = 0;
/** 上一次渲染的第一个命中，用来判断内容是否换了。 */
let firstMark: HTMLElement | null = null;

const current = computed(() => (active.value >= 0 ? active.value + 1 : 1));

/** 当前命中落在哪根刻度上。 */
const activeTick = computed(() => {
    const index = active.value;
    if (index < 0) return -1;
    return ticks.value.findIndex(
        (tick) => index >= tick.hitStart && index <= tick.hitEnd,
    );
});

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

function tickTitle(mark: HTMLElement): string {
    const text = (mark.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "…";
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

/** 命中相对滚动内容顶部的偏移（px）。 */
function markOffset(el: HTMLElement, mark: HTMLElement): number {
    return (
        mark.getBoundingClientRect().top -
        el.getBoundingClientRect().top -
        el.clientTop +
        el.scrollTop
    );
}

/** 找到槽位里的 `<pre>`，内容或节点换了就重新挂监听。 */
function resolvePre(): HTMLElement | null {
    const next = body.value?.querySelector<HTMLElement>("pre") ?? null;
    if (next === pre.value) return next;

    observer?.disconnect();
    resizeObserver?.disconnect();

    pre.value = next;

    if (next) {
        observer?.observe(next, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        resizeObserver?.observe(next);
    }

    return next;
}

function clearActive(): void {
    hits.value[active.value]?.mark.classList.remove("hl--active");
    active.value = -1;
}

function jumpHit(index: number, smooth: boolean): void {
    const el = pre.value;
    const hit = hits.value[index];
    if (!el || !hit) return;

    hits.value[active.value]?.mark.classList.remove("hl--active");
    if (hit.mark.isConnected) hit.mark.classList.add("hl--active");
    active.value = index;

    el.scrollTo({
        top: Math.max(0, markOffset(el, hit.mark) - el.clientHeight * 0.35),
        behavior: smooth ? "smooth" : "auto",
    });
}

function step(delta: number): void {
    const total = hits.value.length;
    if (!total) return;

    const start = active.value < 0 ? 0 : active.value;
    jumpHit((start + delta + total) % total, true);
}

function measure(): void {
    const el = resolvePre();
    if (!el) return;

    const marks = el.querySelectorAll<HTMLElement>("mark.hl");
    const total = el.scrollHeight;

    if (!marks.length || total <= 0) {
        clearActive();
        hits.value = [];
        ticks.value = [];
        firstMark = null;
        return;
    }

    const nextHits: Hit[] = [];
    const nextTicks: Tick[] = [];
    const scanned = Math.min(marks.length, MAX_SCAN);

    for (let index = 0; index < scanned; index += 1) {
        const mark = marks[index];
        if (!mark) break;

        const top = clamp((markOffset(el, mark) / total) * 100, 0, 100);
        const hitIndex = nextHits.length;
        nextHits.push({ top, mark });

        const last = nextTicks[nextTicks.length - 1];
        if (last && top - last.top < MIN_GAP) {
            last.hitEnd = hitIndex;
            continue;
        }

        nextTicks.push({
            key: nextTicks.length,
            top,
            title: tickTitle(mark),
            hitStart: hitIndex,
            hitEnd: hitIndex,
        });
        if (nextTicks.length >= MAX_TICKS) break;
    }

    // 换了请求或改了关键词：内容被重新渲染，就自动跳到第一处命中。
    const changed = marks[0] !== firstMark;
    if (changed) {
        clearActive();
        firstMark = marks[0] ?? null;
    }

    hits.value = nextHits;
    ticks.value = nextTicks;

    if (changed) jumpHit(0, false);
}

function scheduleMeasure(): void {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
        measureFrame = 0;
        measure();
    });
}

watch(
    () => props.query,
    () => scheduleMeasure(),
);

onMounted(() => {
    observer = new MutationObserver(() => scheduleMeasure());
    resizeObserver = new ResizeObserver(() => scheduleMeasure());
    resolvePre();
    scheduleMeasure();
});

onBeforeUnmount(() => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    if (measureFrame) cancelAnimationFrame(measureFrame);
    clearActive();
});
</script>

<style scoped>
.code-frame {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.code-frame__body {
    position: relative;
    min-width: 0;
}

/* 槽位内容在父组件作用域里，这里只需要压住它的最小宽度。 */
.code-frame__body :deep(pre) {
    min-width: 0;
}

.code-frame__rail {
    position: absolute;
    top: 2px;
    right: 1px;
    bottom: 2px;
    width: 10px;
    pointer-events: none;
}

.code-frame__tick {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(252, 161, 48, 0.85);
    box-shadow: 0 0 0 1px rgba(11, 13, 16, 0.6);
    transform: translateY(-50%);
    pointer-events: auto;
    cursor: pointer;
}

/* 刻度本体只有 4px 高，用伪元素把点击热区撑大一点。 */
.code-frame__tick::before {
    content: "";
    position: absolute;
    left: -3px;
    right: -3px;
    top: -5px;
    bottom: -5px;
}

.code-frame__tick:hover,
.code-frame__tick--active {
    background: #ffd08a;
    box-shadow:
        0 0 0 1px rgba(255, 244, 224, 0.9),
        0 0 8px rgba(252, 161, 48, 0.9);
}

.code-frame__nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    height: 18px;
    color: var(--ni-muted);
    font-size: 11px;
}

.code-frame__step {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--ni-muted);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
}

.code-frame__step:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--ni-text);
}

.code-frame__count {
    min-width: 40px;
    color: var(--ni-muted);
    text-align: center;
    font-variant-numeric: tabular-nums;
}
</style>
