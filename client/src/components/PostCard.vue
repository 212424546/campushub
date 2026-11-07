<script setup>
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { truncateText } from '../constants.js'

const props = defineProps({
  post: { type: Object, required: true },
})

const router = useRouter()

function formatTime(t) {
  if (!t) return ''
  return dayjs(String(t).replace(' ', 'T')).format('YYYY-MM-DD HH:mm')
}

function go() {
  const id = props.post?.post_id ?? props.post?.id
  if (id != null) router.push('/post/' + id)
}
</script>

<template>
  <div class="post-card" @click="go">
    <div class="head">
      <h3 class="title">{{ post.title || '帖子已删除' }}</h3>
      <span v-if="post.type" class="tag">{{ post.type }}</span>
    </div>
    <p class="desc">{{ truncateText(post.description) || '暂无描述' }}</p>
    <div class="meta">
      <span>🏫 {{ post.campus || '未填写校区' }}</span>
      <span v-if="post.viewed_at || post.created_at">{{ formatTime(post.viewed_at || post.created_at) }}</span>
    </div>
  </div>
</template>

<style scoped>
.post-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  margin-bottom: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}
.post-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.title {
  font-size: 16px;
  margin: 0;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  background: #eef2ff;
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  white-space: nowrap;
}
.desc {
  margin: 8px 0 0;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  word-break: break-all;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
  margin-top: 8px;
}
</style>
