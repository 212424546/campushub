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
