/**
 * Lucky Wheel SaaS - End-to-End Integration & API Validation Suite
 * Tự động hóa kiểm thử toàn bộ hành trình người dùng:
 * Tạo vòng quay -> Admin cấu hình -> Khách truy cập -> Quay thưởng -> Lịch sử -> Sinh QR Code.
 */

async function runE2ETests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('=================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TÍCH HỢP ĐẦU CUỐI (E2E INTEGRATION TEST)');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS]: ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL]: ${message}`);
      failed++;
    }
  }

  // 1. Tạo vòng quay mới
  console.log('👉 [BƯỚC 1]: Khởi tạo vòng quay cho "Trà Sữa Mimi Premium"...');
  const createRes = await fetch(`${BASE_URL}/api/wheels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Trà Sữa Mimi Premium',
      password: 'MimiStore2026@'
    })
  });
  const createData = await createRes.json();

  assert(createRes.status === 201 && createData.success === true, 'Tạo vòng quay thành công (HTTP 201)');
  assert(createData.wheelId && createData.wheelId.length >= 10, `wheelId ngẫu nhiên khó đoán: "${createData.wheelId}"`);
  assert(createData.token && typeof createData.token === 'string', 'Server cấp phát token JWT quản trị cho chủ cửa hàng');

  const wheelId = createData.wheelId;
  const adminToken = createData.token;

  // 2. Lấy thông tin Admin
  console.log('\n👉 [BƯỚC 2]: Admin truy xuất thông tin vòng quay bằng Token JWT...');
  const adminGetRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminGetData = await adminGetRes.json();

  assert(adminGetRes.status === 200, 'Xác thực Admin JWT thành công (HTTP 200)');
  assert(adminGetData.wheel.name === 'Trà Sữa Mimi Premium', 'Tên cửa hàng khớp dữ liệu đã tạo');
  assert(Array.isArray(adminGetData.wheel.segments) && adminGetData.wheel.segments.length === 6, 'Khởi tạo sẵn 6 ô quà mẫu');
  assert(adminGetData.wheel.segments[0].weight !== undefined, 'Admin có thể thấy trọng số và tỷ lệ %');
  assert(adminGetData.wheel.passwordHash === undefined, 'Admin response không chứa passwordHash');

  // 3. Admin cập nhật cấu hình vòng quay
  console.log('\n👉 [BƯỚC 3]: Admin cập nhật tên, nền Tết, độ mờ 28% và đổi danh sách quà...');
  const newSegments = [
    { id: 'mimi_1', text: 'Ly Trà Sữa Size L Miễn Phí', color: '#EF4444', weight: 15 },
    { id: 'mimi_2', text: 'Giảm 30% Hóa Đơn', color: '#F97316', weight: 25 },
    { id: 'mimi_3', text: 'Tặng 1 Topping Trân Châu', color: '#EAB308', weight: 35 },
    { id: 'mimi_4', text: 'Chúc Quý Khách May Mắn', color: '#64748B', weight: 25 }
  ];

  const updateRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Trà Sữa Mimi - Lễ Hội Rộn Ràng',
      background: 'linear-gradient(135deg, #b71c1c 0%, #ff8f00 100%)',
      backgroundOpacity: 0.28,
      segments: newSegments
    })
  });
  const updateData = await updateRes.json();

  assert(updateRes.status === 200 && updateData.success === true, 'Cập nhật cấu hình vòng quay thành công');

  // 4. Khách hàng truy cập trang vòng quay (Public API)
  console.log('\n👉 [BƯỚC 4]: Khách mở link /?w=' + wheelId + ' - Kiểm tra bảo mật thông tin công khai...');
  const publicRes = await fetch(`${BASE_URL}/api/wheels/${wheelId}`);
  const publicData = await publicRes.json();

  assert(publicRes.status === 200, 'Khách tải thông tin vòng quay thành công');
  assert(publicData.wheel.name === 'Trà Sữa Mimi - Lễ Hội Rộn Ràng', 'Tên vòng quay mới hiển thị chính xác');
  assert(publicData.wheel.backgroundOpacity === 0.28, 'Độ mờ nền chuẩn xác 28%');
  assert(publicData.wheel.segments.length === 4, 'Số ô quà mới cập nhật là 4 ô');

  // KIỂM TRA BẢO MẬT TỐI CAO: Tuyệt đối không có trường weight trong bất kỳ ô nào
  const leakedWeights = publicData.wheel.segments.filter((s) => s.weight !== undefined);
  assert(leakedWeights.length === 0, 'BẢO MẬT CAO: Toàn bộ trọng số được giấu kín tại Server!');

  // 5. Khách hàng thực hiện quay thưởng (Spin API)
  console.log('\n👉 [BƯỚC 5]: Khách hàng bấm quay (POST /api/wheels/:wheelId/spin)...');
  const spinRes = await fetch(`${BASE_URL}/api/wheels/${wheelId}/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const spinData = await spinRes.json();

  assert(spinRes.status === 200 && spinData.success === true, 'Quay may mắn thành công');
  assert(typeof spinData.targetIndex === 'number' && spinData.targetIndex >= 0 && spinData.targetIndex < 4, `Server trả về targetIndex hợp lệ: ${spinData.targetIndex}`);
  assert(spinData.prize && spinData.prize.text, `Giải thưởng trúng: "${spinData.prize.text}"`);
  assert(spinData.prize.weight === undefined, 'Response quay thưởng KHÔNG chứa trọng số hay tỷ lệ');

  // 6. Admin kiểm tra lịch sử quay (Audit History)
  console.log('\n👉 [BƯỚC 6]: Admin kiểm tra lịch sử quay đối soát...');
  const historyRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}/history`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const historyData = await historyRes.json();

  assert(historyRes.status === 200 && Array.isArray(historyData.history), 'Lấy lịch sử quay thành công');
  assert(historyData.history.length >= 1, 'Lượt quay vừa rồi đã được lưu trữ trên server');
  assert(historyData.history[0].prizeText === spinData.prize.text, `Lịch sử ghi nhận chính xác: ${historyData.history[0].prizeText}`);

  // 7. Sinh mã QR chất lượng cao
  console.log('\n👉 [BƯỚC 7]: Sinh mã QR Code cho vòng quay (GET /api/qr/:wheelId)...');
  const qrRes = await fetch(`${BASE_URL}/api/qr/${wheelId}?size=400&color=1e1b4b&bgColor=ffffff`);
  const qrBuffer = await qrRes.arrayBuffer();

  assert(qrRes.status === 200, 'Sinh mã QR thành công (HTTP 200)');
  assert(qrRes.headers.get('content-type') === 'image/png', 'Mã QR xuất ra đúng định dạng PNG');
  assert(qrBuffer.byteLength > 1000, `Dung lượng ảnh QR hợp lệ (${qrBuffer.byteLength} bytes)`);

  // 8. Kiểm tra phòng thủ tấn công trái phép
  console.log('\n👉 [BƯỚC 8]: Thử tấn công trái phép không token và token giả...');
  const noTokenRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`);
  assert(noTokenRes.status === 401, 'Không có Token bị chặn dứt khoát (HTTP 401)');

  const fakeTokenRes = await fetch(`${BASE_URL}/api/admin/wheels/${wheelId}`, {
    headers: { 'Authorization': 'Bearer fake_invalid_jwt_token_123456789' }
  });
  assert(fakeTokenRes.status === 403, 'Token giả mạo bị chặn ngay lập tức (HTTP 403)');

  console.log('\n-----------------------------------------------------------------');
  console.log(`🎯 TỔNG KẾT: ${passed} bài kiểm tra E2E PASS, ${failed} bài FAIL.`);
  if (failed === 0) {
    console.log('🌟 TOÀN BỘ HỆ THỐNG LUCKY WHEEL SAAS HOẠT ĐỘNG HOÀN HẢO 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error('Lỗi kiểm thử E2E:', err);
  process.exit(1);
});
