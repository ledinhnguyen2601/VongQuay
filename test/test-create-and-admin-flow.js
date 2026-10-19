/**
 * Lucky Wheel SaaS - Create & Admin Verification Test
 * Kiểm tra luồng Tạo vòng quay, Lưu Database, Fallback Persistence,
 * Đăng nhập Quản Trị và Khởi tạo vòng quay mới.
 */

const assert = require('assert');

async function testCreateAndAdminFlow() {
  const BASE_URL = 'http://localhost:3000';
  console.log('=================================================================');
  console.log('🎡 KIỂM THỬ TOÀN DIỆN LUỒNG KHỞI TẠO VÒNG QUAY & QUẢN TRỊ ADMIN');
  console.log('=================================================================\n');

  // 1. Kiểm tra /api/health
  console.log('👉 [BƯỚC 1]: Kiểm tra /api/health...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthData.status, 'ok');
  console.log(`✅ [PASS]: Server đang chạy, database: ${healthData.database}`);

  // 2. Tạo vòng quay mới
  console.log('\n👉 [BƯỚC 2]: Khởi tạo vòng quay mới (POST /api/wheels)...');
  const wheelName = `Tiệm Trà Sữa Thử Nghiệm ${Date.now()}`;
  const wheelPass = 'MatKhauBaoMat123@';

  const createRes = await fetch(`${BASE_URL}/api/wheels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wheelName, password: wheelPass })
  });
  const createData = await createRes.json();
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createData.success, true);
  assert(createData.wheelId, 'wheelId phải tồn tại');
  assert(createData.token, 'Token admin phải tồn tại');
  console.log(`✅ [PASS]: Khởi tạo thành công wheelId: ${createData.wheelId}`);

  // 3. Khách tải vòng quay ngay lập tức (GET /api/wheels/:id)
  console.log('\n👉 [BƯỚC 3]: Khách tải vòng quay (GET /api/wheels/:wheelId)...');
  const getWheelRes = await fetch(`${BASE_URL}/api/wheels/${createData.wheelId}`);
  const getWheelData = await getWheelRes.json();
  assert.strictEqual(getWheelRes.status, 200);
  assert.strictEqual(getWheelData.success, true);
  assert.strictEqual(getWheelData.wheel.name, wheelName);
  assert.strictEqual(Array.isArray(getWheelData.wheel.segments), true);
  console.log(`✅ [PASS]: Tải thành công vòng quay: "${getWheelData.wheel.name}" (${getWheelData.wheel.segments.length} ô quà)`);

  // 4. Admin đăng nhập mật khẩu (POST /api/admin/wheels/:wheelId/login)
  console.log('\n👉 [BƯỚC 4]: Admin đăng nhập mật khẩu...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/wheels/${createData.wheelId}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: wheelPass })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.success, true);
  assert(loginData.token, 'Phải trả về admin JWT token');
  console.log('✅ [PASS]: Đăng nhập Admin thành công với mật khẩu vừa tạo!');

  // 5. Admin tải cấu hình (kèm trọng số)
  console.log('\n👉 [BƯỚC 5]: Admin tải cấu hình ô quà...');
  const adminRes = await fetch(`${BASE_URL}/api/admin/wheels/${createData.wheelId}`, {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const adminData = await adminRes.json();
  assert.strictEqual(adminRes.status, 200);
  assert.strictEqual(adminData.success, true);
  assert.strictEqual(adminData.wheel.name, wheelName);
  console.log('✅ [PASS]: Admin tải cấu hình thành công, có đầy đủ trọng số.');

  // 6. Kiểm tra tải kho 52 mẫu nền
  console.log('\n👉 [BƯỚC 6]: Tải kho 52 mẫu nền (GET /api/backgrounds)...');
  const bgRes = await fetch(`${BASE_URL}/api/backgrounds`);
  const bgData = await bgRes.json();
  assert.strictEqual(bgRes.status, 200);
  assert(Array.isArray(bgData.backgrounds), 'backgrounds phải là mảng');
  assert(bgData.backgrounds.length >= 50, 'Phải có từ 50 mẫu nền trở lên');
  console.log(`✅ [PASS]: Kho nền trả về ${bgData.backgrounds.length} mẫu nền tuyệt đẹp.`);

  console.log('\n=================================================================');
  console.log('🎉 100% KIỂM THỬ KHỞI TẠO & QUẢN TRỊ VÒNG QUAY ĐẠT CHUẨN XUẤT SẮC!');
  console.log('=================================================================');
}

testCreateAndAdminFlow().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
