import express from 'express';
import auth from '../middlewares/auth.js';
import jwt from 'jsonwebtoken';
import { run, all, get } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { checkSensitive } from '../utils/sensitive.js';

const router = express.Router();

// 从请求头解析 token，返回 user_id；无 token 或无效则返回 null
function getCurrentUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return payload.user_id;
  } catch {
    return null;
  }
}

// POST /api/posts  发帖（需鉴权，含违禁词过滤）
router.post('/', auth, async (req, res) => {
  try {
    const { type, title, description, reward, campus, is_anonymous } = req.body || {};

    if (!type || !title) {
      return res.status(400).json(fail(400, 'type 和 title 不能为空'));
    }

    // 违禁词检查（title 和 description）
    const titleCheck = await checkSensitive(title);
    const descCheck = await checkSensitive(description || '');
    if (titleCheck.hit || descCheck.hit) {
      return res.json(fail(1001, '包含违规内容'));
    }

    // 归一化匿名标记：兼容布尔值/数字/字符串，避免 "0"/"false" 被当成 truthy
    const anonymous =
      is_anonymous === true ||
      is_anonymous === 1 ||
      is_anonymous === '1' ||
      is_anonymous === 'true';

    const result = await run(
      `INSERT INTO posts (user_id, type, title, description, reward, campus, is_anonymous)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        type,
        title,
        description || null,
        reward || 0,
        campus || null,
        anonymous ? 1 : 0,
      ]
    );

    return res.status(201).json(ok({ post_id: result.lastID }));
  } catch (err) {
    console.error('[posts/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/posts  列表（无需鉴权，支持复杂筛选/排序/黑名单过滤 + 点赞收藏聚合）
router.get('/', async (req, res) => {
  try {
    const { type, campus, status, user_id, min_reward, max_reward, sort, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const where = ['p.is_deleted = 0'];
    const params = [];

    // 状态筛选（默认 status=0 待接单；status=all 表示不筛选状态）
    if (status !== 'all') {
      where.push('p.status = ?');
      params.push(status !== undefined ? status : 0);
    }

    if (type) {
      where.push('p.type = ?');
      params.push(type);
    }
    if (category === 'social') {
      where.push("p.type IN ('闲聊', '捞人', '吐槽')");
    }
    if (campus) {
      where.push('p.campus = ?');
      params.push(campus);
    }
    if (user_id) {
      where.push('p.user_id = ?');
      params.push(Number(user_id));
    }
    if (min_reward !== undefined && min_reward !== '') {
      where.push('p.reward >= ?');
      params.push(Number(min_reward));
    }
    if (max_reward !== undefined && max_reward !== '') {
      where.push('p.reward <= ?');
      params.push(Number(max_reward));
    }

    // 当前登录用户（用于黑名单过滤与点赞/收藏状态）
    const currentUserId = getCurrentUserId(req);

    let joinClause = 'LEFT JOIN users u ON u.id = p.user_id';
    const queryParams = [];
    if (currentUserId) {
      joinClause += ' LEFT JOIN blacklists b ON b.user_id = ? AND b.blocked_user_id = p.user_id';
      queryParams.push(currentUserId);
      where.push('b.id IS NULL');
    }

    // 排序
    let orderBy = 'p.created_at DESC, p.id DESC';
    if (sort === 'time_asc') orderBy = 'p.created_at ASC, p.id ASC';
    else if (sort === 'reward_desc') orderBy = 'p.reward DESC, p.id DESC';
    else if (sort === 'reward_asc') orderBy = 'p.reward ASC, p.id ASC';
    else if (sort === 'rating_desc') orderBy = 'u.avg_rating DESC, p.id DESC';

    const countRow = await get(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM posts p
       ${joinClause}
       WHERE ${where.join(' AND ')}`,
      [...queryParams, ...params]
    );
    const total = countRow.total || 0;

    const rows = await all(
      `SELECT
         p.id, p.user_id, p.type, p.title, p.description, p.reward,
         p.campus, p.status, p.is_anonymous, p.created_at,
         u.nickname, u.avg_rating,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
         (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorites_count
       FROM posts p
       ${joinClause}
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...queryParams, ...params, pageSize, offset]
    );

    // 批量查询当前用户的点赞/收藏状态，避免 N+1
    let likedSet = new Set();
    let favoritedSet = new Set();
    if (currentUserId && rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const likedRows = await all(
        `SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (${placeholders})`,
        [currentUserId, ...ids]
      );
      likedSet = new Set(likedRows.map((r) => r.post_id));

      const favRows = await all(
        `SELECT post_id FROM favorites WHERE user_id = ? AND post_id IN (${placeholders})`,
        [currentUserId, ...ids]
      );
      favoritedSet = new Set(favRows.map((r) => r.post_id));
    }

    const data = rows.map((row) => {
      const anonymous = row.is_anonymous === 1;
      return {
        id: row.id,
        user_id: anonymous ? null : row.user_id,
        type: row.type,
        title: row.title,
        description: row.description,
        reward: row.reward,
        campus: row.campus,
        status: row.status,
        is_anonymous: row.is_anonymous,
        nickname: anonymous ? '匿名用户' : row.nickname,
        avg_rating: row.avg_rating,
        likes_count: row.likes_count,
        favorites_count: row.favorites_count,
        is_liked: currentUserId ? likedSet.has(row.id) : false,
        is_favorited: currentUserId ? favoritedSet.has(row.id) : false,
        created_at: row.created_at,
      };
    });

    return res.json(ok({ list: data, total }));
  } catch (err) {
    console.error('[posts/list]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/posts/:id  帖子详情（无需鉴权，含发布者信用信息与点赞收藏聚合，匿名则隐藏）
router.get('/:id', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const row = await get(
      `SELECT
         p.id, p.user_id, p.type, p.title, p.description, p.reward,
         p.campus, p.status, p.is_anonymous, p.is_deleted,
         p.created_at, p.updated_at,
         u.nickname, u.avatar_url, u.avg_rating, u.credit_score,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
         (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favorites_count
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [postId]
    );

    if (!row || row.is_deleted === 1) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    const currentUserId = getCurrentUserId(req);
    let is_liked = false;
    let is_favorited = false;
    if (currentUserId) {
      const liked = await get(
        'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
        [currentUserId, postId]
      );
      const favorited = await get(
        'SELECT id FROM favorites WHERE user_id = ? AND post_id = ?',
        [currentUserId, postId]
      );
      is_liked = !!liked;
      is_favorited = !!favorited;
    }

    const anonymous = row.is_anonymous === 1;
    return res.json(ok({
      id: row.id,
      user_id: anonymous ? null : row.user_id,
      type: row.type,
      title: row.title,
      description: row.description,
      reward: row.reward,
      campus: row.campus,
      status: row.status,
      is_anonymous: row.is_anonymous,
      nickname: anonymous ? '匿名用户' : row.nickname,
      avatar_url: anonymous ? null : row.avatar_url,
      avg_rating: anonymous ? null : row.avg_rating,
      credit_score: anonymous ? null : row.credit_score,
      likes_count: row.likes_count,
      favorites_count: row.favorites_count,
      is_liked,
      is_favorited,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    console.error('[posts/detail]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/posts/:id/like  切换点赞（返回最新点赞状态和数量）
router.post('/:id/like', auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const post = await get('SELECT id FROM posts WHERE id = ? AND is_deleted = 0', [postId]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    const existing = await get(
      'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
      [req.user.user_id, postId]
    );

    let is_liked;
    if (existing) {
      await run('DELETE FROM likes WHERE id = ?', [existing.id]);
      is_liked = false;
    } else {
      await run(
        'INSERT INTO likes (user_id, post_id) VALUES (?, ?)',
        [req.user.user_id, postId]
      );
      is_liked = true;
    }

    const countRow = await get(
      'SELECT COUNT(*) AS likes_count FROM likes WHERE post_id = ?',
      [postId]
    );

    return res.json(ok({ is_liked, likes_count: countRow.likes_count }));
  } catch (err) {
    console.error('[posts/like]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/posts/:id/favorite  切换收藏（返回最新收藏状态和数量）
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const post = await get('SELECT id FROM posts WHERE id = ? AND is_deleted = 0', [postId]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    const existing = await get(
      'SELECT id FROM favorites WHERE user_id = ? AND post_id = ?',
      [req.user.user_id, postId]
    );

    let is_favorited;
    if (existing) {
      await run('DELETE FROM favorites WHERE id = ?', [existing.id]);
      is_favorited = false;
    } else {
      await run(
        'INSERT INTO favorites (user_id, post_id) VALUES (?, ?)',
        [req.user.user_id, postId]
      );
      is_favorited = true;
    }

    const countRow = await get(
      'SELECT COUNT(*) AS favorites_count FROM favorites WHERE post_id = ?',
      [postId]
    );

    return res.json(ok({ is_favorited, favorites_count: countRow.favorites_count }));
  } catch (err) {
    console.error('[posts/favorite]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/posts/:id/history  记录浏览历史（存在则更新 viewed_at）
router.post('/:id/history', auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const post = await get('SELECT id FROM posts WHERE id = ? AND is_deleted = 0', [postId]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    await run(
      `INSERT INTO history (user_id, post_id, viewed_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, post_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
      [req.user.user_id, postId]
    );

    return res.json(ok({ post_id: postId, recorded: true }));
  } catch (err) {
    console.error('[posts/history]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/posts/:id/comments  发布评论（需鉴权，支持 parent_id 二级回复）
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const { content, parent_id } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json(fail(400, '评论内容不能为空'));
    }

    const post = await get('SELECT id FROM posts WHERE id = ? AND is_deleted = 0', [postId]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    let parentId = null;
    if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
      parentId = Number(parent_id);
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return res.status(400).json(fail(400, '无效的 parent_id'));
      }
      const parent = await get(
        'SELECT id FROM comments WHERE id = ? AND post_id = ?',
        [parentId, postId]
      );
      if (!parent) {
        return res.status(404).json(fail(404, '被回复的评论不存在'));
      }
    }

    const result = await run(
      'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [postId, req.user.user_id, String(content).trim(), parentId]
    );

    return res.status(201).json(ok({ comment_id: result.lastID }));
  } catch (err) {
    console.error('[comments/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/posts/:id/comments  获取评论列表（含二级回复与点赞数）
router.get('/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const rows = await all(
      `SELECT
         c.id, c.post_id, c.user_id, c.content, c.parent_id, c.created_at,
         c.likes_count,
         u.nickname
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC, c.id ASC`,
      [postId]
    );

    const items = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      content: row.content,
      parent_id: row.parent_id,
      nickname: row.nickname,
      likes_count: row.likes_count,
      created_at: row.created_at,
      replies: [],
    }));

    const byId = new Map(items.map((item) => [item.id, item]));
    const topLevel = [];
    for (const item of items) {
      if (item.parent_id != null && byId.has(item.parent_id)) {
        byId.get(item.parent_id).replies.push(item);
      } else {
        topLevel.push(item);
      }
    }

    return res.json(ok(topLevel));
  } catch (err) {
    console.error('[comments/list]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
