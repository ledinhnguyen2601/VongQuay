/**
 * Lucky Wheel SaaS - Admin Panel Logic
 * Quản trị vòng quay may mắn: Đổi tên, Tùy biến ô quà & Trọng số, Upload ImgBB qua server,
 * Kho 50+ mẫu nền, Lịch sử đối soát và Xuất QR Code tùy biến.
 * TUYỆT ĐỐI KHÔNG DÙNG ALERT - Toàn bộ thông báo dùng Toast/UI Inline.
 */

let currentWheelId = '';
let currentAdminToken = '';
let wheelData = null;
let allBackgrounds = [];

/**
 * Helper phân tích JSON an toàn, chống crash khi nhận phản hồi HTML lỗi
 */
async function parseResponseJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(res.ok ? 'Phản hồi từ máy chủ không hợp lệ.' : `Lỗi máy chủ (${res.status}). Vui lòng kiểm tra lại kết nối.`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Lấy wheelId từ query (?w=...)
  const params = new URLSearchParams(window.location.search);
  currentWheelId = params.get('w');

  if (!currentWheelId) {
    const warning = document.getElementById('noWheelWarning');
    const adminSection = document.getElementById('adminSection');
    if (warning) warning.classList.remove('hidden');
    if (adminSection) adminSection.classList.add('hidden');

    // Khởi tạo form nhập wheelId và danh sách gần đây
    initNoWheelHandlers();
    return;
  }

  // Khởi tạo các sự kiện
  initAdminEvents();

  // Kiểm tra token đã lưu trong sessionStorage chưa
  const savedToken = sessionStorage.getItem(`admin_token_${currentWheelId}`);
  if (savedToken) {
    currentAdminToken = savedToken;
    // Đọc dữ liệu từ local cache nếu có để hiển thị tức thì (chỉ khi đã đăng nhập)
    const cachedWheel = sessionStorage.getItem(`admin_wheel_cache_${currentWheelId}`);
    if (cachedWheel) {
      try {
        wheelData = JSON.parse(cachedWheel);
        renderAdminUI();
        const adminSection = document.getElementById('adminSection');
        const loadingState = document.getElementById('adminLoadingState');
        if (adminSection) adminSection.classList.remove('hidden');
        if (loadingState) loadingState.classList.add('hidden');
      } catch (e) {}
    }
    loadAdminWheelData();
  } else {
    showLoginForm();
  }
});

/**
 * Xử lý khi chưa có wheelId trên URL
 */
function initNoWheelHandlers() {
  const enterForm = document.getElementById('enterWheelIdForm');
  const inputElem = document.getElementById('inputWheelId');
  if (enterForm && inputElem) {
    enterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputElem.value.trim();
      if (val) {
        window.location.href = `/admin?w=${encodeURIComponent(val)}`;
      }
    });
  }

  renderRecentWheels();
}

/**
 * Hiển thị danh sách vòng quay đã tạo gần đây từ localStorage
 */
function renderRecentWheels() {
  const container = document.getElementById('recentWheelsContainer');
  const listElem = document.getElementById('recentWheelsList');
  if (!container || !listElem) return;

  try {
    const raw = localStorage.getItem('my_created_wheels');
    const wheels = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(wheels) || wheels.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    listElem.innerHTML = wheels.slice(0, 5).map(w => `
      <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition">
        <div>
          <div class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(w.name || 'Vòng quay không tên')}</div>
          <div class="text-[10px] font-mono text-slate-400">ID: ${escapeHtml(w.wheelId)}</div>
        </div>
        <div class="flex gap-2">
          <a href="/admin?w=${encodeURIComponent(w.wheelId)}" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold">
            Quản Trị
          </a>
          <a href="/?w=${encodeURIComponent(w.wheelId)}" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
            Quay
          </a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.classList.add('hidden');
  }
}

/**
 * Lưu một vòng quay vào danh sách gần đây trong localStorage
 */
function recordWheelInRecent(wheelId, name) {
  if (!wheelId) return;
  try {
    const raw = localStorage.getItem('my_created_wheels');
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Xóa mục cũ nếu trùng
    list = list.filter(item => item.wheelId !== wheelId);
    // Đưa lên đầu
    list.unshift({
      wheelId,
      name: name || 'Vòng quay may mắn',
      lastAccessed: new Date().toISOString()
    });
    // Giới hạn 10 vòng quay
    if (list.length > 10) list = list.slice(0, 10);
    localStorage.setItem('my_created_wheels', JSON.stringify(list));
  } catch (e) {
    // Bỏ qua lỗi lưu localStorage
  }
}

/**
 * Hiển thị form đăng nhập Admin
 */
function showLoginForm() {
  const loginModal = document.getElementById('adminLoginModal');
  const loadingState = document.getElementById('adminLoadingState');
  const adminSection = document.getElementById('adminSection');
  if (loadingState) loadingState.classList.add('hidden');
  if (adminSection) adminSection.classList.add('hidden');
  if (loginModal) {
    loginModal.classList.remove('hidden');
    loginModal.classList.add('flex');
  }
}

/**
 * Ẩn form đăng nhập Admin
 */
function hideLoginForm() {
  const loginModal = document.getElementById('adminLoginModal');
  if (loginModal) {
    loginModal.classList.add('hidden');
    loginModal.classList.remove('flex');
  }
}

/**
 * Xử lý đăng nhập Admin
 */
async function handleAdminLogin(password) {
  const loginError = document.getElementById('loginError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');

  if (loginSubmitBtn) {
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Đang xác thực...';
  }
  if (loginError) loginError.classList.add('hidden');

  try {
    const res = await fetch(`/api/admin/wheels/${encodeURIComponent(currentWheelId)}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await parseResponseJson(res);

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Mật khẩu không chính xác.');
    }

    currentAdminToken = data.token;
    sessionStorage.setItem(`admin_token_${currentWheelId}`, data.token);

    hideLoginForm();
    showToast('Đăng nhập quản trị thành công!');
    loadAdminWheelData();
  } catch (err) {
    if (loginError) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  } finally {
    if (loginSubmitBtn) {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Đang Nhập';
    }
  }
}

/**
 * Tải toàn bộ cấu hình vòng quay (kèm trọng số) dành cho Admin
 */
async function loadAdminWheelData() {
  const loadingState = document.getElementById('adminLoadingState');
  const adminSection = document.getElementById('adminSection');

  // Chỉ hiện loading xoay tròn nếu chưa có dữ liệu trong cache
  if (!wheelData && loadingState) {
    loadingState.classList.remove('hidden');
  }

  try {
    const res = await fetch(`/api/admin/wheels/${encodeURIComponent(currentWheelId)}`, {
      headers: {
        'Authorization': `Bearer ${currentAdminToken}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem(`admin_token_${currentWheelId}`);
      sessionStorage.removeItem(`admin_wheel_cache_${currentWheelId}`);
      wheelData = null;
      if (loadingState) loadingState.classList.add('hidden');
      if (adminSection) adminSection.classList.add('hidden');
      showLoginForm();
      return;
    }

    const data = await parseResponseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể tải dữ liệu vòng quay.');
    }

    wheelData = data.wheel;

    // Lưu vào cache để hiển thị tức thì khi quay lại trang
    sessionStorage.setItem(`admin_wheel_cache_${currentWheelId}`, JSON.stringify(wheelData));

    recordWheelInRecent(currentWheelId, wheelData.name);
    renderAdminUI();

    // Ẩn loading và hiển thị giao diện admin
    if (loadingState) loadingState.classList.add('hidden');
    if (adminSection) adminSection.classList.remove('hidden');

    loadBackgroundsGallery();
    loadSpinHistory();
    updateQrPreview();
  } catch (err) {
    if (loadingState) loadingState.classList.add('hidden');
    if (wheelData && adminSection) {
      adminSection.classList.remove('hidden');
    }
    showToast(err.message, 'error');
  }
}

/**
 * Render dữ liệu lên giao diện Admin
 */
function renderAdminUI() {
  if (!wheelData) return;

  // 1. Tên vòng quay
  const nameInput = document.getElementById('wheelNameInput');
  const headerName = document.getElementById('adminHeaderWheelName');
  if (nameInput) nameInput.value = wheelData.name || '';
  if (headerName) headerName.textContent = wheelData.name || 'Vòng Quay May Mắn';

  // 2. Logo quán
  const logoPreview = document.getElementById('logoPreview');
  if (logoPreview && wheelData.logoUrl) {
    logoPreview.src = wheelData.logoUrl;
    logoPreview.classList.remove('hidden');
  }

  // 3. Độ mờ nền (20% - 30%)
  const opacitySlider = document.getElementById('bgOpacitySlider');
  const opacityValText = document.getElementById('bgOpacityValue');
  const currentOpacity = wheelData.backgroundOpacity !== undefined ? wheelData.backgroundOpacity : 0.25;

  if (opacitySlider) opacitySlider.value = Math.round(currentOpacity * 100);
  if (opacityValText) opacityValText.textContent = `${Math.round(currentOpacity * 100)}%`;

  // 4. Danh sách ô quà và trọng số
  renderSegmentsTable();

  // 5. Link chơi của khách: Luôn lấy từ PUBLIC_BASE_URL (không dùng window.location.origin)
  const playerLinkInput = document.getElementById('playerShareLink');
  const baseUrl = (wheelData && wheelData.publicBaseUrl) ? wheelData.publicBaseUrl.replace(/\/+$/, '') : 'https://vong-quay-kappa.vercel.app';
  const playUrl = `${baseUrl}/?w=${encodeURIComponent(currentWheelId)}`;
  if (playerLinkInput) playerLinkInput.value = playUrl;

  const goToPlayBtn = document.getElementById('goToPlayBtn');
  if (goToPlayBtn) goToPlayBtn.href = playUrl;
}

/**
 * Render bảng ô quà
 */
function renderSegmentsTable() {
  const container = document.getElementById('segmentsList');
  if (!container || !wheelData || !wheelData.segments) return;

  container.innerHTML = '';

  const totalWeight = wheelData.segments.reduce((acc, s) => acc + (Number(s.weight) || 0), 0);

  wheelData.segments.forEach((seg, index) => {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60';

    const w = Number(seg.weight) || 0;
    const pct = totalWeight > 0 ? ((w / totalWeight) * 100).toFixed(1) : '0';

    row.innerHTML = `
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <span class="text-xs font-bold text-slate-400 w-5 text-center">${index + 1}</span>
        <input type="color" value="${seg.color}" class="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 seg-color-input" data-index="${index}">
      </div>
      <div class="flex-1 min-w-[140px] w-full sm:w-auto">
        <input type="text" value="${escapeHtml(seg.text)}" maxlength="50" class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg seg-text-input" placeholder="Tên quà..." data-index="${index}">
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        <div class="flex items-center gap-1">
          <span class="text-xs text-slate-500">Trọng số:</span>
          <input type="number" min="0" step="1" value="${w}" class="w-20 px-2 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center seg-weight-input" data-index="${index}">
        </div>
        <span class="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full min-w-[55px] text-center">${pct}%</span>
        <button type="button" class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg delete-seg-btn transition" data-index="${index}" title="Xóa ô này">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    `;

    container.appendChild(row);
  });

  // Gắn sự kiện thay đổi
  attachSegmentEvents();
}

/**
 * Gắn sự kiện cho các ô quà
 */
function attachSegmentEvents() {
  document.querySelectorAll('.seg-color-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = e.target.dataset.index;
      wheelData.segments[idx].color = e.target.value;
    });
  });

  document.querySelectorAll('.seg-text-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = e.target.dataset.index;
      wheelData.segments[idx].text = e.target.value;
    });
  });

  document.querySelectorAll('.seg-weight-input').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = e.target.dataset.index;
      wheelData.segments[idx].weight = Math.max(0, parseFloat(e.target.value) || 0);
      recalculatePercentages();
    });
  });

  document.querySelectorAll('.delete-seg-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (wheelData.segments.length <= 2) {
        showToast('Vòng quay phải có tối thiểu 2 ô quà!', 'error');
        return;
      }
      wheelData.segments.splice(idx, 1);
      renderSegmentsTable();
    });
  });
}

/**
 * Tính lại % khi người dùng đổi trọng số mà chưa cần render lại cả bảng
 */
function recalculatePercentages() {
  const totalWeight = wheelData.segments.reduce((acc, s) => acc + (Number(s.weight) || 0), 0);
  const rows = document.querySelectorAll('#segmentsList > div');
  rows.forEach((row, i) => {
    const pctElem = row.querySelector('span.rounded-full');
    if (pctElem && wheelData.segments[i]) {
      const w = Number(wheelData.segments[i].weight) || 0;
      const pct = totalWeight > 0 ? ((w / totalWeight) * 100).toFixed(1) : '0';
      pctElem.textContent = `${pct}%`;
    }
  });
}

/**
 * Chuẩn hóa các trọng số về tổng 100%
 */
function normalizeWeightsTo100() {
  if (!wheelData || !wheelData.segments || wheelData.segments.length === 0) return;
  const totalWeight = wheelData.segments.reduce((acc, s) => acc + (Number(s.weight) || 0), 0);
  if (totalWeight <= 0) {
    showToast('Tổng trọng số hiện tại bằng 0, không thể chuẩn hóa!', 'error');
    return;
  }

  let allocated = 0;
  wheelData.segments.forEach((seg, i) => {
    if (i === wheelData.segments.length - 1) {
      seg.weight = Math.max(0, 100 - allocated);
    } else {
      const normalized = Math.round((Number(seg.weight) / totalWeight) * 100);
      seg.weight = normalized;
      allocated += normalized;
    }
  });

  renderSegmentsTable();
  showToast('Đã chuẩn hóa tổng trọng số về 100%!');
}

/**
 * Thêm ô quà mới
 */
function addNewSegment() {
  if (wheelData.segments.length >= 24) {
    showToast('Vòng quay chỉ cho phép tối đa 24 ô quà!', 'error');
    return;
  }

  const vibrantColors = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'];
  const nextColor = vibrantColors[wheelData.segments.length % vibrantColors.length];

  wheelData.segments.push({
    id: `seg_${Date.now()}`,
    text: `Quà số ${wheelData.segments.length + 1}`,
    color: nextColor,
    weight: 10
  });

  renderSegmentsTable();
}

/**
 * Tải kho nền từ API
 */
async function loadBackgroundsGallery() {
  try {
    const res = await fetch('/api/backgrounds');
    const data = await parseResponseJson(res);
    if (data.success && Array.isArray(data.backgrounds)) {
      allBackgrounds = data.backgrounds;
      renderBackgroundGallery('all');
    }
  } catch (e) {
    console.error('Không tải được danh sách nền:', e);
  }
}

/**
 * Render kho nền theo tab lọc
 */
function renderBackgroundGallery(category = 'all') {
  const container = document.getElementById('bgGalleryGrid');
  if (!container) return;

  container.innerHTML = '';
  const filtered = category === 'all'
    ? allBackgrounds
    : allBackgrounds.filter((bg) => bg.category === category);

  filtered.forEach((bg) => {
    const card = document.createElement('div');
    card.className = 'group relative rounded-xl overflow-hidden border-2 cursor-pointer transition hover:scale-105 h-20 flex flex-col justify-end p-2.5';
    card.style.background = bg.value;

    const isSelected = wheelData && wheelData.background === bg.value;
    card.classList.add(isSelected ? 'border-amber-400' : 'border-transparent');

    card.innerHTML = `
      <div class="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition"></div>
      <span class="relative z-10 text-[11px] font-bold text-white drop-shadow truncate">${escapeHtml(bg.name)}</span>
    `;

    card.addEventListener('click', () => {
      wheelData.background = bg.value;
      renderBackgroundGallery(category);
      showToast(`Đã chọn nền: ${bg.name}`);
    });

    container.appendChild(card);
  });
}

/**
 * Tải lịch sử quay thưởng
 */
async function loadSpinHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  try {
    const res = await fetch(`/api/admin/wheels/${encodeURIComponent(currentWheelId)}/history`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` }
    });
    const data = await parseResponseJson(res);

    if (!data.success || !Array.isArray(data.history) || data.history.length === 0) {
      historyList.innerHTML = '<p class="text-sm text-slate-400 py-4 text-center">Chưa có lượt quay nào được ghi nhận.</p>';
      return;
    }

    historyList.innerHTML = '';
    data.history.forEach((item) => {
      const date = new Date(item.timestamp).toLocaleString('vi-VN');
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 text-sm';
      row.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="w-3.5 h-3.5 rounded-full" style="background-color: ${item.prizeColor || '#ffd700'}"></span>
          <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(item.prizeText)}</span>
        </div>
        <div class="text-xs text-slate-400 flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
          ${item.clientIp ? `<span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60">${escapeHtml(item.clientIp)}</span>` : ''}
          <span>${date}</span>
        </div>
      `;
      historyList.appendChild(row);
    });
  } catch (e) {
    console.error('Lỗi tải lịch sử:', e);
  }
}

/**
 * Cập nhật xem trước mã QR
 */
function updateQrPreview() {
  const qrImage = document.getElementById('adminQrPreview');
  const qrDownloadBtn = document.getElementById('adminQrDownloadBtn');
  const qrColor = document.getElementById('qrColorPicker')?.value || '#000000';
  const qrBgColor = document.getElementById('qrBgColorPicker')?.value || '#ffffff';
  const includeLogo = document.getElementById('qrIncludeLogoCheck')?.checked ? 'true' : 'false';

  const cleanColor = qrColor.replace('#', '');
  const cleanBg = qrBgColor.replace('#', '');
  const logoParam = wheelData?.logoUrl ? `&logoUrl=${encodeURIComponent(wheelData.logoUrl)}` : '';

  const qrUrl = `/api/qr/${encodeURIComponent(currentWheelId)}?color=${cleanColor}&bgColor=${cleanBg}&includeLogo=${includeLogo}&size=800${logoParam}&_t=${Date.now()}`;

  if (qrImage) qrImage.src = qrUrl;
  if (qrDownloadBtn) qrDownloadBtn.href = qrUrl;
}

/**
 * Lưu toàn bộ cấu hình vòng quay
 */
async function saveAllSettings() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu cấu hình...';
  }

  try {
    const nameInput = document.getElementById('wheelNameInput');
    const opacitySlider = document.getElementById('bgOpacitySlider');

    const payload = {
      name: nameInput ? nameInput.value.trim() : wheelData.name,
      logoUrl: wheelData.logoUrl || '',
      background: wheelData.background || '',
      backgroundOpacity: opacitySlider ? (parseInt(opacitySlider.value, 10) / 100) : wheelData.backgroundOpacity,
      segments: wheelData.segments
    };

    const res = await fetch(`/api/admin/wheels/${encodeURIComponent(currentWheelId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await parseResponseJson(res);

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Không thể lưu cài đặt.');
    }

    // Cập nhật ngay bộ nhớ cache để bảo toàn dữ liệu 100%
    if (wheelData) {
      if (payload.name) wheelData.name = payload.name;
      if (payload.backgroundOpacity !== undefined) wheelData.backgroundOpacity = payload.backgroundOpacity;
      sessionStorage.setItem(`admin_wheel_cache_${currentWheelId}`, JSON.stringify(wheelData));
    }

    showToast('Lưu cài đặt vòng quay thành công!');
    loadAdminWheelData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu Thay Đổi';
    }
  }
}

/**
 * Tải file ảnh lên qua Server (Multer RAM + Sharp + ImgBB)
 */
async function uploadImageFile(file, type = 'logo') {
  const formData = new FormData();
  formData.append('image', file);

  showToast('Đang tải ảnh lên máy chủ...');

  const res = await fetch(`/api/admin/wheels/${encodeURIComponent(currentWheelId)}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${currentAdminToken}`
    },
    body: formData
  });

  const data = await parseResponseJson(res);

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Tải ảnh thất bại.');
  }

  return data.url;
}

/**
 * Khởi tạo toàn bộ sự kiện trang Admin
 */
function initAdminEvents() {
  // Đăng nhập Admin
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const passInput = document.getElementById('adminPasswordInput');
      if (passInput) handleAdminLogin(passInput.value);
    });
  }

  // Nút Lưu cài đặt
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveAllSettings);

  // Thêm ô quà
  const addSegBtn = document.getElementById('addSegmentBtn');
  if (addSegBtn) addSegBtn.addEventListener('click', addNewSegment);

  // Nút chuẩn hóa 100%
  const normalizeBtn = document.getElementById('normalizeWeightsBtn');
  if (normalizeBtn) normalizeBtn.addEventListener('click', normalizeWeightsTo100);

  // Thanh trượt độ mờ nền (20% - 30%)
  const opacitySlider = document.getElementById('bgOpacitySlider');
  const opacityValText = document.getElementById('bgOpacityValue');
  if (opacitySlider && opacityValText) {
    opacitySlider.addEventListener('input', (e) => {
      opacityValText.textContent = `${e.target.value}%`;
      if (wheelData) {
        wheelData.backgroundOpacity = parseInt(e.target.value, 10) / 100;
      }
    });
  }

  // Upload Logo
  const logoFileInput = document.getElementById('logoFileInput');
  if (logoFileInput) {
    logoFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const url = await uploadImageFile(file, 'logo');
        wheelData.logoUrl = url;
        const logoPreview = document.getElementById('logoPreview');
        if (logoPreview) {
          logoPreview.src = url;
          logoPreview.classList.remove('hidden');
        }
        updateQrPreview();
        showToast('Tải logo quán thành công!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Upload Nền riêng
  const bgFileInput = document.getElementById('bgFileInput');
  if (bgFileInput) {
    bgFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const url = await uploadImageFile(file, 'bg');
        wheelData.background = url;
        showToast('Tải nền riêng thành công!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Lọc tab danh mục nền
  document.querySelectorAll('.bg-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.bg-tab-btn').forEach((b) => b.classList.remove('bg-indigo-600', 'text-white'));
      e.currentTarget.classList.add('bg-indigo-600', 'text-white');
      renderBackgroundGallery(e.currentTarget.dataset.category);
    });
  });

  // Tùy chọn QR Code (Cập nhật thời gian thực khi chọn màu)
  ['qrColorPicker', 'qrBgColorPicker', 'qrIncludeLogoCheck'].forEach((id) => {
    const elem = document.getElementById(id);
    if (elem) {
      elem.addEventListener('change', updateQrPreview);
      elem.addEventListener('input', updateQrPreview);
    }
  });

  // Sao chép link khách
  const copyLinkBtn = document.getElementById('copyPlayerLinkBtn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      const playerLinkInput = document.getElementById('playerShareLink');
      if (playerLinkInput) {
        copyToClipboard(playerLinkInput.value);
        showToast('Đã sao chép liên kết vòng quay!');
      }
    });
  }
}

/**
 * Thoát ký tự HTML chống XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
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
 * Hiển thị Toast thông báo đẹp mắt, không chặn màn hình
 */
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600 border-rose-500' : 'bg-slate-900 border-slate-700';
  toast.className = `fixed bottom-5 right-5 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl z-50 animate-bounce border ${bg}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
