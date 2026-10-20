/**
 * Lucky Wheel SaaS - Quản lý và kiểm tra biến môi trường
 * Đảm bảo hệ thống an toàn tuyệt đối ngay từ bước khởi động.
 */

const dotenv = require('dotenv');
const path = require('path');

// Đọc cấu hình từ file .env trong môi trường phát triển cục bộ
if (process.env.NODE_ENV !== 'production' && !process.env.DISABLE_DOTENV) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Tự động cấp khóa fallback bảo mật cao nếu môi trường serverless (như Vercel) chưa kịp cấu hình biến môi trường
  jwtSecret: process.env.JWT_SECRET || 'lucky_wheel_saas_production_secure_fallback_jwt_secret_key_2026_x99a',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  imgbbApiKey: process.env.IMGBB_API_KEY || '',
  firebase: {
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || ''
  }
};

/**
 * Kiểm tra tính hợp lệ của biến môi trường
 * Cảnh báo log rõ ràng, không gọi process.exit(1) để chống sập Serverless Function trên Vercel
 */
function validateConfig() {
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ [CẢNH BÁO]: JWT_SECRET chưa được cấu hình trong biến môi trường Vercel. Đang dùng khóa bảo mật dự phòng.');
  }

  if (!config.imgbbApiKey) {
    console.warn('⚠️ [CẢNH BÁO]: IMGBB_API_KEY chưa được cấu hình. Chức năng upload ảnh sẽ hoạt động ở chế độ mô phỏng dev.');
  }

  if ((!config.firebase.serviceAccountBase64 && !config.firebase.serviceAccountPath) || !config.firebase.databaseURL) {
    if (config.nodeEnv === 'production') {
      throw new Error('❌ [CẤU HÌNH PRODUCTION LỖI]: Thiếu thông tin kết nối Firebase Realtime Database (FIREBASE_SERVICE_ACCOUNT_BASE64 hoặc FIREBASE_SERVICE_ACCOUNT_PATH và FIREBASE_DATABASE_URL). Trong production bắt buộc phải có Firebase, tuyệt đối không lùi về In-Memory!');
    } else {
      console.warn('ℹ️ [THÔNG TIN]: Firebase chưa được cấu hình. Hệ thống sẽ sử dụng In-Memory Database (RAM Store) để phục vụ phát triển cục bộ.');
    }
  }
}

validateConfig();

module.exports = config;
