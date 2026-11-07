import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import auth from '../middlewares/auth.js';
import { get, run, all } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

/**
 * 学号脱敏：隐藏中间几位，保留首尾。
 * 例如 "20260001" -> "20****01"
 */
function maskStudentId(studentId) {
  if (!studentId || typeof studentId !== 'string') {
    return studentId;
  }
  if (studentId.length <= 4) {
    return studentId[0] + '*'.repeat(studentId.length - 1);
  }
  return studentId.slice(0, 2) + '*'.repeat(studentId.length - 4) + studentId.slice(-2);
}

// GET /api/users/:id/profile  获取用户公开主页（无需登录）
router.get('/:id/profile', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json(fail(400, '无效的用户 ID'));
    }

    const user = await get(
      'SELECT id, student_id, nickname, role, credit_score, avg_rating FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }

    return res.json(
      ok({
        id: user.id,
        student_id: maskStudentId(user.student_id),
        nickname: user.nickname,
        role: user.role,
        credit_score: user.credit_score,
        avg_rating: user.avg_rating,
      })
    );
  } catch (err) {
    console.error('[users/profile]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/me  当前登录用户信息（需鉴权）
router.get('/me', auth, async (req, res) => {
  try {
    const user = await get(
      'SELECT id, student_id, nickname, avatar_url, bio, role, credit_score, avg_rating FROM users WHERE id = ?',
      [req.user.user_id]
    );
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }
    return res.json(ok({
      id: user.id,
      student_id: user.student_id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      bio: user.bio,
      role: user.role,
      credit_score: user.credit_score,
      avg_rating: user.avg_rating,
    }));
  } catch (err) {
    console.error('[users/me]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/me/likes  我点赞的帖子（需鉴权）
router.get('/me/likes', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT l.id, l.post_id, l.created_at,
              p.title, p.type, p.campus, p.description
       FROM likes l
       LEFT JOIN posts p ON p.id = l.post_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC, l.id DESC`,
      [req.user.user_id]
    );
    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      title: row.title,
      type: row.type,
      campus: row.campus,
      description: row.description,
      created_at: row.created_at,
    }));
    return res.json(ok(data));
  } catch (err) {
    console.error('[users/likes]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/me/favorites  我收藏的帖子（需鉴权）
router.get('/me/favorites', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT f.id, f.post_id, f.created_at,
              p.title, p.type, p.campus, p.description
       FROM favorites f
       LEFT JOIN posts p ON p.id = f.post_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC, f.id DESC`,
      [req.user.user_id]
    );
    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      title: row.title,
      type: row.type,
      campus: row.campus,
      description: row.description,
      created_at: row.created_at,
    }));
    return res.json(ok(data));
  } catch (err) {
    console.error('[users/favorites]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/me/history  我的浏览历史（需鉴权）
router.get('/me/history', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT h.id, h.post_id, h.viewed_at,
              p.title, p.type, p.campus, p.description
       FROM history h
       LEFT JOIN posts p ON p.id = h.post_id
       WHERE h.user_id = ?
       ORDER BY h.viewed_at DESC, h.id DESC`,
      [req.user.user_id]
    );
    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      title: row.title,
      type: row.type,
      campus: row.campus,
      description: row.description,
      viewed_at: row.viewed_at,
    }));
    return res.json(ok(data));
  } catch (err) {
    console.error('[users/history]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/me/blacklist  我拉黑的用户列表（需鉴权）
router.get('/me/blacklist', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT b.id, b.blocked_user_id, b.created_at,
              u.nickname, u.avatar_url
       FROM blacklists b
       LEFT JOIN users u ON u.id = b.blocked_user_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC, b.id DESC`,
      [req.user.user_id]
    );
    const data = rows.map((row) => ({
      id: row.blocked_user_id,
      nickname: row.nickname,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
    }));
    return res.json(ok(data));
  } catch (err) {
    console.error('[users/blacklist]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// PUT /api/users/profile  修改个人资料（昵称/密码，需鉴权；密码重新 Hash）
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname, password, avatar_url, bio } = req.body || {};

    const updates = [];
    const params = [];

    if (nickname !== undefined && nickname !== null) {
      updates.push('nickname = ?');
      params.push(nickname);
    }
    if (avatar_url !== undefined && avatar_url !== null) {
      updates.push('avatar_url = ?');
      params.push(avatar_url);
    }
    if (bio !== undefined && bio !== null) {
      updates.push('bio = ?');
      params.push(bio);
    }

    if (password !== undefined && String(password) !== '') {
      if (String(password).length < 6) {
        return res.status(400).json(fail(400, '密码长度不能少于 6 位'));
      }
      const hash = await bcrypt.hash(String(password), 10);
      updates.push('password = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json(fail(400, '没有需要修改的内容'));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.user.user_id);

    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const user = await get(
      'SELECT id, student_id, nickname, avatar_url, bio, role, credit_score, avg_rating FROM users WHERE id = ?',
      [req.user.user_id]
    );

    return res.json(ok({
      id: user.id,
      student_id: user.student_id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      bio: user.bio,
      role: user.role,
      credit_score: user.credit_score,
      avg_rating: user.avg_rating,
    }));
  } catch (err) {
    console.error('[users/update-profile]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/reviews  查询用户收到的评价（支持 ?user_id=xxx 查任意用户；不带则查当前登录用户）
router.get('/reviews', async (req, res) => {
  try {
    let targetUserId = null;
    if (req.query.user_id !== undefined && req.query.user_id !== '') {
      targetUserId = Number(req.query.user_id);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json(fail(400, '无效的 user_id'));
      }
    } else {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json(fail(401, '未登录或 Token 缺失'));
      }
      try {
        const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        targetUserId = payload.user_id;
      } catch {
        return res.status(401).json(fail(401, 'Token 无效或已过期'));
      }
    }

    const rows = await all(
      `SELECT
         r.id, r.order_id, r.rating, r.content, r.created_at,
         u.nickname AS reviewer_nickname
       FROM reviews r
       LEFT JOIN users u ON u.id = r.from_user_id
       WHERE r.to_user_id = ? AND r.status = 0
       ORDER BY r.created_at DESC, r.id DESC`,
      [targetUserId]
    );

    const data = rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      rating: row.rating,
      content: row.content,
      reviewer_nickname: row.reviewer_nickname,
      created_at: row.created_at,
    }));

    return res.json(ok(data));
  } catch (err) {
    console.error('[users/reviews]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/users/:id/public  公共主页（无需鉴权，含用户资料和正常帖子）
router.get('/:id/public', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json(fail(400, '无效的用户 ID'));
    }

    const user = await get(
      'SELECT id, nickname, avatar_url, bio, credit_score, avg_rating FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }

    const posts = await all(
      `SELECT id, type, title, description, reward, campus, status, is_anonymous, created_at
       FROM posts
       WHERE user_id = ? AND is_deleted = 0 AND status >= 0
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    return res.json(ok({
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      bio: user.bio,
      credit_score: user.credit_score,
      avg_rating: user.avg_rating,
      posts,
    }));
  } catch (err) {
    console.error('[users/public]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/users/block  拉黑用户（需鉴权）
router.post('/block', auth, async (req, res) => {
  try {
    const blockedId = Number(req.body?.blocked_user_id);
    if (!Number.isInteger(blockedId) || blockedId <= 0) {
      return res.status(400).json(fail(400, '无效的 blocked_user_id'));
    }
    if (blockedId === req.user.user_id) {
      return res.status(400).json(fail(400, '不能拉黑自己'));
    }

    const target = await get('SELECT id FROM users WHERE id = ?', [blockedId]);
    if (!target) {
      return res.status(404).json(fail(404, '被拉黑用户不存在'));
    }

    const existing = await get(
      'SELECT id FROM blacklists WHERE user_id = ? AND blocked_user_id = ?',
      [req.user.user_id, blockedId]
    );
    if (existing) {
      return res.json(ok({ blocked: true, id: existing.id }));
    }

    const result = await run(
      'INSERT INTO blacklists (user_id, blocked_user_id) VALUES (?, ?)',
      [req.user.user_id, blockedId]
    );

    return res.status(201).json(ok({ blocked: true, id: result.lastID }));
  } catch (err) {
    console.error('[users/block]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// DELETE /api/users/block/:blocked_user_id  解除拉黑（需鉴权）
router.delete('/block/:blocked_user_id', auth, async (req, res) => {
  try {
    const blockedId = Number(req.params.blocked_user_id);
    if (!Number.isInteger(blockedId) || blockedId <= 0) {
      return res.status(400).json(fail(400, '无效的 blocked_user_id'));
    }

    const result = await run(
      'DELETE FROM blacklists WHERE user_id = ? AND blocked_user_id = ?',
      [req.user.user_id, blockedId]
    );

    return res.json(ok({ deleted: result.changes > 0 }));
  } catch (err) {
    console.error('[users/unblock]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
