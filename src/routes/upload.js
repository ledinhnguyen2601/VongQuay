/**
 * Lucky Wheel SaaS - Upload Routes (Multer RAM + Sharp Magic Bytes + ImgBB Server Upload)
 * Chỉ admin của đúng vòng quay mới có quyền tải ảnh lên.
 */

const express = require('express');
const multer = require('multer');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadToImgBB } = require('../services/imgbb');

const router = express.Router();

// Cấu hình Multer lưu file trực tiếp vào bộ nhớ RAM, giới hạn 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 Megabytes
  }
});

/**
 * POST /api/admin/wheels/:wheelId/upload - Tải ảnh logo hoặc ảnh nền cho vòng quay
 * Bắt buộc có token Admin và khớp wheelId
 */
router.post(
  '/wheels/:wheelId/upload',
  uploadLimiter,
  authenticateAdmin,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn một tệp hình ảnh để tải lên.'
        });
      }

      // Đẩy lên ImgBB thông qua dịch vụ kiểm tra magic bytes phía Server
      const imgUrl = await uploadToImgBB(req.file.buffer, req.file.originalname);

      return res.json({
        success: true,
        message: 'Tải ảnh lên thành công!',
        url: imgUrl
      });
    } catch (error) {
      console.error('❌ [ROUTE UPLOAD ERROR]:', error.message);
      return res.status(400).json({
        success: false,
        message: error.message || 'Không thể tải ảnh lên.'
      });
    }
  }
);

// Xử lý lỗi từ Multer (ví dụ vượt quá 5MB)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Dung lượng file vượt quá giới hạn tối đa 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Lỗi tải tệp: ${err.message}`
    });
  }
  next(err);
});

module.exports = router;
