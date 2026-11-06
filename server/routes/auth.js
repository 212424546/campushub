import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get } from '../db.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// POST /api/auth/register  注册：学号 + 密码，密码 bcrypt 哈希后入库
router.post('/register', async (req, res) => {
  try {
    const { student_id, password } = req.body || {};

    if (!student_id || !password) {
      return res.status(400).json(fail(400, '学号和密码不能为空'));
    }
    if (String(password).length < 6) {
      return res.status(400).json(fail(400, '密码长度不能少于 6 位'));
    }

    const exists = await get('SELECT id FROM users WHERE student_id = ?', [student_id]);
    if (exists) {
      return res.status(409).json(fail(409, '该学号已注册'));
    }

    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    const result = await run(
      'INSERT INTO users (student_id, password) VALUES (?, ?)',
      [student_id, hash]
    );

    return res.status(201).json(ok({ user_id: result.lastID, student_id }));
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

// POST /api/auth/login  登录：校验密码，成功签发 JWT（包含 user_id 和 role）
router.post('/login', async (req, res) => {
  try {
    const { student_id, password } = req.body || {};

    if (!student_id || !password) {
      return res.status(400).json(fail(400, '学号和密码不能为空'));
    }

    const user = await get('SELECT * FROM users WHERE student_id = ?', [student_id]);
    if (!user) {
      return res.status(401).json(fail(401, '学号或密码错误'));
    }

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json(fail(401, '学号或密码错误'));
    }

    const token = jwt.sign(
      { user_id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json(
      ok({
        token,
        user: {
          user_id: user.id,
          student_id: user.student_id,
          nickname: user.nickname,
          role: user.role,
        },
      })
    );
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json(fail(500, '服务器内部错误'));
  }
});

export default router;
