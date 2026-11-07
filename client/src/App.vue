<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

function getRoleFromToken() {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1])).role
  } catch {
    return null
  }
}

const isLoggedIn = ref(!!localStorage.getItem('token'))
const isAdmin = ref(getRoleFromToken() === 1)

// 路由变化时重新读取登录状态与管理员身份
watch(
  () => route.fullPath,
  () => {
    isLoggedIn.value = !!localStorage.getItem('token')
    isAdmin.value = getRoleFromToken() === 1
  }
)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <RouterLink to="/" class="text-base font-semibold text-gray-900 transition-colors hover:text-indigo-600">
          CampusHub 校园互助
        </RouterLink>
        <nav class="flex items-center gap-1">
          <RouterLink to="/" class="px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900">首页</RouterLink>
          <template v-if="isLoggedIn">
            <RouterLink to="/create" class="px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900">发帖</RouterLink>
            <RouterLink to="/user-center" class="px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900">个人中心</RouterLink>
            <RouterLink v-if="isAdmin" to="/admin" class="px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900">管理后台</RouterLink>
          </template>
          <RouterLink v-else to="/login" class="px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors hover:bg-gray-100 hover:text-gray-900">登录/注册</RouterLink>
        </nav>
      </div>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

