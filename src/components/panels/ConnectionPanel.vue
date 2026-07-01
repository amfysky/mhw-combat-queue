<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { STORAGE_KEYS } from '../../utils/storage'

const $message = useMessage()
const roomId = ref('')
const isConnecting = ref(false)
const isConnected = ref(false)

const statusText = computed(() =>
  isConnecting.value ? '连接中...' : isConnected.value ? '已连接' : '未连接'
)

const validateNoSpace = (value: string): boolean => /^\S*$/.test(value)

const connectToRoom = async () => {
  let room = roomId.value.trim()
  if (!room) return

  // 支持直接粘贴直播间链接，自动提取房间号
  try {
    const url = new URL(room)
    room = url.pathname.split('/').pop() || room
  } catch { /* 非链接则按房间号处理 */ }

  isConnecting.value = true
  try {
    const res = await window.electron?.connect(
      'https://passport.bilibili.com/login',
      'SESSDATA',
      Number(room)
    )
    if (res) {
      isConnected.value = true
      localStorage.setItem(STORAGE_KEYS.lastRoom, roomId.value)
      $message.success('连接成功')
    } else {
      isConnected.value = false
      $message.error('取消连接')
    }
  } catch (error: any) {
    isConnected.value = false
    $message.error(`连接失败: ${error}`)
  } finally {
    isConnecting.value = false
  }
}

// 存在上次连接的房间号则自动连接
onMounted(() => {
  const lastRoom = localStorage.getItem(STORAGE_KEYS.lastRoom)
  if (lastRoom) {
    roomId.value = lastRoom
    connectToRoom()
  }
})
</script>

<template>
  <n-card title="直播间连接" class="panel-card">
    <template #header-extra>
      <span class="state" :class="{ connected: isConnected, connecting: isConnecting }">
        {{ statusText }}
      </span>
    </template>
    <n-flex vertical>
      <n-flex :wrap="false">
        <n-input v-model:value="roomId" placeholder="直播间链接或房间号" :disabled="isConnecting"
          :allow-input="validateNoSpace" />
        <n-button type="primary" @click="connectToRoom" :disabled="isConnecting || !roomId.trim()"
          :loading="isConnecting">
          连接
        </n-button>
      </n-flex>
      <div class="text-xs text-gray-400 text-center">
        使用窗口采集标题为《点怪机 - 队列》的窗口即可
      </div>
    </n-flex>
  </n-card>
</template>

<style scoped>
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #999;
  white-space: nowrap;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #c0c0c0;
    transition: background-color 0.2s;
  }

  &.connected::before {
    background-color: #18a058;
    box-shadow: 0 0 0 3px rgba(24, 160, 88, 0.15);
  }

  &.connecting::before {
    background-color: #f0a020;
    box-shadow: 0 0 0 3px rgba(240, 160, 32, 0.15);
  }
}
</style>
