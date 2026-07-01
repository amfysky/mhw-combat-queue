<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { HelpCircleOutline } from '@vicons/ionicons5'
import { CHANNELS } from '../../channels/meta'
import type { ChannelSettings } from '../../composables/useChannels'

// 各渠道设置由父级（useChannels）持有并持久化，这里直接编辑其响应式对象
const props = defineProps<{ settings: Record<string, ChannelSettings> }>()

const $message = useMessage()

// 瞬时连接状态（不持久化），按渠道维护
const conn = reactive<Record<string, { connecting: boolean; connected: boolean }>>(
  Object.fromEntries(CHANNELS.map(c => [c.id, { connecting: false, connected: false }]))
)

const activeTab = ref(CHANNELS[0].id)

const labelOf = (id: string) => CHANNELS.find(c => c.id === id)?.label ?? id
const validateNoSpace = (value: string): boolean => /^\S*$/.test(value)

// 支持直接粘贴直播间链接，自动提取房间号
const parseRoom = (raw: string): string => {
  const room = raw.trim()
  try {
    const url = new URL(room)
    return url.pathname.split('/').filter(Boolean).pop() || room
  } catch {
    return room
  }
}

const connectChannel = async (id: string) => {
  const room = parseRoom(props.settings[id].roomId)
  if (!room || conn[id].connecting || conn[id].connected) return

  conn[id].connecting = true
  try {
    const res = await window.electron?.connect(id, room)
    if (res) {
      conn[id].connected = true
      $message.success(`${labelOf(id)} 连接成功`)
    } else {
      conn[id].connected = false
      $message.error('取消连接')
    }
  } catch (error: any) {
    conn[id].connected = false
    $message.error(`${labelOf(id)} 连接失败: ${error}`)
  } finally {
    conn[id].connecting = false
  }
}

const disconnectChannel = async (id: string) => {
  await window.electron?.disconnect(id)
  conn[id].connected = false
  $message.info(`${labelOf(id)} 已断开`)
}

// 启动时自动连接勾选了「自动连接」且填了房间号的渠道
onMounted(() => {
  for (const c of CHANNELS) {
    if (props.settings[c.id].autoConnect && props.settings[c.id].roomId.trim()) {
      connectChannel(c.id)
    }
  }
})

// 重置连接与登录态：断开全部、清空各渠道 Cookie（房间号/门槛等设置保留）
const reset = async () => {
  try {
    await window.electron?.resetConnection()
  } finally {
    for (const c of CHANNELS) {
      conn[c.id].connected = false
      conn[c.id].connecting = false
    }
  }
}

defineExpose({ reset })
</script>

<template>
  <n-card title="直播间连接" class="panel-card">
    <template #header-extra>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-icon size="17" class="help-icon">
            <HelpCircleOutline />
          </n-icon>
        </template>
        使用窗口采集标题为《点怪机 - 队列》的窗口
      </n-tooltip>
    </template>

    <n-tabs v-model:value="activeTab" type="line" size="small" animated>
      <n-tab-pane v-for="c in CHANNELS" :key="c.id" :name="c.id">
        <template #tab>
          <span class="ch-tab">
            <span class="dot"
              :class="{ on: conn[c.id].connected, ing: conn[c.id].connecting }" />
            {{ c.label }}
          </span>
        </template>

        <n-flex vertical size="large">
          <n-flex :wrap="false">
            <n-input v-model:value="settings[c.id].roomId" :placeholder="c.placeholder"
              :disabled="conn[c.id].connecting || conn[c.id].connected"
              :allow-input="validateNoSpace" @keyup.enter="connectChannel(c.id)" />
            <n-button v-if="!conn[c.id].connected" type="primary"
              :loading="conn[c.id].connecting"
              :disabled="conn[c.id].connecting || !settings[c.id].roomId.trim()"
              @click="connectChannel(c.id)">
              连接
            </n-button>
            <n-button v-else type="error" ghost @click="disconnectChannel(c.id)">
              断开
            </n-button>
          </n-flex>

          <n-form label-placement="left" :show-feedback="false" size="small">
            <n-flex :wrap="false" align="center" justify="space-between">
              <n-form-item label="自动连接">
                <n-switch v-model:value="settings[c.id].autoConnect" />
              </n-form-item>
              <n-form-item v-if="c.hasGuardLevel" label="允许舰长插队">
                <n-switch v-model:value="settings[c.id].allowJump" />
              </n-form-item>
            </n-flex>
          </n-form>

          <n-flex v-if="c.hasGuardLevel || c.medalLabel" :wrap="false">
            <n-form-item v-if="c.hasGuardLevel" label="最低舰长等级" class="flex-1"
              :show-feedback="false" size="small">
              <n-input-number v-model:value="settings[c.id].minGuardLevel" :min="0" class="w-full" />
            </n-form-item>
            <n-form-item v-if="c.medalLabel" :label="`最低${c.medalLabel}等级`" class="flex-1"
              :show-feedback="false" size="small">
              <n-input-number v-model:value="settings[c.id].minMedalLevel" :min="0" class="w-full" />
            </n-form-item>
          </n-flex>
        </n-flex>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<style scoped>
.help-icon {
  color: #b0b4bb;
  cursor: help;
  transition: color 0.2s;
}

.help-icon:hover {
  color: #6b7280;
}

.ch-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #c0c0c0;
  transition: background-color 0.2s;
}

.dot.on {
  background-color: #18a058;
  box-shadow: 0 0 0 3px rgba(24, 160, 88, 0.15);
}

.dot.ing {
  background-color: #f0a020;
  box-shadow: 0 0 0 3px rgba(240, 160, 32, 0.15);
}
</style>
