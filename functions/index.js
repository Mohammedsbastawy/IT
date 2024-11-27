const functions = require('firebase-functions');
const express = require('express');
const app = express();

// إعدادات الوسطى الوسطى
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// استيراد ملفات السيرفر
const server = require('./path/to/server.js'); // تحديث المسار حسب موقع ملف server.js
app.use(server);

exports.app = functions.https.onRequest(app);
