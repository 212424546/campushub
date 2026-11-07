<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { isSocialType, truncateText } from '../constants.js'

const router = useRouter()

const posts = ref([])
const loading = ref(true)
const error = ref('')

// 筛选条件
const filterType = ref('')
const filterCampus = ref('')
const filterMinReward = ref('')
const filterMaxReward = ref('')
const filterSort = ref('time_desc')
const page = ref(1)
const pageSize = 10
const total = ref(0)
const jumpPage = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const sortOptions = [
  { value: 'time_desc', label: '最新发布' },
  { value: 'reward_desc', label: '报酬最高' },
  { value: 'reward_asc', label: '报酬最低' },
  { value: 'rating_desc', label: '信用最好' },
]

const categoryTabs = [
  { value: '', label: '全部' },
  { value: '跑腿', label: '跑腿' },
  { value: '二手', label: '二手' },
  { value: '失物招领', label: '失物' },
  { value: '学习', label: '学习' },
  { value: 'social', label: '闲聊', divider: true },
]

const showAdvanced = ref(false)

function buildQuery() {
  const params = new URLSearchParams()
  if (filterType.value === 'social') {
    params.set('category', 'social')
  } else if (filterType.value) {
    params.set('type', filterType.value)
  }
  if (filterCampus.value.trim()) params.set('campus', filterCampus.value.trim())
  if (filterMinReward.value !== '' && filterMinReward.value !== null) params.set('min_reward', filterMinReward.value)
  if (filterMaxReward.value !== '' && filterMaxReward.value !== null) params.set('max_reward', filterMaxReward.value)
  if (filterSort.value) params.set('sort', filterSort.value)
  params.set('page', page.value)
  params.set('pageSize', pageSize)
  return params.toString()
}

async function fetchPosts() {
  loading.value = true
  error.value = ''
  try {
    const qs = buildQuery()
    const url = 'http://localhost:3000/api/posts' + (qs ? '?' + qs : '')
    const headers = {}
    const token = localStorage.getItem('token')
    if (token) headers.Authorization = 'Bearer ' + token
    const res = await axios.get(url, { headers })
    posts.value = res.data.data.list || []
    total.value = res.data.data.total || 0
  } catch (err) {
    error.value = '加载帖子失败：' + (err.response?.data?.msg || err.message || err)
  } finally {
    loading.value = false
  }
}

function selectType(t) {
  filterType.value = t
  if (t === 'social' && (filterSort.value === 'reward_desc' || filterSort.value === 'reward_asc')) {
    filterSort.value = 'time_desc'
  }
  page.value = 1
  fetchPosts()
}

function selectSort(s) {
  filterSort.value = s
  page.value = 1
  fetchPosts()
}

function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value
}

function applyAdvanced() {
  showAdvanced.value = false
  page.value = 1
  fetchPosts()
}

function goPage(p) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchPosts()
}

function prevPage() {
  if (page.value > 1) goPage(page.value - 1)
}

function nextPage() {
  if (page.value < totalPages.value) goPage(page.value + 1)
}

function jumpToPage() {
  const p = parseInt(jumpPage.value)
  if (!p || p < 1) return
  goPage(p)
}

function goDetail(post) {
  router.push('/post/' + post.id)
}

function goUser(post) {
  if (post.user_id) {
    router.push('/user/' + post.user_id)
  }
}

onMounted(fetchPosts)
</script>

<template>
  <div class="page">
    <h1>校园互助 · 帖子列表</h1>

    <div class="filter-nav">
      <div class="filter-row category-row">
        <template v-for="tab in categoryTabs" :key="'cat-' + tab.value">
          <span v-if="tab.divider" class="tab-divider"></span>
          <button
            class="cat-tab"
            :class="{ active: filterType === tab.value }"
            @click="selectType(tab.value)"
          >{{ tab.label }}</button>
        </template>
      </div>

      <div class="filter-row sort-row">
        <div class="sort-group">
          <template v-for="s in sortOptions" :key="'sort-' + s.value">
            <button
              v-if="!(filterType === 'social' && (s.value === 'reward_desc' || s.value === 'reward_asc'))"
              class="sort-btn"
              :class="{ active: filterSort === s.value }"
              @click="selectSort(s.value)"
            >{{ s.label }}</button>
          </template>
        </div>
        <button class="adv-toggle" :class="{ active: showAdvanced }" @click="toggleAdvanced">高级筛选 ▾</button>
      </div>
    </div>

    <div v-if="showAdvanced" class="adv-panel">
      <input v-model="filterCampus" type="text" placeholder="校区" />
      <input v-model="filterMinReward" type="number" min="0" placeholder="最低报酬" />
      <input v-model="filterMaxReward" type="number" min="0" placeholder="最高报酬" />
      <button class="adv-apply" @click="applyAdvanced">确定</button>
    </div>

    <p v-if="loading" class="tip">加载中…</p>
    <p v-else-if="error" class="tip error">{{ error }}</p>
    <p v-else-if="posts.length === 0" class="tip">暂无帖子，快去发第一个吧～</p>

    <ul v-else class="post-list">
      <li v-for="post in posts" :key="post.id" class="post-card" @click="goDetail(post)">
        <div class="post-head">
          <h2 class="post-title">{{ post.title }}</h2>
          <span v-if="!isSocialType(post.type)" class="post-reward">{{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}</span>
        </div>
        <p class="post-desc">{{ truncateText(post.description) || '暂无描述' }}</p>
        <div class="post-meta">
          <span class="tag">{{ post.type }}</span>
          <span class="campus">🏫 {{ post.campus || '未填写校区' }}</span>
          <span v-if="post.is_anonymous === 1 || post.is_anonymous === true" class="nickname">👤 匿名用户</span>
          <span v-else class="nickname nickname-link" @click.stop="goUser(post)">👤 {{ post.nickname || '未设置' }}</span>
        </div>
      </li>
    </ul>

    <div v-if="!loading && !error && posts.length" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="prevPage">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="nextPage">下一页</button>
      <div class="page-jump">
        <input v-model="jumpPage" type="number" min="1" placeholder="页码" @keyup.enter="jumpToPage" />
        <button class="page-btn" @click="jumpToPage">跳转</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  font-family: system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  color: #1f2937;
}
h1 {
  font-size: 24px;
  margin: 0 0 20px;
  text-align: center;
}
.filter-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.category-row {
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}
.tab-divider {
  flex-shrink: 0;
  width: 1px;
  height: 18px;
  background: #d1d5db;
}
.sort-row {
  justify-content: space-between;
}
.sort-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.cat-tab {
  border: none;
  background: transparent;
  color: #4b5563;
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s;
}
.cat-tab:hover {
  color: #2563eb;
}
.cat-tab.active {
  background: #2563eb;
  color: #fff;
  font-weight: 600;
}
.sort-btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 999px;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.sort-btn.active {
  background: #eef2ff;
  border-color: #93c5fd;
  color: #2563eb;
  font-weight: 600;
}
.adv-toggle {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 999px;
}
.adv-toggle.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.adv-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
}
.adv-panel input {
  flex: 1 1 140px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  color: #374151;
}
.adv-panel input:focus {
  border-color: #2563eb;
}
.adv-apply {
  flex-shrink: 0;
  border: none;
  background: #2563eb;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.tip {
  text-align: center;
  color: #6b7280;
}
.tip.error {
  color: #dc2626;
}
.post-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.post-card {
  cursor: pointer;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s, transform 0.2s;
}
.post-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.post-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.post-title {
  font-size: 18px;
  margin: 0;
  color: #111827;
}
.post-reward {
  color: #ea580c;
  font-weight: 600;
  white-space: nowrap;
}
.post-desc {
  margin: 10px 0 12px;
  color: #4b5563;
  line-height: 1.6;
}
.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
}
.tag {
  background: #eef2ff;
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
}
.nickname-link {
  cursor: pointer;
  color: #2563eb;
}
.nickname-link:hover {
  text-decoration: underline;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.page-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.page-btn:disabled {
  background: #f3f4f6;
  color: #cbd5e1;
  cursor: not-allowed;
}
.page-info {
  font-size: 14px;
  color: #374151;
}
.page-jump {
  display: flex;
  align-items: center;
  gap: 6px;
}
.page-jump input {
  width: 64px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  text-align: center;
}
.page-jump input:focus {
  border-color: #2563eb;
}
</style>
