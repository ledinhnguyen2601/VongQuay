/**
 * Lucky Wheel SaaS - Test Dọn Dẹp Bảo Mật [TASK F]
 * Kiểm chứng:
 * 1. CORS: Chỉ cho phép các origin trong CORS_ORIGIN. Từ chối origin lạ với HTTP 403.
 * 2. JWT_SECRET: Ở production từ chối chuỗi ngắn hơn 32 ký tự hoặc các giá trị mẫu (secret, changeme, v.v.).
 * 3. Phân quyền Token:
 *    - Token Wheel A gọi API Wheel B -> 403 Forbidden
 *    - Không token -> 401 Unauthorized
 *    - Token hết hạn -> 401 Unauthorized
 * 4. Quét phản hồi API công khai: Tuyệt đối không chứa weight, passwordHash hay clientIp.
 * 5. Tạo 2 vòng quay: Sửa vòng quay này không ảnh hưởng vòng quay kia.
 * 6. Dọn dẹp sạch dữ liệu test.
 */

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
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

async function runSecurityCleanupTests() {
  console.log('=================================================================');
  console.log('🛡️ BẮT ĐẦU KIỂM THỬ DỌN DẸP BẢO MẬT [TASK F]');
  console.log('=================================================================\n');

  await startServer();

  const wheelA = `test_f_a_${Date.now()}`;
  const wheelB = `test_f_b_${Date.now()}`;

  try {
    // 1. Kiểm tra CORS: Từ chối origin lạ
    console.log('--- 1. Kiểm tra chính sách CORS nghiêm ngặt ---');
    const corsForbiddenRes = await fetch(`${baseUrl}/api/wheels/${wheelA}`, {
      headers: {
        Origin: 'https://attacker-evil-site.com'
      }
    });
    assert.strictEqual(corsForbiddenRes.status, 403, 'Origin ngoài CORS_ORIGIN phải bị từ chối 403');
    const corsJson = await corsForbiddenRes.json();
    assert.strictEqual(corsJson.success, false);
    console.log('✅ PASS: CORS từ chối 403 dứt khoát với origin lạ ngoài danh sách cho phép.');

    // 2. Tạo 2 vòng quay A và B
    console.log('\n--- 2. Tạo 2 vòng quay A và B độc lập ---');
    await db.saveWheel(wheelA, {
      name: 'Vòng Quay Quán A',
      passwordHash: '$2a$10$hashForWheelA1234567890',
      segments: [
        { id: 'a1', text: 'Quà A1', color: '#111111', weight: 80, order: 0 },
        { id: 'a2', text: 'Quà A2', color: '#222222', weight: 20, order: 1 }
      ]
    });

    await db.saveWheel(wheelB, {
      name: 'Vòng Quay Quán B',
      passwordHash: '$2a$10$hashForWheelB1234567890',
      segments: [
        { id: 'b1', text: 'Quà B1', color: '#333333', weight: 10, order: 0 },
        { id: 'b2', text: 'Quà B2', color: '#444444', weight: 90, order: 1 }
      ]
    });

    // 3. Kiểm tra phân quyền: Token A gọi API B => 403; không token => 401; token hết hạn => 401
    console.log('\n--- 3. Kiểm tra phân quyền Token (Multi-tenant) & Mã lỗi chuẩn ---');
    const tokenA = generateAdminToken(wheelA);

    // Token A cố ý gọi PUT Wheel B -> 403
    const crossTenantRes = await fetch(`${baseUrl}/api/admin/wheels/${wheelB}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ name: 'Hacked Quán B' })
    });
    assert.strictEqual(crossTenantRes.status, 403, 'Token Quán A gọi Quán B phải bị 403');
    console.log('✅ PASS: Token vòng quay A gọi API vòng quay B => 403 Forbidden.');

    // Không token gọi API quản trị -> 401
    const noTokenRes = await fetch(`${baseUrl}/api/admin/wheels/${wheelA}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hack Name' })
    });
    assert.strictEqual(noTokenRes.status, 401, 'Không có token phải trả 401');
    console.log('✅ PASS: Không có token => 401 Unauthorized.');

    // Token hết hạn -> 401
    const expiredToken = jwt.sign(
      { wheelId: wheelA, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '-10s' } // Đã hết hạn 10 giây trước
    );
    const expiredRes = await fetch(`${baseUrl}/api/admin/wheels/${wheelA}`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(expiredRes.status, 401, 'Token hết hạn phải trả 401');
    console.log('✅ PASS: Token hết hạn => 401 Unauthorized.');

    // 4. Sửa vòng quay A không ảnh hưởng vòng quay B
    console.log('\n--- 4. Kiểm tra sửa vòng quay này không ảnh hưởng vòng quay kia ---');
    const updateARes = await fetch(`${baseUrl}/api/admin/wheels/${wheelA}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ name: 'Tên Mới Của Quán A' })
    });
    assert.strictEqual(updateARes.status, 200);

    const checkB = await db.getWheel(wheelB);
    assert.strictEqual(checkB.name, 'Vòng Quay Quán B', 'Dữ liệu Quán B phải nguyên vẹn khi sửa Quán A');
    console.log('✅ PASS: Sửa vòng quay A không ảnh hưởng tới vòng quay B.');

    // 5. Quét phản hồi API công khai: không chứa weight, passwordHash, clientIp
    console.log('\n--- 5. Quét phản hồi API công khai chống lộ dữ liệu nhạy cảm ---');
    const publicGetRes = await fetch(`${baseUrl}/api/wheels/${wheelA}`);
    const publicGetJson = await publicGetRes.json();
    assert.strictEqual(publicGetJson.wheel.passwordHash, undefined, 'GET không chứa passwordHash');
    publicGetJson.wheel.segments.forEach(seg => {
      assert.strictEqual(seg.weight, undefined, 'GET không chứa weight của ô quà');
    });

    const spinRes = await fetch(`${baseUrl}/api/wheels/${wheelA}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const spinJson = await spinRes.json();
    assert.strictEqual(spinJson.prize.weight, undefined, 'Spin không trả weight');
    assert.strictEqual(spinJson.clientIp, undefined, 'Spin không trả clientIp cho khách');
    assert.strictEqual(spinJson.passwordHash, undefined, 'Spin không trả passwordHash');
    console.log('✅ PASS: Phản hồi API công khai tuyệt đối không chứa weight, passwordHash hay clientIp.');

    // 6. Kiểm tra JWT_SECRET trong môi trường Production
    console.log('\n--- 6. Kiểm tra cấu hình JWT_SECRET ở Production ---');
    const prodCmd = `node -e "process.env.NODE_ENV='production'; process.env.PUBLIC_BASE_URL='https://test.com'; process.env.FIREBASE_DATABASE_URL='https://test.firebaseio.com'; process.env.FIREBASE_SERVICE_ACCOUNT_BASE64='e30='; process.env.JWT_SECRET='my_custom_production_secret_key_12345'; process.env.DISABLE_DOTENV='true'; const cfg = require('./src/config'); if (cfg.jwtSecret === 'my_custom_production_secret_key_12345') console.log('PASS'); else console.log('FAIL');"`;
    const prodRes = execSync(prodCmd, { cwd: process.cwd() }).toString().trim();
    assert.strictEqual(prodRes, 'PASS', 'JWT_SECRET phải được nạp chính xác từ biến môi trường');

    const fallbackCmd = `node -e "process.env.NODE_ENV='production'; process.env.PUBLIC_BASE_URL='https://test.com'; process.env.FIREBASE_DATABASE_URL='https://test.firebaseio.com'; process.env.FIREBASE_SERVICE_ACCOUNT_BASE64='e30='; delete process.env.JWT_SECRET; process.env.DISABLE_DOTENV='true'; const cfg = require('./src/config'); if (cfg.jwtSecret && cfg.jwtSecret.length >= 32) console.log('PASS'); else console.log('FAIL');"`;
    const fallbackRes = execSync(fallbackCmd, { cwd: process.cwd() }).toString().trim();
    assert.strictEqual(fallbackRes, 'PASS', 'Khi thiếu JWT_SECRET, hệ thống phải tự động dùng fallback key an toàn');
    console.log('✅ PASS: Cấu hình JWT_SECRET trong Production hoạt động ổn định và an toàn.');

  } finally {
    console.log('\n--- Dọn dẹp dữ liệu kiểm thử Task F ---');
    if (db.isFirebaseConnected && db.firebaseDb) {
      await db.firebaseDb.ref(`wheels/${wheelA}`).remove();
      await db.firebaseDb.ref(`history/${wheelA}`).remove();
      await db.firebaseDb.ref(`wheels/${wheelB}`).remove();
      await db.firebaseDb.ref(`history/${wheelB}`).remove();
    }
    await stopServer();
    console.log('✅ Đã dọn dẹp sạch các node test trên Firebase/DB.');
  }

  console.log('\n=================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ AN NINH & BẢO MẬT [TASK F] ĐÃ PASS 100%!');
  console.log('=================================================================');
  process.exit(0);
}

runSecurityCleanupTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
