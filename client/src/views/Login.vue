<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

const studentId = ref('')
const password = ref('')
const isRegister = ref(false)
const loading = ref(false)
const message = ref('')

async function submit() {
  if (!studentId.value || !password.value) {
    message.value = '请填写学号和密码'
    return
  }

  loading.value = true
  message.value = ''
  try {
    const path = isRegister.value ? '/api/auth/register' : '/api/auth/login'
    const res = await axios.post('http://localhost:3000' + path, {
      student_id: studentId.value,
      password: password.value,
    })

    if (res.data.code === 0) {
      if (isRegister.value) {
        message.value = '注册成功，请登录'
        isRegister.value = false
      } else {
        localStorage.setItem('token', res.data.data.token)
        router.push('/')
      }
    } else {
      message.value = res.data.msg || '操作失败'
    }
  } catch (err) {
    message.value = err.response?.data?.msg || '请求失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>{{ isRegister ? '注册' : '登录' }}</h1>

      <label class="field">
        <span>学号</span>
        <input v-model="studentId" type="text" placeholder="请输入学号" />
      </label>

      <label class="field">
        <span>密码</span>
        <input v-model="password" type="password" placeholder="请输入密码" />
      </label>

      <p v-if="message" class="message">{{ message }}</p>

      <button class="submit" :disabled="loading" @click="submit">
        {{ loading ? '提交中…' : isRegister ? '注册' : '登录' }}
      </button>

      <p class="switch">
        {{ isRegister ? '已有账号？' : '还没有账号？' }}
        <a href="javascript:;" @click="isRegister = !isRegister; message = ''">
          {{ isRegister ? '去登录' : '去注册' }}
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 420px;
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
.field input {
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}
.field input:focus {
  border-color: #4f46e5;
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
.switch {
  margin: 14px 0 0;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
}
.switch a {
  color: #4f46e5;
  text-decoration: none;
  cursor: pointer;
}
</style>
