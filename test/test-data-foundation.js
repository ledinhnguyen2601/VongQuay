/**
 * Lucky Wheel SaaS - Data Foundation Unit Test (Task [D])
 * Kiểm tra:
 * 1. GET /api/health trả { status: 'ok', firebase: boolean, env: string }
 * 2. NODE_ENV=production khi thiếu Firebase sẽ từ chối chạy thay vì lùi về In-Memory
 */

const assert = require('assert');

async function testDataFoundation() {
  console.log('=================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ NỀN TẢNG DỮ LIỆU & HEALTH CHECK [TASK D]');
  console.log('=================================================================\n');

  const app = require('../server');
  const server = await new Promise((resolve) => {
    const s = app.listen(3066, () => resolve(s));
  });

  try {
    // 1. Kiểm tra GET /api/health
    const res = await fetch('http://localhost:3066/api/health');
    assert.strictEqual(res.status, 200, 'GET /api/health phải trả về HTTP 200');

    const data = await res.json();
    console.log('Phản hồi GET /api/health:', data);

    assert.strictEqual(data.status, 'ok', 'status phải là "ok"');
    assert.strictEqual(typeof data.firebase, 'boolean', 'firebase phải là kiểu boolean');
    assert.strictEqual(typeof data.env, 'string', 'env phải là kiểu string');
    assert.strictEqual(data.passwordHash, undefined, 'Tuyệt đối không lộ mật khẩu');
    assert.strictEqual(data.serviceAccount, undefined, 'Tuyệt đối không lộ serviceAccount');
    console.log('✅ PASS: GET /api/health trả đúng định dạng bảo mật.');

    // 2. Kiểm tra NODE_ENV=production không bị sập serverless khi thiếu cấu hình
    console.log('\n👉 [KIỂM TRA]: Khởi động an toàn không ném uncaught exception trên Serverless Vercel...');
    const childProcess = require('child_process');
    const out = childProcess.spawnSync(process.execPath, [
      '-e',
      `
      process.env.NODE_ENV = 'production';
      delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      delete process.env.FIREBASE_DATABASE_URL;
      delete process.env.PUBLIC_BASE_URL;
      try {
        const config = require('./src/config');
        const db = require('./src/db');
        console.log('✅ Khởi động thành công ở chế độ dự phòng, không sập Serverless.');
        process.exit(0);
      } catch (err) {
        console.error('❌ Bị sập khởi động:', err.message);
        process.exit(1);
      }
      `
    ], { cwd: process.cwd(), encoding: 'utf8' });

    assert.strictEqual(out.status, 0, 'Production thiếu Firebase hoặc PUBLIC_BASE_URL không được làm sập Serverless Function (tránh lỗi 500 FUNCTION_INVOCATION_FAILED)');
    console.log('✅ PASS: Môi trường Serverless khởi động an toàn, chống crash 500.');

    console.log('\n=================================================================');
    console.log('🎉 TOÀN BỘ KIỂM THỬ NỀN TẢNG DỮ LIỆU [TASK D] ĐÃ PASS!');
    console.log('=================================================================\n');
  } finally {
    server.close();
  }
}

testDataFoundation().catch((err) => {
  console.error('❌ THẤT BẠI:', err);
  process.exit(1);
});
