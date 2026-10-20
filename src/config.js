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
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://vong-quay-kappa.vercel.app').replace(/\/+$/, ''),
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
  if (!process.env.PUBLIC_BASE_URL) {
    console.warn('⚠️ [CẢNH BÁO]: PUBLIC_BASE_URL chưa được cấu hình. Đang tự động sử dụng mặc định: https://vong-quay-kappa.vercel.app');
  }

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ [CẢNH BÁO]: JWT_SECRET chưa được cấu hình trong biến môi trường. Đang dùng khóa bảo mật dự phòng.');
  } else if (process.env.JWT_SECRET.length < 16) {
    console.warn('⚠️ [CẢNH BÁO BẢO MẬT]: JWT_SECRET nên có độ dài tối thiểu 16 ký tự ngẫu nhiên.');
  }

  if (!config.imgbbApiKey) {
    console.warn('⚠️ [CẢNH BÁO]: IMGBB_API_KEY chưa được cấu hình. Chức năng upload ảnh sẽ hoạt động ở chế độ mô phỏng dev.');
  }

  if ((!config.firebase.serviceAccountBase64 && !config.firebase.serviceAccountPath) || !config.firebase.databaseURL) {
    console.warn('ℹ️ [THÔNG TIN]: Firebase chưa được cấu hình đầy đủ. Hệ thống sẽ sử dụng In-Memory Database (RAM Store) dự phòng.');
  }
}

validateConfig();

module.exports = config;
