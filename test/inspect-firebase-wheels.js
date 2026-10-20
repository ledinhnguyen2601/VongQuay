/**
 * Script chỉ đọc danh sách mã vòng quay và kiểm tra cấu trúc segments (Không in bí mật)
 */
const db = require('../src/db');

async function inspectWheels() {
  console.log('--- KIỂM TRA DANH SÁCH VÀ CẤU TRÚC VÒNG QUAY TRÊN FIREBASE ---');
  if (!db.isUsingFirebase()) {
    console.log('Đang dùng in-memory store.');
    return;
  }

  const admin = require('firebase-admin');
  const fbDb = admin.database();
  const snap = await fbDb.ref('wheels').once('value');
  if (!snap.exists()) {
    console.log('Không có vòng quay nào trên Firebase.');
    return;
  }

  const data = snap.val();
  const wheelIds = Object.keys(data);
  console.log(`Tổng số vòng quay hiện có trên Firebase: ${wheelIds.length}`);

  for (const id of wheelIds) {
    const wheel = data[id];
    const isPushKey = id.startsWith('-');
    const segs = Array.isArray(wheel.segments) ? wheel.segments : (wheel.segments ? Object.values(wheel.segments) : []);
    const segSample = segs.map(s => s.text).join(', ');
    console.log(`- wheelId: "${id}" | Tên: "${wheel.name}" | Loại key: ${isPushKey ? 'Push key cũ (-...)' : 'nanoid mới'} | Số ô quà: ${segs.length} [${segSample.slice(0, 50)}...]`);
  }
}

inspectWheels().catch(console.error);
