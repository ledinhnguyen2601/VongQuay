/**
 * Lucky Wheel SaaS - Kiểm tra Tỉ Lệ Trúng Thật & Đối Soát Giải [H]
 * 1. Gọi hàm bốc thăm thật (CSPRNG crypto.randomInt) 5,000 lượt.
 * 2. So sánh tần suất thực tế với trọng số cấu hình, tính toán độ lệch cực đại.
 * 3. Gọi API POST /api/wheels/:wheelId/spin trên server cục bộ với vòng quay thật trong DB.
 * 4. Xác nhận thứ tự ô trả về cho khách (GET /api/wheels/:wheelId) khớp chính xác 100% với thứ tự dùng để bốc thăm.
 * 5. Xác nhận history trong DB lưu đúng giải do server bốc (không phụ thuộc client).
 * 6. Dọn dẹp dữ liệu test.
 */

const assert = require('assert');
const http = require('http');
const app = require('../server');
const db = require('../src/db');
const { spinWheel } = require('../src/services/spin');

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function runRealDistributionTest() {
  console.log('=================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM ĐỊNH TỈ LỆ TRÚNG THƯỞNG THỰC TẾ & ĐỐI SOÁT [TASK H]');
  console.log('=================================================================\n');

  // Mảng ô quà với trọng số phân cấp thực tế
  const testSegments = [
    { id: 'seg_gold', text: 'Giải Nhất: iPhone 16 Pro', color: '#EF4444', weight: 5, order: 0 },    // 5%
    { id: 'seg_silver', text: 'Giải Nhì: Tai nghe Sony', color: '#F97316', weight: 15, order: 1 },  // 15%
    { id: 'seg_bronze', text: 'Giải Ba: Voucher 100k', color: '#F59E0B', weight: 20, order: 2 },   // 20%
    { id: 'seg_thanks', text: 'Chúc May Mắn Lần Sau', color: '#64748B', weight: 35, order: 3 },   // 35%
    { id: 'seg_voucher', text: 'Giảm 10% Hóa Đơn', color: '#10B981', weight: 25, order: 4 }      // 25%
  ];

  const TOTAL_TEST_SPINS = 5000;
  const totalWeight = testSegments.reduce((acc, s) => acc + s.weight, 0);

  // 1. Kiểm tra 5,000 lượt quay với thuật toán spinWheel
  console.log(`--- BƯỚC 1: Mô phỏng bốc thăm ${TOTAL_TEST_SPINS.toLocaleString()} lượt bằng thuật toán crypto thật ---`);
  const hitCounts = new Array(testSegments.length).fill(0);
  const startTime = Date.now();

  for (let i = 0; i < TOTAL_TEST_SPINS; i++) {
    const res = spinWheel(testSegments);
    hitCounts[res.targetIndex]++;
  }

  const durationMs = Date.now() - startTime;
  console.log(`⏱️ Thời gian thực thi ${TOTAL_TEST_SPINS} lượt: ${durationMs} ms (~${(durationMs / TOTAL_TEST_SPINS).toFixed(3)} ms/lượt)\n`);

  console.log('| Ô Quà                     | Trọng Số | % Lý Thuyết | Số Lần Trúng | % Thực Tế | Độ Lệch (% Điểm) |');
  console.log('|---------------------------|----------|-------------|--------------|-----------|------------------|');

  let maxDeviation = 0;
  testSegments.forEach((seg, index) => {
    const hits = hitCounts[index];
    const expectedPercent = (seg.weight / totalWeight) * 100;
    const actualPercent = (hits / TOTAL_TEST_SPINS) * 100;
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

  console.log('-----------------------------------------------------------------');
  console.log(`📊 Độ lệch cực đại (Max Deviation): ${maxDeviation.toFixed(2)}%`);
  assert.ok(maxDeviation <= 2.5, `Độ lệch ${maxDeviation.toFixed(2)}% phải nằm trong dung sai cho phép (<= 2.5% cho 5000 lượt)`);
  console.log('✅ PASS: Phân phối xác suất 5,000 lượt hội tụ chính xác về đúng trọng số cấu hình.\n');

  // 2. Kiểm tra trên server cục bộ và đối soát History
  console.log('--- BƯỚC 2: Kiểm tra qua API Server cục bộ & Đối soát bản ghi History ---');
  await startServer();

  const testWheelId = `test_h_${Date.now()}`;
  try {
    // Tạo vòng quay thử nghiệm trong DB
    await db.saveWheel(testWheelId, {
      name: 'Vòng Quay Đối Soát Xác Suất H',
      segments: testSegments,
      createdAt: new Date().toISOString()
    });

    // Gọi GET /api/wheels/:wheelId và kiểm tra thứ tự ô
    const getRes = await fetch(`${baseUrl}/api/wheels/${testWheelId}`);
    assert.strictEqual(getRes.status, 200);
    const getJson = await getRes.json();
    assert.strictEqual(getJson.success, true);
    
    // Kiểm tra thứ tự ô công khai khớp 100% với testSegments
    assert.strictEqual(getJson.wheel.segments.length, testSegments.length);
    for (let i = 0; i < testSegments.length; i++) {
      assert.strictEqual(getJson.wheel.segments[i].id, testSegments[i].id);
      assert.strictEqual(getJson.wheel.segments[i].text, testSegments[i].text);
      assert.strictEqual(getJson.wheel.segments[i].order, testSegments[i].order);
    }
    console.log('✅ PASS: Thứ tự các ô quà trả về cho khách (GET /api/wheels/:id) khớp 100% với thứ tự dùng bốc thăm.');

    // Gọi quay 20 lượt qua API và đối soát từng lượt với History trong DB
    console.log('\n--- BƯỚC 3: Đối soát 20 lượt quay API với bản ghi database ---');
    for (let spinCount = 1; spinCount <= 20; spinCount++) {
      const spinRes = await fetch(`${baseUrl}/api/wheels/${testWheelId}/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      assert.strictEqual(spinRes.status, 200);
      const spinData = await spinRes.json();
      assert.strictEqual(spinData.success, true);

      // Giải server trả về
      const serverPrize = spinData.prize;
      const targetIndex = spinData.targetIndex;

      // Kiểm tra index khớp với ô trong mảng
      assert.strictEqual(testSegments[targetIndex].id, serverPrize.id);
      assert.strictEqual(testSegments[targetIndex].text, serverPrize.text);

      // Đọc lịch sử từ DB
      const historyList = await db.getSpinHistory(testWheelId, 1);
      assert.ok(historyList && historyList.length > 0, 'Phải có bản ghi history');
      const latestRecord = historyList[0];

      // ĐỐI SOÁT: History phải lưu ĐÚNG giải server bốc
      assert.strictEqual(latestRecord.prizeText, serverPrize.text, 'prizeText trong history phải khớp serverPrize.text');
      assert.strictEqual(latestRecord.segmentId, serverPrize.id, 'segmentId trong history phải khớp serverPrize.id');
      assert.strictEqual(latestRecord.targetIndex, targetIndex, 'targetIndex trong history phải khớp targetIndex');
      assert.ok(latestRecord.clientIp, 'History phải có clientIp');
    }
    console.log('✅ PASS: Toàn bộ 20 lượt quay API đều lưu chính xác 100% giải server bốc vào history database (chống gian lận phía client).');

  } finally {
    console.log('\n--- Dọn dẹp dữ liệu kiểm thử Task H ---');
    if (db.isFirebaseConnected && db.firebaseDb) {
      await db.firebaseDb.ref(`wheels/${testWheelId}`).remove();
      await db.firebaseDb.ref(`history/${testWheelId}`).remove();
    }
    await stopServer();
    console.log('✅ Đã dọn dẹp sạch node test trên Firebase/DB.');
  }

  console.log('\n=================================================================');
  console.log('🎉 TOÀN BỘ KIỂM ĐỊNH TỈ LỆ TRÚNG THƯỞNG [TASK H] ĐÃ PASS 100%!');
  console.log('=================================================================');
  process.exit(0);
}

runRealDistributionTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
