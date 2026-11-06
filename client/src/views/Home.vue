<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const posts = ref([])
const loading = ref(true)
const error = ref('')

async function fetchPosts() {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get('http://localhost:3000/api/posts')
    posts.value = res.data.data || []
  } catch (err) {
    error.value = '加载帖子失败：' + (err.response?.data?.msg || err.message || err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchPosts)
</script>

<template>
  <div class="page">
    <h1>校园互助 · 帖子列表</h1>

    <p v-if="loading" class="tip">加载中…</p>
    <p v-else-if="error" class="tip error">{{ error }}</p>
    <p v-else-if="posts.length === 0" class="tip">暂无帖子，快去发第一个吧～</p>

    <ul v-else class="post-list">
      <li v-for="post in posts" :key="post.id" class="post-card">
        <div class="post-head">
          <h2 class="post-title">{{ post.title }}</h2>
          <span class="post-reward">报酬 ¥{{ post.reward }}</span>
        </div>
        <p class="post-desc">{{ post.description || '暂无描述' }}</p>
        <div class="post-meta">
          <span class="tag">{{ post.type }}</span>
          <span class="campus">🏫 {{ post.campus || '未填写校区' }}</span>
          <span class="nickname">👤 {{ post.nickname || '匿名用户' }}</span>
        </div>
      </li>
    </ul>
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
</style>
