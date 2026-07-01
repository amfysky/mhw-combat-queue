<script setup lang="ts">
import { ref } from 'vue'
import { TrashOutline, EyeOutline, EyeOffOutline, HourglassOutline } from '@vicons/ionicons5'
import type { Monster, QueueItem } from '../../types'
import { resolveMonsterImage } from '../../utils/monster'

// 纯展示组件：仅负责渲染与交互，队列的增删/持久化/广播由 useQueue 统一处理。
defineProps<{
  monsters: Monster[]
  queue: QueueItem[]
}>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
  (e: 'clear'): void
}>()

const isQueueVisible = ref(false)

const toggleQueueVisibility = () => {
  isQueueVisible.value = !isQueueVisible.value
  window.electron?.toggleQueueWindow(isQueueVisible.value)
}
</script>

<template>
  <n-card title="当前队列" class="panel-card" content-style="height: 0; flex: 1;">
    <template #header-extra>
      <n-flex :wrap="false" align="center" size="small">
        <n-button :type="isQueueVisible ? 'default' : 'primary'" size="small" @click="toggleQueueVisibility">
          <template #icon>
            <n-icon>
              <EyeOffOutline v-if="isQueueVisible" />
              <EyeOutline v-else />
            </n-icon>
          </template>
          {{ isQueueVisible ? '隐藏' : '显示' }}
        </n-button>
        <n-popconfirm @positive-click="emit('clear')">
          <template #trigger>
            <n-button type="error" size="small" secondary>
              <template #icon>
                <n-icon>
                  <TrashOutline />
                </n-icon>
              </template>
              清空
            </n-button>
          </template>
          确认清空？
        </n-popconfirm>
      </n-flex>
    </template>

    <n-scrollbar>
      <n-empty v-if="!queue.length" description="暂无点怪，等待观众发送弹幕" class="mt-16">
        <template #icon>
          <n-icon><HourglassOutline /></n-icon>
        </template>
      </n-empty>
      <n-flex v-else vertical>
        <n-flex v-for="(item, index) in queue" :key="item.uid" :wrap="false" justify="space-between" align="center"
          class="queue-row">
          <n-flex :wrap="false" align="center" size="small" class="min-w-0">
            <div class="rank">{{ index + 1 }}</div>
            <n-avatar :src="item.face" round :size="36" />
            <n-ellipsis class="text-base font-semibold" style="max-width: 100px;">
              {{ item.username }}
            </n-ellipsis>
          </n-flex>
          <n-flex :wrap="false" align="center" size="small">
            <span class="text-base font-semibold text-nowrap">{{ item.content }}</span>
            <n-image :src="resolveMonsterImage(monsters, item.content)" width="46" height="46" object-fit="cover"
              class="rounded-lg overflow-hidden" />
          </n-flex>
          <n-button type="error" size="small" quaternary @click="emit('remove', index)">
            移除
          </n-button>
        </n-flex>
      </n-flex>
    </n-scrollbar>
  </n-card>
</template>

<style scoped>
.queue-row {
  padding: 10px 12px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
  border-radius: 12px;
  margin-bottom: 8px;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}

.queue-row:hover {
  background: #ffffff;
  transform: translateX(2px);
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}

.rank {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f5aed;
  font-weight: 700;
  font-size: 12px;
}
</style>
