/**
 * Lucky Wheel SaaS - QR Generator Service & Route
 * Sinh mã QR độ phân giải cao trỏ tới link người chơi /?w={wheelId}
 * Hỗ trợ mức sửa lỗi High (H) giúp quét mượt mà ngay cả khi có logo ở tâm.
 */

const express = require('express');
const QRCode = require('qrcode');
const sharp = require('sharp');
const db = require('../db');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/qr/:wheelId - Sinh mã QR Code cho vòng quay
 * Query parameters:
 *  - format: 'png' | 'dataurl' (mặc định 'png')
 *  - color: mã HEX màu các chấm QR (mặc định #000000)
 *  - bgColor: mã HEX màu nền QR (mặc định #FFFFFF)
 *  - size: kích thước pixel (mặc định 600px cho độ nét cao)
 *  - includeLogo: 'true' | 'false' (chèn logo quán vào giữa QR)
 */
router.get('/:wheelId', async (req, res) => {
  try {
    const { wheelId } = req.params;
    const {
      format = 'png',
      color = '#000000',
      bgColor = '#ffffff',
      size = 600,
      includeLogo = 'false',
      themeFrame = 'none'
    } = req.query;

    // Lấy thông tin vòng quay nếu có trong DB, hoặc lấy logoUrl từ query
    const wheel = await db.getWheel(wheelId);
    const logoToUse = (wheel && wheel.logoUrl) ? wheel.logoUrl : (req.query.logoUrl || '');

    // Xây dựng URL trang quay cho người chơi chuẩn xác từ PUBLIC_BASE_URL (không dùng host request)
    const playUrl = `${config.publicBaseUrl}/?w=${encodeURIComponent(wheelId)}`;

    const qrSize = Math.min(Math.max(parseInt(size, 10) || 600, 200), 1200);

    // Sinh QR Code Buffer ở mức sửa lỗi 'H' (High ~ 30% phục hồi dữ liệu)
    const qrBuffer = await QRCode.toBuffer(playUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: qrSize,
      margin: 2,
      color: {
        dark: color.startsWith('#') ? color : `#${color}`,
        light: bgColor.startsWith('#') ? bgColor : `#${bgColor}`
      }
    });

    let finalBuffer = qrBuffer;

    // Nếu yêu cầu chèn logo cửa hàng vào giữa QR và vòng quay có logo
    if (includeLogo === 'true' && logoToUse) {
      try {
        let logoImageBuffer = null;

        if (logoToUse.startsWith('data:image')) {
          // Data URL
          const base64Data = logoToUse.split(',')[1];
          if (base64Data) {
            logoImageBuffer = Buffer.from(base64Data, 'base64');
          }
        } else if (logoToUse.startsWith('http://') || logoToUse.startsWith('https://')) {
          // Fetch từ URL
          const fetchRes = await fetch(logoToUse);
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer();
            logoImageBuffer = Buffer.from(arrayBuf);
          }
        }

        if (logoImageBuffer) {
          // Kích thước logo ở giữa khoảng 22% kích thước QR (đảm bảo mức sửa lỗi H phục hồi 100%)
          const logoSize = Math.floor(qrSize * 0.22);
          const logoPadding = Math.floor(logoSize * 0.1);

          // Tạo khung nền trắng tròn/bo góc cho logo
          const logoResized = await sharp(logoImageBuffer)
            .resize(logoSize, logoSize, { fit: 'cover' })
            .toBuffer();

          // Tạo nền trắng bo góc nhẹ làm viền bảo vệ
          const badgeSize = logoSize + logoPadding * 2;
          const badgeSvg = Buffer.from(`
            <svg width="${badgeSize}" height="${badgeSize}">
              <rect x="0" y="0" width="${badgeSize}" height="${badgeSize}" rx="${Math.floor(badgeSize * 0.2)}" fill="${bgColor.startsWith('#') ? bgColor : `#${bgColor}`}" stroke="${color.startsWith('#') ? color : `#${color}`}" stroke-width="2" />
            </svg>
          `);

          const badgeWithLogo = await sharp(badgeSvg)
            .composite([{ input: logoResized, top: logoPadding, left: logoPadding }])
            .png()
            .toBuffer();

          // Chèn vào giữa QR
          const centerOffset = Math.floor((qrSize - badgeSize) / 2);
          finalBuffer = await sharp(qrBuffer)
            .composite([{ input: badgeWithLogo, top: centerOffset, left: centerOffset }])
            .png()
            .toBuffer();
        }
      } catch (logoErr) {
        console.warn('⚠️ [QR LOGO COMPOSITE WARNING]:', logoErr.message);
        // Nếu lỗi logo, giữ nguyên qrBuffer ban đầu
      }
    }

    if (format === 'dataurl') {
      const dataUrl = `data:image/png;base64,${finalBuffer.toString('base64')}`;
      return res.json({
        success: true,
        dataUrl,
        playUrl
      });
    }

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="qr-wheel-${wheelId}.png"`,
      'Cache-Control': 'public, max-age=300'
    });

    return res.send(finalBuffer);
  } catch (error) {
    console.error('❌ [QR GENERATION ERROR]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo mã QR vào lúc này.'
    });
  }
});

module.exports = router;
