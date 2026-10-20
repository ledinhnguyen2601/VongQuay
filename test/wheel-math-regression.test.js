/**
 * Lucky Wheel SaaS - Wheel Math Regression Unit Test (Task [A])
 * Kiểm tra công thức toán học tính góc dừng vòng quay:
 * - Thử nghiệm với MỌI số ô từ 2 đến 24
 * - Thử nghiệm với MỌI ô mục tiêu i từ 0 đến N-1
 * - Thử nghiệm với các thời lượng nguyên và số lẻ từ 5000ms đến 19000ms
 * - Thử nghiệm liên tiếp nhiều lượt quay kế tiếp nhau (starting from previous rotation)
 * - Chứng minh công thức CŨ (chưa làm tròn minSpins) BỊ SAI
 * - Chứng minh công thức MỚI (đã làm tròn minSpins) CHUẨN XÁC 100%
 */

const assert = require('assert');

/**
 * Hàm mô phỏng tính góc dừng vòng quay theo công thức trong wheel.js
 * @param {number} currentRotation - Góc quay hiện tại của vòng quay (radian)
 * @param {number} numSegments - Số lượng ô quà (2 đến 24)
 * @param {number} targetIndex - Chỉ số ô trúng thưởng mong muốn (0 đến numSegments - 1)
 * @param {number} durationMs - Thời gian quay (5000ms đến 19000ms)
 * @param {boolean} useOldFormula - Có dùng công thức cũ bị lỗi không
 * @returns {number} Góc quay cuối cùng sau khi dừng
 */
function calculateFinalRotation(currentRotation, numSegments, targetIndex, durationMs, useOldFormula = false) {
  const anglePerSegment = (Math.PI * 2) / numSegments;
  const targetCenterAngle = (targetIndex + 0.5) * anglePerSegment;
  const targetAngle = (3 * Math.PI) / 2 - targetCenterAngle;

  let minSpins;
  if (useOldFormula) {
    // CÔNG THỨC CŨ BỊ LỖI: nhân 1.6 ra số lẻ thập phân (ví dụ 6 * 1.6 = 9.6 + 4 = 13.6)
    minSpins = Math.floor(durationMs / 1000) * 1.6 + 4;
  } else {
    // CÔNG THỨC MỚI ĐÃ SỬA: làm tròn hoàn toàn về số nguyên
    minSpins = Math.floor(Math.floor(durationMs / 1000) * 1.6) + 4;
  }

  const extraRotations = minSpins * Math.PI * 2;
  const startRotation = currentRotation % (Math.PI * 2);
  const diffAngle = ((targetAngle - startRotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const totalRotationTarget = startRotation + extraRotations + diffAngle;

  return totalRotationTarget;
}

/**
 * Hàm tính chỉ số ô nằm dưới kim chỉ đỉnh 12h (270 độ / 3*PI/2) từ góc quay
 * @param {number} finalRotation 
 * @param {number} numSegments 
 * @returns {number} Chỉ số ô quà nằm dưới kim
 */
function getPointerSegmentIndexFromRotation(finalRotation, numSegments) {
  const anglePerSegment = (Math.PI * 2) / numSegments;
  const normRotation = ((finalRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const pointerAngle = (3 * Math.PI) / 2;
  const wheelAngle = ((pointerAngle - normRotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(wheelAngle / anglePerSegment) % numSegments;
}

console.log('=================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY TOÁN HỌC GÓC DỪNG VÒNG QUAY [TASK A]');
console.log('=================================================================');

// 1. Kiểm tra chứng minh công thức cũ bị lỗi (Expected FAIL on old formula)
console.log('\n--- BƯỚC 1: Kiểm tra công thức CŨ (chưa làm tròn minSpins) ---');
let oldFormulaTotalCases = 0;
let oldFormulaFailedCases = 0;

for (let numSegs = 6; numSegs <= 12; numSegs += 2) {
  for (let target = 0; target < numSegs; target++) {
    for (let duration = 5000; duration <= 19000; duration += 1000) {
      oldFormulaTotalCases++;
      const finalRot = calculateFinalRotation(0, numSegs, target, duration, true);
      const stoppedIndex = getPointerSegmentIndexFromRotation(finalRot, numSegs);
      if (stoppedIndex !== target) {
        oldFormulaFailedCases++;
      }
    }
  }
}

console.log(`Số trường hợp kiểm tra công thức cũ: ${oldFormulaTotalCases}`);
console.log(`Số trường hợp công thức cũ BỊ SAI LỆCH Ô: ${oldFormulaFailedCases} (${((oldFormulaFailedCases / oldFormulaTotalCases) * 100).toFixed(1)}%)`);
assert.ok(oldFormulaFailedCases > 0, 'Công thức cũ phải thất bại trên các thời lượng sinh số lẻ (ví dụ 6s, 7s, 8s)');
console.log('✅ XÁC NHẬN: Công thức cũ chắc chắn gây lệch ô dừng!');

// 2. Kiểm tra công thức MỚI trên TOÀN BỘ không gian tham số (Expected 100% PASS on new formula)
console.log('\n--- BƯỚC 2: Kiểm tra toàn diện công thức MỚI (đã làm tròn minSpins) ---');
let newFormulaTotalCases = 0;
let newFormulaPassedCases = 0;

// Thử nghiệm mọi số ô từ 2 đến 24
for (let numSegs = 2; numSegs <= 24; numSegs++) {
  // Thử nghiệm mọi ô mục tiêu
  for (let target = 0; target < numSegs; target++) {
    // Thử nghiệm các thời lượng nguyên và lẻ từ 5000 đến 19000 ms
    const testDurations = [
      5000, 5234, 6000, 6789, 7000, 7500, 8000, 9123, 10000,
      11456, 12000, 13789, 14000, 15000, 16321, 17000, 18456, 19000
    ];

    for (const duration of testDurations) {
      newFormulaTotalCases++;
      const finalRot = calculateFinalRotation(0, numSegs, target, duration, false);
      const stoppedIndex = getPointerSegmentIndexFromRotation(finalRot, numSegs);

      if (stoppedIndex === target) {
        newFormulaPassedCases++;
      } else {
        console.error(`❌ [THẤT BẠI]: numSegs=${numSegs}, target=${target}, duration=${duration}ms -> stoppedIndex=${stoppedIndex}`);
      }
    }
  }
}

console.log(`Tổng số ca kiểm thử toàn diện: ${newFormulaTotalCases}`);
console.log(`Số ca ĐẠT CHÍNH XÁC 100%: ${newFormulaPassedCases} / ${newFormulaTotalCases}`);
assert.strictEqual(newFormulaPassedCases, newFormulaTotalCases, 'Mọi trường hợp công thức mới phải dừng đúng 100%');
console.log('✅ PASS: Công thức mới đảm bảo kim chỉ chuẩn xác vào tâm ô cho mọi số ô từ 2 đến 24!');

// 3. Kiểm tra nhiều lượt quay liên tiếp nhau (Sequential continuous spins)
console.log('\n--- BƯỚC 3: Kiểm tra 100 lượt quay liên tiếp nối tiếp góc quay cũ ---');
let currentRot = 0;
const numSegments = 8;
let sequentialPassCount = 0;

for (let turn = 1; turn <= 100; turn++) {
  const randomTarget = Math.floor(Math.random() * numSegments);
  const randomDuration = Math.floor(Math.random() * (19000 - 5000 + 1)) + 5000;

  const nextRot = calculateFinalRotation(currentRot, numSegments, randomTarget, randomDuration, false);
  const stoppedSeg = getPointerSegmentIndexFromRotation(nextRot, numSegments);

  assert.strictEqual(stoppedSeg, randomTarget, `Lượt ${turn} quay về ${randomTarget} nhưng kim dừng ở ${stoppedSeg}`);
  sequentialPassCount++;
  currentRot = nextRot; // Lưu góc quay để quay tiếp lượt sau
}

console.log(`✅ PASS: Toàn bộ ${sequentialPassCount}/100 lượt quay liên tiếp đều dừng chuẩn xác ô đích.`);
console.log('\n=================================================================');
console.log('🎉 TOÀN BỘ BÀI TEST TOÁN HỌC GÓC DỪNG [TASK A] ĐÃ PASS 100%!');
console.log('=================================================================\n');
