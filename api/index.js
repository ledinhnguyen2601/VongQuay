/**
 * Vercel Serverless Function Entry Point
 * Điều hướng tất cả request về Express Monolith app trong server.js
 */

const app = require('../server');

module.exports = (req, res) => {
  // 1. Phục hồi URL thực tế nếu Vercel rewrite làm thay đổi req.url
  const matchedPath = req.headers['x-matched-path'];
  const originalUri = req.headers['x-now-route-matches'] || req.headers['x-forwarded-uri'];

  // Bảo toàn nguyên vẹn query string từ req.url ban đầu (màu QR, size, v.v.)
  const qIdx = req.url.indexOf('?');
  const queryStr = qIdx !== -1 ? req.url.slice(qIdx) : '';

  if (matchedPath && matchedPath.startsWith('/api')) {
    req.url = matchedPath + (matchedPath.includes('?') ? '' : queryStr);
  } else if (originalUri && originalUri.startsWith('/api')) {
    req.url = originalUri + (originalUri.includes('?') ? '' : queryStr);
  }

  return app(req, res);
};

