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
    const res = await axios.post(path, {
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
  <div class="w-full max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-lg">
    <h1 class="text-xl font-bold text-center text-gray-800 mb-6">{{ isRegister ? '注册' : '登录' }}</h1>

    <el-form label-position="top" @submit.prevent>
      <el-form-item label="学号">
        <el-input v-model="studentId" placeholder="请输入学号" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="password" type="password" placeholder="请输入密码" show-password @keyup.enter="submit" />
      </el-form-item>
    </el-form>

    <p v-if="message" class="text-red-500 text-sm mb-4">{{ message }}</p>

    <el-button type="primary" class="w-full" :loading="loading" @click="submit">
      {{ isRegister ? '注册' : '登录' }}
    </el-button>

    <p class="mt-4 text-center text-sm text-gray-500">
      {{ isRegister ? '已有账号？' : '还没有账号？' }}
      <a href="javascript:;" class="text-indigo-600" @click="isRegister = !isRegister; message = ''">
        {{ isRegister ? '去登录' : '去注册' }}
      </a>
    </p>
  </div>
</template>

