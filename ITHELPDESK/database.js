const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// إنشاء قاعدة البيانات
const db = new sqlite3.Database(path.join(__dirname, 'users.db'), (err) => {
    if (err) {
        console.error('خطأ في فتح قاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات بنجاح!');
    }
});
db.serialize(() => {
    // جدول الموظفين مع إضافة حقل القسم
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        department TEXT NOT NULL
    )`);

    // جدول الأجهزة مع إضافة حقل القسم
    db.run(`CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        ip TEXT NOT NULL,
        department TEXT NOT NULL
    )`);
});
// إضافة جداول جديدة لقاعدة البيانات
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        ip TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS offices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('خطأ في إنشاء الجدول:', err.message);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL,
        deferredReason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = db;
