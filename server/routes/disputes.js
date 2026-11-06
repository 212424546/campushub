import express from 'express';
import auth from '../middlewares/auth.js';
import { run, get, transaction } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

// POST /api/disputes  发起申诉
router.post('/', auth, async (req, res) => {
  try {
    const { review_id, reason, evidence } = req.body || {};

    if (!review_id) {
      return res.status(400).json(fail(400, 'review_id 不能为空'));
    }

    const review = await get('SELECT * FROM reviews WHERE id = ?', [review_id]);
    if (!review) {
      return res.status(404).json(fail(404, '评价不存在'));
    }

    // 必须是被评价人才能发起申诉
    if (req.user.user_id !== review.to_user_id) {
      return res.status(403).json(fail(403, '只有被评价人才能发起申诉'));
    }

    // 评价状态必须为 0（正常）
    if (review.status !== 0) {
      return res.status(400).json(fail(400, '该评价当前状态不允许申诉'));
    }

    // 同一评价不能重复申诉
    const existing = await get('SELECT id FROM disputes WHERE review_id = ?', [review_id]);
    if (existing) {
      return res.status(409).json(fail(409, '该评价已发起申诉，不能重复申诉'));
    }

    const disputeId = await transaction(async () => {
      const result = await run(
        'INSERT INTO disputes (review_id, order_id, initiator_id, reason, evidence, status) VALUES (?, ?, ?, ?, ?, 0)',
        [
          review.id,
          review.order_id,
          req.user.user_id,
          reason || null,
          evidence ? JSON.stringify(evidence) : null,
        ]
      );
      await run(
        'UPDATE reviews SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [review.id]
      );
      return result.lastID;
    });

    return res.status(201).json(ok({ dispute_id: disputeId }));
  } catch (err) {
    console.error('[disputes/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
