/**
 * Lucky Wheel SaaS - Quản lý và kiểm tra biến môi trường
 * Đảm bảo hệ thống an toàn tuyệt đối ngay từ bước khởi động.
 */

const dotenv = require('dotenv');
const path = require('path');

// Đọc cấu hình từ file .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  imgbbApiKey: process.env.IMGBB_API_KEY || '',
  firebase: {
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || ''
  }
};

/**
 * Kiểm tra tính hợp lệ của biến môi trường bắt buộc
 */
function validateConfig() {
  const errors = [];

  // Kiểm tra JWT_SECRET
  if (!config.jwtSecret) {
    errors.push('JWT_SECRET chưa được thiết lập trong .env!');
  } else if (config.jwtSecret.length < 32) {
    errors.push(`JWT_SECRET quá ngắn (${config.jwtSecret.length} ký tự). Yêu cầu tối thiểu 32 ký tự ngẫu nhiên để chống tấn công brute-force/dictionary!`);
  }

  // Nếu có lỗi nghiêm trọng, dừng server ngay lập tức
  if (errors.length > 0) {
    console.error('\n❌ [LỖI CẤU HÌNH NGHIÊM TRỌNG]:');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error('Vui lòng kiểm tra lại file .env trước khi khởi động server.\n');
    process.exit(1);
  }

  // Ghi nhận cảnh báo nhẹ nếu thiếu một số tùy chọn
  if (!config.imgbbApiKey) {
    console.warn('⚠️ [CẢNH BÁO]: IMGBB_API_KEY chưa được cấu hình. Chức năng upload ảnh sẽ hoạt động ở chế độ mô phỏng dev.');
  }

  if ((!config.firebase.serviceAccountBase64 && !config.firebase.serviceAccountPath) || !config.firebase.databaseURL) {
    console.warn('ℹ️ [THÔNG TIN]: Firebase chưa được cấu hình đầy đủ. Hệ thống sẽ sử dụng In-Memory Database (RAM Store) để dev.');
  }
}

validateConfig();

module.exports = config;
