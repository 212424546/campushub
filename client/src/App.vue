<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isLoggedIn = ref(!!localStorage.getItem('token'))

// 路由变化时重新读取登录状态
watch(
  () => route.fullPath,
  () => {
    isLoggedIn.value = !!localStorage.getItem('token')
  }
)
</script>

<template>
  <div class="app-shell">
    <header class="navbar">
      <div class="navbar-inner">
        <RouterLink to="/" class="brand">CampusHub 校园互助</RouterLink>
        <nav class="nav-links">
          <RouterLink to="/">首页</RouterLink>
          <template v-if="isLoggedIn">
            <RouterLink to="/create">发帖</RouterLink>
            <RouterLink to="/user-center">个人中心</RouterLink>
          </template>
          <RouterLink v-else to="/login">登录/注册</RouterLink>
        </nav>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.navbar {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}
.navbar-inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  text-decoration: none;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nav-links a {
  color: #374151;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  transition: background 0.2s;
}
.nav-links a:hover {
  background: #f3f4f6;
}
.nav-links a.router-link-exact-active {
  color: #4f46e5;
  background: #eef2ff;
}
</style>
