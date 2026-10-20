/**
 * Kiểm chứng chạy thật: ref.update({ segments: [...] }) có để lại khóa thừa không
 */
const db = require('../src/db');

async function testFirebaseUpdateBehavior() {
  console.log('--- KIỂM CHỨNG HÀNH VI FIREBASE UPDATE VỚI MẢNG SEGMENTS ---');
  if (!db.isUsingFirebase()) {
    console.log('In-memory database: không áp dụng kiểm thử Firebase.');
    return;
  }

  const admin = require('firebase-admin');
  const fbDb = admin.database();
  const testRef = fbDb.ref('test_verification_array_update');

  try {
    // 1. Tạo node với 3 phần tử: index 0, 1, 2
    await testRef.set({
      name: 'Test Array Update',
      segments: [
        { id: '1', text: 'A' },
        { id: '2', text: 'B' },
        { id: '3', text: 'C' }
      ]
    });

    let snap = await testRef.once('value');
    console.log('Ban đầu có 3 phần tử:', snap.val().segments);

    // 2. Gọi update({ segments: [ { id: '1', text: 'New A' } ] }) (chỉ còn 1 phần tử)
    await testRef.update({
      segments: [
        { id: '1', text: 'New A' }
      ]
    });

    snap = await testRef.once('value');
    const result = snap.val().segments;
    console.log('Sau khi update với mảng 1 phần tử:', result);

    if (Array.isArray(result) && result.length === 1) {
      console.log('✅ KẾT QUẢ: Firebase Realtime Database thay thế hoàn toàn mảng segments, KHÔNG để lại khóa thừa!');
    } else {
      console.log(`⚠️ KẾT QUẢ: Firebase để lại khóa thừa! Độ dài hoặc cấu trúc thực tế:`, result);
    }
  } finally {
    await testRef.remove();
    console.log('Đã dọn dẹp node kiểm thử.');
  }
}

testFirebaseUpdateBehavior().catch(console.error);
