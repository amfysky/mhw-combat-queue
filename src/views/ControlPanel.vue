<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { truncate } from 'lodash'
import { RefreshOutline, LogOutOutline } from '@vicons/ionicons5'
import { type Monster, type QueueItem } from '@/types'
import { findBestMatchMonster } from '@/utils/monster'
import { CHANNELS } from '@/channels/meta'
import { useConfig } from '@/composables/useConfig'
import { useChannels } from '@/composables/useChannels'
import { useMonsters } from '@/composables/useMonsters'
import { useQueue } from '@/composables/useQueue'
import MonsterModal from '../components/modals/MonsterModal.vue'
import ConfigPanel from '../components/panels/ConfigPanel.vue'
import ChannelPanel from '../components/panels/ChannelPanel.vue'
import MonsterPanel from '../components/panels/MonsterPanel.vue'
import QueuePanel from '../components/panels/QueuePanel.vue'
import TestPanel from '../components/panels/TestPanel.vue'

const $message = useMessage()

const { config, reset: resetConfig } = useConfig()
const { settings: channelSettings } = useChannels()
const { monsters, load: loadMonsters } = useMonsters()
const { queue, add: addToQueue, remove: removeFromQueue, clear: clearQueue, restore: restoreQueue } = useQueue()

// 展示窗口尺寸固定，由通用配置驱动：变更时（含首次）下发到主进程设置窗口大小。
watch(
  () => [config.width, config.height] as const,
  ([w, h]) => window.electron?.setQueueSize(w, h),
  { immediate: true }
)

// 处理直播弹幕：识别「点怪 xxx」，匹配怪物并按门槛入队
const handleLiveMessage = (_event: any, data: any) => {
  if (data.cmd !== 'DANMU_MSG' || !data.content.startsWith('点怪')) return

  const content = data.content.slice(2).trim()
  const item: QueueItem = {
    uid: data.uid,
    username: data.username,
    face: data.face,
    guardLevel: data.guardLevel,
    medalLevel: data.medalLevel,
    content: findBestMatchMonster(monsters.value, content)?.name || truncate(content, { length: 8 }),
    timestamp: Date.now()
  }

  // 按来源渠道各自的「等级能力」分别套用门槛：B站有舰长+勋章，抖音只有粉丝团。
  // 无该能力的维度直接放行（如抖音的舰长恒为 0，不参与过滤）。
  const meta = CHANNELS.find(c => c.id === data.channel)
  const cs = channelSettings[data.channel]
  const passGuard = !meta?.hasGuardLevel || !cs || item.guardLevel >= cs.minGuardLevel
  const passMedal = !meta?.medalLabel || !cs || item.medalLevel >= cs.minMedalLevel
  if (passGuard && passMedal) {
    addToQueue(item, cs?.allowJump ?? false)
  }
}

const handleTestMessage = (data: any) => handleLiveMessage(null, data)

// 怪物编辑弹窗
const showMonsterModal = ref(false)
const selectedMonster = ref<Monster>()

const handleEditMonster = (monster?: Monster) => {
  selectedMonster.value = monster || undefined
  showMonsterModal.value = true
}

const handleResetConfig = () => {
  resetConfig()
  $message.success('已恢复默认配置')
}

// 连接面板引用，用于从顶栏触发连接/登录态重置
const channelPanel = ref<{ reset: () => Promise<void> } | null>(null)

const handleResetConnection = async () => {
  await channelPanel.value?.reset()
  $message.success('已重置连接与登录态')
}

onMounted(async () => {
  window.electron?.live(handleLiveMessage)
  restoreQueue()
  try {
    await loadMonsters()
  } catch (error) {
    $message.error('加载怪物数据失败')
  }
})

onUnmounted(() => {
  window.electron?.unlisten('live', handleLiveMessage)
})
</script>

<template>
  <div class="control-panel">
    <header class="cp-header">
      <div class="cp-brand">
        <div class="cp-logo">狩</div>
        <div class="cp-titles">
          <h1 class="cp-title">点怪机 控制台</h1>
          <p class="cp-sub">MHW Combat Queue · 弹幕点怪管理</p>
        </div>
      </div>

      <n-flex :wrap="false" align="center" size="small">
        <n-popconfirm @positive-click="handleResetConnection">
          <template #trigger>
            <n-button secondary size="small">
              <template #icon>
                <n-icon>
                  <LogOutOutline />
                </n-icon>
              </template>
              重置连接
            </n-button>
          </template>
          确认断开连接并清除第三方登录态？下次连接需重新登录。
        </n-popconfirm>

        <n-popconfirm @positive-click="handleResetConfig">
          <template #trigger>
            <n-button secondary size="small">
              <template #icon>
                <n-icon>
                  <RefreshOutline />
                </n-icon>
              </template>
              重置配置
            </n-button>
          </template>
          确认将标题、颜色、门槛等配置恢复为默认？（不影响怪物与队列）
        </n-popconfirm>
      </n-flex>
    </header>

    <div class="cp-body">
      <div class="cp-side">
        <n-scrollbar>
          <n-flex vertical size="large" class="pr-3 pb-1">
            <ChannelPanel ref="channelPanel" :settings="channelSettings" />
            <ConfigPanel :config="config" />
            <TestPanel @send-test="handleTestMessage" />
          </n-flex>
        </n-scrollbar>
      </div>

      <MonsterPanel class="cp-grow" v-model:monsters="monsters" @edit="handleEditMonster" />
      <QueuePanel class="cp-grow" :queue="queue" :monsters="monsters" @remove="removeFromQueue"
        @clear="clearQueue" />
    </div>

    <MonsterModal v-model:show="showMonsterModal" :monsters="monsters" :monster="selectedMonster"
      @update:monsters="monsters = $event" />
  </div>
</template>

<style scoped>
.control-panel {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: linear-gradient(160deg, #f5f7fc 0%, #eceff7 100%);
}

.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid #e9ecf3;
  border-radius: 14px;
  backdrop-filter: blur(6px);
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.03);
}

.cp-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cp-logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}

.cp-titles {
  line-height: 1.25;
}

.cp-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2430;
}

.cp-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #97a0b0;
}

.cp-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 14px;
}

.cp-side {
  flex: 0 0 340px;
  min-width: 0;
  height: 100%;
}

.cp-grow {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
}
</style>
