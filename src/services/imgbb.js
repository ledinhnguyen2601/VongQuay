/**
 * Lucky Wheel SaaS - ImgBB Upload Service
 * Nhận file từ RAM, kiểm tra magic bytes bằng Sharp (chỉ cho phép JPEG/PNG/WEBP),
 * từ chối SVG/mã độc, đẩy lên ImgBB API trực tiếp từ server.
 */

const sharp = require('sharp');
const config = require('../config');

// Các định dạng ảnh an toàn được cấp phép
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'];

/**
 * Kiểm tra magic bytes và tính hợp lệ của file ảnh thông qua thư viện Sharp
 * Không phụ thuộc vào extension hay mimetype do client khai báo
 * @param {Buffer} buffer 
 * @returns {Promise<Object>} Metadata ảnh nếu hợp lệ
 */
async function inspectImageBuffer(buffer) {
  if (!buffer || buffer.length === 0) {
    throw new Error('File tải lên bị rỗng.');
  }

  // Giới hạn dung lượng tối đa 4MB (dưới ngưỡng 4.5MB của Vercel)
  const MAX_FILE_SIZE = 4 * 1024 * 1024;
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Dung lượng ảnh vượt quá giới hạn 4MB. Vui lòng chọn ảnh nhỏ hơn để đảm bảo tải nhanh trên điện thoại.');
  }

  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata || !metadata.format) {
      throw new Error('Tệp tải lên không phải là định dạng hình ảnh hợp lệ.');
    }

    // Từ chối SVG và các định dạng khác
    if (!ALLOWED_FORMATS.includes(metadata.format.toLowerCase())) {
      throw new Error(`Định dạng "${metadata.format}" không được hỗ trợ. Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.`);
    }

    return metadata;
  } catch (error) {
    if (error.message && (error.message.includes('không được hỗ trợ') || error.message.includes('vượt quá giới hạn'))) {
      throw error;
    }
    throw new Error('Tệp tải lên bị hỏng hoặc chứa mã độc giả mạo ảnh.');
  }
}

/**
 * Đẩy ảnh lên dịch vụ ImgBB từ server bằng API Key bí mật
 * Giữ nguyên chất lượng gốc của ảnh, không nén lại
 * @param {Buffer} buffer 
 * @param {string} originalName 
 * @returns {Promise<string>} URL ảnh đã upload trên i.ibb.co
 */
async function uploadToImgBB(buffer, originalName = 'upload.png') {
  // Kiểm tra magic bytes trước tiên
  await inspectImageBuffer(buffer);

  // Thiếu IMGBB_API_KEY: Báo lỗi rõ ràng, tuyệt đối không tạo Data URI rác lưu vào DB
  if (!config.imgbbApiKey) {
    throw new Error('Chưa cấu hình IMGBB_API_KEY trên máy chủ. Vui lòng cấu hình khóa API ImgBB để sử dụng tính năng tải ảnh.');
  }

  // Gửi FormData lên endpoint của ImgBB
  const base64Image = buffer.toString('base64');
  const params = new URLSearchParams();
  params.append('key', config.imgbbApiKey);
  params.append('image', base64Image);
  params.append('name', originalName.replace(/\.[^/.]+$/, ''));

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: params
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.error ? data.error.message : 'Lỗi từ máy chủ ImgBB';
      throw new Error(`Tải ảnh lên ImgBB thất bại: ${errorMsg}`);
    }

    // Trả về direct URL của ảnh (thường có dạng https://i.ibb.co/...)
    return data.data.url || data.data.display_url;
  } catch (error) {
    console.error('❌ [IMGBB UPLOAD ERROR]:', error.message);
    throw new Error('Không thể tải ảnh lên ImgBB vào lúc này. Vui lòng thử lại sau.');
  }
}

module.exports = {
  inspectImageBuffer,
  uploadToImgBB
};
