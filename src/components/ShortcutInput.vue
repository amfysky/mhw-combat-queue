<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 快捷键录制输入框：聚焦后按下组合键即被捕获，转换为 Electron accelerator 字符串
 * （如 `CommandOrControl+Shift+D`）。只读展示，配「清除」按钮取消设置。
 *
 * 为避免全局快捷键误吞普通按键，字母/数字/符号必须搭配至少一个修饰键；功能键
 * （F1–F24）可单独作为快捷键。
 */
const props = defineProps<{ value: string }>()
const emit = defineEmits<{ 'update:value': [string] }>()

const recording = ref(false)
const warning = ref('')
// NInput 实例，用于捕获成功/取消后主动失焦。
const inputRef = ref<{ blur: () => void } | null>(null)

// 将展示字符串友好化：CommandOrControl → Ctrl，Super → Win。
const display = computed(() =>
  props.value
    ? props.value.replace('CommandOrControl', 'Ctrl').replace('Super', 'Win')
    : ''
)

const placeholder = computed(() =>
  recording.value ? '请按下快捷键组合…' : '点击此处设置快捷键'
)

/** 将 KeyboardEvent.code 映射为 Electron accelerator 主键，无法识别返回 null。 */
function codeToKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3) // KeyD -> D
  if (/^Digit\d$/.test(code)) return code.slice(5) // Digit1 -> 1
  if (/^Numpad\d$/.test(code)) return 'num' + code.slice(6) // Numpad1 -> num1
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code // F1–F24
  const map: Record<string, string> = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Space: 'Space', Enter: 'Return', Tab: 'Tab',
    Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Backquote: '`',
  }
  return map[code] ?? null
}

function onFocus() {
  recording.value = true
  warning.value = ''
}

function onBlur() {
  recording.value = false
  warning.value = ''
}

function onKeydown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  // Esc 取消录制，保持原值。
  if (e.code === 'Escape') {
    inputRef.value?.blur()
    return
  }
  const key = codeToKey(e.code)
  if (!key) return // 仅按下修饰键，等待主键

  const isFunctionKey = /^F([1-9]|1\d|2[0-4])$/.test(key)
  const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
  if (!isFunctionKey && !hasModifier) {
    warning.value = '请至少包含一个修饰键（Ctrl / Alt / Shift）'
    return
  }

  const parts: string[] = []
  if (e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  parts.push(key)

  warning.value = ''
  emit('update:value', parts.join('+'))
  inputRef.value?.blur()
}

function clear() {
  emit('update:value', '')
}
</script>

<template>
  <div>
    <n-input-group>
      <n-input
        ref="inputRef"
        readonly
        :value="display"
        :placeholder="placeholder"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <n-button v-if="value" tertiary @click="clear">清除</n-button>
    </n-input-group>
    <p v-if="warning" class="shortcut-warning">{{ warning }}</p>
  </div>
</template>

<style scoped>
.shortcut-warning {
  margin: 4px 0 0;
  font-size: 12px;
  color: #d03050;
}
</style>
