import express from 'express';
import auth from '../middlewares/auth.js';
import { run, all } from '../db.js';
import { ok, fail } from '../utils/response.js';
import { checkSensitive } from '../utils/sensitive.js';

const router = express.Router();

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
        is_anonymous ? 1 : 0,
      ]
    );

    return res.status(201).json(ok({ post_id: result.lastID }));
  } catch (err) {
    console.error('[posts/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/posts  列表（无需鉴权，支持 type/campus/status 筛选）
router.get('/', async (req, res) => {
  try {
    const { type, campus, status } = req.query;

    const where = ['p.is_deleted = 0'];
    const params = [];

    // 默认只查待接单(status=0)，可通过 query 覆盖
    where.push('p.status = ?');
    params.push(status !== undefined ? status : 0);

    if (type) {
      where.push('p.type = ?');
      params.push(type);
    }
    if (campus) {
      where.push('p.campus = ?');
      params.push(campus);
    }

    const rows = await all(
      `SELECT
         p.id, p.user_id, p.type, p.title, p.description, p.reward,
         p.campus, p.status, p.is_anonymous, p.created_at,
         u.nickname, u.avg_rating
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.created_at DESC, p.id DESC`,
      params
    );

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
        created_at: row.created_at,
      };
    });

    return res.json(ok(data));
  } catch (err) {
    console.error('[posts/list]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
