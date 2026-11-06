import { all } from '../db.js';

/**
 * 从 sensitive_words 表读取所有违禁词
 * @returns {Promise<string[]>}
 */
export async function getSensitiveWords() {
  const rows = await all('SELECT word FROM sensitive_words');
  return rows.map((r) => r.word);
}

/**
 * 检查文本是否包含违禁词
 * @param {string} text
 * @returns {Promise<{ hit: boolean, word: string | null }>}
 */
export async function checkSensitive(text) {
  if (!text || typeof text !== 'string') {
    return { hit: false, word: null };
  }

  const words = await getSensitiveWords();
  for (const word of words) {
    if (text.includes(word)) {
      return { hit: true, word };
    }
  }
  return { hit: false, word: null };
}
