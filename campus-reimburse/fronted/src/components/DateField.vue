<template>
  <a-date-picker
    :value="modelValue || undefined"
    value-format="YYYY-MM-DD"
    :disabled="disabled"
    :placeholder="placeholder"
    :allow-clear="allowClear"
    style="width: 100%"
    @update:value="onChange"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string
    disabled?: boolean
    placeholder?: string
    allowClear?: boolean
  }>(),
  { modelValue: '', placeholder: '选择日期', allowClear: true }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()
function onChange(v: string | undefined) {
  emit('update:modelValue', v || '')
}
</script>
