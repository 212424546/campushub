import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import CreatePost from '../views/CreatePost.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
  { path: '/create', name: 'create', component: CreatePost },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
