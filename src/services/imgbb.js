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

  // Giới hạn dung lượng tối đa 5MB (5 * 1024 * 1024 bytes)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5MB).');
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
    if (error.message && error.message.includes('không được hỗ trợ')) {
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
  const metadata = await inspectImageBuffer(buffer);

  // Nếu không có API Key trong môi trường Dev, fallback lưu dạng Data URI an toàn
  if (!config.imgbbApiKey) {
    console.warn('ℹ️ [IMGBB]: Không tìm thấy IMGBB_API_KEY. Chuyển sang Data URI cho môi trường dev.');
    const mimeType = `image/${metadata.format === 'jpeg' ? 'jpeg' : metadata.format}`;
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
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
