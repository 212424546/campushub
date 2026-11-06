import { fail } from '../utils/response.js';

/**
 * 管理员权限中间件：必须在 auth 之后使用
 * 校验 req.user.role === 1，否则返回 403
 */
export default function admin(req, res, next) {
  if (req.user && req.user.role === 1) {
    return next();
  }
  return res.status(403).json(fail(403, '无权限访问，仅限管理员'));
}
