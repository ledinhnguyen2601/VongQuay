/**
 * Lucky Wheel SaaS - Canvas Wheel Engine
 * Vẽ vòng quay may mắn chuyên nghiệp, chuẩn Retina, tính tương phản màu chữ tự động theo WCAG AA
 * Hiệu ứng âm thanh qua Web Audio API và pháo hoa Confetti.
 */

class LuckyWheel {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Không tìm thấy Canvas với ID "${canvasId}"`);
    this.ctx = this.canvas.getContext('2d');

    this.segments = options.segments || [];
    this.logoUrl = options.logoUrl || '';
    this.onSpinEnd = options.onSpinEnd || (() => {});
    this.onTick = options.onTick || (() => {});

    // Trạng thái quay
    this.isSpinning = false;
    this.currentRotation = 0; // Góc quay tính theo radian
    this.logoImage = null;

    // Âm thanh Web Audio API
    this.audioCtx = null;

    // Khởi tạo kích thước Canvas
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Tải logo nếu có
    if (this.logoUrl) {
      this.loadLogo(this.logoUrl);
    }
  }

  /**
   * Khởi tạo Web Audio API khi người dùng tương tác
   */
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Phát âm thanh "tick" cơ học khi kim lướt qua từng ô
   */
  playTickSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, this.audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {
      // Bỏ qua lỗi audio trình duyệt
    }
  }

  /**
   * Phát âm thanh chúc mừng chiến thắng (Fanfare)
   */
  playWinSound() {
    if (!this.audioCtx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(this.audioCtx.currentTime + idx * 0.1);
        osc.stop(this.audioCtx.currentTime + idx * 0.1 + 0.4);
      });
    } catch (e) {
      // Bỏ qua
    }
  }

  /**
   * Chuẩn hóa kích thước Canvas theo độ phân giải Retina (HiDPI)
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.size = Math.min(rect.width, rect.height) || 400;

    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.ctx.scale(dpr, dpr);

    this.center = this.size / 2;
    this.radius = this.center - 12; // Chừa lề cho viền và bóng

    this.draw();
  }

  /**
   * Tải ảnh logo cửa hàng vào tâm vòng quay
   */
  loadLogo(url) {
    if (!url) {
      this.logoImage = null;
      this.draw();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.logoImage = img;
      this.draw();
    };
    img.onerror = () => {
      this.logoImage = null;
    };
    img.src = url;
  }

  /**
   * Cập nhật danh sách ô quà mới
   */
  setSegments(segments) {
    this.segments = segments || [];
    this.draw();
  }

  /**
   * Tính toán độ sáng tương đối (Relative Luminance - WCAG 2.1)
   * Tự động quyết định màu chữ trắng hay đen để đạt tương phản >= 4.5:1
   * @param {string} hexColor - Mã màu HEX (#RGB hoặc #RRGGBB)
   * @returns {string} '#FFFFFF' hoặc '#111827'
   */
  getTextContrastColor(hexColor) {
    let hex = (hexColor || '#3B82F6').replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Công thức chuyển đổi sRGB sang Linear RGB
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    // Ngưỡng 0.45 đảm bảo tính tương phản tối ưu
    return luminance > 0.45 ? '#111827' : '#FFFFFF';
  }

  /**
   * Vẽ toàn bộ vòng quay lên Canvas
   */
  draw() {
    const ctx = this.ctx;
    const center = this.center;
    const radius = this.radius;
    const numSegments = this.segments.length;

    ctx.clearRect(0, 0, this.size, this.size);

    if (numSegments === 0) {
      // Hiển thị vòng tròn chờ khi chưa có dữ liệu
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.restore();
      return;
    }

    const anglePerSegment = (Math.PI * 2) / numSegments;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(this.currentRotation);

    // 1. Vẽ các cánh quạt (Segments)
    for (let i = 0; i < numSegments; i++) {
      const seg = this.segments[i];
      const startAngle = i * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Tô màu cánh quạt
      ctx.fillStyle = seg.color || '#4f46e5';
      ctx.fill();

      // Viền cánh quạt mạ kim sang trọng
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Vẽ chữ trên cánh quạt
      ctx.save();
      ctx.rotate(startAngle + anglePerSegment / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Màu chữ tối ưu theo tương phản WCAG
      ctx.fillStyle = this.getTextContrastColor(seg.color);

      // Kích thước font chữ tự co theo bán kính và số ô
      const fontSize = Math.max(12, Math.min(16, Math.floor(this.size / 26)));
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

      // Cắt bớt nếu chữ quá dài để không lấn vào tâm
      const maxTextWidth = radius * 0.58;
      let text = seg.text || '';
      if (ctx.measureText(text).width > maxTextWidth) {
        while (ctx.measureText(text + '…').width > maxTextWidth && text.length > 2) {
          text = text.slice(0, -1);
        }
        text += '…';
      }

      ctx.fillText(text, radius - 20, 0);
      ctx.restore();
    }

    // 3. Viền ngoài kim loại vàng óng (Metallic Gold Border)
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    const goldGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
    goldGrad.addColorStop(0, '#ffd700');
    goldGrad.addColorStop(0.3, '#fff2a1');
    goldGrad.addColorStop(0.6, '#d4af37');
    goldGrad.addColorStop(1, '#aa771c');
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // 4. Các chấm đèn tròn nhỏ lấp lánh trang trí viền ngoài
    const numDots = Math.max(16, numSegments * 2);
    for (let d = 0; d < numDots; d++) {
      const dotAngle = (d * (Math.PI * 2)) / numDots;
      const dotX = Math.cos(dotAngle) * (radius - 5);
      const dotY = Math.sin(dotAngle) * (radius - 5);

      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = d % 2 === 0 ? '#ffffff' : '#ffd700';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    ctx.restore();

    // 5. Vẽ tâm vòng quay (Center Circle / Logo)
    this.drawCenterCircle();
  }

  /**
   * Vẽ vòng tròn ở tâm (chứa Logo nếu có hoặc viền bạc kim)
   */
  drawCenterCircle() {
    const ctx = this.ctx;
    const center = this.center;
    const centerRadius = Math.max(34, this.size * 0.1);

    ctx.save();
    ctx.translate(center, center);

    // Bóng đổ tâm
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Viền vàng kim
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Nếu có logo thì vẽ logo vào tâm
    if (this.logoImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, centerRadius - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        this.logoImage,
        -(centerRadius - 4),
        -(centerRadius - 4),
        (centerRadius - 4) * 2,
        (centerRadius - 4) * 2
      );
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Bắt đầu hiệu ứng quay mượt mà về ô targetIndex do Server quyết định
   * @param {number} targetIndex - Vị trí ô trúng do server trả về
   * @param {number} durationMs - Thời gian quay (mặc định 5500ms)
   */
  spinTo(targetIndex, durationMs = 5500) {
    if (this.isSpinning) return;
    this.initAudio();

    const numSegments = this.segments.length;
    if (numSegments === 0) return;

    this.isSpinning = true;

    const anglePerSegment = (Math.PI * 2) / numSegments;

    // Kim chỉ nằm ở góc 12 giờ (top), tức là góc -Math.PI / 2 (hoặc 3*Math.PI / 2)
    // Khi góc quay tổng thể là R, ô ở đỉnh kim chỉ là:
    // pointerAngle = (-Math.PI/2 - R) mod 2PI
    // Chúng ta cần: targetIndex * anglePerSegment + anglePerSegment/2 = pointerAngle
    // => R = -Math.PI/2 - (targetIndex + 0.5) * anglePerSegment

    const targetCenterAngle = (targetIndex + 0.5) * anglePerSegment;
    // Thêm một chút dao động ngẫu nhiên nhỏ trong ô (-25% đến +25% bề rộng ô) để tạo cảm giác tự nhiên
    const randomJitter = (Math.random() - 0.5) * (anglePerSegment * 0.5);

    // Đích dừng tương đối trong vòng tròn
    let targetAngle = (3 * Math.PI) / 2 - targetCenterAngle + randomJitter;

    // Thêm số vòng quay tối thiểu (6 đến 9 vòng đầy đủ)
    const minSpins = 7;
    const extraRotations = minSpins * Math.PI * 2;

    const startRotation = this.currentRotation % (Math.PI * 2);
    // Tính toán góc đích tổng cộng
    const totalRotationTarget = startRotation + extraRotations + (targetAngle - startRotation + Math.PI * 4) % (Math.PI * 2);

    const startTime = performance.now();
    let lastSegmentPassed = -1;

    // Hàm Easing Cubic Ease-Out siêu mượt
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOutCubic(progress);

      this.currentRotation = startRotation + (totalRotationTarget - startRotation) * easedProgress;

      // Tính ô hiện tại lướt qua kim để kích hoạt âm thanh tick
      const currentPointerSegment = Math.floor(
        ((((3 * Math.PI) / 2 - (this.currentRotation % (Math.PI * 2))) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / anglePerSegment
      );

      if (currentPointerSegment !== lastSegmentPassed) {
        lastSegmentPassed = currentPointerSegment;
        this.playTickSound();
        this.onTick();
      }

      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Đã hoàn thành quay
        this.isSpinning = false;
        this.playWinSound();
        this.triggerConfetti();

        if (this.onSpinEnd) {
          this.onSpinEnd(targetIndex, this.segments[targetIndex]);
        }
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Bắn pháo hoa giấy Confetti rực rỡ ăn mừng chiến thắng
   */
  triggerConfetti() {
    const confettiCanvas = document.getElementById('confettiCanvas');
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext('2d');

    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FCD34D'];
    const particles = [];
    const numParticles = 120;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 100,
        y: confettiCanvas.height / 2 + (Math.random() - 0.5) * 50,
        w: Math.random() * 8 + 5,
        h: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 1.2) * 15,
        gravity: 0.35,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      });
    }

    let start = performance.now();
    const renderConfetti = (time) => {
      const elapsed = time - start;
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotationSpeed;
        p.opacity = Math.max(0, 1 - elapsed / 3200);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < 3200) {
        requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    };

    requestAnimationFrame(renderConfetti);
  }
}

window.LuckyWheel = LuckyWheel;
