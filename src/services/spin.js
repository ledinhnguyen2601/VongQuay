/**
 * Lucky Wheel SaaS - Spin Service (Cryptographically Secure RNG)
 * Thuật toán quay thưởng roulette wheel selection sử dụng crypto.randomInt
 * Kết quả do server quyết định 100%, bảo mật và công bằng tuyệt đối.
 */

const crypto = require('crypto');

/**
 * Thực hiện bốc thăm chọn ô quà theo trọng số bằng RNG mật mã học
 * @param {Array} segments - Mảng danh sách các ô quà kèm trọng số (weight)
 * @returns {Object} { targetIndex, selectedSegment }
 */
function spinWheel(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Danh sách ô quà không hợp lệ.');
  }

  // Tính tổng trọng số
  const totalWeight = segments.reduce((acc, seg) => acc + (Number(seg.weight) || 0), 0);

  if (totalWeight <= 0) {
    throw new Error('Tổng trọng số phải lớn hơn 0.');
  }

  // Để sử dụng crypto.randomInt an toàn cho cả số thập phân,
  // chúng ta nhân hệ số mở rộng tỷ lệ (precision scale = 1,000,000)
  const SCALE = 1000000;
  const scaledTotal = Math.floor(totalWeight * SCALE);

  if (scaledTotal <= 0) {
    // Trường hợp tất cả trọng số quá nhỏ xấp xỉ 0, fallback chọn ngẫu nhiên đồng đều
    const randomIndex = crypto.randomInt(0, segments.length);
    return {
      targetIndex: randomIndex,
      selectedSegment: segments[randomIndex]
    };
  }

  // Sinh số ngẫu nhiên an toàn trong khoảng [0, scaledTotal)
  const randomValue = crypto.randomInt(0, scaledTotal);

  // Dò tìm ô quà tương ứng theo cumulative distribution (Roulette Wheel)
  let currentAccumulator = 0;
  for (let i = 0; i < segments.length; i++) {
    const segmentWeight = Number(segments[i].weight) || 0;
    const scaledSegmentWeight = Math.floor(segmentWeight * SCALE);
    currentAccumulator += scaledSegmentWeight;

    if (randomValue < currentAccumulator) {
      return {
        targetIndex: i,
        selectedSegment: segments[i]
      };
    }
  }

  // Fallback an toàn (tránh sai số làm tròn số học ở biên cuối)
  const lastIndex = segments.length - 1;
  return {
    targetIndex: lastIndex,
    selectedSegment: segments[lastIndex]
  };
}

module.exports = {
  spinWheel
};
