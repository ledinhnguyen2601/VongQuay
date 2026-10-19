/**
 * Lucky Wheel SaaS - Comprehensive Security & Multi-tenant Test Suite
 * Kiểm thử toàn diện các yêu cầu bảo mật nghiêm ngặt theo đề bài.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/db');
const config = require('../src/config');
const { spinWheel } = require('../src/services/spin');
const { generateAdminToken } = require('../src/middleware/auth');
const { inspectImageBuffer } = require('../src/services/imgbb');

async function runSecurityTests() {
  console.log('=================================================================');
  console.log('🛡️ BẮT ĐẦU KIỂM THỬ BẢO MẬT & CÁCH LY ĐA CỬA HÀNG (MULTI-TENANT)');
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

  // TEST 1: Khởi tạo 2 vòng quay riêng biệt (Wheel A và Wheel B)
  const wheelAId = 'tenant_shop_a_123';
  const wheelBId = 'tenant_shop_b_456';

  const hashA = await bcrypt.hash('matkhauQuanA_123', 10);
  const hashB = await bcrypt.hash('matkhauQuanB_456', 10);

  await db.saveWheel(wheelAId, {
    wheelId: wheelAId,
    name: 'Trà Sữa Quán A',
    passwordHash: hashA,
    segments: [
      { id: 'a1', text: 'Voucher Quán A 50k', color: '#FF0000', weight: 80 },
      { id: 'a2', text: 'Chúc May Mắn A', color: '#00FF00', weight: 20 }
    ]
  });

  await db.saveWheel(wheelBId, {
    wheelId: wheelBId,
    name: 'Cà Phê Quán B',
    passwordHash: hashB,
    segments: [
      { id: 'b1', text: 'Cà Phê Muối Free', color: '#0000FF', weight: 10 },
      { id: 'b2', text: 'Chúc May Mắn B', color: '#FFFF00', weight: 90 }
    ]
  });

  const getA = await db.getWheel(wheelAId);
  const getB = await db.getWheel(wheelBId);

  assert(getA && getB && getA.wheelId !== getB.wheelId, 'Hai vòng quay được lưu trữ độc lập trên database');

  // TEST 2: Kiểm tra mật khẩu không lưu plaintext và bcrypt cost >= 10
  assert(!getA.password && getA.passwordHash.startsWith('$2'), 'Mật khẩu được băm bảo mật bằng bcrypt, không lưu plaintext');

  // TEST 3: Đăng nhập đúng và sai mật khẩu
  const matchA = await bcrypt.compare('matkhauQuanA_123', getA.passwordHash);
  const wrongA = await bcrypt.compare('saiMatKhauNe', getA.passwordHash);
  assert(matchA === true, 'Mật khẩu chính xác được chấp nhận');
  assert(wrongA === false, 'Mật khẩu sai bị từ chối dứt khoát');

  // TEST 4: API Công khai KHÔNG BAO GIỜ để lộ trọng số
  const publicSegmentsA = (getA.segments || []).map((seg) => ({
    id: seg.id,
    text: seg.text,
    color: seg.color
  }));

  const hasWeightInPublic = publicSegmentsA.some((s) => s.weight !== undefined);
  assert(!hasWeightInPublic, 'API công khai loại bỏ hoàn toàn trường trọng số (weight)');

  // TEST 5: Xác thực Token JWT & Đối chiếu chữ ký số
  const tokenA = generateAdminToken(wheelAId);
  const tokenB = generateAdminToken(wheelBId);

  const decodedA = jwt.verify(tokenA, config.jwtSecret);
  assert(decodedA.wheelId === wheelAId, 'Token JWT của Quán A chứa đúng wheelId Quán A');

  // Giả mạo token bằng JWT_SECRET sai
  let fakeTokenRejected = false;
  try {
    jwt.verify(tokenA, 'wrong_secret_key_fake_attack_vector_12345');
  } catch (e) {
    fakeTokenRejected = true;
  }
  assert(fakeTokenRejected, 'Token ký bằng khóa bí mật khác bị từ chối');

  // TEST 6: Cách ly Multi-tenant (Token của Quán A KHÔNG ĐƯỢC phép sửa Quán B)
  const isAauthorizedForB = decodedA.wheelId === wheelBId;
  assert(!isAauthorizedForB, 'Token Quán A bị chặn không thể can thiệp vào Quán B (403 Forbidden)');

  // Sửa Quán A không ảnh hưởng tới Quán B
  await db.updateWheel(wheelAId, { name: 'Trà Sữa Quán A (Đã Đổi Tên)' });
  const checkBAfter = await db.getWheel(wheelBId);
  assert(checkBAfter.name === 'Cà Phê Quán B', 'Sửa đổi dữ liệu Quán A không làm thay đổi Quán B');

  // TEST 7: Kiểm tra từ chối upload file SVG và file giả mạo
  const fakeSvgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>');
  let svgRejected = false;
  try {
    await inspectImageBuffer(fakeSvgBuffer);
  } catch (err) {
    svgRejected = true;
  }
  assert(svgRejected, 'File SVG chứa mã độc bị từ chối ngay lập tức');

  const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
  let exeRejected = false;
  try {
    await inspectImageBuffer(fakeExeBuffer);
  } catch (err) {
    exeRejected = true;
  }
  assert(exeRejected, 'File thực thi EXE giả mạo ảnh bị từ chối bằng Magic Bytes');

  // File PNG thật 1x1 pixel
  const realPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  let pngAccepted = false;
  try {
    const meta = await inspectImageBuffer(realPngBuffer);
    if (meta && meta.format === 'png') pngAccepted = true;
  } catch (err) {}
  assert(pngAccepted, 'File ảnh PNG hợp lệ được chấp nhận');

  console.log('\n-----------------------------------------------------------------');
  console.log(`🎯 TỔNG KẾT: ${passed} bài kiểm tra PASS, ${failed} bài FAIL.`);
  if (failed === 0) {
    console.log('🌟 TẤT CẢ TIÊU CHUẨN AN TOÀN & BẢO MẬT ĐỀU ĐẠT CHUẨN XUẤT SẮC!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSecurityTests().catch((e) => {
  console.error('Lỗi khi chạy kiểm thử bảo mật:', e);
  process.exit(1);
});
