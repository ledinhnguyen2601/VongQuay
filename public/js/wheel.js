/**
 * Lucky Wheel SaaS - Canvas Wheel Engine (Retina Ready)
 * Tối ưu hiển thị chữ không bị che, tự động ngắt dòng thông minh (Multi-line wrap)
 * Thời gian quay ngẫu nhiên biến thiên 5s - 19s tạo cảm giác chân thật và hồi hộp.
 */

class LuckyWheel {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error(`Không tìm thấy Canvas với ID "${canvasId}"`);
    this.ctx = this.canvas.getContext('2d');

    this.segments = options.segments || [];
    this.logoUrl = options.logoUrl || '';
    this.onSpinEnd = options.onSpinEnd || (() => { });
    this.onTick = options.onTick || (() => { });

    // Trạng thái quay
    this.isSpinning = false;
    this.currentRotation = 0; // Radian
    this.logoImage = null;

    // Âm thanh Web Audio API
    this.audioCtx = null;

    // Khởi tạo kích thước Canvas
    this.resize();
    this.boundResize = () => this.resize();
    window.addEventListener('resize', this.boundResize);

    // Tải logo nếu có
    if (this.logoUrl) {
      this.loadLogo(this.logoUrl);
    }
  }

  /**
   * Gỡ bỏ trình nghe sự kiện khi hủy đối tượng
   */
  destroy() {
    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
      this.boundResize = null;
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
      osc.frequency.setValueAtTime(620, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, this.audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.14, this.audioCtx.currentTime);
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
    this.radius = this.center - 10; // Chừa lề cho viền và bóng

    this.draw();
  }

  /**
   * Tải ảnh logo cửa hàng vào tâm vòng quay
   */
  loadLogo(url) {
    if (this.isSpinning) return;
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
    if (this.isSpinning) return;
    this.segments = segments || [];
    this.draw();
  }

  /**
   * Tính toán chính xác chỉ số ô quà hiện đang nằm dưới kim chỉ đỉnh (12h)
   * Phục vụ tự kiểm tra đối soát toán học
   */
  getPointerSegmentIndex() {
    const numSegments = this.segments.length;
    if (numSegments === 0) return -1;
    const anglePerSegment = (Math.PI * 2) / numSegments;
    const normRotation = ((this.currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const pointerAngle = (3 * Math.PI) / 2;
    const wheelAngle = ((pointerAngle - normRotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(wheelAngle / anglePerSegment) % numSegments;
  }

  /**
   * Tính toán độ sáng tương đối (Relative Luminance - WCAG 2.1)
   * Tự động quyết định màu chữ trắng hay đen để đạt tương phản >= 4.5:1
   */
  getTextContrastColor(hexColor) {
    let hex = (hexColor || '#3B82F6').replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    return luminance > 0.45 ? '#111827' : '#FFFFFF';
  }

  /**
   * Hàm ngắt dòng chữ thông minh và cân xứng nhất
   * Đảm bảo không bao giờ bị cắt thành dấu ba chấm ...
   */
  splitTextIntoLines(text, maxCharsPerLine = 10) {
    const trimmed = (text || '').trim();
    if (trimmed.length <= maxCharsPerLine) {
      return [trimmed];
    }

    const words = trimmed.split(/\s+/);
    if (words.length <= 1) {
      const mid = Math.ceil(trimmed.length / 2);
      return [trimmed.slice(0, mid), trimmed.slice(mid)];
    }

    // Tìm vị trí ngắt từ sao cho 2 dòng có độ dài ký tự cân đối nhất
    let bestSplitIndex = 1;
    let minDiff = Infinity;
    const totalLen = trimmed.length;

    let currentLen = 0;
    for (let i = 0; i < words.length - 1; i++) {
      currentLen += words[i].length + (i > 0 ? 1 : 0);
      const remainingLen = totalLen - currentLen - 1;
      const diff = Math.abs(currentLen - remainingLen);
      if (diff < minDiff) {
        minDiff = diff;
        bestSplitIndex = i + 1;
      }
    }

    const line1 = words.slice(0, bestSplitIndex).join(' ');
    const line2 = words.slice(bestSplitIndex).join(' ');
    return [line1, line2];
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

      // Nếu là ô trúng thưởng vừa quay vào -> Thêm viền vàng nổi bật (Golden Highlight)
      if (this.winningIndex === i) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      } else {
        // Viền cánh quạt mạ kim sang trọng
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 2. Vẽ chữ trên cánh quạt (Tối ưu thụt vào trong cách mép an toàn để mũi kim không bao giờ che chữ)
      ctx.save();
      ctx.rotate(startAngle + anglePerSegment / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Màu chữ tối ưu theo tương phản WCAG
      ctx.fillStyle = this.getTextContrastColor(seg.color);

      // Tách chữ thành 1 hoặc 2 dòng cân xứng
      const lines = this.splitTextIntoLines(seg.text, 10);
      const longestLine = Math.max(...lines.map((l) => l.length));

      // Kích thước font chữ tự động điều chỉnh linh hoạt theo số ô và độ dài chữ
      let baseFontSize = Math.max(11, Math.min(15, Math.floor(this.size / (numSegments > 8 ? 28 : 25))));
      if (longestLine > 10) {
        baseFontSize = Math.max(10, Math.floor(baseFontSize * (10 / longestLine)));
      }
      ctx.font = `800 ${baseFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      // Vị trí chữ: Thụt vào cách mép ngoài an toàn (Ít nhất 44px để mũi kim 28px không bao giờ che chữ)
      const textMarginFromEdge = Math.max(44, radius * 0.22);
      const textX = radius - textMarginFromEdge;

      if (lines.length === 1) {
        ctx.fillText(lines[0], textX, 0);
      } else {
        const lineHeight = baseFontSize * 1.25;
        ctx.fillText(lines[0], textX, -lineHeight / 2);
        ctx.fillText(lines[1], textX, lineHeight / 2);
      }

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
      ctx.shadowBlur = 0;
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
   * Thời gian quay ngẫu nhiên biến thiên từ 5s đến 19s theo yêu cầu
   * @param {number} targetIndex - Vị trí ô trúng do server trả về
   * @param {number} customDurationMs - Thời gian quay (nếu không truyền sẽ tự random 5s - 19s)
   */
  spinTo(targetIndex, customDurationMs = null) {
    if (this.isSpinning) return;
    this.initAudio();

    const numSegments = this.segments.length;
    if (numSegments === 0) return;

    this.isSpinning = true;

    // RANDOM THỜI GIAN QUAY THẬT SỰ (Biến thiên từ 5.0 giây đến 19.0 giây theo yêu cầu)
    let durationMs = customDurationMs;
    if (!durationMs) {
      // Sinh ngẫu nhiên thực sự trong toàn dải từ 5000ms (5s) đến 19000ms (19s)
      durationMs = Math.floor(Math.random() * (19000 - 5000 + 1)) + 5000;
    }
    // Đảm bảo nghiêm ngặt nằm trong dải 5s - 19s tối đa
    durationMs = Math.min(Math.max(durationMs, 5000), 19000);

    const anglePerSegment = (Math.PI * 2) / numSegments;

    // Kim chỉ cắm tại đỉnh 12 giờ (top) = 3 * Math.PI / 2 (270 độ)
    // Căn chuẩn xác 100% vào chính giữa ô quà (đường phân giác góc của ô targetIndex)
    // Tuyệt đối KHÔNG dao động ngẫu nhiên làm kim xê dịch sang vạch mép ô khác
    const targetCenterAngle = (targetIndex + 0.5) * anglePerSegment;
    const targetAngle = (3 * Math.PI) / 2 - targetCenterAngle;

    // Số vòng quay tối thiểu tăng theo thời gian để tốc độ quay tự nhiên
    const minSpins = Math.floor(Math.floor(durationMs / 1000) * 1.6) + 4;
    const extraRotations = minSpins * Math.PI * 2;

    const startRotation = this.currentRotation % (Math.PI * 2);
    // Tính toán góc quay chuẩn xác luôn tiến về phía trước theo chiều kim đồng hồ
    const diffAngle = ((targetAngle - startRotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const totalRotationTarget = startRotation + extraRotations + diffAngle;

    const startTime = performance.now();
    let lastSegmentPassed = -1;

    // Reset lại ô trúng thưởng cũ khi bắt đầu quay mới
    this.winningIndex = -1;

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
        // Hoàn thành quay
        this.isSpinning = false;
        this.currentRotation = totalRotationTarget; // Chốt chính xác góc đích
        this.winningIndex = targetIndex; // Đánh dấu ô trúng thưởng để highlight
        this.draw(); // Vẽ lại để hiển thị viền vàng rực rỡ tại ô trúng

        // Đảm bảo gỡ class tick để mũi kim luôn thẳng đứng 100% vào tâm ô
        const pointer = document.getElementById('wheelPointer');
        if (pointer) {
          pointer.classList.remove('tick');
        }

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
