<script lang="ts" setup>
defineProps<{
  modelValue: boolean;
  /** 供读屏使用的名称。 */
  label: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    class="toggle"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="toggle__knob" />
  </button>
</template>

<style scoped>
.toggle {
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition:
    background 200ms ease,
    border-color 200ms ease;
}

.toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #9aa0a8;
  transition:
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background 200ms ease;
}

.toggle:hover {
  border-color: rgba(255, 255, 255, 0.28);
}

.toggle[aria-checked='true'] {
  border-color: transparent;
  background: var(--accent);
}

.toggle[aria-checked='true'] .toggle__knob {
  transform: translateX(18px);
  background: #fff;
}
</style>
