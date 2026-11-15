<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";

/** 跟随鼠标的柔光；触屏或“减少动态效果”下不启用。 */
const glow = ref<HTMLElement | null>(null);

let frame = 0;
let listener: ((event: PointerEvent) => void) | null = null;

onMounted(() => {
    const element = glow.value;
    if (!element) return;

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || coarsePointer) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let targetX = x;
    let targetY = y;

    const render = () => {
        x += (targetX - x) * 0.1;
        y += (targetY - y) * 0.1;
        element.style.transform = `translate3d(${x - 240}px, ${y - 240}px, 0)`;
        frame = requestAnimationFrame(render);
    };

    listener = (event: PointerEvent) => {
        targetX = event.clientX;
        targetY = event.clientY;
    };

    window.addEventListener("pointermove", listener, { passive: true });
    frame = requestAnimationFrame(render);
});

onUnmounted(() => {
    if (listener) window.removeEventListener("pointermove", listener);
    if (frame) cancelAnimationFrame(frame);
});
</script>

<template>
    <div ref="glow" class="cursor-glow" aria-hidden="true" />
</template>

<style scoped>
.cursor-glow {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1;
    width: 480px;
    height: 480px;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(
        circle,
        rgba(255, 255, 255, 0.06) 0%,
        rgba(0, 220, 130, 0.05) 35%,
        transparent 68%
    );
    filter: blur(20px);
    will-change: transform;
}
</style>
