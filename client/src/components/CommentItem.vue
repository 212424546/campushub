<script setup>
import dayjs from 'dayjs'

defineOptions({ name: 'CommentItem' })

const props = defineProps({
  comment: { type: Object, required: true },
})

const emit = defineEmits(['reply', 'like', 'report', 'goUser'])

function formatTime(t) {
  if (!t) return ''
  return dayjs(String(t).replace(' ', 'T')).format('MM-DD HH:mm')
}
</script>

<template>
  <div class="comment-item">
    <div class="comment-head">
      <div class="comment-head-left">
        <span
          class="comment-nickname"
          :class="{ clickable: comment.user_id }"
          @click="emit('goUser', comment)"
        >{{ comment.nickname || '匿名用户' }}</span>
        <el-tag v-if="comment.is_owner" size="small" type="primary">我</el-tag>
      </div>
      <div class="comment-head-right">
        <button class="icon-btn report-btn" @click="emit('report', comment)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>举报</span>
        </button>
        <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
      </div>
    </div>
    <p class="comment-content"><span v-if="comment.reply_to_nickname" class="reply-to">@{{ comment.reply_to_nickname }} </span>{{ comment.content }}</p>
    <div class="comment-actions">
      <button class="icon-btn like-btn" :class="{ liked: comment.is_liked }" @click="emit('like', comment)">
        <svg viewBox="0 0 24 24" width="14" height="14" :fill="comment.is_liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span>{{ comment.likes_count || 0 }}</span>
      </button>
      <button class="icon-btn reply-btn" @click="emit('reply', comment)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>回复</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.comment-item {
  background: #f9fafb;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}
.comment-head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.comment-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.comment-nickname {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.comment-nickname.clickable {
  cursor: pointer;
}
.comment-nickname.clickable:hover {
  color: #2563eb;
  text-decoration: underline;
}
.comment-time {
  font-size: 12px;
  color: #9ca3af;
}
.comment-content {
  margin: 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.reply-to {
  color: #2563eb;
  font-weight: 500;
}
.comment-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}
.icon-btn svg {
  flex-shrink: 0;
}
.like-btn.liked {
  color: #ef4444;
}
.reply-btn:hover {
  color: #2563eb;
}
.report-btn {
  color: #9ca3af;
}
.report-btn:hover {
  color: #6b7280;
}
.replies {
  margin-top: 10px;
}
</style>
