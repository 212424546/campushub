import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库文件路径（默认存放在项目根目录 campus.db，可通过 DB_PATH 覆盖）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'campus.db');

// 建立 SQLite 连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ SQLite 连接失败:', err.message);
    process.exit(1);
  }
  console.log(`✅ SQLite 已连接: ${DB_PATH}`);
});

// 开启外键约束
db.run('PRAGMA foreign_keys = ON;');

/**
 * 执行写操作（INSERT / UPDATE / DELETE / CREATE ...）
 * 返回 Statement 对象，可通过 lastID、changes 获取结果。
 */
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/** 查询单行记录 */
export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/** 查询多行记录 */
export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/** 关闭数据库连接 */
export function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 在事务中执行一组操作（BEGIN ... COMMIT，出错则 ROLLBACK）
 * @param {() => Promise<any>} fn 事务体
 */
export async function transaction(fn) {
  await run('BEGIN');
  try {
    const result = await fn();
    await run('COMMIT');
    return result;
  } catch (err) {
    try {
      await run('ROLLBACK');
    } catch (rollbackErr) {
      console.error('事务回滚失败:', rollbackErr);
    }
    throw err;
  }
}

export default db;
