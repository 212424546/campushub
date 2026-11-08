// 社交类帖子：不涉及报酬与接单
export const SOCIAL_TYPES = ['闲聊', '捞人', '吐槽']

export function isSocialType(type) {
  return SOCIAL_TYPES.includes(type)
}

export function truncateText(text, max = 10) {
  if (!text) return ''
  const str = String(text)
  return str.length > max ? str.slice(0, max) + '...' : str
}

// 后端返回的是相对路径（如 /uploads/xxx.jpg），前端需拼上后端地址才能正确加载
export function getImageUrl(path) {
  if (!path) return path
  const str = String(path)
  if (/^https?:\/\//i.test(str) || str.startsWith('data:')) return str
  if (str.startsWith('/')) return (import.meta.env.VITE_API_BASE_URL || '') + str
  return str
}
