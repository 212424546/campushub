<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import dayjs from 'dayjs'
import { truncateText } from '../constants.js'

const route = useRoute()
const router = useRouter()

const profile = ref(null)
const reviews = ref([])
const loading = ref(true)
const error = ref('')

function formatTime(t) {
  if (!t) return '-'
  return dayjs(String(t).replace(' ', 'T')).format('YYYY-MM-DD HH:mm')
}

async function load() {
  try {
    const id = route.params.id
    const res = await axios.get('/api/users/' + id + '/public')
    profile.value = res.data.data
    const reviewsRes = await axios.get('/api/users/reviews?user_id=' + id)
    reviews.value = reviewsRes.data.data || []
  } catch (err) {
    error.value = err.response?.data?.msg || '加载失败'
  } finally {
    loading.value = false
  }
}

function goPost(post) {
  router.push('/post/' + post.id)
}

onMounted(load)
</script>

<template>
  <div class="page">
    <button class="back-btn" @click="router.back()">← 返回</button>
    <div v-if="loading" class="tip">加载中…</div>
    <div v-else-if="error" class="tip error">{{ error }}</div>

    <template v-else-if="profile">
      <div class="profile-card">
        <div class="avatar">
          <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="头像" />
          <span v-else>👤</span>
        </div>
        <div class="profile-info">
          <div class="name-row">
            <span class="star-rating">⭐ {{ profile.avg_rating ?? 0 }}</span>
            <span class="profile-name">{{ profile.nickname || '未设置' }}</span>
          </div>
          <div class="profile-bio">{{ profile.bio || '这个人很懒，还没写签名' }}</div>
          <div class="profile-stats">
            <span>信用分 {{ profile.credit_score ?? 0 }}</span>
            <span>评分 {{ profile.avg_rating ?? 0 }}</span>
          </div>
        </div>
      </div>

      <h2 class="section-title">TA 发布的帖子</h2>
      <p v-if="profile.posts.length === 0" class="tip">暂无帖子</p>
      <div v-for="post in profile.posts" :key="post.id" class="post-card" @click="goPost(post)">
        <div class="post-head">
          <h3 class="post-title">{{ post.title }}</h3>
          <span class="post-reward">{{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}</span>
        </div>
        <p class="post-desc">{{ truncateText(post.description) || '暂无描述' }}</p>
        <div class="post-meta">
          <span class="tag">{{ post.type }}</span>
          <span>{{ post.campus || '未填写校区' }}</span>
          <span>{{ formatTime(post.created_at) }}</span>
        </div>
      </div>

      <h2 class="section-title">TA 收到的评价</h2>
      <p v-if="reviews.length === 0" class="tip">暂无评价</p>
      <div v-for="r in reviews" :key="r.id" class="review-card">
        <div class="review-head">
          <span class="star-rating">⭐ {{ r.rating }}</span>
          <span class="reviewer">{{ r.reviewer_nickname || '匿名用户' }}</span>
        </div>
        <p class="review-content">{{ r.content || '（无内容）' }}</p>
        <div class="review-time">{{ formatTime(r.created_at) }}</div>
      </div>
    </template>
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
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #4f46e5;
  font-size: 15px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 12px;
}
.back-btn:hover {
  color: #2563eb;
}
.tip {
  text-align: center;
  color: #6b7280;
}
.tip.error {
  color: #dc2626;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 18px;
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
.section-title {
  font-size: 16px;
  margin: 0 0 12px;
  color: #111827;
}
.post-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: 14px;
  cursor: pointer;
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
  font-size: 17px;
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
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.star-rating {
  color: #f59e0b;
  font-weight: 600;
  font-size: 14px;
}
.review-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.review-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.reviewer {
  color: #6b7280;
  font-size: 13px;
}
.review-content {
  margin: 0;
  color: #374151;
  line-height: 1.6;
}
.review-time {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
