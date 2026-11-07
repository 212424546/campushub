import express from 'express';
import auth from '../middlewares/auth.js';
import { run, get } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

// POST /api/comments/:id/like  切换评论点赞（返回最新点赞状态和数量）
router.post('/:id/like', auth, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json(fail(400, '无效的评论 ID'));
    }

    const comment = await get('SELECT id FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json(fail(404, '评论不存在'));
    }

    const existing = await get(
      'SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?',
      [req.user.user_id, commentId]
    );

    let is_liked;
    if (existing) {
      await run('DELETE FROM comment_likes WHERE id = ?', [existing.id]);
      is_liked = false;
    } else {
      await run(
        'INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)',
        [req.user.user_id, commentId]
      );
      is_liked = true;
    }

    const countRow = await get(
      'SELECT COUNT(*) AS likes_count FROM comment_likes WHERE comment_id = ?',
      [commentId]
    );
    await run(
      'UPDATE comments SET likes_count = ? WHERE id = ?',
      [countRow.likes_count, commentId]
    );

    return res.json(ok({ is_liked, likes_count: countRow.likes_count }));
  } catch (err) {
    console.error('[comments/like]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
