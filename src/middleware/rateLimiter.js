/**
 * Lucky Wheel SaaS - Rate Limiting Middleware
 * Ngăn chặn tấn công Brute-force, DoS và lạm dụng tài nguyên máy chủ.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

// Nới lỏng giới hạn tần suất trong môi trường kiểm thử (test) để không gây nghẽn test
const isTestEnv = process.env.NODE_ENV === 'test' || config.nodeEnv === 'test';

/**
 * Giới hạn đăng nhập Admin: tối đa 5 lần thử trong 15 phút trên mỗi IP
 * Giúp ngăn chặn brute-force mật khẩu của các cửa hàng.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: isTestEnv ? 10000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Kết hợp IP và wheelId để giới hạn chính xác
    const wheelId = req.params.wheelId || req.body.wheelId || '';
    return `${req.ip}_${wheelId}`;
  },
  message: {
    success: false,
    message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút để bảo vệ an toàn!'
  }
});

/**
 * Giới hạn số lượt quay may mắn: tối đa 30 lần / 1 phút / IP
 * Đảm bảo hệ thống không bị spam lượt quay tự động.
 */
const spinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: isTestEnv ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đang quay quá nhanh! Vui lòng chờ một chút trước khi quay tiếp.'
  }
});

/**
 * Giới hạn tạo vòng quay mới: tối đa 10 vòng quay / 1 giờ / IP
 * Chống spam khởi tạo tài nguyên rác.
 */
const createWheelLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: isTestEnv ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã tạo quá nhiều vòng quay trong giờ này. Vui lòng thử lại sau.'
  }
});

/**
 * Giới hạn tải ảnh lên ImgBB: tối đa 20 file / 15 phút / IP
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: isTestEnv ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã tải ảnh quá thường xuyên. Vui lòng đợi ít phút trước khi thử lại.'
  }
});

/**
 * Giới hạn chung cho toàn bộ API
 */
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: isTestEnv ? 20000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Lưu lượng truy cập quá nhanh. Vui lòng thử lại sau giây lát.'
  }
});

module.exports = {
  loginLimiter,
  spinLimiter,
  createWheelLimiter,
  uploadLimiter,
  generalApiLimiter
};
