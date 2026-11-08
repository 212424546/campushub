<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import dayjs from 'dayjs'
import { isSocialType, getImageUrl } from '../constants.js'
import { ElMessage, ElMessageBox } from 'element-plus'
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
const isAnonymousComment = ref(false)

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
    const res = await axios.get('/api/posts/' + route.params.id, { headers })
    post.value = res.data.data
  } catch (err) {
    error.value = err.response?.data?.msg || '加载帖子失败'
  } finally {
    loading.value = false
  }
  fetchComments()
  if (token) {
    axios.post('/api/posts/' + route.params.id + '/history', {}, { headers }).catch(() => {})
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

const isOwnPost = computed(() => !!post.value?.is_owner)

function goUser(userId) {
  if (userId != null) router.push('/user/' + userId)
}

function goPostAuthor() {
  if (isAnonymous.value && !post.value?.is_owner) {
    ElMessage.info('该用户已匿名')
    return
  }
  goUser(post.value?.user_id)
}

function goCommentUser(comment) {
  if (comment.is_anonymous === 1 && !comment.is_owner) {
    ElMessage.info('该用户已匿名')
    return
  }
  goUser(comment.user_id)
}

async function takeDownPost() {
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  const isDelete = isSocial.value
  const actionText = isDelete ? '删除' : '下架'
  try {
    await ElMessageBox.confirm(`确定${actionText}该帖子吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    const res = await axios.delete('/api/posts/' + post.value.id, {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (res.data.code === 0) {
      ElMessage.success(isDelete ? '帖子已删除' : '帖子已下架')
      router.push('/')
    } else {
      ElMessage.error(res.data.msg || `${actionText}失败`)
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || `${actionText}失败`)
  }
}

async function takeOrder() {
  const token = localStorage.getItem('token')
  if (!token) {
    ElMessage.warning('请先登录后再接单')
    router.push('/login')
    return
  }
  orderLoading.value = true
  try {
    const res = await axios.post(
      '/api/orders',
      { post_id: Number(route.params.id) },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      ElMessage.success('接单成功')
      orderDone.value = true
    } else {
      ElMessage.error(res.data.msg || '接单失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '接单失败')
  } finally {
    orderLoading.value = false
  }
}

async function toggleLike() {
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  likeLoading.value = true
  try {
    const res = await axios.post(
      '/api/posts/' + route.params.id + '/like',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      post.value.is_liked = res.data.data.is_liked
      post.value.likes_count = res.data.data.likes_count
    } else {
      ElMessage.error(res.data.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  } finally {
    likeLoading.value = false
  }
}

async function toggleFavorite() {
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  favLoading.value = true
  try {
    const res = await axios.post(
      '/api/posts/' + route.params.id + '/favorite',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      post.value.is_favorited = res.data.data.is_favorited
      post.value.favorites_count = res.data.data.favorites_count
    } else {
      ElMessage.error(res.data.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  } finally {
    favLoading.value = false
  }
}

async function reportTarget(target_type, target_id) {
  let reason
  try {
    const { value } = await ElMessageBox.prompt('请输入举报理由', '举报', { inputValue: '' })
    reason = value
  } catch {
    return
  }
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  try {
    const res = await axios.post(
      '/api/reports',
      { target_type, target_id, reason },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      ElMessage.success('举报已提交，感谢反馈')
    } else {
      ElMessage.error(res.data.msg || '举报失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '举报失败')
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
    const res = await axios.get('/api/posts/' + route.params.id + '/comments')
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
    ElMessage.warning('请先登录后再评论')
    router.push('/login')
    return
  }
  commentSending.value = true
  try {
    const res = await axios.post(
      '/api/posts/' + route.params.id + '/comments',
      {
        content,
        parent_id: replyTo.value ? replyTo.value.id : null,
        is_anonymous: isAnonymousComment.value ? 1 : 0,
      },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      commentText.value = ''
      replyTo.value = null
      await fetchComments()
    } else {
      ElMessage.error(res.data.msg || '评论失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '评论失败')
  } finally {
    commentSending.value = false
  }
}

async function toggleCommentLike(comment) {
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  try {
    const res = await axios.post(
      '/api/comments/' + comment.id + '/like',
      {},
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      comment.is_liked = res.data.data.is_liked
      comment.likes_count = res.data.data.likes_count
    } else {
      ElMessage.error(res.data.msg || '操作失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败')
  }
}

async function blockUser() {
  if (!post.value || post.value.user_id == null) return
  try {
    await ElMessageBox.confirm('确定拉黑该用户吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  const token = localStorage.getItem('token')
  if (!token) { ElMessage.warning('请先登录'); router.push('/login'); return }
  try {
    const res = await axios.post(
      '/api/users/block',
      { blocked_user_id: post.value.user_id },
      { headers: { Authorization: 'Bearer ' + token } }
    )
    if (res.data.code === 0) {
      ElMessage.success('已拉黑')
      router.push('/')
    } else {
      ElMessage.error(res.data.msg || '拉黑失败')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '拉黑失败')
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6">
    <el-button text @click="router.back()" class="mb-4">← 返回</el-button>

    <div v-if="loading" class="text-center text-gray-500 py-10">加载中…</div>
    <div v-else-if="error" class="text-center text-red-500 py-10">{{ error }}</div>

    <div v-else-if="post" class="bg-white rounded-xl shadow-sm p-6">
      <h1 class="text-2xl font-bold text-gray-800 mb-4">{{ post.title }}</h1>

      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3 cursor-pointer" @click="goPostAuthor">
          <el-avatar :size="44" :src="getImageUrl(post.avatar_url) || undefined">{{ (post.nickname || '匿')[0] }}</el-avatar>
          <div>
            <div class="flex items-center gap-1">
              <span class="font-semibold text-gray-800">{{ isAnonymous ? (post.nickname || '匿名用户') : (post.nickname || '未设置昵称') }}</span>
              <el-tag v-if="post.is_owner" size="small" type="primary">我</el-tag>
            </div>
            <div v-if="!isAnonymous" class="text-xs text-gray-400">信用分 {{ post.credit_score ?? '-' }} · {{ formatRating(post.avg_rating) }}</div>
          </div>
        </div>
        <el-button v-if="!isAnonymous && post.user_id && post.user_id !== myUserId" text type="danger" size="small" @click="blockUser">拉黑</el-button>
      </div>

      <div class="flex gap-2 mb-4">
        <el-tag size="small">{{ post.type }}</el-tag>
        <el-tag size="small" type="info">{{ isAnonymous ? '匿名发布' : '实名发布' }}</el-tag>
      </div>

      <div v-if="!isSocial" class="text-orange-600 font-semibold text-xl mb-4">{{ post.type === '二手' ? '价格' : '报酬' }} ¥{{ post.reward }}</div>

      <div class="space-y-2 mb-4 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">校区</span><span class="text-gray-700">{{ post.campus || '未填写' }}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">发布时间</span><span class="text-gray-700">{{ formatTime(post.created_at) }}</span></div>
      </div>

      <el-divider content-position="left">描述</el-divider>
      <p class="text-gray-600 leading-7 whitespace-pre-wrap mb-4">{{ post.description || '暂无描述' }}</p>
      <div v-if="post.images && post.images.length" class="flex flex-wrap gap-3 mb-4">
        <el-image
          v-for="(img, idx) in post.images"
          :key="idx"
          :src="getImageUrl(img)"
          :preview-src-list="post.images.map(getImageUrl)"
          :initial-index="idx"
          fit="cover"
          class="w-48 h-36 max-w-md rounded-lg shadow-sm cursor-pointer"
        />
      </div>

      <div class="flex justify-end mb-4">
        <el-button text type="danger" size="small" @click="reportTarget('post', post.id)">举报</el-button>
      </div>

      <div class="flex items-center gap-3 py-3 border-t border-gray-100 mb-4">
        <el-button :type="post.is_liked ? 'danger' : 'default'" :disabled="likeLoading" @click="toggleLike">👍 {{ post.likes_count || 0 }}</el-button>
        <el-button :type="post.is_favorited ? 'warning' : 'default'" :disabled="favLoading" @click="toggleFavorite">⭐ {{ post.favorites_count || 0 }}</el-button>
      </div>

      <el-button v-if="isOwnPost && isSocial" type="danger" size="large" class="w-full" @click="takeDownPost">
        删除帖子
      </el-button>
      <el-button v-else-if="isOwnPost && post.status === 0" type="danger" size="large" class="w-full" @click="takeDownPost">
        下架帖子
      </el-button>
      <el-button v-else-if="!isSocial" type="primary" size="large" class="w-full" :disabled="buttonDisabled" @click="takeOrder">
        {{ orderLoading ? '接单中…' : buttonText }}
      </el-button>

      <el-divider content-position="left">评论 {{ comments.length }}</el-divider>
      <div v-if="commentsLoading" class="text-center text-gray-500 py-4">加载中…</div>
      <p v-else-if="comments.length === 0" class="text-center text-gray-500 py-4">暂无评论</p>
      <div v-else>
        <div v-for="c in comments" :key="c.id">
          <CommentItem :comment="c" @reply="startReply" @like="toggleCommentLike" @report="(item) => reportTarget('comment', item.id)" @goUser="goCommentUser" />
          <div v-if="c.replies && c.replies.length" class="ml-7">
            <CommentItem v-for="r in (c.isExpanded ? c.replies : c.replies.slice(0, 3))" :key="r.id" :comment="r" @reply="startReply" @like="toggleCommentLike" @report="(item) => reportTarget('comment', item.id)" @goUser="goCommentUser" />
            <el-button v-if="c.replies.length > 3" text type="primary" size="small" @click="c.isExpanded = !c.isExpanded">
              {{ c.isExpanded ? '收起' : ('展开剩余 ' + (c.replies.length - 3) + ' 条回复') }}
            </el-button>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <div v-if="replyTo" class="flex items-center gap-2 text-sm text-indigo-600 mb-2">
          <span>回复 @{{ replyTo.nickname || '匿名用户' }}</span>
          <el-button text size="small" @click="cancelReply">取消</el-button>
        </div>
        <el-input
          ref="commentInput"
          v-model="commentText"
          type="textarea"
          :rows="2"
          :placeholder="replyTo ? '回复 @' + (replyTo.nickname || '匿名用户') + '…' : '写下你的评论…'"
        />
        <div class="flex items-center justify-between mt-2">
          <el-checkbox v-model="isAnonymousComment">匿名评论</el-checkbox>
          <el-button type="primary" :disabled="commentSending" @click="sendComment">发送</el-button>
        </div>
      </div>
    </div>
  </div>
</template>
