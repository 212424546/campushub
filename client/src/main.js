import { createApp } from 'vue'
import axios from 'axios'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import router from './router'

// 统一 API 基地址（来自环境变量 VITE_API_BASE_URL）
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || ''

// 全局响应拦截：后端返回 403（如禁言/封禁）时，用 ElMessage 提示后端 msg
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && (err.response.status === 403 || err.response.data?.code === 403)) {
      ElMessage.error(err.response.data?.msg || '无权限操作')
    }
    return Promise.reject(err)
  }
)

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
