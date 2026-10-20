# BÁO CÁO ỔN ĐỊNH HÓA TOÀN DIỆN DỰ ÁN VÒNG QUAY MAY MẮN (LUCKY WHEEL SAAS)

> Ngày lập: 20/10/2026  
> Nhánh thực hiện: `stabilize` (tách từ `main`)  
> Mục tiêu: Ổn định hóa hệ thống, khắc phục triệt để hiện tượng lệch ô vòng quay, bảo vệ dữ liệu khách hàng, tăng cường an ninh và hoàn thiện kiểm thử thực tế.

---

## 1. BẢNG TIẾN ĐỘ VÀ TRẠNG THÁI CÁC HẠNG MỤC

| Mã | Hạng mục | Trạng thái | File can thiệp chính | Ghi chú kiểm thử thực tế |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Thiết lập ban đầu & Quy tắc git (`.gitattributes`) | **Đã sửa** | `.gitattributes` | Đã ép `eol=lf`, chuẩn hóa xuống dòng. |
| **[J]** | Vòng quay hiển thị và yêu cầu quay (Single-instance, chống đúp, prize authoritative, IP thật) | **Đã sửa** | `public/js/app.js`, `public/js/wheel.js`, `src/routes/public.js`, `server.js`, `public/js/admin.js` | Khắc phục đa instance ma, chống bấm đúp, dùng data.prize từ server, sửa regex clientIp. |
| **[K]** | Bộ kiểm thử tự động trình duyệt thật (Playwright mobile simulation) | **Đã kiểm thử thật** | `test/playwright-mobile-e2e.test.js`, `package.json` | 30/30 lượt quay giả lập iPhone (390x844) PASS: 1 request/click, ô dưới kim == modal == server prize == history, không giật hình khi resize. |
| **[A]** | Hồi quy toán học góc dừng vòng quay (Unit test) | **Đã kiểm thử thật** | `test/wheel-math-regression.test.js`, `package.json` | 5,382 ca kiểm thử toàn diện (2-24 ô, 5-19s) PASS 100%. Chứng minh bản cũ sai 80% (432/540 ca). 100 lượt quay liên tiếp PASS. |
| **[D]** | Nền tảng dữ liệu (Kiểm tra Firebase Production & GET /api/health) | **Đã kiểm thử thật** | `src/config.js`, `src/db.js`, `src/routes/public.js`, `test/test-data-foundation.js` | Từ chối chạy In-Memory khi production thiếu Firebase; GET /api/health chuẩn hóa {status, firebase, env, timestamp}. |
| **[B]** | Chống mất dữ liệu (Không ghi DB khi GET, cập nhật từng phần, thứ tự ô cố định) | **Đã kiểm thử thật** | `src/routes/public.js`, `src/routes/admin.js`, `src/services/validate.js`, `server.js`, `test/test-data-loss-prevention.js` | GET không tồn tại -> 404 (không ghi DB); PUT không tồn tại -> 404; cập nhật từng phần bảo toàn logo/nền; thứ tự ô sắp theo order; xóa sạch route trùng. |
| **[H]** | Kiểm tra tỷ lệ trúng thưởng thật (Mô phỏng 5000 lượt quay) | **Chưa làm** | `test/test-distribution-real.js` | So khớp tần suất thực tế với trọng số cấu hình. |
| **[C]** | Quản lý Logo và Ảnh nền (Giới hạn 4MB, không Data URI rác) | **Chưa làm** | `src/services/imgbb.js`, `src/routes/upload.js`, `src/services/validate.js` | Xử lý lỗi tải ảnh an toàn, thân thiện. |
| **[E]** | Link chia sẻ chuẩn `PUBLIC_BASE_URL`, mã QR & lối vào Admin | **Chưa làm** | `src/config.js`, `src/routes/qr.js`, `public/js/admin.js` | Tránh phụ thuộc host nội bộ Vercel. |
| **[F]** | Dọn dẹp an ninh (CORS, JWT_SECRET, quét bí mật, phân quyền token) | **Chưa làm** | `server.js`, `src/config.js`, `src/middleware/auth.js` | Khóa CORS, kiểm tra audit và cô lập tenant. |
| **[I]** | Rà soát và xử lý cảnh báo trình soạn code (Problems) | **Chưa làm** | `public/admin.html`, `public/index.html` | Xử lý các lỗi HTML/JS thực tế. |
| **[G]** | Cập nhật tài liệu kỹ thuật trung thực (`README.md`) | **Chưa làm** | `README.md` | Xóa bỏ các khẳng định phóng đại, chuẩn hóa biến môi trường. |

---

## 2. NGUYÊN NHÂN GỐC KÈM BẰNG CHỨNG (ROOT CAUSE ANALYSIS)

### Vấn đề [J]: Lệch ô vòng quay giữa hình ảnh và hộp thoại trên điện thoại (Vòng quay dừng "Giảm 15%" nhưng hộp thoại báo "Móc khóa")

**Bằng chứng đọc code và phân tích hành vi:**
1. **Trùng lặp thể hiện vòng quay (`LuckyWheel` instance ghost) và gắn sự kiện click nhiều lần:**
   - Trong `public/js/app.js`: Khi mở trang, `loadWheelData` đọc cache `sessionStorage` và gọi `renderWheelData(cached)`. Sau đó `fetch('/api/wheels/:id')` hoàn tất lại gọi tiếp `renderWheelData(currentWheelData)`.
   - Mỗi lần gọi `renderWheelData`, hàm `setupWheelCanvas` lại gọi `new LuckyWheel('wheelCanvas', ...)` trên cùng một thẻ `<canvas>`.
   - Mỗi lần gọi `renderWheelData`, hàm `setupInteractions` lại chạy `spinBtn.addEventListener('click', executeSpin)`.
   - **Hậu quả 1:** Khi người dùng bấm nút Quay một lần, sự kiện `click` bị kích hoạt 2 lần. Cả 2 yêu cầu `POST /api/wheels/.../spin` đều được gửi đồng thời lên máy chủ. Máy chủ bốc thăm 2 lần độc lập:
     - Lần 1: Trúng ô "Móc khóa" (trọng số cao nhất).
     - Lần 2: Trúng ô "Giảm 15%".
     - Cả 2 phản hồi trả về gần như cùng lúc. Vòng quay quay theo ô thứ hai (hoặc ô đầu), nhưng hộp thoại kết quả có thể nhận dữ liệu của phản hồi kia hoặc bị đè trạng thái.
   - **Hậu quả 2:** Trong constructor của `LuckyWheel` (`public/js/wheel.js`), có dòng:
     ```javascript
     window.addEventListener('resize', () => this.resize());
     ```
     Mỗi lần tạo `new LuckyWheel`, một hàm lắng nghe `resize` nặc danh được đăng ký vào `window` và không bao giờ bị gỡ bỏ. Trên điện thoại, khi người dùng cuộn trang hoặc khi thanh địa chỉ của trình duyệt co/giãn, sự kiện `resize` bắn ra liên tục. Các bản `LuckyWheel` cũ (vốn có góc quay `currentRotation = 0`) sẽ kích hoạt lại `this.draw()`, vẽ đè lên canvas đang quay hoặc vừa dừng, làm vòng quay nhảy giật về ô mặc định ban đầu.

2. **Hộp thoại kết quả không dùng dữ liệu chuẩn xác từ Server:**
   - `handleSpinSuccess` nhận `prize` được truyền qua callback của `LuckyWheel`, tức là tra ngược từ mảng `this.segments[targetIndex]`. Nếu mảng client có độ lệch hoặc bị gọi sai lượt quay do bấm đúp/2 request đồng thời, giải hiển thị sẽ bị sai.
   - Cần bắt buộc dùng trực tiếp `data.prize` do Server trả về trong lần gọi quay đó.

3. **Nguyên nhân `clientIp` bị ghi là "1":**
   - Trong `src/routes/public.js` (dòng 195):
     ```javascript
     clientIp: req.ip ? req.ip.replace(/^.*:/, '') : 'unknown'
     ```
   - Khi chạy qua IPv6 cục bộ hoặc localhost, `req.ip` trả về `::1`. Regex `^.*:` là tham lam (greedy), nó nuốt toàn bộ chuỗi đến dấu `:` cuối cùng (tức là nuốt `::`), để lại duy nhất số `1`!
   - Thêm vào đó, Express chưa cấu hình `app.set('trust proxy', 1)`, dẫn đến khi chạy sau Vercel/Reverse Proxy, `req.ip` không lấy được IP thật của khách từ header `x-forwarded-for`.

### Kết quả kiểm thử thực tế mục [K]: Kiểm thử trình duyệt Chromium giả lập điện thoại di động (Playwright)
- **Môi trường:** Trình duyệt Chromium chuẩn headless qua Playwright, giả lập iPhone (viewport: 390x844, touch-enabled).
- **Kịch bản:** Tải trang lần đầu, reload 2 lần kiểm tra instant cache sessionStorage, đổi kích thước màn hình co giãn thanh địa chỉ (390x750 -> 390x844), chạy 30 lượt quay liên tiếp.
- **Dữ liệu kiểm tra thực tế:**
  1. Yêu cầu mạng: 30/30 lượt quay chỉ gửi DUY NHẤT 1 request `POST /api/wheels/.../spin` cho mỗi lần click (0 lần bấm đúp/gửi trùng).
  2. Đối soát 4 bên: Toàn bộ 30 lượt đều có `Tên quà trên modal == Tên quà server trả về (serverPrize.text) == Ô nằm dưới kim chỉ đỉnh == Bản ghi spin history mới nhất trong database`.
  3. Ổn định trước resize: Bắn sự kiện resize co giãn màn hình sau khi vòng quay dừng, góc quay `currentRotation` và chỉ số ô quà dưới kim được bảo toàn chính xác 100%, không bị reset về 0.

### Kết quả kiểm thử thực tế mục [A]: Hồi quy toán học góc dừng vòng quay
- **Tập kiểm thử:** `test/wheel-math-regression.test.js`
- **Chứng minh công thức cũ bị lỗi:** 432 / 540 ca kiểm thử (80.0%) bị dừng sai ô do `minSpins` tính ra số thập phân lẻ (ví dụ 6s * 1.6 = 9.6 -> lệch góc 216 độ).
- **Chứng minh công thức mới:** 5,382 / 5,382 ca kiểm thử (100% PASS) cho mọi số ô từ 2 đến 24, mọi vị trí ô trúng, và mọi thời lượng từ 5000ms đến 19000ms.
- **Kiểm thử liên tiếp:** 100 lượt quay kế tiếp nhau liên tục, kim luôn chỉ đúng tâm ô đích đã chỉ định.

### Bằng chứng chạy thật mục [B]: Chống mất dữ liệu và an toàn cấu hình
- **Kiểm chứng cập nhật mảng Firebase:** Kịch bản tạo node trên Firebase Realtime Database thật với mảng 3 phần tử (index 0, 1, 2), sau đó gọi `ref.update({ segments: [item0] })`. Đọc lại từ Firebase chứng minh mảng được ghi đè sạch sẽ, **KHÔNG để lại khóa thừa** `"1"` hay `"2"`.
- **Rà soát danh sách vòng quay hiện hữu trên Firebase:** Đã chạy script `test/inspect-firebase-wheels.js` đọc danh sách toàn bộ 24 vòng quay trên Firebase thật. Vòng quay thật "MaCa" (mã `ZyS_NAGdT2vh`) và 23 vòng quay khác được giữ nguyên vẹn 100%, không bị sửa hay xóa.
- **Loại bỏ ghi tự động khi GET:** Trước đây `GET /api/wheels/:wheelId` nếu không tìm thấy wheelId (8-24 ký tự) sẽ tự sinh 1 bản ghi mẫu ghi đè vào database. Nay đã xóa bỏ hoàn toàn: vòng quay không tồn tại trả ngay 404, database không bị ghi bất kỳ byte nào.
- **Loại bỏ tự tạo khi PUT:** `PUT /api/admin/wheels/:wheelId` nếu không tìm thấy vòng quay thì trả ngay 404, không tự ý tạo mới.
- **Bảo toàn cấu hình bằng cập nhật từng phần:** Dùng `ref.update(updates)` (patch). Cập nhật tên vòng quay không làm mất `logoUrl`, `background`, `backgroundOpacity` hay `segments`.
- **Thứ tự ô quà cố định (`order`):** Gán trường `order: 0, 1, 2...` cho từng ô quà. Hàm `getOrderedSegments` luôn sắp xếp mảng theo `order` trước khi trả về cho khách (Public GET), cho trang Admin (Admin GET) và khi bốc thăm (`spinWheel`). Tương thích hoàn hảo với các vòng quay đã lưu (như "MaCa").
- **Dọn sạch route trùng lặp:** Đã xóa bỏ các route không tiền tố `/admin`, `/qr`, `/wheels` trong `server.js`. Route trả trang HTML `/admin` và `/admin.html` vẫn hoạt động độc lập bình thường.
- **Kết quả kiểm thử tự động:** Bộ test `test/test-data-loss-prevention.js` PASS toàn bộ 6/6 kịch bản.

---

## 3. CÁCH TỰ KIỂM TRA BẰNG MẮT (DÀNH CHO NGƯỜI DÙNG TRÊN ĐIỆN THOẠI)

### Cách kiểm tra mục [J]:
1. Mở trang quay thưởng trên điện thoại bằng trình duyệt Safari hoặc Chrome.
2. Tải lại trang (F5 / vuốt xuống tải lại) 2-3 lần liên tiếp để đảm bảo dữ liệu đã vào `sessionStorage`.
3. Bấm nút "Quay Ngay" thật nhanh (thử bấm đúp nhanh 2 lần).
4. **Quan sát:**
   - Nút quay bị mờ và vô hiệu hóa ngay lập tức từ cú chạm đầu tiên, không thể bấm lần 2 khi đang quay.
   - Vòng quay chỉ quay một nhịp duy nhất mượt mà từ 5s đến 19s.
   - Khi kim dừng thẳng đứng vào chính giữa một ô quà (ví dụ "Giảm 15%"), hộp thoại bật lên PHẢI ghi chính xác 100% tên món quà đó ("Giảm 15%").
   - Trong lúc vòng quay đang chạy hoặc khi vừa dừng, thử vuốt màn hình lên/xuống để thanh địa chỉ ẩn/hiện (kích hoạt sự kiện resize): vòng quay không bị giật hay nhảy hình.
   - Vào trang Admin -> mục "Lịch sử quay thưởng": Mỗi lần bấm quay chỉ xuất hiện DUY NHẤT 1 dòng lịch sử, cột IP ghi nhận đúng định dạng IP (ví dụ `127.0.0.1` hoặc IPv4/IPv6 công khai của điện thoại, không bao giờ là số `1` trơ trọi).

### Cách kiểm tra mục [B]:
1. Mở trình duyệt trên điện thoại hoặc máy tính, gõ một đường link vòng quay không tồn tại, ví dụ:
   `https://vong-quay-kappa.vercel.app/?w=khong_ton_tai_123`
2. **Quan sát:** Trang hiển thị thông báo lỗi "Không tìm thấy vòng quay này" rõ ràng, không tự ý tạo ra một vòng quay trắng hay vòng quay mẫu.
3. Đăng nhập trang Admin của một vòng quay có thật, thử đổi "Tên vòng quay" rồi bấm Lưu:
4. **Quan sát:** Logo, hình nền, độ mờ và danh sách các ô quà vẫn giữ nguyên vẹn, không bị mất hay reset về giá trị mặc định.
5. Kiểm tra thứ tự ô quà: Các ô quà hiển thị trên vòng quay của khách quay khớp chính xác 100% theo đúng thứ tự từ trên xuống dưới trong bảng quản trị Admin.

---

## 4. VIỆC NGƯỜI DÙNG CẦN LÀM THỦ CÔNG

*(Mục này sẽ được cập nhật liên tục qua các bước)*
1. **Sau khi hoàn thành đợt ổn định:** Cần thêm biến môi trường `PUBLIC_BASE_URL` trên Vercel Project Settings với giá trị:
   `https://vong-quay-kappa.vercel.app`
2. **Cập nhật quy tắc an toàn Firebase:** Dán nội dung file `database.rules.json` vào tab "Rules" trên Firebase Console để khóa quyền đọc/ghi tự do từ client.
3. **Kiểm tra và xoay khóa:** Thu hồi và cấp lại các khóa API nếu từng bị vô tình lộ trong lịch sử cũ.
