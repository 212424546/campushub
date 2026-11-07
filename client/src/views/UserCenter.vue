<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import dayjs from 'dayjs'
import { truncateText } from '../constants.js'
import PostCard from '../components/PostCard.vue'

const router = useRouter()

const activeTab = ref('posts')
const profile = ref(null)
const myPosts = ref([])
const publishedOrders = ref([])
const takenOrders = ref([])
const receivedReviews = ref([])
const myLikes = ref([])
const myFavorites = ref([])
const myHistory = ref([])
const blacklist = ref([])
const loading = ref(false)
const error = ref('')
const proofInputs = ref({})
const actionLoading = ref({})
const reviewedIds = ref({})

const quickEntries = [
  { key: 'likes', label: '我的点赞' },
  { key: 'favorites', label: '我的收藏' },
  { key: 'history', label: '浏览历史' },
  { key: 'blacklist', label: '黑名单' },
]

const coreTabs = [
  { key: 'posts', label: '我的帖子' },
  { key: 'published', label: '发布的订单' },
  { key: 'taken', label: '接下的订单' },
  { key: 'reviews', label: '收到的评价' },
]

const ORDER_STATUS = { 0: '进行中', 1: '待确认', 2: '已完成' }
const POST_STATUS = { 0: '待接单', 1: '进行中', 2: '已完成', 3: '已取消', '-1': '已下架' }

function getToken() {
  return localStorage.getItem('token')
}

function orderStatusText(s) {
  return ORDER_STATUS[s] ?? '未知'
}

function postStatusText(s) {
  return POST_STATUS[s] ?? '未知'
}

function formatTime(t) {
  if (!t) return '-'
  return dayjs(String(t).replace(' ', 'T')).format('YYYY-MM-DD HH:mm')
}

async function load() {
  const token = getToken()
  if (!token) {
    error.value = '请先登录'
    router.push('/login')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const headers = { Authorization: 'Bearer ' + token }
    const meRes = await axios.get('http://localhost:3000/api/users/me', { headers })
    profile.value = meRes.data.data
    const uid = profile.value.id

    const results = await Promise.allSettled([
      axios.get('http://localhost:3000/api/posts?user_id=' + uid + '&status=all'),
      axios.get('http://localhost:3000/api/orders/published', { headers }),
      axios.get('http://localhost:3000/api/orders/taken', { headers }),
      axios.get('http://localhost:3000/api/users/reviews', { headers }),
      axios.get('http://localhost:3000/api/users/me/likes', { headers }),
      axios.get('http://localhost:3000/api/users/me/favorites', { headers }),
      axios.get('http://localhost:3000/api/users/me/history', { headers }),
      axios.get('http://localhost:3000/api/users/me/blacklist', { headers }),
    ])
    if (results[0].status === 'fulfilled') myPosts.value = results[0].value.data.data.list || []
    if (results[1].status === 'fulfilled') publishedOrders.value = results[1].value.data.data || []
    if (results[2].status === 'fulfilled') takenOrders.value = results[2].value.data.data || []
    if (results[3].status === 'fulfilled') receivedReviews.value = results[3].value.data.data || []
    if (results[4].status === 'fulfilled') myLikes.value = results[4].value.data.data || []
    if (results[5].status === 'fulfilled') myFavorites.value = results[5].value.data.data || []
    if (results[6].status === 'fulfilled') myHistory.value = results[6].value.data.data || []
    if (results[7].status === 'fulfilled') blacklist.value = results[7].value.data.data || []
  } catch (err) {
    error.value = err.response?.data?.msg || '加载失败'
  } finally {
    loading.value = false
  }
}

async function editProfile() {
  const token = getToken()
  if (!token) { router.push('/login'); return }
  const nickname = prompt('请输入昵称', profile.value?.nickname || '')
  if (nickname === null) return
  const bio = prompt('请输入个性签名', profile.value?.bio || '')
  if (bio === null) return
  try {
    const res = await axios.put('http://localhost:3000/api/users/profile', { nickname, bio }, { headers: { Authorization: 'Bearer ' + token } })
    if (res.data.code === 0) {
      profile.value = res.data.data
      alert('修改成功')
    } else {
      alert(res.data.msg || '修改失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '修改失败')
  }
}

async function editAvatar() {
  const token = getToken()
  if (!token) { router.push('/login'); return }
  const avatar = prompt('请输入头像图片 URL', profile.value?.avatar_url || '')
  if (avatar === null) return
  try {
    const res = await axios.put('http://localhost:3000/api/users/profile', { avatar_url: avatar }, { headers: { Authorization: 'Bearer ' + token } })
    if (res.data.code === 0) {
      profile.value = res.data.data
      alert('头像已更新')
    } else {
      alert(res.data.msg || '修改失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '修改失败')
  }
}

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}

async function uploadProof(order) {
  const token = getToken()
  if (!token) { router.push('/login'); return }
  const raw = (proofInputs.value[order.id] || '').trim()
  if (!raw) { alert('请先填写凭证图片 URL（多个用逗号分隔）'); return }
  const images = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (images.length === 0) { alert('请填写有效的图片 URL'); return }
  actionLoading.value[order.id] = true
  try {
    const res = await axios.post('http://localhost:3000/api/orders/' + order.id + '/proof', { proof_images: images }, { headers: { Authorization: 'Bearer ' + token } })
    if (res.data.code === 0) { alert('凭证上传成功'); await load() } else { alert(res.data.msg || '上传失败') }
  } catch (err) {
    alert(err.response?.data?.msg || '上传失败')
  } finally {
    actionLoading.value[order.id] = false
  }
}

async function submitReview(order) {
  const token = getToken()
  if (!token) { router.push('/login'); return }
  const ratingStr = prompt('请输入评分（1-5）', '5')
  if (ratingStr === null) return
  const rating = Number(ratingStr)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) { alert('评分必须是 1-5 的整数'); return }
  const content = prompt('请输入评价内容（可选）', '')
  if (content === null) return
  actionLoading.value[order.id] = true
  try {
    const res = await axios.post('http://localhost:3000/api/reviews', { order_id: order.id, rating, content }, { headers: { Authorization: 'Bearer ' + token } })
    if (res.data.code === 0) { alert('评价成功'); reviewedIds.value[order.id] = true } else { alert(res.data.msg || '评价失败') }
  } catch (err) {
    alert(err.response?.data?.msg || '评价失败')
  } finally {
    actionLoading.value[order.id] = false
  }
}

function goPost(post) {
  router.push('/post/' + post.id)
}

function goPostId(id) {
  if (id != null) router.push('/post/' + id)
}

async function unblock(user) {
  const token = getToken()
  if (!token) { router.push('/login'); return }
  if (!confirm('确定解除拉黑该用户吗？')) return
  try {
    const res = await axios.delete('http://localhost:3000/api/users/block/' + user.id, { headers: { Authorization: 'Bearer ' + token } })
    if (res.data.code === 0) {
      const r = await axios.get('http://localhost:3000/api/users/me/blacklist', { headers: { Authorization: 'Bearer ' + token } })
      blacklist.value = r.data.data || []
    } else {
      alert(res.data.msg || '操作失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '操作失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="profile-card">
      <div class="avatar" @click="editAvatar" title="点击修改头像">
        <img v-if="profile && profile.avatar_url" :src="profile.avatar_url" alt="头像" />
        <span v-else>👤</span>
      </div>
      <div class="profile-info">
        <div class="name-row">
          <span class="profile-name">{{ profile?.nickname || '未设置' }}</span>
          <button class="edit-btn" @click="editProfile">修改资料</button>
        </div>
        <div class="profile-bio">{{ profile?.bio || '这个人很懒，还没写签名' }}</div>
        <div class="profile-stats">
          <span>评分 {{ profile?.avg_rating ?? 0 }}</span>
          <span>信用分 {{ profile?.credit_score ?? 0 }}</span>
        </div>
      </div>
      <button class="logout-btn" @click="logout">退出登录</button>
    </div>

    <div class="quick-grid">
      <button
        v-for="e in quickEntries"
        :key="e.key"
        class="quick-item"
        :class="{ active: activeTab === e.key }"
        @click="activeTab = e.key"
      >
        <span class="quick-icon">
          <svg v-if="e.key === 'likes'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <svg v-else-if="e.key === 'favorites'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <svg v-else-if="e.key === 'blacklist'" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </span>
        <span class="quick-label">{{ e.label }}</span>
      </button>
    </div>

    <div class="core-tabs">
      <button
        v-for="t in coreTabs"
        :key="t.key"
        class="core-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <p v-if="loading" class="tip">加载中…</p>
    <p v-else-if="error" class="tip error">{{ error }}</p>

    <div v-else-if="activeTab === 'posts'">
      <p v-if="myPosts.length === 0" class="tip">暂无帖子</p>
      <div v-for="post in myPosts" :key="post.id" class="card" @click="goPost(post)">
        <div class="card-head">
          <h3 class="card-title">{{ post.title }}</h3>
          <span class="status" :class="'status-' + post.status">{{ postStatusText(post.status) }}</span>
        </div>
        <p class="card-desc">{{ truncateText(post.description) || '暂无描述' }}</p>
        <div class="card-meta">
          <span>{{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}</span>
          <span>🏫 {{ post.campus || '未填写校区' }}</span>
          <span>{{ formatTime(post.created_at) }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'published'">
      <p v-if="publishedOrders.length === 0" class="tip">暂无发布的订单</p>
      <div v-for="order in publishedOrders" :key="order.id" class="card" @click="goPostId(order.post_id)">
        <div class="card-head">
          <h3 class="card-title">{{ order.post_title || '帖子已删除' }}</h3>
          <span class="status" :class="'status-' + order.status">{{ orderStatusText(order.status) }}</span>
        </div>
        <div class="card-meta">
          <span>接单人：{{ order.taker_nickname || '未设置昵称' }}</span>
          <span>信用分 {{ order.taker_credit_score ?? '-' }}</span>
          <span>{{ formatTime(order.created_at) }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'taken'">
      <p v-if="takenOrders.length === 0" class="tip">暂无接下的订单</p>
      <div v-for="order in takenOrders" :key="order.id" class="card">
        <div class="card-head">
          <h3 class="card-title">{{ order.post_title || '帖子已删除' }}</h3>
          <span class="status" :class="'status-' + order.status">{{ orderStatusText(order.status) }}</span>
        </div>
        <div class="card-meta">
          <span>发布人：{{ order.publisher_nickname || '未设置昵称' }}</span>
          <span>{{ formatTime(order.created_at) }}</span>
        </div>
        <div v-if="order.proof_images && order.proof_images.length" class="proof">
          <span class="proof-label">凭证：</span>
          <span v-for="(img, i) in order.proof_images" :key="i" class="proof-img">{{ img }}</span>
        </div>
        <div v-if="order.status === 0" class="upload-row">
          <input v-model="proofInputs[order.id]" type="text" placeholder="凭证图片 URL，多个用逗号分隔" />
          <button class="action-btn" :disabled="actionLoading[order.id]" @click="uploadProof(order)">{{ actionLoading[order.id] ? '上传中…' : '上传凭证' }}</button>
        </div>
        <button v-if="order.status === 2 && !reviewedIds[order.id]" class="action-btn review-btn" :disabled="actionLoading[order.id]" @click="submitReview(order)">{{ actionLoading[order.id] ? '提交中…' : '去评价' }}</button>
      </div>
    </div>

    <div v-else-if="activeTab === 'reviews'">
      <p v-if="receivedReviews.length === 0" class="tip">暂无收到的评价</p>
      <div v-for="review in receivedReviews" :key="review.id" class="card">
        <div class="card-head">
          <span class="rating">⭐ {{ review.rating }}</span>
          <span class="reviewer">{{ review.reviewer_nickname || '匿名用户' }}</span>
        </div>
        <p class="review-content">{{ review.content || '（无内容）' }}</p>
        <div class="card-meta"><span>{{ formatTime(review.created_at) }}</span></div>
      </div>
    </div>

    <div v-else-if="activeTab === 'likes'">
      <p v-if="myLikes.length === 0" class="tip">暂无点赞</p>
      <PostCard v-for="p in myLikes" :key="p.id" :post="p" />
    </div>

    <div v-else-if="activeTab === 'favorites'">
      <p v-if="myFavorites.length === 0" class="tip">暂无收藏</p>
      <PostCard v-for="p in myFavorites" :key="p.id" :post="p" />
    </div>

    <div v-else-if="activeTab === 'history'">
      <p v-if="myHistory.length === 0" class="tip">暂无浏览记录</p>
      <PostCard v-for="p in myHistory" :key="p.id" :post="p" />
    </div>

    <div v-else-if="activeTab === 'blacklist'">
      <p v-if="blacklist.length === 0" class="tip">暂无拉黑用户</p>
      <div v-for="u in blacklist" :key="u.id" class="card blacklist-item">
        <div class="blacklist-avatar">
          <img v-if="u.avatar_url" :src="u.avatar_url" alt="头像" />
          <span v-else>{{ (u.nickname || '匿')[0] }}</span>
        </div>
        <div class="blacklist-info">
          <span class="blacklist-nickname">{{ u.nickname || '未设置昵称' }}</span>
        </div>
        <button class="unblock-btn" @click="unblock(u)">解除拉黑</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  font-family: system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  color: #1f2937;
}
.profile-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  cursor: pointer;
  border: 2px solid #e0e7ff;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}
.profile-bio {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 8px;
  word-break: break-all;
}
.profile-stats {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #374151;
}
.edit-btn {
  flex-shrink: 0;
  border: 1px solid #4f46e5;
  background: #fff;
  color: #4f46e5;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
.logout-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  border: 1px solid #dc2626;
  background: #fff;
  color: #dc2626;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.logout-btn:hover {
  background: #fee2e2;
}
.quick-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.quick-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  color: #374151;
  transition: border-color 0.2s, color 0.2s;
}
.quick-item.active {
  border-color: #4f46e5;
  color: #4f46e5;
}
.quick-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
.quick-label {
  font-size: 13px;
}
.core-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 16px;
}
.core-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 4px;
  font-size: 15px;
  color: #4b5563;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  text-align: center;
}
.core-tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 600;
}
.tip {
  text-align: center;
  color: #6b7280;
}
.tip.error {
  color: #dc2626;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: 14px;
  cursor: pointer;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}
.card-title {
  font-size: 16px;
  margin: 0;
  color: #111827;
  font-weight: 600;
}
.status {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}
.status-0 { background: #dbeafe; color: #1d4ed8; }
.status-1 { background: #fef3c7; color: #b45309; }
.status-2 { background: #d1fae5; color: #047857; }
.status-3 { background: #f3f4f6; color: #6b7280; }
.status--1 { background: #fee2e2; color: #dc2626; }
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #6b7280;
}
.card-desc {
  margin: 0 0 8px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  word-break: break-all;
}
.blacklist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: default;
}
.blacklist-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #4f46e5;
  font-weight: 600;
}
.blacklist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.blacklist-info {
  flex: 1;
  min-width: 0;
}
.blacklist-nickname {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.unblock-btn {
  flex-shrink: 0;
  border: 1px solid #dc2626;
  background: #fff;
  color: #dc2626;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.unblock-btn:hover {
  background: #fee2e2;
}
.rating {
  color: #f59e0b;
  font-weight: 600;
}
.reviewer {
  color: #6b7280;
  font-size: 13px;
}
.review-content {
  margin: 8px 0;
  color: #374151;
  line-height: 1.6;
}
.proof {
  font-size: 13px;
  color: #4b5563;
  margin: 8px 0 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.proof-label {
  color: #6b7280;
}
.proof-img {
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 6px;
  color: #4f46e5;
  word-break: break-all;
}
.upload-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.upload-row input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}
.upload-row input:focus {
  border-color: #4f46e5;
}
.action-btn {
  border: none;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  margin-top: 8px;
}
.action-btn:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
.review-btn {
  background: #059669;
}
.review-btn:disabled {
  background: #cbd5e1;
  color: #64748b;
}
</style>