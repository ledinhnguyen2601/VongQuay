/**
 * Lucky Wheel SaaS - Input Validation & Sanitization Service
 * Đảm bảo dữ liệu người dùng gửi lên luôn an toàn, không chứa mã độc XSS hay sai định dạng.
 */

// Regex kiểm tra màu HEX (#RGB hoặc #RRGGBB)
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

// Regex kiểm tra URL ảnh imgbb hoặc https hợp lệ
const SAFE_IMAGE_URL_REGEX = /^(https:\/\/(i\.ibb\.co|ibb\.co)\/[a-zA-Z0-9_\-\.\/]+)?$/;

/**
 * Thoát các ký tự đặc biệt HTML để ngăn chặn XSS
 * @param {string} str 
 * @returns {string} Chuỗi an toàn
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Kiểm tra và chuẩn hóa tên cửa hàng / tên vòng quay
 */
function validateWheelName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Tên vòng quay không được để trống.' };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return { valid: false, message: 'Tên vòng quay phải có độ dài từ 2 đến 80 ký tự.' };
  }

  return {
    valid: true,
    value: escapeHtml(trimmed)
  };
}

/**
 * Kiểm tra mật khẩu admin
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Mật khẩu quản trị không được để trống.' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Mật khẩu quản trị phải có ít nhất 8 ký tự.' };
  }

  if (password.length > 100) {
    return { valid: false, message: 'Mật khẩu quá dài (tối đa 100 ký tự).' };
  }

  return { valid: true };
}

/**
 * Kiểm tra danh sách các ô quà (segments)
 * - Tối thiểu 2 ô, tối đa 24 ô
 * - Mỗi ô gồm: text (1-50 ký tự), color (màu HEX hợp lệ), weight (số >= 0)
 * - Tổng trọng số phải > 0
 */
function validateSegments(segments) {
  if (!Array.isArray(segments)) {
    return { valid: false, message: 'Dữ liệu các ô quà phải là một danh sách mảng.' };
  }

  if (segments.length < 2 || segments.length > 24) {
    return { valid: false, message: `Số lượng ô quà phải từ 2 đến 24 ô (hiện có: ${segments.length}).` };
  }

  const validatedSegments = [];
  let totalWeight = 0;

  for (let i = 0; i < segments.length; i++) {
    const item = segments[i];

    if (!item || typeof item !== 'object') {
      return { valid: false, message: `Ô quà thứ ${i + 1} có định dạng không hợp lệ.` };
    }

    // Kiểm tra tên ô quà
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (text.length < 1 || text.length > 50) {
      return { valid: false, message: `Tên quà ở ô ${i + 1} phải từ 1 đến 50 ký tự.` };
    }

    // Kiểm tra mã màu HEX
    const color = typeof item.color === 'string' ? item.color.trim() : '';
    if (!HEX_COLOR_REGEX.test(color)) {
      return { valid: false, message: `Mã màu ở ô ${i + 1} (${color}) không phải mã HEX hợp lệ (ví dụ: #FF5722 hoặc #F50).` };
    }

    // Kiểm tra trọng số (weight)
    const weight = Number(item.weight);
    if (isNaN(weight) || weight < 0 || !isFinite(weight)) {
      return { valid: false, message: `Trọng số ở ô ${i + 1} phải là một số lớn hơn hoặc bằng 0.` };
    }

    totalWeight += weight;

    validatedSegments.push({
      id: item.id && typeof item.id === 'string' ? item.id.slice(0, 36) : `seg_${i + 1}`,
      text: escapeHtml(text),
      color: color.toUpperCase(),
      weight: parseFloat(weight.toFixed(4)),
      order: typeof item.order === 'number' ? item.order : i
    });
  }

  if (totalWeight <= 0) {
    return { valid: false, message: 'Tổng trọng số của tất cả các ô quà phải lớn hơn 0 để có thể quay thưởng.' };
  }

  // Đảm bảo sắp xếp đúng theo order cố định
  validatedSegments.sort((a, b) => a.order - b.order);

  return {
    valid: true,
    value: validatedSegments,
    totalWeight
  };
}

/**
 * Kiểm tra độ mờ ảnh nền (yêu cầu trong khoảng 20% - 30%, tức 0.20 - 0.30)
 */
function validateBackgroundOpacity(opacity) {
  const num = Number(opacity);
  if (isNaN(num)) return 0.25; // mặc định 25%
  // Khống chế trong khoảng 0.20 đến 0.30
  if (num < 0.20) return 0.20;
  if (num > 0.30) return 0.30;
  return parseFloat(num.toFixed(2));
}

/**
 * Kiểm tra URL ảnh
 */
function validateImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed === '') return '';
  // Chỉ chấp nhận HTTP/HTTPS và không chứa script
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return trimmed;
  } catch {
    return '';
  }
}

module.exports = {
  escapeHtml,
  validateWheelName,
  validatePassword,
  validateSegments,
  validateBackgroundOpacity,
  validateImageUrl,
  HEX_COLOR_REGEX
};
