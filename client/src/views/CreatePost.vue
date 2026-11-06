<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const categories = ['跑腿', '二手', '失物招领', '学习']

const title = ref('')
const description = ref('')
const type = ref('跑腿')
const reward = ref('')
const campus = ref('')
const isAnonymous = ref(false)
const loading = ref(false)
const message = ref('')

async function submit() {
  const token = localStorage.getItem('token')
  if (!token) {
    message.value = '请先登录后再发帖'
    router.push('/login')
    return
  }
  if (!title.value || !type.value) {
    message.value = '标题和分类不能为空'
    return
  }

  loading.value = true
  message.value = ''
  try {
    const res = await axios.post(
      'http://localhost:3000/api/posts',
      {
        type: type.value,
        title: title.value,
        description: description.value,
        reward: Number(reward.value) || 0,
        campus: campus.value,
        is_anonymous: isAnonymous.value ? 1 : 0,
      },
      {
        headers: { Authorization: 'Bearer ' + token },
      }
    )

    if (res.data.code === 0) {
      router.push('/')
    } else {
      message.value = res.data.msg || '发布失败'
    }
  } catch (err) {
    message.value = err.response?.data?.msg || '发布失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>发布帖子</h1>

      <label class="field">
        <span>标题</span>
        <input v-model="title" type="text" placeholder="请输入标题" />
      </label>

      <label class="field">
        <span>描述</span>
        <textarea v-model="description" rows="4" placeholder="请描述需求详情"></textarea>
      </label>

      <label class="field">
        <span>分类</span>
        <select v-model="type">
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>

      <label class="field">
        <span>报酬（元）</span>
        <input v-model="reward" type="number" min="0" placeholder="0" />
      </label>

      <label class="field">
        <span>校区</span>
        <input v-model="campus" type="text" placeholder="如：东校区 / 西校区" />
      </label>

      <label class="checkbox">
        <input v-model="isAnonymous" type="checkbox" />
        <span>匿名发布</span>
      </label>

      <p v-if="message" class="message">{{ message }}</p>

      <button class="submit" :disabled="loading" @click="submit">
        {{ loading ? '发布中…' : '发布' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
h1 {
  font-size: 20px;
  margin: 0 0 20px;
  text-align: center;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 14px;
  color: #374151;
}
.field input,
.field textarea,
.field select {
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}
.field textarea {
  resize: vertical;
}
.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: #4f46e5;
}
.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  margin-bottom: 14px;
}
.message {
  color: #dc2626;
  font-size: 13px;
  margin: 0 0 12px;
}
.submit {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}
.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
