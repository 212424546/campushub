// 全局统一响应格式（PRD 约束：{ code, msg, data }）

/** 成功响应，code 恒为 0 */
export function ok(data = null) {
  return { code: 0, msg: 'ok', data };
}

/** 失败响应，code 使用业务/HTTP 状态码 */
export function fail(code = 500, msg = 'error', data = null) {
  return { code, msg, data };
}
