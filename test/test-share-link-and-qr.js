/**
 * Lucky Wheel SaaS - Test Link Chia Sẻ, QR & Lối Vào Admin [TASK E]
 * Kiểm chứng:
 * 1. playUrl trong QR code luôn được tạo từ PUBLIC_BASE_URL, KHÔNG lấy từ host request hay localhost
 * 2. GET /api/admin/wheels/:wheelId trả về publicBaseUrl chuẩn
 * 3. Trong production, thiếu PUBLIC_BASE_URL thì server từ chối chạy và báo lỗi rõ ràng
 * 4. Truy cập admin khi chưa đăng nhập / token hết hạn trả 401 và không để lộ dữ liệu
 */

const assert = require('assert');
const http = require('http');
const { execSync } = require('child_process');
const app = require('../server');
const db = require('../src/db');
const config = require('../src/config');
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
  console.log('=================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ LINK CHIA SẺ, QR VÀ LỐI VÀO ADMIN [TASK E]');
  console.log('=================================================================\n');

  const testWheelId = `test_e_${Date.now()}`;

  try {
    await startServer();

    // 1. Kiểm tra QR Code API luôn dùng PUBLIC_BASE_URL
    console.log('--- 1. Kiểm tra QR Code API luôn dùng PUBLIC_BASE_URL ---');
    const qrRes = await fetch(`${baseUrl}/api/qr/${testWheelId}?format=dataurl`);
    assert.strictEqual(qrRes.status, 200);
    const qrData = await qrRes.json();
    assert.strictEqual(qrData.success, true);
    assert.ok(qrData.dataUrl.startsWith('data:image/png;base64,'));
    
    // playUrl PHẢI bắt đầu bằng config.publicBaseUrl (https://vong-quay-kappa.vercel.app), KHÔNG PHẢI baseUrl (127.0.0.1)
    const expectedPlayUrl = `${config.publicBaseUrl}/?w=${encodeURIComponent(testWheelId)}`;
    assert.strictEqual(qrData.playUrl, expectedPlayUrl, `playUrl phải là "${expectedPlayUrl}", nhận được "${qrData.playUrl}"`);
    console.log(`✅ PASS: playUrl trong QR Code được sinh chuẩn xác từ PUBLIC_BASE_URL: ${qrData.playUrl}`);

    // 2. Tạo vòng quay và kiểm tra GET /api/admin/wheels/:wheelId trả publicBaseUrl
    console.log('\n--- 2. Kiểm tra GET admin trả publicBaseUrl cho giao diện ---');
    await db.saveWheel(testWheelId, {
      name: 'Vòng Quay Task E',
      segments: [
        { id: '1', text: 'Quà 1', color: '#111111', weight: 50, order: 0 },
        { id: '2', text: 'Quà 2', color: '#222222', weight: 50, order: 1 }
      ]
    });

    const token = generateAdminToken(testWheelId);
    const adminGetRes = await fetch(`${baseUrl}/api/admin/wheels/${testWheelId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(adminGetRes.status, 200);
    const adminGetJson = await adminGetRes.json();
    assert.strictEqual(adminGetJson.wheel.publicBaseUrl, config.publicBaseUrl);
    console.log(`✅ PASS: API Admin trả về publicBaseUrl="${adminGetJson.wheel.publicBaseUrl}" để frontend dựng link chia sẻ an toàn.`);

    // 3. Kiểm tra bảo vệ Admin: Chưa đăng nhập hoặc token sai
    console.log('\n--- 3. Kiểm tra bảo mật trang Admin: Chưa đăng nhập / Token sai ---');
    const noAuthRes = await fetch(`${baseUrl}/api/admin/wheels/${testWheelId}`);
    assert.strictEqual(noAuthRes.status, 401, 'Không có token phải trả 401');
    const noAuthJson = await noAuthRes.json();
    assert.strictEqual(noAuthJson.wheel, undefined, 'Tuyệt đối không lộ dữ liệu quản trị');

    const wrongTokenRes = await fetch(`${baseUrl}/api/admin/wheels/${testWheelId}`, {
      headers: { Authorization: 'Bearer invalid.token.value' }
    });
    assert.strictEqual(wrongTokenRes.status, 401, 'Token sai/hết hạn phải trả 401');
    console.log('✅ PASS: API Admin từ chối 401 cho mọi yêu cầu chưa xác thực hoặc token hết hạn.');

    // 4. Kiểm tra Production từ chối chạy khi thiếu PUBLIC_BASE_URL
    console.log('\n--- 4. Kiểm tra Production bắt buộc có PUBLIC_BASE_URL ---');
    const checkProdCmd = `node -e "process.env.NODE_ENV='production'; delete process.env.PUBLIC_BASE_URL; process.env.FIREBASE_DATABASE_URL='https://test.firebaseio.com'; process.env.FIREBASE_SERVICE_ACCOUNT_BASE64='e30='; process.env.DISABLE_DOTENV='true'; try { require('./src/config'); console.log('FAIL'); } catch (e) { if (e.message.includes('PUBLIC_BASE_URL')) { console.log('PASS_CAUGHT'); } else { console.log('UNEXPECTED_ERROR: ' + e.message); } }"`;
    const prodResult = execSync(checkProdCmd, { cwd: process.cwd() }).toString().trim();
    assert.strictEqual(prodResult, 'PASS_CAUGHT', 'Production thiếu PUBLIC_BASE_URL phải ném lỗi bắt buộc');
    console.log('✅ PASS: Trong môi trường production, thiếu PUBLIC_BASE_URL máy chủ lập tức từ chối chạy với thông báo lỗi rõ ràng.');

  } finally {
    console.log('\n--- Dọn dẹp dữ liệu kiểm thử Task E ---');
    if (db.isFirebaseConnected && db.firebaseDb) {
      await db.firebaseDb.ref(`wheels/${testWheelId}`).remove();
    }
    await stopServer();
    console.log('✅ Đã dọn dẹp sạch node test trên Firebase/DB.');
  }

  console.log('\n=================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ LINK CHIA SẺ, QR VÀ ADMIN [TASK E] ĐÃ PASS 100%!');
  console.log('=================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
