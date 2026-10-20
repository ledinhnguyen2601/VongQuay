# BÁO CÁO ỔN ĐỊNH HÓA TOÀN DIỆN DỰ ÁN VÒNG QUAY MAY MẮN (LUCKY WHEEL SAAS)

> Ngày lập: 20/10/2026  
> Nhánh thực hiện: `stabilize` (tách từ `main`)  
> Mục tiêu: Ổn định hóa hệ thống, khắc phục triệt để hiện tượng lệch ô vòng quay, bảo vệ dữ liệu khách hàng, tăng cường an ninh và hoàn thiện kiểm thử thực tế.

---

## 1. BẢNG TIẾN ĐỘ VÀ TRẠNG THÁI CÁC HẠNG MỤC

| Mã | Hạng mục | Trạng thái | File can thiệp chính | Ghi chú kiểm thử thực tế |
| :--- | :--- | :--- | :--- | :--- |
| **0** | Thiết lập ban đầu & Quy tắc git (`.gitattributes`) | **Đã sửa** | `.gitattributes` | Đã ép `eol=lf`, chuẩn hóa xuống dòng. |
| **[J]** | Vòng quay hiển thị và yêu cầu quay (Single-instance, chống đúp, prize authoritative, IP thật) | **Đang làm** | `public/js/app.js`, `public/js/wheel.js`, `src/routes/public.js`, `server.js` | Đang sửa và kiểm chứng nguyên nhân gốc. |
| **[K]** | Bộ kiểm thử tự động trình duyệt thật (Playwright mobile simulation) | **Chưa làm** | `package.json`, `test/playwright-e2e.test.js` | Chạy 30 lượt giả lập màn hình di động 390x844. |
| **[A]** | Hồi quy toán học góc dừng vòng quay (Unit test) | **Chưa làm** | `test/wheel-math-regression.test.js` | Kiểm thử toán học với mọi số ô và thời lượng 5-19s. |
| **[D]** | Nền tảng dữ liệu (Kiểm tra Firebase Production & GET /api/health) | **Chưa làm** | `src/config.js`, `src/db.js`, `src/routes/public.js` | Từ chối chạy in-memory nếu thiếu Firebase ở production. |
| **[B]** | Chống mất dữ liệu (Không ghi DB khi GET, cập nhật từng phần, thứ tự ô cố định) | **Chưa làm** | `src/routes/public.js`, `src/routes/admin.js`, `server.js` | Xóa route dư thừa, bảo vệ vòng quay "MaCa". |
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

---

## 4. VIỆC NGƯỜI DÙNG CẦN LÀM THỦ CÔNG

*(Mục này sẽ được cập nhật liên tục qua các bước)*
1. **Sau khi hoàn thành đợt ổn định:** Cần thêm biến môi trường `PUBLIC_BASE_URL` trên Vercel Project Settings với giá trị:
   `https://vong-quay-kappa.vercel.app`
2. **Cập nhật quy tắc an toàn Firebase:** Dán nội dung file `database.rules.json` vào tab "Rules" trên Firebase Console để khóa quyền đọc/ghi tự do từ client.
3. **Kiểm tra và xoay khóa:** Thu hồi và cấp lại các khóa API nếu từng bị vô tình lộ trong lịch sử cũ.
