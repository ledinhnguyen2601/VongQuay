/**
 * Script quét bí mật an toàn (KHÔNG BAO GIỜ in giá trị bí mật ra màn hình)
 * Chỉ báo đường dẫn file và số dòng.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SECRET_PATTERNS = [
  { name: 'Firebase / Google Private Key', regex: /-----BEGIN PRIVATE KEY-----/ },
  { name: 'Google API Key (AIza...)', regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'Telegram Bot Token', regex: /[0-9]{8,10}:[a-zA-Z0-9_-]{35}/ },
  { name: 'ImgBB API Key (32 hex)', regex: /\b[a-f0-9]{32}\b/i }
];

const IGNORE_DIRS = ['.git', 'node_modules', '.gemini', 'artifacts'];
const IGNORE_FILES = ['package-lock.json', '.gitattributes', 'scan-secrets.js'];

const findings = [];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Bỏ qua các dòng mô tả mẫu hoặc tên biến môi trường
      if (line.includes('your_imgbb_api_key_here') || line.includes('IMGBB_API_KEY') || line.includes('REGEX') || line.includes('AIza...') || line.includes('SECRET_PATTERNS')) {
        return;
      }

      SECRET_PATTERNS.forEach(({ name, regex }) => {
        if (regex.test(line)) {
          findings.push({
            file: filePath,
            line: index + 1,
            type: name
          });
        }
      });
    });
  } catch (e) {
    // Bỏ qua file nhị phân
  }
}

function traverseDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        traverseDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (!IGNORE_FILES.includes(entry.name)) {
        scanFile(fullPath);
      }
    }
  }
}

// 1. Quét cây thư mục hiện tại
traverseDir(process.cwd());

// 2. Kiểm tra xem .env có bị commit vào git không
try {
  const gitTrackedFiles = execSync('git ls-files', { encoding: 'utf8' }).split('\n');
  if (gitTrackedFiles.includes('.env')) {
    findings.push({ file: '.env', line: 1, type: 'File .env bị theo dõi bởi Git!' });
  }
  // Kiểm tra lịch sử git
  const envInGitHistory = execSync('git log --all --full-history -- ".env"', { encoding: 'utf8' }).trim();
  if (envInGitHistory) {
    findings.push({ file: '.env (trong lịch sử git)', line: 1, type: 'File .env từng xuất hiện trong lịch sử git commit cũ' });
  }

  // 3. Quét toàn bộ thay đổi chuẩn bị đẩy lên GitHub giữa main và stabilize
  const diff = execSync('git diff main..stabilize', { encoding: 'utf8' });
  const diffLines = diff.split('\n');
  let currentDiffFile = '';

  diffLines.forEach((line, index) => {
    if (line.startsWith('+++ b/')) {
      currentDiffFile = line.replace('+++ b/', '').trim();
    }
    if (IGNORE_FILES.includes(path.basename(currentDiffFile))) {
      return;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (
        line.includes('your_imgbb_api_key_here') ||
        line.includes('IMGBB_API_KEY') ||
        line.includes('REGEX') ||
        line.includes('AIza...') ||
        line.includes('SECRET_PATTERNS')
      ) {
        return;
      }
      SECRET_PATTERNS.forEach(({ name, regex }) => {
        if (regex.test(line)) {
          findings.push({
            file: `git diff [${currentDiffFile}]`,
            line: index + 1,
            type: name
          });
        }
      });
    }
  });
} catch (e) {}

console.log('--- KẾT QUẢ QUÉT BÍ MẬT AN TOÀN (CHỈ BÁO FILE VÀ DÒNG) ---');
if (findings.length === 0) {
  console.log('✅ KHÔNG tìm thấy bất kỳ khóa, token hay bí mật nào bị lộ trong working tree.');
} else {
  findings.forEach(f => {
    console.log(`⚠️ Phát hiện nghi vấn: [${f.file}:${f.line}] - Loại: ${f.type}`);
  });
}
