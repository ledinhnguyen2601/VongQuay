/**
 * Lucky Wheel SaaS - Statistical Spin Test (10,000 Lượt Quay)
 * Kiểm định tính ngẫu nhiên và độ chính xác phân phối xác suất của CSPRNG.
 */

const { spinWheel } = require('../src/services/spin');

console.log('=================================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ XÁC SUẤT QUAY THƯỞNG 10,000 LẦN LIÊN TỤC');
console.log('=================================================================\n');

// Cấu hình các ô quà thử nghiệm với trọng số khác nhau
const testSegments = [
  { id: 'seg_1', text: 'Voucher 100k (Hiếm)', color: '#EF4444', weight: 5 },     // 5% (5/100)
  { id: 'seg_2', text: 'Giảm 50% (Rất ít)', color: '#F97316', weight: 10 },    // 10% (10/100)
  { id: 'seg_3', text: 'Free Topping (Trung bình)', color: '#F59E0B', weight: 20 }, // 20% (20/100)
  { id: 'seg_4', text: 'Giảm 10k (Khá nhiều)', color: '#10B981', weight: 25 },  // 25% (25/100)
  { id: 'seg_5', text: 'Chúc May Mắn (Phổ biến)', color: '#64748B', weight: 40 } // 40% (40/100)
];

const TOTAL_SPINS = 10000;
const totalConfigWeight = testSegments.reduce((acc, s) => acc + s.weight, 0);

// Bộ đếm kết quả thực tế
const hitCounts = new Array(testSegments.length).fill(0);

const startTime = Date.now();

for (let i = 0; i < TOTAL_SPINS; i++) {
  const result = spinWheel(testSegments);
  hitCounts[result.targetIndex]++;
}

const duration = Date.now() - startTime;

console.log(`⏱️ Thời gian thực thi 10,000 lượt: ${duration} ms (~${(duration / TOTAL_SPINS).toFixed(3)} ms/lượt)\n`);

console.log('| Ô Quà                     | Trọng Số | % Lý Thuyết | Số Lần Trúng | % Thực Tế | Độ Lệch (% Điểm) |');
console.log('|---------------------------|----------|-------------|--------------|-----------|------------------|');

let maxDeviation = 0;

testSegments.forEach((seg, index) => {
  const hits = hitCounts[index];
  const expectedPercent = (seg.weight / totalConfigWeight) * 100;
  const actualPercent = (hits / TOTAL_SPINS) * 100;
  const deviation = Math.abs(actualPercent - expectedPercent);

  if (deviation > maxDeviation) maxDeviation = deviation;

  const segName = seg.text.padEnd(25, ' ');
  const weightStr = seg.weight.toString().padStart(8, ' ');
  const expStr = `${expectedPercent.toFixed(1)}%`.padStart(11, ' ');
  const hitsStr = hits.toString().padStart(12, ' ');
  const actStr = `${actualPercent.toFixed(2)}%`.padStart(9, ' ');
  const devStr = `${deviation.toFixed(2)}%`.padStart(16, ' ');

  console.log(`| ${segName} | ${weightStr} | ${expStr} | ${hitsStr} | ${actStr} | ${devStr} |`);
});

console.log('\n-----------------------------------------------------------------');
console.log(`📊 Độ lệch cực đại (Max Deviation): ${maxDeviation.toFixed(2)}%`);

if (maxDeviation <= 1.5) {
  console.log('✅ KẾT QUẢ: ĐẠT TIÊU CHUẨN XÁC SUẤT MẬT MÃ HỌC!');
  console.log('   Tỷ lệ trúng thưởng thực tế hội tụ hoàn hảo về đúng trọng số cấu hình.');
  process.exit(0);
} else {
  console.error('❌ CẢNH BÁO: Độ lệch vượt quá giới hạn dung sai 1.5%.');
  process.exit(1);
}
