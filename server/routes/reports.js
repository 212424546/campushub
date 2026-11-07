import express from 'express';
import auth from '../middlewares/auth.js';
import { run, get } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

// POST /api/reports  举报帖子或评论
router.post('/', auth, async (req, res) => {
  try {
    const { target_type, target_id, reason } = req.body || {};

    if (!target_type || !['post', 'comment'].includes(target_type)) {
      return res.status(400).json(fail(400, 'target_type 必须为 post 或 comment'));
    }

    const targetId = Number(target_id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json(fail(400, '无效的 target_id'));
    }

    if (target_type === 'post') {
      const target = await get('SELECT id FROM posts WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json(fail(404, '被举报的帖子不存在'));
      }
    } else {
      const target = await get('SELECT id FROM comments WHERE id = ?', [targetId]);
      if (!target) {
        return res.status(404).json(fail(404, '被举报的评论不存在'));
      }
    }

    const result = await run(
      'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)',
      [req.user.user_id, target_type, targetId, reason || null]
    );

    return res.status(201).json(ok({ report_id: result.lastID }));
  } catch (err) {
    console.error('[reports/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
