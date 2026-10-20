/**
 * Lucky Wheel SaaS - Authentication Middleware
 * Xác thực JWT nghiêm ngặt, đối chiếu chữ ký mã hóa và thẩm quyền truy cập theo wheelId.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Middleware bảo vệ các route quản trị của vòng quay
 * Kiểm tra:
 * 1. Header Authorization có định dạng Bearer <token>
 * 2. Token hợp lệ, được ký đúng bằng JWT_SECRET, chưa hết hạn (2h)
 * 3. wheelId trong token PHẢI KHỚP TUYỆT ĐỐI với wheelId trong URL params hoặc body
 */
function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập quản trị viên để thực hiện thao tác này.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token xác thực không hợp lệ.'
      });
    }

    // Xác minh chữ ký số và thời hạn token
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!'
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Token xác thực không hợp lệ hoặc đã bị thay đổi.'
        });
      }

      // Lấy wheelId từ params, query hoặc body
      const requestedWheelId = req.params.wheelId || req.body.wheelId || req.query.wheelId;

      if (!requestedWheelId) {
        return res.status(400).json({
          success: false,
          message: 'Mã vòng quay không xác định trong yêu cầu.'
        });
      }

      // KIỂM TRA ĐA NGƯỜI DÙNG (Multi-Tenant Isolation):
      // Token của wheelId nào chỉ được phép thao tác trên đúng wheelId đó!
      if (decoded.wheelId !== requestedWheelId) {
        return res.status(403).json({
          success: false,
          message: 'Truy cập bị từ chối: Bạn không có quyền quản lý vòng quay này!'
        });
      }

      // Gắn thông tin admin đã xác thực vào request
      req.admin = {
        wheelId: decoded.wheelId,
        role: decoded.role || 'admin'
      };

      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra trong quá trình xác thực.'
    });
  }
}

/**
 * Tạo token JWT cho Admin với thời hạn 2 giờ
 * @param {string} wheelId 
 * @returns {string} Token JWT
 */
function generateAdminToken(wheelId) {
  return jwt.sign(
    {
      wheelId,
      role: 'admin'
    },
    config.jwtSecret,
    {
      expiresIn: '2h',
      algorithm: 'HS256'
    }
  );
}

module.exports = {
  authenticateAdmin,
  generateAdminToken
};
