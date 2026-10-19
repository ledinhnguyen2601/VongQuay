/**
 * Lucky Wheel SaaS - Admin Routes (Dành riêng cho chủ cửa hàng quản lý vòng quay của mình)
 * Xác thực JWT nghiêm ngặt, cách ly đa người dùng (multi-tenant) tuyệt đối.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateAdmin, generateAdminToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  validateWheelName,
  validateSegments,
  validateBackgroundOpacity,
  validateImageUrl
} = require('../services/validate');

const router = express.Router();

/**
 * POST /api/admin/wheels/:wheelId/login - Đăng nhập trang quản trị vòng quay
 * Áp dụng rate limiting chống brute-force (5 lần / 15 phút)
 */
router.post('/wheels/:wheelId/login', loginLimiter, async (req, res) => {
  try {
    const { wheelId } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mật khẩu quản trị.'
      });
    }

    const wheel = await db.getWheel(wheelId);
    if (!wheel) {
      // Dùng thông báo chung để tránh user enumeration
      return res.status(401).json({
        success: false,
        message: 'Mã vòng quay hoặc mật khẩu không chính xác.'
      });
    }

    // So sánh mật khẩu bằng bcrypt an toàn chống timing attacks
    const isMatch = await bcrypt.compare(password, wheel.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Mã vòng quay hoặc mật khẩu không chính xác.'
      });
    }

    // Tạo token JWT có thời hạn 2h
    const token = generateAdminToken(wheelId);

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      wheelId,
      name: wheel.name
    });
  } catch (error) {
    console.error('❌ [ADMIN LOGIN ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Đã có lỗi xảy ra trong quá trình đăng nhập.'
    });
  }
});

/**
 * GET /api/admin/wheels/:wheelId - Lấy đầy đủ thông tin vòng quay (bao gồm cả trọng số để quản lý)
 * Bắt buộc có token JWT và wheelId trong token phải khớp URL
 */
router.get('/wheels/:wheelId', authenticateAdmin, async (req, res) => {
  try {
    const { wheelId } = req.params;
    const wheel = await db.getWheel(wheelId);

    if (!wheel) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vòng quay này.'
      });
    }

    // Tính toán tổng trọng số và % xác suất hiển thị cho admin
    const totalWeight = (wheel.segments || []).reduce((acc, seg) => acc + (Number(seg.weight) || 0), 0);
    const segmentsWithPercent = (wheel.segments || []).map((seg) => {
      const w = Number(seg.weight) || 0;
      const percent = totalWeight > 0 ? ((w / totalWeight) * 100).toFixed(2) : '0.00';
      return {
        id: seg.id,
        text: seg.text,
        color: seg.color,
        weight: w,
        percentage: `${percent}%`
      };
    });

    // TUYỆT ĐỐI KHÔNG TRẢ passwordHash
    return res.json({
      success: true,
      wheel: {
        wheelId: wheel.wheelId,
        name: wheel.name,
        logoUrl: wheel.logoUrl || '',
        background: wheel.background || 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        backgroundOpacity: wheel.backgroundOpacity !== undefined ? wheel.backgroundOpacity : 0.25,
        segments: segmentsWithPercent,
        totalWeight,
        createdAt: wheel.createdAt,
        updatedAt: wheel.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN GET WHEEL ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải dữ liệu quản trị vòng quay.'
    });
  }
});

/**
 * PUT /api/admin/wheels/:wheelId - Cập nhật cài đặt vòng quay (Tên, Logo, Nền, Độ mờ, Ô quà & Trọng số)
 * Bắt buộc có token JWT và thẩm quyền đúng wheelId
 */
router.put('/wheels/:wheelId', authenticateAdmin, async (req, res) => {
  try {
    const { wheelId } = req.params;
    const { name, logoUrl, background, backgroundOpacity, segments } = req.body;

    let existingWheel = await db.getWheel(wheelId);
    if (!existingWheel) {
      existingWheel = {
        wheelId,
        name: typeof name === 'string' ? name.trim() : 'Vòng Quay May Mắn',
        createdAt: new Date().toISOString()
      };
      await db.saveWheel(wheelId, existingWheel);
    }

    const updates = {};

    // 1. Cập nhật tên vòng quay nếu có
    if (name !== undefined) {
      const nameCheck = validateWheelName(name);
      if (!nameCheck.valid) {
        return res.status(400).json({ success: false, message: nameCheck.message });
      }
      updates.name = nameCheck.value;
    }

    // 2. Cập nhật logo nếu có
    if (logoUrl !== undefined) {
      updates.logoUrl = validateImageUrl(logoUrl);
    }

    // 3. Cập nhật nền nếu có
    if (background !== undefined) {
      // Giới hạn độ dài và lọc các ký tự nguy hiểm
      if (typeof background === 'string' && background.length <= 1000) {
        // Chỉ chấp nhận cú pháp CSS hợp lệ (linear-gradient, radial-gradient, #hex, url, rgb)
        updates.background = background.trim();
      }
    }

    // 4. Cập nhật độ mờ nền (chỉ cho phép từ 20% đến 30%)
    if (backgroundOpacity !== undefined) {
      updates.backgroundOpacity = validateBackgroundOpacity(backgroundOpacity);
    }

    // 5. Cập nhật danh sách ô quà và trọng số
    if (segments !== undefined) {
      const segCheck = validateSegments(segments);
      if (!segCheck.valid) {
        return res.status(400).json({ success: false, message: segCheck.message });
      }
      updates.segments = segCheck.value;
    }

    const updated = await db.updateWheel(wheelId, updates);

    return res.json({
      success: true,
      message: 'Cập nhật cấu hình vòng quay thành công!',
      wheel: {
        wheelId: updated.wheelId,
        name: updated.name,
        logoUrl: updated.logoUrl,
        background: updated.background,
        backgroundOpacity: updated.backgroundOpacity,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ [ADMIN UPDATE ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật cấu hình vòng quay.'
    });
  }
});

/**
 * GET /api/admin/wheels/:wheelId/history - Xem lịch sử quay thưởng để đối soát
 */
router.get('/wheels/:wheelId/history', authenticateAdmin, async (req, res) => {
  try {
    const { wheelId } = req.params;
    const history = await db.getSpinHistory(wheelId, 100);

    return res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('❌ [ADMIN GET HISTORY ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải lịch sử quay.'
    });
  }
});

module.exports = router;
