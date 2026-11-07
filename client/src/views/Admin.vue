<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const activeTab = ref('posts')
const posts = ref([])
const users = ref([])
const loading = ref(false)
const errorMsg = ref('')

const POST_STATUS = { 0: '待接单', 1: '进行中', 2: '已完成', 3: '已取消', '-1': '已下架' }

function getToken() {
  return localStorage.getItem('token')
}
function authHeaders() {
  return { Authorization: 'Bearer ' + getToken() }
}
function getRole() {
  const token = getToken()
  if (!token) return null
  try {
    return JSON.parse(atob(token.split('.')[1])).role
  } catch {
    return null
  }
}

function postStatusText(p) {
  if (p.is_deleted === 1) return '已删除'
  return POST_STATUS[p.status] ?? '未知'
}

async function loadPosts() {
  try {
    const res = await axios.get('http://localhost:3000/api/admin/posts', { headers: authHeaders() })
    posts.value = res.data.data || []
  } catch (err) {
    errorMsg.value = err.response?.data?.msg || '加载帖子失败'
  }
}

async function loadUsers() {
  try {
    const res = await axios.get('http://localhost:3000/api/admin/users', { headers: authHeaders() })
    users.value = res.data.data || []
  } catch (err) {
    errorMsg.value = err.response?.data?.msg || '加载用户失败'
  }
}

async function takedown(post) {
  try {
    await ElMessageBox.confirm('确定下架该帖子？', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await axios.patch(
      'http://localhost:3000/api/admin/posts/' + post.id + '/takedown',
      {},
      { headers: authHeaders() }
    )
    if (res.data.code === 0) await loadPosts()
    else ElMessage.error(res.data.msg || '操作失败')
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  }
}

async function deletePost(post) {
  try {
    await ElMessageBox.confirm('确定彻底删除该帖子？此操作不可恢复', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await axios.delete('http://localhost:3000/api/admin/posts/' + post.id, {
      headers: authHeaders(),
    })
    if (res.data.code === 0) await loadPosts()
    else ElMessage.error(res.data.msg || '操作失败')
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  }
}

async function setMute(user) {
  try {
    const res = await axios.put(
      'http://localhost:3000/api/admin/users/' + user.id + '/status',
      { is_muted: user.is_muted ? 0 : 1 },
      { headers: authHeaders() }
    )
    if (res.data.code === 0) await loadUsers()
    else ElMessage.error(res.data.msg || '操作失败')
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  }
}

async function setBan(user) {
  if (!user.is_banned) {
    try {
      await ElMessageBox.confirm('确定封禁该用户？封禁后将无法登录', '提示', { type: 'warning' })
    } catch {
      return
    }
  }
  try {
    const res = await axios.put(
      'http://localhost:3000/api/admin/users/' + user.id + '/status',
      { is_banned: user.is_banned ? 0 : 1 },
      { headers: authHeaders() }
    )
    if (res.data.code === 0) await loadUsers()
    else ElMessage.error(res.data.msg || '操作失败')
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  }
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  await Promise.all([loadPosts(), loadUsers()])
  loading.value = false
}

onMounted(() => {
  if (getRole() !== 1) {
    errorMsg.value = '无权限访问，仅限管理员'
    return
  }
  load()
})
</script>

<template>
  <div class="page">
    <div class="card">
      <h1>管理后台</h1>

      <div class="tabs">
        <button :class="{ active: activeTab === 'posts' }" @click="activeTab = 'posts'">
          违规帖子管理
        </button>
        <button :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">
          用户管理
        </button>
      </div>

      <p v-if="loading" class="message">加载中…</p>
      <p v-else-if="errorMsg" class="message">{{ errorMsg }}</p>

      <div v-if="activeTab === 'posts'" class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>标题</th>
              <th>发布者</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in posts" :key="p.id">
              <td>{{ p.id }}</td>
              <td>{{ p.title }}</td>
              <td>{{ p.nickname || p.student_id || ('用户' + p.user_id) }}</td>
              <td>{{ postStatusText(p) }}</td>
              <td class="actions">
                <button class="btn" :disabled="p.status === -1 || p.is_deleted === 1" @click="takedown(p)">
                  下架
                </button>
                <button class="btn danger" @click="deletePost(p)">彻底删除</button>
              </td>
            </tr>
            <tr v-if="!posts.length">
              <td colspan="5" class="empty">暂无帖子</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>学号</th>
              <th>昵称</th>
              <th>禁言</th>
              <th>封禁</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.id }}</td>
              <td>{{ u.student_id }}</td>
              <td>{{ u.nickname || '-' }}</td>
              <td>
                <button class="btn" @click="setMute(u)">
                  {{ u.is_muted ? '解除禁言' : '禁言' }}
                </button>
              </td>
              <td>
                <button class="btn danger" @click="setBan(u)">
                  {{ u.is_banned ? '解封' : '封禁' }}
                </button>
              </td>
            </tr>
            <tr v-if="!users.length">
              <td colspan="5" class="empty">暂无用户</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 820px;
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
  margin: 0 0 16px;
  text-align: center;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
}
.tabs button {
  border: none;
  background: transparent;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.tabs button.active {
  background: #4f46e5;
  color: #fff;
}
.message {
  color: #dc2626;
  font-size: 13px;
  margin: 0 0 12px;
}
.table-wrap {
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.table th {
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}
.actions {
  white-space: nowrap;
}
.btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover {
  background: #f3f4f6;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.danger {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}
.btn.danger:hover {
  background: #fee2e2;
}
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 16px 0;
}
</style>

