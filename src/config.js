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
  if (config.nodeEnv === 'production' && !process.env.PUBLIC_BASE_URL) {
    throw new Error('❌ [CẤU HÌNH PRODUCTION LỖI]: Thiếu biến môi trường bắt buộc PUBLIC_BASE_URL trong môi trường production. Vui lòng cấu hình PUBLIC_BASE_URL=https://vong-quay-kappa.vercel.app trên Vercel Project Settings.');
  }

  if (config.nodeEnv === 'production') {
    const secret = process.env.JWT_SECRET || '';
    const lowerSecret = secret.toLowerCase();
    const insecurePatterns = [
      'changeme',
      'secret',
      '0123456789abcdef',
      'super_secret_jwt_key_at_least_32_characters_long_lucky_wheel_saas_2026_secure',
      'lucky_wheel_saas_production_secure_fallback_jwt_secret_key_2026_x99a'
    ];
    const isPatternMatched = insecurePatterns.some((pattern) => lowerSecret.includes(pattern));

    if (!secret || secret.length < 32 || isPatternMatched) {
      throw new Error('❌ [CẤU HÌNH PRODUCTION LỖI]: JWT_SECRET không an toàn! Trong production, JWT_SECRET phải có độ dài tối thiểu 32 ký tự ngẫu nhiên và không được sử dụng các giá trị mẫu (như secret, changeme, 0123456789abcdef, hoặc chuỗi trong .env.example).');
    }
  } else if (!process.env.JWT_SECRET) {
    console.warn('⚠️ [CẢNH BÁO]: JWT_SECRET chưa được cấu hình trong biến môi trường. Đang dùng khóa bảo mật dự phòng.');
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
