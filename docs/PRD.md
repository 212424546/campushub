# CampusHub 校园互助平台 - 开发级需求说明书 (PRD)

## 一、 核心开发约束
1. **全局统一响应格式**：`{ code: 0, msg: "ok", data: null }`
2. **所有删除操作**：一律使用软删除（设置 `is_deleted = 1`），不物理删除数据。
3. **时间戳**：所有表必须包含 `created_at` 和 `updated_at`。
4. **违禁词过滤**：在发帖、评论、私信等所有涉及 UGC 文本的操作前，必须经过敏感词过滤器。

## 二、 数据库表结构设计 (Data Schema)

### 1. `users` (用户表)
- `id` (PK, 自增)
- `student_id` (VARCHAR, 唯一, 学号)
- `password` (VARCHAR, 密码Hash)
- `nickname` (VARCHAR, 昵称)
- `avatar_url` (VARCHAR, 头像)
- `role` (INT, 0=普通用户, 1=管理员)
- `credit_score` (INT, 默认 100, 信用分)
- `avg_rating` (DECIMAL, 平均评价星级, 比如 4.8)
- `is_anonymous_default` (BOOLEAN, 是否默认匿名发帖)

### 2. `posts` (需求帖子表)
- `id` (PK)
- `user_id` (FK, 发布者)
- `type` (VARCHAR, 分类: '跑腿', '二手', '失物招领', '学习')
- `title` (VARCHAR)
- `description` (TEXT)
- `reward` (DECIMAL, 报酬)
- `campus` (VARCHAR, 校区)
- `status` (INT, 0=待接单, 1=进行中, 2=已完成, 3=已取消, -1=违规下架)
- `is_anonymous` (BOOLEAN, 是否匿名发布)
- `is_deleted` (INT, 软删除标记)

### 3. `orders` (订单表 - 帖子被接单后生成)
- `id` (PK)
- `post_id` (FK)
- `publisher_id` (FK, 雇主)
- `taker_id` (FK, 接单人)
- `status` (INT, 0=进行中, 1=待确认, 2=已确认完成, 3=仲裁中)
- `proof_images` (JSON, 接单人上传的完成凭证图片)
- `completed_at` (DATETIME, 完成时间)

### 4. `reviews` (评价表)
- `id` (PK)
- `order_id` (FK)
- `from_user_id` (FK, 评价人)
- `to_user_id` (FK, 被评价人)
- `rating` (INT, 1-5星)
- `content` (TEXT, 评价内容)
- `status` (INT, 0=正常, 1=被申诉中, 2=已隐藏)

### 5. `disputes` (仲裁申诉表)
- `id` (PK)
- `review_id` (FK, 针对哪条评价)
- `order_id` (FK)
- `initiator_id` (FK, 发起人)
- `reason` (TEXT, 申诉理由)
- `evidence` (JSON, 证据截图)
- `status` (INT, 0=待处理, 1=申诉成功(隐藏评价), 2=申诉驳回)
- `admin_id` (FK, 处理的管理员)

### 6. `sensitive_words` (违禁词表)
- `id` (PK)
- `word` (VARCHAR, 违禁词)

## 三、 核心状态机流转 (State Machines)

1. **订单状态 (`orders.status`)**：
   `0 进行中` -> (接单人提交凭证) -> `1 待确认` -> (雇主确认) -> `2 已确认完成`
   `1 待确认` -> (雇主发起仲裁) -> `3 仲裁中`
2. **评价状态 (`reviews.status`)**：
   正常展示(`0`) -> (被评价人觉得恶意，发起申诉) -> 申诉中(`1`) -> (管理员判定) -> 维持正常(`0`) 或 隐藏评价(`2`)。

## 四、 核心 API 接口定义

### 1. 用户与权限模块
- `POST /api/auth/register` (学号+密码注册)
- `POST /api/auth/login` (登录，返回 JWT Token)
- `GET /api/users/:id/profile` (获取个人主页，包含信用分和 avg_rating)

### 2. 帖子模块 (含违禁词和后台删帖)
- `POST /api/posts` (发帖：需校验 `title` 和 `description` 是否含违禁词，有则返回 `code: 1001, msg: "包含违规内容"`)
- `GET /api/posts` (列表：支持 type, campus, status 筛选，返回发布者的 avg_rating)
- `PATCH /api/admin/posts/:id/takedown` (仅管理员：违规删帖，将 status 设为 -1，并扣除发布者信用分 10 分)

### 3. 订单与互助模块
- `POST /api/orders` (接单：将 post 状态改为进行中)
- `POST /api/orders/:id/proof` (接单人上传凭证，状态变更为 1 待确认)
- `POST /api/orders/:id/confirm` (雇主确认完成：状态变为 2 已确认完成)

### 4. 评价与申诉模块
- `POST /api/reviews` (提交评价：更新被评价人的 avg_rating，增加/减少信用分)
- `POST /api/disputes` (发起申诉：针对某条 review，需传理由和截图，将 review.status 改为 1)
- `GET /api/admin/disputes` (仅管理员：查看申诉列表)
- `POST /api/admin/disputes/:id/resolve` (仅管理员：处理申诉，传入结果：驳回或隐藏评价)

## 五、 AI 开发顺序指导
请严格按照以下顺序生成代码，**每次只写一个模块，写完自测通过后，等待我的指令再写下一个模块**：
1. 初始化 Express 项目 + SQLite 连接 + 封装统一返回格式。
2. 建表脚本 (Migrations) + 违禁词初始化。
3. 用户注册、登录、JWT 鉴权中间件。
4. 发帖、查看帖子列表接口 (含违禁词过滤和 avg_rating 关联查询)。
5. 接单、上传凭证、确认完成 (订单状态机)。
6. 评价接口、发起申诉接口。
7. 管理员权限中间件、删帖接口、仲裁处理接口。