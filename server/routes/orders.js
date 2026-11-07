import express from 'express';
import auth from '../middlewares/auth.js';
import { run, get, all, transaction } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

/**
 * 解析并校验 :id 路由参数
 */
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

// POST /api/orders  接单
router.post('/', auth, async (req, res) => {
  try {
    const { post_id } = req.body || {};

    if (!post_id) {
      return res.status(400).json(fail(400, 'post_id 不能为空'));
    }

    const post = await get('SELECT * FROM posts WHERE id = ?', [post_id]);
    if (!post) {
      return res.status(404).json(fail(404, '帖子不存在'));
    }
    if (post.is_deleted === 1) {
      return res.status(400).json(fail(400, '帖子已删除，无法接单'));
    }
    if (['闲聊', '捞人', '吐槽'].includes(post.type)) {
      return res.status(400).json(fail(400, '该分类帖子不支持接单'));
    }
    if (post.status !== 0) {
      return res.status(400).json(fail(400, '帖子不是待接单状态，无法接单'));
    }
    if (post.user_id === req.user.user_id) {
      return res.status(400).json(fail(400, '不能接自己发布的帖子'));
    }

    const orderId = await transaction(async () => {
      const result = await run(
        'INSERT INTO orders (post_id, publisher_id, taker_id, status) VALUES (?, ?, ?, 0)',
        [post.id, post.user_id, req.user.user_id]
      );
      await run(
        'UPDATE posts SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [post.id]
      );
      return result.lastID;
    });

    return res.status(201).json(ok({ order_id: orderId }));
  } catch (err) {
    console.error('[orders/create]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/orders/:id/proof  接单人上传完成凭证
router.post('/:id/proof', auth, async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) {
      return res.status(400).json(fail(400, '无效的订单 ID'));
    }

    const { proof_images } = req.body || {};
    if (!Array.isArray(proof_images) || proof_images.length === 0) {
      return res.status(400).json(fail(400, 'proof_images 必须是非空数组'));
    }

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json(fail(404, '订单不存在'));
    }
    if (order.taker_id !== req.user.user_id) {
      return res.status(403).json(fail(403, '只有接单人才能上传凭证'));
    }
    if (order.status !== 0) {
      return res.status(400).json(fail(400, '订单当前状态不允许上传凭证'));
    }

    await run(
      'UPDATE orders SET proof_images = ?, status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(proof_images), orderId]
    );

    return res.json(ok({ order_id: orderId }));
  } catch (err) {
    console.error('[orders/proof]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/orders/:id/confirm  雇主确认完成
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) {
      return res.status(400).json(fail(400, '无效的订单 ID'));
    }

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json(fail(404, '订单不存在'));
    }
    if (order.publisher_id !== req.user.user_id) {
      return res.status(403).json(fail(403, '只有雇主才能确认完成'));
    }
    if (order.status !== 1) {
      return res.status(400).json(fail(400, '订单当前状态不允许确认完成'));
    }

    await transaction(async () => {
      await run(
        "UPDATE orders SET status = 2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [orderId]
      );
      await run(
        'UPDATE posts SET status = 2, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [order.post_id]
      );
    });

    return res.json(ok({ order_id: orderId }));
  } catch (err) {
    console.error('[orders/confirm]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// 安全解析凭证图片 JSON 字符串为数组
function parseProofImages(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// GET /api/orders/published  我发布的帖子所生成的订单（JOIN 接单人用户，返回凭证/状态）
router.get('/published', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT
         o.id, o.post_id, o.publisher_id, o.taker_id, o.status,
         o.proof_images, o.completed_at, o.created_at, o.updated_at,
         p.title AS post_title,
         t.nickname AS taker_nickname,
         t.credit_score AS taker_credit_score
       FROM orders o
       LEFT JOIN posts p ON p.id = o.post_id
       LEFT JOIN users t ON t.id = o.taker_id
       WHERE o.publisher_id = ?
       ORDER BY o.created_at DESC, o.id DESC`,
      [req.user.user_id]
    );

    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      post_title: row.post_title,
      publisher_id: row.publisher_id,
      taker_id: row.taker_id,
      status: row.status,
      proof_images: parseProofImages(row.proof_images),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      taker_nickname: row.taker_nickname,
      taker_credit_score: row.taker_credit_score,
    }));

    return res.json(ok(data));
  } catch (err) {
    console.error('[orders/published]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// GET /api/orders/taken  我接下的订单（JOIN 发帖人用户和帖子表）
router.get('/taken', auth, async (req, res) => {
  try {
    const rows = await all(
      `SELECT
         o.id, o.post_id, o.publisher_id, o.taker_id, o.status,
         o.proof_images, o.completed_at, o.created_at, o.updated_at,
         p.title AS post_title,
         u.nickname AS publisher_nickname
       FROM orders o
       LEFT JOIN posts p ON p.id = o.post_id
       LEFT JOIN users u ON u.id = o.publisher_id
       WHERE o.taker_id = ?
       ORDER BY o.created_at DESC, o.id DESC`,
      [req.user.user_id]
    );

    const data = rows.map((row) => ({
      id: row.id,
      post_id: row.post_id,
      post_title: row.post_title,
      publisher_id: row.publisher_id,
      taker_id: row.taker_id,
      status: row.status,
      proof_images: parseProofImages(row.proof_images),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      publisher_nickname: row.publisher_nickname,
    }));

    return res.json(ok(data));
  } catch (err) {
    console.error('[orders/taken]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
