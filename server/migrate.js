import { run, all, close } from './db.js';

// 默认违禁词（后续可在后台管理中增删）
const DEFAULT_SENSITIVE_WORDS = [
  '色情', '赌博', '毒品', '诈骗', '暴力',
  '代写', '枪手', '作弊', '代考', '替考',
];

// 所有数据表的建表 SQL（PRD 要求：所有表都含 created_at / updated_at）
const TABLES = [
  // 1. users 用户表
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50),
    avatar_url VARCHAR(255),
    role INTEGER NOT NULL DEFAULT 0,
    credit_score INTEGER NOT NULL DEFAULT 100,
    avg_rating NUMERIC NOT NULL DEFAULT 0,
    is_anonymous_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. posts 需求帖子表
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    reward NUMERIC NOT NULL DEFAULT 0,
    campus VARCHAR(50),
    status INTEGER NOT NULL DEFAULT 0,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // 3. orders 订单表
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    taker_id INTEGER NOT NULL,
    status INTEGER NOT NULL DEFAULT 0,
    proof_images TEXT,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (publisher_id) REFERENCES users(id),
    FOREIGN KEY (taker_id) REFERENCES users(id)
  )`,

  // 4. reviews 评价表
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT,
    status INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  )`,

  // 5. disputes 仲裁申诉表
  `CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    initiator_id INTEGER NOT NULL,
    reason TEXT,
    evidence TEXT,
    status INTEGER NOT NULL DEFAULT 0,
    admin_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (initiator_id) REFERENCES users(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
  )`,

  // 6. sensitive_words 违禁词表
  `CREATE TABLE IF NOT EXISTS sensitive_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word VARCHAR(50) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

async function migrate() {
  console.log('开始创建数据表...');
  for (const sql of TABLES) {
    await run(sql);
  }
  console.log('数据表创建完成。\n');

  console.log('初始化违禁词...');
  let inserted = 0;
  for (const word of DEFAULT_SENSITIVE_WORDS) {
    const result = await run(
      'INSERT OR IGNORE INTO sensitive_words (word) VALUES (?)',
      [word]
    );
    inserted += result.changes;
  }
  console.log(`违禁词初始化完成，新增 ${inserted} 条。\n`);

  const tables = await all(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  console.log(`✅ 当前数据库共有 ${tables.length} 张表:`);
  for (const t of tables) {
    console.log(`   - ${t.name}`);
  }
}

migrate()
  .then(() => close())
  .catch((err) => {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  });
