<script setup lang="ts">
import { reactive } from 'vue'

const emit = defineEmits<{
  (e: 'sendTest', data: any): void
}>()

const testData = reactive({
  username: '测试用户',
  content: '锁刃',
  guardLevel: 0,
  medalLevel: 0,
})

const sendTestDanmu = () => {
  emit('sendTest', {
    cmd: 'DANMU_MSG',
    content: `点怪 ${testData.content}`,
    uid: Math.floor(Math.random() * 1000000),
    username: testData.username,
    face: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    guardLevel: testData.guardLevel,
    medalLevel: testData.medalLevel,
  })
}
</script>

<template>
  <n-card title="测试面板" class="panel-card">
    <n-form label-placement="top" :show-feedback="false" size="small">
      <n-flex :wrap="false">
        <n-form-item label="用户名" class="flex-1">
          <n-input v-model:value="testData.username" />
        </n-form-item>
        <n-form-item label="怪物名" class="flex-1">
          <n-input v-model:value="testData.content" />
        </n-form-item>
      </n-flex>
      <n-flex :wrap="false" class="mt-3">
        <n-form-item label="舰长等级" class="flex-1">
          <n-input-number v-model:value="testData.guardLevel" :min="0" class="w-full" />
        </n-form-item>
        <n-form-item label="粉丝勋章等级" class="flex-1">
          <n-input-number v-model:value="testData.medalLevel" :min="0" class="w-full" />
        </n-form-item>
      </n-flex>
    </n-form>
    <n-button type="primary" block class="mt-3" @click="sendTestDanmu">
      发送测试弹幕
    </n-button>
  </n-card>
</template>
