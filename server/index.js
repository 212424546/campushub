import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import ordersRoutes from './routes/orders.js';
import reviewsRoutes from './routes/reviews.js';
import disputesRoutes from './routes/disputes.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';
import commentsRoutes from './routes/comments.js';
import reportsRoutes from './routes/reports.js';
import uploadRoutes from './routes/upload.js';
import { ok } from './utils/response.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件：开启 CORS
app.use(cors());
// 中间件：解析 JSON 请求体
app.use(express.json());

// 静态托管上传的图片，前端可直接通过 /uploads/xxx.jpg 访问
app.use('/uploads', express.static('uploads'));

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json(ok(null));
});

// 挂载用户认证路由
app.use('/api/auth', authRoutes);

// 挂载帖子路由
app.use('/api/posts', postsRoutes);

// 挂载图片上传路由（POST /api/upload）
app.use('/api', uploadRoutes);

// 挂载评论互动路由
app.use('/api/comments', commentsRoutes);

// 挂载举报路由
app.use('/api/reports', reportsRoutes);

// 挂载订单路由
app.use('/api/orders', ordersRoutes);

// 挂载评价路由
app.use('/api/reviews', reviewsRoutes);

// 挂载申诉路由
app.use('/api/disputes', disputesRoutes);

// 挂载后台管理路由
app.use('/api/admin', adminRoutes);

// 挂载用户公开信息路由
app.use('/api/users', usersRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
