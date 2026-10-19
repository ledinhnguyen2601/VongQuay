/**
 * Vercel Serverless Function Entry Point
 * Điều hướng tất cả request về Express Monolith app trong server.js
 */

const app = require('../server');

module.exports = (req, res) => {
  // 1. Phục hồi URL thực tế nếu Vercel rewrite làm thay đổi req.url
  const matchedPath = req.headers['x-matched-path'];
  const originalUri = req.headers['x-now-route-matches'] || req.headers['x-forwarded-uri'];

  if (matchedPath && matchedPath.startsWith('/api') && req.url !== matchedPath) {
    req.url = matchedPath;
  } else if (originalUri && originalUri.startsWith('/api') && req.url !== originalUri) {
    req.url = originalUri;
  }

  return app(req, res);
};

