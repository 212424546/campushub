import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import auth from '../middlewares/auth.js';
import { ok, fail } from '../utils/response.js';

// 图片保存目录（相对服务启动目录，即项目根目录）
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    // 时间戳 + 随机数，防止文件名重复
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('只允许上传图片文件'));
  },
});

const router = express.Router();

// POST /api/upload  上传图片（需鉴权），表单字段名 file，返回图片 URL
router.post('/upload', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json(fail(400, err.message || '上传失败'));
    }
    if (!req.file) {
      return res.status(400).json(fail(400, '请上传图片文件（字段名 file）'));
    }
    return res.json(ok({ url: '/uploads/' + req.file.filename }));
  });
});

export default router;
