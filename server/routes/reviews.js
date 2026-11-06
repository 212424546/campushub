import express from 'express';
import auth from '../middlewares/auth.js';
import { run, get, transaction } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

// 评分对应的信用分增减规则（PRD）
const CREDIT_DELTA = { 1: -10, 2: -5, 3: 0, 4: 2, 5: 5 };

// POST /api/reviews  提交评价
router.post('/', auth, async (req, res) => {
  try {
    const { order_id, content } = req.body || {};
    const rating = Number(req.body?.rating);

    if (!order_id) {
      return res.status(400).json(fail(400, 'order_id 不能为空'));
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json(fail(400, 'rating 必须是 1-5 的整数'));
    }

    const order = await get('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) {
      return res.status(404).json(fail(404, '订单不存在'));
    }
    if (order.status !== 2) {
      return res.status(400).json(fail(400, '订单尚未完成，无法评价'));
    }

    // 评价人必须是该订单的雇主或接单人，并据此确定被评价人
    let toUserId;
    if (req.user.user_id === order.publisher_id) {
      toUserId = order.taker_id;
    } else if (req.user.user_id === order.taker_id) {
      toUserId = order.publisher_id;
    } else {
      return res.status(403).json(fail(403, '只有该订单的雇主或接单人才能评价'));
    }

    // 防止重复评价：同一订单只能评价一次
    const existing = await get('SELECT id FROM reviews WHERE order_id = ?', [order_id]);
    if (existing) {
      return res.status(409).json(fail(409, '该订单已评价，不能重复评价'));
    }

    const reviewId = await transaction(async () => {
      const result = await run(
        'INSERT INTO reviews (order_id, from_user_id, to_user_id, rating, content, status) VALUES (?, ?, ?, ?, ?, 0)',
        [order_id, req.user.user_id, toUserId, rating, content || null]
      );

      // 1. 重新计算被评价人的平均星级（只统计正常展示的评价，保留一位小数）
      const avgRow = await get(
        'SELECT AVG(rating) AS avg_rating FROM reviews WHERE to_user_id = ? AND status = 0',
        [toUserId]
      );
      const avg = Math.round((avgRow.avg_rating || 0) * 10) / 10;

      // 2. 根据评分更新被评价人的信用分
      const delta = CREDIT_DELTA[rating] || 0;

      await run(
        'UPDATE users SET avg_rating = ?, credit_score = credit_score + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [avg, delta, toUserId]
      );

      return result.lastID;
    });

    return res.status(201).json(ok({ review_id: reviewId }));
  } catch (err) {
    console.error('[reviews/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
