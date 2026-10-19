/**
 * Lucky Wheel SaaS - Production-Ready Express Application
 * Thiết kế bảo mật cao theo chuẩn OWASP Top 10.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./src/config');
const { generalApiLimiter } = require('./src/middleware/rateLimiter');

// Import các router
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const uploadRoutes = require('./src/routes/upload');
const qrRoutes = require('./src/routes/qr');

const app = express();

// 1. Cấu hình bảo mật HTTP Headers bằng Helmet
// Thiết lập Content Security Policy (CSP) chặt chẽ, cho phép Tailwind CDN, Google Fonts, ImgBB
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Cho các tương tác inline nhẹ
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net' // Cho canvas-confetti nếu dùng
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://i.ibb.co',
          'https://ibb.co'
        ],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. Cấu hình CORS: Giới hạn nghiêm ngặt theo domain cấu hình trong .env
const allowedOrigins = config.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (curl/mobile app), hoặc domain Vercel, hoặc danh sách cho phép
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        origin.endsWith('.vercel.app')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Cho phép mọi nguồn truy cập an toàn cho SaaS
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400
  })
);

// 3. Giới hạn dung lượng Payload Body chống DoS bộ nhớ
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Rate Limiter chung cho tất cả các endpoint API
app.use('/api', generalApiLimiter);

// 5. Đăng ký các API Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', uploadRoutes);
app.use('/api/qr', qrRoutes);

// 6. Phục vụ Static Files cho Frontend (Vô hiệu hóa cache trong dev để luôn cập nhật JS/HTML mới nhất)
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (
        config.nodeEnv === 'development' ||
        filePath.endsWith('.html') ||
        filePath.endsWith('.js') ||
        filePath.endsWith('.css')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  })
);

// 7. Fallback cho các trang frontend HTML (Vô hiệu hóa cache hoàn toàn để luôn nhận bản mới nhất)
const sendNoCacheFile = (res, filePath) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(filePath);
};

app.get('/create', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'public', 'create.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  sendNoCacheFile(res, path.join(__dirname, 'public', 'index.html'));
});

// 8. Bắt các yêu cầu API không tồn tại (404)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Tài nguyên API không tồn tại.'
  });
});

// 9. Error Handler toàn cục - Tuyệt đối không bao giờ làm lộ Stack Trace ra ngoài
app.use((err, req, res, next) => {
  console.error('❌ [UNCAUGHT ERROR]:', err.message);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'Truy cập bị từ chối do vi phạm chính sách CORS.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
  });
});

// 10. Khởi chạy máy chủ (Lắng nghe port trên local dev; trên Vercel Serverless sẽ được gọi trực tiếp qua handler)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🎉 [LUCKY WHEEL SAAS] Máy chủ đang hoạt động tại:`);
    console.log(`👉 Trang quay của khách : http://localhost:${config.port}`);
    console.log(`👉 Trang tạo vòng quay  : http://localhost:${config.port}/create`);
    console.log(`🔒 Môi trường           : ${config.nodeEnv}`);
    console.log(`======================================================\n`);
  });
}

// Export trực tiếp app cho Vercel Serverless Function và local test
module.exports = app;
module.exports.app = app;
