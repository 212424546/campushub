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
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-800 text-center mb-6">校园互助 · 帖子列表</h1>

    <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div class="flex flex-wrap items-center gap-3">
        <el-select v-model="filterType" @change="selectType" placeholder="全部分类" class="w-32">
          <el-option v-for="tab in categoryTabs" :key="tab.value" :label="tab.label" :value="tab.value" />
        </el-select>

        <el-select v-model="filterSort" @change="selectSort" placeholder="排序" class="w-32">
          <template v-for="s in sortOptions" :key="s.value">
            <el-option
              v-if="!(filterType === 'social' && (s.value === 'reward_desc' || s.value === 'reward_asc'))"
              :label="s.label"
              :value="s.value"
            />
          </template>
        </el-select>

        <el-button :type="showAdvanced ? 'primary' : 'default'" @click="toggleAdvanced">
          {{ showAdvanced ? '收起筛选' : '高级筛选' }}
        </el-button>
      </div>

      <div v-if="showAdvanced" class="flex flex-wrap items-center gap-2 mt-3">
        <el-input v-model="filterCampus" placeholder="校区" class="w-32" />
        <el-input v-model="filterMinReward" type="number" min="0" placeholder="最低报酬" class="w-32" />
        <el-input v-model="filterMaxReward" type="number" min="0" placeholder="最高报酬" class="w-32" />
        <el-button type="primary" @click="applyAdvanced">确定</el-button>
      </div>
    </div>

    <p v-if="loading" class="text-center text-gray-500 py-10">加载中…</p>
    <p v-else-if="error" class="text-center text-red-500 py-10">{{ error }}</p>
    <p v-else-if="posts.length === 0" class="text-center text-gray-500 py-10">暂无帖子，快去发第一个吧～</p>

    <div v-else>
      <div
        v-for="post in posts"
        :key="post.id"
        class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 mb-4 cursor-pointer"
        @click="goDetail(post)"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <el-avatar :size="40">{{ (post.nickname || '匿')[0] }}</el-avatar>
            <div>
              <div v-if="post.is_anonymous === 1 || post.is_anonymous === true" class="text-sm font-semibold text-gray-800">匿名用户</div>
              <div v-else class="text-sm font-semibold text-indigo-600 cursor-pointer hover:underline" @click.stop="goUser(post)">{{ post.nickname || '未设置' }}</div>
              <div class="text-xs text-gray-400">🏫 {{ post.campus || '未填写校区' }}</div>
            </div>
          </div>
          <span class="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full whitespace-nowrap">{{ post.type }}</span>
        </div>

        <h2 class="text-lg font-bold text-gray-800 mb-2">{{ post.title }}</h2>
        <p class="text-gray-500 text-sm line-clamp-2 mb-3">{{ truncateText(post.description) || '暂无描述' }}</p>

        <div v-if="!isSocialType(post.type)" class="text-orange-600 font-semibold">
          {{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && posts.length" class="flex items-center justify-center flex-wrap gap-3 mt-6">
      <el-button :disabled="page <= 1" @click="prevPage">上一页</el-button>
      <span class="text-sm text-gray-600">{{ page }} / {{ totalPages }}</span>
      <el-button :disabled="page >= totalPages" @click="nextPage">下一页</el-button>
      <div class="flex items-center gap-2">
        <el-input v-model="jumpPage" type="number" min="1" placeholder="页码" class="w-24" @keyup.enter="jumpToPage" />
        <el-button @click="jumpToPage">跳转</el-button>
      </div>
    </div>
  </div>
</template>
