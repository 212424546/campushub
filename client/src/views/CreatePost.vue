<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { SOCIAL_TYPES, getImageUrl } from '../constants.js'

const router = useRouter()

const categories = ['跑腿', '二手', '失物招领', '学习', ...SOCIAL_TYPES]

const title = ref('')
const description = ref('')
const type = ref('跑腿')
const reward = ref('')

const isSocial = computed(() => SOCIAL_TYPES.includes(type.value))
const campus = ref('')
const isAnonymous = ref(false)
const loading = ref(false)
const message = ref('')
const uploadedImages = ref([])

const uploadHeaders = computed(() => ({
  Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
}))

function onUploadSuccess(response, uploadFile) {
  if (response && response.code === 0 && response.data && response.data.url) {
    uploadedImages.value.push(response.data.url)
    if (uploadFile) {
      uploadFile.url = getImageUrl(response.data.url)
    }
  }
}

async function submit() {
  const token = localStorage.getItem('token')
  if (!token) {
    message.value = '请先登录后再发帖'
    router.push('/login')
    return
  }
  if (!title.value || !type.value) {
    message.value = '标题和分类不能为空'
    return
  }

  loading.value = true
  message.value = ''
  try {
    const res = await axios.post(
      'http://localhost:3000/api/posts',
      {
        type: type.value,
        title: title.value,
        description: description.value,
        reward: isSocial.value ? 0 : Number(reward.value) || 0,
        campus: campus.value,
        is_anonymous: isAnonymous.value ? 1 : 0,
        images: uploadedImages.value,
      },
      {
        headers: { Authorization: 'Bearer ' + token },
      }
    )

    if (res.data.code === 0) {
      router.push('/')
    } else {
      message.value = res.data.msg || '发布失败'
    }
  } catch (err) {
    message.value = err.response?.data?.msg || '发布失败，请稍后再试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto mt-20 p-8 bg-white rounded-2xl shadow-lg">
    <h1 class="text-xl font-bold text-center text-gray-800 mb-6">发布帖子</h1>

    <el-form label-position="top" @submit.prevent>
      <el-form-item label="标题">
        <el-input v-model="title" placeholder="请输入标题" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="4" placeholder="请描述需求详情" />
      </el-form-item>

      <el-form-item label="分类">
        <el-select v-model="type" class="w-full" placeholder="请选择分类">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="!isSocial" label="报酬（元）">
        <el-input v-model="reward" type="number" min="0" placeholder="0" />
      </el-form-item>

      <el-form-item label="校区">
        <el-input v-model="campus" placeholder="如：东校区 / 西校区" />
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="isAnonymous">匿名发布</el-checkbox>
      </el-form-item>

      <el-form-item label="图片（最多 3 张）">
        <el-upload
          name="file"
          action="http://localhost:3000/api/upload"
          :headers="uploadHeaders"
          list-type="picture-card"
          :limit="3"
          accept="image/*"
          :on-success="onUploadSuccess"
        >
          <span class="text-gray-400">上传</span>
        </el-upload>
      </el-form-item>
    </el-form>

    <p v-if="message" class="text-red-500 text-sm mb-4">{{ message }}</p>

    <el-button type="primary" class="w-full" :loading="loading" @click="submit">
      {{ loading ? '发布中…' : '发布' }}
    </el-button>
  </div>
</template>

