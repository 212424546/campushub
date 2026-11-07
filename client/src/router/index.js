import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import CreatePost from '../views/CreatePost.vue'
import PostDetail from '../views/PostDetail.vue'
import UserCenter from '../views/UserCenter.vue'
import PublicProfile from '../views/PublicProfile.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
  { path: '/create', name: 'create', component: CreatePost },
  { path: '/post/:id', name: 'post-detail', component: PostDetail },
  { path: '/user-center', name: 'user-center', component: UserCenter },
  { path: '/user/:id', name: 'public-profile', component: PublicProfile },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
