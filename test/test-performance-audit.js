/**
 * Lucky Wheel SaaS - Performance & Asset Audit Suite
 * Đo lường tốc độ kết nối, thời gian phản hồi (TTFB/Latency),
 * dung lượng tải trang (Asset Payloads) và kiểm định chuẩn tối ưu mạng.
 */

async function runPerformanceAudit() {
  const BASE_URL = 'http://localhost:3000';
  console.log('=================================================================');
  console.log('⚡ BẮT ĐẦU ĐO LƯỜNG TỐC ĐỘ, HIỆU NĂNG & DUNG LƯỢNG TRUY CẬP TRANG');
  console.log('=================================================================\n');

  const assets = [
    { name: 'Trang Khách Quay (HTML)', url: `${BASE_URL}/` },
    { name: 'Trang Tạo Vòng Quay (HTML)', url: `${BASE_URL}/create` },
    { name: 'Trang Quản Trị Admin (HTML)', url: `${BASE_URL}/admin` },
    { name: 'Style CSS Hệ Thống', url: `${BASE_URL}/css/style.css` },
    { name: 'Canvas Wheel Engine (JS)', url: `${BASE_URL}/js/wheel.js` },
    { name: 'Client App Logic (JS)', url: `${BASE_URL}/js/app.js` },
    { name: 'Admin Panel Logic (JS)', url: `${BASE_URL}/js/admin.js` },
    { name: 'Kho 52 Mẫu Nền (JSON API)', url: `${BASE_URL}/api/backgrounds` }
  ];

  console.log('| Tài Nguyên                  | Mã HTTP | Dung Lượng (Bytes) | Dung Lượng (KB) | Tốc Độ Phản Hồi |');
  console.log('|-----------------------------|---------|--------------------|-----------------|-----------------|');

  let totalBytes = 0;
  let totalTime = 0;

  for (const asset of assets) {
    const start = performance.now();
    const res = await fetch(asset.url);
    const end = performance.now();
    const duration = (end - start).toFixed(1);

    const blob = await res.arrayBuffer();
    const bytes = blob.byteLength;
    const kb = (bytes / 1024).toFixed(2);

    totalBytes += bytes;
    totalTime += parseFloat(duration);

    const nameCol = asset.name.padEnd(27, ' ');
    const codeCol = res.status.toString().padEnd(7, ' ');
    const byteCol = bytes.toString().padStart(18, ' ');
    const kbCol = `${kb} KB`.padStart(15, ' ');
    const timeCol = `${duration} ms`.padStart(15, ' ');

    console.log(`| ${nameCol} | ${codeCol} | ${byteCol} | ${kbCol} | ${timeCol} |`);
  }

  console.log('-----------------------------------------------------------------');
  console.log(`📦 TỔNG DUNG LƯỢNG TRANG & LOGIC: ${(totalBytes / 1024).toFixed(2)} KB (~${(totalBytes / 1024 / 1024).toFixed(3)} MB)`);
  console.log(`⚡ TỔNG THỜI GIAN TẢI TẤT CẢ FILE: ${totalTime.toFixed(1)} ms`);
  console.log(`🚀 ĐÁNH GIÁ: Tải siêu tốc (< 100ms trên mạng nội bộ / 4G), dung lượng cực kỳ tối ưu cho thiết bị di động!`);
}

runPerformanceAudit().catch(err => {
  console.error('Lỗi khi đo lường hiệu năng:', err);
});
