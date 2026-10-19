/**
 * Lucky Wheel SaaS - Client Application Logic (Trang quay thưởng cho khách)
 * Xử lý kết nối API công khai, bảo vệ chống XSS, đồng bộ theme sáng/tối.
 * TUYỆT ĐỐI KHÔNG DÙNG ALERT.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý Theme Sáng / Tối
  initTheme();

  // 2. Lấy wheelId từ URL (?w=...)
  const urlParams = new URLSearchParams(window.location.search);
  const wheelId = urlParams.get('w');

  // Tích hợp lối vào Quản Trị ẩn vào khối Logo của chủ quán
  const brandAdminLink = document.getElementById('brandAdminLink');
  if (brandAdminLink) {
    brandAdminLink.href = wheelId ? `/admin?w=${encodeURIComponent(wheelId)}` : '/create';
  }

  if (!wheelId) {
    showNoWheelState();
    return;
  }

  // 3. Tải thông tin vòng quay công khai
  loadWheelData(wheelId);
});

let currentWheelInstance = null;
let currentWheelData = null;

/**
 * Khởi tạo Theme Sáng / Tối
 */
function initTheme() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const storedTheme = localStorage.getItem('theme_preference');

  if (storedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else if (storedTheme === 'light') {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }

  updateThemeIcon();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark') ||
        (!document.documentElement.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('theme_preference', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme_preference', 'dark');
      }
      updateThemeIcon();
    });
  }
}

function updateThemeIcon() {
  const iconSun = document.getElementById('iconSun');
  const iconMoon = document.getElementById('iconMoon');
  if (!iconSun || !iconMoon) return;

  const isDark = document.documentElement.classList.contains('dark') ||
    (!document.documentElement.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    iconSun.classList.remove('hidden');
    iconMoon.classList.add('hidden');
  } else {
    iconSun.classList.add('hidden');
    iconMoon.classList.remove('hidden');
  }
}

/**
 * Hiển thị giao diện khi chưa có mã vòng quay
 */
function showNoWheelState() {
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const wheelTitle = document.getElementById('wheelTitle');
  const wheelSubtitle = document.getElementById('wheelSubtitle');

  if (loadingState) loadingState.classList.add('hidden');
  if (emptyState) emptyState.classList.remove('hidden');
  if (wheelTitle) wheelTitle.textContent = 'Lucky Wheel SaaS';
  if (wheelSubtitle) wheelSubtitle.textContent = 'Nền tảng vòng quay may mắn đa cửa hàng';
}

/**
 * Tải dữ liệu công khai của vòng quay từ API
 */
async function loadWheelData(wheelId) {
  const loadingState = document.getElementById('loadingState');
  const mainContent = document.getElementById('mainContent');
  const errorAlert = document.getElementById('errorAlert');

  try {
    const res = await fetch(`/api/wheels/${encodeURIComponent(wheelId)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không tìm thấy vòng quay này.');
    }

    currentWheelData = data.wheel;

    // Áp dụng tên quán / tên vòng quay (Dùng textContent để chống XSS)
    const wheelNameElem = document.getElementById('wheelTitle');
    if (wheelNameElem) {
      wheelNameElem.textContent = currentWheelData.name || 'Vòng Quay May Mắn';
    }
    document.title = `${currentWheelData.name || 'Vòng Quay May Mắn'} | Lucky Wheel`;

    // Áp dụng Logo nếu có (Ẩn placeholder mặc định khi có ảnh Logo)
    const headerLogo = document.getElementById('headerLogo');
    const defaultLogoPlaceholder = document.getElementById('defaultLogoPlaceholder');
    if (currentWheelData.logoUrl) {
      if (headerLogo) {
        headerLogo.src = currentWheelData.logoUrl;
        headerLogo.classList.remove('hidden');
      }
      if (defaultLogoPlaceholder) defaultLogoPlaceholder.classList.add('hidden');
    } else {
      if (headerLogo) headerLogo.classList.add('hidden');
      if (defaultLogoPlaceholder) defaultLogoPlaceholder.classList.remove('hidden');
    }

    // Áp dụng Nền và Lớp phủ (Overlay)
    applyBackground(currentWheelData.background, currentWheelData.backgroundOpacity);

    // Khởi tạo Canvas vòng quay
    setupWheelCanvas(currentWheelData.segments, currentWheelData.logoUrl);

    // Hiển thị giao diện chính
    if (loadingState) loadingState.classList.add('hidden');
    if (mainContent) mainContent.classList.remove('hidden');

    // Thiết lập các nút tương tác
    setupInteractions(wheelId);
  } catch (err) {
    if (loadingState) loadingState.classList.add('hidden');
    if (errorAlert) {
      errorAlert.classList.remove('hidden');
      const errorMsg = document.getElementById('errorMsg');
      if (errorMsg) errorMsg.textContent = err.message;
    }
  }
}

/**
 * Áp dụng Nền và Độ mờ
 */
function applyBackground(background, opacity) {
  const bgLayer = document.getElementById('bgLayer');
  const bgOverlay = document.getElementById('bgOverlay');

  if (bgLayer && background) {
    if (background.startsWith('http://') || background.startsWith('https://') || background.startsWith('data:image')) {
      bgLayer.style.backgroundImage = `url("${background}")`;
    } else {
      bgLayer.style.background = background;
    }
  }

  if (bgOverlay) {
    const safeOpacity = Math.min(Math.max(Number(opacity) || 0.25, 0.20), 0.30);
    bgOverlay.style.opacity = safeOpacity;
  }
}

/**
 * Thiết lập Canvas vòng quay
 */
function setupWheelCanvas(segments, logoUrl) {
  const pointer = document.getElementById('wheelPointer');

  currentWheelInstance = new LuckyWheel('wheelCanvas', {
    segments: segments || [],
    logoUrl: logoUrl || '',
    onTick: () => {
      if (pointer) {
        pointer.classList.add('tick');
        setTimeout(() => pointer.classList.remove('tick'), 60);
      }
    },
    onSpinEnd: (targetIndex, prize) => {
      handleSpinSuccess(prize);
    }
  });
}

/**
 * Thiết lập các sự kiện tương tác
 */
function setupInteractions(wheelId) {
  const spinBtn = document.getElementById('spinBtn');
  const centerSpinBtn = document.getElementById('centerSpinBtn');

  const executeSpin = () => {
    if (!currentWheelInstance || currentWheelInstance.isSpinning) return;
    performSpinRequest(wheelId);
  };

  if (spinBtn) spinBtn.addEventListener('click', executeSpin);
  if (centerSpinBtn) centerSpinBtn.addEventListener('click', executeSpin);
}

/**
 * Gọi API thực hiện quay may mắn
 */
async function performSpinRequest(wheelId) {
  const spinBtn = document.getElementById('spinBtn');
  const centerSpinBtn = document.getElementById('centerSpinBtn');

  // Khóa nút bấm
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (centerSpinBtn) {
    centerSpinBtn.disabled = true;
  }

  try {
    const res = await fetch(`/api/wheels/${encodeURIComponent(wheelId)}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Quay thưởng thất bại. Vui lòng thử lại sau.');
    }

    // Bắt đầu hiệu ứng quay tới ô do server quyết định với thời gian random thật sự 5s - 19s
    currentWheelInstance.spinTo(data.targetIndex);
  } catch (err) {
    showToast(err.message, 'error');
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
    if (centerSpinBtn) {
      centerSpinBtn.disabled = false;
    }
  }
}

/**
 * Xử lý khi vòng quay kết thúc
 */
function handleSpinSuccess(prize) {
  const spinBtn = document.getElementById('spinBtn');
  const centerSpinBtn = document.getElementById('centerSpinBtn');

  // Mở khóa nút bấm sau khi quay xong
  if (spinBtn) {
    spinBtn.disabled = false;
    spinBtn.classList.remove('opacity-75', 'cursor-not-allowed');
  }
  if (centerSpinBtn) {
    centerSpinBtn.disabled = false;
  }

  // Mở Modal chúc mừng
  const winModal = document.getElementById('winModal');
  const prizeResultText = document.getElementById('prizeResultText');

  if (prizeResultText) {
    prizeResultText.textContent = prize.text || 'Phần quà bí mật';
  }

  if (winModal) {
    winModal.classList.remove('hidden');
    winModal.classList.add('flex');
  }
}

/**
 * Đóng Modal trúng thưởng
 */
window.closeWinModal = function () {
  const winModal = document.getElementById('winModal');
  if (winModal) {
    winModal.classList.add('hidden');
    winModal.classList.remove('flex');
  }
};


/**
 * Sao chép text vào clipboard
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}

/**
 * Hiển thị Toast thông báo đẹp mắt, không dùng alert
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600 border border-rose-500' : 'bg-slate-900 border border-slate-700';
  toast.className = `fixed bottom-5 left-1/2 -translate-x-1/2 ${bg} text-white px-5 py-3 rounded-full text-sm font-medium shadow-2xl z-50 animate-bounce`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}
