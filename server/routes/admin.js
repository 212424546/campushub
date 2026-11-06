import express from 'express';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js';
import { run, get, all, transaction } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

// 所有后台接口统一要求：登录 + 管理员权限
router.use(auth, admin);

// PATCH /api/admin/posts/:id/takedown  违规删帖
router.patch('/posts/:id/takedown', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(400).json(fail(400, '无效的帖子 ID'));
    }

    const post = await get('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }

    await transaction(async () => {
      await run(
        'UPDATE posts SET status = -1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [postId]
      );
      await run(
        'UPDATE users SET credit_score = credit_score - 10, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [post.user_id]
      );
    });

    return res.json(ok({ post_id: postId }));
  } catch (err) {
    console.error('[admin/takedown]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/admin/disputes  查看申诉列表
router.get('/disputes', async (req, res) => {
  try {
    const rows = await all(
      `SELECT
         d.id, d.review_id, d.order_id, d.initiator_id, d.reason, d.evidence,
         d.status AS dispute_status, d.created_at,
         r.rating, r.content AS review_content, r.status AS review_status,
         r.from_user_id, r.to_user_id,
         initiator.nickname AS initiator_nickname,
         reviewer.nickname AS reviewer_nickname
       FROM disputes d
       LEFT JOIN reviews r ON r.id = d.review_id
       LEFT JOIN users initiator ON initiator.id = d.initiator_id
       LEFT JOIN users reviewer ON reviewer.id = r.from_user_id
       ORDER BY d.id DESC`
    );

    return res.json(ok(rows));
  } catch (err) {
    console.error('[admin/disputes/list]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/admin/disputes/:id/resolve  处理申诉
router.post('/disputes/:id/resolve', async (req, res) => {
  try {
    const disputeId = Number(req.params.id);
    if (!Number.isInteger(disputeId) || disputeId <= 0) {
      return res.status(400).json(fail(400, '无效的申诉 ID'));
    }

    const result = Number(req.body?.result);
    if (result !== 1 && result !== 2) {
      return res.status(400).json(fail(400, 'result 必须为 1（隐藏评价）或 2（驳回申诉）'));
    }

    const dispute = await get('SELECT * FROM disputes WHERE id = ?', [disputeId]);
    if (!dispute) {
      return res.status(404).json(fail(404, '申诉记录不存在'));
    }
    if (dispute.status !== 0) {
      return res.status(400).json(fail(400, '该申诉已处理，不能重复处理'));
    }

    await transaction(async () => {
      await run(
        'UPDATE disputes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [result, disputeId]
      );

      if (result === 1) {
        // 申诉成功：隐藏评价，并重新计算被评价人的 avg_rating（剔除被隐藏的评价）
        const review = await get('SELECT to_user_id FROM reviews WHERE id = ?', [dispute.review_id]);
        await run(
          'UPDATE reviews SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [dispute.review_id]
        );

        const avgRow = await get(
          'SELECT AVG(rating) AS avg_rating FROM reviews WHERE to_user_id = ? AND status = 0',
          [review.to_user_id]
        );
        const avg = Math.round((avgRow.avg_rating || 0) * 10) / 10;
        await run(
          'UPDATE users SET avg_rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [avg, review.to_user_id]
        );
      } else {
        // 申诉驳回：恢复评价为正常
        await run(
          'UPDATE reviews SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [dispute.review_id]
        );
      }
    });

    return res.json(ok({ dispute_id: disputeId }));
  } catch (err) {
    console.error('[admin/disputes/resolve]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
