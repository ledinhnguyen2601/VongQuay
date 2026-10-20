/**
 * Lucky Wheel SaaS - Database Abstraction Layer
 * Kết nối Firebase Realtime Database qua firebase-admin,
 * kèm Fallback In-Memory Store chuẩn xác khi chạy thử nghiệm nội bộ.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

let isFirebaseConnected = false;
let firebaseDb = null;

// Cố gắng khởi tạo Firebase Admin SDK
if ((config.firebase.serviceAccountBase64 || config.firebase.serviceAccountPath) && config.firebase.databaseURL) {
  try {
    const admin = require('firebase-admin');
    let serviceAccount = null;

    // 1. Ưu tiên giải mã trực tiếp từ RAM qua biến môi trường Base64 (Chuẩn bảo mật cao nhất, không để file lộ trên ổ đĩa)
    if (config.firebase.serviceAccountBase64) {
      const decodedJson = Buffer.from(config.firebase.serviceAccountBase64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decodedJson);
    } else if (config.firebase.serviceAccountPath) {
      // 2. Fallback đọc file nếu cấu hình đường dẫn file
      const serviceAccountAbsolutePath = path.isAbsolute(config.firebase.serviceAccountPath)
        ? config.firebase.serviceAccountPath
        : path.resolve(process.cwd(), config.firebase.serviceAccountPath);

      if (fs.existsSync(serviceAccountAbsolutePath)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountAbsolutePath, 'utf8'));
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.firebase.databaseURL
      });

      firebaseDb = admin.database();
      isFirebaseConnected = true;
      console.log('✅ [DATABASE]: Đã kết nối thành công tới Firebase Realtime Database (Bảo mật qua RAM).');
    } else {
      if (config.nodeEnv === 'production') {
        throw new Error('❌ [DATABASE PRODUCTION LỖI]: Không tìm thấy thông tin xác thực Firebase hợp lệ. Từ chối chạy chế độ In-Memory trong production.');
      }
      console.warn('⚠️ [DATABASE]: Không tìm thấy thông tin Firebase hợp lệ. Chuyển sang In-Memory Database.');
    }
  } catch (error) {
    console.error('❌ [DATABASE]: Khởi tạo Firebase thất bại:', error.message);
    if (config.nodeEnv === 'production') {
      throw new Error(`❌ [DATABASE PRODUCTION LỖI]: Khởi tạo Firebase thất bại: ${error.message}. Từ chối chạy chế độ In-Memory trong production.`);
    }
    console.warn('⚠️ [DATABASE]: Tự động chuyển sang In-Memory Database.');
  }
} else {
  if (config.nodeEnv === 'production') {
    throw new Error('❌ [DATABASE PRODUCTION LỖI]: Thiếu cấu hình Firebase trong production.');
  }
}

const os = require('os');

/**
 * In-Memory & File-backed Store Fallback
 * Giữ dữ liệu trên RAM và đồng bộ xuống file tạm để chống mất mát dữ liệu
 * khi chạy local hoặc trên môi trường Serverless (Vercel/Cloud Functions)
 */
const FALLBACK_DB_FILE = path.join(os.tmpdir(), 'lucky_wheel_fallback_db.json');

class MemoryDatabase {
  constructor() {
    this.wheels = new Map(); // key: wheelId -> wheel object
    this.history = new Map(); // key: wheelId -> array of history records
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(FALLBACK_DB_FILE)) {
        const raw = fs.readFileSync(FALLBACK_DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.wheels && Array.isArray(parsed.wheels)) {
          this.wheels = new Map(parsed.wheels);
        }
        if (parsed.history && Array.isArray(parsed.history)) {
          this.history = new Map(parsed.history);
        }
      }
    } catch (e) {
      // Bỏ qua lỗi đọc file nếu rỗng hoặc hỏng
    }
  }

  saveToDisk() {
    try {
      const dump = {
        wheels: Array.from(this.wheels.entries()),
        history: Array.from(this.history.entries()),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(dump), 'utf8');
    } catch (e) {
      // Không để lỗi ghi file tạm làm crash ứng dụng
    }
  }

  async getWheel(wheelId) {
    if (!wheelId || typeof wheelId !== 'string') return null;
    let wheel = this.wheels.get(wheelId);
    if (!wheel) {
      // Thử đọc lại từ đĩa nếu instance khác vừa ghi
      this.loadFromDisk();
      wheel = this.wheels.get(wheelId);
    }
    return wheel ? JSON.parse(JSON.stringify(wheel)) : null;
  }

  async saveWheel(wheelId, wheelData) {
    if (!wheelId || !wheelData) throw new Error('wheelId và wheelData là bắt buộc');
    const toSave = {
      ...wheelData,
      wheelId,
      updatedAt: new Date().toISOString()
    };
    this.wheels.set(wheelId, JSON.parse(JSON.stringify(toSave)));
    this.saveToDisk();
    return toSave;
  }

  async updateWheel(wheelId, partialData) {
    const existing = await this.getWheel(wheelId);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...partialData,
      updatedAt: new Date().toISOString()
    };
    this.wheels.set(wheelId, JSON.parse(JSON.stringify(updated)));
    this.saveToDisk();
    return updated;
  }

  async addSpinHistory(wheelId, record) {
    if (!this.history.has(wheelId)) {
      this.history.set(wheelId, []);
    }
    const list = this.history.get(wheelId);
    const item = {
      ...record,
      timestamp: new Date().toISOString()
    };
    // Giữ tối đa 200 lượt quay gần nhất để tối ưu RAM
    list.unshift(item);
    if (list.length > 200) {
      list.pop();
    }
    this.saveToDisk();
    return item;
  }

  async getSpinHistory(wheelId, limit = 50) {
    if (!this.history.has(wheelId)) {
      this.loadFromDisk();
    }
    const list = this.history.get(wheelId) || [];
    return list.slice(0, limit);
  }
}

const memoryDb = new MemoryDatabase();

/**
 * Adapter thống nhất Firebase Admin & Memory Store
 */
const db = {
  isUsingFirebase: () => isFirebaseConnected,

  /**
   * Lấy dữ liệu đầy đủ của một vòng quay theo wheelId
   */
  async getWheel(wheelId) {
    if (!wheelId || typeof wheelId !== 'string') return null;

    if (isFirebaseConnected && firebaseDb) {
      const snapshot = await firebaseDb.ref(`wheels/${wheelId}`).once('value');
      return snapshot.exists() ? snapshot.val() : null;
    }
    return await memoryDb.getWheel(wheelId);
  },

  /**
   * Tạo mới hoặc ghi đè một vòng quay
   */
  async saveWheel(wheelId, wheelData) {
    if (!wheelId) throw new Error('Thiếu wheelId');

    const dataToSave = {
      ...wheelData,
      wheelId,
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConnected && firebaseDb) {
      await firebaseDb.ref(`wheels/${wheelId}`).set(dataToSave);
      return dataToSave;
    }
    return await memoryDb.saveWheel(wheelId, dataToSave);
  },

  /**
   * Cập nhật một phần dữ liệu của vòng quay
   */
  async updateWheel(wheelId, partialData) {
    if (!wheelId) throw new Error('Thiếu wheelId');

    const toUpdate = {
      ...partialData,
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConnected && firebaseDb) {
      await firebaseDb.ref(`wheels/${wheelId}`).update(toUpdate);
      const snapshot = await firebaseDb.ref(`wheels/${wheelId}`).once('value');
      return snapshot.val();
    }
    return await memoryDb.updateWheel(wheelId, toUpdate);
  },

  /**
   * Lưu lại một lượt quay vào lịch sử phía server
   */
  async addSpinHistory(wheelId, spinRecord) {
    if (!wheelId) throw new Error('Thiếu wheelId');

    const record = {
      ...spinRecord,
      timestamp: new Date().toISOString()
    };

    if (isFirebaseConnected && firebaseDb) {
      const historyRef = firebaseDb.ref(`history/${wheelId}`);
      await historyRef.push(record);
      return record;
    }
    return await memoryDb.addSpinHistory(wheelId, record);
  },

  /**
   * Lấy lịch sử quay gần đây của một vòng quay (chỉ admin xem được)
   */
  async getSpinHistory(wheelId, limit = 50) {
    if (!wheelId) return [];

    if (isFirebaseConnected && firebaseDb) {
      const snapshot = await firebaseDb.ref(`history/${wheelId}`)
        .orderByChild('timestamp')
        .limitToLast(limit)
        .once('value');

      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      // Chuyển đối tượng Firebase sang mảng sắp xếp mới nhất lên đầu
      return Object.values(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    return await memoryDb.getSpinHistory(wheelId, limit);
  }
};

module.exports = db;
