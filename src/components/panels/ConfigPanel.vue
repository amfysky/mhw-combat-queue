<script setup lang="ts">
import { type QueueConfig } from '../../types'
import ShortcutInput from '../ShortcutInput.vue'

// 纯展示组件：直接编辑传入的响应式 config，
// 持久化与广播由 useConfig 统一处理（此前此处与 ControlPanel 重复 watch）。
defineProps<{
  config: QueueConfig
}>()
</script>

<template>
  <n-card title="配置面板" class="panel-card">
    <n-form label-placement="top" :show-feedback="false" size="small">
      <n-flex vertical :size="18">
        <n-form-item label="队列标题">
          <n-input v-model:value="config.queueTitle" placeholder="请输入队列标题" />
        </n-form-item>

        <n-flex :wrap="false">
          <n-form-item label="文字颜色" class="flex-1">
            <n-color-picker v-model:value="config.textColor" />
          </n-form-item>
          <n-form-item label="描边颜色" class="flex-1">
            <n-color-picker v-model:value="config.strokeColor" />
          </n-form-item>
          <n-form-item label="背景颜色" class="flex-1">
            <n-color-picker v-model:value="config.backgroundColor" />
          </n-form-item>
        </n-flex>

        <n-flex :wrap="false">
          <n-form-item label="窗口宽度" class="flex-1">
            <n-input-number v-model:value="config.width" :min="100" class="w-full" />
          </n-form-item>
          <n-form-item label="窗口高度" class="flex-1">
            <n-input-number v-model:value="config.height" :min="100" class="w-full" />
          </n-form-item>
        </n-flex>

        <n-form-item label="移除队首快捷键">
          <ShortcutInput v-model:value="config.removeFirstShortcut" />
        </n-form-item>
      </n-flex>
    </n-form>
  </n-card>
</template>
