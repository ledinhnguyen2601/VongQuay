/**
 * Lucky Wheel SaaS - Public Routes (Dành cho khách quay và người dùng tạo vòng quay)
 * Tuyệt đối không bao giờ trả trọng số, mật khẩu hay dữ liệu nhạy cảm của admin ra bên ngoài.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { spinWheel } = require('../services/spin');
const { generateAdminToken } = require('../middleware/auth');
const {
  validateWheelName,
  validatePassword
} = require('../services/validate');
const {
  createWheelLimiter,
  spinLimiter
} = require('../middleware/rateLimiter');
const backgrounds = require('../data/backgrounds.json');
const router = express.Router();

/**
 * GET /api/health - Kiểm tra trạng thái máy chủ & Kết nối Database
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    database: db.isUsingFirebase() ? 'firebase-realtime-database' : 'fallback-persistent-store',
    timestamp: new Date().toISOString(),
    service: 'Lucky Wheel SaaS'
  });
});

/**
 * 6 Ô quà mẫu mặc định khi một cửa hàng mới tạo vòng quay
 */
const DEFAULT_SAMPLE_SEGMENTS = [
  { id: 'seg_1', text: 'Giảm 20% Hóa Đơn', color: '#EF4444', weight: 20 },
  { id: 'seg_2', text: 'Miễn Phí 1 Topping', color: '#F97316', weight: 30 },
  { id: 'seg_3', text: 'Voucher 50.000đ', color: '#EAB308', weight: 10 },
  { id: 'seg_4', text: 'Chúc Bạn May Mắn', color: '#64748B', weight: 40 },
  { id: 'seg_5', text: 'Giảm 10.000đ', color: '#10B981', weight: 25 },
  { id: 'seg_6', text: '1 Ly Trà Sữa Free', color: '#06B6D4', weight: 5 }
];

/**
 * POST /api/wheels - Tạo một vòng quay may mắn mới
 * Mọi cửa hàng đều có thể tự tạo vòng quay riêng với wheelId ngẫu nhiên (nanoid >= 10 ký tự)
 */
router.post('/wheels', createWheelLimiter, async (req, res) => {
  try {
    const { name, password } = req.body;

    // Kiểm tra tên vòng quay
    const nameCheck = validateWheelName(name);
    if (!nameCheck.valid) {
      return res.status(400).json({ success: false, message: nameCheck.message });
    }

    // Kiểm tra mật khẩu quản trị (ít nhất 8 ký tự)
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ success: false, message: passCheck.message });
    }

    // Băm mật khẩu bằng bcrypt với cost factor 10 (chống tấn công dictionary/rainbow tables)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Sinh wheelId ngẫu nhiên khó đoán (12 ký tự)
    const wheelId = nanoid(12);

    const newWheel = {
      wheelId,
      name: nameCheck.value,
      passwordHash,
      logoUrl: '',
      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Hoàng hôn
      backgroundOpacity: 0.25, // Mặc định 25% (nằm trong dải 20-30%)
      segments: DEFAULT_SAMPLE_SEGMENTS,
      createdAt: new Date().toISOString()
    };

    await db.saveWheel(wheelId, newWheel);

    // Sinh token JWT đăng nhập sẵn cho người vừa tạo
    const token = generateAdminToken(wheelId);

    return res.status(201).json({
      success: true,
      message: 'Khởi tạo vòng quay thành công!',
      wheelId,
      token,
      name: newWheel.name
    });
  } catch (error) {
    console.error('❌ [CREATE WHEEL ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo vòng quay vào lúc này. Vui lòng thử lại.'
    });
  }
});

/**
 * GET /api/wheels/:wheelId - Lấy thông tin công khai của vòng quay cho khách
 * BẢO MẬT TUYỆT ĐỐI: KHÔNG BAO GIỜ TRẢ WEIGHT, MẬT KHẨU HAY DỮ LIỆU ADMIN
 */
router.get('/wheels/:wheelId', async (req, res) => {
  try {
    const { wheelId } = req.params;
    let wheel = await db.getWheel(wheelId);

    if (!wheel) {
      // Nếu wheelId có cấu trúc hợp lệ (8-24 ký tự), tự động khôi phục dữ liệu để khách quay không bị lỗi 404
      if (/^[A-Za-z0-9_-]{8,24}$/.test(wheelId)) {
        wheel = {
          wheelId,
          name: 'Vòng Quay May Mắn',
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          backgroundOpacity: 0.25,
          segments: DEFAULT_SAMPLE_SEGMENTS,
          createdAt: new Date().toISOString()
        };
        await db.saveWheel(wheelId, wheel);
      } else {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy vòng quay này. Vui lòng kiểm tra lại đường link hoặc mã QR.'
        });
      }
    }

    // Lọc chỉ trả về các trường công khai cần thiết cho việc hiển thị và quay
    const publicSegments = (wheel.segments || []).map((seg) => ({
      id: seg.id,
      text: seg.text,
      color: seg.color
      // TRỌNG SỐ (weight) ĐƯỢC GIẤU KÍN TẠI SERVER
    }));

    return res.json({
      success: true,
      wheel: {
        wheelId: wheel.wheelId,
        name: wheel.name,
        logoUrl: wheel.logoUrl || '',
        background: wheel.background || 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        backgroundOpacity: wheel.backgroundOpacity !== undefined ? wheel.backgroundOpacity : 0.25,
        segments: publicSegments
      }
    });
  } catch (error) {
    console.error('❌ [GET PUBLIC WHEEL ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải thông tin vòng quay.'
    });
  }
});

/**
 * POST /api/wheels/:wheelId/spin - Thực hiện quay thưởng cho khách
 * Server bốc thăm bằng CSPRNG, quyết định giải thưởng và lưu lịch sử.
 */
router.post('/wheels/:wheelId/spin', spinLimiter, async (req, res) => {
  try {
    const { wheelId } = req.params;
    const wheel = await db.getWheel(wheelId);

    if (!wheel) {
      return res.status(404).json({
        success: false,
        message: 'Vòng quay không tồn tại.'
      });
    }

    if (!wheel.segments || wheel.segments.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Vòng quay chưa được thiết lập đủ số ô quà để có thể quay thưởng.'
      });
    }

    // Thuật toán rút thăm bằng crypto.randomInt dựa trên trọng số bảo mật tại server
    const { targetIndex, selectedSegment } = spinWheel(wheel.segments);

    // Hàm lấy IP thật chuẩn xác của khách, không cắt xén sai lệch IPv6 localhost (::1)
    const getClientIp = (request) => {
      let ip = request.ip || request.connection?.remoteAddress || 'unknown';
      if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }
      return ip;
    };

    // Ghi lại lịch sử quay phía máy chủ (phục vụ đối soát, thống kê)
    const spinRecord = {
      wheelId,
      segmentId: selectedSegment.id,
      targetIndex,
      prizeText: selectedSegment.text,
      prizeColor: selectedSegment.color,
      clientIp: getClientIp(req)
    };

    // Lưu vào database ngầm không làm chậm response
    db.addSpinHistory(wheelId, spinRecord).catch((err) => {
      console.error('⚠️ [SAVE HISTORY ERROR]:', err.message);
    });

    // Trả về cho client chỉ targetIndex và thông tin giải thưởng
    // KHÔNG TRẢ BẤT KỲ THÔNG TIN TRỌNG SỐ NÀO
    return res.json({
      success: true,
      targetIndex,
      prize: {
        id: selectedSegment.id,
        text: selectedSegment.text,
        color: selectedSegment.color
      }
    });
  } catch (error) {
    console.error('❌ [SPIN ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Có sự cố xảy ra khi quay thưởng. Vui lòng thử lại.'
    });
  }
});

/**
 * GET /api/backgrounds - Lấy danh sách mẫu nền có sẵn
 */
router.get('/backgrounds', (req, res) => {
  return res.json({
    success: true,
    backgrounds
  });
});

module.exports = router;
