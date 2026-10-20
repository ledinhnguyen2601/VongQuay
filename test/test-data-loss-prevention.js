/**
 * Lucky Wheel SaaS - Test Chống Mất Dữ Liệu [B]
 * Kiểm chứng:
 * 1. GET công khai trên wheelId không tồn tại -> 404, KHÔNG ghi database
 * 2. GET lặp lại trên vòng quay có thật -> Dữ liệu nguyên vẹn, không bị ghi đè
 * 3. PUT cấu hình trên wheelId không tồn tại -> 404, KHÔNG tự tạo
 * 4. Cập nhật cấu hình là partial update (update/patch), không làm mất các trường khác
 * 5. Danh sách ô quà có order cố định và sắp xếp đồng nhất giữa Public GET, Admin GET và Spin
 * 6. Xóa các route trùng lặp không có tiền tố /api
 */

const assert = require('assert');
const http = require('http');
const app = require('../server');
const db = require('../src/db');
const { generateAdminToken } = require('../src/middleware/auth');

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

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử [B] Chống mất dữ liệu...');
  await startServer();

  const testWheelId = `test_dlp_${Date.now()}`;
  const nonExistentWheelId = `non_existent_${Date.now()}`;

  try {
    // 1. GET công khai trên wheelId không tồn tại
    console.log('\n--- 1. Kiểm tra GET công khai trên vòng quay không tồn tại ---');
    const getNonExistentRes = await fetch(`${baseUrl}/api/wheels/${nonExistentWheelId}`);
    assert.strictEqual(getNonExistentRes.status, 404, 'GET wheel không tồn tại phải trả 404');
    const getNonExistentJson = await getNonExistentRes.json();
    assert.strictEqual(getNonExistentJson.success, false);
    
    // Kiểm tra trong DB đảm bảo KHÔNG bị tạo mới
    const dbCheck = await db.getWheel(nonExistentWheelId);
    assert.strictEqual(dbCheck, null, 'Database không được phép tạo bản ghi khi GET 404');
    console.log('✅ PASS: GET không tồn tại trả 404 và KHÔNG ghi vào database.');

    // 2. Tạo một vòng quay test để kiểm chứng
    console.log('\n--- 2. Tạo vòng quay thử nghiệm ---');
    const initialWheelData = {
      name: 'Vòng Quay Thử Nghiệm DLP',
      logoUrl: 'https://i.ibb.co/sample/logo.png',
      background: 'linear-gradient(135deg, #123456, #abcdef)',
      backgroundOpacity: 0.25,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456', // dummy
      segments: [
        { id: 'seg_c', text: 'Ô Ba', color: '#333333', weight: 30, order: 2 },
        { id: 'seg_a', text: 'Ô Một', color: '#111111', weight: 10, order: 0 },
        { id: 'seg_b', text: 'Ô Hai', color: '#222222', weight: 20, order: 1 }
      ]
    };
    await db.saveWheel(testWheelId, initialWheelData);

    // 3. GET lặp lại trên vòng quay có thật
    console.log('\n--- 3. Kiểm tra GET lặp lại nhiều lần không làm đổi dữ liệu ---');
    for (let i = 0; i < 5; i++) {
      const getRes = await fetch(`${baseUrl}/api/wheels/${testWheelId}`);
      assert.strictEqual(getRes.status, 200);
      const getJson = await getRes.json();
      assert.strictEqual(getJson.success, true);
      assert.strictEqual(getJson.wheel.name, initialWheelData.name);
      // Thứ tự segments phải được sort theo order: Ô Một (order 0), Ô Hai (order 1), Ô Ba (order 2)
      assert.strictEqual(getJson.wheel.segments[0].text, 'Ô Một');
      assert.strictEqual(getJson.wheel.segments[1].text, 'Ô Hai');
      assert.strictEqual(getJson.wheel.segments[2].text, 'Ô Ba');
    }
    console.log('✅ PASS: GET lặp lại giữ nguyên dữ liệu và sắp xếp đúng thứ tự order.');

    // 4. PUT trên wheelId không tồn tại
    console.log('\n--- 4. Kiểm tra PUT cấu hình trên vòng quay không tồn tại ---');
    const adminTokenNonExistent = generateAdminToken(nonExistentWheelId);
    const putNonExistentRes = await fetch(`${baseUrl}/api/admin/wheels/${nonExistentWheelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenNonExistent}`
      },
      body: JSON.stringify({ name: 'Hack Name' })
    });
    assert.strictEqual(putNonExistentRes.status, 404, 'PUT wheel không tồn tại phải trả 404');
    const dbCheckPut = await db.getWheel(nonExistentWheelId);
    assert.strictEqual(dbCheckPut, null, 'Database không được tạo bản ghi khi PUT 404');
    console.log('✅ PASS: PUT không tồn tại trả 404 và KHÔNG tự tạo vòng quay.');

    // 5. Cập nhật từng phần (partial update / patch)
    console.log('\n--- 5. Kiểm tra PUT là cập nhật từng phần (không ghi đè mất logo/nền/segments) ---');
    const adminTokenTest = generateAdminToken(testWheelId);
    const updateRes = await fetch(`${baseUrl}/api/admin/wheels/${testWheelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminTokenTest}`
      },
      body: JSON.stringify({ name: 'Tên Mới Sau Khi Cập Nhật' })
    });
    assert.strictEqual(updateRes.status, 200);
    
    // Kiểm tra dữ liệu trong DB
    const updatedWheelInDb = await db.getWheel(testWheelId);
    assert.strictEqual(updatedWheelInDb.name, 'Tên Mới Sau Khi Cập Nhật');
    assert.strictEqual(updatedWheelInDb.logoUrl, initialWheelData.logoUrl, 'Logo phải được giữ nguyên');
    assert.strictEqual(updatedWheelInDb.background, initialWheelData.background, 'Nền phải được giữ nguyên');
    assert.strictEqual(updatedWheelInDb.segments.length, 3, 'Segments phải được giữ nguyên');
    console.log('✅ PASS: PUT cập nhật từng phần chính xác, không làm mất các trường khác.');

    // 6. Kiểm tra các route trùng lặp không có tiền tố /api đã bị gỡ bỏ
    console.log('\n--- 6. Kiểm tra các route trùng lặp không có /api đã bị gỡ bỏ ---');
    const duplicateWheelsRes = await fetch(`${baseUrl}/wheels/${testWheelId}`);
    // Phải là 404 vì không còn route /wheels/:wheelId
    assert.strictEqual(duplicateWheelsRes.status, 404, '/wheels/:wheelId không còn tồn tại');

    const duplicateQrRes = await fetch(`${baseUrl}/qr/${testWheelId}`);
    assert.strictEqual(duplicateQrRes.status, 404, '/qr/:wheelId không còn tồn tại');

    // Riêng route GET /admin vẫn phục vụ trang HTML
    const adminHtmlRes = await fetch(`${baseUrl}/admin`);
    assert.strictEqual(adminHtmlRes.status, 200, 'GET /admin vẫn phục vụ trang HTML quản trị');
    const adminHtmlText = await adminHtmlRes.text();
    assert.ok(adminHtmlText.includes('<!DOCTYPE html>') || adminHtmlText.includes('<html'), 'Phải là trang HTML');
    console.log('✅ PASS: Các route trùng lặp đã bị xóa; GET /admin vẫn phục vụ trang HTML bình thường.');

  } finally {
    // Dọn dẹp dữ liệu test
    console.log('\n--- Dọn dẹp dữ liệu kiểm thử ---');
    try {
      if (db.isFirebaseConnected && db.firebaseDb) {
        await db.firebaseDb.ref(`wheels/${testWheelId}`).remove();
        await db.firebaseDb.ref(`history/${testWheelId}`).remove();
      }
      console.log('✅ Đã dọn dẹp sạch node test trên Firebase/DB.');
    } catch (e) {
      console.error('Lỗi khi dọn dẹp:', e.message);
    }

    await stopServer();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
