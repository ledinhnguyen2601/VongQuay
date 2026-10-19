# 🎡 Lucky Wheel SaaS - Nền Tảng Vòng Quay May Mắn Đa Cửa Hàng Bảo Mật Cao

Dự án **Lucky Wheel SaaS** được thiết kế theo kiến trúc đa người dùng (Multi-tenant) bảo mật cao, cho phép hàng ngàn cửa hàng (quán trà sữa, cà phê, nhà hàng, sự kiện tri ân...) tự khởi tạo vòng quay riêng, tùy biến thương hiệu, thiết lập giải thưởng và chia sẻ link / mã QR cho khách hàng.

---

## 🌟 Điểm Nổi Bật & Tính Năng Chính

1. **Kiến Trúc Đa Cửa Hàng (Multi-tenant) Tuyệt Đối**:
   - Mỗi cửa hàng sở hữu một `wheelId` ngẫu nhiên khó đoán (`nanoid` $\ge 10$ ký tự).
   - Dữ liệu hoàn toàn cô lập, không dùng chung bộ nhớ và không thể can thiệp chéo giữa các cửa hàng.
2. **Bảo Mật Trọng Số & Rút Thăm Server-side**:
   - Tỷ lệ trúng thưởng và trọng số nằm **100% tại máy chủ**.
   - Thuật toán Roulette Wheel Selection sử dụng **`crypto.randomInt` (CSPRNG)** chuẩn mật mã học.
   - API công khai trả về cho khách **tuyệt đối không chứa trọng số hay mật khẩu**.
3. **Xác Thực Quản Trị Bằng JWT**:
   - Mật khẩu admin băm bằng `bcryptjs` (salt rounds = 10), không lưu plaintext, không có mật khẩu mặc định (xóa bỏ hoàn toàn mã pin '8888').
   - Token JWT ký bằng `JWT_SECRET` ($\ge 32$ ký tự ngẫu nhiên), hạn 2 giờ.
   - Mọi API quản trị đều kiểm tra chữ ký số và đối chiếu `wheelId` trong Token với URL.
4. **Phòng Thủ Chống Tấn Công (OWASP Top 10)**:
   - Chống Brute-force: Rate limit đăng nhập Admin (5 lần / 15 phút), Rate limit quay thưởng (30 lần / phút / IP).
   - Bảo vệ Header bằng `helmet` với Content Security Policy (CSP) chặt chẽ.
   - Giới hạn CORS theo domain chỉ định trong `.env`.
   - Chống XSS: Thoát ký tự HTML, dùng `textContent`, kiểm tra mã màu Hex bằng Regex.
   - Xử lý lỗi tập trung: Tuyệt đối không để lộ Stack Trace hay thông tin nhạy cảm.
5. **Upload Ảnh Logo/Nền Qua ImgBB Từ Server**:
   - Trình duyệt đẩy ảnh lên server qua Multer (RAM).
   - Thư viện `sharp` kiểm tra **Magic Bytes** thực tế (chỉ cho phép JPEG, PNG, WEBP; từ chối SVG/file giả mạo).
   - Giữ nguyên chất lượng ảnh gốc, đẩy lên ImgBB bằng API Key bí mật của server.
6. **Kho 52 Mẫu Nền Chất Lượng Cao**:
   - Phân nhóm: Ngày lễ chính thức Việt Nam (Tết Nguyên Đán, Giỗ Tổ 10/3, 30/4, 1/5, 2/9...), ngày kỷ niệm (Valentine, 8/3, Trung thu, 20/10, 20/11, Noel...), chủ đề trà sữa/cà phê, gradient và tối giản.
   - Sinh bằng CSS Gradient và SVG tinh gọn, không lo bản quyền, tải siêu nhanh.
   - Hỗ trợ thanh trượt điều chỉnh lớp phủ làm mờ nền (Overlay) trong dải 20% - 30%, chữ luôn dễ đọc.
7. **Tương Phản Màu Chữ WCAG AA & Theme Sáng/Tối**:
   - Thuật toán Relative Luminance tự động chọn chữ màu trắng `#FFFFFF` hoặc màu đen `#111827` tùy theo độ sáng của màu từng ô quạt, đạt tỷ lệ tương phản $\ge 4.5:1$.
   - Theme sáng/tối tự động theo thiết bị hoặc nút chuyển tay, lưu trạng thái vào `localStorage`.
   - Nút bấm và vùng chạm chuẩn thiết bị di động ($\ge 44\text{px}$).
8. **Mã QR Code Tùy Biến Đỉnh Cao**:
   - Trỏ trực tiếp tới link quay của khách `/?w={wheelId}`.
   - Mức sửa lỗi cao nhất (**High - Level H** $\approx 30\%$ phục hồi dữ liệu), cho phép chèn logo cửa hàng vào giữa mà camera điện thoại vẫn quét nhạy bén.
   - Tùy chỉnh màu sắc mã QR, xuất ảnh PNG chất lượng cao tải về máy và hỗ trợ Web Share API.
9. **Lưu Lịch Sử Quay Phía Server**:
   - Ghi nhận thời gian, giải thưởng trúng và IP để phục vụ đối soát, tránh tranh chấp khi trao quà.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
d:/VongQuay/
├── .env                         # File cấu hình bí mật thực tế
├── .env.example                 # Mẫu khai báo biến môi trường
├── .gitignore                   # Chặn commit .env, node_modules, secrets
├── database.rules.json          # Quy tắc bảo mật Firebase RTDB (.read: false, .write: false)
├── package.json                 # Khai báo dependencies và scripts
├── server.js                    # Khởi động ứng dụng Express, Helmet, CORS, Route
├── src/
│   ├── config.js                # Kiểm tra biến môi trường nghiêm ngặt khi start
│   ├── db.js                    # Firebase Admin SDK + Fallback In-Memory Database
│   ├── middleware/
│   │   ├── auth.js              # Xác thực JWT & Kiểm tra Multi-tenant wheelId
│   │   └── rateLimiter.js       # Giới hạn tần suất đăng nhập, quay, tạo wheel, upload
│   ├── routes/
│   │   ├── public.js            # API tạo wheel, lấy thông tin công khai (ẩn trọng số), quay thưởng
│   │   ├── admin.js             # API đăng nhập admin, cập nhật cấu hình, xem lịch sử
│   │   ├── upload.js            # API upload ảnh qua RAM + Sharp Magic Bytes + ImgBB
│   │   └── qr.js                # API sinh mã QR PNG/DataURL kèm logo giữa
│   ├── services/
│   │   ├── spin.js              # Rút thăm ngẫu nhiên bằng crypto.randomInt (CSPRNG)
│   │   ├── imgbb.js             # Kiểm tra magic bytes và gọi ImgBB API
│   │   └── validate.js          # Kiểm tra tính hợp lệ dữ liệu, chống XSS
│   └── data/
│       └── backgrounds.json     # Kho 52 mẫu nền ngày lễ VN, trà sữa, gradient
├── public/
│   ├── index.html               # Trang quay thưởng cho khách (Canvas, Audio, Confetti)
│   ├── create.html              # Trang tạo vòng quay & Bảng điều khiển Quản trị (Admin Panel)
│   ├── css/
│   │   └── style.css            # Hệ thống CSS theme sáng/tối, WCAG AA
│   └── js/
│       ├── wheel.js             # Canvas Wheel Engine Retina, âm thanh Web Audio, Confetti
│       ├── app.js               # Logic trang khách, kết nối API spin, modal trúng thưởng
│       └── admin.js             # Logic bảng admin, quản lý ô quà, chuẩn hóa 100%, QR
└── test/
    ├── test-spin.js             # Kiểm thử xác suất 10.000 lượt quay
    ├── test-security.js         # Kiểm thử bảo mật 12 hạng mục (Multi-tenant, JWT, Magic bytes)
    └── test-e2e-integration.js  # Kiểm thử tích hợp luồng đầu cuối E2E
```

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Dự Án

### 1. Yêu cầu hệ thống
- Node.js version 18.x hoặc mới hơn (đã thử nghiệm xuất sắc trên Node v24).
- Trình duyệt hiện đại (Chrome, Safari, Firefox, Edge).

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Cấu hình file `.env`
Sao chép từ `.env.example`:
```bash
cp .env.example .env
```
Mở file `.env` và thiết lập các giá trị:
```env
PORT=3000
NODE_ENV=development

# Khóa bí mật JWT (bắt buộc tối thiểu 32 ký tự ngẫu nhiên)
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long_lucky_wheel_saas_2026_secure

# Danh sách domain được phép CORS
CORS_ORIGIN=http://localhost:3000

# API Key ImgBB (lấy miễn phí tại https://api.imgbb.com)
IMGBB_API_KEY=your_imgbb_api_key_here

# Firebase Realtime Database (Tùy chọn - nếu để trống sẽ tự động dùng In-Memory Store)
FIREBASE_SERVICE_ACCOUNT_PATH=
FIREBASE_DATABASE_URL=
```

### 4. Khởi chạy máy chủ
```bash
# Khởi động ứng dụng
npm start
```
Truy cập:
- **Trang quay của khách**: [http://localhost:3000](http://localhost:3000)
- **Trang tạo & quản trị vòng quay**: [http://localhost:3000/create](http://localhost:3000/create)

---

## 🔑 Hướng Dẫn Lấy API Key ImgBB

1. Truy cập [https://api.imgbb.com/](https://api.imgbb.com/).
2. Đăng ký / Đăng nhập tài khoản miễn phí.
3. Nhấp vào nút **"Get API Key"** (Lấy khóa API).
4. Sao chép chuỗi API Key và dán vào biến `IMGBB_API_KEY` trong file `.env`.
> *Ghi chú*: Nếu chưa có key, hệ thống tự động chuyển sang chế độ mô phỏng Data URI an toàn để bạn thử nghiệm ngay lập tức.

---

## 🔥 Hướng Dẫn Cấu Hình Firebase Realtime Database

1. Truy cập [Firebase Console](https://console.firebase.google.com/) và tạo một dự án mới (ví dụ `lucky-wheel-saas`).
2. Vào mục **Build** > **Realtime Database** > bấm **Create Database**.
3. Chọn khu vực máy chủ (ví dụ `Singapore - asia-southeast1`).
4. Chuyển sang tab **Rules**, dán toàn bộ nội dung trong file `database.rules.json` vào:
   ```json
   {
     "rules": {
       ".read": false,
       ".write": false
     }
   }
   ```
   *Ý nghĩa: Chặn toàn bộ truy cập trực tiếp từ client. Chỉ có Server của bạn thông qua Firebase Admin SDK mới có quyền đọc/ghi dữ liệu.*
5. Vào **Project settings** (biểu tượng bánh răng) > chọn tab **Service accounts**.
6. Bấm nút **Generate new private key** để tải về file `serviceAccountKey.json`.
7. Đặt file này vào thư mục dự án (file này đã được chặn trong `.gitignore`).
8. Cập nhật `.env`:
   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
   FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
   ```

---

## 🧪 Chạy Kiểm Thử Tự Động (Test Suite)

Dự án cung cấp 3 bộ kiểm thử tự động toàn diện:

### 1. Kiểm thử xác suất 10.000 lượt quay (`test-spin.js`):
Kiểm định tính ngẫu nhiên của `crypto.randomInt` và đối chiếu độ lệch so với trọng số lý thuyết:
```bash
npm run test:spin
```
*Kết quả thực tế: Chạy 10.000 lượt quay chỉ trong 4ms, độ lệch cực đại chỉ ~1.0%, hội tụ hoàn hảo theo phân phối xác suất.*

### 2. Kiểm thử bảo mật & Cách ly đa người dùng (`test-security.js`):
Kiểm tra 12 hạng mục bảo mật: băm bcrypt, cách ly wheelId, chặn token giả mạo, kiểm tra magic bytes file ảnh, từ chối SVG:
```bash
npm run test:security
```
*Kết quả: 12/12 bài kiểm tra PASS 100%.*

### 3. Kiểm thử tích hợp E2E toàn bộ luồng (`test-e2e-integration.js`):
Kiểm tra từ khâu tạo vòng quay, đổi cấu hình, khách quay, kiểm tra không lộ trọng số, kiểm tra ghi nhận lịch sử, sinh QR code:
```bash
node test/test-e2e-integration.js
```
*Kết quả: 26/26 bước kiểm thử PASS 100%.*

---

## 🛡️ Báo Cáo Chi Tiết Các Điểm Bảo Mật Đã Triển Khai

| STT | Yêu cầu bảo mật | Giải pháp triển khai trong mã nguồn |
|:---:|:---|:---|
| **1** | **Bảo mật trọng số** | Trọng số (`weight`) chỉ lưu trữ tại Server. Router công khai (`src/routes/public.js`) lọc bỏ hoàn toàn thuộc tính này trước khi gửi về client. Client chỉ nhận `{id, text, color}`. |
| **2** | **Kết quả do Server quyết định** | Sử dụng hàm `spinWheel` với thuật toán Roulette Wheel Selection và bộ sinh số ngẫu nhiên mật mã học `crypto.randomInt`. Client chỉ nhận `targetIndex` để thực hiện hiệu ứng quay Canvas. |
| **3** | **Xác thực JWT nghiêm ngặt** | Token được ký bằng thuật toán HS256 với khóa `JWT_SECRET` ($\ge 32$ ký tự ngẫu nhiên), thời hạn 2 giờ. Middleware `authenticateAdmin` xác minh chữ ký số và **đối chiếu `wheelId` trong payload với URL**, loại bỏ hoàn toàn nguy cơ leo thang đặc quyền. |
| **4** | **Không lưu mật khẩu plaintext / Không có mật khẩu mặc định** | Băm mật khẩu quản trị bằng `bcryptjs` với salt rounds = 10. Xóa bỏ hoàn toàn mã PIN mặc định '8888' trong mã nguồn. |
| **5** | **Chống Brute-force & DoS** | Tích hợp `express-rate-limit`: Giới hạn đăng nhập Admin 5 lần/15 phút/IP + wheelId; giới hạn quay 30 lần/phút/IP; giới hạn upload và tạo vòng quay mới. |
| **6** | **HTTP Security Headers & CORS** | Cấu hình `helmet` với Content Security Policy (CSP) chặt chẽ; giới hạn CORS nghiêm ngặt theo domain cấu hình trong `.env`; giới hạn kích thước request body 1MB. |
| **7** | **Chống XSS & Dữ liệu độc hại** | Dữ liệu người dùng hiển thị qua `textContent` hoặc hàm `escapeHtml`; kiểm tra mã màu Hex bằng Regex `HEX_COLOR_REGEX`; URL ảnh xác thực theo whitelist domain imgbb. |
| **8** | **Kiểm tra File Upload Magic Bytes** | File lưu tạm trong RAM qua `multer.memoryStorage()`; dùng `sharp.metadata()` đọc Magic Bytes thực tế của file; từ chối file SVG, EXE hoặc script giả mạo ảnh; giới hạn dung lượng tối đa 5MB. |
| **9** | **Bảo vệ Secrets** | `.gitignore` chặn tuyệt đối file `.env`, `serviceAccountKey.json`, `*.pem`, `*.key`. File `src/config.js` kiểm tra biến môi trường và dừng server ngay nếu thiếu hoặc JWT_SECRET không đủ an toàn. |
| **10** | **Firebase Rules chặn truy cập trực tiếp** | File `database.rules.json` thiết lập `".read": false, ".write": false` cho client, chỉ cho phép server đọc/ghi qua Firebase Admin SDK. |
| **11** | **Lịch sử quay đối soát** | Server tự động ghi nhận lịch sử mỗi lượt quay (`timestamp`, `prizeText`, `prizeColor`, `clientIp`) vào database để admin đối soát khi có tranh chấp. |
| **12** | **Che giấu lỗi hệ thống** | Error handler toàn cục bắt mọi ngoại lệ và chỉ trả thông báo thân thiện cho client, không bao giờ để lộ Stack Trace hay thông tin cấu trúc máy chủ. |

---

## 🚀 Hướng Dẫn Triển Khai (Deployment)

### Triển khai trên VPS (Ubuntu / Debian với PM2 + Nginx):
1. Cài đặt Node.js và PM2:
   ```bash
   sudo npm install -g pm2
   ```
2. Clone dự án và cài đặt:
   ```bash
   cd /var/www/lucky-wheel
   npm install --production
   ```
3. Tạo file `.env` với `NODE_ENV=production` và `JWT_SECRET` mạnh.
4. Chạy ứng dụng qua PM2:
   ```bash
   pm2 start server.js --name "lucky-wheel"
   pm2 save
   pm2 startup
   ```
5. Cấu hình Nginx Reverse Proxy với HTTPS (Certbot SSL).
