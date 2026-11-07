<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import dayjs from 'dayjs'
import { isSocialType } from '../constants.js'
import CommentItem from '../components/CommentItem.vue'

const route = useRoute()
const router = useRouter()

const post = ref(null)
const loading = ref(true)
const error = ref('')
const orderLoading = ref(false)
const orderDone = ref(false)
const likeLoading = ref(false)
const favLoading = ref(false)

// 评论相关
const comments = ref([])
const commentsLoading = ref(false)
const commentText = ref('')
const commentSending = ref(false)
const replyTo = ref(null)
const commentInput = ref(null)

function getCurrentUserId() {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    let payload = token.split('.')[1]
    payload = payload.replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4) payload += '='
    return JSON.parse(atob(payload)).user_id ?? null
  } catch {
    return null
  }
}

const myUserId = ref(getCurrentUserId())

onMounted(async () => {
  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: 'Bearer ' + token } : {}
  try {
    const res = await axios.get('http://localhost:3000/api/posts/' + route.params.id, { headers })
    post.value = res.data.data
  } catch (err) {
    error.value = err.response?.data?.msg || '加载帖子失败'
  } finally {
    loading.value = false
  }
  fetchComments()
  if (token) {
    axios.post('http://localhost:3000/api/posts/' + route.params.id + '/history', {}, { headers }).catch(() => {})
  }
})

function formatTime(t) {
  if (!t) return '-'
  return dayjs(String(t).replace(' ', 'T')).format('YYYY-MM-DD HH:mm')
}

function formatRating(r) {
  if (r == null || Number(r) === 0) return '暂无评分'
  return r
}

const isAnonymous = computed(() => post.value?.is_anonymous === 1 || post.value?.is_anonymous === true)

const isSocial = computed(() => isSocialType(post.value?.type))

const buttonText = computed(() => {
  if (orderDone.value) return '已接单'
  if (post.value && post.value.status !== 0) return '已接单'
  return '立即接单'
})

const buttonDisabled = computed(() => orderLoading.value || orderDone.value || (post.value && post.value.status !== 0))

function goUser(userId) {
  if (userId != null) router.push('/user/' + userId)
}

async function takeOrder() {
  const token = localStorage.getItem('token')
  if (!token) {
    alert('请先登录后再接单')
    router.push('/login')
    return
  }
  orderLoading.value = true
  try {
    const res = await axios.post(
      'http://localhost:3000/api/orders',
      { post_id: Number(route.params.id) },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      alert('接单成功')
      orderDone.value = true
    } else {
      alert(res.data.msg || '接单失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '接单失败')
  } finally {
    orderLoading.value = false
  }
}

async function toggleLike() {
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); router.push('/login'); return }
  likeLoading.value = true
  try {
    const res = await axios.post(
      'http://localhost:3000/api/posts/' + route.params.id + '/like',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      post.value.is_liked = res.data.data.is_liked
      post.value.likes_count = res.data.data.likes_count
    } else {
      alert(res.data.msg || '操作失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '操作失败')
  } finally {
    likeLoading.value = false
  }
}

async function toggleFavorite() {
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); router.push('/login'); return }
  favLoading.value = true
  try {
    const res = await axios.post(
      'http://localhost:3000/api/posts/' + route.params.id + '/favorite',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      post.value.is_favorited = res.data.data.is_favorited
      post.value.favorites_count = res.data.data.favorites_count
    } else {
      alert(res.data.msg || '操作失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '操作失败')
  } finally {
    favLoading.value = false
  }
}

async function reportTarget(target_type, target_id) {
  const reason = prompt('请输入举报理由')
  if (reason === null) return
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); router.push('/login'); return }
  try {
    const res = await axios.post(
      'http://localhost:3000/api/reports',
      { target_type, target_id, reason },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      alert('举报已提交，感谢反馈')
    } else {
      alert(res.data.msg || '举报失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '举报失败')
  }
}

function flattenReplies(comments) {
  const list = comments || []
  const nicknameById = new Map()
  const collect = (items) => {
    for (const c of items) {
      nicknameById.set(c.id, c.nickname)
      if (c.replies && c.replies.length) collect(c.replies)
    }
  }
  collect(list)

  return list.map((top) => {
    const flatReplies = []
    const walk = (replies) => {
      for (const r of replies) {
        flatReplies.push({
          ...r,
          reply_to_nickname: nicknameById.get(r.parent_id) || '匿名用户',
        })
        if (r.replies && r.replies.length) walk(r.replies)
      }
    }
    if (top.replies && top.replies.length) walk(top.replies)
    return { ...top, replies: flatReplies, isExpanded: false }
  })
}

async function fetchComments() {
  commentsLoading.value = true
  try {
    const res = await axios.get('http://localhost:3000/api/posts/' + route.params.id + '/comments')
    comments.value = flattenReplies(res.data.data || [])
  } catch (err) {
    comments.value = []
  } finally {
    commentsLoading.value = false
  }
}

function startReply(comment) {
  replyTo.value = comment
  commentText.value = ''
  commentInput.value?.focus()
}

function cancelReply() {
  replyTo.value = null
  commentText.value = ''
}

async function sendComment() {
  const content = commentText.value.trim()
  if (!content) return
  const token = localStorage.getItem('token')
  if (!token) {
    alert('请先登录后再评论')
    router.push('/login')
    return
  }
  commentSending.value = true
  try {
    const res = await axios.post(
      'http://localhost:3000/api/posts/' + route.params.id + '/comments',
      { content, parent_id: replyTo.value ? replyTo.value.id : null },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      commentText.value = ''
      replyTo.value = null
      await fetchComments()
    } else {
      alert(res.data.msg || '评论失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '评论失败')
  } finally {
    commentSending.value = false
  }
}

async function toggleCommentLike(comment) {
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); router.push('/login'); return }
  try {
    const res = await axios.post(
      'http://localhost:3000/api/comments/' + comment.id + '/like',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      comment.is_liked = res.data.data.is_liked
      comment.likes_count = res.data.data.likes_count
    } else {
      alert(res.data.msg || '操作失败')
    }
  } catch (err) {
    alert(err.response?.data?.msg || '操作失败')
  }
}

function blockUser() {
  if (!post.value || post.value.user_id == null) return
  if (!confirm('确定拉黑该用户吗？')) return
  const token = localStorage.getItem('token')
  if (!token) { alert('请先登录'); router.push('/login'); return }
  axios.post(
    'http://localhost:3000/api/users/block',
    { blocked_user_id: post.value.user_id },
    { headers: { Authorization: 'Bearer ' + token } }
  ).then((res) => {
    if (res.data.code === 0) {
      alert('已拉黑')
      router.push('/')
    } else {
      alert(res.data.msg || '拉黑失败')
    }
  }).catch((err) => {
    alert(err.response?.data?.msg || '拉黑失败')
  })
}
</script>

<template>
  <div class="page">
    <button class="back-btn" @click="router.back()">← 返回</button>
    <div v-if="loading" class="tip">加载中…</div>
    <div v-else-if="error" class="tip error">{{ error }}</div>

    <div v-else-if="post" class="card">
      <h1 class="title">{{ post.title }}</h1>

      <div class="author-row">
        <div class="author" :class="{ clickable: !isAnonymous && post.user_id != null }" @click="goUser(post.user_id)">
          <div class="avatar">
            <img v-if="post.avatar_url" :src="post.avatar_url" alt="头像" />
            <span v-else>{{ (post.nickname || '匿')[0] }}</span>
          </div>
          <div class="author-info">
            <div class="author-nickname">{{ isAnonymous ? '匿名用户' : (post.nickname || '未设置昵称') }}</div>
            <div v-if="!isAnonymous" class="author-meta">信用分 {{ post.credit_score ?? '-' }} · {{ formatRating(post.avg_rating) }}</div>
          </div>
        </div>
        <a v-if="!isAnonymous && post.user_id && post.user_id !== myUserId" class="block-link" @click="blockUser">拉黑</a>
      </div>

      <div class="tags">
        <span class="tag">{{ post.type }}</span>
        <span class="tag">{{ isAnonymous ? '匿名发布' : '实名发布' }}</span>
      </div>

      <div v-if="!isSocial" class="reward">{{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}</div>

      <div class="rows">
        <div class="row"><span class="label">校区</span><span>{{ post.campus || '未填写' }}</span></div>
        <div class="row"><span class="label">发布时间</span><span>{{ formatTime(post.created_at) }}</span></div>
      </div>

      <div class="desc">
        <h2>描述</h2>
        <p>{{ post.description || '暂无描述' }}</p>
        <div class="desc-actions">
          <button class="icon-btn report-btn" @click="reportTarget('post', post.id)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>举报</span>
          </button>
        </div>
      </div>

      <div class="post-actions">
        <button class="icon-btn like-btn" :class="{ liked: post.is_liked }" :disabled="likeLoading" @click="toggleLike">
          <svg viewBox="0 0 24 24" width="16" height="16" :fill="post.is_liked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>{{ post.likes_count || 0 }}</span>
        </button>
        <button class="icon-btn fav-btn" :class="{ favorited: post.is_favorited }" :disabled="favLoading" @click="toggleFavorite">
          <svg viewBox="0 0 24 24" width="16" height="16" :fill="post.is_favorited ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>{{ post.favorites_count || 0 }}</span>
        </button>
      </div>

      <button v-if="!isSocial" class="take-btn" :disabled="buttonDisabled" @click="takeOrder">
        {{ orderLoading ? '接单中…' : buttonText }}
      </button>

      <div class="comments">
        <h3>评论 {{ comments.length }}</h3>
        <div v-if="commentsLoading" class="tip">加载中…</div>
        <p v-else-if="comments.length === 0" class="tip">暂无评论</p>
        <div v-else class="comment-list">
          <div v-for="c in comments" :key="c.id">
            <CommentItem
              :comment="c"
              @reply="startReply"
              @like="toggleCommentLike"
              @report="(item) => reportTarget('comment', item.id)"
            />
            <div v-if="c.replies && c.replies.length" class="replies">
              <CommentItem
                v-for="r in (c.isExpanded ? c.replies : c.replies.slice(0, 3))"
                :key="r.id"
                :comment="r"
                @reply="startReply"
                @like="toggleCommentLike"
                @report="(item) => reportTarget('comment', item.id)"
              />
              <button v-if="c.replies.length > 3" class="toggle-replies" @click="c.isExpanded = !c.isExpanded">
                {{ c.isExpanded ? '收起' : ('展开剩余 ' + (c.replies.length - 3) + ' 条回复') }}
              </button>
            </div>
          </div>
        </div>

        <div class="comment-input-row">
          <div v-if="replyTo" class="reply-hint">
            <span>回复 @{{ replyTo.nickname || '匿名用户' }}</span>
            <button class="cancel-reply" @click="cancelReply">取消</button>
          </div>
          <div class="input-row">
            <input
              ref="commentInput"
              v-model="commentText"
              type="text"
              :placeholder="replyTo ? '回复 @' + (replyTo.nickname || '匿名用户') + '…' : '写下你的评论…'"
              @keyup.enter="sendComment"
            />
            <button class="send-btn" :disabled="commentSending" @click="sendComment">发送</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
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
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.title {
  font-size: 22px;
  margin: 0 0 14px;
  color: #111827;
  line-height: 1.4;
}
.author-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.author.clickable {
  cursor: pointer;
}
.avatar {
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
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.author-info {
  min-width: 0;
}
.author-nickname {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.author-meta {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
.block-link {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  flex-shrink: 0;
}
.block-link:hover {
  color: #6b7280;
  text-decoration: underline;
}
.tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.tag {
  background: #eef2ff;
  color: #4f46e5;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 13px;
}
.reward {
  color: #ea580c;
  font-weight: 600;
  font-size: 20px;
  margin-bottom: 16px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #374151;
}
.row .label {
  color: #6b7280;
}
.desc {
  border-top: 1px solid #f3f4f6;
  padding-top: 14px;
  margin-bottom: 16px;
}
.desc h2 {
  font-size: 15px;
  margin: 0 0 10px;
  color: #111827;
}
.desc p {
  margin: 0;
  line-height: 1.7;
  color: #4b5563;
  white-space: pre-wrap;
}
.desc-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.post-actions {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
  margin-bottom: 14px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}
.icon-btn svg {
  flex-shrink: 0;
}
.like-btn.liked {
  color: #ef4444;
}
.fav-btn.favorited {
  color: #f59e0b;
}
.report-btn {
  color: #9ca3af;
}
.report-btn:hover {
  color: #6b7280;
}
.take-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
.take-btn:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}
.comments {
  margin-top: 20px;
  border-top: 1px solid #f3f4f6;
  padding-top: 16px;
}
.comments h3 {
  font-size: 15px;
  margin: 0 0 12px;
  color: #111827;
}
.comment-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.replies {
  margin-left: 28px;
}
.toggle-replies {
  display: inline-block;
  border: none;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 0;
}
.toggle-replies:hover {
  text-decoration: underline;
}
.comment-input-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reply-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #2563eb;
}
.cancel-reply {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
}
.cancel-reply:hover {
  color: #6b7280;
  text-decoration: underline;
}
.input-row {
  display: flex;
  gap: 8px;
}
.input-row input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}
.input-row input:focus {
  border-color: #4f46e5;
}
.send-btn {
  flex-shrink: 0;
  border: none;
  background: #4f46e5;
  color: #fff;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.send-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
</style>
