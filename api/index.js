/**
 * Vercel Serverless Function Entry Point
 * Điều hướng tất cả request về Express Monolith app trong server.js
 */

const app = require('../server');

module.exports = app;
