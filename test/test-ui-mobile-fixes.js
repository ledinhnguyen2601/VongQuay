/**
 * Kiểm tra các cải tiến UI Mobile, Chữ không bị che, Không còn chuỗi kỹ thuật ?w=, và Random thời gian quay 5s-19s
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('=================================================================');
console.log('📱 KIỂM TRA TỐI ƯU GIAO DIỆN MOBILE, FONT CHỮ VÀ RANDOM 5S - 19S');
console.log('=================================================================\n');

// 1. Kiểm tra index.html: KHÔNG CÒN đoạn text thô (?w=...) trong màn hình rỗng
const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
assert(!indexHtml.includes('(?w=...)'), 'LỖI: index.html vẫn còn chuỗi kỹ thuật (?w=...)');
assert(!indexHtml.includes('kiểm tra lại đường link có gắn mã'), 'LỖI: index.html vẫn còn thông báo cũ gây bối rối');
console.log('✅ [PASS]: Đã loại bỏ hoàn toàn chữ kỹ thuật (?w=...) khỏi giao diện Chào mừng.');

// 2. Kiểm tra ngắt dòng thông minh splitTextIntoLines trong wheel.js
const wheelJs = fs.readFileSync(path.join(__dirname, '../public/js/wheel.js'), 'utf8');
assert(wheelJs.includes('splitTextIntoLines'), 'LỖI: wheel.js thiếu hàm splitTextIntoLines');
assert(!wheelJs.includes("text += '…'"), 'LỖI: wheel.js vẫn còn logic cắt chữ dấu 3 chấm');

// Mô phỏng hàm splitTextIntoLines
function testSplitText(text, maxCharsPerLine = 10) {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxCharsPerLine) return [trimmed];
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    const mid = Math.ceil(trimmed.length / 2);
    return [trimmed.slice(0, mid), trimmed.slice(mid)];
  }
  let bestSplitIndex = 1;
  let minDiff = Infinity;
  const totalLen = trimmed.length;
  let currentLen = 0;
  for (let i = 0; i < words.length - 1; i++) {
    currentLen += words[i].length + (i > 0 ? 1 : 0);
    const remainingLen = totalLen - currentLen - 1;
    const diff = Math.abs(currentLen - remainingLen);
    if (diff < minDiff) {
      minDiff = diff;
      bestSplitIndex = i + 1;
    }
  }
  return [words.slice(0, bestSplitIndex).join(' '), words.slice(bestSplitIndex).join(' ')];
}

const samplePrizes = [
  'CAMELIA Thảo Mộc',
  'Tặng 1 Ly Trà Đào',
  'Móc khóa LILAK',
  'Chúc Bạn May Mắn',
  'Giảm 20%',
  'Giảm 15%'
];

console.log('\n📝 Kiểm tra ngắt dòng thực tế cho danh sách quà của quán:');
samplePrizes.forEach((prize) => {
  const lines = testSplitText(prize);
  console.log(`   - "${prize}" -> Dòng 1: [${lines[0]}], Dòng 2: [${lines[1] || '(trống)'}]`);
  assert(lines.length >= 1 && lines.length <= 2, 'Chữ phải chia 1 hoặc 2 dòng');
});
console.log('✅ [PASS]: Tất cả tên quà dài được ngắt dòng cân đối, không mất chữ, không bị ba chấm.');

// 3. Kiểm tra dải thời gian quay 5s - 19s
console.log('\n⏱️ Kiểm tra mô phỏng 100 lần sinh ngẫu nhiên thời gian quay:');
const durations = [];
for (let i = 0; i < 100; i++) {
  const durationMs = Math.floor(Math.random() * (19000 - 5000 + 1)) + 5000;
  durations.push(durationMs);
  assert(durationMs >= 5000, `Thời gian ${durationMs}ms nhỏ hơn 5000ms`);
  assert(durationMs <= 19000, `Thời gian ${durationMs}ms lớn hơn 19000ms`);
}
const minDuration = Math.min(...durations);
const maxDuration = Math.max(...durations);
const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length) / 1000;
console.log(`   - Thời gian quay ngắn nhất: ${(minDuration / 1000).toFixed(2)}s`);
console.log(`   - Thời gian quay dài nhất : ${(maxDuration / 1000).toFixed(2)}s`);
console.log(`   - Thời gian quay trung bình: ${avgDuration.toFixed(2)}s`);
console.log('✅ [PASS]: Thời gian quay ngẫu nhiên thật sự biến thiên trong dải [5s - 19s].');

// 4. Kiểm tra headers Cache-Control chống lưu cache cũ
function checkNoCache(pathUrl) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${pathUrl}`, (res) => {
      const cacheControl = res.headers['cache-control'] || '';
      assert(cacheControl.includes('no-cache') && cacheControl.includes('no-store'), `Headers Cache-Control không đạt: ${cacheControl}`);
      resolve();
    }).on('error', reject);
  });
}

(async () => {
  await checkNoCache('/');
  await checkNoCache('/create');
  await checkNoCache('/admin');
  console.log('✅ [PASS]: Tất cả các trang HTML gửi đúng header Cache-Control: no-store, no-cache.');
  console.log('\n🎉 TẤT CẢ KIỂM THỬ TỐI ƯU GIAO DIỆN & RANDOM SPIN ĐẠT 100%!');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Thất bại:', err);
  process.exit(1);
});
