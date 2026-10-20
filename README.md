# 🎡 Lucky Wheel SaaS - Nền Tảng Vòng Quay May Mắn Đa Cửa Hàng

Dự án **Lucky Wheel SaaS** được thiết kế theo kiến trúc đa cửa hàng (Multi-tenant), cho phép các cửa hàng (quán trà sữa, cà phê, nhà hàng, sự kiện tri ân...) tự khởi tạo vòng quay riêng, tùy biến thương hiệu, thiết lập giải thưởng và chia sẻ link / mã QR cho khách hàng.

---

## 🌟 Điểm Nổi Bật & Tính Năng Chính

1. **Kiến Trúc Đa Cửa Hàng (Multi-tenant)**:
   - Mỗi cửa hàng sở hữu một `wheelId` ngẫu nhiên khó đoán (`nanoid` $\ge 10$ ký tự).
   - Dữ liệu cô lập theo từng cửa hàng, kiểm tra phân quyền token JWT chặt chẽ để ngăn chặn can thiệp chéo giữa các tài khoản.
2. **Bảo Mật Trọng Số & Rút Thăm Phía Máy Chủ (Server-side)**:
   - Trọng số và tỷ lệ trúng thưởng được lưu trữ và tính toán tại máy chủ.
   - Thuật toán Roulette Wheel Selection sử dụng bộ sinh số ngẫu nhiên mật mã học **`crypto.randomInt` (CSPRNG)**.
   - API công khai trả về cho trình duyệt không chứa thuộc tính trọng số (`weight`), mật khẩu quản trị (`passwordHash`) hay IP khách (`clientIp`).
   - Kết quả trúng thưởng được xác định có tính thẩm quyền từ máy chủ (`data.prize`).
3. **Xác Thực Quản Trị Bằng JWT**:
   - Mật khẩu quản trị được băm an toàn bằng `bcryptjs` (salt rounds = 10), không lưu mật khẩu dạng văn bản thuần và không sử dụng mật khẩu mặc định.
   - Token JWT ký bằng `JWT_SECRET` (yêu cầu tối thiểu 32 ký tự ngẫu nhiên trong môi trường production).
   - Mọi thao tác quản trị đều xác thực chữ ký số và đối chiếu `wheelId` trong Token với tham số yêu cầu.
4. **Phòng Thủ Ứng Dụng Web**:
   - Giới hạn tần suất (Rate limiting): Hạn chế tấn công brute-force mật khẩu quản trị và điều tiết số lượt quay thưởng.
   - Header bảo vệ bằng `helmet` với Content Security Policy (CSP).
   - Cấu hình CORS chặt chẽ theo danh sách domain trong biến môi trường `CORS_ORIGIN`.
   - Chống XSS: Thoát ký tự HTML khi hiển thị và kiểm tra mã màu Hex bằng biểu thức chính quy.
   - Xử lý lỗi tập trung: Không để lộ Stack Trace hay thông tin cấu trúc máy chủ ra phía người dùng.
5. **Upload Ảnh Logo & Hình Nền Qua ImgBB**:
   - File tải lên được xử lý tạm thời trong bộ nhớ RAM qua `multer` với giới hạn dung lượng 4MB.
   - Thư viện `sharp` kiểm tra Magic Bytes thực tế của tệp (chỉ chấp nhận JPEG, PNG, WEBP; từ chối file SVG, EXE hoặc script giả mạo).
   - Tải lên ImgBB bằng API Key bí mật của server, URL ảnh lưu trữ bắt buộc thuộc tên miền an toàn (`i.ibb.co` hoặc `ibb.co`).
6. **Kho 52 Mẫu Nền Tối Ưu**:
   - Phân nhóm: Ngày lễ Việt Nam, ngày kỷ niệm, chủ đề quán trà sữa/cà phê, gradient và tối giản.
   - Sinh bằng CSS Gradient và SVG tinh gọn, tải nhanh và tiết kiệm băng thông.
   - Hỗ trợ thanh trượt điều chỉnh lớp phủ làm mờ nền (Overlay) trong dải 20% - 30% để chữ luôn dễ đọc.
7. **Tương Phản Màu Chữ WCAG AA & Theme Sáng/Tối**:
   - Thuật toán Relative Luminance tự động chọn chữ màu trắng `#FFFFFF` hoặc màu đen `#111827` tùy theo độ sáng của màu từng ô quạt, đạt tỷ lệ tương phản $\ge 4.5:1$.
   - Theme sáng/tối tự động theo thiết bị hoặc nút chuyển tay.
   - Nút bấm và vùng chạm chuẩn thiết bị di động ($\ge 44\text{px}$).
8. **Mã QR Code Tùy Biến**:
   - Đường dẫn trong mã QR được sinh chuẩn xác từ biến môi trường `PUBLIC_BASE_URL`.
   - Mức sửa lỗi High (Level H) hỗ trợ chèn logo cửa hàng vào giữa mà thiết bị quét vẫn nhận diện tốt.
   - Tùy chỉnh màu sắc mã QR và hỗ trợ tải ảnh PNG về máy.
9. **Lưu Lịch Sử Quay Phía Server**:
   - Ghi nhận thời gian, giải thưởng trúng, chỉ số ô và địa chỉ IP thực của khách để phục vụ đối soát, hạn chế tranh chấp khi trao quà.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
d:/VongQuay/
├── .env.example                 # Mẫu khai báo biến môi trường chuẩn
├── .gitattributes               # Quy tắc chuẩn hóa xuống dòng (* text=auto eol=lf)
├── .gitignore                   # Chặn commit .env, node_modules, file khóa bí mật
├── database.rules.json          # Quy tắc bảo mật Firebase RTDB (.read: false, .write: false)
├── package.json                 # Khai báo dependencies và kịch bản test
├── server.js                    # Khởi động ứng dụng Express, Middleware, Routes
├── api/
│   └── index.js                 # Entrypoint phục vụ Vercel Serverless Function
├── src/
│   ├── config.js                # Kiểm tra nghiêm ngặt biến môi trường
│   ├── db.js                    # Firebase Admin SDK + Fallback In-Memory (chỉ khi dev)
│   ├── middleware/
│   │   ├── auth.js              # Xác thực JWT & Kiểm tra Multi-tenant wheelId
│   │   └── rateLimiter.js       # Giới hạn tần suất đăng nhập, quay, tạo wheel, upload
│   ├── routes/
│   │   ├── public.js            # API công khai: xem thông tin, quay thưởng (ẩn trọng số)
│   │   ├── admin.js             # API quản trị: đăng nhập, cấu hình, xem lịch sử
│   │   ├── upload.js            # API upload ảnh logo/nền qua RAM + Sharp + ImgBB
│   │   └── qr.js                # API sinh mã QR PNG kèm logo giữa
│   ├── services/
│   │   ├── spin.js              # Rút thăm ngẫu nhiên bằng crypto.randomInt (CSPRNG)
│   │   ├── imgbb.js             # Kiểm tra magic bytes và gọi ImgBB API
│   │   └── validate.js          # Kiểm tra tính hợp lệ dữ liệu, chống XSS
│   └── data/
│       └── backgrounds.json     # Kho mẫu nền ngày lễ VN, trà sữa, gradient
├── public/
│   ├── index.html               # Giao diện quay thưởng cho khách
│   ├── create.html              # Giao diện tạo vòng quay mới
│   ├── admin.html               # Giao diện bảng quản trị của chủ quán
│   ├── css/
│   │   └── style.css            # Hệ thống CSS theme sáng/tối, chuẩn WCAG AA
│   └── js/
│       ├── wheel.js             # Canvas Wheel Engine, âm thanh Web Audio, Confetti
│       ├── app.js               # Logic trang khách, kết nối API spin, chống bấm đúp
│       └── admin.js             # Logic bảng admin, quản lý ô quà, xuất QR
└── test/
    ├── playwright-mobile-e2e.test.js  # Kiểm thử Playwright giả lập mobile 30 lượt quay
    ├── wheel-math-regression.test.js  # Kiểm thử hồi quy toán học góc dừng 5.382 ca
    ├── test-data-foundation.js        # Kiểm tra cấu hình Firebase prod & /api/health
    ├── test-data-loss-prevention.js   # Kiểm tra chống mất dữ liệu và cập nhật từng phần
    ├── test-distribution-real.js      # Kiểm định phân phối xác suất 5.000 lượt quay
    ├── test-logo-and-background.js    # Kiểm tra upload ảnh 4MB và domain ImgBB
    ├── test-share-link-and-qr.js      # Kiểm tra link chia sẻ và mã QR theo PUBLIC_BASE_URL
    ├── test-security-cleanup.js       # Kiểm tra CORS, JWT_SECRET, phân quyền token
    └── scan-secrets.js                # Quét mã nguồn và lịch sử git tìm bí mật
```

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Development)

### 1. Yêu cầu hệ thống
- Node.js phiên bản 18.x trở lên.
- Trình duyệt hiện đại (Chrome, Safari, Firefox, Edge).

### 2. Cài đặt thư viện
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` từ file mẫu:
```bash
cp .env.example .env
```
Thiết lập các giá trị trong `.env`:
```env
PORT=3000
NODE_ENV=development

# Khóa bí mật ký JWT (trong production bắt buộc >= 32 ký tự ngẫu nhiên)
JWT_SECRET=your_random_jwt_secret_at_least_32_characters

# Domain được phép truy cập CORS (phân tách bằng dấu phẩy)
CORS_ORIGIN=http://localhost:3000

# Địa chỉ công khai gốc của website
PUBLIC_BASE_URL=https://vong-quay-kappa.vercel.app

# API Key ImgBB (lấy miễn phí tại https://api.imgbb.com)
IMGBB_API_KEY=your_imgbb_api_key_here

# Firebase Realtime Database:
# Khi chạy cục bộ, có thể trỏ file JSON service account:
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

### 4. Khởi chạy máy chủ cục bộ
```bash
npm start
```
Truy cập:
- **Trang quay thưởng của khách**: [http://localhost:3000](http://localhost:3000)
- **Trang tạo vòng quay mới**: [http://localhost:3000/create](http://localhost:3000/create)

---

## ☁️ Hướng Dẫn Triển Khai Trên Vercel (Production Deployment)

Ứng dụng được thiết kế chạy tối ưu trên nền tảng **Vercel Serverless Functions**.

### 1. Danh sách biến môi trường cần cấu hình trên Vercel
Vào **Project Settings** > **Environment Variables** trên Vercel và khai báo đầy đủ các biến sau:

| Tên biến môi trường | Giá trị thực tế / Mô tả | Bắt buộc |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | Có |
| `PUBLIC_BASE_URL` | `https://vong-quay-kappa.vercel.app` (Địa chỉ domain chính thức) | Có |
| `JWT_SECRET` | Chuỗi ngẫu nhiên bí mật có độ dài $\ge 32$ ký tự | Có |
| `CORS_ORIGIN` | `https://vong-quay-kappa.vercel.app` (hoặc các domain được phép) | Có |
| `IMGBB_API_KEY` | Khóa API lấy từ ImgBB để upload logo/nền | Có |
| `FIREBASE_DATABASE_URL` | Đường dẫn Realtime Database (ví dụ: `https://...firebaseio.com`) | Có |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Nội dung file `serviceAccountKey.json` được mã hóa Base64 | Có |

> **Lưu ý quan trọng về cách tạo chuỗi Base64 cho Firebase:**
> Để đưa file `serviceAccountKey.json` lên biến môi trường Vercel mà không bị lỗi xuống dòng hay ký tự đặc biệt, hãy chạy lệnh sau trên máy tính của bạn:
> - **Linux / macOS:** `base64 -w 0 serviceAccountKey.json` (hoặc `base64 -i serviceAccountKey.json`)
> - **Windows PowerShell:** `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))`
> Sao chép toàn bộ chuỗi kết quả và dán vào biến `FIREBASE_SERVICE_ACCOUNT_BASE64` trên Vercel.

### 2. Quy định về đường dẫn chia sẻ cho khách
- **Tên miền chính thức:** Khách hàng sử dụng đường dẫn xuất phát từ tên miền chính: `https://vong-quay-kappa.vercel.app/?w={wheelId}`.
- **Tên miền bản xem trước (Preview Deployments):** Các link xem trước tự động của Vercel (dạng `*-nguyens-projects-*.vercel.app`) được Vercel tự động kích hoạt tính năng Vercel Authentication để bảo vệ nội bộ. **Không sử dụng link preview này để gửi cho khách hàng.**

---

## 🔥 Quy Tắc An Toàn Firebase Realtime Database

Trên Firebase Console, vào mục **Realtime Database** > chọn tab **Rules** và thiết lập:
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "history": {
      "$wheelId": {
        ".indexOn": ["timestamp"]
      }
    }
  }
}
```
*Ý nghĩa:* Chặn mọi truy cập đọc/ghi trực tiếp từ trình duyệt của người dùng. Chỉ có máy chủ thông qua Firebase Admin SDK mới có quyền tương tác với cơ sở dữ liệu.

---

## 🧪 Hệ Thống Kiểm Thử Tự Động (Test Suites)

Dự án trang bị hệ thống kiểm thử tự động toàn diện kiểm định trên môi trường thực tế:

```bash
# 1. Kiểm thử E2E trình duyệt di động (30 lượt quay liên tiếp qua Playwright giả lập iPhone)
npm run test:e2e:mobile

# 2. Kiểm thử hồi quy toán học góc dừng vòng quay (5.382 ca kiểm thử)
npm run test:math

# 3. Kiểm thử kiểm tra kết nối Firebase trong production & API /api/health
npm run test:data-foundation

# 4. Kiểm thử chống mất dữ liệu (404 khi vòng quay không tồn tại, cập nhật từng phần)
npm run test:dlp

# 5. Kiểm thử phân phối xác suất trúng thưởng (mô phỏng 5.000 lượt quay thực tế)
npm run test:distribution

# 6. Kiểm thử tải ảnh logo/nền, giới hạn 4MB và kiểm tra tên miền ImgBB
npm run test:logo

# 7. Kiểm thử link chia sẻ, mã QR và bảo vệ màn hình quản trị
npm run test:share

# 8. Kiểm thử dọn dẹp bảo mật (CORS, JWT_SECRET, quét bí mật trong git, phân quyền token)
npm run test:sec-cleanup
```

---

## 📝 Giấy Phép & Đóng Góp

Dự án phục vụ mục đích quản lý và vận hành vòng quay may mắn đa cửa hàng, đảm bảo tính minh bạch và độ tin cậy trong các chương trình tri ân khách hàng.
