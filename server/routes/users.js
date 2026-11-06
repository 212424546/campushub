import express from 'express';
import { get } from '../db.js';
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

export default router;
