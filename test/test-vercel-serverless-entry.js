/**
 * Test giả lập Vercel Serverless Function Handler (api/index.js)
 * Đảm bảo mọi API: Tạo vòng quay, Đăng nhập Admin, Lưu cấu hình, Upload logo
 * đều chạy thông suốt khi chạy qua Serverless Function Handler
 */

const assert = require('assert');
const http = require('http');
const handler = require('../api/index');

function createMockServer() {
  return http.createServer((req, res) => {
    // Giả lập header x-matched-path từ Vercel edge rewrite
    if (!req.headers['x-matched-path']) {
      req.headers['x-matched-path'] = req.url;
    }
    handler(req, res);
  });
}

async function testVercelHandler() {
  console.log('=================================================================');
  console.log('☁️ KIỂM THỬ GIẢ LẬP SERVERLESS ENTRYPOINT CỦA VERCEL (api/index.js)');
  console.log('=================================================================\n');

  const server = createMockServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  try {
    // 1. Tạo vòng quay qua Vercel handler
    console.log('👉 [BƯỚC 1]: Test POST /api/wheels qua Serverless Handler...');
    const createRes = await fetch(`${BASE_URL}/api/wheels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-matched-path': '/api/wheels'
      },
      body: JSON.stringify({
        name: 'Tiệm Cà Phê Vercel Test',
        password: 'MatKhauVercel123@'
      })
    });

    const createText = await createRes.text();
    let createData;
    try {
      createData = JSON.parse(createText);
    } catch (e) {
      throw new Error(`Serverless handler không trả về JSON: ${createText}`);
    }

    assert.strictEqual(createRes.status, 201, 'Status code phải là 201');
    assert.strictEqual(createData.success, true);
    assert(createData.wheelId, 'Phải có wheelId');
    const wheelId = createData.wheelId;
    console.log(`✅ [PASS]: Khởi tạo thành công qua Vercel Handler: ${wheelId}`);

    // 2. Đăng nhập Admin qua Vercel handler
    console.log('\n👉 [BƯỚC 2]: Test POST /api/admin/wheels/:id/login qua Serverless Handler...');
    const loginRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-matched-path': `/api/admin/wheels/${wheelId}/login`
      },
      body: JSON.stringify({ password: 'MatKhauVercel123@' })
    });

    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginData.success, true);
    assert(loginData.token, 'Phải trả về token');
    const token = loginData.token;
    console.log('✅ [PASS]: Đăng nhập Admin qua Serverless Handler thành công!');

    // 3. Lưu cấu hình qua Vercel handler (PUT /api/admin/wheels/:id)
    console.log('\n👉 [BƯỚC 3]: Test PUT /api/admin/wheels/:id (Lưu cấu hình)...');
    const updateRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-matched-path': `/api/admin/wheels/${wheelId}`
      },
      body: JSON.stringify({
        name: 'Tiệm Cà Phê Vercel - Đã Lưu Cấu Hình',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundOpacity: 0.28,
        segments: [
          { id: 'seg_1', text: 'Cà phê sữa đá', color: '#8B4513', weight: 50 },
          { id: 'seg_2', text: 'Bạc xỉu đặc biệt', color: '#D2691E', weight: 50 }
        ]
      })
    });

    const updateData = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.success, true);
    assert.strictEqual(updateData.wheel.name, 'Tiệm Cà Phê Vercel - Đã Lưu Cấu Hình');
    console.log('✅ [PASS]: Lưu cấu hình vòng quay thành công qua Serverless Handler!');

    // 4. Test Upload Logo qua Vercel handler (POST /api/admin/wheels/:id/upload)
    console.log('\n👉 [BƯỚC 4]: Test POST /api/admin/wheels/:id/upload (Upload logo)...');
    // Tạo 1 ảnh PNG 1x1 pixel hợp lệ bằng Sharp
    const sharp = require('sharp');
    const testPngBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 255, g: 100, b: 50, alpha: 1 }
      }
    }).png().toBuffer();

    // Dùng FormData gửi multipart/form-data
    const blob = new Blob([testPngBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('image', blob, 'test-logo.png');

    const uploadRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-matched-path': `/api/admin/wheels/${wheelId}/upload`
      },
      body: formData
    });

    const uploadData = await uploadRes.json();
    assert.strictEqual(uploadRes.status, 200);
    assert.strictEqual(uploadData.success, true);
    assert(uploadData.url, 'Phải trả về url ảnh');
    console.log(`✅ [PASS]: Upload logo thành công qua Serverless Handler: ${uploadData.url.slice(0, 35)}...`);

    console.log('\n=================================================================');
    console.log('🎉 TOÀN BỘ CHỨC NĂNG SERVERLESS VERCEL HOẠT ĐỘNG HOÀN HẢO 100%!');
    console.log('=================================================================');
  } finally {
    server.close();
  }
}

testVercelHandler().catch(err => {
  console.error('❌ Lỗi kiểm thử Serverless:', err);
  process.exit(1);
});
