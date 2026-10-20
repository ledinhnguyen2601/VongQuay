/**
 * Lucky Wheel SaaS - Test Quản Lý Logo & Nền [TASK C]
 * Kiểm chứng:
 * 1. inspectImageBuffer:
 *    - Ảnh PNG/JPEG hợp lệ được chấp nhận
 *    - Tệp SVG bị từ chối
 *    - Tệp EXE / mã độc giả mạo đuôi ảnh bị từ chối
 *    - Tệp vượt quá 4MB bị từ chối với thông báo tiếng Việt dễ hiểu
 * 2. uploadToImgBB:
 *    - Thiếu IMGBB_API_KEY báo lỗi rõ ràng, KHÔNG tạo Data URI
 * 3. validateImageUrl:
 *    - https://i.ibb.co/xyz/image.png -> Hợp lệ
 *    - http:// (không có S) -> Từ chối
 *    - Domain lạ (không phải imgbb) -> Từ chối
 *    - Javascript URL / HTML injection -> Từ chối
 * 4. Upload lỗi: Database không bị xóa mất logo/nền đang có
 */

const assert = require('assert');
const http = require('http');
const sharp = require('sharp');
const app = require('../server');
const db = require('../src/db');
const config = require('../src/config');
const { inspectImageBuffer, uploadToImgBB } = require('../src/services/imgbb');
const { validateImageUrl } = require('../src/services/validate');
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
  console.log('🧪 BẮT ĐẦU KIỂM THỬ QUẢN LÝ LOGO VÀ ẢNH NỀN [TASK C]');
  console.log('=================================================================\n');

  // 1. Tạo buffer ảnh PNG hợp lệ bằng Sharp
  console.log('--- 1. Kiểm tra inspectImageBuffer với các loại tệp ---');
  const validPngBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 }
    }
  }).png().toBuffer();

  const metadata = await inspectImageBuffer(validPngBuffer);
  assert.strictEqual(metadata.format, 'png');
  console.log('✅ PASS: Ảnh PNG hợp lệ được chấp nhận.');

  // 2. Kiểm tra tệp SVG bị từ chối
  const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red" /></svg>');
  let svgError = null;
  try {
    await inspectImageBuffer(svgBuffer);
  } catch (e) {
    svgError = e;
  }
  assert.ok(svgError, 'SVG phải bị từ chối');
  assert.ok(svgError.message.includes('không được hỗ trợ') || svgError.message.includes('bị hỏng'), `Thông báo lỗi hợp lệ: ${svgError.message}`);
  console.log(`✅ PASS: Tệp SVG bị từ chối chính xác: "${svgError.message}"`);

  // 3. Kiểm tra tệp EXE / mã độc giả mạo
  const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is an executable not an image');
  let exeError = null;
  try {
    await inspectImageBuffer(fakeExeBuffer);
  } catch (e) {
    exeError = e;
  }
  assert.ok(exeError, 'EXE phải bị từ chối');
  console.log(`✅ PASS: Tệp EXE/mã độc giả mạo bị từ chối chính xác: "${exeError.message}"`);

  // 4. Kiểm tra tệp quá 4MB
  const oversizedBuffer = Buffer.alloc(4.5 * 1024 * 1024); // 4.5MB
  let sizeError = null;
  try {
    await inspectImageBuffer(oversizedBuffer);
  } catch (e) {
    sizeError = e;
  }
  assert.ok(sizeError, 'File > 4MB phải bị từ chối');
  assert.ok(sizeError.message.includes('4MB'), `Thông báo phải đề cập 4MB: ${sizeError.message}`);
  console.log(`✅ PASS: Tệp quá 4MB bị từ chối chính xác: "${sizeError.message}"`);

  // 5. Kiểm tra uploadToImgBB khi thiếu IMGBB_API_KEY
  console.log('\n--- 2. Kiểm tra uploadToImgBB khi thiếu khóa API ---');
  const originalApiKey = config.imgbbApiKey;
  try {
    config.imgbbApiKey = ''; // Giả lập thiếu khóa
    let missingKeyError = null;
    try {
      await uploadToImgBB(validPngBuffer);
    } catch (e) {
      missingKeyError = e;
    }
    assert.ok(missingKeyError, 'Thiếu API Key phải ném lỗi');
    assert.ok(!missingKeyError.message.startsWith('data:'), 'Tuyệt đối KHÔNG trả về Data URI');
    assert.ok(missingKeyError.message.includes('IMGBB_API_KEY'), 'Thông báo phải nêu rõ thiếu IMGBB_API_KEY');
    console.log(`✅ PASS: Thiếu IMGBB_API_KEY ném lỗi rõ ràng: "${missingKeyError.message}" (Không tạo Data URI).`);
  } finally {
    config.imgbbApiKey = originalApiKey;
  }

  // 6. Kiểm tra validateImageUrl
  console.log('\n--- 3. Kiểm tra tính hợp lệ của URL ảnh (validateImageUrl) ---');
  assert.strictEqual(validateImageUrl('https://i.ibb.co/abc/logo.png'), 'https://i.ibb.co/abc/logo.png', 'HTTPS i.ibb.co hợp lệ');
  assert.strictEqual(validateImageUrl('https://ibb.co/abc/logo.png'), 'https://ibb.co/abc/logo.png', 'HTTPS ibb.co hợp lệ');
  assert.strictEqual(validateImageUrl('http://i.ibb.co/abc/logo.png'), '', 'HTTP không bảo mật phải bị từ chối');
  assert.strictEqual(validateImageUrl('https://malicious-site.com/hack.png'), '', 'Domain lạ ngoài imgbb phải bị từ chối');
  assert.strictEqual(validateImageUrl('javascript:alert(1)'), '', 'Javascript URL phải bị từ chối');
  assert.strictEqual(validateImageUrl(''), '', 'Chuỗi rỗng hợp lệ (xóa logo)');
  console.log('✅ PASS: validateImageUrl chỉ chấp nhận HTTPS và domain imgbb (i.ibb.co).');

  // 7. Kiểm tra API Upload qua HTTP Server và bảo toàn dữ liệu khi có lỗi
  console.log('\n--- 4. Kiểm tra API Upload và bảo toàn logo/nền khi lỗi ---');
  await startServer();
  const testWheelId = `test_logo_${Date.now()}`;

  try {
    const initialWheel = {
      name: 'Vòng Quay Giữ Logo',
      logoUrl: 'https://i.ibb.co/initial/logo.png',
      background: 'https://i.ibb.co/initial/bg.png',
      backgroundOpacity: 0.25,
      segments: [
        { id: '1', text: 'Quà A', color: '#111111', weight: 50, order: 0 },
        { id: '2', text: 'Quà B', color: '#222222', weight: 50, order: 1 }
      ]
    };
    await db.saveWheel(testWheelId, initialWheel);

    const token = generateAdminToken(testWheelId);

    // Gửi ảnh không hợp lệ (SVG) lên endpoint upload
    const boundary = '----WebKitFormBoundaryTest123';
    const postData = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="malicious.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`),
      svgBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${baseUrl}/api/admin/wheels/${testWheelId}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${token}`
      },
      body: postData
    });

    assert.strictEqual(uploadRes.status, 400, 'Upload SVG phải trả lỗi 400');
    const uploadJson = await uploadRes.json();
    assert.strictEqual(uploadJson.success, false);
    console.log(`✅ PASS: API Upload từ chối SVG với mã 400: "${uploadJson.message}"`);

    // Kiểm tra trong DB: logoUrl và background vẫn nguyên vẹn
    const wheelAfterFailedUpload = await db.getWheel(testWheelId);
    assert.strictEqual(wheelAfterFailedUpload.logoUrl, initialWheel.logoUrl, 'Logo cũ không bị mất sau khi upload lỗi');
    assert.strictEqual(wheelAfterFailedUpload.background, initialWheel.background, 'Background cũ không bị mất sau khi upload lỗi');
    console.log('✅ PASS: Khi upload lỗi, logo và ảnh nền cũ trong database được bảo toàn tuyệt đối.');

  } finally {
    console.log('\n--- Dọn dẹp dữ liệu kiểm thử Task C ---');
    if (db.isFirebaseConnected && db.firebaseDb) {
      await db.firebaseDb.ref(`wheels/${testWheelId}`).remove();
    }
    await stopServer();
    console.log('✅ Đã dọn dẹp sạch node test trên Firebase/DB.');
  }

  console.log('\n=================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ QUẢN LÝ LOGO VÀ NỀN [TASK C] ĐÃ PASS 100%!');
  console.log('=================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
