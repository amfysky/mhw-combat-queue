<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { type QueueItem, type QueueConfig, type Monster } from '../types'
import { onQueueUpdate, onConfigUpdate, onMonsterUpdate } from '../utils/broadcast'
import { loadConfig } from '../utils/config'
import { resolveMonsterImage } from '../utils/monster'
import { useAutoScroll } from '../composables/useAutoScroll'
import { db } from '../utils/db'

const queue = ref<QueueItem[]>([])
const config = ref<QueueConfig>(loadConfig())
const monsters = ref<Monster[]>([])

const scrollContainer = ref<HTMLElement | null>(null)
const { start, stop, reset } = useAutoScroll(scrollContainer, {
  speed: 0.68,
  pauseDuration: 3000,
})

const handleResize = () => {
  stop()
  reset()
  start()
}

onMounted(async () => {
  document.title = '点怪机 - 队列'
  start()
  window.addEventListener('resize', handleResize)
  onQueueUpdate((newQueue) => {
    queue.value = newQueue
    reset()
  })
  onConfigUpdate((newConfig) => {
    config.value = newConfig
  })
  onMonsterUpdate((newMonsters) => {
    monsters.value = newMonsters
  })
  try {
    monsters.value = await db.getAllMonsters()
  } catch (error) {
    console.error('Failed to load monsters:', error)
  }
})

onUnmounted(() => {
  stop()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <n-flex vertical class="root w-screen h-screen overflow-hidden p-5 box-border">
    <n-marquee class="title">
      {{ config.queueTitle }}
    </n-marquee>
    <div ref="scrollContainer" class="queue-container flex-1 overflow-hidden">
      <n-flex vertical :size="10">
        <n-flex v-for="(item, index) in queue" :key="index" :wrap="false" justify="space-between" align="center"
          class="queue-item" :class="{ 'is-next': index === 0 }">
          <n-flex :wrap="false" align="center" size="small" class="min-w-0">
            <div class="rank">{{ index + 1 }}</div>
            <n-avatar :src="item.face" round :size="40" class="q-avatar" />
            <n-ellipsis class="q-name text-xl font-bold" style="max-width: 100px;">
              {{ item.username }}
            </n-ellipsis>
          </n-flex>
          <n-flex :wrap="false" align="center" size="small">
            <n-image :src="resolveMonsterImage(monsters, item.content)" width="50" height="50" object-fit="cover"
              class="q-monster-img rounded-lg overflow-hidden" />
            <span class="q-monster text-xl font-bold text-nowrap">{{ item.content }}</span>
          </n-flex>
        </n-flex>
        <div class="footer">
          <span>{{ queue.length > 0 ? '到底啦~' : '队列为空' }}</span>
        </div>
      </n-flex>
    </div>
  </n-flex>
</template>

<style lang="scss" scoped>
@use "../styles/functions.scss" as *;

.root {
  -webkit-app-region: drag;
  user-select: none;
  pointer-events: none;
  background-color: v-bind('config.backgroundColor');
}

.queue-container {
  overflow-y: auto;

  /* Hide scrollbar for Chrome, Safari and Opera */
  &::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding-bottom: 6px;
  color: v-bind('config.textColor');
  text-shadow: drawTextShadow(1, v-bind('config.strokeColor'));
}

.queue-item {
  padding: 12px 14px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, rgba(20, 20, 26, 0.78), rgba(20, 20, 26, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
}

/* 队首（即将开打的目标）高亮 */
.queue-item.is-next {
  background: linear-gradient(135deg, rgba(58, 44, 12, 0.82), rgba(30, 24, 10, 0.64));
  border-color: rgba(255, 200, 90, 0.45);
  box-shadow: 0 8px 24px rgba(255, 160, 40, 0.18), 0 6px 18px rgba(0, 0, 0, 0.3);
}

.rank {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
}

.queue-item.is-next .rank {
  background: linear-gradient(135deg, #ffd76f, #ff9f43);
  color: #3a2a00;
  box-shadow: 0 0 0 3px rgba(255, 190, 80, 0.28);
}

.q-avatar {
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
}

.q-name,
.q-monster {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
}

.q-monster-img {
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.footer {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
}
</style>
