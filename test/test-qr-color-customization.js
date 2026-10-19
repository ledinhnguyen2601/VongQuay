/**
 * Test kiểm tra tùy biến đổi màu sắc QR Code và Lưu cấu hình
 */

const assert = require('assert');

async function testQrColorCustomization() {
  const BASE_URL = 'http://localhost:3000';
  console.log('=================================================================');
  console.log('🎨 KIỂM THỬ TÙY BIẾN ĐỔI MÀU QR CODE & LƯU CẤU HÌNH VÒNG QUAY');
  console.log('=================================================================\n');

  // 1. Tạo vòng quay
  console.log('👉 [BƯỚC 1]: Tạo vòng quay mới...');
  const createRes = await fetch(`${BASE_URL}/api/wheels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tiệm Trà Sữa QR Color Test',
      password: 'MatKhauQrColor123@'
    })
  });
  const createData = await createRes.json();
  assert.strictEqual(createRes.status, 201);
  const wheelId = createData.wheelId;
  const token = createData.token;
  console.log(`✅ [PASS]: Đã tạo vòng quay test: ${wheelId}`);

  // 2. Test đổi màu QR: Đen trên Trắng
  console.log('\n👉 [BƯỚC 2]: Test QR màu chuẩn (Đen trên Trắng)...');
  const qrRes1 = await fetch(`${BASE_URL}/api/qr/${wheelId}?color=000000&bgColor=ffffff&size=600`);
  assert.strictEqual(qrRes1.status, 200);
  assert.strictEqual(qrRes1.headers.get('content-type'), 'image/png');
  const buf1 = Buffer.from(await qrRes1.arrayBuffer());
  assert(buf1[0] === 0x89 && buf1[1] === 0x50 && buf1[2] === 0x4E && buf1[3] === 0x47, 'Phải là file ảnh PNG');
  console.log(`✅ [PASS]: QR Đen/Trắng sinh thành công (${buf1.length} bytes)`);

  // 3. Test đổi màu QR: Đỏ trên Vàng (Màu sắc thương hiệu nổi bật)
  console.log('\n👉 [BƯỚC 3]: Test đổi màu QR (Đỏ #E11D48 trên Vàng #FEF08A)...');
  const qrRes2 = await fetch(`${BASE_URL}/api/qr/${wheelId}?color=E11D48&bgColor=FEF08A&size=600`);
  assert.strictEqual(qrRes2.status, 200);
  assert.strictEqual(qrRes2.headers.get('content-type'), 'image/png');
  const buf2 = Buffer.from(await qrRes2.arrayBuffer());
  assert(buf2[0] === 0x89 && buf2[1] === 0x50 && buf2[2] === 0x4E && buf2[3] === 0x47, 'Phải là file ảnh PNG');
  console.log(`✅ [PASS]: QR Đỏ/Vàng sinh thành công (${buf2.length} bytes)`);

  // 4. Test đổi màu QR: Xanh Neon trên Nền Tối
  console.log('\n👉 [BƯỚC 4]: Test đổi màu QR (Xanh #06B6D4 trên Nền #0F172A)...');
  const qrRes3 = await fetch(`${BASE_URL}/api/qr/${wheelId}?color=06B6D4&bgColor=0F172A&size=600`);
  assert.strictEqual(qrRes3.status, 200);
  assert.strictEqual(qrRes3.headers.get('content-type'), 'image/png');
  const buf3 = Buffer.from(await qrRes3.arrayBuffer());
  assert(buf3[0] === 0x89 && buf3[1] === 0x50 && buf3[2] === 0x4E && buf3[3] === 0x47, 'Phải là file ảnh PNG');
  console.log(`✅ [PASS]: QR Xanh/Tối sinh thành công (${buf3.length} bytes)`);

  // 5. Test QR với wheelId bất kỳ (Khả năng chịu lỗi cao - Không bao giờ trả về 404 làm vỡ ảnh)
  console.log('\n👉 [BƯỚC 5]: Test QR cho wheelId bất kỳ chưa lưu trong memory (Chống vỡ ảnh 100%)...');
  const randomWheelId = 'test_resilient_wheel_999';
  const qrRes4 = await fetch(`${BASE_URL}/api/qr/${randomWheelId}?color=4F46E5&bgColor=FFFFFF&size=600`);
  assert.strictEqual(qrRes4.status, 200, 'Không bao giờ được trả về 404');
  assert.strictEqual(qrRes4.headers.get('content-type'), 'image/png');
  const buf4 = Buffer.from(await qrRes4.arrayBuffer());
  assert(buf4[0] === 0x89 && buf4[1] === 0x50 && buf4[2] === 0x4E && buf4[3] === 0x47, 'Phải là file ảnh PNG hợp lệ');
  console.log(`✅ [PASS]: Mã QR cho link /?w=${randomWheelId} sinh hoàn hảo (${buf4.length} bytes)`);

  // 6. Test Lưu cấu hình (PUT /api/admin/wheels/:id)
  console.log('\n👉 [BƯỚC 6]: Test Lưu cấu hình (PUT /api/admin/wheels/:id)...');
  const putRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Tiệm Trà Sữa LILAK Đã Lưu',
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      backgroundOpacity: 0.25,
      segments: [
        { id: 's1', text: 'Móc Khóa LILAK', color: '#EF4444', weight: 42 },
        { id: 's2', text: 'Giảm 15%', color: '#F97316', weight: 25 },
        { id: 's3', text: 'Giảm 20%', color: '#EAB308', weight: 10 },
        { id: 's4', text: 'Chúc Bạn May Mắn', color: '#64748B', weight: 10 },
        { id: 's5', text: 'Tặng 1 Ly Trà Sữa Nướng', color: '#10B981', weight: 8 },
        { id: 's6', text: 'Tặng 1 Ly Camelia Thượng Hạng', color: '#06B6D4', weight: 5 }
      ]
    })
  });

  const putData = await putRes.json();
  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putData.success, true);
  assert.strictEqual(putData.wheel.name, 'Tiệm Trà Sữa LILAK Đã Lưu');
  console.log('✅ [PASS]: Lưu cấu hình vòng quay thành công 100%!');

  console.log('\n=================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ ĐỔI MÀU QR & LƯU CẤU HÌNH ĐẠT 100% XUẤT SẮC!');
  console.log('=================================================================');
}

testQrColorCustomization().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
