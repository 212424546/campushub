import jwt from 'jsonwebtoken';
import { fail } from '../utils/response.js';

/**
 * JWT 鉴权中间件
 * 解析 Header 中的 Authorization: Bearer <token>，
 * 验证通过后将用户信息挂载到 req.user，失败则返回 401。
 */
export default function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(fail(401, '未登录或 Token 缺失'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { user_id: payload.user_id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json(fail(401, 'Token 无效或已过期'));
  }
}
