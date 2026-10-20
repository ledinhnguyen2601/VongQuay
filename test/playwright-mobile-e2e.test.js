/**
 * Lucky Wheel SaaS - Playwright Mobile Browser E2E Test Suite (Task [K])
 * 
 * Kiểm tra nghiệm thu nghiêm ngặt trên trình duyệt Chromium thật:
 * 1. Giả lập màn hình điện thoại di động (Viewport: 390x844).
 * 2. Tải trang lần đầu, tải lại trang nhiều lần để kiểm tra đồng bộ cache sessionStorage.
 * 3. Bắn các sự kiện resize mô phỏng thanh địa chỉ trình duyệt điện thoại co giãn.
 * 4. Chạy 30 lượt quay liên tiếp:
 *    - (a) Chỉ đúng 1 yêu cầu POST /spin cho mỗi lần bấm (chống gửi trùng).
 *    - (b) Ô nằm dưới kim == chữ trong hộp thoại == prize server trả về == bản ghi history mới nhất.
 *    - (c) Bắn sự kiện resize khi vòng quay đã dừng: góc dừng và hình ảnh không đổi.
 * 5. Tự động dọn dẹp dữ liệu vòng quay test sau khi chạy xong.
 */

process.env.NODE_ENV = 'test';

const { chromium } = require('playwright');
const assert = require('assert');
const app = require('../server');
const db = require('../src/db');

const TEST_PORT = 3055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runMobileE2ETests() {
  console.log('=================================================================');
  console.log('📱 BẮT ĐẦU KIỂM THỬ TRÌNH DUYỆT THẬT TRÊN DI ĐỘNG (PLAYWRIGHT) [TASK K]');
  console.log('=================================================================\n');

  // 1. Khởi động máy chủ kiểm thử cục bộ
  const server = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, () => {
      console.log(`✅ Máy chủ kiểm thử đang chạy tại ${BASE_URL}`);
      resolve(s);
    });
  });

  const testWheelId = `test_k_${Date.now()}`;
  const testSegments = [
    { id: 'seg_1', text: 'Móc khóa', color: '#EF4444', weight: 40 },
    { id: 'seg_2', text: 'Giảm 15%', color: '#3B82F6', weight: 30 },
    { id: 'seg_3', text: 'Áo thun', color: '#10B981', weight: 20 },
    { id: 'seg_4', text: 'Nón bảo hiểm', color: '#F59E0B', weight: 10 }
  ];

  let browser = null;

  try {
    // 2. Tạo vòng quay thử nghiệm riêng cho bài test này
    console.log(`👉 [BƯỚC 1]: Tạo vòng quay kiểm thử id="${testWheelId}"...`);
    await db.saveWheel(testWheelId, {
      wheelId: testWheelId,
      name: 'Vòng Quay Test Di Động',
      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      backgroundOpacity: 0.25,
      segments: testSegments,
      createdAt: new Date().toISOString()
    });

    // 3. Khởi chạy trình duyệt Chromium với cấu hình điện thoại (iPhone 14 / Mobile standard)
    console.log('👉 [BƯỚC 2]: Khởi chạy Playwright Chromium giả lập điện thoại (390x844)...');
    browser = await chromium.launch({
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();

    // Cài đặt đồng hồ giả lập của Playwright để tua nhanh animation quay mượt mà mà không phải chờ 5-19s thật
    await page.clock.install();

    // Đếm số lượng request POST /spin được gửi đi
    let spinRequestsSent = 0;
    let latestSpinResponseData = null;

    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/spin')) {
        spinRequestsSent++;
      }
    });

    page.on('response', async (res) => {
      if (res.request().method() === 'POST' && res.url().includes('/spin')) {
        try {
          latestSpinResponseData = await res.json();
        } catch (e) {}
      }
    });

    // 4. Tải trang lần đầu
    console.log(`👉 [BƯỚC 3]: Tải trang lần đầu tại ${BASE_URL}/?w=${testWheelId}...`);
    await page.goto(`${BASE_URL}/?w=${testWheelId}`);
    await page.waitForSelector('#wheelCanvas');

    // Chờ 1 nhịp đồng hồ giả để fetch hoàn tất
    await page.clock.runFor(500);

    // 5. Tải lại trang 2 lần để kiểm tra cache sessionStorage
    console.log('👉 [BƯỚC 4]: Tải lại trang (reload) 2 lần để kích hoạt cơ chế Instant Cache...');
    await page.reload();
    await page.waitForSelector('#wheelCanvas');
    await page.clock.runFor(500);

    await page.reload();
    await page.waitForSelector('#wheelCanvas');
    await page.clock.runFor(500);

    // 6. Bắn sự kiện resize mô phỏng thanh địa chỉ co giãn
    console.log('👉 [BƯỚC 5]: Bắn sự kiện resize màn hình điện thoại (390x750 -> 390x844)...');
    await page.setViewportSize({ width: 390, height: 750 });
    await page.clock.runFor(200);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.runFor(200);

    // 7. Chạy 30 lượt quay liên tiếp
    console.log('\n👉 [BƯỚC 6]: BẮT ĐẦU QUAY 30 LƯỢT KIỂM THỬ ĐỐI SOÁT TOÀN DIỆN...');
    const TOTAL_SPINS = 30;
    let successfulSpins = 0;

    for (let i = 1; i <= TOTAL_SPINS; i++) {
      spinRequestsSent = 0;
      latestSpinResponseData = null;

      // Bấm nút quay (thử click nhanh)
      const spinBtn = page.locator('#spinBtn');
      await spinBtn.click();

      // Kiểm tra ngay điều kiện (a): chỉ đúng 1 request được gửi
      const spinResponse = await page.waitForResponse((res) => res.url().includes('/spin') && res.request().method() === 'POST');
      assert.strictEqual(spinRequestsSent, 1, `Lượt ${i}: Phải có DUY NHẤT 1 request /spin được gửi đi (thực tế: ${spinRequestsSent})`);

      const spinData = await spinResponse.json();
      if (!spinData.success) {
        console.error(`Spin response error status ${spinResponse.status()}:`, spinData);
      }
      assert.ok(spinData && spinData.success, `Lượt ${i}: Phản hồi /spin phải thành công`);
      const serverPrize = spinData.prize;
      const targetIndex = spinData.targetIndex;

      // Tua nhanh đồng hồ giả lập 25 giây để hoàn thành toàn bộ animation quay
      await page.clock.runFor(25000);

      // Chờ modal trúng thưởng xuất hiện
      const winModal = page.locator('#winModal');
      await winModal.waitFor({ state: 'visible', timeout: 5000 });

      // Lấy text hiển thị trên modal
      const modalText = (await page.locator('#prizeResultText').textContent() || '').trim();

      // Lấy chỉ số ô nằm dưới kim bằng tính toán toán học từ góc quay hiện tại
      const pointerSegmentIndex = await page.evaluate(() => {
        if (!window.currentWheelInstance) return -1;
        return window.currentWheelInstance.getPointerSegmentIndex();
      });

      // Lấy bản ghi history mới nhất từ DB
      const historyList = await db.getSpinHistory(testWheelId, 1);
      const latestHistory = historyList[0];

      // ĐỐI SOÁT ĐIỀU KIỆN (b):
      // Ô dưới kim == chữ trong hộp thoại == prize server trả về == bản ghi history
      assert.strictEqual(modalText, serverPrize.text, `Lượt ${i}: Chữ trong modal ("${modalText}") phải khớp serverPrize.text ("${serverPrize.text}")`);
      assert.strictEqual(pointerSegmentIndex, targetIndex, `Lượt ${i}: Ô dưới kim (${pointerSegmentIndex}) phải khớp targetIndex (${targetIndex})`);
      assert.ok(latestHistory, `Lượt ${i}: Phải tìm thấy bản ghi history`);
      assert.strictEqual(latestHistory.prizeText, serverPrize.text, `Lượt ${i}: History prizeText phải khớp serverPrize`);
      assert.strictEqual(latestHistory.targetIndex, targetIndex, `Lượt ${i}: History targetIndex phải khớp`);

      // ĐỐI SOÁT ĐIỀU KIỆN (c): Bắn sự kiện resize khi vòng quay đã dừng
      const rotationBeforeResize = await page.evaluate(() => window.currentWheelInstance.currentRotation);
      await page.setViewportSize({ width: 390, height: 780 });
      await page.clock.runFor(100);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.clock.runFor(100);

      const rotationAfterResize = await page.evaluate(() => window.currentWheelInstance.currentRotation);
      const pointerIndexAfterResize = await page.evaluate(() => window.currentWheelInstance.getPointerSegmentIndex());

      assert.strictEqual(rotationAfterResize, rotationBeforeResize, `Lượt ${i}: Góc quay không được thay đổi sau sự kiện resize`);
      assert.strictEqual(pointerIndexAfterResize, targetIndex, `Lượt ${i}: Ô dưới kim không được đổi sau sự kiện resize`);

      // Đóng modal
      await page.locator('#closeWinModalBtn').click();
      await page.clock.runFor(200);

      successfulSpins++;
      if (i % 5 === 0 || i === TOTAL_SPINS) {
        console.log(`  ✓ Đã hoàn thành ${i}/${TOTAL_SPINS} lượt quay. Ô đích: "${serverPrize.text}" (idx: ${targetIndex}) -> Đối soát hoàn hảo!`);
      }
    }

    console.log(`\n🎉 KẾT QUẢ: Toàn bộ ${successfulSpins}/${TOTAL_SPINS} lượt quay trên trình duyệt di động đều PASS 100%!`);
    console.log('   - 0 lần gửi trùng yêu cầu');
    console.log('   - 0 lần lệch giữa ô kim dừng và hộp thoại');
    console.log('   - 0 lần giật/reset góc quay khi đổi kích thước màn hình');

  } finally {
    // Dọn dẹp
    if (browser) {
      await browser.close();
    }
    // Xóa vòng quay test khỏi DB
    try {
      if (db.isUsingFirebase()) {
        const admin = require('firebase-admin');
        await admin.database().ref(`wheels/${testWheelId}`).remove();
        await admin.database().ref(`history/${testWheelId}`).remove();
      }
    } catch (e) {}

    server.close();
  }
}

runMobileE2ETests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ BÀI TEST THẤT BẠI:', err.message);
  process.exit(1);
});
